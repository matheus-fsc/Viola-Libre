import { describe, expect, it } from 'vitest';
import { scrubTime } from './melodyScrub';

describe('arraste da melodia', () => {
  it('puxar a tablatura para a esquerda avança a música', () => {
    expect(scrubTime({ time: 10, scale: 70, contentFollows: true }, -140, 200)).toBe(12);
    expect(scrubTime({ time: 10, scale: 70, contentFollows: true }, 70, 200)).toBe(9);
  });
  it('na voz o cursor segue o dedo', () => {
    expect(scrubTime({ time: 10, scale: 100, contentFollows: false }, 50, 200)).toBe(10.5);
  });
  it('não sai da música nem divide por zero', () => {
    expect(scrubTime({ time: 1, scale: 10, contentFollows: true }, 500, 200)).toBe(0);
    expect(scrubTime({ time: 199, scale: 10, contentFollows: true }, -500, 200)).toBe(200);
    expect(scrubTime({ time: 5, scale: 0, contentFollows: true }, 50, 200)).toBe(5);
  });
});
