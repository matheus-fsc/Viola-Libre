import React, { useMemo } from 'react';
import {
  parseTabText,
  transposeTab,
  getTuningLabelsHighToLow,
  getTuningMidiHighToLow,
  TAB_POSITIONS,
} from '../engine/tabTransposer';

interface Props {
  originalText: string;
  targetStrings: number[];
  targetLabel: string;
  extraSemitones?: number;
  posIdx: number;            // neck position index — controlled by CifraViewer
}

export const TabTransposerBlock: React.FC<Props> = ({
  originalText,
  targetStrings,
  targetLabel,
  extraSemitones = 0,
  posIdx,
}) => {
  const targetMidi      = useMemo(() => getTuningMidiHighToLow(targetStrings), [targetStrings]);
  const targetLabelsHtL = useMemo(() => getTuningLabelsHighToLow(targetStrings), [targetStrings]);

  // Divide o texto em "sistemas" (grupos de linhas separados por linha em branco).
  // Uma tab quebrada em 2 partes (mescladas pelo CifraViewer) vira 2 sistemas
  // exibidos sob um único cabeçalho, ocupando bem menos espaço.
  const systems = useMemo(
    () => originalText.split(/\n[ \t]*\n/).map(s => s.replace(/\s+$/, '')).filter(s => s.trim().length > 0),
    [originalText]
  );

  const parsed = useMemo(
    () => systems.map(text => ({ text, tab: parseTabText(text) })),
    [systems]
  );

  const firstTab = useMemo(() => parsed.find(p => p.tab)?.tab ?? null, [parsed]);
  const recognized = !!firstTab;

  const isSameInstrument = useMemo(() => {
    if (!firstTab) return true;
    const srcMidi = firstTab.rows.map(r => r.midiOpen).filter(m => m > 0);
    if (srcMidi.length === 0) return true;
    return srcMidi.length === targetMidi.length &&
      srcMidi.every((m, i) => Math.abs(m - targetMidi[i]) < 1) &&
      extraSemitones === 0;
  }, [firstTab, targetMidi, extraSemitones]);

  const renderedSystems = useMemo(() => {
    return parsed.map(p => {
      if (!p.tab || isSameInstrument) return p.text;
      try {
        return transposeTab(p.tab, targetMidi, targetLabelsHtL, extraSemitones, TAB_POSITIONS[posIdx].fret);
      } catch { return p.text; }
    });
  }, [parsed, targetMidi, targetLabelsHtL, extraSemitones, posIdx, isSameInstrument]);

  const sourceName = firstTab?.sourceName ?? '';

  return (
    <div className="my-1">
      <div className="flex items-center gap-2 py-0.5 px-1 bg-[#d4d0c8] border-b border-gray-400">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tab</span>
        {recognized && !isSameInstrument ? (
          <>
            <span className="text-[9px] text-gray-500 italic truncate max-w-[90px]" title={sourceName}>{sourceName}</span>
            <span className="text-[9px] text-gray-400">→</span>
            <span className="text-[9px] text-[#002fa7]">{targetLabel}</span>
            <span className="text-[9px] text-gray-400 ml-1">· {TAB_POSITIONS[posIdx].label}</span>
          </>
        ) : recognized ? (
          <span className="text-[9px] text-gray-400 italic">{sourceName}</span>
        ) : (
          <span className="text-[9px] text-gray-400 italic">não reconhecida</span>
        )}
      </div>
      {renderedSystems.map((txt, i) => (
        <pre key={i} className="m-0 font-mono text-sm leading-snug whitespace-pre text-[#444] overflow-x-auto py-0.5">
          {txt}
        </pre>
      ))}
    </div>
  );
};
