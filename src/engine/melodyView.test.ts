import { describe, expect, it } from 'vitest';
import { melodyRangeAt, melodyRanges, parseMelodyView } from './melodyView';

const note = (start: number, end: number) => ({ start, end, midi: 60, confidence: 1 });
const melody = { version: 1, vocal: [note(10, 11)], instrumental: [{ label: 'Introdução', start: 0, end: 8, notes: [note(1, 2)] }] } as never;
const phrases = [{ lineIndex: 3, startTime: 9, endTime: 12 }];

describe('escolha da melodia', () => {
  it('mostra só a voz, só o violão ou os dois', () => {
    expect(melodyRanges(melody, phrases, { vocal: true, guitar: false }).map(r => r.instrumental)).toEqual([false]);
    expect(melodyRanges(melody, phrases, { vocal: false, guitar: true }).map(r => r.instrumental)).toEqual([true]);
    expect(melodyRanges(melody, phrases, { vocal: true, guitar: true })).toHaveLength(2);
  });

  it('não inventa melodia entre os trechos', () => {
    const ranges = melodyRanges(melody, phrases, { vocal: true, guitar: true });
    expect(melodyRangeAt(ranges, 4)?.label).toBe('Introdução');
    expect(melodyRangeAt(ranges, 8.5)).toBeNull();
    expect(melodyRangeAt(ranges, 9)?.instrumental).toBe(false);
  });

  it('mostra o vocalise, que não pertence a frase nenhuma', () => {
    const wordless = { version: 1, vocal: [note(20, 21), note(21.2, 22), note(30, 31)],
      instrumental: [{ label: 'Introdução', start: 0, end: 40, notes: [note(1, 2)] }] } as never;
    const ranges = melodyRanges(wordless, phrases, { vocal: true, guitar: true }, 'Voz sem letra');
    expect(ranges.filter(r => r.label === 'Voz sem letra').map(r => r.notes.length)).toEqual([2, 1]);
    expect(melodyRangeAt(ranges, 20.5)?.instrumental).toBe(false);
    expect(melodyRangeAt(ranges, 25)?.instrumental).toBe(true);
  });

  it('aproveita a preferência antiga e ignora valor corrompido', () => {
    expect(parseMelodyView(null, 'true')).toEqual({ vocal: true, guitar: true });
    expect(parseMelodyView('{"vocal":true}', 'true')).toEqual({ vocal: true, guitar: false });
    expect(parseMelodyView('{', null)).toEqual({ vocal: false, guitar: false });
  });
});
