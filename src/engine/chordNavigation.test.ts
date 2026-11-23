import { describe, expect, it } from 'vitest';
import { chordStepTarget, INITIAL_WHEEL_STATE, touchStepFromDrag, wheelAccumulator } from './chordNavigation';
import { buildChordTimeline, chordStripAtTime } from './upcomingChords';
import { buildScrollTimeline } from './scrollTimeline';
import { createCutClock } from './mediaCuts';

const segments = buildScrollTimeline({ phrases: [
  { lineIndex: 1, startTime: 4, endTime: 12 },
  { lineIndex: 3, startTime: 12, endTime: 20 },
  { lineIndex: 1, startTime: 20, endTime: 28 },
  { lineIndex: 3, startTime: 28, endTime: 36 },
], instrumentalSections: [] });
const timeline = buildChordTimeline(segments, ['C   G', 'abcdefgh', 'Am  F', 'abcdefgh']);

describe('navegação na mesma timeline do painel', () => {
  it('segue cada acorde e atravessa as repetições em ordem temporal', () => {
    expect(timeline.map(chord => chord.startTime)).toEqual([4, 8, 12, 16, 20, 24, 28, 32]);
    const repeated = chordStepTarget(timeline, 16, 1)!;
    expect(repeated).toMatchObject({ name: 'C', startTime: 20, occurrenceStart: 20 });
    expect(chordStepTarget(timeline, repeated.startTime, -1)).toBe(timeline[3]);
    expect(chordStripAtTime(timeline, repeated.startTime)).toMatchObject({
      previous: timeline[3], current: repeated, next: timeline[5],
    });
  });

  it('avança ou recua uma ocorrência de frase sem confundir o refrão repetido', () => {
    expect(chordStepTarget(timeline, 8, 1, 'line')).toBe(timeline[2]);
    expect(chordStepTarget(timeline, 16, 1, 'line')).toBe(timeline[4]);
    expect(chordStepTarget(timeline, 25, -1, 'line')).toBe(timeline[2]);
    expect(chordStepTarget(timeline, 20, -1, 'line')).toBe(timeline[2]);
  });

  it('mantém os limites e trata tempos anteriores e posteriores à gravação', () => {
    expect(chordStepTarget([], 0, 1)).toBeNull();
    expect(chordStepTarget(timeline, NaN, 1)).toBeNull();
    for (const unit of ['line', 'chord'] as const) {
      expect(chordStepTarget(timeline, 0, 1, unit)).toBe(timeline[0]);
      expect(chordStepTarget(timeline, 4, -1, unit)).toBe(timeline[0]);
      expect(chordStepTarget(timeline, 40, 1, unit)).toBe(timeline[7]);
    }
    expect(chordStepTarget(timeline, 7, -1)).toBe(timeline[0]);
    expect(chordStepTarget(timeline, 7, 1)).toBe(timeline[1]);
  });

  it('navega pelos tempos medidos do instrumental incluindo acordes repetidos', () => {
    const segments = buildScrollTimeline({ phrases: [], instrumentalSections: [
      { label: 'Solo', startLine: 0, endLine: 1, mediaTimestampStart: 0, mediaTimestampEnd: 12 },
    ] });
    const events = buildChordTimeline(segments, ['C G', 'C'], [
      { time: 1, lineIndex: 0, chordIndex: 0, chord: 'C', confidence: 1 },
      { time: 3, lineIndex: 0, chordIndex: 1, chord: 'G', confidence: 1 },
      { time: 5, lineIndex: 1, chordIndex: 0, chord: 'C', confidence: 1 },
      { time: 7, lineIndex: 0, chordIndex: 0, chord: 'C', confidence: 1 },
    ]);
    expect(chordStepTarget(events, 5, 1)).toBe(events[3]);
    expect(chordStepTarget(events, 3, 1, 'line')).toBe(events[2]);
  });

  it('entrega tempo exibido ao relógio de cortes para buscar o instante correto da mídia', () => {
    const seeks: number[] = [];
    const clock = createCutClock([{ start: 5, end: 10 }], time => seeks.push(time));
    const target = chordStepTarget(timeline, 4, 1)!;
    clock.seek(target.startTime);
    expect(target.startTime).toBe(8);
    expect(seeks).toEqual([13]);
  });
});

describe('acumulador da roda', () => {
  it('acumula pixels pequenos e limita cada evento a um acorde', () => {
    const a = wheelAccumulator(INITIAL_WHEEL_STATE, 25, 0, 0);
    expect(a.step).toBe(0);
    const b = wheelAccumulator(a.state, 35, 0, 10);
    expect(b.step).toBe(1);
    expect(wheelAccumulator(b.state, 10000, 0, 200).step).toBe(1);
  });

  it('normaliza linhas e páginas nas duas direções', () => {
    expect(wheelAccumulator(INITIAL_WHEEL_STATE, 4, 1, 0).step).toBe(1);
    expect(wheelAccumulator(INITIAL_WHEEL_STATE, -1, 2, 0, 60, 180, 600).step).toBe(-1);
  });

  it('descarta inércia no cooldown, resíduos antigos e inversões de direção', () => {
    const fired = wheelAccumulator(INITIAL_WHEEL_STATE, 60, 0, 0);
    const ignored = wheelAccumulator(fired.state, 200, 0, 100);
    expect(ignored.step).toBe(0);
    expect(wheelAccumulator(ignored.state, 10, 0, 190).step).toBe(0);
    const pending = wheelAccumulator(INITIAL_WHEEL_STATE, 50, 0, 0);
    expect(wheelAccumulator(pending.state, 20, 0, 300).step).toBe(0);
    expect(wheelAccumulator(pending.state, -60, 0, 10).step).toBe(-1);
    expect(wheelAccumulator(pending.state, NaN, 0, 10).state).toBe(pending.state);
  });
});

describe('passos do arraste', () => {
  it('seleciona um acorde a cada 48 pixels sem reagir a tremores', () => {
    expect(touchStepFromDrag(47)).toBe(0);
    expect(touchStepFromDrag(48)).toBe(1);
    expect(touchStepFromDrag(-100)).toBe(-2);
    expect(touchStepFromDrag(100, 0.2)).toBe(2);
  });

  it('projeta flicks pela velocidade e limita a oito acordes', () => {
    expect(touchStepFromDrag(48, 1)).toBe(4);
    expect(touchStepFromDrag(-48, -1)).toBe(-4);
    expect(touchStepFromDrag(10000, 100)).toBe(8);
    expect(touchStepFromDrag(-10000, -100)).toBe(-8);
    expect(touchStepFromDrag(NaN, 1)).toBe(0);
  });
});
