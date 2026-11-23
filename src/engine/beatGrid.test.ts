import { describe, expect, it } from 'vitest';
import { normalizeBeatGrid, normalizeContribution } from '../services/timingApi';
import { beatProgress, beatScrollYAtTime, buildScrollTimeline, countInAtTime, pulseAtTime, trustedBeats } from './scrollTimeline';
import { cutBeatTimes } from './mediaCuts';
import { buildCommunityCards } from './timingVariants';

const beats = Array.from({ length: 25 }, (_, i) => i * 0.5);
const grid = { beats, downbeats: [0, 2, 4, 6, 8, 10, 12], beatConfidence: 0.5, timeSignature: '4/4' as const };
const timeline = buildScrollTimeline({ phrases: [
  { lineIndex: 0, startTime: 0, endTime: 2 },
  { lineIndex: 2, startTime: 6, endTime: 9 },
], instrumentalSections: [] });

describe('grade de pulsos', () => {
  it('interpola com suavização em cada pulso irregular e prende os extremos', () => {
    expect(beatProgress(-1, [1, 2, 4])).toBe(0);
    expect(beatProgress(1.25, [1, 2, 4])).toBeCloseTo(0.15625);
    expect(beatProgress(2, [1, 2, 4])).toBe(1);
    expect(beatProgress(3, [1, 2, 4])).toBe(1.5);
    expect(beatProgress(8, [1, 2, 4])).toBe(2);
    expect(beatProgress(1, [])).toBe(0);
    expect(beatProgress(NaN, beats)).toBe(0);
  });

  it('usa pulsos para mover frases longas e mantém o comportamento sem grade, nas lacunas e nas voltas', () => {
    const anchors = [
      { startTime: 0, endTime: 4, y: 0, kind: 'lyric' as const },
      { startTime: 4, endTime: 8, y: 100, kind: 'instrumental' as const },
      { startTime: 8, endTime: 10, y: 200 },
    ];
    expect(beatScrollYAtTime(anchors, 1.125, beats)).toBeCloseTo(26.953125);
    expect(beatScrollYAtTime(anchors, 6, beats)).toBe(150);
    expect(beatScrollYAtTime(anchors, 1, [])).toBe(0);
    expect(beatScrollYAtTime([{ ...anchors[0], kind: 'hold' }, anchors[1]], 2, beats)).toBe(0);
    expect(beatScrollYAtTime([anchors[1], { ...anchors[2], y: 0 }], 6, beats)).toBe(100);
  });

  it('conta 4/4 na última barra da lacuna, inclusive após busca para trás', () => {
    for (const time of [0, 2, 3.99, 6, 7, 15]) expect(countInAtTime(timeline, time, grid)).toBeNull();
    for (const [time, beat] of [[4, 1], [4.5, 2], [5.99, 4], [5, 3], [4, 1]]) {
      expect(countInAtTime(timeline, time, grid)).toEqual({ beat, total: 4 });
    }
    expect(countInAtTime(timeline, 5, { ...grid, beatConfidence: 0.49 })).toBeNull();
    expect(countInAtTime(timeline, 5)).toBeNull();
  });

  it('mantém o início do compasso medido quando a entrada vocal cai entre pulsos', () => {
    const offbeat = buildScrollTimeline({ phrases: [
      { lineIndex: 0, startTime: 0, endTime: 2 },
      { lineIndex: 2, startTime: 6.25, endTime: 9 },
    ], instrumentalSections: [] });
    expect(countInAtTime(offbeat, 4, grid)).toEqual({ beat: 1, total: 4 });
    expect(countInAtTime(offbeat, 5.5, grid)).toEqual({ beat: 4, total: 4 });
    expect(countInAtTime(offbeat, 6.25, grid)).toBeNull();
  });

  it('conta 3/4 após instrumental e encerra exatamente na entrada vocal', () => {
    const segments = buildScrollTimeline({ phrases: [{ lineIndex: 2, startTime: 6, endTime: 9 }],
      instrumentalSections: [{ label: 'Solo', startLine: null, endLine: null, mediaTimestampStart: 0, mediaTimestampEnd: 6 }] });
    const triple = { ...grid, timeSignature: '3/4' as const, downbeats: [0, 1.5, 3, 4.5, 6] };
    expect(countInAtTime(segments, 4.49, triple)).toBeNull();
    expect(countInAtTime(segments, 4.5, triple)).toEqual({ beat: 1, total: 3 });
    expect(countInAtTime(segments, 5, triple)).toEqual({ beat: 2, total: 3 });
    expect(countInAtTime(segments, 5.99, triple)).toEqual({ beat: 3, total: 3 });
    expect(countInAtTime(segments, 6, triple)).toBeNull();
    const short = buildScrollTimeline({ phrases: [{ lineIndex: 0, startTime: 0, endTime: 5 }, { lineIndex: 2, startTime: 6, endTime: 8 }], instrumentalSections: [] });
    expect(countInAtTime(short, 5.5, grid)).toBeNull();
  });

  it('marca o pulso e o compasso apenas com confiança suficiente', () => {
    expect(pulseAtTime(4, grid)).toMatchObject({ bar: 3, strong: true, lit: true });
    expect(pulseAtTime(4.3, grid)?.lit).toBe(false);
    expect(pulseAtTime(4.5, grid)?.strong).toBe(false);
    expect(pulseAtTime(-1, grid)).toBeNull();
    expect(pulseAtTime(13, grid)).toBeNull();
    expect(trustedBeats({ ...grid, beatConfidence: 0.49 })).toEqual([]);
  });

  it('normaliza sem mutar a entrada e descarta campos malformados', () => {
    const raw = { beats: [2, 0, 1, 1], downbeats: [2, 0], timeSignature: '3/4', beatConfidence: 1, bpmSource: 'audio' };
    expect(normalizeBeatGrid(raw)).toEqual({ ...raw, beats: [0, 1, 2], downbeats: [0, 2] });
    expect(raw.beats).toEqual([2, 0, 1, 1]);
    for (const value of [null, 'bad', [0, NaN], [0, Infinity], [0, -1], [0, '1'], []]) {
      expect(normalizeBeatGrid({ beats: value })).not.toHaveProperty('beats');
    }
    for (const value of [-1, 1.1, NaN, Infinity, '0.8']) expect(normalizeBeatGrid({ beatConfidence: value })).toEqual({});
    expect(normalizeBeatGrid({ timeSignature: '6/8', bpmSource: 'guess' })).toEqual({});
    expect(normalizeContribution({ id: 'a', duration: 10, ...grid, bpmSource: 'audio', bpm: 120 })).toMatchObject({ ...grid, bpm: 120, bpmSource: 'audio' });
    expect(normalizeContribution({ id: 'a', duration: 10, bpm: NaN }).bpm).toBe(0);
  });

  it('descarta pulsos nos cortes e desloca a grade da variante sem dedilhado', () => {
    expect(cutBeatTimes([0, 2, 3, 4, 8, 9, 10], [{ start: 2, end: 4 }, { start: 8, end: 9 }])).toEqual([0, 2, 6, 7]);
    const original = normalizeContribution({ id: 'a', duration: 12, source: 'auto', ...grid, bpm: 120, bpmSource: 'audio',
      phrases: [{ lineIndex: 0, startTime: 0, endTime: 2 }, { lineIndex: 2, startTime: 6, endTime: 9 }] });
    const cards = buildCommunityCards([original], ['lyric', 'tab', 'lyric']);
    expect(cards[1].timing).toMatchObject({ beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8], downbeats: [0, 2, 4, 6, 8], beatConfidence: 0.5, bpmSource: 'audio', bpm: 120 });
    expect(original.beats).toEqual(beats);
  });
});
