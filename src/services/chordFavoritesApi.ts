// Favoritos de voicing — o voto do público sobre QUAL forma de um acorde é a boa.
//
// Não confundir com os dois vizinhos:
//   • authApi.ts / rankChord()  → curadoria de Editor, autenticada por Bearer.
//   • api.ts / favoriteCifra()  → favorita a MÚSICA, não a forma do acorde.
//
// Aqui é voto anônimo e barato, e é ele que decide o voicing default exibido em cada
// card. Por isso as duas metades vivem separadas: a estrela do usuário é local (nunca
// depende da rede para acender) e a contagem pública vem do servidor.

import { z } from 'zod';
import api, { getUserHash } from './api';

export interface ChordFavoriteEntry {
  fretsArray: number[];
  count: number;
  songSlug: string | null;
}

/** Forma popular já agregada e ordenada, pronta para virar ordem de exibição. */
export interface PopularVoicing {
  fretsArray: number[];
  count: number;
  scope: 'song' | 'global';
}

/**
 * Chave canônica da forma.
 *
 * O backend grava `frets_array` como texto e a unicidade do voto depende dessa
 * serialização: `[0,0,2]` e `[0, 0, 2]` são a MESMA forma e precisam colidir, senão o
 * ranking se parte em contagens paralelas que nunca somam. O servidor canonicaliza por
 * conta própria (é ele quem manda); repetimos a mesma regra aqui só para casar as
 * respostas dele com o que temos em mãos.
 */
export function fretsKey(frets: readonly number[]): string {
  return frets.map(f => String(Math.trunc(f))).join(',');
}

// -6 não existe em braço nenhum: -1 é corda abafada, 0 é solta, o resto é casa. O teto
// de 24 é o fim do braço mais longo que o app modela; 12 cordas cobre da viola ao
// violão de 12. Validar aqui evita uma ida ao servidor para levar 422 de volta.
const favoritePayloadSchema = z.object({
  chord_id: z.string().min(1),
  user_hash: z.string().length(32, 'O hash do usuário deve ter exatamente 32 caracteres'),
  frets_array: z.array(z.number().int().min(-1).max(24)).min(1).max(12),
  song_slug: z.string().min(1).nullable(),
});

// O backend pode ainda não ter subido estas rotas (estão sendo implementadas em
// paralelo). O primeiro 404 desliga as chamadas pelo resto da sessão: sem isso, uma
// cifra com 30 acordes distintos dispara 30 requisições condenadas a cada abertura.
// A estrela local continua funcionando normalmente — só a contagem pública fica ausente.
let endpointMissing = false;

function noteMissing(err: unknown): void {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404 || status === 405 || status === 501) endpointMissing = true;
}

export function isFavoritesBackendAvailable(): boolean {
  return !endpointMissing;
}

// ---------------------------------------------------------------------------
// Espelho local: quais formas EU favoritei
// ---------------------------------------------------------------------------
//
// As rotas de leitura são públicas e devolvem só contagem — nunca `user_hash`, para não
// expor quem votou no quê. Então o estado da estrela (acesa/apagada) não tem como vir do
// servidor: fica aqui. O `favorited` devolvido pelo POST reconcilia o espelho quando os
// dois discordam (localStorage limpo, voto vindo de outro dispositivo).

const MINE_KEY = 'vl_chord_favorites_mine_v1';

/**
 * Todos os meus votos, de todas as músicas, num mapa só: `"{chordId}|{songSlug}" → chaves
 * de forma`. É um mapa único de propósito — o chamador o carrega uma vez e nunca precisa
 * recarregar ao trocar de música ou de acorde, o que dispensa efeito de sincronização.
 */
export type MyFavoritesMap = Record<string, string[]>;

function scopeKey(chordId: string, songSlug: string | null): string {
  return `${chordId}|${songSlug ?? ''}`;
}

export function readAllMyFavorites(): MyFavoritesMap {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) || '{}') as MyFavoritesMap;
  } catch {
    return {};
  }
}

function writeMine(map: MyFavoritesMap): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(map));
  } catch {
    // Armazenamento cheio ou modo privado — a estrela vira sessão-only, sem quebrar nada.
  }
}

/** As formas que este navegador favoritou para o acorde, no escopo dado. */
export function favoritesIn(map: MyFavoritesMap, chordId: string, songSlug: string | null): string[] {
  return map[scopeKey(chordId, songSlug)] ?? [];
}

export function isFavoritedIn(
  map: MyFavoritesMap,
  chordId: string,
  songSlug: string | null,
  frets: readonly number[]
): boolean {
  return favoritesIn(map, chordId, songSlug).includes(fretsKey(frets));
}

