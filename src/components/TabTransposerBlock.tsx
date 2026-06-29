import React, { useMemo } from 'react';
import {
  parseTabText,
  transposeTab,
  getTuningLabelsHighToLow,
  getTuningMidiHighToLow,
  type ParsedTab,
} from '../engine/tabTransposer';

interface Props {
  originalText: string;
  targetStrings: number[];
  targetLabel: string;
  extraSemitones?: number;
  posIdx: number;            // neck position index — controlled by CifraViewer
}

export const POSITIONS = [
  { label: 'Aberta', fret: 0  },
  { label: '5ª pos', fret: 5  },
  { label: '7ª pos', fret: 7  },
  { label: '12ª pos', fret: 12 },
];

export const TabTransposerBlock: React.FC<Props> = ({
  originalText,
  targetStrings,
  targetLabel,
  extraSemitones = 0,
  posIdx,
}) => {
  const parsedTab       = useMemo<ParsedTab | null>(() => parseTabText(originalText), [originalText]);
  const targetMidi      = useMemo(() => getTuningMidiHighToLow(targetStrings), [targetStrings]);
  const targetLabelsHtL = useMemo(() => getTuningLabelsHighToLow(targetStrings), [targetStrings]);

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
      return transposeTab(parsedTab, targetMidi, targetLabelsHtL, extraSemitones, POSITIONS[posIdx].fret);
    } catch { return null; }
  }, [parsedTab, targetMidi, targetLabelsHtL, extraSemitones, posIdx, isSameInstrument]);

  const displayText = transposedText ?? originalText;
  const sourceName  = parsedTab?.sourceName ?? '';

  return (
    <div className="my-1">
      <div className="flex items-center gap-2 py-0.5 px-1 bg-[#d4d0c8] border-b border-gray-400">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tab</span>
        {parsedTab && !isSameInstrument ? (
          <>
            <span className="text-[9px] text-gray-500 italic truncate max-w-[90px]" title={sourceName}>{sourceName}</span>
            <span className="text-[9px] text-gray-400">→</span>
            <span className="text-[9px] text-[#002fa7]">{targetLabel}</span>
            <span className="text-[9px] text-gray-400 ml-1">· {POSITIONS[posIdx].label}</span>
          </>
        ) : parsedTab ? (
          <span className="text-[9px] text-gray-400 italic">{sourceName}</span>
        ) : (
          <span className="text-[9px] text-gray-400 italic">não reconhecida</span>
        )}
      </div>
      <pre className="m-0 font-mono text-sm leading-snug whitespace-pre text-[#444] overflow-x-auto py-1">
        {displayText}
      </pre>
    </div>
  );
};
