/**
 * Figura rítmica de uma duração: quantos tempos um acorde dura, desenhado como a nota da
 * partitura que vale isso. Serve para o músico ligar o que vê no painel ao tempo que conta.
 *
 * Puro, sem DOM. A duração vem do relógio do timing; o BPM, do timing ou da cifra.
 */
export type NoteFigure = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface NoteValue {
  figure: NoteFigure;
  dotted: boolean;
  /** Semibreves seguidas (ligadas) quando o acorde passa de um compasso de 4. */
  count: number;
  /** Tempos arredondados para a figura escolhida. */
  beats: number;
}

const CANDIDATES: readonly { beats: number; figure: NoteFigure; dotted: boolean }[] = [
  { beats: 0.25, figure: 'sixteenth', dotted: false },
  { beats: 0.5, figure: 'eighth', dotted: false },
  { beats: 0.75, figure: 'eighth', dotted: true },
  { beats: 1, figure: 'quarter', dotted: false },
  { beats: 1.5, figure: 'quarter', dotted: true },
  { beats: 2, figure: 'half', dotted: false },
  { beats: 3, figure: 'half', dotted: true },
  { beats: 4, figure: 'whole', dotted: false },
];

/** `null` sem BPM ou duração válidos: melhor sem figura que com uma inventada. */
export function noteValueForDuration(seconds: number, bpm: number | null | undefined): NoteValue | null {
  if (!bpm || !(bpm > 0) || !(seconds > 0) || !Number.isFinite(seconds)) return null;
  const beats = seconds * bpm / 60;
  // Mais de um compasso e meio: conta compassos inteiros, cada um uma semibreve.
  if (beats >= 6) {
    const count = Math.round(beats / 4);
    return { figure: 'whole', dotted: false, count, beats: count * 4 };
  }
  // Mais perto em escala de razão: 0,3 tempo está mais para semicolcheia que para colcheia.
  let best = CANDIDATES[0];
  for (const candidate of CANDIDATES) {
    if (Math.abs(Math.log(beats / candidate.beats)) < Math.abs(Math.log(beats / best.beats))) best = candidate;
  }
  return { figure: best.figure, dotted: best.dotted, count: 1, beats: best.beats };
}
