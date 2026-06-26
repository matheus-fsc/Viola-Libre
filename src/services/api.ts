import axios from 'axios';

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

// In-Memory Cache para máxima velocidade no Frontend
const cache = {
  artists: null as Artist[] | null,
  songs: {} as Record<string, Song[]>,
  cifras: {} as Record<string, CifraDetail>,
};

// Services
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

export const favoriteCifra = async (artistSlug: string, songSlug: string): Promise<void> => {
  const safeSongSlug = songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;
  await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/favorite`, {}, {
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
