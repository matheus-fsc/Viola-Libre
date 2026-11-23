import { describe, expect, it } from 'vitest';
import { melodyNoteName, melodySolfege, notesToTab } from './melody';
import { PRESET_INSTRUMENTS } from './tunings';
import { ptBR } from '../i18n/locales/pt-BR';
import { en } from '../i18n/locales/en';

const tunings = PRESET_INSTRUMENTS.flatMap(i => i.tunings).filter(t =>
  ['cebolao-re', 'cebolao-mi', 'rio-abaixo', 'violao-padrao', 'cavaquinho-padrao'].includes(t.id));

describe('tablatura da melodia', () => {
  it.each(tunings)('conserva a altura e os tempos em $id', tuning => {
    const notes = [62, 64, 66, 67, 69, 71, 74].map((midi, i) => ({ midi, start: i, end: i + 0.5 }));
    const result = notesToTab(notes, tuning);
    expect(result).toHaveLength(notes.length);
    result.forEach((n, i) => {
      expect(n.stringIndex).not.toBeNull();
      expect(tuning.strings[n.stringIndex!] + n.fret!).toBe(notes[i].midi);
      expect(n.fret).toBeGreaterThanOrEqual(0);
      expect(n.fret).toBeLessThanOrEqual(12);
      expect(n.start).toBe(i);
    });
    expect(notes[0]).not.toHaveProperty('fret');
  });
  it('escolhe o caminho completo em vez da menor casa de cada nota', () => {
    const tuning = { id: 'teste', name: '', strings: [60, 64] };
    const result = notesToTab([{ midi: 64 }, { midi: 63 }, { midi: 64 }], tuning);
    expect(result.map(n => [n.stringIndex, n.fret])).toEqual([[0, 4], [0, 3], [0, 4]]);
  });
  it('prefere casas até 12, mas alcança notas mais agudas quando necessário', () => {
    const tuning = tunings[0];
    expect(notesToTab([{ midi: 78 }], tuning)[0].fret).toBe(16);
    expect(notesToTab([{ midi: 78 }], tuning, { maxFret: 12 })[0].fret).toBeNull();
  });
  it('expõe notas impossíveis, preserva a sequência e aceita afinação reentrante', () => {
    const tuning = { id: 'reentrante', name: '', strings: [67, 60, 64, 69] };
    const notes = [{ midi: 60 }, { midi: 20 }, { midi: 69 }];
    const result = notesToTab(notes, tuning);
    expect(result[0]).toMatchObject({ stringIndex: 1, fret: 0 });
    expect(result[1]).toEqual({ midi: 20, stringIndex: null, fret: null });
    expect(result[2]).toMatchObject({ stringIndex: 3, fret: 0 });
    expect(notesToTab([], tuning)).toEqual([]);
    expect(notesToTab(notes, { ...tuning, strings: [] }).every(n => n.fret === null)).toBe(true);
  });
});

describe('nome da nota e solfejo brasileiro', () => {
  const expected = ['Dó4', 'Dó#4', 'Ré4', 'Ré#4', 'Mi4', 'Fá4', 'Fá#4', 'Sol4', 'Sol#4', 'Lá4', 'Lá#4', 'Si4'];
  it.each([ptBR, en])('usa o dicionário e conserva o solfejo brasileiro', dictionary => {
    const m = dictionary.melody;
    const names = [m.do, m.re, m.mi, m.fa, m.sol, m.la, m.si];
    expect(Array.from({ length: 12 }, (_, i) => melodySolfege(60 + i, names))).toEqual(expected);
  });
  it.each([[0, 'C-1'], [60, 'C4'], [61, 'C#4'], [69, 'A4'], [72, 'C5'], [127, 'G9']])(
    'nomeia MIDI %s como %s', (midi, name) => expect(melodyNoteName(midi)).toBe(name),
  );
});
