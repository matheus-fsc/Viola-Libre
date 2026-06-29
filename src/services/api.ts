import axios from 'axios';
import { z } from 'zod';

const api = axios.create({
  baseURL: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tipagens
export interface Artist {
  id: number;
  name: string;
  slug: string;
  genre?: string | null;
}

export interface Song {
  id: number;
  title: string;
  slug: string;
  version_name?: string;
}

export interface CifraDetail {
  id: number;
  title: string;
  content_html: string;
  views: number;
  favorited: number;
  difficulty: string | null;
  version_name: string;
}

const cache = {
  artists: null as Artist[] | null,
  songs: {} as Record<string, Song[]>,
  cifras: {} as Record<string, CifraDetail>,
  topLikes: null as GlobalSearchResult[] | null,
  generos: null as string[] | null,
  artistasPorGenero: {} as Record<string, Artist[]>,
};

export interface ArtistPage {
  artists: Artist[];
  total: number;
  offset: number;
  limit: number;
}

// Services
export const getArtistsPaginated = async (
  offset = 0,
  limit = 50,
  letra = '',
  q = ''
): Promise<ArtistPage> => {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (letra) params.set('letra', letra);
  if (q) params.set('q', q);
  const { data } = await api.get<ArtistPage>(`/api/artistas?${params}`);
  return data;
};

export const getInitialArtists = async (): Promise<Artist[]> => {
  const { data } = await api.get<Artist[]>('/api/artistas/iniciais');
  return data;
};

export const getArtists = async (): Promise<Artist[]> => {
  if (cache.artists) return cache.artists;
  const { data } = await api.get<Artist[]>('/api/artistas');
  cache.artists = data;
  return data;
};

export const getSongs = async (artistSlug: string): Promise<Song[]> => {
  if (cache.songs[artistSlug]) return cache.songs[artistSlug];
  const { data } = await api.get<Song[]>(`/api/artistas/${artistSlug}/musicas`);
  cache.songs[artistSlug] = data;
  return data;
};

export interface GlobalSearchResult {
  id: number;
  title: string;
  slug: string;
  artist_name: string;
  artist_slug: string;
  version_name?: string;
}

export const searchSongsGlobal = async (query: string): Promise<GlobalSearchResult[]> => {
  if (query.length < 2) return [];
  const { data } = await api.get<GlobalSearchResult[]>(`/api/musicas/busca?q=${encodeURIComponent(query)}`);
  return data;
};

export const getTopSongs = async (): Promise<GlobalSearchResult[]> => {
  if (cache.songs['top']) return cache.songs['top'] as unknown as GlobalSearchResult[];
  const { data } = await api.get<GlobalSearchResult[]>('/api/rankings/top-musicas');
  cache.songs['top'] = data as unknown as Song[];
  return data;
};

export const getTopLikes = async (): Promise<GlobalSearchResult[]> => {
  if (cache.topLikes) return cache.topLikes;
  const { data } = await api.get<GlobalSearchResult[]>('/api/rankings/top-likes');
  cache.topLikes = data;
  return data;
};

export const getGeneros = async (): Promise<string[]> => {
  if (cache.generos) return cache.generos;
  const { data } = await api.get<string[]>('/api/generos');
  cache.generos = data;
  return data;
};

export const getArtistsByGenre = async (genre: string): Promise<Artist[]> => {
  if (cache.artistasPorGenero[genre]) return cache.artistasPorGenero[genre];
  const { data } = await api.get<Artist[]>(`/api/generos/${encodeURIComponent(genre)}/top`);
  cache.artistasPorGenero[genre] = data;
  return data;
};


export const getCifra = async (artistSlug: string, songSlug: string): Promise<CifraDetail> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  const cacheKey = `${artistSlug}/${safeSongSlug}`;
  
  if (cache.cifras[cacheKey]) return cache.cifras[cacheKey];
  
  const { data } = await api.get<CifraDetail>(`/api/cifra/${artistSlug}/${safeSongSlug}`);
  cache.cifras[cacheKey] = data;
  return data;
};

export const incrementView = async (artistSlug: string, songSlug: string): Promise<void> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/view`, {}, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY ?? ''
    }
  });
};

// User Hash Local Generator
export const getUserHash = (): string => {
  let hash = localStorage.getItem('viola_user_hash');
  if (!hash || hash.length !== 32) {
    hash = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    localStorage.setItem('viola_user_hash', hash);
  }
  return hash;
};

// Zod Schemas
const actionSchema = z.object({
  artist_slug: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, "Slug do artista deve ter apenas letras, números e hifens"),
  song_slug: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, "Slug da música deve ter apenas letras, números e hifens"),
  user_hash: z.string().length(32, "O Hash do usuário deve ter exatamente 32 caracteres")
});

export const favoriteCifra = async (artistSlug: string, songSlug: string): Promise<void> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  const hash = getUserHash();

  try {
    actionSchema.parse({
      artist_slug: artistSlug,
      song_slug: safeSongSlug,
      user_hash: hash
    });
  } catch (validationError) {
    console.error("Dados malformados, requisição abortada para poupar o servidor:", validationError);
    throw new Error("Dados inválidos. Não foi possível favoritar.", { cause: validationError });
  }

  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/favorite`, { user_hash: hash }, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY ?? ''
    }
  });
};

export const updateDifficulty = async (artistSlug: string, songSlug: string, difficulty: string): Promise<void> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/difficulty`, { difficulty }, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY ?? ''
    }
  });
};

// Sequências
export interface SequenciaData {
  artistSlug: string;
  songSlug: string;
  songTitle: string;
  transposeOffset: number;
  selectedInstId: string;
  selectedTuningId: string;
  voicingFilter: {
    proximity: boolean;
    maxNotes: boolean;
    muteFilter: 'any' | 'with_mute' | 'no_mute';
    prioritizeEasy: boolean;
  };
  variationIndices: Record<string, number>;
  lockedVariations: Record<string, number>;
  excludedFromFilter: Record<string, boolean>;
}

export interface RecentSequencia {
  hash: string;
  title: string;
  artistSlug: string;
  savedAt: string;
}

const SEQ_STORAGE_KEY = 'viola_sequences_v1';

export const getRecentSequencias = (): RecentSequencia[] => {
  try { return JSON.parse(localStorage.getItem(SEQ_STORAGE_KEY) || '[]'); }
  catch { return []; }
};

export const addRecentSequencia = (entry: RecentSequencia): void => {
  const list = getRecentSequencias().filter(s => s.hash !== entry.hash);
  list.unshift(entry);
  localStorage.setItem(SEQ_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
};

export const removeRecentSequencia = (hash: string): void => {
  const list = getRecentSequencias().filter(s => s.hash !== hash);
  localStorage.setItem(SEQ_STORAGE_KEY, JSON.stringify(list));
};

export const saveSequencia = async (data: SequenciaData): Promise<{ hash: string }> => {
  const { data: result } = await api.post<{ hash: string }>('/api/sequencias', data);
  return result;
};

export const loadSequencia = async (hash: string): Promise<{ data: SequenciaData; created_at: string; updated_at: string }> => {
  const { data: result } = await api.get<{ data: SequenciaData; created_at: string; updated_at: string }>(`/api/sequencias/${hash}`);
  return result;
};

export const updateSequencia = async (hash: string, data: SequenciaData): Promise<void> => {
  await api.put(`/api/sequencias/${hash}`, data);
};

export const deleteSequencia = async (hash: string): Promise<void> => {
  await api.delete(`/api/sequencias/${hash}`);
};

export default api;
