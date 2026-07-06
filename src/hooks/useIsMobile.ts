// Matches Tailwind's `md` breakpoint (768px) used across the rest of the app.
const MOBILE_QUERY = '(max-width: 767px)';

// Synchronous check safe to call inside a useState lazy initializer (no SSR in this Vite SPA).
export function getIsMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}
