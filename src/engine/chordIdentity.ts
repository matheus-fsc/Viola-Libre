import { buildChord, parseChordString, splitChordAnnotation } from './chordCalculator';

/** Preserva tensões e baixo para não confundir acordes que só parecem semelhantes. */
export function chordIdentity(name: string): string {
  const core = splitChordAnnotation(name.trim()).core.trim();
  const normalized = core.replace(/^([A-G][b#]?)(\d+)m$/, '$1m$2');
  try {
    const { root, suffix, bass } = parseChordString(normalized);
    const chord = buildChord(root, suffix, bass || undefined);
    return JSON.stringify([chord.root, [...chord.formula.intervals].sort((a, b) => a - b), chord.bass ?? chord.root]);
  } catch {
    // Um símbolo desconhecido não deve herdar a forma de outro acorde.
    return core;
  }
}
