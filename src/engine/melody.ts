import type { Tuning } from './types';
import { NOTE_NAMES_SHARP } from './tunings';

export function melodyNoteName(midi: number): string {
  return `${NOTE_NAMES_SHARP[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function melodySolfege(midi: number, names: readonly string[]): string {
  const degrees = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pitch = midi % 12;
  return `${names[degrees[pitch]]}${[1, 3, 6, 8, 10].includes(pitch) ? '#' : ''}${Math.floor(midi / 12) - 1}`;
}

export interface TabOptions {
  maxFret?: number;
  preferredMaxFret?: number;
}
export type TabNote<T> = T & { stringIndex: number | null; fret: number | null };
type Position = { stringIndex: number; fret: number };

export function notesToTab<T extends { midi: number }>(notes: readonly T[], tuning: Tuning, opts: TabOptions = {}): TabNote<T>[] {
  const maxFret = Math.max(0, Math.min(36, Math.floor(opts.maxFret ?? 24)));
  const preferred = opts.preferredMaxFret ?? 12;
  const result: TabNote<T>[] = notes.map(note => ({ ...note, stringIndex: null, fret: null }));
  type Step = { positions: Position[]; costs: number[]; previous: number[]; index: number };
  let steps: Step[] = [];
  const flush = () => {
    const last = steps.at(-1);
    if (!last) return;
    let choice = last.costs.indexOf(Math.min(...last.costs));
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      Object.assign(result[step.index], step.positions[choice]);
      choice = step.previous[choice];
    }
    steps = [];
  };
  notes.forEach((note, index) => {
    const positions = tuning.strings.flatMap((open, stringIndex) => {
      const fret = note.midi - open;
      return Number.isInteger(fret) && fret >= 0 && fret <= maxFret ? [{ stringIndex, fret }] : [];
    });
    // Uma nota impossível continua explícita e não inventa uma transposição de oitava.
    if (!positions.length) { flush(); return; }
    const previous = steps.at(-1);
    const costs: number[] = [];
    const parents: number[] = [];
    positions.forEach(position => {
      const local = position.fret * 0.05 + Math.max(0, position.fret - preferred) * 3;
      let best = Infinity;
      let parent = -1;
      if (previous) previous.positions.forEach((from, i) => {
        const jump = Math.abs(position.fret - from.fret);
        const strings = Math.abs(position.stringIndex - from.stringIndex);
        // O custo acumulado evita uma escolha fácil agora que force um salto grande logo depois.
        const cost = previous.costs[i] + jump + Math.max(0, jump - 4) * 2
          + strings * 0.6 + Math.max(0, strings - 1) * 2;
        if (cost < best) { best = cost; parent = i; }
      });
      costs.push(local + (previous ? best : 0));
      parents.push(parent);
    });
    steps.push({ positions, costs, previous: parents, index });
  });
  flush();
  return result;
}
