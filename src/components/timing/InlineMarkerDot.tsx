import React from 'react';
import type { MarkerType } from '../../services/timingApi';

const MARKER_DOT_SYMBOL: Partial<Record<MarkerType, string>> = {
  segno:       '𝄋',
  coda:        '𝄉',
  to_coda:     'al 𝄉',
  d_c_al_coda: 'D.C.𝄉',
  d_c_al_fine: 'D.C.',
  d_s_al_coda: 'D.S.𝄉',
  d_s_al_fine: 'D.S.',
};

export interface InlineMarkerDotProps {
  type: MarkerType;
  col: number;
}

// Anchored inline within a lyric line's text span at (col * 1ch) — same unit basis as the
// chord-token rendering in CifraGridEditor's renderChordRow, so the dot lines up with the
// exact character the user clicked. Purely a passive display of legacy marker data (Prompt A) —
// no click-to-place/click-to-select interaction lives here anymore (see useLoopSaltoWizardStore
// header for why: manual Segno/Coda/to_coda/D.C./D.S. creation was removed in favor of
// useDerivedJumps' automatic detection).
export const InlineMarkerDot: React.FC<InlineMarkerDotProps> = ({ type, col }) => {
  const symbol = MARKER_DOT_SYMBOL[type] ?? type;
  return (
    <span
      title={symbol}
      className="absolute inline-flex items-center gap-0.5 -translate-y-1/2"
      style={{ left: `calc(${col} * 1ch)`, top: '50%', zIndex: 5 }}
    >
      <span className="w-2 h-2 rounded-full bg-red-600 border border-white shrink-0" />
      <span className="text-[8px] font-bold text-red-700 font-sans whitespace-nowrap">{symbol}</span>
    </span>
  );
};
