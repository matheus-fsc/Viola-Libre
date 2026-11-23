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

export interface WheelState { delta: number; lastStep: number; lastEvent: number }
export const INITIAL_WHEEL_STATE: WheelState = { delta: 0, lastStep: -Infinity, lastEvent: -Infinity };

export function wheelAccumulator(state: WheelState, deltaY: number, deltaMode: number, now: number,
  threshold = 60, cooldown = 180, pageHeight = 800): { state: WheelState; step: -1 | 0 | 1 } {
  const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  if (!Number.isFinite(delta) || !Number.isFinite(now)) return { state, step: 0 };
  // Descarta a inércia durante o intervalo para não guardar vários saltos de um gesto.
  if (now - state.lastStep < cooldown) return { state: { ...state, delta: 0, lastEvent: now }, step: 0 };
  const accumulated = (now - state.lastEvent > 250 || Math.sign(delta) !== Math.sign(state.delta) ? 0 : state.delta) + delta;
  if (Math.abs(accumulated) < threshold) return { state: { ...state, delta: accumulated, lastEvent: now }, step: 0 };
  return { state: { delta: 0, lastStep: now, lastEvent: now }, step: delta > 0 ? 1 : -1 };
}

/** Distância e velocidade em px e px/ms, positivas na direção do próximo acorde. */
export function touchStepFromDrag(distance: number, velocity = 0): number {
  if (!Number.isFinite(distance) || !Number.isFinite(velocity)) return 0;
  const projected = distance + (Math.abs(velocity) >= 0.35 ? velocity * 160 : 0);
  return Math.max(-8, Math.min(8, Math.sign(projected) * Math.floor(Math.abs(projected) / 48)));
}
