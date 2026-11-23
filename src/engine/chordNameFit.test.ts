import { describe, expect, it } from 'vitest';
import { chordNameFit } from './chordNameFit';

describe('chordNameFit', () => {
  it('nomes curtos ficam no tamanho máximo, sem quebra', () => {
    const style = chordNameFit('A7M', 18);
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.fontSize).toBe('min(18px, calc(100cqw / 1.86))');
  });

  it('nomes longos encolhem pela largura da coluna', () => {
    expect(chordNameFit('F#m7(11)', 18).fontSize).toBe('min(18px, calc(100cqw / 4.96))');
    expect(chordNameFit('C#m7(9/11)/G#', 14).fontSize).toBe('min(14px, calc(100cqw / 8.06))');
  });
});
