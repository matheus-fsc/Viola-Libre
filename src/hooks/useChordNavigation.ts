import { useEffect, useState, type RefObject } from 'react';
import { chordStepTarget, INITIAL_WHEEL_STATE, touchStepFromDrag, wheelAccumulator } from '../engine/chordNavigation';
import { chordStripAtTime, type TimedChord } from '../engine/upcomingChords';

const editable = (target: HTMLElement) => !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

export function useChordNavigation({ active, pageRef, contentRef, timeline, timeRef, seek, audioStart, busyRef }: {
  busyRef: RefObject<boolean>; active: boolean; pageRef: RefObject<HTMLDivElement | null>; contentRef: RefObject<HTMLDivElement | null>;
  timeline: readonly TimedChord[]; timeRef: RefObject<number>; seek: (time: number) => void; audioStart: number;
}) {
  const [preview, setPreview] = useState<TimedChord | null>(null);
  const [announcement, setAnnouncement] = useState<TimedChord | null>(null);
  useEffect(() => {
    const panel = contentRef.current;
    const page = pageRef.current;
    if (!active || !panel || !page) return;
    let wheel = INITIAL_WHEEL_STATE;
    let animation: Animation | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let suppressClick = false;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let drag: { id: number; x: number; y: number; lastY: number; lastTime: number; velocity: number;
      base: number; distance: number; vertical: boolean; horizontal: boolean } | null = null;
    const announceSeek = (target: TimedChord | null, time = target?.startTime) => {
      if (time === undefined) return;
      seek(time);
      setAnnouncement(target);
    };
    const step = (direction: 1 | -1, unit: 'chord' | 'line' = 'chord') =>
      announceSeek(chordStepTarget(timeline, timeRef.current, direction, unit));
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || editable(event.target as HTMLElement) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (busyRef.current) return;
      const result = wheelAccumulator(wheel, event.deltaY, event.deltaMode, performance.now(), 60, 180, window.innerHeight);
      wheel = result.state;
      if (result.step) step(result.step);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || editable(event.target as HTMLElement)) return;
      const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1
        : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
      if (!direction && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      event.stopPropagation();
      if (busyRef.current) return;
      if (direction) step(direction, event.shiftKey ? 'line' : 'chord');
      else if (event.key === 'Home') announceSeek(chordStripAtTime(timeline, audioStart).current, audioStart);
      else announceSeek(timeline.at(-1) ?? null);
    };
    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType !== 'touch' || editable(event.target as HTMLElement)
        || (event.target as HTMLElement).closest('button, a, [role="dialog"]') || busyRef.current) return;
      page.focus({ preventScroll: true });
      const current = chordStripAtTime(timeline, timeRef.current).current;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY,
        lastTime: performance.now(), velocity: 0, base: current ? timeline.indexOf(current) : -1,
        distance: 0, vertical: false, horizontal: false };
    };
    const targetAt = (steps: number) => timeline[Math.max(0, Math.min(timeline.length - 1, (drag?.base ?? 0) + steps))] ?? null;
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id || drag.horizontal) return;
      const dy = event.clientY - drag.y;
      const dx = event.clientX - drag.x;
      if (!drag.vertical) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) { drag.horizontal = true; return; }
        drag.vertical = true;
        busyRef.current = true;
        panel.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      const now = performance.now();
      drag.velocity = (drag.lastY - event.clientY) / Math.max(1, now - drag.lastTime);
      drag.lastY = event.clientY;
      drag.lastTime = now;
      drag.distance = -dy;
      const lower = -Math.max(0, drag.base) * 48;
      const upper = Math.max(0, timeline.length - 1 - drag.base) * 48;
      const bounded = Math.max(lower, Math.min(upper, drag.distance));
      // A resistência deixa o limite perceptível sem soltar a página para o scroll nativo.
      const excess = drag.distance - bounded;
      const resisted = bounded + excess * 0.35 / (1 + Math.abs(excess) / 160);
      panel.style.transform = `translateY(${-resisted}px)`;
      setPreview(targetAt(touchStepFromDrag(drag.distance)));
    };
    const finish = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.vertical) {
        const cancelled = event.type !== 'pointerup';
        const velocity = performance.now() - drag.lastTime > 80 ? 0 : drag.velocity;
        const target = cancelled ? null : targetAt(touchStepFromDrag(drag.distance, velocity));
        const oldY = window.scrollY;
        const offset = Number.parseFloat(panel.style.transform.slice(11)) || 0;
        announceSeek(target);
        const from = offset + window.scrollY - oldY;
        panel.style.transform = '';
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        animation?.cancel();
        if (!reduced) animation = panel.animate([
          { transform: `translateY(${from}px)` },
          { transform: `translateY(${-Math.sign(from) * Math.min(6, Math.abs(from) * 0.03)}px)`, offset: 0.8 },
          { transform: 'translateY(0)' },
        ], { duration: 220, easing: 'ease-out' });
        suppressClick = true;
        timer = setTimeout(() => { busyRef.current = false; suppressClick = false; }, reduced ? 0 : 220);
        const pointerId = event.pointerId;
        releaseTimer = setTimeout(() => {
          if (panel.hasPointerCapture(pointerId)) panel.releasePointerCapture(pointerId);
        }, 0);
      }
      drag = null;
      setPreview(null);
    };
    const onClick = (event: MouseEvent) => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    page.addEventListener('keydown', onKey, true);
    panel.addEventListener('pointerdown', onDown);
    panel.addEventListener('pointermove', onMove, { passive: false });
    panel.addEventListener('pointerup', finish);
    panel.addEventListener('pointercancel', finish);
    panel.addEventListener('lostpointercapture', finish);
    panel.addEventListener('click', onClick, true);
    return () => {
      panel.removeEventListener('wheel', onWheel);
      page.removeEventListener('keydown', onKey, true);
      panel.removeEventListener('pointerdown', onDown);
      panel.removeEventListener('pointermove', onMove);
      panel.removeEventListener('pointerup', finish);
      panel.removeEventListener('pointercancel', finish);
      panel.removeEventListener('lostpointercapture', finish);
      panel.removeEventListener('click', onClick, true);
      animation?.cancel();
      clearTimeout(timer);
      clearTimeout(releaseTimer);
      if (drag && panel.hasPointerCapture(drag.id)) panel.releasePointerCapture(drag.id);
      panel.style.transform = '';
      busyRef.current = false;
      setPreview(null);
    };
  }, [active, audioStart, busyRef, contentRef, pageRef, seek, timeRef, timeline]);
  return { busyRef, preview: active ? preview : null, announcement };
}
