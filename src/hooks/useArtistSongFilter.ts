import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { Song } from '../services/api';
import { attachMockStats, type SongWithStats } from '../services/mockArtistStats';

export type ArtistSongTab = 'alfabetica' | 'mais-visualizadas' | 'mais-curtidas';

const PAGE_SIZE = 32;
const DEBOUNCE_MS = 220;

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

export function useArtistSongFilter(artistSlug: string, dedupedSongs: Song[]): ArtistSongFilterResult {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ArtistSongTab>('alfabetica');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
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
