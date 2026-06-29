import React, { useState, useMemo } from 'react';
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

export const TabTransposerBlock: React.FC<Props> = ({
  originalText,
  targetStrings,
  targetLabel,
  extraSemitones = 0,
}) => {
  const [showTransposed, setShowTransposed] = useState(true);

  const parsedTab = useMemo<ParsedTab | null>(() => parseTabText(originalText), [originalText]);

  const targetMidi = useMemo(() => getTuningMidiHighToLow(targetStrings), [targetStrings]);
  const targetLabelsHtoL = useMemo(() => getTuningLabelsHighToLow(targetStrings), [targetStrings]);

  const transposedText = useMemo(() => {
    if (!parsedTab) return null;
    try {
      return transposeTab(parsedTab, targetMidi, targetLabelsHtoL, extraSemitones);
    } catch {
      return null;
    }
  }, [parsedTab, targetMidi, targetLabelsHtoL, extraSemitones]);

  const isSameInstrument = useMemo(() => {
    if (!parsedTab) return true;
    // Check if source MIDI roughly matches target MIDI (same instrument)
    const srcMidi = parsedTab.rows.map(r => r.midiOpen).filter(m => m > 0);
    if (srcMidi.length === 0) return true;
    return srcMidi.length === targetMidi.length &&
      srcMidi.every((m, i) => Math.abs(m - targetMidi[i]) < 1) &&
      extraSemitones === 0;
  }, [parsedTab, targetMidi, extraSemitones]);

  const canTranspose = parsedTab !== null && transposedText !== null && !isSameInstrument;

  const displayText = showTransposed && canTranspose ? transposedText! : originalText;

  const sourceName = parsedTab?.sourceName ?? 'Instrumento original';

  return (
    <div className="my-1">
      {/* Transposer toolbar */}
      <div className="flex items-center gap-2 py-0.5 px-1 bg-[#d4d0c8] border-b border-gray-400">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tab</span>

        {canTranspose ? (
          <>
            <span className="text-[9px] text-gray-500 italic truncate max-w-[120px]" title={sourceName}>
              {sourceName}
            </span>
            <span className="text-[9px] text-gray-400">→</span>
            <button
              onClick={() => setShowTransposed(v => !v)}
              className={`text-[9px] font-bold px-2 py-0.5 border leading-tight transition-colors ${
                showTransposed
                  ? 'bg-[#316ac5] text-white border-[#1a3a8f]'
                  : 'bg-[var(--color-winxp-panel)] text-[#002fa7] border-gray-400 hover:bg-white bevel-out'
              }`}
              title={showTransposed ? 'Mostrar tab original' : `Transpor para ${targetLabel}`}
            >
              {showTransposed ? `◀ Original` : `▶ Transpor → ${targetLabel}`}
            </button>
          </>
        ) : (
          <span className="text-[9px] text-gray-400 italic">
            {parsedTab ? `${sourceName} • mesmo instrumento` : 'Tab não reconhecida'}
          </span>
        )}
      </div>

      {/* Tab content */}
      <pre className="m-0 font-mono text-sm leading-snug whitespace-pre text-[#444] overflow-x-auto py-1">
        {displayText}
      </pre>
    </div>
  );
};
