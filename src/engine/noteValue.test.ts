import { describe, expect, it } from 'vitest';
import { noteValueForDuration } from './noteValue';

describe('noteValueForDuration', () => {
  it('converte segundos em tempos pelo BPM', () => {
    expect(noteValueForDuration(0.5, 120)).toMatchObject({ figure: 'quarter', dotted: false, beats: 1 });
    expect(noteValueForDuration(1, 120)).toMatchObject({ figure: 'half', beats: 2 });
    expect(noteValueForDuration(2, 120)).toMatchObject({ figure: 'whole', beats: 4, count: 1 });
    expect(noteValueForDuration(0.25, 120)).toMatchObject({ figure: 'eighth', dotted: false });
  });
  it('reconhece as pontuadas', () => {
    expect(noteValueForDuration(1.5, 120)).toMatchObject({ figure: 'half', dotted: true, beats: 3 });
    expect(noteValueForDuration(0.75, 120)).toMatchObject({ figure: 'quarter', dotted: true });
  });
  it('arredonda o tempo humano para a figura mais próxima', () => {
    expect(noteValueForDuration(1.07, 120)).toMatchObject({ figure: 'half' });
  });
  it('conta compassos inteiros acima de um compasso e meio', () => {
    expect(noteValueForDuration(4, 120)).toMatchObject({ figure: 'whole', count: 2, beats: 8 });
  });
  it('sem BPM ou duração válida não inventa figura', () => {
    expect(noteValueForDuration(1, 0)).toBeNull();
    expect(noteValueForDuration(1, null)).toBeNull();
    expect(noteValueForDuration(0, 120)).toBeNull();
    expect(noteValueForDuration(Infinity, 120)).toBeNull();
  });
});
