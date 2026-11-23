import { describe, expect, it } from 'vitest';
import { buildChordTimeline, chordStripAtTime } from './upcomingChords';
import { buildScrollTimeline, type ScrollSegment } from './scrollTimeline';

const lyric = (lineIndex: number, startTime = 10, endTime = 20): ScrollSegment => ({
  lineIndex, endLine: lineIndex, startTime, endTime, kind: 'lyric', instrumental: false,
});

describe('faixa temporal de acordes', () => {
  it('usa os tempos exatos no instrumental e conserva as colunas da letra', () => {
    const segment: ScrollSegment = { ...lyric(0, 0, 10), endLine: 2, kind: 'instrumental', instrumental: true };
    const aligned = (time: number, lineIndex: number, chordIndex: number) => ({ time, lineIndex, chordIndex, chord: 'C', confidence: 0.95 });
    const events = buildChordTimeline([segment, lyric(4, 10, 20)], ['D E', '', 'F', 'G    A', 'abcdefghij'], [
      aligned(8, 2, 0), aligned(1.2, 0, 0), aligned(3.7, 0, 1),
      aligned(12, 3, 1), aligned(4, 0, 9), aligned(5, 1, 0), aligned(10, 0, 0),
    ]);
    expect(events.map(c => [c.name, c.startTime])).toEqual([['D', 1.2], ['E', 3.7], ['F', 8], ['G', 10], ['A', 15]]);
    expect(events[2]).toMatchObject({ lineIndex: 2, chordIndex: 0 });
    expect(chordStripAtTime(events, 7)).toMatchObject({ previous: { name: 'D' }, current: { name: 'E' },
      next: { name: 'F', startTime: 8 }, startsIn: 1 });
    expect(buildChordTimeline([segment], ['D E'], [aligned(11, 0, 0)]).map(c => c.startTime)).toEqual([0, 5]);
  });

  it('mantém cada ocorrência da introdução cíclica mesmo repetindo o mesmo acorde', () => {
    const segment: ScrollSegment = { ...lyric(0, 0, 12), endLine: 1, kind: 'instrumental', instrumental: true };
    const chordTimes = [
      { time: 0.5, lineIndex: 0, chordIndex: 0, chord: 'C', confidence: 1 },
      { time: 2, lineIndex: 0, chordIndex: 1, chord: 'G', confidence: 1 },
      { time: 4, lineIndex: 1, chordIndex: 0, chord: 'C', confidence: 1 },
      { time: 6, lineIndex: 0, chordIndex: 0, chord: 'C', confidence: 1 },
      { time: 8.5, lineIndex: 0, chordIndex: 1, chord: 'G', confidence: 1 },
      { time: 11, lineIndex: 1, chordIndex: 0, chord: 'C', confidence: 1 },
    ];
    const events = buildChordTimeline([segment, { ...segment, startTime: 20, endTime: 32 }], ['C G', 'C'],
      [...chordTimes, ...chordTimes.map(c => ({ ...c, time: c.time + 20 }))]);
    expect(events.map(c => [c.startTime, c.lineIndex, c.chordIndex]))
      .toEqual([...chordTimes, ...chordTimes.map(c => ({ ...c, time: c.time + 20 }))].map(c => [c.time, c.lineIndex, c.chordIndex]));
    expect(chordStripAtTime(events, 6)).toMatchObject({ previous: { lineIndex: 1 }, current: { lineIndex: 0 }, startsIn: 2.5 });
    expect(chordStripAtTime(events, 1)).toMatchObject({ current: { startTime: 0.5 }, startsIn: 1 });
  });

  it('distribui pelas colunas usando a maior largura entre letra e harmonia', () => {
    expect(buildChordTimeline([lyric(1)], ['C    G', 'abcdefghij'])).toEqual([
      { name: 'C', startTime: 10 }, { name: 'G', startTime: 15 },
    ]);
    const events = buildChordTimeline([lyric(1)], ['C    G', 'abc']);
    expect(events[1].startTime).toBeCloseTo(10 + 5 / 6 * 10);
  });

  it('conserva F7 na letra sem acordes, nos intervalos e após o fim', () => {
    const segments = buildScrollTimeline({ phrases: [lyric(1), lyric(2, 22, 25)], instrumentalSections: [], duration: 30 });
    const events = buildChordTimeline(segments, ['F7', 'fim da frase', 'CARNIÇA']);
    for (const time of [10, 19, 21, 23, 40]) expect(chordStripAtTime(events, time).current?.name).toBe('F7');
    expect(events).toHaveLength(1);
  });

  it('não toma emprestado um acorde através de linha vazia', () => {
    expect(buildChordTimeline([lyric(2)], ['G7', '', 'outra letra'])).toEqual([]);
  });

  it('segue a repetição do transporte e anuncia o primeiro acorde do refrão de novo', () => {
    const timeline = buildScrollTimeline({ phrases: [lyric(1), lyric(3, 20, 30), lyric(1, 30, 40), lyric(3, 40, 50)], instrumentalSections: [] });
    const events = buildChordTimeline(timeline, ['C', 'primeira frase', 'G7', 'segunda frase']);
    expect(events.map(c => [c.name, c.startTime])).toEqual([['C', 10], ['G7', 20], ['C', 30], ['G7', 40]]);
    expect(chordStripAtTime(events, 29)).toMatchObject({ current: { name: 'G7' }, next: { name: 'C', startTime: 30 }, startsIn: 1 });
  });

  it('espalha todos os acordes de um instrumental de modo uniforme', () => {
    const events = buildChordTimeline([{ ...lyric(0, 4, 12), kind: 'instrumental', instrumental: true, endLine: 3 }],
      ['( C    Dm )', '', 'G7', 'F7']);
    expect(events.map(c => [c.name, c.startTime])).toEqual([['C', 4], ['Dm', 6], ['G7', 8], ['F7', 10]]);
  });

  it('colapsa apenas acordes idênticos consecutivos, inclusive aliases', () => {
    const events = buildChordTimeline([lyric(1), lyric(3, 20, 30)], ['C C G G', 'letra', 'G C', 'outra letra']);
    expect(events.map(c => c.name)).toEqual(['C', 'G', 'C']);
    expect(buildChordTimeline([lyric(1)], ['F#m Gbm F#7', 'letra longa']).map(c => c.name)).toEqual(['F#m', 'F#7']);
  });

  it('recalcula os três lugares ao buscar para trás, inclusive antes do primeiro acorde', () => {
    const events = buildChordTimeline([lyric(1)], ['C   G7   F7', 'abcdefghij']);
    expect(chordStripAtTime(events, 19)).toMatchObject({ previous: { name: 'G7' }, current: { name: 'F7' }, next: null });
    expect(chordStripAtTime(events, 10)).toMatchObject({ previous: null, current: { name: 'C' }, next: { name: 'G7' } });
    expect(chordStripAtTime(events, 0)).toEqual({ previous: null, current: null, next: events[0], startsIn: 10 });
    expect(chordStripAtTime([], 0)).toEqual({ previous: null, current: null, next: null, startsIn: null });
  });
});

