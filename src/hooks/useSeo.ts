import { useEffect } from 'react';

/**
 * Metadados de busca por rota.
 *
 * Por que imperativo, e não `<title>`/`<meta>` renderizados no JSX (que o React 19
 * sabe içar para o `<head>`): o `index.html` já serve um conjunto completo de tags
 * como fallback para quem não executa JavaScript. O React iça as suas SEM remover
 * as que já estavam lá, e duas `<link rel="canonical">` na mesma página fazem o
 * Google descartar as duas. Aqui a gente ATUALIZA a tag existente, então há sempre
 * exatamente uma de cada.
 *
 * O fallback do `index.html` continua valendo enquanto o React não monta, então um
 * rastreador que não renderize JS ainda encontra título e descrição — só não os
 * específicos daquela rota.
 */

export const SITE_NAME = 'Viola Libre';
export const SITE_URL = 'https://violalibre.com.br';

export interface SeoData {
  /** Vai para o `<title>` e para o og:title. Já deve vir pronto, sem o sufixo do site. */
  title: string;
  description: string;
  /**
   * Caminho canônico, começando com `/`. É o que diz ao Google qual URL representa
   * esta página — sem isso toda rota herda a canônica da home do `index.html` e o
   * site inteiro se declara duplicata de si mesmo.
   */
  path: string;
  /**
   * `true` mantém a página fora do índice. Para telas que não são conteúdo: rascunho
   * local, ferramentas de edição, resultado de busca interna.
   */
  noindex?: boolean;
}

/** Título completo, com o sufixo do site — exceto quando já é o nome do site. */
function fullTitle(title: string): string {
  return title === SITE_NAME ? title : `${title} — ${SITE_NAME}`;
}

function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Acha a tag no head e atualiza; cria só se não existir.
 *
 * `attr` distingue as duas convenções que convivem no head: Open Graph usa
 * `property=`, o resto usa `name=`.
 */
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * `noindex` precisa ser removido ao sair da rota, senão a primeira tela não-indexável
 * visitada contamina todas as seguintes durante aquela navegação — e o rastreador do
 * Google, que navega com JS ligado, veria a marca numa página que deveria indexar.
 */
function setRobots(noindex: boolean): void {
  const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!noindex) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.head.appendChild(document.createElement('meta'));
  el.setAttribute('name', 'robots');
  el.setAttribute('content', 'noindex, follow');
}

/**
 * `null` significa "esta camada não responde pelos metadados desta rota" — usado pelo
 * App quando a subárvore de cifras está montada, porque lá o título depende da música
 * carregada. Não dá para simplesmente pular a chamada (hook não pode ser condicional),
 * e deixar o App escrever mesmo assim sobrescreveria o filho: efeito de filho roda
 * ANTES do efeito do pai, então quem monta o título específico perderia a disputa.
 */
export function useSeo(seo: SeoData | null): void {
  // Desmembrado em primitivos para que o array de dependências compare por valor: um
  // objeto literal montado no corpo do componente é novo a cada render e refaria o
  // efeito sem necessidade.
  const { title, description, path, noindex = false }: Partial<SeoData> = seo ?? {};

  useEffect(() => {
    if (title === undefined || description === undefined || path === undefined) return;

    const url = absoluteUrl(path);
    const heading = fullTitle(title);

    document.title = heading;
    setMeta('name', 'description', description);
    setCanonical(url);
    setRobots(noindex);

    // Open Graph e Twitter espelham o mesmo conteúdo: é o que aparece na prévia
    // quando alguém manda a cifra num grupo de WhatsApp, que na prática é como
    // esse acervo circula.
    setMeta('property', 'og:title', heading);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', heading);
    setMeta('name', 'twitter:description', description);
  }, [title, description, path, noindex]);
}
