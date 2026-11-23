import { normalizeCuts, type MediaCut } from '../engine/mediaCuts';
import api, { cabecalhoChavePublica } from './api';

export interface TimingOccurrence {
  startTime: number;
  endTime: number;
}

export interface TimingLoop {
  label: string;
  startLine: number;
  endLine: number;
  repeatCount: number;
  mediaTimestampStart: number | null;
  mediaTimestampEnd: number | null;
  occurrences?: TimingOccurrence[];
}

export interface TimingInstrumental {
  label: string;
  startLine: number | null;  // Sem escrita, o trecho ainda precisa conservar seu tempo no transporte.
  endLine: number | null;
  mediaTimestampStart: number | null;
  mediaTimestampEnd: number | null;
}

export interface TimingPhrase {
  lineIndex: number;
  startTime: number;
  endTime: number;
}

export interface TimingChordTime {
  time: number;
  lineIndex: number;
  chordIndex: number;
  chord: string;
  confidence: number;
}

// Notation markers — point-in-time symbols from sheet music
export type MarkerType =
  | 'segno'           // 𝄋 — ponto de retorno para D.S.
  | 'coda'            // 𝄉 — início do trecho final
  | 'to_coda'         // al Coda — de onde se pula para a Coda
  | 'fine'            // Fine — fim real da música
  | 'fermata'         // 𝄐 — nota sustentada além do ritmo
  | 'd_c_al_coda'    // D.C. al Coda — volta ao início, pula para Coda
  | 'd_s_al_coda'    // D.S. al Coda — volta ao Segno, pula para Coda
  | 'd_c_al_fine'    // D.C. al Fine — volta ao início, termina no Fine
  | 'd_s_al_fine'    // D.S. al Fine — volta ao Segno, termina no Fine
  | 'first_ending'   // [1. — tocado só na 1ª vez
  | 'second_ending'; // [2. — tocado só na 2ª vez

export interface TimingMarker {
  type: MarkerType;
  time: number;      // seconds — where in the recording this marker occurs
  endTime?: number;  // only for first_ending / second_ending (they cover a range)
  line?: number;     // optional link to cifra line
  col?: number;      // character-column within that line — same unit as ChordPos.col (chars from line start).
                     // Set only for markers placed via click-on-word (segno/coda/to_coda/D.C./D.S. variants).
  // Cross-reference to another marker's StoredMarker.id — local-only, NOT sent to API yet.
  // Semantic rules:
  //   'to_coda'     → points to the 'coda' marker this jump lands on
  //   'd_s_al_coda' → points to the 'segno' marker to return to
  //   'd_s_al_fine' → points to the 'segno' marker to return to
  //   'd_c_al_coda' / 'd_c_al_fine' → no targetMarkerId; target is always time=0 (Da Capo = from beginning)
  //   all others    → never set
  targetMarkerId?: string;
}

// Standard music section types — kept in English for future sheet-music conversion
export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'instrumental'
  | 'outro'
  | 'coda'
  | 'other';

export interface TimingSection {
  label: string;
  type: SectionType;
  startTime: number;       // seconds from media start
  endTime: number | null;  // null = open-ended until next section
  startLine?: number;      // optional link to cifra line (for sheet-music use)
  endLine?: number;
}

export interface BeatGrid {
  beats?: number[];
  downbeats?: number[];
  timeSignature?: '4/4' | '3/4';
  beatConfidence?: number;
  bpmSource?: 'audio' | 'cifra' | 'default';
}

export function normalizeBeatGrid(raw: Record<string, unknown>): BeatGrid {
  const grid: BeatGrid = {};
  for (const key of ['beats', 'downbeats'] as const) {
    const values = raw[key];
    // Uma grade parcial por erro de formato pode inventar a entrada do canto.
    if (Array.isArray(values) && values.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
      const sorted = [...new Set(values as number[])].sort((a, b) => a - b);
      if (sorted.length >= (key === 'beats' ? 2 : 1)) grid[key] = sorted;
    }
  }
  if (raw.timeSignature === '4/4' || raw.timeSignature === '3/4') grid.timeSignature = raw.timeSignature;
  if (typeof raw.beatConfidence === 'number' && Number.isFinite(raw.beatConfidence)
    && raw.beatConfidence >= 0 && raw.beatConfidence <= 1) grid.beatConfidence = raw.beatConfidence;
  if (raw.bpmSource === 'audio' || raw.bpmSource === 'cifra' || raw.bpmSource === 'default') grid.bpmSource = raw.bpmSource;
  return grid;
}

