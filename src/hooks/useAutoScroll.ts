import { useRef } from 'react';
import type { TimingRegion } from '../services/timingRegions';

export interface AutoScrollResult {
  activeRegionId: string | null;
  scrollToLine: number | null;
}

// New, standalone — does NOT exist elsewhere in the codebase. CifraViewer's public auto-scroll
// is a separate, DOM/chord-density heuristic (its own requestAnimationFrame clock, no relation
// to TimingRegion or usePlayerStore) — this hook is not extracted from it and does not replace
// it. See AutoScrollPreview.tsx for the only current consumer.
//
// Finds the region that covers `currentTime` and is actually linked to text (has both a line
// range AND a time range) — a section the Wizard 3 line-link wizard hasn't linked yet still has
// startLine/endLine === null and can't tell us where to scroll, so it's excluded here rather
// than crashing on a null line.
export function useAutoScroll(regions: TimingRegion[], currentTime: number): AutoScrollResult {
  // Carries the last known scrollToLine across renders where no region covers currentTime (a
  // gap between sections, or before the first one starts) — so playback through a gap holds
  // position instead of yanking the view back to the top.
  const lastScrollToLine = useRef<number | null>(null);

  const active = regions.find(r =>
    r.startLine != null && r.endLine != null && r.startTime != null && r.endTime != null &&
    currentTime >= r.startTime && currentTime < r.endTime
  ) ?? null;

  if (active) {
    lastScrollToLine.current = active.startLine!;
    return { activeRegionId: active.id, scrollToLine: active.startLine! };
  }
  return { activeRegionId: null, scrollToLine: lastScrollToLine.current };
}
