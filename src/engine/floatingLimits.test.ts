import { describe, expect, it } from 'vitest';
import { floatingMaxY } from './floatingLimits';

const bar = { left: 8, right: 491, top: 500 };

describe('limite da janela flutuante', () => {
  it('para acima da barra da rolagem', () => {
    expect(floatingMaxY(20, 300, 200, 760, [bar], 8)).toBe(292);
  });
  it('desce até o pé quando a barra está em outra faixa', () => {
    expect(floatingMaxY(20, 300, 200, 760, [{ left: 800, right: 1200, top: 500 }], 8)).toBe(552);
  });
  it('sem espaço acima fica no topo, nunca fora da tela', () => {
    expect(floatingMaxY(0, 300, 600, 760, [bar], 8)).toBe(8);
  });
});
