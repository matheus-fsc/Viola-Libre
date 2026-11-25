import type { BeatGrid, TimingContribution } from '../services/timingApi';

export interface ScrollSegment {
  startTime: number;
  endTime: number;
  lineIndex: number;
  // -1 conserva a âncora de rolagem sem atribuir letra ou acordes ao trecho sem linhas.
  endLine: number;
  kind: 'lyric' | 'instrumental' | 'hold';
  instrumental: boolean;
  label?: string;
}

export function timelineBarSegments(timeline: readonly ScrollSegment[], totalTime: number): {
  leftPct: number; widthPct: number; kind: ScrollSegment['kind'];
}[] {
  if (!Number.isFinite(totalTime) || totalTime <= 0) return [];
  return timeline.flatMap(segment => {
    if (!Number.isFinite(segment.startTime) || !Number.isFinite(segment.endTime)) return [];
    const start = Math.max(0, Math.min(totalTime, segment.startTime));
    const end = Math.max(0, Math.min(totalTime, segment.endTime));
    // A mesma origem do cursor conserva introduções e lacunas no relógio exibido.
    return end > start ? [{ leftPct: start / totalTime * 100,
      widthPct: (end - start) / totalTime * 100, kind: segment.kind }] : [];
  });
}

type TimelineTiming = Pick<TimingContribution, 'phrases' | 'instrumentalSections'> & Partial<Pick<TimingContribution, 'duration' | 'audioStart'>>;

export function instrumentalScrollSegments(timing: Pick<TimingContribution, 'phrases' | 'instrumentalSections'>): ScrollSegment[] {
  const phrases = [...timing.phrases].filter(p => Number.isFinite(p.startTime) && Number.isFinite(p.endTime)
    && p.startTime >= 0 && p.endTime > p.startTime
    // Frases legadas de acordes dentro de outro instrumental não são uma entrada vocal.
    && !timing.instrumentalSections.some(s => s.mediaTimestampStart != null && s.mediaTimestampEnd != null
      && p.startTime >= s.mediaTimestampStart && p.startTime < s.mediaTimestampEnd)).sort((a, b) => a.startTime - b.startTime);
  return timing.instrumentalSections.flatMap(section => {
    const { startLine, endLine, mediaTimestampStart: startTime, mediaTimestampEnd: endTime } = section;
    const withoutLines = startLine === null && endLine === null;
    if (startTime == null || endTime == null || !Number.isFinite(startTime) || !Number.isFinite(endTime)
      || startTime < 0 || endTime <= startTime
      || (!withoutLines && (startLine == null || endLine == null || endLine < startLine))) return [];
    // A próxima entrada vocal orienta a leitura, mas permanece sem destaque durante a pausa.
    const anchor = phrases.find(p => p.startTime >= endTime)?.lineIndex
      ?? phrases.filter(p => p.startTime < startTime).at(-1)?.lineIndex ?? 0;
    return [{ startTime, endTime, lineIndex: withoutLines ? anchor : startLine!,
      endLine: withoutLines ? -1 : endLine!, kind: 'instrumental' as const, instrumental: true, label: section.label }];
  });
}

export function buildScrollTimeline(timing: TimelineTiming): ScrollSegment[] {
  const events: ScrollSegment[] = [
    ...timing.phrases.map(p => ({ ...p, endLine: p.lineIndex, kind: 'lyric' as const, instrumental: false })),
    ...instrumentalScrollSegments(timing),
  ].filter(s => Number.isFinite(s.startTime) && Number.isFinite(s.endTime)
    && s.startTime >= 0 && s.endTime > s.startTime).sort((a, b) => a.startTime - b.startTime);
  if (!events.length) return [];
  const end = Math.max(timing.duration ?? 0, ...events.map(s => s.endTime));
  const boundaries = [...new Set([0, end, ...events.flatMap(s => [s.startTime, s.endTime])])].sort((a, b) => a - b);
  const result: ScrollSegment[] = [];
  let previousSource: ScrollSegment | undefined;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startTime = boundaries[i];
    // Blocos explícitos prevalecem sobre frases antigas sobrepostas; a frase mais recente vence entre letras.
    const active = events.filter(s => s.startTime <= startTime && s.endTime > startTime);
    const source = active.find(s => s.instrumental) ?? active.at(-1);
    const previous = result.at(-1);
    const held = previous ?? events[0];
    // Frases sobrepostas não devem reiniciar a barra de progresso do mesmo instrumental.
    if (previous && source === previousSource) {
      previous.endTime = boundaries[i + 1];
      continue;
    }
    previousSource = source;
    result.push(source ? { ...source, startTime, endTime: boundaries[i + 1] }
      : { ...held, startTime, endTime: boundaries[i + 1], kind: 'hold', instrumental: false, label: undefined });
  }
  return result;
}

