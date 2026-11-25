import { chordStripAtTime, type TimedChord } from './upcomingChords';

export function chordStepTarget(timeline: readonly TimedChord[], time: number, direction: 1 | -1, unit: 'chord' | 'line' = 'chord'): TimedChord | null {
  if (!timeline.length || !Number.isFinite(time)) return null;
  const current = chordStripAtTime(timeline, time).current;
  const index = current ? timeline.indexOf(current) : -1;
  if (unit === 'chord') return timeline[Math.max(0, Math.min(timeline.length - 1, index + direction))];
  const sameOccurrence = (a: TimedChord, b: TimedChord) =>
    a.occurrenceStart === b.occurrenceStart && a.lineIndex === b.lineIndex;
  // A ocorrência temporal distingue duas voltas da mesma frase escrita.
  let start = Math.max(0, index);
  while (start > 0 && sameOccurrence(timeline[start - 1], timeline[start])) start--;
  if (index < 0) return timeline[0];
  if (direction < 0) {
    let previous = Math.max(0, start - 1);
    while (previous > 0 && sameOccurrence(timeline[previous - 1], timeline[previous])) previous--;
    return timeline[previous];
  }
  let next = index + 1;
  while (next < timeline.length && sameOccurrence(timeline[index], timeline[next])) next++;
  return timeline[next] ?? timeline[index];
}
