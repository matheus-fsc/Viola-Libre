import type { BeatGrid } from '../services/timingApi';
import { useMemo } from 'react';
import { buildScrollTimeline, timelineIndexAtTime, instrumentalCountdown, countInAtTime, beatProgress, trustedBeats } from '../engine/scrollTimeline';
import type { TimingRegion } from '../services/timingRegions';

export interface AutoScrollResult {
  activeRegionId: string | null;
  scrollToLine: number | null;
  countdown: number | null;
  countIn: ReturnType<typeof countInAtTime>;
  beat: number | null;
}

export function useAutoScroll(regions: TimingRegion[], currentTime: number, grid?: BeatGrid): AutoScrollResult {
  const timeline = useMemo(() => buildScrollTimeline({
    phrases: regions.flatMap(r => r.kind === 'phrase' && r.startLine != null && r.startTime != null && r.endTime != null
      ? [{ lineIndex: r.startLine, startTime: r.startTime, endTime: r.endTime }] : []),
    instrumentalSections: regions.filter(r => r.kind === 'instrumental').map(r => ({
      label: r.label, startLine: r.startLine, endLine: r.endLine,
      mediaTimestampStart: r.startTime, mediaTimestampEnd: r.endTime,
    })),
  }), [regions]);
  const segment = timeline[timelineIndexAtTime(timeline, currentTime)];
  const active = segment && segment.kind !== 'hold' && currentTime >= segment.startTime && currentTime < segment.endTime
    ? regions.find(r => r.kind === (segment.instrumental ? 'instrumental' : 'phrase')
      && (segment.endLine < 0 ? r.startLine === null && r.endLine === null : r.startLine === segment.lineIndex)
      && r.startTime != null && r.endTime != null
      && r.startTime <= currentTime && r.endTime > currentTime) : null;
  return { countIn: countInAtTime(timeline, currentTime, grid),
    beat: trustedBeats(grid).length ? beatProgress(currentTime, trustedBeats(grid)) : null, activeRegionId: active?.id ?? null, scrollToLine: segment?.lineIndex ?? null, countdown: instrumentalCountdown(timeline, currentTime) };
}
