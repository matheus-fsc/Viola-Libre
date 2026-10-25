/**
 * Mantém fora do índice o domínio de pré-visualização do Cloudflare Pages.
 *
 * O projeto é servido em dois endereços: `violalibre.com.br` e o
 * `viola-libre.pages.dev` que o Pages cria sozinho. O segundo entrega o site
 * INTEIRO, com o mesmo robots.txt permissivo — ou seja, uma cópia completa do
 * acervo num domínio rastreável. Pior: `api.violalibre.com.br/<qualquer-coisa
 * -fora-de-/api>` responde 301 para lá, então há um caminho ativo levando
 * rastreador para a duplicata.
 *
 * A canônica absoluta do `index.html` já aponta para o domínio real e ajuda,
 * mas depende de o Google resolvê-la. `X-Robots-Tag: noindex` não depende: vem
 * no cabeçalho, antes de qualquer HTML ou JavaScript.
 *
 * Por que middleware e não `_headers`: o `_headers` casa por CAMINHO, e o
 * caminho é idêntico nos dois domínios. Por que não `_redirects`: a
 * documentação do Pages é explícita em não suportar redirecionamento por
 * domínio ("Domain-level redirects" consta como não suportado). Sobra o
 * Functions.
 *
 * Duas respostas, conforme o endereço:
 * - `viola-libre.pages.dev`, o endereço de produção do Pages, responde 301 para o
 *   mesmo caminho em `violalibre.com.br`. Melhor que `noindex`: o redirecionamento
 *   leva para o domínio bom qualquer link que tenha apontado para a duplicata.
 * - `<hash>.viola-libre.pages.dev`, a prévia de cada deploy, continua abrindo (é
 *   útil para conferir um deploy antes de ir ao ar), só que marcada `noindex`.
 *
 * `follow` e não `nofollow` de propósito: queremos que o rastreador SIGA os
 * links e chegue às páginas equivalentes no domínio bom; só não queremos que
 * indexe estas.
 *
 * Preço disto: cada requisição que passa aqui é uma invocação de Worker, e a cota
 * grátis é de 100 mil por dia. Em outubro de 2026 o site recebia ~540 mil
 * requisições por dia, 90% de robôs, e a cota estourava diariamente. Por isso o
 * `public/_routes.json` tira desta função tudo o que é arquivo estático (bundle,
 * ícones, sitemaps, robots.txt, sw.js): só as páginas passam por aqui. Arquivo
 * novo na raiz de `public/` deve entrar lá também.
 */

/**
 * Só o que a middleware usa do contexto do Pages Functions.
 *
 * Declarado à mão para não trazer `@cloudflare/workers-types` só por causa de
 * dois campos — e para este arquivo continuar passando no `eslint .` sem
 * configuração extra.
 */
interface ContextoPages {
  request: Request;
  next: () => Promise<Response>;
}

/** Domínios cujo conteúdo não deve entrar no índice de busca. */
const HOSPEDEIROS_NAO_INDEXAVEIS = /(^|\.)pages\.dev$/i;

/** O endereço de produção do Pages, que vira redirecionamento para o domínio. */
const HOSPEDEIRO_DE_PRODUCAO_DO_PAGES = 'viola-libre.pages.dev';
const DOMINIO = 'https://violalibre.com.br';

export const onRequest = async (context: ContextoPages): Promise<Response> => {
  let url: URL;
  try {
    url = new URL(context.request.url);
  } catch {
    // URL ilegível não deveria acontecer, mas se acontecer o certo é entregar a
    // resposta como veio: esta middleware existe para marcar uma duplicata, não
    // para decidir se o site responde.
    return context.next();
  }

  if (url.hostname.toLowerCase() === HOSPEDEIRO_DE_PRODUCAO_DO_PAGES) {
    return Response.redirect(DOMINIO + url.pathname + url.search, 301);
  }

  const resposta = await context.next();
  if (!HOSPEDEIROS_NAO_INDEXAVEIS.test(url.hostname)) return resposta;

  // A resposta do `next()` vem com cabeçalhos imutáveis; recriar é o jeito
  // suportado de acrescentar um.
  const comMarca = new Response(resposta.body, resposta);
  comMarca.headers.set('X-Robots-Tag', 'noindex, follow');
  return comMarca;
};
