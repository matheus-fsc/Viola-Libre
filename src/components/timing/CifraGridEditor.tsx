import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { formatSeconds } from '../../services/timingApi';
import { isChordLine, parseChordLine } from '../../services/cifraUtils';
import type { ChordPos } from '../../services/cifraUtils';
import type { TimingRegion } from '../../services/timingRegions';
import { classifyLine } from '../../utils/lineClassifier';
import { getRegionColor } from './timingTracks';
import { useCifraTextStore } from '../../stores/useCifraTextStore';
import { useTimingRegionsStore } from '../../stores/useTimingRegionsStore';
import { useTimingSelectionStore } from '../../stores/useTimingSelectionStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { InlineMarkerDot } from './InlineMarkerDot';

export { isChordLine } from '../../services/cifraUtils';

// ── Chord parsing ────────────────────────────────────────────────────────────
const SECTION_LINE_RE = /^\[([^\]]+)\]$/;
const INSTR_RE = /\b(interlude|interlúdio|interludio|solo|ponte|bridge|instrumental|intro|introdução|introducao|finalização)\b/i;

// isChordLine, ChordPos, parseChordLine, buildChordLineText → cifraUtils.ts

// ── Block parsing ────────────────────────────────────────────────────────────
type Block =
  | { type: 'section';    idx: number; label: string }
  | { type: 'pair';       chordIdx: number | null; lyricIdx: number }
  | { type: 'chord_only'; chordIdx: number }
  | { type: 'tab_block';  startIdx: number; endIdx: number }
  | { type: 'empty';      idx: number };

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (SECTION_LINE_RE.test(trimmed)) {
      blocks.push({ type: 'section', idx: i, label: trimmed.match(SECTION_LINE_RE)![1] });
      i++;
    } else if (!trimmed) {
      blocks.push({ type: 'empty', idx: i });
      i++;
    } else if (classifyLine(line) === 'tab') {
      // Consume all consecutive tab lines into one block (blank line ends it)
      const startIdx = i;
      let endIdx = i;
      i++;
      while (i < lines.length && lines[i].trim() !== '' && classifyLine(lines[i]) === 'tab') {
        endIdx = i;
        i++;
      }
      blocks.push({ type: 'tab_block', startIdx, endIdx });
    } else if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !SECTION_LINE_RE.test(next.trim()) && !isChordLine(next) && classifyLine(next) !== 'tab') {
        blocks.push({ type: 'pair', chordIdx: i, lyricIdx: i + 1 });
        i += 2;
      } else {
        blocks.push({ type: 'chord_only', chordIdx: i });
        i++;
      }
    } else {
      blocks.push({ type: 'pair', chordIdx: null, lyricIdx: i });
      i++;
    }
  }
  return blocks;
}

