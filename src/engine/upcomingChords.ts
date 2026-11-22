import { isChordLine, parseChordLine } from '../services/cifraUtils';
import type { ScrollSegment } from './scrollTimeline';

export function segmentChords(segment: ScrollSegment, lines: readonly string[]): string[] {
  if (!Number.isInteger(segment.lineIndex) || segment.lineIndex < 0 || segment.lineIndex >= lines.length) return [];
  const chordsAt = (index: number) => isChordLine(lines[index] ?? '')
    ? parseChordLine(lines[index]).map(chord => chord.text) : [];
  if (segment.instrumental || segment.endLine > segment.lineIndex) {
    return lines.slice(segment.lineIndex, segment.endLine + 1)
      .flatMap((_, index) => chordsAt(segment.lineIndex + index));
  }
  if (isChordLine(lines[segment.lineIndex] ?? '')) return chordsAt(segment.lineIndex);
  // Só a linha de acordes acima pertence à frase; buscar além de outra letra roubaria sua harmonia.
  for (let index = segment.lineIndex - 1; index >= 0; index--) {
    if (!lines[index].trim()) continue;
    return chordsAt(index);
  }
  return [];
}

export function upcomingChords(timeline: readonly ScrollSegment[], lines: readonly string[], time: number, count: number): {
  lineIndex: number; chords: string[]; startsIn: number;
}[] {
  if (!Number.isFinite(time) || !Number.isFinite(count) || count <= 0) return [];
  // Não deduplica índices: cada volta do refrão é uma ocorrência diferente no transporte.
  return timeline.filter(segment => segment.kind !== 'hold' && segment.startTime > time)
    .slice(0, Math.floor(count)).map(segment => ({ lineIndex: segment.lineIndex,
      chords: segmentChords(segment, lines), startsIn: segment.startTime - time }));
}
