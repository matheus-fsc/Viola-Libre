import { describe, expect, it } from 'vitest';
import { normalizeContribution, normalizeMelody } from './timingApi';

const note = { start: 1, end: 2, midi: 61, cents: -12, conf: 0.8, lineIndex: 3 };
const lead = { start: 3, end: 4, midi: 64, velocity: 96, conf: 0.9 };
const melody = { version: 1, vocal: [note], instrumental: [{ label: ' Solo ', start: 3, end: 5, notes: [lead] }] };

describe('normalização da melodia', () => {
  it('normaliza, copia e ordena notas sem alterar o payload', () => {
    const raw = { ...melody, vocal: [{ ...note, start: 2, end: 3 }, note] };
    const normalized = normalizeMelody(raw)!;
    expect(normalized.vocal.map(n => n.start)).toEqual([1, 2]);
    expect(normalized.instrumental[0].label).toBe('Solo');
    normalized.vocal[0].midi = 70;
    expect(note.midi).toBe(61);
    expect(raw.vocal[0].start).toBe(2);
  });
  it.each([
    null, {}, [], { ...melody, version: 2 }, { ...melody, vocal: null },
    { ...melody, instrumental: {} },
    ...[
      { start: -1 }, { start: NaN }, { end: Infinity }, { end: 1 },
      { midi: 128 }, { midi: -1 }, { midi: 60.5 }, { cents: NaN },
      { cents: 101 }, { conf: 1.1 }, { conf: -0.1 }, { lineIndex: -1 }, { lineIndex: 1.5 },
    ].map(patch => ({ ...melody, vocal: [{ ...note, ...patch }] })),
    ...[{ velocity: -1 }, { velocity: 128 }, { conf: NaN }, { start: 2 }, { end: 6 }]
      .map(patch => ({ ...melody, instrumental: [{ ...melody.instrumental[0], notes: [{ ...lead, ...patch }] }] })),
    { ...melody, instrumental: [{ ...melody.instrumental[0], notes: [null] }] },
  ])('descarta integralmente uma melodia malformada: %j', raw => {
    expect(normalizeMelody(raw)).toBeUndefined();
    expect(normalizeContribution({ id: 'x', duration: 10, melody: raw }).melody).toBeUndefined();
  });
  it('mantém opcional a ligação à linha e permite conjuntos vazios', () => {
    const { lineIndex: _line, ...unlinked } = note;
    expect(normalizeMelody({ version: 1, vocal: [unlinked], instrumental: [] })?.vocal).toEqual([unlinked]);
    expect(normalizeMelody({ version: 1, vocal: [], instrumental: [] })).toEqual({ version: 1, vocal: [], instrumental: [] });
    expect(normalizeContribution({ id: 'x', duration: 10, melody }).melody).toEqual(normalizeMelody(melody));
    expect(normalizeContribution({ id: 'x', duration: 10 }).melody).toBeUndefined();
  });
});
