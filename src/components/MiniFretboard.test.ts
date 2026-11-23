import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MiniFretboard } from './MiniFretboard';
import { buildVoicingFromFrets } from '../engine/chordCalculator';

// Conferir coordenadas do SVG protege a redução proporcional usada na coluna lateral.
describe('geometria do diagrama compacto', () => {
  it.each([
    [0, 2, 2, 1, 0, 0], [12, 14, 12, 13, 12, 12], [0, 2, 10, 1, -1, 0],
    [12, 14, 12, 13, 12], [7, 9, 8, 7],
  ])('mantém todos os dedos e marcadores dentro do SVG: %j', (...frets) => {
    const tuning = { id: 'teste', name: 'Teste', strings: frets.map((_, index) => 40 + index * 5) };
    const voicing = buildVoicingFromFrets(frets, tuning);
    for (const forceInverted of [false, true]) {
      const svg = renderToStaticMarkup(createElement(MiniFretboard, { voicing, tuning, forceInverted }));
      const [, width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.map(Number);
      const circles = [...svg.matchAll(/<circle\s[^>]*>/g)];
      expect(circles).toHaveLength(frets.filter(fret => fret >= 0).length);
      for (const [tag] of circles) {
        const attr = (name: string) => Number(tag.match(new RegExp(` ${name}="([\\d.]+)"`))?.[1]);
        const x = attr('cx'), y = attr('cy'), radius = attr('r') + 0.6;
        expect(x - radius).toBeGreaterThanOrEqual(0);
        expect(x + radius).toBeLessThanOrEqual(width);
        expect(y - radius).toBeGreaterThanOrEqual(0);
        expect(y + radius).toBeLessThanOrEqual(height);
      }
      if (Math.min(...frets.filter(fret => fret > 0)) >= 10) {
        expect(svg).toContain('>12</text>');
      }
    }
  });

  it('ignora uma forma antiga de outro instrumento', () => {
    const tuning = { id: 'teste', name: 'Teste', strings: [40, 45, 50, 55, 59, 64] };
    const voicing = buildVoicingFromFrets([0, 2, 2, 1, 0, 0], tuning);
    expect(renderToStaticMarkup(createElement(MiniFretboard, { voicing, tuning: { ...tuning, strings: [45, 50, 55, 59] } }))).toBe('');
  });
});
