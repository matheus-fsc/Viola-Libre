import React, { useEffect, useRef } from 'react';
import { formatSeconds } from '../../services/timingApi';
import { useCifraTextStore } from '../../stores/useCifraTextStore';
import { useTimingRegionsStore } from '../../stores/useTimingRegionsStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useAutoScroll } from '../../hooks/useAutoScroll';

// Read-only preview: tests auto-scroll against useTimingRegionsStore's in-memory regions
// (nothing needs to be saved first) and usePlayerStore's real playback clock. Deliberately NOT
// built on CifraGridEditor — that component's chord-drag handlers (onMouseDown) have no
// read-only gate, so reusing it here would let a stray click mutate the shared cifra text from
// what's supposed to be a passive scroll check. Renders plain text lines instead: no chord
// tokens, no drag targets, no click handlers. Rendered inside TimingEditor's existing scrollable
// container (see the `overflow-y-auto` wrapper around it) — no scroll container of its own.
export const AutoScrollPreview: React.FC = () => {
  const { lines } = useCifraTextStore();
  const { regions } = useTimingRegionsStore();
  const currentTime = usePlayerStore(s => s.currentTime);
  const { activeRegionId, scrollToLine } = useAutoScroll(regions, currentTime);

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (scrollToLine === null) return;
    lineRefs.current[scrollToLine]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [scrollToLine]);

  const activeRegion = activeRegionId ? regions.find(r => r.id === activeRegionId) ?? null : null;

  return (
    <div style={{ fontFamily: '"Fira Code", "Courier New", monospace', fontSize: 11 }}>
      <div className="sticky top-0 z-10 px-3 py-1.5 bg-[#d4d0c8] border-b border-gray-400 text-[10px] flex items-center gap-2">
        <span className="font-bold text-gray-600">🔍 Testar rolagem</span>
        {activeRegion ? (
          <span className="text-[#005500] font-bold">▶ {activeRegion.label || activeRegion.kind}</span>
        ) : (
          <span className="text-gray-400 italic">— sem seção vinculada neste tempo (gap) —</span>
        )}
        <span className="ml-auto font-mono text-gray-500">{formatSeconds(currentTime)}</span>
      </div>
      {lines.map((line, idx) => {
        const isActiveLine = !!activeRegion
          && activeRegion.startLine !== null && activeRegion.endLine !== null
          && idx >= activeRegion.startLine && idx <= activeRegion.endLine;
        return (
          <div
            key={idx}
            ref={el => { lineRefs.current[idx] = el; }}
            className={`whitespace-pre px-3 ${isActiveLine ? 'bg-yellow-100 border-l-2 border-yellow-500' : ''}`}
            style={{ lineHeight: '20px', minHeight: 20 }}
          >
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
};
