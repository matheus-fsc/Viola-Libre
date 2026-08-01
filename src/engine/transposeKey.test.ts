import { describe, expect, it } from 'vitest';
import { shortestTranspose } from './transposeKey';

describe('shortestTranspose', () => {
  it('deixa quem já está na volta curta em paz', () => {
    for (const n of [-5, -3, -1, 0, 1, 4, 6]) {
      expect(shortestTranspose(n)).toBe(n);
    }
  });

  it('traz a subida longa para a descida curta', () => {
    expect(shortestTranspose(7)).toBe(-5);   // subir 7 == descer 5
    expect(shortestTranspose(11)).toBe(-1);
  });

  it('traz a descida longa para a subida curta', () => {
    expect(shortestTranspose(-7)).toBe(5);
    expect(shortestTranspose(-11)).toBe(1);
  });

  it('leva a oitava a zero, em qualquer direção', () => {
    expect(shortestTranspose(12)).toBe(0);
    expect(shortestTranspose(-12)).toBe(0);
    expect(shortestTranspose(24)).toBe(0);
  });

  it('desempata o trítono para cima', () => {
    expect(shortestTranspose(6)).toBe(6);
    expect(shortestTranspose(-6)).toBe(6);
  });

  it('sobrevive a voltas múltiplas, que é o que o botão de +½ repetido produz', () => {
    expect(shortestTranspose(25)).toBe(1);
    expect(shortestTranspose(-25)).toBe(-1);
  });

  it('cai sempre dentro de [-5, +6]', () => {
    for (let n = -40; n <= 40; n++) {
      const r = shortestTranspose(n);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThanOrEqual(6);
    }
  });
});