export interface TimingContribution extends BeatGrid {
  id: string;
  editorAlias: string | null;
  mediaUrl: string | null;
  mediaType: 'youtube' | 'audio' | 'other' | null;
  bpm: number;
  duration: number;
  audioStart?: number | null;
  loops: TimingLoop[];
  instrumentalSections: TimingInstrumental[];
  phrases: TimingPhrase[];
  chordTimes?: TimingChordTime[];
  sections: TimingSection[];
  markers: TimingMarker[];
  votes: number;
  updatedAt: string;
  source?: 'manual' | 'auto';
  reviewed?: boolean;
  variant?: 'sem_dedilhado' | null;
  cuts?: MediaCut[] | null;
  reviewedFrom?: string | null;
}

export interface TimingSubmitPayload extends BeatGrid {
  editorHash: string;
  editorAlias?: string;
  mediaUrl?: string;
  mediaType?: string;
  bpm?: number;
  duration: number;
  audioStart?: number | null;
  loops: TimingLoop[];
  instrumentalSections: TimingInstrumental[];
  phrases: TimingPhrase[];
  chordTimes?: TimingChordTime[];
  sections: TimingSection[];
  markers: TimingMarker[];
  variant?: 'sem_dedilhado' | null;
  cuts?: MediaCut[] | null;
  reviewedFrom?: string;
}

export type MediaType = 'youtube' | 'audio' | 'other' | null;

type RawTimingContribution = Pick<TimingContribution, 'id' | 'duration'> & Partial<Omit<TimingContribution, 'id' | 'duration' | 'loops' | 'chordTimes'>> & {
  chordTimes?: unknown;
  loops?: (Omit<TimingLoop, 'occurrences'> & { occurrences?: unknown })[];
  editor_alias?: string | null;
  media_url?: string | null;
  media_type?: MediaType;
  instrumental_sections?: TimingInstrumental[];
  updated_at?: string;
  reviewed_from?: string | null;
  line_timestamps?: { line: number; media_timestamp_start: number }[];
};

export function normalizeLoopOccurrences(raw: unknown): TimingOccurrence[] {
  if (!Array.isArray(raw)) return [];
  const occurrences = raw.filter((entry): entry is TimingOccurrence => {
    if (!entry || typeof entry !== 'object') return false;
    const { startTime, endTime } = entry;
    return typeof startTime === 'number' && Number.isFinite(startTime) && startTime >= 0
      && typeof endTime === 'number' && Number.isFinite(endTime) && endTime > startTime;
  });
  return occurrences.sort((a, b) => a.startTime - b.startTime);
}

