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
 * Preço disto: o projeto deixa de ser 100% estático e passa a invocar um Worker
 * por requisição. No volume atual (centenas de acessos/dia) fica folgado dentro
 * da cota gratuita, e a alternativa seria desligar o subdomínio `.pages.dev` no
 * painel — o que também tiraria a pré-visualização de deploy, que é útil.
 *
 * `follow` e não `nofollow` de propósito: queremos que o rastreador SIGA os
 * links e chegue às páginas equivalentes no domínio bom; só não queremos que
 * indexe estas.
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

export const onRequest = async (context: ContextoPages): Promise<Response> => {
  const resposta = await context.next();

  let hospedeiro: string;
  try {
    hospedeiro = new URL(context.request.url).hostname;
  } catch {
    // URL ilegível não deveria acontecer, mas se acontecer o certo é entregar a
    // resposta como veio: esta middleware existe para marcar uma duplicata, não
    // para decidir se o site responde.
    return resposta;
  }

  if (!HOSPEDEIROS_NAO_INDEXAVEIS.test(hospedeiro)) return resposta;

  // A resposta do `next()` vem com cabeçalhos imutáveis; recriar é o jeito
  // suportado de acrescentar um.
  const comMarca = new Response(resposta.body, resposta);
  comMarca.headers.set('X-Robots-Tag', 'noindex, follow');
  return comMarca;
};
