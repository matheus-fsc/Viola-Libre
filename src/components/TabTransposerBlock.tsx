import React, { useState, useMemo, useEffect } from 'react';
import {
  parseTabText,
  transposeTab,
  getTuningLabelsHighToLow,
  getTuningMidiHighToLow,
  type ParsedTab,
} from '../engine/tabTransposer';

interface Props {
  originalText: string;
  targetStrings: number[];   // from current tuning (low to high)
  targetLabel: string;       // e.g., "Viola Caipira — Cebolão em Ré"
  extraSemitones?: number;   // from chord transpose offset
}

// Named neck positions for cycling (fret bias for findBestPosition)
const POSITIONS = [
  { label: 'Aberta', fret: 0 },
  { label: '5ª',     fret: 5 },
  { label: '7ª',     fret: 7 },
  { label: '12ª',    fret: 12 },
];

export const TabTransposerBlock: React.FC<Props> = ({
  originalText,
  targetStrings,
  targetLabel,
  extraSemitones = 0,
}) => {
  const [posIdx, setPosIdx] = useState(0);

  const parsedTab = useMemo<ParsedTab | null>(() => parseTabText(originalText), [originalText]);

  const targetMidi        = useMemo(() => getTuningMidiHighToLow(targetStrings), [targetStrings]);
  const targetLabelsHtoL  = useMemo(() => getTuningLabelsHighToLow(targetStrings), [targetStrings]);

  // Reset position when instrument or transpose changes
  useEffect(() => { setPosIdx(0); }, [targetMidi, extraSemitones]);

  const isSameInstrument = useMemo(() => {
    if (!parsedTab) return true;
    const srcMidi = parsedTab.rows.map(r => r.midiOpen).filter(m => m > 0);
    if (srcMidi.length === 0) return true;
    return srcMidi.length === targetMidi.length &&
      srcMidi.every((m, i) => Math.abs(m - targetMidi[i]) < 1) &&
      extraSemitones === 0;
  }, [parsedTab, targetMidi, extraSemitones]);

  const transposedText = useMemo(() => {
    if (!parsedTab || isSameInstrument) return null;
    try {
      return transposeTab(
        parsedTab, targetMidi, targetLabelsHtoL,
        extraSemitones, POSITIONS[posIdx].fret
      );
    } catch {
      return null;
    }
  }, [parsedTab, targetMidi, targetLabelsHtoL, extraSemitones, posIdx, isSameInstrument]);

  const displayText = transposedText ?? originalText;
  const canVary     = transposedText !== null;
  const sourceName  = parsedTab?.sourceName ?? '';

  return (
    <div className="my-1">
      {/* Toolbar: source info + Variar button */}
      <div className="flex items-center gap-2 py-0.5 px-1 bg-[#d4d0c8] border-b border-gray-400">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tab</span>

        {parsedTab ? (
          isSameInstrument ? (
            <span className="text-[9px] text-gray-400 italic">{sourceName}</span>
          ) : (
            <>
              <span className="text-[9px] text-gray-500 italic truncate max-w-[100px]" title={sourceName}>
                {sourceName}
              </span>
              <span className="text-[9px] text-gray-400">→</span>
              <span className="text-[9px] text-gray-600 truncate max-w-[100px]">{targetLabel}</span>

              {canVary && (
                <button
                  onClick={() => setPosIdx(v => (v + 1) % POSITIONS.length)}
                  className="ml-auto text-[9px] font-bold px-2 py-0.5 border bevel-out bg-[var(--color-winxp-panel)] text-[#002fa7] border-gray-400 hover:bg-white leading-tight"
                  title={`Variar posição de escala (atual: ${POSITIONS[posIdx].label})`}
                >
                  Variar · {POSITIONS[posIdx].label}
                </button>
              )}
            </>
          )
        ) : (
          <span className="text-[9px] text-gray-400 italic">Tab não reconhecida</span>
        )}
      </div>

      {/* Tab content */}
      <pre className="m-0 font-mono text-sm leading-snug whitespace-pre text-[#444] overflow-x-auto py-1">
        {displayText}
      </pre>
    </div>
  );
};
