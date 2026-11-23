import { InstrumentalIndicator } from './InstrumentalIndicator';
import { isLineInRange } from '../../engine/timingPlayback';
import React, { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { formatSeconds } from '../../services/timingApi';
import { useCifraTextStore } from '../../stores/useCifraTextStore';
import { useTimingRegionsStore } from '../../stores/useTimingRegionsStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useAutoScroll } from '../../hooks/useAutoScroll';

// A prévia usa o relógio do editor para testar sem salvar nem alterar o texto.
export const AutoScrollPreview: React.FC = () => {
  const t = useT();
  const { lines } = useCifraTextStore();
  const { regions } = useTimingRegionsStore();
  const currentTime = usePlayerStore(s => s.currentTime);
  const { activeRegionId, scrollToLine, countdown } = useAutoScroll(regions, currentTime);

  const previousLine = useRef<number | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (scrollToLine === null) return;
    const backwards = previousLine.current != null && scrollToLine < previousLine.current;
    lineRefs.current[scrollToLine]?.scrollIntoView({ block: 'center',
      behavior: backwards || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    previousLine.current = scrollToLine;
  }, [scrollToLine]);

  const activeRegion = activeRegionId ? regions.find(r => r.id === activeRegionId) ?? null : null;

  return (
    <div style={{ fontFamily: '"Fira Code", "Courier New", monospace', fontSize: 11 }}>
      <div className="sticky top-0 z-10 px-3 py-1.5 bg-[#d4d0c8] border-b border-gray-400 text-[10px] flex items-center gap-2">
        <span className="font-bold text-gray-600">{t('timing.testarRolagemBotao')}</span>
        {activeRegion ? (
          <span className="text-[#005500] font-bold">▶ {activeRegion.label || activeRegion.kind}</span>
        ) : (
          <span className="text-gray-600 italic">{t('cifra.rolagemGap')}</span>
        )}
        <span className="ml-auto font-mono text-gray-500">{formatSeconds(currentTime)}</span>
      </div>
      {lines.map((line, idx) => {
        const isActiveLine = isLineInRange(line, idx, activeRegion);
        return (
          <div
            key={idx}
            ref={el => { lineRefs.current[idx] = el; }}
            className={`whitespace-pre px-3 ${isActiveLine ? 'bg-yellow-100 border-l-2 border-yellow-500' : ''}`}
            style={{ lineHeight: '20px', minHeight: 20 }}
          >
            {activeRegion?.kind === 'instrumental' && idx === (activeRegion.startLine ?? scrollToLine) && (
              <InstrumentalIndicator label={activeRegion.label}
                countdown={countdown}
                progress={(currentTime - activeRegion.startTime!) / (activeRegion.endTime! - activeRegion.startTime!)} />
            )}
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
};
