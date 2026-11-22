import { describe, expect, it } from 'vitest';
import type { TimingContribution } from '../services/timingApi';
import { buildScrollTimingChoices, chooseTrainingTiming, DEFAULT_SCROLL_TIMING } from './scrollTimingChoices';

const auto: TimingContribution = {
  id: 'generated',
  source: 'auto',
  editorAlias: null,
  bpm: 120,
  duration: 15,
  votes: 0,
  mediaType: null,
  mediaUrl: null,
  updatedAt: '',
  loops: [],
  instrumentalSections: [],
  sections: [],
  markers: [],
  phrases: [
    { lineIndex: 0, startTime: 0, endTime: 3 },
    { lineIndex: 2, startTime: 9, endTime: 12 },
  ],
};
const manual: TimingContribution = { ...auto, id: 'editor', source: 'manual', editorAlias: 'Ana', votes: 7, reviewed: true };
const legacy: TimingContribution = { ...manual, id: 'legacy', source: undefined, editorAlias: null, reviewed: false };

describe('buildScrollTimingChoices', () => {
  it('oferece o original, a variante encurtada e uma opção por contribuição da comunidade', () => {
    const { choices, selected } = buildScrollTimingChoices([manual, auto, legacy], ['lyric', 'tab', 'lyric'], manual, null);
    expect(choices.map(choice => choice.id)).toEqual(['default', 'auto-original', 'auto-sem-dedilhado', 'editor', 'legacy']);
    expect(choices[1].timing).toBe(auto);
    expect(choices[2].timing).toMatchObject({
      duration: 9,
      phrases: [auto.phrases[0], { lineIndex: 2, startTime: 3, endTime: 6 }],
    });
    expect(choices[3].timing).toBe(manual);
    expect(choices[4].timing).toBe(legacy);
    expect(selected).toBe(choices[3]);
  });

  it('oferece a variante revisada com identidade própria e oculta a derivação automática', () => {
    const reviewed = { ...manual, variant: 'sem_dedilhado' as const, reviewedFrom: auto.id, cuts: [{ start: 3, end: 9 }] };
    const { choices, selected } = buildScrollTimingChoices([auto, reviewed], ['lyric', 'tab', 'lyric'], reviewed, 'editor');
    expect(choices.map(c => c.id)).toEqual(['default', 'auto-original', 'editor']);
    expect(selected.timing).toBe(reviewed);
    expect(selected.timing).toMatchObject({ variant: 'sem_dedilhado', reviewed: true });
  });

  it('omite a variante quando não há tempo de tablatura para cortar', () => {
    const { choices, selected } = buildScrollTimingChoices([auto], ['lyric', 'chord', 'lyric', 'tab'], auto, 'auto-sem-dedilhado');
    expect(choices.map(choice => choice.id)).toEqual(['default', 'auto-original']);
    expect(selected.id).toBe('auto-original');
  });

  it('mantém as passagens repetidas nas duas opções automáticas', () => {
    const repeated: TimingContribution = {
      ...auto,
      duration: 25,
      loops: [{
        label: 'Repetição 1', startLine: 0, endLine: 2, repeatCount: 2,
        mediaTimestampStart: 0, mediaTimestampEnd: 12,
        occurrences: [{ startTime: 0, endTime: 12 }, { startTime: 15, endTime: 25 }],
      }],
      phrases: [
        { lineIndex: 0, startTime: 0, endTime: 3 },
        { lineIndex: 1, startTime: 4, endTime: 8 },
        { lineIndex: 2, startTime: 9, endTime: 12 },
        { lineIndex: 0, startTime: 15, endTime: 18 },
        { lineIndex: 1, startTime: 19, endTime: 21 },
        { lineIndex: 2, startTime: 22, endTime: 25 },
      ],
    };
    const { choices, selected } = buildScrollTimingChoices(
      [repeated], ['lyric', 'tab', 'lyric'], repeated, 'auto-sem-dedilhado',
    );
    expect(choices[1].timing).toBe(repeated);
    expect(selected).toBe(choices[2]);
    expect(selected.timing).toMatchObject({
      duration: 15,
      loops: [{
        mediaTimestampStart: 0, mediaTimestampEnd: 6,
        occurrences: [{ startTime: 0, endTime: 6 }, { startTime: 9, endTime: 15 }],
      }],
      phrases: [
        { lineIndex: 0, startTime: 0, endTime: 3 },
        { lineIndex: 2, startTime: 3, endTime: 6 },
        { lineIndex: 0, startTime: 9, endTime: 12 },
        { lineIndex: 2, startTime: 12, endTime: 15 },
      ],
    });
  });

  it('usa a opção lembrada quando ainda existe', () => {
    for (const id of ['default', 'auto-original', 'auto-sem-dedilhado', 'legacy']) {
      const { selected } = buildScrollTimingChoices([auto, manual, legacy], ['lyric', 'tab', 'lyric'], manual, id);
      expect(selected.id).toBe(id);
    }
  });

  it('volta ao melhor timing quando a contribuição lembrada foi removida', () => {
    const { selected } = buildScrollTimingChoices([auto, manual], ['lyric', 'tab', 'lyric'], manual, 'legacy');
    expect(selected.id).toBe('editor');
  });

  it('respeita a ordem da lista quando o melhor timing ainda aponta para uma contribuição removida', () => {
    const { selected } = buildScrollTimingChoices([manual, auto], ['lyric', 'tab', 'lyric'], legacy, 'legacy');
    expect(selected.id).toBe('editor');
  });

  it('oferece apenas a rolagem padrão e as contribuições quando falta o automático', () => {
    const { choices, selected } = buildScrollTimingChoices([manual], ['lyric', 'tab', 'lyric'], null, 'auto-original');
    expect(choices.map(choice => choice.id)).toEqual(['default', 'editor']);
    expect(selected.id).toBe('editor');
  });

  it('seleciona a rolagem padrão quando a lista está vazia', () => {
    expect(buildScrollTimingChoices([], [], null, 'editor'))
      .toEqual({ choices: [DEFAULT_SCROLL_TIMING], selected: DEFAULT_SCROLL_TIMING });
  });
});

describe('chooseTrainingTiming', () => {
  it('prefere a melhor contribuição da comunidade mesmo quando a seleção lembrada é padrão', () => {
    const { choices } = buildScrollTimingChoices([auto, legacy, manual], [], manual, 'default');
    expect(chooseTrainingTiming(choices, manual)?.timing).toBe(manual);
    expect(chooseTrainingTiming(choices, auto)?.timing).toBe(manual);
  });

  it('usa o automático original quando não há comunidade e nunca a variante encurtada', () => {
    const { choices } = buildScrollTimingChoices([auto], ['lyric', 'tab', 'lyric'], auto, 'auto-sem-dedilhado');
    expect(chooseTrainingTiming(choices, auto)?.id).toBe('auto-original');
    expect(chooseTrainingTiming([DEFAULT_SCROLL_TIMING], null)).toBeNull();
  });

  it('ignora timings sem sincronização e desempata contribuições por revisão e votos', () => {
    const empty = { ...manual, phrases: [] };
    const { choices } = buildScrollTimingChoices([empty, auto], [], empty, null);
    expect(chooseTrainingTiming(choices, empty)?.id).toBe('auto-original');
    const popular = { ...legacy, id: 'popular', votes: 10 };
    const ranked = buildScrollTimingChoices([legacy, popular], [], null, null).choices;
    expect(chooseTrainingTiming(ranked, null)?.timing).toBe(popular);
  });
});