function setMine(chordId: string, songSlug: string | null, key: string, on: boolean): MyFavoritesMap {
  const map = readAllMyFavorites();
  const k = scopeKey(chordId, songSlug);
  const current = map[k] ?? [];
  const next = on ? Array.from(new Set([...current, key])) : current.filter(f => f !== key);
  if (next.length > 0) map[k] = next;
  else delete map[k];
  writeMine(map);
  return map;
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export interface ToggleFavoriteResult {
  /** Estado depois do toggle. */
  favorited: boolean;
  /** Contagem pública, ou `null` quando o servidor não respondeu. */
  count: number | null;
  /** Espelho local completo já atualizado — o chamador usa para re-renderizar. */
  mine: MyFavoritesMap;
}

/**
 * Liga/desliga o favorito desta forma. Otimista por opção: o espelho local muda antes da
 * rede, porque a estrela é feedback imediato de um gesto do usuário e não pode ficar
 * esperando um servidor que talvez nem exista ainda. Se o POST responder, o `favorited`
 * dele corrige o espelho caso os dois tenham divergido.
 */
export async function toggleChordFavorite(
  chordId: string,
  fretsArray: number[],
  songSlug: string | null = null
): Promise<ToggleFavoriteResult> {
  const key = fretsKey(fretsArray);
  const wanted = !isFavoritedIn(readAllMyFavorites(), chordId, songSlug, fretsArray);
  let mine = setMine(chordId, songSlug, key, wanted);

  const payload = {
    chord_id: chordId,
    user_hash: getUserHash(),
    frets_array: fretsArray.map(f => Math.trunc(f)),
    song_slug: songSlug,
  };

  const parsed = favoritePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('Favorito de acorde malformado, requisição abortada:', parsed.error);
    return { favorited: wanted, count: null, mine };
  }
  if (endpointMissing) return { favorited: wanted, count: null, mine };

  try {
    const { data } = await api.post<{ favorited: boolean; count: number }>(
      `/api/chords/${encodeURIComponent(chordId)}/favorite`,
      { user_hash: payload.user_hash, frets_array: payload.frets_array, song_slug: payload.song_slug },
      { headers: { 'X-API-Key': import.meta.env.VITE_API_KEY ?? '' } }
    );
    if (data.favorited !== wanted) mine = setMine(chordId, songSlug, key, data.favorited);
    return { favorited: data.favorited, count: data.count, mine };
  } catch (err) {
    noteMissing(err);
    // O voto local fica de pé mesmo sem confirmação: perder a estrela por causa de rede
    // seria pior que uma contagem momentaneamente dessincronizada.
    return { favorited: wanted, count: null, mine };
  }
}

function toEntries(raw: Array<{ frets_array: number[]; count: number; song_slug: string | null }>): ChordFavoriteEntry[] {
  return raw.map(d => ({ fretsArray: d.frets_array, count: d.count, songSlug: d.song_slug }));
}

export async function getChordFavorites(chordId: string, songSlug?: string | null): Promise<ChordFavoriteEntry[]> {
  if (endpointMissing) return [];
  const qs = songSlug ? `?song_slug=${encodeURIComponent(songSlug)}` : '';
  try {
    const { data } = await api.get<Array<{ frets_array: number[]; count: number; song_slug: string | null }>>(
      `/api/chords/${encodeURIComponent(chordId)}/favorites${qs}`
    );
    return toEntries(data);
  } catch (err) {
    noteMissing(err);
    return [];
  }
}

// O backend recusa lotes acima de 60 ids (422). Fatiar aqui deixa o chamador livre para
// mandar a cifra inteira sem contar acordes.
const BATCH_LIMIT = 60;

/**
 * Busca as contagens de vários acordes de uma vez.
 *
 * A cifra monta 10–30 cards de uma vez e, ao contrário da curadoria (que o cliente
 * cacheia por horas), contagem de voto muda o tempo todo — não dá para cachear nem para
 * abrir uma requisição por acorde.
 */
export async function fetchChordFavoritesBatch(
  chordIds: string[],
  songSlug?: string | null
): Promise<Record<string, ChordFavoriteEntry[]>> {
  if (endpointMissing || chordIds.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < chordIds.length; i += BATCH_LIMIT) chunks.push(chordIds.slice(i, i + BATCH_LIMIT));

  const results = await Promise.all(
    chunks.map(async chunk => {
      try {
        const { data } = await api.post<Record<string, Array<{ frets_array: number[]; count: number; song_slug: string | null }>>>(
          '/api/chords/favorites/batch',
          { chord_ids: chunk, song_slug: songSlug ?? null }
        );
        return data;
      } catch (err) {
        noteMissing(err);
        return {};
      }
    })
  );

  const merged: Record<string, ChordFavoriteEntry[]> = {};
  for (const part of results) {
    for (const [id, list] of Object.entries(part)) merged[id] = toEntries(list);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Agregação
// ---------------------------------------------------------------------------

/**
 * Ordena as formas populares para virar ordem de exibição.
 *
 * Mesma precedência da curadoria (ver `pickCuratedVoicings`): o que a comunidade escolheu
 * NESTA música vem primeiro, e as escolhas globais entram atrás — mescladas, não
 * substituídas, para que uma forma consagrada no dicionário não suma de uma música só
 * porque lá alguém votou em outra variação.
 *
 * Entradas com contagem 0 ficam de fora: um voto anulado pelo anti-spam do servidor não
 * pode reordenar o card de ninguém.
 */
export function pickPopularVoicings(entries: ChordFavoriteEntry[], songSlug?: string | null): PopularVoicing[] {
  const withVotes = entries.filter(e => e.count > 0);
  const byCount = (a: ChordFavoriteEntry, b: ChordFavoriteEntry) => b.count - a.count;

  const song = songSlug ? withVotes.filter(e => e.songSlug === songSlug).sort(byCount) : [];
  const songKeys = new Set(song.map(e => fretsKey(e.fretsArray)));
  const global = withVotes.filter(e => e.songSlug === null && !songKeys.has(fretsKey(e.fretsArray))).sort(byCount);

  return [
    ...song.map(e => ({ fretsArray: e.fretsArray, count: e.count, scope: 'song' as const })),
    ...global.map(e => ({ fretsArray: e.fretsArray, count: e.count, scope: 'global' as const })),
  ];
}

/** Quantos favoritaram exatamente esta forma, somando escopo da música e global. */
export function countFor(entries: ChordFavoriteEntry[], frets: readonly number[]): number {
  const key = fretsKey(frets);
  return entries.reduce((sum, e) => (fretsKey(e.fretsArray) === key ? sum + e.count : sum), 0);
}
