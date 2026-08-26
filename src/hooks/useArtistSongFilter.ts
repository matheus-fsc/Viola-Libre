import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import type { Song } from '../services/api';
import { attachMockStats, type SongWithStats } from '../services/mockArtistStats';

export type ArtistSongTab = 'alfabetica' | 'mais-visualizadas' | 'mais-curtidas';

const PAGE_SIZE = 32;
const DEBOUNCE_MS = 220;

const TABS: ArtistSongTab[] = ['alfabetica', 'mais-visualizadas', 'mais-curtidas'];

function parseTab(raw: string | null): ArtistSongTab {
  return TABS.includes(raw as ArtistSongTab) ? (raw as ArtistSongTab) : 'alfabetica';
}

function normalizeAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface ArtistSongFilterResult {
  query: string;
  setQuery: (q: string) => void;
  activeTab: ArtistSongTab;
  setActiveTab: (t: ArtistSongTab) => void;
  visibleSongs: SongWithStats[];
  totalMatches: number;
  hasMore: boolean;
  loadMore: () => void;
  top20: SongWithStats[];
}

/**
 * @param initialVisibleCount quantos itens mostrar já na primeira renderização. Serve à
 *        restauração de posição ao voltar: sem os itens de volta, a posição não existe.
 */
export function useArtistSongFilter(
  artistSlug: string,
  dedupedSongs: Song[],
  initialVisibleCount?: number,
): ArtistSongFilterResult {
  // Busca e aba vivem na URL (?busca=&aba=), pelo mesmo motivo do explorador em
  // `ArtistList`: é o que torna uma lista filtrada compartilhável por link e o que faz o
  // botão voltar reencontrar a consulta em vez de uma lista zerada. Só o valor INICIAL sai
  // dos params — daí em diante manda o estado local e a URL o acompanha, senão os dois se
  // realimentam.
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('busca') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [activeTab, setActiveTab] = useState<ArtistSongTab>(() => parseTab(searchParams.get('aba')));
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount ?? PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Estado -> URL. `replace` porque cada tecla não merece uma entrada no histórico: o
  // voltar do navegador deve sair da busca, não desfazê-la letra por letra.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQuery) next.set('busca', debouncedQuery);
    if (activeTab !== 'alfabetica') next.set('aba', activeTab);
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, activeTab, setSearchParams]);

  // Voltar à primeira página quando o filtro muda — mas não na montagem, que é justamente
  // quando `initialVisibleCount` acabou de restaurar as páginas que já estavam abertas.
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, debouncedQuery, artistSlug]);

  const songsWithStats = useMemo(
    () => attachMockStats(artistSlug, dedupedSongs),
    [artistSlug, dedupedSongs]
  );

  const fuse = useMemo(
    () => new Fuse(songsWithStats, {
      keys: ['title'],
      threshold: 0.35,
      ignoreLocation: true,
      getFn: (obj) => normalizeAccents(obj.title),
    }),
    [songsWithStats]
  );

  const matched = useMemo(() => {
    if (!debouncedQuery.trim()) return songsWithStats;
    const normalizedQuery = normalizeAccents(debouncedQuery.trim());
    return fuse.search(normalizedQuery).map(r => r.item);
  }, [fuse, songsWithStats, debouncedQuery]);

  const sorted = useMemo(() => {
    const list = [...matched];
    if (activeTab === 'mais-visualizadas') return list.sort((a, b) => b.views - a.views);
    if (activeTab === 'mais-curtidas') return list.sort((a, b) => b.favorited - a.favorited);
    return list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [matched, activeTab]);

  const top20 = useMemo(
    () => [...songsWithStats].sort((a, b) => b.views - a.views).slice(0, 20),
    [songsWithStats]
  );

  return {
    query,
    setQuery,
    activeTab,
    setActiveTab,
    visibleSongs: sorted.slice(0, visibleCount),
    totalMatches: sorted.length,
    hasMore: visibleCount < sorted.length,
    loadMore: () => setVisibleCount(v => v + PAGE_SIZE),
    top20,
  };
}
