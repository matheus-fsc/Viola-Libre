import React, { useRef, useState, useEffect, useMemo } from 'react';
import { formatSeconds, type MarkerType } from '../../services/timingApi';
import { clampRange, buildTracksFromRegions, SECTION_TYPE_LABEL, SECTION_ORDER, type ClipKind, type TimelineClip } from './timingTracks';
import type { TimingRegion } from '../../services/timingRegions';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useTimingRegionsStore } from '../../stores/useTimingRegionsStore';
import { useLoopSaltoWizardStore } from '../../stores/useLoopSaltoWizardStore';
import { useDerivedJumps, findLoopConversionOccurrences } from '../../hooks/useDerivedJumps';

// "Modificar" clip popup — reuses CifraGridEditor's linkPopup visual pattern (small fixed-position
// bevel-out card near the click, dismissed by a full-screen transparent click-catcher). Only
// offered for 'section' clips: "Reclassificar como" always, "Converter em Loop" only when
// findLoopConversionOccurrences finds this section is part of an auto-detected repeat.
type ModifyPopupState =
  | { step: 'menu';       regionId: string; x: number; y: number }
  | { step: 'reclassify'; regionId: string; x: number; y: number }
  | { step: 'convert-loop'; regionId: string; x: number; y: number; occurrences: TimingRegion[][]; repeatCount: number };

const TRACK_ORDER: ClipKind[] = ['section', 'loop', 'instrumental', 'phrase'];
const GUTTER_W  = 52;  // px
const TOOLBAR_H = 22;  // px — transport + zoom bar
const RULER_H   = 20;  // px
const TRACK_H   = 22;  // px
const SCROLL_H  = 8;   // px — minimap scrollbar
export const TIMELINE_H = TOOLBAR_H + RULER_H + TRACK_ORDER.length * TRACK_H + SCROLL_H; // 138px

const TRACK_LABEL: Record<ClipKind, string> = {
  section:      'Trechos',
  loop:         'Loops',
  instrumental: 'Instr.',
  phrase:       'Frases',
};

const TRACK_ACCENT: Record<ClipKind, string> = {
  section:      '#8b5300',
  loop:         '#0058e6',
  instrumental: '#228b22',
  phrase:       '#6b21a8',
};

// subtle row tints — warm beige variations
const TRACK_BG: Record<ClipKind, string> = {
  section:      '#ece9d8',
  loop:         '#e8e5da',
  instrumental: '#ece9d8',
  phrase:       '#e8e5da',
};

type DragState =
  | { mode: 'create'; kind: ClipKind; anchor: number; start: number; end: number }
  | { mode: 'move';   kind: ClipKind; regionId: string; anchor: number; origStart: number; origEnd: number }
  | { mode: 'resize-left' | 'resize-right'; kind: ClipKind; regionId: string; origStart: number; origEnd: number };

export interface MarkerMetaEntry {
  symbol: string;
  name: string;
  description: string;
  pinColor: string;
}

export interface TimingTimelineProps {
  markerMeta: Record<MarkerType, MarkerMetaEntry>;
  creationKind: ClipKind | null;
  onCreateRange: (kind: ClipKind, start: number, end: number) => void;
  onMarkerClick?: (markerId: string) => void;
}