export function timelineIndexAtTime(segments: readonly { startTime: number }[], time: number): number {
  if (!segments.length) return -1;
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (segments[mid].startTime <= time) low = mid + 1;
    else high = mid;
  }
  return Math.max(0, low - 1);
}

export function instrumentalCountdown(segments: readonly ScrollSegment[], time: number): number | null {
  const index = timelineIndexAtTime(segments, time);
  const current = segments[index];
  if (!current?.instrumental || time < current.startTime || time >= current.endTime) return null;
  const next = segments.slice(index + 1).find(s => s.kind === 'lyric');
  return next ? Math.max(0, Math.ceil(next.startTime - time)) : null;
}

export function timelineYAtTime(anchors: readonly { startTime: number; y: number }[], time: number): number {
  return anchors[timelineIndexAtTime(anchors, time)]?.y ?? 0;
}

export function trustedBeats(grid: BeatGrid | null | undefined): readonly number[] {
  return grid && (grid.beatConfidence ?? 0) >= 0.5 && (grid.beats?.length ?? 0) >= 2 ? grid.beats! : [];
}

function beatIndexAtTime(beats: readonly number[], time: number): number {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (beats[mid] <= time) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

export function beatProgress(time: number, beats: readonly number[]): number {
  if (beats.length < 2 || !Number.isFinite(time)) return 0;
  if (time <= beats[0]) return 0;
  const index = beatIndexAtTime(beats, time);
  if (index >= beats.length - 1) return beats.length - 1;
  const fraction = (time - beats[index]) / (beats[index + 1] - beats[index]);
  return index + fraction * fraction * (3 - 2 * fraction);
}

export function countInAtTime(timeline: readonly ScrollSegment[], time: number, grid?: BeatGrid | null): { beat: number; total: number } | null {
  const beats = trustedBeats(grid);
  const total = grid?.timeSignature === '3/4' ? 3 : 4;
  const entryIndex = timeline.findIndex(s => s.kind === 'lyric' && s.startTime > time);
  if (entryIndex < 0 || !beats.length) return null;
  const entry = timeline[entryIndex];
  const last = beats.findIndex(beat => beat >= entry.startTime);
  if (last < total) return null;
  let first = last - total;
  // O início de compasso medido evita deslocar a contagem quando a voz entra entre pulsos.
  const downbeat = grid?.downbeats?.filter(beat => beat <= beats[first]).at(-1);
  if (downbeat != null) {
    const aligned = beatIndexAtTime(beats, downbeat + 0.05);
    if (aligned >= 0 && first - aligned < total && Math.abs(beats[aligned] - downbeat) < 0.05) first = aligned;
  }
  const previousLyric = timeline.slice(0, entryIndex).filter(s => s.kind === 'lyric').at(-1);
  const gapStart = previousLyric?.endTime ?? 0;
  const instrumental = timeline.slice(0, entryIndex).some(s => s.instrumental && s.endTime > gapStart);
  if ((!instrumental && entry.startTime - gapStart < beats[first + total] - beats[first])
    || beats[first] < gapStart || time < beats[first] || time >= entry.startTime) return null;
  const index = beatIndexAtTime(beats, time);
  return { beat: Math.min(total, index - first + 1), total };
}

export function pulseAtTime(time: number, grid?: BeatGrid | null): { index: number; bar: number; strong: boolean; lit: boolean } | null {
  const beats = trustedBeats(grid);
  if (!beats.length || time < beats[0] || time > beats[beats.length - 1]) return null;
  const index = beatIndexAtTime(beats, time);
  const downbeats = grid?.downbeats ?? [];
  const barIndex = beatIndexAtTime(downbeats, time);
  const total = grid?.timeSignature === '3/4' ? 3 : 4;
  const strong = downbeats.length ? Math.abs((downbeats[barIndex] ?? -Infinity) - beats[index]) < 0.05 : index % total === 0;
  return { index, bar: downbeats.length ? (time < downbeats[0] ? 0 : barIndex + 1) : Math.floor(index / total) + 1,
    strong, lit: time - beats[index] < 0.18 };
}
