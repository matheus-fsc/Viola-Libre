import { mediaToDerived } from './mediaCuts';
import { withoutFingerpicking } from './lineScroll';
import type { TimingContribution } from '../services/timingApi';
import type { LineType } from '../utils/lineClassifier';

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
    const cards: CommunityCard[] = [{ timing, withoutTabs: timing.variant === 'sem_dedilhado', badge, reviewTarget }];
    if (timing.source === 'auto' && !contributions.some(c => c.variant === 'sem_dedilhado' && c.reviewed && c.reviewedFrom === timing.id && c.mediaUrl === timing.mediaUrl)) {
      const { phrases, removedDuration, cuts, loops = timing.loops, instrumentalSections } = withoutFingerpicking(timing.phrases, lineTypes, timing.loops, timing.instrumentalSections);
      if (removedDuration > 0) {
        const derived: TimingContribution = {
          ...timing, phrases, loops, cuts, variant: 'sem_dedilhado', reviewedFrom: timing.id,
          audioStart: timing.audioStart == null ? null : mediaToDerived(timing.audioStart, cuts),
          sections: timing.sections.map(section => ({ ...section, startTime: mediaToDerived(section.startTime, cuts),
            endTime: section.endTime == null ? null : mediaToDerived(section.endTime, cuts) })),
          markers: timing.markers.map(marker => ({ ...marker, time: mediaToDerived(marker.time, cuts),
            ...(marker.endTime != null && { endTime: mediaToDerived(marker.endTime, cuts) }) })),
          instrumentalSections: instrumentalSections ?? timing.instrumentalSections,
          duration: Math.max(0, timing.duration - removedDuration),
        };
        cards.push({ timing: derived, withoutTabs: true, badge: null, reviewTarget: reviewTarget ? derived : null });
      }
    }
    return cards;
  });
}

