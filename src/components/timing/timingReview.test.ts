import { describe, expect, it } from 'vitest';
import { normalizeContribution } from '../../services/timingApi';
import { legacyToRegions } from '../../services/timingRegions';
import { getActivePhraseLine, getTimingBadge, getTimingEditMetadata } from './timingReview';

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
