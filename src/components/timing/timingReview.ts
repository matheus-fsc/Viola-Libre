import type { TimingContribution } from '../../services/timingApi';
import type { TimingRegion } from '../../services/timingRegions';

export function getTimingBadge(timing: Pick<TimingContribution, 'source' | 'reviewed'>) {
  if (timing.reviewed) return 'timing.revisado';
  return timing.source === 'auto' ? 'timing.automaticoNaoRevisado' : null;
}

export function getTimingEditMetadata(timing: TimingContribution) {
  if (getTimingBadge(timing) === 'timing.automaticoNaoRevisado') {
    return { editorAlias: '', reviewedFrom: timing.id };
  }

  // A reedição precisa manter a origem para que o envio continue marcado como revisado.
  return { editorAlias: timing.editorAlias ?? '', reviewedFrom: timing.reviewedFrom ?? null };
}

export function getActivePhraseLine(regions: TimingRegion[], currentTime: number): number | null {
  let line: number | null = null;
  let latestStart = -Infinity;
  for (const region of regions) {
    if (region.kind !== 'phrase' || region.startLine === null || region.startTime === null || region.endTime === null) continue;
    // Se dois intervalos se sobrepõem durante o ajuste, destaque a frase que acabou de começar.
    if (region.startTime > latestStart && currentTime >= region.startTime && currentTime < region.endTime) {
      line = region.startLine;
      latestStart = region.startTime;
    }
  }
  return line;
}
