import { describe, expect, it } from 'vitest';
import { buildScrollTimeline, timelineBarSegments, type ScrollSegment } from './scrollTimeline';
import { segmentChords, upcomingChords } from './upcomingChords';

const segment = (startTime: number, endTime: number, lineIndex = 1): ScrollSegment => ({
  startTime, endTime, lineIndex, endLine: lineIndex, kind: 'lyric', instrumental: false,
});

describe('barra do transporte', () => {
  it('conserva o deslocamento inicial e as lacunas no mesmo relógio do cursor', () => {
    expect(timelineBarSegments([segment(10, 20), segment(40, 100)], 100)).toEqual([
      { leftPct: 10, widthPct: 10, kind: 'lyric' },
      { leftPct: 40, widthPct: 60, kind: 'lyric' },
    ]);
    const timeline = buildScrollTimeline({ audioStart: 10, duration: 100,
      phrases: [segment(20, 100)], instrumentalSections: [
        { label: 'Intro', startLine: 0, endLine: 1, mediaTimestampStart: 10, mediaTimestampEnd: 20 },
      ] });
    expect(timelineBarSegments(timeline, 100)[1]).toEqual({ leftPct: 10, widthPct: 10, kind: 'instrumental' });
    const last = timelineBarSegments(timeline, 100).at(-1)!;
    expect(last.leftPct + last.widthPct).toBe(100);
  });

  it('limita os extremos e descarta durações ou intervalos inválidos', () => {
    expect(timelineBarSegments([segment(-10, 20), segment(90, 120), segment(110, 120),
      segment(30, 20), segment(NaN, 50), segment(20, Infinity)], 100)).toEqual([
      { leftPct: 0, widthPct: 20, kind: 'lyric' }, { leftPct: 90, widthPct: 10, kind: 'lyric' },
    ]);
    for (const total of [0, -1, NaN, Infinity]) expect(timelineBarSegments([segment(0, 10)], total)).toEqual([]);
  });
});

describe('acordes na ordem de execução', () => {
  const lines = ['[Refrão]', 'G  D/F#', 'Primeira frase', 'Am7 | D7', 'Última frase', '[Solo]', 'C  G', 'D7'];
  const timeline = [segment(10, 15, 2), segment(15, 20, 4), segment(20, 25, 2), segment(25, 30, 4)];

  it('volta ao início do refrão depois da última frase quando a timeline repete', () => {
    expect(upcomingChords(timeline, lines, 17, 3)).toEqual([
      { lineIndex: 2, chords: ['G', 'D/F#'], startsIn: 3 },
      { lineIndex: 4, chords: ['Am7', 'D7'], startsIn: 8 },
    ]);
    expect(upcomingChords(timeline, lines, 15, 1)[0].lineIndex).toBe(2);
    expect(upcomingChords(timeline, lines, 30, 3)).toEqual([]);
  });

  it('extrai toda a seção instrumental e ignora esperas na previsão', () => {
    const solo = { ...segment(30, 40, 5), endLine: 7, kind: 'instrumental' as const, instrumental: true };
    expect(segmentChords(solo, lines)).toEqual(['C', 'G', 'D7']);
    expect(upcomingChords([{ ...segment(20, 30, 4), kind: 'hold' }, solo], lines, 19, 3))
      .toEqual([{ lineIndex: 5, chords: ['C', 'G', 'D7'], startsIn: 11 }]);
  });

  it('não herda acordes de outra letra ou seção e aceita frases sem acordes', () => {
    expect(segmentChords(segment(0, 5, 2), ['G', 'Outra letra', 'Letra atual'])).toEqual([]);
    expect(segmentChords(segment(0, 5, 2), ['G', '[Verso]', 'Letra atual'])).toEqual([]);
    expect(segmentChords(segment(0, 5, 2), ['Bb7', '', 'Letra atual'])).toEqual(['Bb7']);
    expect(upcomingChords(timeline, lines, 0, 0)).toEqual([]);
    expect(segmentChords(segment(0, 5, 1000), lines)).toEqual([]);
    expect(segmentChords(segment(0, 5, -1), lines)).toEqual([]);
  });

  it('usa as linhas já transpostas e os tempos encurtados fornecidos pelo modo sem dedilhado', () => {
    const shortened = [segment(0, 4, 2), segment(4, 8, 4), segment(8, 12, 2)];
    const transposed = ['[Refrão]', 'A E/G#', 'Primeira frase', 'Bm7 E7', 'Última frase'];
    expect(upcomingChords(shortened, transposed, 6, 1))
      .toEqual([{ lineIndex: 2, chords: ['A', 'E/G#'], startsIn: 2 }]);
    expect(timelineBarSegments(shortened, 12).at(-1)?.leftPct).toBeCloseTo(100 * 8 / 12);
  });
});
