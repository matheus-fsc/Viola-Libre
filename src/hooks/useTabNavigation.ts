import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type TabId = 'desktop' | 'cifras' | 'minhascifras' | 'chords' | 'train' | 'ear' | 'favorites' | 'termos';

/** Rota "inicial" de cada aba — o ponto de partida quando não há nada memorizado. */
export const TAB_ROOT_PATH: Record<TabId, string> = {
  desktop: '/',
  cifras: '/cifras',
  minhascifras: '/minhascifras',
  chords: '/chords',
  train: '/treinos',
  ear: '/ouvido',
  favorites: '/favoritos',
  termos: '/termos',
};

export function tabFromPathname(pathname: string): TabId {
  // '/' é a área de trabalho — caso EXPLÍCITO, nunca o fallback. Se o desktop virasse o
  // fallback, toda rota inexistente cairia nele em vez de no explorador de cifras.
  if (pathname === '/') return 'desktop';
  if (pathname === '/termos') return 'termos';
  if (pathname.startsWith('/cifras')) return 'cifras';
  if (pathname === '/minhascifras') return 'minhascifras';
  if (pathname === '/chords') return 'chords';
  if (pathname === '/treinos') return 'train';
  if (pathname === '/ouvido') return 'ear';
  if (pathname === '/favoritos') return 'favorites';
  return 'cifras';
}

/**
 * Para onde o clique numa aba deve ir.
 *
 * Aba diferente da atual: volta pro ponto memorizado (ex.: a cifra que estava
 * aberta), não pra raiz — assim dar uma passada no Dicionário de Acordes não
 * custa refazer artista → música.
 *
 * Aba ATUAL: vai pra raiz. É a válvula de escape pra sair de uma cifra e voltar
 * pra lista, comportamento que a aba já tinha antes de existir memória.
 */
export function resolveTabTarget(tab: TabId, activeTab: TabId, remembered: string | undefined): string {
  if (tab === activeTab || !remembered) return TAB_ROOT_PATH[tab];
  return remembered;
}

const STORAGE_KEY = 'viola_libre_tab_paths';

type TabPaths = Partial<Record<TabId, string>>;

// sessionStorage e não localStorage: a memória vale pra sessão de navegação
// (inclusive um F5), mas abrir o site de novo amanhã começa limpo.
function readStoredPaths(): TabPaths {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TabPaths) : {};
  } catch {
    return {}; // modo privado / storage bloqueado
  }
}

function writeStoredPaths(paths: TabPaths) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    /* storage indisponível: a memória segue valendo só em runtime */
  }
}

/**
 * Aba ativa derivada da URL + navegação que preserva o fluxo do usuário.
 * Guarda a última rota visitada em cada aba e devolve o usuário exatamente ali.
 */
export function useTabNavigation() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPathname(pathname);

  const pathsRef = useRef<TabPaths | null>(null);
  pathsRef.current ??= readStoredPaths();

  useEffect(() => {
    const paths = { ...pathsRef.current, [activeTab]: pathname + search };
    pathsRef.current = paths;
    writeStoredPaths(paths);
  }, [activeTab, pathname, search]);

  const goToTab = useCallback((tab: TabId) => {
    navigate(resolveTabTarget(tab, tabFromPathname(pathname), pathsRef.current?.[tab]));
  }, [navigate, pathname]);

  return { activeTab, goToTab };
}