export function normalizeChordTimes(raw: unknown): TimingChordTime[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  // Um alinhamento incompleto por erro de formato não deve substituir a estimativa do bloco.
  if (!raw.every((entry): entry is TimingChordTime => {
    if (!entry || typeof entry !== 'object') return false;
    const { time, lineIndex, chordIndex, chord, confidence } = entry;
    return typeof time === 'number' && Number.isFinite(time) && time >= 0
      && Number.isInteger(lineIndex) && lineIndex >= 0
      && Number.isInteger(chordIndex) && chordIndex >= 0
      && typeof chord === 'string' && chord.trim().length > 0
      && typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
  })) return undefined;
  return raw.map(({ time, lineIndex, chordIndex, chord, confidence }) => ({ time, lineIndex, chordIndex, chord, confidence }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeContribution(raw: RawTimingContribution): TimingContribution {
  const {
    id, duration, bpm = 0, votes = 0,
    editorAlias = raw.editor_alias ?? null,
    mediaUrl = raw.media_url ?? null,
    mediaType = raw.media_type ?? null,
    instrumentalSections = raw.instrumental_sections,
    updatedAt = raw.updated_at ?? '',
    source = 'manual', reviewed, reviewedFrom = raw.reviewed_from,
  } = raw;
  const chordTimes = normalizeChordTimes(raw.chordTimes);
  let phrases = raw.phrases;
  // Os registros antigos guardavam só o início, então o próximo início delimita cada frase.
  if (phrases == null && raw.line_timestamps) {
    const timestamps = [...raw.line_timestamps].sort((a, b) => a.media_timestamp_start - b.media_timestamp_start);
    phrases = timestamps.map((timestamp, index) => ({
      lineIndex: timestamp.line,
      startTime: timestamp.media_timestamp_start,
      endTime: timestamps[index + 1]?.media_timestamp_start ?? duration,
    }));
  }

  return {
    id, duration, bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : 0, votes, editorAlias, mediaUrl, mediaType, updatedAt, source, reviewed, reviewedFrom,
    ...normalizeBeatGrid(raw),
    ...(raw.variant != null && { variant: raw.variant }),
    ...(raw.cuts != null && { cuts: normalizeCuts(raw.cuts) }),
    ...(raw.audioStart != null && { audioStart: raw.audioStart }),
    ...(chordTimes && { chordTimes }),
    loops: (raw.loops ?? []).map(({ occurrences: rawOccurrences, ...loop }) => {
      const occurrences = normalizeLoopOccurrences(rawOccurrences);
      const first = occurrences[0];
      // Os tempos canônicos acompanham a primeira passagem válida para o editor abrir o clipe certo.
      return first
        ? { ...loop, occurrences, mediaTimestampStart: first.startTime, mediaTimestampEnd: first.endTime }
        : loop;
    }),
    // Ausência de linhas indica pausa instrumental, por isso não filtra esses trechos.
    instrumentalSections: instrumentalSections ?? [],
    phrases: phrases ?? [],
    sections: raw.sections ?? [],
    markers: raw.markers ?? [],
  };
}

export function getOrCreateEditorHash(): string {
  const key = 'viola_editor_hash';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const hash = Math.random().toString(36).slice(2, 10);
  localStorage.setItem(key, hash);
  return hash;
}

export function detectMediaType(url: string): MediaType {
  if (!url) return null;
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/\.(mp3|ogg|wav|m4a|flac)(\?|$)/i.test(url)) return 'audio';
  return 'other';
}

// Cobre as formas que o seed de vídeo e os editores produzem: watch?v=, youtu.be,
// /embed/, /shorts/ e /live/. O id do YouTube tem sempre 11 caracteres.
export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function cleanYouTubeUrl(url: string): string {
  const id = extractYouTubeId(url);
  if (!id) return url;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export async function submitTiming(
  slug: string,
  payload: TimingSubmitPayload
): Promise<{ id: string; editorHash: string; message: string }> {
  const { data } = await api.post<{ id: string; editorHash: string; message: string }>(
    `/api/timings/${slug}`,
    payload
  );
  return data;
}

export async function fetchTimings(slug: string, signal?: AbortSignal): Promise<TimingContribution[]> {
  const { data } = await api.get<RawTimingContribution[]>(`/api/timings/${slug}`, { signal });
  return data.map(normalizeContribution);
}

export async function voteTiming(timingId: string): Promise<{ votes: number }> {
  // O voto exige a chave pública; ENVIAR o timing, não. Conferido no `openapi.json` do
  // servidor: `POST /api/timings/{timing_id}/vote` declara `APIKeyHeader`, enquanto
  // `POST /api/timings/{song_slug}` não declara segurança nenhuma. A assimetria é
  // proposital — votar é barato de repetir, e é o que se protege contra automação.
  //
  // Sem o cabeçalho a rota respondia 403 e o contador não subia, sem erro visível em
  // lugar nenhum. Era o único chamador do front que pedia uma rota protegida sem a chave.
  const { data } = await api.post<{ votes: number }>(
    `/api/timings/${timingId}/vote`,
    {},
    { headers: cabecalhoChavePublica() }
  );
  return data;
}

export async function fetchBestTiming(slug: string): Promise<TimingContribution | null> {
  const response = await api.get<RawTimingContribution>(`/api/timings/${slug}/best`, {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
  });
  if (response.status === 204 || response.status === 404) return null;
  return normalizeContribution(response.data);
}
