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
  bpm?: number | null;
  duration?: number | null;
  /**
   * Link da source em vídeo (YouTube), semeado pelo worker de vídeo
   * (/api/internal/video/*). Opcional: a rota pública só devolve o campo para as
   * músicas já cobertas pelo seed — nas demais vem ausente/null.
   */
  video_url?: string | null;
  /** Quem achou a source ('cifraclub', 'youtube_search', …). Só para diagnóstico. */
  video_source?: string | null;
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

// ---------------------------------------------------------------------------
// Identidade sem login
// ---------------------------------------------------------------------------
//
// O site não tem cadastro: este hash de 32 hex É o usuário, para o servidor. Ele é a
// única chave que liga alguém aos favoritos gravados lá (`/api/usuario/{hash}/favoritos`),
// e não existe nenhum jeito de recuperá-lo depois de perdido — não há e-mail para
// reenviar. Por isso três coisas passam a valer aqui:
//
//   1. A leitura valida antes de reaproveitar. Um valor truncado ou corrompido por outra
//      aba geraria requisições que o servidor recusa em silêncio (o `user_hash` cai no
//      422 do Pydantic), e o usuário veria favoritos sumindo sem motivo aparente.
//   2. `setUserHash` existe para a importação de backup restaurar a identidade antiga.
//      Sem isso, limpar o localStorage seria irreversível: a lista voltaria do arquivo,
//      mas o vínculo com o que está no servidor ficaria órfão para sempre.
//   3. O sorteio é criptográfico. Como o hash é a credencial inteira — quem o tem lê e
//      altera os favoritos daquele usuário, sem nenhuma segunda prova — ele precisa ser
//      imprevisível, e não só improvável de repetir. `Math.random()` no V8 é xorshift128+:
//      o estado interno é recuperável a partir de poucas saídas consecutivas, então quem
//      abrisse o site conseguiria derivar os hashes sorteados perto do seu e assumir a
//      identidade de outras pessoas.

const USER_HASH_KEY = 'viola_user_hash';

/** 32 caracteres hexadecimais — o mesmo formato que `actionSchema` exige no envio. */
export const userHashSchema = z.string().regex(/^[0-9a-f]{32}$/, 'Hash de usuário deve ter 32 caracteres hexadecimais');

export const isValidUserHash = (value: unknown): value is string => userHashSchema.safeParse(value).success;

/** 16 bytes de CSPRNG em hex — mesmos 32 caracteres que `userHashSchema` exige. */
const randomUserHash = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export const getUserHash = (): string => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(USER_HASH_KEY);
  } catch {
    // Modo privado / storage bloqueado: a identidade vira sessão-only.
  }
  if (isValidUserHash(stored)) return stored;

  const hash = randomUserHash();
  try {
    localStorage.setItem(USER_HASH_KEY, hash);
  } catch { /* idem */ }
  return hash;
};

/**
 * Assume uma identidade vinda de um backup. Recusa hash malformado em vez de gravar
 * lixo: um arquivo adulterado não pode desligar o usuário dos próprios favoritos.
 */
export const setUserHash = (hash: string): boolean => {
  if (!isValidUserHash(hash)) return false;
  try {
    localStorage.setItem(USER_HASH_KEY, hash);
  } catch {
    return false;
  }
  return true;
};

// Zod Schemas
const actionSchema = z.object({
  artist_slug: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, "Slug do artista deve ter apenas letras, números e hifens"),
  song_slug: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, "Slug da música deve ter apenas letras, números e hifens"),
  user_hash: z.string().length(32, "O Hash do usuário deve ter exatamente 32 caracteres")
});

/** Estado da cifra no servidor depois do toggle. */
export interface CifraFavoriteResult {
  favorited: boolean;
  count: number | null;
}

/**
 * O toggle responde `{ favorited, count, message }`.
 *
 * Só o booleano é lido: a `message` existe para humano, e derivar estado de uma frase em
 * português (era o que se fazia antes de o campo existir) quebrava o coração do usuário a
 * cada ajuste de copy no backend, sem erro em lugar nenhum.
 */
const toggleResponseSchema = z.object({
  favorited: z.boolean(),
  count: z.number().nullable().catch(null),
});

export const favoriteCifra = async (artistSlug: string, songSlug: string): Promise<CifraFavoriteResult> => {
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

  const { data } = await api.post(`/api/cifra/${artistSlug}/${safeSongSlug}/favorite`, { user_hash: hash }, {
    headers: {
      'X-API-Key': import.meta.env.VITE_API_KEY ?? ''
    }
  });

  const parsed = toggleResponseSchema.safeParse(data);
  if (!parsed.success) {
    // Resposta fora do contrato é indistinguível de sucesso pela ótica do HTTP 200, mas
    // agir sobre ela seria pior que não agir: quem chama trata a exceção mantendo o
    // espelho local, que é a fonte da verdade de qualquer forma.
    throw new Error('Resposta inesperada do servidor ao favoritar.', { cause: parsed.error });
  }
  return parsed.data;
};

/** Uma cifra favoritada, como o servidor a devolve. */
export interface FavoritedSong extends GlobalSearchResult {
  /** ISO 8601 UTC. `null` em linhas antigas anteriores à coluna de data. */
  favorited_at?: string | null;
}

/**
 * As cifras que este `user_hash` favoritou, direto do servidor.
 *
 * É a única via de recuperação quando o localStorage some: por isso a importação de
 * backup restaura o hash *antes* de chamar aqui.
 *
 * Usa a rota com o hash no CORPO. A versão com o hash no path está deprecada porque path
 * vaza para access log, histórico do navegador e `Referer` — e aqui o hash é a credencial
 * inteira, já que não há login.
 */
export const getUserFavorites = async (userHash?: string): Promise<FavoritedSong[]> => {
  const hash = userHash ?? getUserHash();
  if (!isValidUserHash(hash)) return [];
  const { data } = await api.post<FavoritedSong[]>('/api/usuario/favoritos', { user_hash: hash });
  return Array.isArray(data) ? data : [];
};

export interface FavoriteRef {
  artist_slug: string;
  song_slug: string;
}

export interface SyncFavoritesResult {
  added: number;
  already_present: number;
  not_found: number;
}

/** O servidor recusa lotes acima disso com 422; fatiar aqui poupa a viagem. */
const SYNC_BATCH_LIMIT = 200;

/**
 * Empurra favoritos locais para o servidor. União idempotente: nunca remove nada lá.
 *
 * É o que fecha os dois buracos em que o favorito ficava só no navegador para sempre:
 * favoritar sem rede (o POST do toggle morre e não há retentativa) e importar um backup
 * cuja identidade já é a deste navegador. Sem esta rota o sync só puxava.
 */
export const syncFavoritesToServer = async (
  favorites: FavoriteRef[],
  userHash?: string
): Promise<SyncFavoritesResult> => {
  const hash = userHash ?? getUserHash();
  const total: SyncFavoritesResult = { added: 0, already_present: 0, not_found: 0 };
  if (!isValidUserHash(hash) || favorites.length === 0) return total;

  for (let i = 0; i < favorites.length; i += SYNC_BATCH_LIMIT) {
    const { data } = await api.post<SyncFavoritesResult>(
      `/api/usuario/${hash}/favoritos/sync`,
      { favorites: favorites.slice(i, i + SYNC_BATCH_LIMIT) },
      { headers: { 'X-API-Key': import.meta.env.VITE_API_KEY ?? '' } }
    );
    total.added += data?.added ?? 0;
    total.already_present += data?.already_present ?? 0;
    total.not_found += data?.not_found ?? 0;
  }
  return total;
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
