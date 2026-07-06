import { useEffect, useState } from 'react';
import api from './api';

export interface EditorSession {
  token: string;
  expiresAt: string;
}

export interface ChordRankEntry {
  fretsArray: number[];
  scoreBoost: number;
  editorId: string;
  songSlug: string | null;
  createdAt: string;
}

// A chord's shape depends on instrument + tuning, not just its harmonic name — the
// same "D" is a completely different fret pattern on Viola Cebolão vs. Violão padrão.
// Every chord_id sent to /api/chords/rank must be scoped by both.
//
// chordName can contain a literal "/" (bass-note chords like "Dm/C", or extended
// notation like "D#7(9/11)"). GET /api/chords/{chord_id}/rank takes chord_id as a
// path segment — a raw "/" there splits the URL into extra segments and 404s before
// it ever reaches the route (Starlette matches on the already-decoded path, so even
// percent-encoding %2F doesn't survive). chord_id is opaque (never displayed), so we
// just substitute it out.
export function buildChordId(instrumentId: string, tuningId: string, chordName: string): string {
  const safeName = chordName.replace(/\//g, '_');
  return `${instrumentId}-${tuningId}-${safeName}`;
}

const SESSION_KEY = 'vl_editor_session';
const SESSION_CHANGE_EVENT = 'vl-editor-session-changed';

function readSession(): EditorSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as EditorSession;
    if (!session.token || !session.expiresAt) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getStoredEditorSession(): EditorSession | null {
  return readSession();
}

export function storeEditorSession(session: EditorSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export async function loginEditor(rawToken: string): Promise<EditorSession> {
  const { data } = await api.post<{ token: string; expires_at: string }>('/api/auth/editor', {
    token: rawToken,
  });
  return { token: data.token, expiresAt: data.expires_at };
}

// Reactive read of the current editor session — updates when login/logout happens
// in this tab (custom event) or another tab (storage event). Lets any component
// know the editor's auth state without prop drilling.
export function useEditorSession(): EditorSession | null {
  const [session, setSession] = useState<EditorSession | null>(() => readSession());

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return session;
}

export interface RankChordOptions {
  scoreBoost?: number;
  // Present = this curation only overrides the ordering within that specific song.
  // Absent/undefined = a global default, used everywhere the chord+instrument+tuning appears.
  songSlug?: string;
}

export async function rankChord(chordId: string, fretsArray: number[], opts: RankChordOptions = {}): Promise<void> {
  const session = readSession();
  if (!session) throw new Error('Sessão de editor expirada ou inexistente.');
  await api.post(
    '/api/chords/rank',
    {
      chord_id: chordId,
      frets_array: fretsArray,
      score_boost: opts.scoreBoost ?? 0,
      song_slug: opts.songSlug ?? null,
    },
    { headers: { Authorization: `Bearer ${session.token}` } }
  );
}

// Cached in localStorage, keyed by chordId alone — always fetch the unscoped list
// (global + every song's overrides) since pickCuratedVoicings already filters by
// songSlug client-side, so one cache entry serves the dictionary AND every song that
// touches this chord+instrument+tuning. Curation is a rare, deliberate action, so a
// multi-hour TTL is safe; on fetch failure we fall back to whatever's cached (even if
// stale) instead of losing curation state — this API has been known to slow down or
// time out when the scraper is running concurrently on the same host.
const RANK_CACHE_KEY = 'vl_chord_rank_cache_v1';
const RANK_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

interface RankCacheEntry {
  entries: ChordRankEntry[];
  fetchedAt: number;
}

function readRankCache(): Record<string, RankCacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(RANK_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeRankCache(cache: Record<string, RankCacheEntry>): void {
  try {
    localStorage.setItem(RANK_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full/unavailable/private-mode — cache is a nice-to-have, degrade silently.
  }
}

export async function getChordRankings(
  chordId: string,
  opts: { forceRefresh?: boolean } = {}
): Promise<ChordRankEntry[]> {
  const cache = readRankCache();
  const cached = cache[chordId];
  const isFresh = !!cached && (Date.now() - cached.fetchedAt) < RANK_CACHE_TTL_MS;
  if (isFresh && !opts.forceRefresh) return cached.entries;

  try {
    const { data } = await api.get<Array<{
      frets_array: number[];
      score_boost: number;
      editor_id: string;
      song_slug: string | null;
      created_at: string;
    }>>(`/api/chords/${encodeURIComponent(chordId)}/rank`);
    const entries = data.map(d => ({
      fretsArray: d.frets_array,
      scoreBoost: d.score_boost,
      editorId: d.editor_id,
      songSlug: d.song_slug,
      createdAt: d.created_at,
    }));
    cache[chordId] = { entries, fetchedAt: Date.now() };
    writeRankCache(cache);
    return entries;
  } catch (err) {
    if (cached) return cached.entries;
    throw err;
  }
}

export interface CuratedVoicing {
  fretsArray: number[];
  scope: 'song' | 'global';
  totalScore: number;
  curatorCount: number;
}

// Editors can curate more than one shape for the same chord (a shortlist, not a single
// pick) — group by shape and order by score. Uses MAX (not sum) of score_boost across
// editors: score_boost doubles as an explicit manual priority a curator sets (see the
// reorder controls in the dictionary), and a deliberate priority from one editor should
// win outright rather than being diluted/inflated by other editors' untouched defaults.
function aggregateEntries(list: ChordRankEntry[]): Array<{ fretsArray: number[]; totalScore: number; curatorCount: number; latest: string }> {
  const totals = new Map<string, { score: number; count: number; latest: string }>();
  for (const e of list) {
    const key = e.fretsArray.join(',');
    const cur = totals.get(key) ?? { score: -Infinity, count: 0, latest: e.createdAt };
    cur.score = Math.max(cur.score, e.scoreBoost);
    cur.count += 1;
    if (e.createdAt > cur.latest) cur.latest = e.createdAt;
    totals.set(key, cur);
  }
  return Array.from(totals.entries())
    .map(([key, v]) => ({ fretsArray: key.split(',').map(Number), totalScore: v.score, curatorCount: v.count, latest: v.latest }))
    .sort((a, b) => b.totalScore - a.totalScore || b.curatorCount - a.curatorCount || (b.latest > a.latest ? 1 : -1));
}

// Precedence: song-specific curations come first (ordered by score), followed by any
// global/dictionary curations not already covered by the song's list — merged, not
// replaced, so a chord curated in the dictionary keeps showing up even in songs that
// only curated a different variation of it.
export function pickCuratedVoicings(entries: ChordRankEntry[], songSlug?: string | null): CuratedVoicing[] {
  const songRanked = songSlug ? aggregateEntries(entries.filter(e => e.songSlug === songSlug)) : [];
  const globalRanked = aggregateEntries(entries.filter(e => e.songSlug === null));
  const songKeys = new Set(songRanked.map(r => r.fretsArray.join(',')));
  const merged = [
    ...songRanked.map(r => ({ ...r, scope: 'song' as const })),
    ...globalRanked.filter(r => !songKeys.has(r.fretsArray.join(','))).map(r => ({ ...r, scope: 'global' as const })),
  ];
  return merged.map(({ latest: _latest, ...rest }) => rest);
}

// Moves the curated shapes to the front of a list that has no other persisted meaning
// for its ordering (e.g. the dictionary's grid of every voicing, or the cifra's < >
// cycle order). Only use this on lists where numeric position isn't saved/shared
// elsewhere (locks, sequence links) without accounting for the shift.
export function applyCurationOrder<V extends { frets: number[] }>(
  voicings: V[],
  curatedFretsArrays: number[][],
  buildSynthetic: (fretsArray: number[]) => V
): V[] {
  if (curatedFretsArrays.length === 0) return voicings;
  const remaining = [...voicings];
  const front: V[] = [];
  for (const fretsArray of curatedFretsArrays) {
    const key = fretsArray.join(',');
    const idx = remaining.findIndex(v => v.frets.join(',') === key);
    front.push(idx >= 0 ? remaining.splice(idx, 1)[0] : buildSynthetic(fretsArray));
  }
  return [...front, ...remaining];
}
