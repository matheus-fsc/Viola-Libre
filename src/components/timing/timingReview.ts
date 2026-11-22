import { activePlaybackRegion } from '../../engine/timingPlayback';
import { withoutFingerpicking } from '../../engine/lineScroll';
import type { TimingContribution } from '../../services/timingApi';
import type { TimingRegion } from '../../services/timingRegions';
import type { LineType } from '../../utils/lineClassifier';

export function getTimingBadge(timing: Pick<TimingContribution, 'source' | 'reviewed'>) {
  if (timing.reviewed) return 'timing.revisado';
  return timing.source === 'auto' ? 'timing.automaticoNaoRevisado' : null;
}

type CommunityCard = {
  timing: TimingContribution;
  withoutTabs: boolean;
  badge: ReturnType<typeof getTimingBadge>;
  reviewTarget: TimingContribution | null;
};

export function buildCommunityCards(
  contributions: readonly TimingContribution[],
  lineTypes: readonly LineType[],
): CommunityCard[] {
  return contributions.flatMap(timing => {
    const badge = getTimingBadge(timing);
    const reviewTarget = badge === 'timing.automaticoNaoRevisado' ? timing : null;
    const cards: CommunityCard[] = [{ timing, withoutTabs: false, badge, reviewTarget }];
    if (timing.source === 'auto') {
      const { phrases, removedDuration, loops = timing.loops, instrumentalSections } = withoutFingerpicking(timing.phrases, lineTypes, timing.loops, timing.instrumentalSections);
      if (removedDuration > 0) {
        // A revisão usa os tempos originais para acompanhar a gravação.
        cards.push({
          timing: { ...timing, phrases, loops, instrumentalSections: instrumentalSections ?? timing.instrumentalSections, duration: Math.max(0, timing.duration - removedDuration) },
          withoutTabs: true,
          badge: null,
          reviewTarget,
        });
      }
    }
    return cards;
  });
}

export function getTimingEditMetadata(timing: TimingContribution) {
  if (getTimingBadge(timing) === 'timing.automaticoNaoRevisado') {
    return { editorAlias: '', reviewedFrom: timing.id };
  }

  // A reedição precisa manter a origem para que o envio continue marcado como revisado.
  return { editorAlias: timing.editorAlias ?? '', reviewedFrom: timing.reviewedFrom ?? null };
}

export function getActivePhraseLine(regions: TimingRegion[], currentTime: number): number | null {
  return activePlaybackRegion(regions, currentTime)?.startLine ?? null;
}
