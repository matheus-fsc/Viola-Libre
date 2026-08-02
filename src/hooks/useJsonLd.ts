import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from './useSeo';

/**
 * Dados estruturados (schema.org) da rota atual.
 *
 * É o que permite ao Google entender a página como algo além de texto: a trilha
 * "Viola Libre › Almir Sater › Tocando Em Frente" que aparece abaixo do resultado
 * vem daqui, não do HTML visível.
 *
 * Cada rota escreve UM `<script type="application/ld+json">` marcado com
 * `data-seo-jsonld`, e a limpeza do efeito o remove ao sair. Sem essa remoção o
 * breadcrumb de uma cifra sobreviveria à navegação e passaria a descrever a página
 * seguinte, que é pior do que não ter breadcrumb nenhum.
 */
export function useJsonLd(data: object | null): void {
  useEffect(() => {
    if (!data) return;

    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.seoJsonld = 'true';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);

    return () => el.remove();
  }, [data]);
}

/**
 * Identidade do site + a caixa de busca que o Google pode exibir dentro do próprio
 * resultado. O `target` aponta para a busca interna do explorador de cifras.
 */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: 'pt-BR',
  description:
    'Cifras, dicionário de acordes e teoria musical livre para viola caipira, violão e cavaquinho.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/cifras?busca={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/** Trilha de navegação. Recebe os degraus já na ordem, do mais geral ao mais específico. */
export function breadcrumbJsonLd(steps: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: `${SITE_URL}${step.path}`,
    })),
  };
}
