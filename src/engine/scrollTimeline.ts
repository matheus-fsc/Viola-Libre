import type { TimingContribution } from '../services/timingApi';

export interface ScrollSegment {
  startTime: number;
  endTime: number;
  lineIndex: number;
  endLine: number;
  kind: 'lyric' | 'instrumental' | 'hold';
  instrumental: boolean;
  label?: string;
}

type TimelineTiming = Pick<TimingContribution, 'phrases' | 'instrumentalSections'> & Partial<Pick<TimingContribution, 'duration' | 'audioStart'>>;

export function buildScrollTimeline(timing: TimelineTiming): ScrollSegment[] {
  const events: ScrollSegment[] = [
    ...timing.phrases.map(p => ({ ...p, endLine: p.lineIndex, kind: 'lyric' as const, instrumental: false })),
    ...timing.instrumentalSections.flatMap(s => s.startLine != null && s.endLine != null
      && s.endLine >= s.startLine && s.mediaTimestampStart != null && s.mediaTimestampEnd != null
      ? [{ startTime: s.mediaTimestampStart, endTime: s.mediaTimestampEnd, lineIndex: s.startLine,
        endLine: s.endLine, kind: 'instrumental' as const, instrumental: true, label: s.label }] : []),
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
