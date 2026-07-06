import api from './api';

export interface TimingLoop {
  label: string;
  startLine: number;
  endLine: number;
  repeatCount: number;
  mediaTimestampStart: number | null;
  mediaTimestampEnd: number | null;
}

export interface TimingInstrumental {
  label: string;
  startLine: number | null;  // null = pure audio passage with no corresponding lyric line (e.g. an instrumental intro)
  endLine: number | null;
  mediaTimestampStart: number | null;
  mediaTimestampEnd: number | null;
}

export interface TimingPhrase {
  lineIndex: number;
  startTime: number;
  endTime: number;
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

export interface TimingContribution {
  id: string;
  editorAlias: string | null;
  mediaUrl: string | null;
  mediaType: 'youtube' | 'audio' | 'other' | null;
  bpm: number;
  duration: number;
  loops: TimingLoop[];
  instrumentalSections: TimingInstrumental[];
  phrases: TimingPhrase[];
  sections: TimingSection[];
  markers: TimingMarker[];
  votes: number;
  updatedAt: string;
}

export interface TimingSubmitPayload {
  editorHash: string;
  editorAlias?: string;
  mediaUrl?: string;
  mediaType?: string;
  bpm?: number;
  duration: number;
  loops: TimingLoop[];
  instrumentalSections: TimingInstrumental[];
  phrases: TimingPhrase[];
  sections: TimingSection[];
  markers: TimingMarker[];
}

export type MediaType = 'youtube' | 'audio' | 'other' | null;

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

export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
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

export async function fetchTimings(slug: string): Promise<TimingContribution[]> {
  const { data } = await api.get<TimingContribution[]>(`/api/timings/${slug}`);
  return data;
}

export async function voteTiming(timingId: string): Promise<{ votes: number }> {
  const { data } = await api.post<{ votes: number }>(`/api/timings/${timingId}/vote`, {});
  return data;
}

export async function fetchBestTiming(slug: string): Promise<TimingContribution | null> {
  const response = await api.get<TimingContribution>(`/api/timings/${slug}/best`, {
    validateStatus: (s) => s < 500,
  });
  if (response.status === 204 || response.status === 404) return null;
  return response.data;
}