export const TimingTimeline: React.FC<TimingTimelineProps> = ({
  markerMeta, creationKind, onCreateRange, onMarkerClick,
}) => {
  const { regions, markers } = useTimingRegionsStore();
  const { duration, currentTime: playerCurrentTime, playerReady, play, pause, seek } = usePlayerStore();
  const derivedJumps = useDerivedJumps(regions);
  const trackAreaRef  = useRef<HTMLDivElement>(null);
  const minimapRef    = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [modifyPopup, setModifyPopup] = useState<ModifyPopupState | null>(null);

  // Merges every region across every occurrence into one new 'loop' region (canonical = 1st
  // occurrence, repeats[] = the rest, using each occurrence's REAL existing start/end times —
  // nothing is re-recorded), then deletes all the merged 'section' regions.
  const commitLoopConversion = (occurrences: TimingRegion[][], repeatCount: number) => {
    const [canonical, ...rest] = occurrences;
    const label = canonical.map(r => r.label).filter(Boolean).join(' + ') || 'Loop';
    const rStore = useTimingRegionsStore.getState();
    rStore.addRegion({
      kind: 'loop',
      startLine: canonical[0].startLine,
      endLine: canonical[canonical.length - 1].endLine,
      startTime: canonical[0].startTime,
      endTime: canonical[canonical.length - 1].endTime,
      label,
      repeatCount,
      repeats: rest.map(occ => ({
        startTime: occ[0].startTime ?? 0,
        endTime: occ[occ.length - 1].endTime ?? 0,
      })),
    });
    for (const occ of occurrences) for (const r of occ) rStore.removeRegion(r.id);
  };

  // ── Viewport (scrollable window into the full duration) ──────────────────
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd,   setViewEnd]   = useState(0); // 0 = full view

  const dur  = Math.max(duration, 1);
  // Compute tracks from the regions store — updates whenever regions or duration change
  const tracks = useMemo(() => buildTracksFromRegions(regions, dur), [regions, dur]);

  const vEnd = viewEnd > 0 ? Math.min(viewEnd, dur) : dur;
  const vStart = Math.min(viewStart, vEnd - 0.5);
  const vDur = Math.max(vEnd - vStart, 0.5);
  const isFullView = viewEnd === 0 || (vStart === 0 && vEnd >= dur);

  // Reset viewport when a new media is loaded
  const prevDurRef = useRef(0);
  useEffect(() => {
    if (duration > 0 && Math.abs(duration - prevDurRef.current) > 5) {
      setViewStart(0);
      setViewEnd(0);
    }
    prevDurRef.current = duration;
  }, [duration]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const areaTimeFromX = (clientX: number, rect: DOMRect): number => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return vStart + (rect.width > 0 ? (x / rect.width) * vDur : 0);
  };

  const applyZoom = (factor: number, pivotTime: number) => {
    const newDur   = Math.min(dur, Math.max(1, vDur * factor));
    const ratio    = (pivotTime - vStart) / vDur;
    let newStart   = pivotTime - ratio * newDur;
    let newEnd     = newStart + newDur;
    if (newEnd > dur)   { newEnd = dur; newStart = Math.max(0, dur - newDur); }
    if (newStart < 0)   { newStart = 0; newEnd = Math.min(dur, newDur); }
    if (newEnd - newStart >= dur - 0.001) { setViewStart(0); setViewEnd(0); return; }
    setViewStart(newStart);
    setViewEnd(newEnd);
  };

  // ── Track-area pointer handlers ───────────────────────────────────────────
  const handleAreaDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = areaTimeFromX(e.clientX, rect);
    if (creationKind) {
      setDrag({ mode: 'create', kind: creationKind, anchor: t, start: t, end: t });
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      seek(t);
    }
  };

  const handleAreaMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = areaTimeFromX(e.clientX, rect);
    if (drag.mode === 'create') {
      const { start, end } = clampRange(Math.min(drag.anchor, t), Math.max(drag.anchor, t), dur);
      setDrag({ ...drag, start, end });
    } else if (drag.mode === 'move') {
      const d = t - drag.anchor;
      const { start, end } = clampRange(drag.origStart + d, drag.origEnd + d, dur);
      useTimingRegionsStore.getState().updateRegion(drag.regionId, { startTime: start, endTime: end });
    } else if (drag.mode === 'resize-left') {
      const { start, end } = clampRange(t, drag.origEnd, dur);
      useTimingRegionsStore.getState().updateRegion(drag.regionId, { startTime: start, endTime: end });
    } else {
      const { start, end } = clampRange(drag.origStart, t, dur);
      useTimingRegionsStore.getState().updateRegion(drag.regionId, { startTime: start, endTime: end });
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag?.mode === 'create') onCreateRange(drag.kind, drag.start, drag.end);
    if (drag) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ } }
    setDrag(null);
  };

  const handleAreaWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const pivot = areaTimeFromX(e.clientX, rect);
    applyZoom(e.deltaY > 0 ? 1.3 : 0.77, pivot);
  };

  // ── Ruler pan (drag ruler to scroll view) ────────────────────────────────
  const rulerDragRef = useRef<{ origClientX: number; origStart: number } | null>(null);

  const handleRulerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    rulerDragRef.current = { origClientX: e.clientX, origStart: vStart };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handleRulerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rd = rulerDragRef.current;
    if (!rd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dTime = -((e.clientX - rd.origClientX) / rect.width) * vDur;
    const newStart = Math.max(0, Math.min(rd.origStart + dTime, dur - vDur));
    if (!isFullView || Math.abs(dTime) > 0.2) {
      setViewStart(newStart);
      setViewEnd(newStart + vDur);
    }
  };

  const handleRulerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
    rulerDragRef.current = null;
  };

  // ── Minimap pan ───────────────────────────────────────────────────────────
  const mapDragRef = useRef<{ origClientX: number; origStart: number } | null>(null);

  const handleMapDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const t = frac * dur;
    const newStart = Math.max(0, Math.min(t - vDur / 2, dur - vDur));
    setViewStart(newStart);
    if (!isFullView) setViewEnd(newStart + vDur);
    mapDragRef.current = { origClientX: e.clientX, origStart: newStart };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMapMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const md = mapDragRef.current;
    if (!md) return;
    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dTime = ((e.clientX - md.origClientX) / rect.width) * dur;
    const newStart = Math.max(0, Math.min(md.origStart + dTime, dur - vDur));
    setViewStart(newStart);
    if (!isFullView) setViewEnd(newStart + vDur);
  };

  const handleMapUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
    mapDragRef.current = null;
  };

  // ── Clip helpers ──────────────────────────────────────────────────────────
  const beginClipMove = (clip: TimelineClip) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = areaTimeFromX(e.clientX, rect);
    setDrag({ mode: 'move', kind: clip.kind, regionId: clip.regionId, anchor: t, origStart: clip.start, origEnd: clip.end });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const beginClipResize = (clip: TimelineClip, edge: 'left' | 'right') => (e: React.PointerEvent) => {
    e.stopPropagation();
    setDrag({ mode: edge === 'left' ? 'resize-left' : 'resize-right', kind: clip.kind, regionId: clip.regionId, origStart: clip.start, origEnd: clip.end });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);
  const sortedSections = [...tracks.section].sort((a, b) => a.start - b.start);
  const activeSectionId = sortedSections.findLast(s => s.start <= playerCurrentTime)?.regionId ?? null;

  const renderClip = (clip: TimelineClip) => {
    if (clip.end < vStart || clip.start > vEnd) return null;
    const visStart = Math.max(clip.start, vStart);
    const visEnd   = Math.min(clip.end,   vEnd);
    const left  = ((visStart - vStart) / vDur) * 100;
    const width = Math.max(((visEnd - visStart) / vDur) * 100, 0.2);
    const cutL = clip.start < vStart;
    const cutR = clip.end   > vEnd;
    const isActive = clip.kind === 'section' && clip.regionId === activeSectionId;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (clip.isRepeat && clip.repeatIndex !== undefined) {
        // Remove only this occurrence from repeats[]
        const rStore = useTimingRegionsStore.getState();
        const region = rStore.regions.find(r => r.id === clip.regionId);
        const newRepeats = (region?.repeats ?? []).filter((_, i) => i !== clip.repeatIndex);
        rStore.updateRegion(clip.regionId, { repeats: newRepeats });
      } else {
        useTimingRegionsStore.getState().removeRegion(clip.regionId);
      }
    };

    const repeatSuffix = clip.isRepeat ? ` (×${clip.repeatIndex! + 2})` : '';
    const titleSuffix = clip.isRepeat ? ' · repetição' : (clip.openEnded ? ' (aberto)' : '');

    return (
      <div
        key={clip.clipKey}
        onPointerDown={clip.isRepeat ? undefined : beginClipMove(clip)}
        onClick={e => e.stopPropagation()}
        title={`${clip.label}${repeatSuffix}  ${formatSeconds(clip.start)} → ${formatSeconds(clip.end)}${titleSuffix}`}
        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: clip.color }}
        className={`group absolute top-[2px] bottom-[2px] flex items-center overflow-hidden border
          ${clip.isRepeat
            ? 'border-dashed border-white/60 opacity-50 hover:opacity-75 cursor-default'
            : `cursor-grab active:cursor-grabbing border-black/20 ${isActive ? 'brightness-110 ring-1 ring-white/60' : 'opacity-80 hover:opacity-100'}`
          }
          ${cutL ? 'rounded-l-none border-l-0' : 'rounded-l'}
          ${cutR ? 'rounded-r-none border-r-0' : 'rounded-r'}
        `}
      >
        {!clip.isRepeat && <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />}
        {!cutL && !clip.isRepeat && <div onPointerDown={beginClipResize(clip, 'left')} className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10" />}
        <span className="text-[8px] font-bold truncate text-white drop-shadow pointer-events-none flex-1 px-1 relative z-10">
          {clip.label}{repeatSuffix}
        </span>
        <button onClick={e => { e.stopPropagation(); usePlayerStore.getState().previewRange?.(clip.start, clip.end); }} onPointerDown={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-white text-[8px] px-0.5 shrink-0 relative z-10">▶</button>
        {clip.kind === 'loop' && !clip.isRepeat && (
          <button
            onClick={e => { e.stopPropagation(); useLoopSaltoWizardStore.getState().markRepeatOccurrence(clip.regionId); }}
            onPointerDown={e => e.stopPropagation()}
            title="Marcar repetição desta seção no áudio"
            className="opacity-0 group-hover:opacity-100 text-white text-[8px] px-0.5 shrink-0 relative z-10"
          >↻</button>
        )}
        {clip.kind === 'section' && !clip.isRepeat && (
          <button
            onClick={e => { e.stopPropagation(); setModifyPopup({ step: 'menu', regionId: clip.regionId, x: e.clientX, y: e.clientY }); }}
            onPointerDown={e => e.stopPropagation()}
            title="Modificar este trecho"
            className="opacity-0 group-hover:opacity-100 text-white text-[8px] px-0.5 shrink-0 relative z-10"
          >⚙</button>
        )}
        <button onClick={handleDelete} onPointerDown={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-white text-[9px] px-0.5 mr-0.5 shrink-0 relative z-10 font-bold">×</button>
        {!cutR && !clip.isRepeat && <div onPointerDown={beginClipResize(clip, 'right')} className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10" />}
      </div>
    );
  };

  const previewRange = drag?.mode === 'create' ? { start: drag.start, end: drag.end } : null;

  // Adaptive ruler ticks
  const tickStep  = vDur <= 10 ? 0.5 : vDur <= 30 ? 1 : vDur <= 120 ? 5 : 10;
  const labelStep = vDur <= 10 ? 2   : vDur <= 30 ? 5 : vDur <= 120 ? 15 : 30;

  // Minimap view handle geometry
  const mapHandleL = (vStart / dur) * 100;
  const mapHandleW = Math.max((vDur   / dur) * 100, 1);

  return (
    <>
    <div
      className="flex flex-col shrink-0 select-none bg-[#d4d0c8] border-t-2 border-[#316ac5]"
      style={{ height: TIMELINE_H }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-1 px-2 border-b border-gray-400 bg-[#d4d0c8]"
        style={{ height: TOOLBAR_H }}
      >
        {/* Transport */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => seek(0)}
          disabled={!playerReady}
          title="Reiniciar"
          className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 text-[10px] font-bold border border-gray-400 hover:bg-white disabled:opacity-40 leading-none"
          style={{ height: 16 }}
        >⏮</button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={play}
          disabled={!playerReady}
          title="Play"
          className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 text-[10px] font-bold border border-gray-400 hover:bg-white disabled:opacity-40 leading-none"
          style={{ height: 16 }}
        >▶</button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={pause}
          disabled={!playerReady}
          title="Pausar"
          className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 text-[10px] font-bold border border-gray-400 hover:bg-white disabled:opacity-40 leading-none"
          style={{ height: 16 }}
        >⏸</button>

        <span className="font-mono font-bold text-[#002fa7] text-[9px] tabular-nums ml-0.5">
          {formatSeconds(playerCurrentTime)}
        </span>

        {/* Divider */}
        <div className="w-px bg-gray-400 self-stretch my-1 mx-1" />

        {/* Zoom */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => applyZoom(0.67, playerCurrentTime)}
          title="Ampliar"
          className="bevel-out bg-[var(--color-winxp-panel)] w-4 text-[10px] font-bold border border-gray-400 hover:bg-white leading-none flex items-center justify-center"
          style={{ height: 16 }}
        >+</button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => applyZoom(1.5, playerCurrentTime)}
          title="Reduzir"
          className="bevel-out bg-[var(--color-winxp-panel)] w-4 text-[10px] font-bold border border-gray-400 hover:bg-white leading-none flex items-center justify-center"
          style={{ height: 16 }}
        >−</button>
        {!isFullView && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { setViewStart(0); setViewEnd(0); }}
            title="Ver tudo"
            className="bevel-out bg-[var(--color-winxp-panel)] w-4 text-[9px] font-bold border border-gray-400 hover:bg-white leading-none flex items-center justify-center"
            style={{ height: 16 }}
          >⊡</button>
        )}

        {/* Duration — right-aligned */}
        {duration > 0 && (
          <span className="ml-auto text-[8px] font-mono text-gray-500 tabular-nums">
            ⏱ {formatSeconds(duration)}
          </span>
        )}
      </div>

      {/* ── Gutter + track area ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

      {/* ── Label gutter ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col border-r border-gray-400 bg-[#d4d0c8]" style={{ width: GUTTER_W }}>

        {/* Ruler corner — visual only, matches ruler bg */}
        <div className="border-b border-gray-400 bg-[#c8c4bc]" style={{ height: RULER_H }} />

        {/* Track labels */}
        {TRACK_ORDER.map(kind => (
          <div
            key={kind}
            className="flex items-center justify-end pr-1.5 border-b border-gray-300"
            style={{ height: TRACK_H }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: TRACK_ACCENT[kind] }}>
              {TRACK_LABEL[kind]}
            </span>
          </div>
        ))}

        {/* Minimap corner */}
        <div className="border-b border-gray-400 bg-[#c0bcb4]" style={{ height: SCROLL_H }} />
      </div>

      {/* ── Track area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Ruler — drag to pan */}
        <div
          className="shrink-0 bg-[#c8c4bc] border-b border-gray-400 relative overflow-hidden select-none"
          style={{ height: RULER_H, cursor: duration ? 'ew-resize' : 'default' }}
          onPointerDown={handleRulerDown}
          onPointerMove={handleRulerMove}
          onPointerUp={handleRulerUp}
          onPointerCancel={handleRulerUp}
        >
          {duration > 0 ? (
            <>
              {/* View-range shading */}
              {!isFullView && (
                <div
                  className="absolute inset-y-0 bg-white/20 pointer-events-none"
                  style={{ left: `${(vStart / dur) * 100}%`, width: `${(vDur / dur) * 100}%` }}
                />
              )}
              {/* Ticks */}
              {Array.from({ length: Math.floor((vEnd - vStart) / tickStep) + 2 }).map((_, i) => {
                const sec = Math.ceil(vStart / tickStep) * tickStep + i * tickStep;
                if (sec < vStart - 0.001 || sec > vEnd + 0.001) return null;
                const isLabel = sec % labelStep < 0.001;
                const isMid   = !isLabel && sec % (labelStep / 2) < 0.001;
                return (
                  <div
                    key={sec}
                    className={`absolute top-0 border-l pointer-events-none
                      ${isLabel ? 'h-full border-gray-500' : isMid ? 'h-3/5 border-gray-400' : 'h-2/5 border-gray-300'}`}
                    style={{ left: `${((sec - vStart) / vDur) * 100}%` }}
                  >
                    {isLabel && (
                      <span className="text-[8px] text-gray-600 ml-0.5 absolute top-0.5 leading-none font-mono whitespace-nowrap">
                        {formatSeconds(sec)}
                      </span>
                    )}
                  </div>
                );
              })}
              <span className="absolute right-1 inset-y-0 flex items-center text-[7px] text-gray-500 font-mono pointer-events-none">
                {formatSeconds(duration)}
              </span>
            </>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-gray-500 pointer-events-none italic">
              Adicione mídia para usar a timeline
            </span>
          )}
        </div>

        {/* Track rows */}
        <div
          ref={trackAreaRef}
          className={`flex-1 relative overflow-hidden ${creationKind ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={handleAreaDown}
          onPointerMove={handleAreaMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onWheel={handleAreaWheel}
        >
          {TRACK_ORDER.map((kind, i) => (
            <div
              key={kind}
              className="absolute left-0 right-0 border-b border-gray-300 overflow-hidden"
              style={{ top: i * TRACK_H, height: TRACK_H, backgroundColor: TRACK_BG[kind] }}
            >
              {/* Grid lines aligned with ticks */}
              {duration > 0 && Array.from({ length: Math.floor((vEnd - vStart) / tickStep) + 2 }).map((_, j) => {
                const sec = Math.ceil(vStart / tickStep) * tickStep + j * tickStep;
                if (sec <= vStart + 0.001 || sec > vEnd + 0.001) return null;
                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-gray-200 pointer-events-none"
                    style={{ left: `${((sec - vStart) / vDur) * 100}%` }}
                  />
                );
              })}
              {tracks[kind].map(renderClip)}
            </div>
          ))}

          {/* Marker pins */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedMarkers
              .filter(mk => mk.time >= vStart && mk.time <= vEnd)
              .map((mk) => {
                const m = markerMeta[mk.type];
                const left = ((mk.time - vStart) / vDur) * 100;
                const isLinkable = mk.type === 'to_coda' || mk.type === 'd_s_al_coda' || mk.type === 'd_s_al_fine';
                const hasLink = !!mk.targetMarkerId;
                return (
                  <div key={mk.id}
                    title={`${m.name} — ${m.description} (${formatSeconds(mk.time)})${isLinkable && !hasLink ? ' · sem destino vinculado (clique para vincular)' : ''}`}
                    onClick={() => isLinkable && onMarkerClick?.(mk.id)}
                    className={`absolute top-0 bottom-0 z-20 pointer-events-auto ${isLinkable ? 'cursor-pointer' : 'cursor-help'}`}
                    style={{ left: `${left}%` }}
                  >
                    <div className="absolute inset-y-0 left-0 w-px opacity-75" style={{ backgroundColor: m.pinColor }} />
                    <span
                      className="absolute top-0.5 text-[7px] font-bold text-white px-0.5 rounded leading-none whitespace-nowrap"
                      style={{
                        backgroundColor: m.pinColor,
                        transform: 'translateX(-50%)',
                        outline: isLinkable && !hasLink ? '1px dashed rgba(255,255,255,0.7)' : undefined,
                      }}
                    >{m.symbol}</span>
                  </div>
                );
              })}
          </div>

          {/* Jump arcs — data-driven, one arc per targetMarkerId link + one per D.C. marker
              (legacy — Prompt A, kept as-is for old saved data) PLUS one per useDerivedJumps
              pair (new — auto-detected from two sections sharing a line range, see
              useLoopSaltoWizardStore.ts header). Purely additive: the two sources are never
              reconciled against each other, just drawn side by side with a distinct style. */}
          {(() => {
            const tracksH = TRACK_ORDER.length * TRACK_H;

            // arc color by direction: jumps-back = orange, jumps-forward (to coda) = teal
            const arcColor = (fromT: number, toT: number) => fromT > toT ? '#c2410c' : '#0f766e';

            // up = true → top arc (jump back); false → bottom arc (jump forward)
            const arcDir = (fromT: number, toT: number) => fromT > toT;

            const renderArc = (
              fromT: number, toT: number, color: string, up: boolean, key: string, stackIdx: number,
              derived = false,
            ) => {
              const l = ((Math.min(fromT, toT) - vStart) / vDur) * 100;
              const r = ((Math.max(fromT, toT) - vStart) / vDur) * 100;
              const w = r - l;
              if (w < 0.1 || l > 100 || r < 0) return null;
              const stack = stackIdx * 4;
              return (
                <div key={key} title={derived ? 'Salto detectado automaticamente (mesmo trecho de texto repetido)' : undefined}
                  className="absolute z-10 opacity-50 pointer-events-none" style={{
                  left: `${l}%`, width: `${w}%`,
                  top:    up ? 2 + stack : tracksH * 0.3 + stack,
                  height: Math.max(4, tracksH * 0.5 - stack),
                  border: `1.5px ${derived ? 'dotted' : 'dashed'} ${color}`,
                  borderBottom: up  ? 'none' : undefined,
                  borderTop:    !up ? 'none' : undefined,
                  borderRadius: up  ? '50% 50% 0 0' : '0 0 50% 50%',
                }} />
              );
            };

            // 1. Explicit links: markers with targetMarkerId (to_coda → coda, d_s_* → segno)
            const linkedArcs = sortedMarkers
              .filter(mk => mk.targetMarkerId)
              .flatMap(mk => {
                const target = sortedMarkers.find(t => t.id === mk.targetMarkerId);
                return target ? [{ fromT: mk.time, toT: target.time, key: `arc-${mk.id}-${target.id}` }] : [];
              });

            // 2. Da Capo: implicit jump back to time=0 (no targetMarkerId needed)
            const daCapoArcs = sortedMarkers
              .filter(mk => mk.type === 'd_c_al_coda' || mk.type === 'd_c_al_fine')
              .map(mk => ({ fromT: mk.time, toT: 0, key: `arc-dc-${mk.id}` }));

            const allArcs = [...linkedArcs, ...daCapoArcs];

            // 3. Derived jumps (new): two sections sharing the exact same line range — the later
            // one (by startTime) jumps back to the first. Distinct violet/dotted style so it
            // reads as "auto-detected" rather than "marked by hand" like the legacy arcs above.
            const derivedArcs = derivedJumps.flatMap(({ fromRegionId, toRegionId }) => {
              const from = regions.find(r => r.id === fromRegionId);
              const to = regions.find(r => r.id === toRegionId);
              if (!from || !to || from.startTime == null || to.startTime == null) return [];
              return [{ fromT: from.startTime, toT: to.startTime, key: `derived-${fromRegionId}-${toRegionId}` }];
            });

            return (
              <>
                {allArcs.map(({ fromT, toT, key }, idx) =>
                  renderArc(fromT, toT, arcColor(fromT, toT), arcDir(fromT, toT), key, idx)
                )}
                {derivedArcs.map(({ fromT, toT, key }, idx) =>
                  renderArc(fromT, toT, '#7c3aed', arcDir(fromT, toT), key, allArcs.length + idx, true)
                )}
              </>
            );
          })()}

          {/* Create-drag preview */}
          {previewRange && (() => {
            const l = ((Math.max(previewRange.start, vStart) - vStart) / vDur) * 100;
            const r = ((Math.min(previewRange.end,   vEnd)   - vStart) / vDur) * 100;
            return (
              <div className="absolute pointer-events-none bg-[#316ac5]/20 border border-[#316ac5]/50 z-30"
                style={{ top: 0, bottom: 0, left: `${l}%`, width: `${Math.max(r - l, 0.2)}%` }} />
            );
          })()}

          {/* Playhead */}
          {duration > 0 && playerCurrentTime >= vStart && playerCurrentTime <= vEnd && (
            <div
              className="absolute top-0 bottom-0 z-40 pointer-events-none"
              style={{ left: `${((playerCurrentTime - vStart) / vDur) * 100}%` }}
            >
              <div className="absolute inset-y-0 left-0 w-px bg-[#cc3300]" style={{ boxShadow: '0 0 3px #cc330066' }} />
            </div>
          )}
        </div>

        {/* ── Minimap scrollbar ─────────────────────────────────────────── */}
        <div
          ref={minimapRef}
          className="shrink-0 relative bg-[#c0bcb4] border-t border-gray-400 overflow-hidden"
          style={{ height: SCROLL_H, cursor: duration ? 'pointer' : 'default' }}
          onPointerDown={handleMapDown}
          onPointerMove={handleMapMove}
          onPointerUp={handleMapUp}
          onPointerCancel={handleMapUp}
        >
          {/* Section clips as color bands in minimap */}
          {duration > 0 && tracks.section.map(clip => (
            <div
              key={clip.regionId}
              className="absolute top-[1px] bottom-[1px] opacity-60"
              style={{
                left:            `${(clip.start / dur) * 100}%`,
                width:           `${Math.max(((clip.end - clip.start) / dur) * 100, 0.3)}%`,
                backgroundColor: clip.color,
              }}
            />
          ))}
          {/* Playhead in minimap */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#cc3300] z-10 pointer-events-none"
              style={{ left: `${(playerCurrentTime / dur) * 100}%` }}
            />
          )}
          {/* View window handle */}
          {!isFullView && duration > 0 && (
            <div
              className="absolute top-0 bottom-0 border border-[#316ac5] bg-[#316ac5]/15 z-20 pointer-events-none"
              style={{ left: `${mapHandleL}%`, width: `${mapHandleW}%` }}
            />
          )}
          {/* Full-view indicator */}
          {isFullView && duration > 0 && (
            <div className="absolute inset-0 border border-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      </div>{/* end gutter+track row */}
    </div>

    {/* ── "Modificar" clip popup ──────────────────────────────────────────── */}
    {modifyPopup && (() => {
      const region = regions.find(r => r.id === modifyPopup.regionId);
      if (!region) return null;
      const left = Math.min(modifyPopup.x, window.innerWidth - 220);
      const bottom = Math.max(8, window.innerHeight - modifyPopup.y + 8);
      const closePopup = () => setModifyPopup(null);

      if (modifyPopup.step === 'menu') {
        const candidate = findLoopConversionOccurrences(modifyPopup.regionId, regions, derivedJumps);
        return (
          <>
            <div className="fixed inset-0 z-[9996]" onClick={closePopup} />
            <div className="fixed z-[9997] bevel-out bg-[#ece9d8] border-2 border-[#316ac5] p-2 shadow-xl flex flex-col gap-1.5 w-52"
              style={{ left, bottom }}
            >
              <p className="font-bold text-[11px] text-[#002fa7] truncate">{region.label || region.kind}</p>
              <button
                onClick={() => setModifyPopup({ step: 'reclassify', regionId: modifyPopup.regionId, x: modifyPopup.x, y: modifyPopup.y })}
                className="bevel-out bg-white border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left"
              >🏷 Reclassificar como…</button>
              {candidate && (
                <button
                  onClick={() => setModifyPopup({
                    step: 'convert-loop', regionId: modifyPopup.regionId, x: modifyPopup.x, y: modifyPopup.y,
                    occurrences: candidate, repeatCount: candidate.length,
                  })}
                  className="bevel-out bg-white border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left"
                >🔁 Converter em Loop…</button>
              )}
              <button onClick={closePopup} className="text-[9px] text-gray-500 hover:text-gray-700 text-center mt-0.5">Fechar</button>
            </div>
          </>
        );
      }

      if (modifyPopup.step === 'reclassify') {
        return (
          <>
            <div className="fixed inset-0 z-[9996]" onClick={closePopup} />
            <div className="fixed z-[9997] bevel-out bg-[#ece9d8] border-2 border-[#316ac5] p-2 shadow-xl flex flex-col gap-1 w-52 max-h-64 overflow-y-auto"
              style={{ left, bottom }}
            >
              <p className="font-bold text-[11px] text-[#002fa7]">Reclassificar como</p>
              {SECTION_ORDER.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    useTimingRegionsStore.getState().updateRegion(modifyPopup.regionId, { sectionType: t });
                    closePopup();
                  }}
                  className={`bevel-out border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left ${region.sectionType === t ? 'bg-blue-100' : 'bg-white'}`}
                >{SECTION_TYPE_LABEL[t]}</button>
              ))}
              <button onClick={closePopup} className="text-[9px] text-gray-500 hover:text-gray-700 text-center mt-0.5">Cancelar</button>
            </div>
          </>
        );
      }

      // step === 'convert-loop'
      const { occurrences, repeatCount } = modifyPopup;
      return (
        <>
          <div className="fixed inset-0 z-[9996]" onClick={closePopup} />
          <div className="fixed z-[9997] bevel-out bg-[#ece9d8] border-2 border-[#316ac5] p-2 shadow-xl flex flex-col gap-1.5 w-60"
            style={{ left, bottom }}
          >
            <p className="font-bold text-[11px] text-[#002fa7]">Converter em Loop</p>
            <p className="text-[9px] text-gray-600">{occurrences.length} ocorrências detectadas neste trecho.</p>
            <label className="text-[9px] text-gray-700 flex items-center gap-1">
              Repetições esperadas:
              <input
                type="number" min={occurrences.length} value={repeatCount}
                onChange={e => setModifyPopup({ ...modifyPopup, repeatCount: Math.max(occurrences.length, Number(e.target.value) || occurrences.length) })}
                className="w-12 border border-gray-400 px-1 text-[10px]"
              />
            </label>
            <button
              onClick={() => { commitLoopConversion(occurrences, repeatCount); closePopup(); }}
              className="bevel-out bg-white border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left"
            >✓ Confirmar</button>
            <button onClick={closePopup} className="text-[9px] text-gray-500 hover:text-gray-700 text-center mt-0.5">Cancelar</button>
          </div>
        </>
      );
    })()}
    </>
  );
};
