import { describe, expect, it } from 'vitest';
import { cutMelody } from './mediaCuts';
import { buildCommunityCards } from './timingVariants';
import { normalizeContribution, type TimingMelody } from '../services/timingApi';

const vocal = (start: number, end: number) => ({ start, end, midi: 60, cents: 0, conf: 1, lineIndex: 0 });
const melody: TimingMelody = {
  version: 1,
  vocal: [vocal(0, 1), vocal(1, 3), vocal(2, 4), vocal(3, 5), vocal(5, 6)],
  instrumental: [
    { label: 'intro', start: 2, end: 4, notes: [{ start: 2, end: 3, midi: 60, velocity: 90, conf: 1 }] },
    { label: 'solo', start: 3, end: 8, notes: [{ start: 3, end: 5, midi: 64, velocity: 90, conf: 1 }] },
  ],
};

describe('cortes da melodia', () => {
  it('descarta intervalos removidos e encurta os que cruzam as bordas', () => {
    const result = cutMelody(melody, [{ start: 2, end: 4 }]);
    expect(result.vocal.map(n => [n.start, n.end])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect(result.vocal[1]).toMatchObject({ midi: 60, cents: 0, conf: 1, lineIndex: 0 });
    expect(result.instrumental).toEqual([{ label: 'solo', start: 2, end: 6,
      notes: [{ start: 2, end: 3, midi: 64, velocity: 90, conf: 1 }] }]);
    expect(melody.vocal[2].end).toBe(4);
  });
  it('normaliza cortes sobrepostos e mantém igualdade sem cortes', () => {
    expect(cutMelody(melody, [])).toEqual(melody);
    expect(cutMelody(melody, [{ start: 3, end: 4 }, { start: 2, end: 3.5 }]))
      .toEqual(cutMelody(melody, [{ start: 2, end: 4 }]));
  });
  it('a variante sem dedilhado usa o mesmo relógio nas frases e melodias', () => {
    const timing = normalizeContribution({ id: 'auto', source: 'auto', duration: 8, melody,
      phrases: [{ lineIndex: 0, startTime: 0, endTime: 2 }, { lineIndex: 1, startTime: 2, endTime: 4 },
        { lineIndex: 2, startTime: 4, endTime: 8 }] });
    const cards = buildCommunityCards([timing], ['lyric', 'tab', 'lyric']);
    expect(cards[0].timing.melody).toEqual(melody);
    expect(cards[1].timing.melody).toEqual(cutMelody(melody, [{ start: 2, end: 4 }]));
    expect(cards[1].timing.phrases[1].startTime).toBe(2);
    expect(cards[1].timing.duration).toBe(6);
  });
});
