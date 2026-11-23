import { describe, expect, it } from 'vitest';
import { normalizeContribution } from '../../services/timingApi';
import { legacyToRegions } from '../../services/timingRegions';
import { buildCommunityCards, getActivePhraseLine, getTimingBadge, getTimingEditMetadata } from './timingReview';

const automatic = normalizeContribution({
  id: 'auto-1',
  source: 'auto',
  reviewed: false,
  editorAlias: 'Sync',
  duration: 20,
  phrases: [
    { lineIndex: 0, startTime: 1, endTime: 4 },
    { lineIndex: 3, startTime: 3.5, endTime: 5 },
    { lineIndex: 6, startTime: 9, endTime: 11 },
  ],
  sections: [{ label: 'Verso', type: 'verse', startTime: 0, endTime: 20, startLine: 0, endLine: 6 }],
});

describe('getTimingBadge', () => {
  it('identifica o automático pendente e prioriza o estado revisado', () => {
    expect(getTimingBadge(automatic)).toBe('timing.automaticoNaoRevisado');
    expect(getTimingBadge({ source: 'auto' })).toBe('timing.automaticoNaoRevisado');
    expect(getTimingBadge({ source: 'manual', reviewed: true })).toBe('timing.revisado');
    expect(getTimingBadge({ source: 'auto', reviewed: true })).toBe('timing.revisado');
    expect(getTimingBadge({ source: 'manual', reviewed: false })).toBeNull();
    expect(getTimingBadge({})).toBeNull();
  });
});

describe('buildCommunityCards', () => {
  const lineTypes = ['lyric', 'chord', 'chord', 'tab', 'chord', 'chord', 'lyric'] as const;

  it('revisa cada cartão no seu próprio relógio', () => {
    const [original, withoutTabs] = buildCommunityCards([automatic], lineTypes);

    expect(original.timing).toBe(automatic);
    expect(original.reviewTarget).toBe(automatic);
    expect(withoutTabs.withoutTabs).toBe(true);
    expect(withoutTabs.reviewTarget).toBe(withoutTabs.timing);
    expect(withoutTabs.timing).toMatchObject({
      duration: 18.5,
      variant: 'sem_dedilhado', cuts: [{ start: 3.5, end: 5 }], reviewedFrom: automatic.id,
      phrases: [{ ...automatic.phrases[0], endTime: 3.5 }, { lineIndex: 6, startTime: 7.5, endTime: 9.5 }],
    });
  });

  it('oculta a derivação automática quando existe revisão salva da mesma gravação', () => {
    const derived = buildCommunityCards([automatic], lineTypes)[1].timing;
    const reviewed = { ...derived, id: 'review-1', source: 'manual' as const, reviewed: true };
    const cards = buildCommunityCards([automatic, reviewed], lineTypes);
    expect(cards.map(c => c.timing.id)).toEqual(['auto-1', 'review-1']);
    expect(cards[1]).toMatchObject({ withoutTabs: true, badge: 'timing.revisado' });
    expect(getTimingEditMetadata(reviewed).reviewedFrom).toBe(automatic.id);
    expect(buildCommunityCards([automatic, { ...reviewed, mediaUrl: 'other' }], lineTypes)).toHaveLength(3);
  });

  it('omite a revisão dos cartões de um automático já revisado e de uma contribuição manual', () => {
    const cards = buildCommunityCards([
      { ...automatic, reviewed: true },
      { ...automatic, id: 'manual-1', source: 'manual' },
    ], lineTypes);

    expect(cards.map(card => card.withoutTabs)).toEqual([false, true, false]);
    expect(cards.map(card => card.reviewTarget)).toEqual([null, null, null]);
  });
});

describe('getTimingEditMetadata', () => {
  it('começa a revisão com o alias vazio e o ID da contribuição automática', () => {
    expect(getTimingEditMetadata(automatic)).toEqual({ editorAlias: '', reviewedFrom: 'auto-1' });
  });

  it('mantém o alias e a origem ao reeditar uma revisão salva', () => {
    expect(getTimingEditMetadata({
      ...automatic, id: 'manual-1', source: 'manual', reviewed: true, reviewedFrom: 'auto-1', editorAlias: 'Ana',
    })).toEqual({ editorAlias: 'Ana', reviewedFrom: 'auto-1' });
  });

  it('abre uma contribuição comum sem origem de revisão', () => {
    const manual = normalizeContribution({ id: 'manual-1', duration: 20 });
    expect(getTimingEditMetadata(manual)).toEqual({ editorAlias: '', reviewedFrom: null });
  });
});

describe('getActivePhraseLine', () => {
  it('usa os índices da cifra e segue os intervalos mesmo quando há uma seção vinculada', () => {
    const regions = legacyToRegions(automatic);
    const timeSamples = [0, 1, 3.5, 5, 9, 11];
    expect(timeSamples.map(time => getActivePhraseLine(regions, time))).toEqual([null, 0, 3, null, 6, null]);
  });

  it('usa o intervalo atualizado depois de arrastar a borda de uma frase', () => {
    const regions = legacyToRegions(automatic).map(region =>
      region.kind === 'phrase' && region.startLine === 6 ? { ...region, startTime: 8.5 } : region
    );
    expect(getActivePhraseLine(regions, 8.75)).toBe(6);
  });
});
