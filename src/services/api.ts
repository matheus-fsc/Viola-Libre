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

// Services
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
  views?: number;
  likes?: number;
}

export const searchSongsGlobal = async (query: string): Promise<GlobalSearchResult[]> => {
  if (query.length < 2) return [];
  const { data } = await api.get<GlobalSearchResult[]>(`/api/musicas/busca?q=${encodeURIComponent(query)}`);
  return data;
};

export const getTopSongs = async (): Promise<GlobalSearchResult[]> => {
  if (cache.songs['top']) return cache.songs['top'] as any;
  const { data } = await api.get<GlobalSearchResult[]>('/api/rankings/top-musicas');
  cache.songs['top'] = data as any;
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
      'X-API-Key': import.meta.env.VITE_API_KEY || 'viola_live_nBcrg1wcNlUPMdOt9H83kaEK8BSzn1LB9K6UuJ-Nc1U'
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
    throw new Error("Dados inválidos. Não foi possível favoritar.");
  }

  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/favorite`, { user_hash: hash }, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY || 'viola_live_nBcrg1wcNlUPMdOt9H83kaEK8BSzn1LB9K6UuJ-Nc1U'
    }
  });
};

export const updateDifficulty = async (artistSlug: string, songSlug: string, difficulty: string): Promise<void> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/difficulty`, { difficulty }, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY || 'viola_live_nBcrg1wcNlUPMdOt9H83kaEK8BSzn1LB9K6UuJ-Nc1U'
    }
  });
};

export default api;