// ── Dot helpers (chord drag guide) ──────────────────────────────────────────
function dotOpacity(col: number, currentCol: number): number {
  return Math.max(0.07, Math.exp(-0.5 * ((col - currentCol) / 4) ** 2) * 0.92);
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface CifraGridEditorProps {
  lineRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  onLineClick: (idx: number) => void;
  /** Starts the reassign-lines flow for a specific region — state lives in TimingEditor (shared
   *  with its own "Trechos vinculados" sidebar list, which triggers the same flow). */
  onStartReassign: (region: TimingRegion) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const FONT = '"Fira Code", "Courier New", monospace';
const LYRIC_SIZE = 11;
const CHORD_SIZE = 10;
const CHORD_TOKENS_H = 13;
const CHORD_DOT_H = 7;
const CHORD_H = CHORD_TOKENS_H + CHORD_DOT_H;
const LYRIC_H = 20;
const GUTTER_W = 32;

// ── Component ────────────────────────────────────────────────────────────────
export const CifraGridEditor: React.FC<CifraGridEditorProps> = ({
  lineRefs, onLineClick, onStartReassign,
}) => {
  const { lines, chordDragVisual } = useCifraTextStore();
  const { regions, markers } = useTimingRegionsStore();
  const { selectionMode, selectionStart, selectionEnd } = useTimingSelectionStore();
  const blocks = useMemo(() => parseBlocks(lines), [lines]);

  // ── Line-link margin indicator ──
  // Every region with both a line range AND a time range fully set gets a small colored bar
  // in the left margin, for every line it covers — regardless of kind (section/loop/instrumental/
  // phrase), same color as TimingTimeline's clips (getRegionColor). Precomputed once per
  // `regions` change into a lineIdx → regions[] map so per-row rendering is a plain lookup.
  const linkedLineRegions = useMemo(() => {
    const map = new Map<number, TimingRegion[]>();
    for (const r of regions) {
      if (r.startLine == null || r.endLine == null || r.startTime == null || r.endTime == null) continue;
      for (let i = r.startLine; i <= r.endLine; i++) {
        const arr = map.get(i) ?? [];
        arr.push(r);
        map.set(i, arr);
      }
    }
    return map;
  }, [regions]);

  // Small context-menu-style popup opened by clicking a line-link bar — shows the linked time
  // range and offers to preview it or reassign its lines, without reopening the full Wizard 3.
  const [linkPopup, setLinkPopup] = useState<{ regionId: string; x: number; y: number } | null>(null);
  const linkPopupRegion = linkPopup ? regions.find(r => r.id === linkPopup.regionId) ?? null : null;

  // Reassign-lines flow lives in TimingEditor now (onStartReassign prop) — the sidebar's own
  // "Trechos vinculados" list needs to trigger the exact same flow (and read the exact same
  // in-progress state) as this popup's "Reatribuir linhas" button, so the state can't be local
  // to just one of the two components without risking the two going out of sync.
  const openLinkPopup = useCallback((e: React.MouseEvent, regionId: string) => {
    e.stopPropagation();
    setLinkPopup({ regionId, x: e.clientX, y: e.clientY });
  }, []);

  // Renders one thin clickable bar per region covering this line — click opens the popup for
  // that specific region (stopPropagation so it doesn't also trigger the row's onLineClick).
  const renderLineLinkBars = useCallback((lineIdx: number) => {
    const covering = linkedLineRegions.get(lineIdx);
    if (!covering || covering.length === 0) return <span style={{ width: 3 }} className="shrink-0" />;
    return (
      <span className="flex gap-px shrink-0 self-stretch">
        {covering.map(r => (
          <button
            key={r.id}
            onClick={e => openLinkPopup(e, r.id)}
            title={`${r.label || r.kind} — ${formatSeconds(r.startTime ?? 0)}–${formatSeconds(r.endTime ?? 0)} (clique para ver/ajustar o vínculo)`}
            className="w-[3px] self-stretch rounded-full hover:opacity-60"
            style={{ backgroundColor: getRegionColor(r) }}
          />
        ))}
      </span>
    );
  }, [linkedLineRegions, openLinkPopup]);

  // ── Char-width ruler ──
  const rulerRef = useRef<HTMLSpanElement>(null);
  const getCharW = useCallback(() => rulerRef.current?.getBoundingClientRect().width ?? 8, []);

  // Renders the InlineMarkerDot for every marker anchored on this line (has both line + col set).
  // Purely passive display of legacy marker data (Prompt A) — there is no click-to-place/select
  // flow anymore (manual Segno/Coda/to_coda/D.C./D.S. creation was removed; see
  // useLoopSaltoWizardStore.ts header).
  const renderMarkerDots = useCallback((lineIdx: number) => {
    const lineMarkers = markers.filter(m => m.line === lineIdx && m.col !== undefined);
    if (lineMarkers.length === 0) return null;
    return lineMarkers.map(m => <InlineMarkerDot key={m.id} type={m.type} col={m.col!} />);
  }, [markers]);

  // ── Chord drag handlers ──
  const handleChordMouseDown = useCallback((
    e: React.MouseEvent, lineIdx: number, tokenIdx: number, chords: ChordPos[],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    useCifraTextStore.getState().startChordDrag(lineIdx, tokenIdx, chords, e.clientX, getCharW());
  }, [getCharW]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => useCifraTextStore.getState().updateChordDrag(e.clientX);
    const onUp = () => useCifraTextStore.getState().endChordDrag();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Appearance ──
  const getLineBg = (idx: number): { className: string; style?: React.CSSProperties } => {
    if (selectionStart !== null && selectionEnd === null && idx === selectionStart)
      return { className: 'bg-yellow-200 border-l-2 border-yellow-500' };
    if (selectionStart !== null && selectionEnd !== null && idx >= selectionStart && idx <= selectionEnd)
      return { className: 'bg-yellow-100' };
    const inLoop   = regions.some(r => r.kind === 'loop' && r.startLine !== null && r.endLine !== null && idx >= r.startLine! && idx <= r.endLine!);
    const inInstr  = regions.some(r => r.kind === 'instrumental' && r.startLine !== null && r.endLine !== null && idx >= r.startLine! && idx <= r.endLine!);
    const inPhrase = regions.some(r => r.kind === 'phrase' && r.startLine === idx);
    if (inLoop && inInstr) return { className: 'bg-purple-100', style: { borderLeft: '2px solid #a855f7' } };
    if (inPhrase)  return { className: 'bg-purple-50',  style: { borderLeft: '2px solid #a855f7' } };
    if (inLoop)    return { className: 'bg-blue-50',    style: { borderLeft: '2px solid #3b82f6' } };
    if (inInstr)   return { className: 'bg-green-50',   style: { borderLeft: '2px solid #22c55e' } };
    return { className: '' };
  };

  const clickable = !!selectionMode;

  // ── Chord row renderer ──
  const renderChordRow = (chordLineIdx: number, lyricLen = 60) => {
    const chords = parseChordLine(lines[chordLineIdx]);
    if (chords.length === 0) return null;
    const isDragging = chordDragVisual?.lineIdx === chordLineIdx;
    const maxDotCol = Math.max(lyricLen, ...chords.map(c => c.col + c.text.length + 10));
    const dotCount = Math.ceil(maxDotCol / 2);

    return (
      <div className="relative flex" style={{ height: CHORD_H }}>
        {/* Empty gutter — chord lines are not numbered */}
        <div className="shrink-0" style={{ width: GUTTER_W }} />
        <div className="relative flex-1" style={{ height: CHORD_H }}>
          {/* Tokens */}
          {chords.map((c, ci) => (
            <span
              key={ci}
              className="absolute font-bold cursor-ew-resize select-none"
              style={{
                left: `calc(${c.col} * 1ch)`, top: 0,
                fontSize: CHORD_SIZE, lineHeight: `${CHORD_TOKENS_H}px`,
                color: '#316ac5', whiteSpace: 'nowrap',
              }}
              title={`${c.text} — arraste para reposicionar`}
              onMouseDown={e => handleChordMouseDown(e, chordLineIdx, ci, chords)}
            >
              {c.text}
            </span>
          ))}
          {/* Position dots */}
          <div style={{ position: 'absolute', top: CHORD_TOKENS_H, height: CHORD_DOT_H, left: 0, right: 0, pointerEvents: 'none' }}>
            {Array.from({ length: dotCount }, (_, i) => {
              const col = i * 2;
              const op = isDragging && chordDragVisual ? dotOpacity(col, chordDragVisual.currentCol) : 0;
              return (
                <span key={col} style={{
                  position: 'absolute', left: `calc(${col} * 1ch)`, top: 2,
                  width: 3, height: 3, borderRadius: '50%',
                  background: '#316ac5', opacity: op,
                  transition: isDragging ? 'opacity 60ms' : 'none',
                }} />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <>
    <div
      style={{ fontFamily: FONT, fontSize: LYRIC_SIZE }}
    >
      <span ref={rulerRef} aria-hidden style={{
        position: 'fixed', top: -9999, left: -9999,
        fontFamily: FONT, fontSize: LYRIC_SIZE,
        whiteSpace: 'pre', visibility: 'hidden', pointerEvents: 'none',
      }}>0</span>

      {blocks.map((block, bi) => {
        if (block.type === 'empty') return <div key={bi} style={{ height: 4 }} />;

        if (block.type === 'section') {
          const isInstr = INSTR_RE.test(block.label);
          return (
            <div key={bi} ref={el => { lineRefs.current[block.idx] = el; }}
              className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1 border-t border-b font-bold text-[10px] uppercase tracking-wider ${isInstr ? 'bg-green-100 border-green-300 text-green-800' : 'bg-blue-100 border-blue-200 text-blue-800'}`}>
              <span className="text-gray-400 font-normal w-6 text-right shrink-0 font-mono text-[9px]">{block.idx + 1}</span>
              <span>{isInstr ? '🎸' : '♪'} {block.label}</span>
            </div>
          );
        }

        if (block.type === 'chord_only') {
          return (
            <div key={bi} ref={el => { lineRefs.current[block.chordIdx] = el; }}>
              {renderChordRow(block.chordIdx)}
            </div>
          );
        }

        // ── Tab block — all string lines grouped under one line number ──
        if (block.type === 'tab_block') {
          const { startIdx, endIdx } = block;
          const { className: bgClass, style: bgStyle } = getLineBg(startIdx);
          const phraseBadge = regions.find(r => r.kind === 'phrase' && r.startLine === startIdx);
          const tabLines = lines.slice(startIdx, endIdx + 1);
          return (
            <div key={bi} ref={el => { lineRefs.current[startIdx] = el; }}
              className={bgClass} style={bgStyle}
            >
              <div className={`flex items-start gap-1 ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                onClick={() => onLineClick(startIdx)}>
                {renderLineLinkBars(startIdx)}
                <span className="shrink-0 text-right text-gray-300 text-[9px] pr-1 select-none mt-0.5"
                      style={{ width: GUTTER_W, lineHeight: `${LYRIC_H}px` }}>
                  {startIdx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {tabLines.map((tl, ti) => (
                    <div key={ti} className="whitespace-pre text-gray-500 leading-tight"
                         style={{ fontSize: LYRIC_SIZE, lineHeight: `${LYRIC_H}px` }}>
                      {tl || ' '}
                    </div>
                  ))}
                </div>
                {phraseBadge && (
                  <span className="text-[8px] bg-purple-100 text-purple-600 px-1 shrink-0 font-sans whitespace-nowrap pointer-events-none mt-0.5">
                    🎵 {formatSeconds(phraseBadge.startTime ?? 0)}–{formatSeconds(phraseBadge.endTime ?? 0)}
                  </span>
                )}
              </div>
            </div>
          );
        }

        // ── Pair ──
        const { chordIdx, lyricIdx } = block;
        const lyricLen = lines[lyricIdx]?.length ?? 0;
        const { className: bgClass, style: bgStyle } = getLineBg(lyricIdx);
        const phraseBadge = regions.find(r => r.kind === 'phrase' && r.startLine === lyricIdx);
        const loopBadge   = regions.find(r => r.kind === 'loop' && r.startLine === lyricIdx);
        const instrBadge  = regions.find(r => r.kind === 'instrumental' && r.startLine === lyricIdx);

        return (
          <div key={bi} className={bgClass} style={bgStyle}>
            {chordIdx !== null && renderChordRow(chordIdx, lyricLen)}

            <div
              ref={el => { lineRefs.current[lyricIdx] = el; }}
              onClick={() => onLineClick(lyricIdx)}
              className={`flex items-center gap-1 ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
              style={{ minHeight: LYRIC_H }}
            >
              {renderLineLinkBars(lyricIdx)}
              <span className="shrink-0 text-right text-gray-300 text-[9px] pr-1 select-none"
                    style={{ width: GUTTER_W, lineHeight: `${LYRIC_H}px` }}>
                {lyricIdx + 1}
              </span>
              <span className="whitespace-pre text-gray-800 flex-1 relative"
                    style={{ fontSize: LYRIC_SIZE, lineHeight: `${LYRIC_H}px` }}>
                {lines[lyricIdx] || ' '}
                {renderMarkerDots(lyricIdx)}
              </span>
              {phraseBadge && (
                <span className="text-[8px] bg-purple-100 text-purple-600 px-1 shrink-0 font-sans whitespace-nowrap pointer-events-none">
                  🎤 {formatSeconds(phraseBadge.startTime ?? 0)}–{formatSeconds(phraseBadge.endTime ?? 0)}
                </span>
              )}
              {loopBadge && (
                <span className="text-[8px] bg-blue-100 text-blue-600 px-1 shrink-0 font-sans whitespace-nowrap pointer-events-none">🔁 {loopBadge.label}</span>
              )}
              {instrBadge && (
                <span className="text-[8px] bg-green-100 text-green-600 px-1 shrink-0 font-sans whitespace-nowrap pointer-events-none">🎸 {instrBadge.label}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {/* ── Line-link popup — opened by clicking a margin bar ── */}
    {linkPopupRegion && (
      <>
        <div className="fixed inset-0 z-[9996]" onClick={() => setLinkPopup(null)} />
        <div
          className="fixed z-[9997] bevel-out bg-[#ece9d8] border-2 border-[#316ac5] p-2 shadow-xl flex flex-col gap-1.5 w-56"
          style={{ left: Math.min(linkPopup!.x, window.innerWidth - 240), top: linkPopup!.y + 8 }}
        >
          <p className="font-bold text-[11px] text-[#002fa7] truncate">
            {linkPopupRegion.label || linkPopupRegion.kind}
          </p>
          <p className="text-[10px] text-gray-600 font-mono">
            {formatSeconds(linkPopupRegion.startTime ?? 0)}–{formatSeconds(linkPopupRegion.endTime ?? 0)}
          </p>
          <p className="text-[9px] text-gray-500">
            Linhas {(linkPopupRegion.startLine ?? 0) + 1}–{(linkPopupRegion.endLine ?? 0) + 1}
          </p>
          <div className="flex flex-col gap-1 mt-1">
            <button
              onClick={() => usePlayerStore.getState().previewRange(linkPopupRegion.startTime!, linkPopupRegion.endTime!)}
              className="bevel-out bg-white border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left"
            >
              ▶ Ouvir
            </button>
            <button
              onClick={() => { onStartReassign(linkPopupRegion); setLinkPopup(null); }}
              className="bevel-out bg-white border border-gray-400 px-2 py-1 text-[10px] font-bold hover:bg-blue-50 text-left"
            >
              🔁 Reatribuir linhas
            </button>
            <button
              onClick={() => setLinkPopup(null)}
              className="text-[9px] text-gray-500 hover:text-gray-700 text-center mt-0.5"
            >
              Fechar
            </button>
          </div>
        </div>
      </>
    )}
    </>
  );
};
