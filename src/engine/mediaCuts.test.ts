import { describe, expect, it, vi } from 'vitest';
import { createCutClock, derivedToMedia, mediaToDerived, normalizeCuts } from './mediaCuts';

const cuts = [{ start: 5, end: 8 }, { start: 12, end: 16 }];

describe('relógio sem dedilhado', () => {
  it.each([[0, 0], [4, 4], [5, 5], [6, 5], [8, 5], [10, 7], [12, 9], [14, 9], [16, 9], [20, 13]])(
    'converte mídia %s para derivado %s', (media, derived) => {
      expect(mediaToDerived(media, cuts)).toBe(derived);
    },
  );
  it.each([[0, 0], [4, 4], [5, 8], [7, 10], [9, 16], [13, 20]])(
    'converte derivado %s para mídia %s', (derived, media) => {
      expect(derivedToMedia(derived, cuts)).toBe(media);
    },
  );
  it('atravessa cortes adjacentes no mesmo salto', () => {
    const adjacent = [{ start: 0, end: 2 }, { start: 2, end: 5 }, { start: 8, end: 9 }];
    expect(derivedToMedia(0, adjacent)).toBe(5);
    expect(mediaToDerived(3, adjacent)).toBe(0);
    expect(derivedToMedia(3, adjacent)).toBe(9);
    expect(mediaToDerived(9, adjacent)).toBe(3);
  });
  it('ordena e une os cortes sem alterar a entrada', () => {
    const input = [{ start: 8, end: 10 }, { start: 2, end: 5 }, { start: 5, end: 9 }];
    expect(normalizeCuts(input)).toEqual([{ start: 2, end: 10 }]);
    expect(input[1].end).toBe(5);
  });
  it('não muda tempos sem cortes', () => {
    expect(mediaToDerived(12, [])).toBe(12);
    expect(derivedToMedia(12, [])).toBe(12);
  });
  it('tolera atraso no seek e permite revisitar o mesmo corte', () => {
    const seek = vi.fn();
    const clock = createCutClock(cuts, seek);
    expect(clock.sample(4.9)).toBe(5);
    expect(seek).toHaveBeenLastCalledWith(8);
    expect(clock.sample(5.1)).toBe(5);
    expect(clock.sample(5.2)).toBe(5);
    expect(clock.sample(7.9)).toBe(5);
    expect(seek).toHaveBeenCalledTimes(1);
    expect(clock.sample(8.2)).toBeCloseTo(5.2);
    clock.seek(4);
    expect(seek).toHaveBeenLastCalledWith(4);
    clock.sample(4);
    clock.sample(5);
    expect(seek).toHaveBeenLastCalledWith(8);
    expect(seek).toHaveBeenCalledTimes(3);
  });
  it('ignora o tempo anterior enquanto um seek para trás ainda não foi confirmado', () => {
    const seek = vi.fn();
    const clock = createCutClock(cuts, seek);
    clock.seek(2);
    expect(clock.sample(10)).toBe(2);
    expect(clock.sample(2.1)).toBeCloseTo(2.1);
    expect(seek).toHaveBeenCalledOnce();
  });
  it('retenta um salto sem confirmação apenas após o prazo', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    try {
      const seek = vi.fn();
      const clock = createCutClock(cuts, seek);
      clock.sample(5);
      now.mockReturnValue(1400);
      clock.sample(5);
      expect(seek).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1600);
      clock.sample(5);
      expect(seek).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });
  it('não pula quando pausado e converte seeks para depois dos cortes', () => {
    const seek = vi.fn();
    const clock = createCutClock(cuts, seek);
    expect(clock.sample(6, false)).toBe(5);
    expect(seek).not.toHaveBeenCalled();
    clock.seek(9);
    expect(seek).toHaveBeenCalledWith(16);
  });
});
