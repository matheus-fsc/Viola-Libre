import { useSyncExternalStore } from 'react';

// Matches Tailwind's `md` breakpoint (768px) used across the rest of the app.
const MOBILE_QUERY = '(max-width: 767px)';

// Synchronous check safe to call inside a useState lazy initializer (no SSR in this Vite SPA).
export function getIsMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * Reativo: acompanha rotação de tela e redimensionamento da janela.
 *
 * Layout que só decide no primeiro render fica errado quando o aparelho gira — o painel
 * lateral de 176px, por exemplo, engole a cifra em retrato mas cabe em paisagem.
 *
 * `useSyncExternalStore` em vez de useState+useEffect: a leitura acontece no próprio
 * render, então não existe o frame intermediário em que o layout ainda usa o valor
 * antigo, e nenhum setState roda dentro de efeito.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getIsMobile);
}
