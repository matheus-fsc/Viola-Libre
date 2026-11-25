export interface BarRect { left: number; right: number; top: number }

/**
 * Até onde a janela flutuante desce sem cobrir uma barra fixa do pé da tela. Só contam as
 * barras na mesma faixa horizontal: ao lado do transporte do desktop ela desce até o fim.
 */
export function floatingMaxY(x: number, width: number, height: number, floor: number, bars: readonly BarRect[], margin: number): number {
  const tops = bars.filter(bar => x < bar.right && x + width > bar.left).map(bar => bar.top);
  return Math.max(margin, Math.min(floor, ...tops) - height - margin);
}
