import type { CSSProperties } from 'react';

// Largura média de um caractere monoespaçado em relação ao tamanho da fonte, com folga.
const CHAR_WIDTH_EM = 0.62;

/**
 * Fonte do nome do acorde que cabe numa linha da coluna do painel: "F#m7(11)" quebrava
 * em "F#m7(11" e ")" com a fonte fixa. O slot precisa de container-type: inline-size.
 */
export function chordNameFit(name: string, maxPx: number): CSSProperties {
  const chars = Math.max([...name].length, 1);
  return {
    fontSize: `min(${maxPx}px, calc(100cqw / ${(chars * CHAR_WIDTH_EM).toFixed(2)}))`,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };
}
