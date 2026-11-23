import { describe, expect, it } from 'vitest';
import { activePlaybackRegion, isLineInRange, playbackLineRanges, playbackStartTime } from './timingPlayback';
import { normalizeContribution } from '../services/timingApi';
import { legacyToRegions } from '../services/timingRegions';
import { currentPhraseIndex, stepYAtTime, withoutFingerpicking } from './lineScroll';

const timing = normalizeContribution({
  id: 'pra-ver-a-voz', duration: 90, audioStart: 1.5,
  instrumentalSections: [
    { label: 'Introdução', startLine: 0, endLine: 5, mediaTimestampStart: 0, mediaTimestampEnd: 47 },
    { label: 'Final', startLine: 8, endLine: 10, mediaTimestampStart: 75, mediaTimestampEnd: 90 },
  ],
  phrases: [{ lineIndex: 6, startTime: 47, endTime: 75 }],
});
const lines = ['[Intro] C#m7 A7M F#m7(11) C#m7', 'C#m7', 'A7M', '  ', 'F#m7(11)', 'C#m7', 'Letra', '', '[Final] C#m7', 'A7M', 'C#m7'];

describe('blocos instrumentais na reprodução', () => {
  it.each([0, 15, 46.99, 75, 89.99])('destaca o bloco completo e ancora no início em %s', time => {
    const region = activePlaybackRegion(legacyToRegions(timing), time);
    const intro = time < 47;
    expect(region?.startLine).toBe(intro ? 0 : 8);
    expect(lines.flatMap((line, index) => isLineInRange(line, index, region) ? [index] : []))
      .toEqual(intro ? [0, 1, 2, 4, 5] : [8, 9, 10]);
    const anchors = playbackLineRanges(timing).map(range => ({ ...range, y: range.lineIndex * 20 }));
    const anchor = anchors[currentPhraseIndex(anchors, time)];
    expect(anchor.lineIndex).toBe(region?.startLine);
    expect(anchor.endLine).toBe(region?.endLine);
    expect(stepYAtTime(anchors, time)).toBe((intro ? 0 : 8) * 20);
  });

  it('mantém o final sincronizado quando a versão sem dedilhado encurta o relógio', () => {
    const result = withoutFingerpicking([
      { lineIndex: 0, startTime: 50, endTime: 55 },
    ], ['tab'], [], timing.instrumentalSections);
    expect(result.instrumentalSections?.[1]).toMatchObject({ mediaTimestampStart: 70, mediaTimestampEnd: 85 });
  });

  it('encerra a introdução na primeira letra e o final no fim do intervalo', () => {
    const regions = legacyToRegions(timing);
    expect(activePlaybackRegion(regions, 47)?.startLine).toBe(6);
    expect(activePlaybackRegion(regions, 90)).toBeNull();
    expect(activePlaybackRegion(regions, -1)).toBeNull();
  });

  it('ignora intervalos incompletos e dá prioridade ao instrumental sobre frases antigas', () => {
    const regions = legacyToRegions(timing);
    regions.unshift({ ...regions[0], id: 'antiga', startLine: 2, endLine: 2, startTime: 10, endTime: 30 });
    expect(activePlaybackRegion(regions, 20)?.startLine).toBe(0);
    const anchors = playbackLineRanges({ ...timing, phrases: [
      ...timing.phrases, { lineIndex: 2, startTime: 10, endTime: 30 },
    ] });
    expect(anchors[currentPhraseIndex(anchors, 20)].lineIndex).toBe(0);
    expect(playbackLineRanges({ phrases: [], instrumentalSections: [
      { ...timing.instrumentalSections[0], startLine: null },
      { ...timing.instrumentalSections[0], mediaTimestampEnd: null },
      { ...timing.instrumentalSections[0], endLine: -1 },
    ] })).toEqual([]);
  });
});

describe('audioStart', () => {
  it.each(['audio', 'youtube'] as const)('pula o silêncio inicial de %s e preserva retomadas e seeks', type => {
    expect(playbackStartTime(0, timing.audioStart, type)).toBe(1.5);
    expect(playbackStartTime(0.5, timing.audioStart, type)).toBe(0.5);
    expect(playbackStartTime(12, timing.audioStart, type)).toBe(12);
    expect(playbackStartTime(0, timing.audioStart, type, true)).toBe(0);
  });

  it.each([undefined, null, 0, -1, NaN, Infinity])('ignora início ausente ou inválido: %s', start => {
    expect(playbackStartTime(0, start, 'audio')).toBe(0);
  });

  it('preserva o campo na normalização e ignora outros tipos de mídia', () => {
    expect(timing.audioStart).toBe(1.5);
    expect(playbackStartTime(0, 3, 'other')).toBe(0);
    expect(playbackStartTime(0, 3, null)).toBe(0);
  });
});

describe('pausa instrumental sem escrita', () => {
  const section = { label: 'Instrumental', startLine: null, endLine: null, mediaTimestampStart: 10, mediaTimestampEnd: 20 };
  const payload = normalizeContribution({ id: 'pausa', duration: 30, instrumentalSections: [section], phrases: [
    { lineIndex: 1, startTime: 0, endTime: 10 },
    { lineIndex: 5, startTime: 20, endTime: 30 },
  ] });

  it('preserva a região ativa e sua âncora sem destacar a próxima frase', () => {
    const range = playbackLineRanges(payload)[1];
    expect(range).toMatchObject({ startTime: 10, endTime: 20, instrumental: true, lineIndex: 5, endLine: -1 });
    const region = activePlaybackRegion(legacyToRegions(payload), 15);
    expect(region).toMatchObject({ kind: 'instrumental', startLine: null, endLine: null });
    expect(isLineInRange('Letra', 5, region)).toBe(false);
    expect(activePlaybackRegion(legacyToRegions(payload), 20)?.kind).toBe('phrase');
  });
});