describe('harmonia durante instrumentais no meio da música', () => {
  const lines = ['C', 'Primeira letra', '[Solo]', 'G D', 'Am', 'F', 'Segunda letra', 'E', 'Próxima letra'];
  const timeline = buildScrollTimeline({ phrases: [
    { lineIndex: 1, startTime: 0, endTime: 10 },
    { lineIndex: 6, startTime: 20, endTime: 30 },
    { lineIndex: 8, startTime: 40, endTime: 50 },
  ], instrumentalSections: [
    { label: 'Solo', startLine: 2, endLine: 4, mediaTimestampStart: 10, mediaTimestampEnd: 20 },
    { label: 'Instrumental', startLine: null, endLine: null, mediaTimestampStart: 30, mediaTimestampEnd: 40 },
  ] });
  const chords = buildChordTimeline(timeline, lines);

  it('mostra todos os acordes do solo na ordem escrita', () => {
    expect(chords.filter(c => c.startTime >= 10 && c.startTime < 20).map(c => c.name)).toEqual(['G', 'D', 'Am']);
  });

  it('mantém o último acorde e anuncia o primeiro acorde da próxima frase na pausa', () => {
    expect(chords.filter(c => c.startTime >= 30 && c.startTime < 40)).toEqual([]);
    expect(chordStripAtTime(chords, 35)).toMatchObject({ current: { name: 'F' }, next: { name: 'E', startTime: 40 }, startsIn: 5 });
  });

  it('anuncia a retomada mesmo quando a letra começa com o mesmo acorde anterior à pausa', () => {
    const timeline = buildScrollTimeline({ phrases: [
      { lineIndex: 1, startTime: 0, endTime: 10 },
      { lineIndex: 3, startTime: 20, endTime: 30 },
    ], instrumentalSections: [
      { label: 'Riff', startLine: null, endLine: null, mediaTimestampStart: 10, mediaTimestampEnd: 20 },
    ] });
    const chords = buildChordTimeline(timeline, ['C', 'Antes', 'C', 'Depois']);
    expect(chordStripAtTime(chords, 15)).toMatchObject({ current: { name: 'C', startTime: 0 }, next: { name: 'C', startTime: 20 } });
  });
});
