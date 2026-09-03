/*
 * Viola Libre — service worker
 * Copyright (C) 2026 Matheus Coelho
 * Licenciado sob a GNU AGPL-3.0 — veja o arquivo LICENSE na raiz do projeto.
 *
 * O QUE ELE RESOLVE
 *
 * Sem ele, o site não abre sem internet: o navegador não busca o index.html nem o bundle,
 * e por isso as cifras guardadas no IndexedDB ficam inalcançáveis — o código que as leria
 * nunca chega a rodar. Este arquivo é a casca; `cifraCache.ts` é o conteúdo.
 *
 * PRIORIDADE ONLINE, COM PRAZO
 *
 * A regra é sempre tentar a rede e só ficar no cache se ela não vier. Mas "não vier"
 * precisa de definição: sem rede o `fetch` falha em milissegundos, enquanto portal
 * cativo, sinal fraco ou DNS pendurado seguram por 30 segundos ou mais. Por isso a
 * navegação corre contra um PRAZO — passou dele, serve o que tem e continua atualizando
 * por trás. Ninguém fica olhando para tela branca esperando uma rede que não vem.
 *
 * POR QUE OS ASSETS NÃO CORREM ESSA CORRIDA
 *
 * `index-CJguvHes.js` nunca muda de conteúdo: um build novo gera um NOME novo. Ir à rede
 * buscá-lo só pode devolver os mesmos bytes, e numa conexão de uma barra isso é esperar
 * o prazo de 1 MB à toa. A versão nova entra pelo index.html, que é quem aponta os hashes
 * — com ele fresco, os assets novos vêm sozinhos porque não estão no cache.
 *
 * O QUE ELE NÃO TOCA
 *
 * `/api/*` passa direto. O IndexedDB já é dono desse dado (ver `cifraCache.ts`), e dois
 * caches para a mesma coisa dariam duas regras de validade e um "por que está velho?"
 * impossível de responder.
 *
 * COMO DESLIGAR, SE PRECISAR
 *
 * Um service worker é o único artefato capaz de servir código velho a quem já visitou.
 * Duas saídas, nesta ordem:
 *   1. publicar um sw.js que só chame `unregister()` — funciona porque o `_headers` manda
 *      `Cache-Control: no-cache` para este arquivo, então o navegador sempre confere a
 *      versão nova;
 *   2. no console da página: `navigator.serviceWorker.controller.postMessage('desativar')`
 *      — remove o registro e apaga os caches sem depender de deploy.
 */

const VERSAO = 'v1';
const CACHE = `viola-libre-casca-${VERSAO}`;

/**
 * Quanto esperar a rede na navegação antes de servir o cache.
 *
 * 2,5s é o ponto em que a espera passa a ser sentida como travamento. Perder a corrida
 * não cancela a busca: ela continua e atualiza o cache para a próxima abertura.
 */
const PRAZO_REDE_MS = 2500;

/**
 * Toda navegação guarda e lê a casca por ESTA chave, e não pela URL pedida.
 *
 * O host devolve o index.html para qualquer caminho (ver `_redirects`), então guardar por
 * URL encheria o cache com cópias idênticas e, pior, quem chegasse offline direto em
 * /favoritos sem ter passado por lá antes não acharia nada.
 */
const CHAVE_CASCA = '/index.html';

/** Grande demais para valer o espaço, e nunca pedido pelo app — só por quem indexa. */
const NUNCA_GUARDAR = ['/sitemap.xml'];

self.addEventListener('install', (event) => {
  // A casca é buscada já na instalação para que a PRIMEIRA visita sem rede depois dela já
  // funcione. É o único download antecipado, e é o index.html — alguns KB.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(new Request(CHAVE_CASCA, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n.startsWith('viola-libre-casca-') && n !== CACHE)
          .map((n) => caches.delete(n))
      ))
      // `claim` para a versão nova valer nas abas já abertas em vez de esperar todas
      // fecharem — sem isso, corrigir um defeito exigiria que a pessoa fechasse o site.
      .then(() => self.clients.claim())
  );
});

/** A saída de emergência descrita no cabeçalho. */
self.addEventListener('message', (event) => {
  if (event.data !== 'desativar') return;
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.map((n) => caches.delete(n))))
      .then(() => self.registration.unregister())
  );
});

const prazo = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Vale guardar? Só o que veio inteiro, da nossa origem, e não está na lista de exclusão. */
function podeGuardar(res, url) {
  return Boolean(res)
    && res.status === 200
    && res.type === 'basic'
    && !NUNCA_GUARDAR.some((p) => url.pathname === p);
}

/**
 * Navegação: rede primeiro, cache se a rede não vier a tempo.
 *
 * Na primeira visita não há cache, então a rede é a única opção e vale esperar o quanto
 * for — servir "offline" a quem tem internet e só está numa conexão lenta seria pior.
 */
async function navegacao(request) {
  const cache = await caches.open(CACHE);

  const daRede = fetch(request).then((res) => {
    if (podeGuardar(res, new URL(request.url))) void cache.put(CHAVE_CASCA, res.clone());
    return res;
  });

  const guardada = await cache.match(CHAVE_CASCA);
  if (!guardada) return daRede;

  return Promise.race([
    // Rede que falha rápido (sem sinal) cai no cache na hora, sem esperar o prazo.
    daRede.catch(() => guardada),
    prazo(PRAZO_REDE_MS).then(() => guardada),
  ]);
}

/** Asset com hash no nome: imutável, então o cache é a resposta certa e mais rápida. */
async function doCacheOuRede(request, url) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const res = await fetch(request);
  if (podeGuardar(res, url)) void cache.put(request, res.clone());
  return res;
}

/** `/assets/...` é onde o Vite emite os arquivos com hash de conteúdo. */
const temHashNoNome = (url) => url.pathname.startsWith('/assets/');

/** Ícones e manifesto: pequenos, estáveis, e pedidos em toda carga. */
const ehEstatico = (url) =>
  /\.(png|svg|ico|webmanifest)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Outra origem (YouTube, fontes) passa direto: guardar coisa de terceiro sem entender
  // a política de cache dele é como o site quebra de um jeito difícil de diagnosticar.
  if (url.origin !== self.location.origin) return;
  // O IndexedDB é dono das cifras. Ver o cabeçalho.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navegacao(request));
    return;
  }

  if (temHashNoNome(url) || ehEstatico(url)) {
    event.respondWith(doCacheOuRede(request, url));
  }
});
