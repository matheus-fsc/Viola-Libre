import { activePlaybackRegion } from '../../engine/timingPlayback';
import type { TimingContribution } from '../../services/timingApi';
import type { TimingRegion } from '../../services/timingRegions';

export { buildCommunityCards, getTimingBadge } from '../../engine/timingVariants';
import { getTimingBadge } from '../../engine/timingVariants';

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
