import type { SeoData } from '../hooks/useSeo';
import type { TabId } from '../hooks/useTabNavigation';
import type { Traduzir } from '../i18n';

/**
 * Título e descrição de cada seção fixa do site.
 *
 * Os TEXTOS moram no dicionário (`src/i18n/locales/*`, sob `seo.*`), porque são texto
 * traduzível como qualquer outro. O que fica aqui é o que NÃO se traduz: o caminho
 * canônico e a marca de noindex. A URL é a mesma nos dois idiomas de propósito, senão
 * a mesma página passaria a existir em dois endereços.
 *
 * Os textos são escritos para a busca, não para a UI: o rótulo da aba diz "Treinos e
 * Teoria" porque é o que cabe na aba, mas ninguém digita isso no Google. Por isso os
 * dois existem separados em vez de um derivar do outro.
 *
 * As rotas de cifra NÃO estão aqui: título e descrição delas dependem da música
 * carregada, e cada página daquela subárvore monta o seu (ver CifraViewer, SongList
 * e ArtistList).
 */
type SeoFixo = Pick<SeoData, 'path' | 'noindex'>;

const TAB_ROTA: Record<Exclude<TabId, 'cifras'>, SeoFixo> = {
  desktop: { path: '/' },
  chords: { path: '/chords' },
  train: { path: '/treinos' },
  ear: { path: '/ouvido' },
  favorites: { path: '/favoritos' },
  // Painel de configuração, não conteúdo: o que ele mostra é a escolha de quem visita,
  // guardada no navegador dela. Para o rastreador a página é uma casca, e indexá-la só
  // gastaria orçamento. Fica fora do sitemap pelo mesmo motivo.
  preferencias: { path: '/preferencias', noindex: true },
  termos: { path: '/termos' },
  privacidade: { path: '/privacidade' },
  agradecimentos: { path: '/agradecimentos' },
  // Rascunho que vive no navegador de quem escreve: não existe no servidor, não tem
  // versão pública e não deve ser indexado. O robots.txt já bloqueia; o noindex cobre
  // o caso de a URL ser descoberta por um link de fora.
  minhascifras: { path: '/minhascifras', noindex: true },
};

/** Metadados da seção no idioma atual. Receba o `t` de `useT()` para reagir à troca. */
export function tabSeo(t: Traduzir, tab: Exclude<TabId, 'cifras'>): SeoData {
  return {
    title: t(`seo.${tab}.title`),
    description: t(`seo.${tab}.description`),
    ...TAB_ROTA[tab],
  };
}
