import { describe, expect, it } from 'vitest';
import { deriveRepeatRanges, getRepeatRanges, repeatPassAtTime } from './repeatRanges';

const phrase = (lineIndex: number, startTime: number, endTime = startTime + 1) =>
  ({ lineIndex, startTime, endTime });

describe('deriveRepeatRanges', () => {
  it('reúne passagens completas em ordem cronológica, mesmo com linhas sem frases no meio', () => {
    const phrases = [
      phrase(5, 0), phrase(7, 1), phrase(8, 2, 4), phrase(11, 5),
      phrase(5, 7), phrase(7, 8), phrase(8, 9, 11),
      phrase(5, 13), phrase(7, 14), phrase(8, 15, 18), phrase(12, 18),
    ].reverse();
    const ranges = deriveRepeatRanges(phrases);
    expect(ranges).toEqual([{
      startLine: 5, endLine: 8, count: 3,
      occurrences: [{ startTime: 0, endTime: 4 }, { startTime: 7, endTime: 11 }, { startTime: 13, endTime: 18 }],
    }]);
    expect(phrases[0].lineIndex).toBe(12);
    expect(repeatPassAtTime(ranges, 0)).toEqual({ pass: 1, count: 3 });
    expect(repeatPassAtTime(ranges, 7)).toEqual({ pass: 2, count: 3 });
    expect(repeatPassAtTime(ranges, 15)).toEqual({ pass: 3, count: 3 });
    expect(repeatPassAtTime(ranges, 4)).toBeNull();
    expect(repeatPassAtTime(ranges, 18)).toBeNull();
  });

  it('ignora texto escrito em índices distintos, passagens de uma linha e cópias no mesmo instante', () => {
    expect(deriveRepeatRanges([
      phrase(0, 0), phrase(1, 1), phrase(2, 2), phrase(3, 3),
      phrase(3, 3), phrase(4, 4), phrase(4, 4), phrase(4, 6),
    ])).toEqual([]);
  });

  it('mantém trechos com passagens independentes e ignora voltas incompletas', () => {
    expect(deriveRepeatRanges([
      phrase(0, 0), phrase(1, 1), phrase(0, 2), phrase(1, 3), phrase(0, 4),
      phrase(5, 5), phrase(6, 6), phrase(5, 7), phrase(6, 8),
    ])).toEqual([
      { startLine: 0, endLine: 1, count: 2, occurrences: [{ startTime: 0, endTime: 2 }, { startTime: 2, endTime: 4 }] },
      { startLine: 5, endLine: 6, count: 2, occurrences: [{ startTime: 5, endTime: 7 }, { startTime: 7, endTime: 9 }] },
    ]);
  });
});

describe('getRepeatRanges', () => {
  const loop = {
    label: 'Refrão', startLine: 5, endLine: 8, repeatCount: 2,
    mediaTimestampStart: 2, mediaTimestampEnd: 6,
  };

  it('prefere os limites e os tempos explícitos do loop', () => {
    const occurrences = [{ startTime: 2, endTime: 6 }, { startTime: 8, endTime: 15 }];
    const phrases = [phrase(0, 1), phrase(1, 2), phrase(0, 9), phrase(1, 10)];
    const ranges = getRepeatRanges([{ ...loop, occurrences }], phrases);
    expect(ranges).toEqual([{ startLine: 5, endLine: 8, count: 2, occurrences }]);
    expect(repeatPassAtTime(ranges, 14)).toEqual({ pass: 2, count: 2 });
  });

  it('localiza as passagens de loops antigos quando as frases cobrem o trecho', () => {
    const ranges = getRepeatRanges([loop], [phrase(5, 2), phrase(7, 4, 6), phrase(5, 8), phrase(7, 10, 15)]);
    expect(repeatPassAtTime(ranges, 10)).toEqual({ pass: 2, count: 2 });
    expect(repeatPassAtTime(getRepeatRanges([loop], []), 3)).toEqual({ pass: 1, count: 2 });
  });
});
