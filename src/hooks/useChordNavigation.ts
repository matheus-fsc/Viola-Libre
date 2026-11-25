import { useEffect, useState, type RefObject } from 'react';
import { chordStepTarget } from '../engine/chordNavigation';
import { chordStripAtTime, type TimedChord } from '../engine/upcomingChords';

const editable = (target: HTMLElement) => !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

/** Setas andam de acorde em acorde (Shift: de linha em linha). Roda e toque rolam a página
 *  normalmente, e o laço da rolagem leva a música para a linha onde o músico parou. */
export function useChordNavigation({ active, pageRef, timeline, timeRef, seek, audioStart }: {
  active: boolean; pageRef: RefObject<HTMLDivElement | null>;
  timeline: readonly TimedChord[]; timeRef: RefObject<number>; seek: (time: number) => void; audioStart: number;
}) {
  const [announcement, setAnnouncement] = useState<TimedChord | null>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!active || !page) return;
    const announceSeek = (target: TimedChord | null, time = target?.startTime) => {
      if (time === undefined) return;
      seek(time);
      setAnnouncement(target);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || editable(event.target as HTMLElement)) return;
      const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1
        : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
      if (!direction && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      event.stopPropagation();
      if (direction) announceSeek(chordStepTarget(timeline, timeRef.current, direction, event.shiftKey ? 'line' : 'chord'));
      else if (event.key === 'Home') announceSeek(chordStripAtTime(timeline, audioStart).current, audioStart);
      else announceSeek(timeline.at(-1) ?? null);
    };
    page.addEventListener('keydown', onKey, true);
    return () => page.removeEventListener('keydown', onKey, true);
  }, [active, audioStart, pageRef, seek, timeRef, timeline]);
  return { announcement };
}
