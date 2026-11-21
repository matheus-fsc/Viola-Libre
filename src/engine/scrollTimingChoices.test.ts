import { describe, expect, it } from 'vitest';
import type { TimingContribution } from '../services/timingApi';
import { buildScrollTimingChoices, DEFAULT_SCROLL_TIMING } from './scrollTimingChoices';

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

  it('omite a variante quando não há tempo de tablatura para cortar', () => {
    const { choices, selected } = buildScrollTimingChoices([auto], ['lyric', 'chord', 'lyric', 'tab'], auto, 'auto-sem-dedilhado');
    expect(choices.map(choice => choice.id)).toEqual(['default', 'auto-original']);
    expect(selected.id).toBe('auto-original');
  });

  it('mantém as passagens repetidas nas duas opções automáticas', () => {
    const repeated: TimingContribution = {
      ...auto,
      duration: 25,
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
