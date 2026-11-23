import { chordIdentity } from './chordIdentity';
import { isChordLine, parseChordLine } from '../services/cifraUtils';
import type { ScrollSegment } from './scrollTimeline';
import type { TimingChordTime } from '../services/timingApi';

export function segmentChords(segment: ScrollSegment, lines: readonly string[]): string[] {
  if (segment.endLine < segment.lineIndex) return [];
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
  return timeline.filter(segment => segment.kind !== 'hold' && segment.endLine >= segment.lineIndex && segment.startTime > time)
    .slice(0, Math.floor(count)).map(segment => ({ lineIndex: segment.lineIndex,
      chords: segmentChords(segment, lines), startsIn: segment.startTime - time }));
}

export interface TimedChord {
  name: string;
  startTime: number;
  lineIndex?: number;
  chordIndex?: number;
}

/** Usa ocorrências do transporte, pois a mesma linha pode voltar em cada refrão. */
export function buildChordTimeline(segments: readonly ScrollSegment[], lines: readonly string[], chordTimes: readonly TimingChordTime[] = []): TimedChord[] {
  const events: TimedChord[] = [];
  for (const segment of segments) {
    const duration = segment.endTime - segment.startTime;
    if (segment.kind === 'hold' || !Number.isFinite(segment.startTime) || !Number.isFinite(duration) || duration <= 0) continue;
    if (segment.instrumental) {
      const aligned = chordTimes.flatMap(chord => {
        if (chord.time < segment.startTime || chord.time >= segment.endTime
          || chord.lineIndex < segment.lineIndex || chord.lineIndex > segment.endLine) return [];
        const line = lines[chord.lineIndex];
        const parsed = line && isChordLine(line) ? parseChordLine(line)[chord.chordIndex] : undefined;
        // O índice preserva a transposição exibida; o nome vindo do áudio está no tom original.
        return parsed ? [{ name: parsed.text, startTime: chord.time, lineIndex: chord.lineIndex, chordIndex: chord.chordIndex }] : [];
      });
      if (aligned.length) {
        events.push(...aligned);
        continue;
      }
      const chords = segmentChords(segment, lines);
      chords.forEach((name, index) => events.push({ name, startTime: segment.startTime + index / chords.length * duration }));
      continue;
    }
    const lyric = lines[segment.lineIndex];
    if (lyric === undefined) continue;
    const chordLine = isChordLine(lyric) ? lyric : lines[segment.lineIndex - 1];
    // Não atravessa letras ou linhas vazias: só a harmonia escrita logo acima é desta frase.
    if (chordLine === undefined || !isChordLine(chordLine)) continue;
    const length = Math.max(lyric.length, chordLine.length, 1);
    for (const chord of parseChordLine(chordLine)) {
      events.push({ name: chord.text, startTime: segment.startTime + chord.col / length * duration });
    }
  }
  const sorted = events.sort((a, b) => a.startTime - b.startTime);
  // A volta da letra precisa continuar anunciada mesmo quando repete o acorde anterior à pausa.
  return sorted.filter((chord, index) => index === 0 || chord.lineIndex !== undefined
    || chordIdentity(chord.name) !== chordIdentity(sorted[index - 1].name)
    || segments.some(segment => segment.instrumental && segment.endLine < segment.lineIndex
      && segment.startTime > sorted[index - 1].startTime && segment.endTime <= chord.startTime));
}

/** A busca independe do histórico, então voltar no vídeo restaura a harmonia correta. */
export function chordStripAtTime(timeline: readonly TimedChord[], time: number): {
  previous: TimedChord | null; current: TimedChord | null; next: TimedChord | null; startsIn: number | null;
} {
  let low = 0;
  let high = timeline.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (timeline[mid].startTime <= time) low = mid + 1;
    else high = mid;
  }
  const next = timeline[low] ?? null;
  return { previous: timeline[low - 2] ?? null, current: timeline[low - 1] ?? null,
    next, startsIn: next ? next.startTime - time : null };
}
