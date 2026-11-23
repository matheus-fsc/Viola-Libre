import { describe, expect, it } from 'vitest';
import { recordingTargetTom, transposeNotice } from './recordingTranspose';
import { buildScrollTimingChoices, chooseTrainingTiming } from './scrollTimingChoices';
import { normalizeContribution } from '../services/timingApi';
import { cifraTimingLines, formatCifraChordHtml } from '../services/cifraUtils';
import { buildChordTimeline, chordStripAtTime } from './upcomingChords';
import { buildScrollTimeline } from './scrollTimeline';
import { displayedChordVoicing } from '../services/displayedChordVoicing';
import { buildVoicingFromFrets, transposeChordString } from './chordCalculator';

const recording = (semitones: number) => ({ semitones, confidence: 0.95 });

describe('tom da gravação', () => {
  it.each([-11, -5, -2, 2, 6, 11])('calcula um alvo absoluto equivalente a %s semitons', semitones => {
    const target = recordingTargetTom(recording(semitones));
    expect(target).toBeGreaterThanOrEqual(-5);
    expect(target).toBeLessThanOrEqual(6);
    expect(transposeChordString('Em', target, false)).toBe(transposeChordString('Em', semitones, false));
    expect(transposeNotice(recording(semitones), target)).toBeNull();
    expect(transposeNotice(recording(semitones), target + 12)).toBeNull();
  });

  it('avisa sobre Encantos de Sereia e Tempo de Amor nos dois sentidos', () => {
    expect(transposeNotice(recording(-2), 0)).toEqual({ semitones: 2, direction: 'below', label: 'cifra.gravacaoAbaixoTom' });
    expect(transposeNotice(recording(2), 0)).toEqual({ semitones: 2, direction: 'above', label: 'cifra.gravacaoAcimaTom' });
    expect(recordingTargetTom(recording(-2))).toBe(-2);
    expect(recordingTargetTom(recording(2))).toBe(2);
  });

  it('compara com ajustes manuais posteriores sem acumular a transposição', () => {
    expect(transposeNotice(recording(2), 2)).toBeNull();
    expect(transposeNotice(recording(2), 3)).toMatchObject({ semitones: 1, direction: 'below', label: 'cifra.gravacaoAbaixoSemitom' });
    expect(transposeNotice(recording(-2), 1)).toMatchObject({ semitones: 3, label: 'cifra.gravacaoAbaixoSemitons' });
    expect(transposeNotice(recording(6), 0)).toMatchObject({ semitones: 6, label: 'cifra.gravacaoAcimaTons' });
    expect(transposeNotice(recording(-5), 3)).toMatchObject({ semitones: 4, direction: 'above' });
    expect(transposeNotice(undefined, 0)).toBeNull();
    expect(transposeNotice(null, 0)).toBeNull();
    expect(transposeNotice(recording(2), NaN)).toBeNull();
  });

  it('conserva a detecção no original, na variante sem dedilhado e no Treinar', () => {
    const timing = normalizeContribution({ id: 'auto', source: 'auto', duration: 15,
      recordingTranspose: recording(-2), phrases: [
        { lineIndex: 0, startTime: 0, endTime: 3 },
        { lineIndex: 2, startTime: 9, endTime: 12 },
      ] });
    const { choices } = buildScrollTimingChoices([timing], ['lyric', 'tab', 'lyric'], timing, null);
    expect(choices[2].timing?.variant).toBe('sem_dedilhado');
    for (const choice of choices.slice(1)) expect(choice.timing?.recordingTranspose).toEqual(recording(-2));
    expect(chooseTrainingTiming(choices, timing)?.timing?.recordingTranspose).toEqual(recording(-2));
  });

  it.each([0, -2, 2, 3])('mantém painel, timeline e diagramas no ajuste atual %s', tom => {
    const chordTimes = ['C', 'G', 'Am'].map((chord, chordIndex) => ({
      time: chordIndex + 1, lineIndex: 0, chordIndex, chord, confidence: 1,
    }));
    const timing = normalizeContribution({ id: 'auto', duration: 5, chordTimes, recordingTranspose: recording(2),
      instrumentalSections: [{ label: 'Solo', startLine: 0, endLine: 0, mediaTimestampStart: 0, mediaTimestampEnd: 5 }] });
    const lines = cifraTimingLines(formatCifraChordHtml('<b>C</b> <b>G</b> <b>Am</b>', tom));
    const events = buildChordTimeline(buildScrollTimeline(timing), lines, timing.chordTimes);
    const expected = chordTimes.map(c => transposeChordString(c.chord, tom, false));
    expect(events.map(c => c.name)).toEqual(expected);
    const strip = chordStripAtTime(events, 2);
    expect([strip.previous?.name, strip.current?.name, strip.next?.name]).toEqual(expected);
    const tuning = { id: 'standard', name: 'Teste', strings: [40, 45, 50, 55, 59, 64] };
    const voicings = [[0, 3, 2, 0, 1, 0], [3, 2, 0, 0, 0, 3], [0, 0, 2, 2, 1, 0]]
      .map(frets => buildVoicingFromFrets(frets, { ...tuning, strings: tuning.strings.map(midi => midi + tom) }));
    const context = { chordNames: expected, displayedVoicings: voicings.map(v => [v]), instrumentId: 'guitar', tuning,
      rankings: {}, favorites: {}, orderMode: 'favoritos' as const, variations: {}, locked: {}, custom: {} };
    for (const [index, chord] of [strip.previous, strip.current, strip.next].entries()) {
      expect(displayedChordVoicing(chord!.name, context).bestVoicing).toBe(voicings[index]);
    }
    expect(timing.chordTimes?.map(c => c.chord)).toEqual(['C', 'G', 'Am']);
  });
});
