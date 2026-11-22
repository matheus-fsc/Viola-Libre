import { describe, expect, it } from 'vitest';
import { buildScrollTimeline, instrumentalCountdown, timelineIndexAtTime, timelineYAtTime } from './scrollTimeline';
import { getRepeatRanges, repeatPassAtTime } from './repeatRanges';

const phrases = [27, 29, 32, 34, 27, 29, 32, 34, 38].map((lineIndex, i) => ({
  lineIndex, startTime: 10 + i * 5, endTime: 13 + i * 5,
}));
const instrumentalSections = [
  { label: 'Introdução', startLine: 0, endLine: 8, mediaTimestampStart: 2, mediaTimestampEnd: 10 },
  { label: 'Final', startLine: 40, endLine: 45, mediaTimestampStart: 55, mediaTimestampEnd: 60 },
];
const timeline = buildScrollTimeline({ phrases: [...phrases].reverse(), instrumentalSections, duration: 65, audioStart: 2 });
const at = (time: number) => timeline[timelineIndexAtTime(timeline, time)];

describe('timeline de rolagem', () => {
  it('preserva cada passagem pelo refrão e permite buscar qualquer instante fora de ordem', () => {
    for (const i of [7, 0, 8, 4, 1, 6, 2, 5, 3]) {
      const phrase = phrases[i];
      expect(at(phrase.startTime + 1)).toMatchObject({ lineIndex: phrase.lineIndex, kind: 'lyric' });
    }
    const anchors = timeline.map(s => ({ ...s, y: s.lineIndex * 20 }));
    expect(timelineYAtTime(anchors, 29)).toBe(34 * 20);
    expect(timelineYAtTime(anchors, 30)).toBe(27 * 20);
  });

  it('ancora intervalos instrumentais na primeira linha e conserva sua faixa inteira', () => {
    expect(at(2)).toMatchObject({ lineIndex: 0, endLine: 8, instrumental: true });
    expect(at(9.99).label).toBe('Introdução');
    expect(at(10).kind).toBe('lyric');
    expect(at(59)).toMatchObject({ label: 'Final', lineIndex: 40, endLine: 45 });
  });

  it('preenche lacunas e extremos sem depender do histórico de reprodução', () => {
    expect(at(-5)).toMatchObject({ kind: 'hold', lineIndex: 0 });
    expect(at(0).lineIndex).toBe(0);
    expect(at(14)).toMatchObject({ kind: 'hold', lineIndex: 27 });
    expect(at(54)).toMatchObject({ kind: 'hold', lineIndex: 38 });
    expect(at(60)).toMatchObject({ kind: 'hold', lineIndex: 40 });
    expect(at(500).lineIndex).toBe(40);
    expect(timelineIndexAtTime([], 10)).toBe(-1);
    expect(buildScrollTimeline({ phrases: [], instrumentalSections: [] })).toEqual([]);
  });

  it('prioriza seções sobre frases sobrepostas e recupera a letra restante', () => {
    const overlapping = buildScrollTimeline({
      phrases: [{ lineIndex: 12, startTime: 0, endTime: 20 }],
      instrumentalSections: [{ ...instrumentalSections[0], mediaTimestampStart: 5, mediaTimestampEnd: 10 }],
    });
    expect(overlapping[timelineIndexAtTime(overlapping, 7)].kind).toBe('instrumental');
    expect(overlapping[timelineIndexAtTime(overlapping, 11)].lineIndex).toBe(12);
    expect(overlapping.every((s, i) => !i || s.startTime === overlapping[i - 1].endTime)).toBe(true);
  });

  it('mantém um único segmento instrumental quando há frases antigas dentro dele', () => {
    const segments = buildScrollTimeline({ phrases: [
      { lineIndex: 3, startTime: 4, endTime: 6 },
      { lineIndex: 9, startTime: 12, endTime: 15 },
    ], instrumentalSections: [instrumentalSections[0]] });
    expect(segments.filter(s => s.instrumental)).toEqual([
      { startTime: 2, endTime: 10, lineIndex: 0, endLine: 8, kind: 'instrumental', instrumental: true, label: 'Introdução' },
    ]);
    expect(instrumentalCountdown(segments, 5)).toBe(7);
  });

  it('ignora intervalos inválidos e suporta somente instrumental ou somente letra', () => {
    expect(buildScrollTimeline({ phrases: [{ lineIndex: 1, startTime: NaN, endTime: 2 }],
      instrumentalSections: [{ ...instrumentalSections[0], startLine: null }] })).toEqual([]);
    expect(buildScrollTimeline({ phrases: [], instrumentalSections }).at(-1)?.label).toBe('Final');
    expect(buildScrollTimeline({ phrases, instrumentalSections: [] })[0]).toMatchObject({ kind: 'hold', lineIndex: 27 });
  });

  it('mantém a passagem do badge no mesmo relógio das ocorrências', () => {
    const ranges = getRepeatRanges([], phrases);
    expect(repeatPassAtTime(ranges, 11)).toEqual({ pass: 1, count: 2 });
    expect(repeatPassAtTime(ranges, 31)).toEqual({ pass: 2, count: 2 });
    expect(repeatPassAtTime(ranges, 51)).toBeNull();
  });
});

describe('contagem para a próxima letra', () => {
  it('arredonda para cima e não mostra contagem no final, lacunas ou letra', () => {
    expect(instrumentalCountdown(timeline, 2)).toBe(8);
    expect(instrumentalCountdown(timeline, 8.1)).toBe(2);
    expect(instrumentalCountdown(timeline, 9.9)).toBe(1);
    for (const time of [-1, 0, 10, 14, 56, 65, 100]) expect(instrumentalCountdown(timeline, time)).toBeNull();
  });
});
