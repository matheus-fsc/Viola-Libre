import React, { useMemo, useState } from 'react';
import type { Tuning, Instrument } from '../engine/types';
import {
  detectChord,
  midiToNoteName,
  getVoicingDifficulty,
  parseChordString,
  buildChord,
} from '../engine/chordCalculator';
import { AudioEngine } from '../engine/AudioEngine';
import { useEditorSession, rankChord, buildChordId } from '../services/authApi';
import { useVisualizationStore } from '../stores/useVisualizationStore';
import { VisualizationOnboardingModal } from './VisualizationOnboardingModal';

interface ChordEditorModalProps {
  chordName: string;
  tuning: Tuning;
  instrument: Instrument;
  initialFrets: number[];
  useFlats?: boolean;
  onApply: (frets: number[]) => void;
  onClose: () => void;
}

const MAX_FRETS = 12;

/**
 * Modal to fine-tune a chord shape on the neck. The chord's "harmonic field"
 * (every position where a chord tone lives) is shown as ghost dots in a distinct
 * color; the user can click to add/remove fingers and ease the shape to taste.
 */
export const ChordEditorModal: React.FC<ChordEditorModalProps> = ({
  chordName,
  tuning,
  instrument,
  initialFrets,
  useFlats = false,
  onApply,
  onClose,
}) => {
  const numStrings = tuning.strings.length;

  const normalizedInitial = useMemo(() => {
    if (initialFrets.length === numStrings) return [...initialFrets];
    return new Array(numStrings).fill(0);
  }, [initialFrets, numStrings]);

  const [frets, setFrets] = useState<number[]>(normalizedInitial);
  const editorSession = useEditorSession();
  const [rankState, setRankState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Pitch classes that belong to the target chord (the "harmonic field").
  const { chordPcs, rootPc } = useMemo(() => {
    try {
      const { root, suffix, bass } = parseChordString(chordName);
      const chord = buildChord(root, suffix, bass || undefined);
      return { chordPcs: new Set(chord.notes), rootPc: chord.root };
    } catch {
      return { chordPcs: new Set<number>(), rootPc: -1 };
    }
  }, [chordName]);

  const { stringOrder, setStringOrder } = useVisualizationStore();
  const isInverted = stringOrder === 'inverted';

  const pcAt = (sIdx: number, fret: number) => (tuning.strings[sIdx] + fret) % 12;
  const noteAt = (sIdx: number, fret: number) =>
    fret < 0 ? 'X' : midiToNoteName(tuning.strings[sIdx] + fret, useFlats);

  const detected = useMemo(() => detectChord(frets, tuning).slice(0, 3), [frets, tuning]);
  const difficulty = useMemo(() => getVoicingDifficulty(frets), [frets]);

  const setCell = (sIdx: number, fret: number) => {
    setFrets(prev => {
      const next = [...prev];
      next[sIdx] = next[sIdx] === fret ? (fret === 0 ? -1 : 0) : fret;
      return next;
    });
  };

  const toggleMute = (sIdx: number) => {
    setFrets(prev => {
      const next = [...prev];
      next[sIdx] = next[sIdx] === -1 ? 0 : -1;
      return next;
    });
  };

  const handlePlay = async () => {
    const engine = AudioEngine.getInstance();
    await engine.ensureContext();
    let delay = 0;
    for (let i = 0; i < numStrings; i++) {
      const fret = frets[i];
      if (fret === -1) continue;
      engine.playMidi(tuning.strings[i] + fret, 2.0, delay);
      delay += 0.04;
    }
  };

  const handleApply = async () => {
    onApply(frets);
    if (!editorSession) {
      onClose();
      return;
    }
    // Editors additionally submit the shape as a global ranking suggestion —
    // POST /api/chords/rank, unique per (chord_id, editor_id) on the backend.
    setRankState('sending');
    try {
      await rankChord(buildChordId(instrument.id, tuning.id, chordName), frets);
      setRankState('sent');
    } catch {
      setRankState('error');
    }
    setTimeout(onClose, 900);
  };

  const hasMarker = (fret: number) => [3, 5, 7, 9, 12].includes(fret);

  const diffColor =
    difficulty.label === 'Fácil' ? 'text-[#228b22]' : difficulty.label === 'Média' ? 'text-[#c06000]' : 'text-[#cc3300]';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-b-[#808080] shadow-2xl w-full max-w-[820px] max-h-[92vh] overflow-y-auto retro-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="bg-gradient-to-r from-[#0a246a] to-[#3a6ea5] text-white px-3 py-1.5 flex justify-between items-center select-none">
          <span className="font-bold text-sm">Modificar acorde: <span className="font-mono">{chordName}</span></span>
          <button onClick={onClose} className="w-5 h-5 flex items-center justify-center bg-[#ce4a3a] border border-white text-white font-bold text-xs hover:bg-[#e25a48] leading-none" title="Fechar">×</button>
        </div>

        <div className="p-3 flex flex-col gap-3">
          <VisualizationOnboardingModal />
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-gray-700 items-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0058e6] border border-[#002fa7] inline-block" /> nota tocada</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-[#228b22] bg-[#228b22]/15 inline-block" /> nota do acorde (clique p/ acrescentar)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-[#c06000] bg-[#c06000]/15 inline-block" /> tônica</span>
          </div>

          {/* Neck */}
          <div className="overflow-x-auto retro-scrollbar bg-[#ece9d8] border border-[#808080] p-2">
            <div className="min-w-[680px]">
              {/* Fret number header */}
              <div className="flex h-5 mb-1">
                <div className="w-[72px]" />
                <div className="w-[26px]" />
                {Array.from({ length: MAX_FRETS }).map((_, i) => (
                  <div key={`h-${i}`} className="flex-1 flex justify-center text-[9px] font-mono font-bold text-gray-500">
                    {hasMarker(i + 1) ? `${i + 1}ª` : ''}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1 bg-[#8B5A2B] border-2 border-t-[#5B3E1F] border-l-[#5B3E1F] border-r-[#C5A37F] border-b-[#C5A37F] p-2 rounded">
                {Array.from({ length: numStrings }).map((_, rIdx) => {
                  const sIdx = isInverted ? numStrings - 1 - rIdx : rIdx;
                  const fretVal = frets[sIdx];
                  const isMuted = fretVal === -1;
                  const label = instrument.id === 'viola' ? `${numStrings - sIdx}ª` : `${numStrings - sIdx}`;
                  return (
                    <div key={`row-${sIdx}`} className="flex items-center h-7">
                      {/* Left controls */}
                      <div className="w-[72px] flex items-center gap-1 pr-1">
                        <button
                          onClick={() => toggleMute(sIdx)}
                          className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] font-bold border rounded-sm select-none ${
                            isMuted ? 'bg-[#ff7f27] text-white border-white' : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-b-[#808080]'
                          }`}
                          title={isMuted ? 'Tocar corda' : 'Abafar corda'}
                        >
                          {isMuted ? 'X' : 'O'}
                        </button>
                        <span className="text-[10px] font-mono font-bold text-white truncate w-9">
                          {label} {midiToNoteName(tuning.strings[sIdx], useFlats)}
                        </span>
                      </div>

                      {/* Nut / open */}
                      <div onClick={() => setCell(sIdx, 0)} className="w-[26px] h-full flex justify-center items-center relative cursor-pointer hover:bg-black/5">
                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#C5A37F] border-r border-black/70" />
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border z-10 ${
                          fretVal === 0 ? 'bg-[#228b22] text-white border-white' : 'text-transparent border-transparent'
                        }`}>0</span>
                      </div>

                      {/* Frets */}
                      {Array.from({ length: MAX_FRETS }).map((_, fi) => {
                        const fret = fi + 1;
                        const isActive = fretVal === fret;
                        const pc = pcAt(sIdx, fret);
                        const inField = chordPcs.has(pc);
                        const isRoot = pc === rootPc;
                        return (
                          <div
                            key={`c-${sIdx}-${fret}`}
                            onClick={() => setCell(sIdx, fret)}
                            className="flex-1 h-full border-r border-[#ece9d8]/30 flex justify-center items-center relative cursor-pointer hover:bg-black/5 group"
                          >
                            <div className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-[#d3d3d3]" />
                            <div className="absolute left-0 right-0 h-[2px] bg-yellow-100/60" />
                            {rIdx === Math.floor(numStrings / 2) && hasMarker(fret) && (
                              <div className="absolute w-2 h-2 rounded-full bg-white/20" />
                            )}
                            {isActive ? (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8.5px] font-bold font-mono bg-[#0058e6] text-white border border-white z-10 shadow">
                                {noteAt(sIdx, fret).replace('#', '♯').replace('b', '♭')}
                              </span>
                            ) : inField ? (
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8.5px] font-bold font-mono z-10 border-2 ${
                                isRoot ? 'border-[#c06000] bg-[#c06000]/20 text-[#7a3d00]' : 'border-[#228b22] bg-[#228b22]/15 text-[#155a15]'
                              } opacity-70 group-hover:opacity-100`}>
                                {noteAt(sIdx, fret).replace('#', '♯').replace('b', '♭')}
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8.5px] font-mono text-transparent group-hover:text-white/50 z-10">
                                {noteAt(sIdx, fret).replace('#', '♯').replace('b', '♭')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-white border border-[#808080] p-2 font-mono">
              <span className="text-[9px] text-gray-500 font-bold block">Resulta em</span>
              <span className="text-sm font-bold text-[#002fa7]">{detected[0]?.chordName ?? '—'}</span>
              {detected.length > 1 && (
                <span className="text-[9px] text-gray-400 block truncate">tb: {detected.slice(1).map(d => d.chordName).join(', ')}</span>
              )}
            </div>
            <div className="bg-white border border-[#808080] p-2 font-mono">
              <span className="text-[9px] text-gray-500 font-bold block">Dificuldade</span>
              <span className={`text-sm font-bold ${diffColor}`}>{difficulty.label}</span>
            </div>
            <div className="bg-white border border-[#808080] p-2 font-mono">
              <span className="text-[9px] text-gray-500 font-bold block">Notas</span>
              <span className="text-xs font-bold text-[#228b22] truncate block">
                {frets.map((f, i) => (f === -1 ? null : noteAt(i, f))).filter(Boolean).join(', ') || '—'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-between items-center border-t border-[#d4d0c8] pt-2">
            <div className="flex gap-2">
              <button onClick={handlePlay} className="px-3 py-1 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white">▶ Tocar</button>
              <button onClick={() => setFrets(normalizedInitial)} className="px-3 py-1 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white">↺ Resetar</button>
              <button onClick={() => setStringOrder(isInverted ? 'standard' : 'inverted')} className="px-3 py-1 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white" title="Alternar entre visualização padrão e invertida">↕ Inverter</button>
            </div>
            <div className="flex gap-2 items-center">
              {editorSession && rankState === 'idle' && (
                <span className="text-[9px] text-gray-500 font-mono">🏆 será enviado como sugestão de Editor</span>
              )}
              {rankState === 'sending' && <span className="text-[9px] text-[#0058e6] font-mono">Enviando ranking...</span>}
              {rankState === 'sent' && <span className="text-[9px] text-[#228b22] font-mono">✔ Ranking enviado</span>}
              {rankState === 'error' && <span className="text-[9px] text-[#cc3300] font-mono">✗ Falha ao enviar ranking</span>}
              <button onClick={onClose} className="px-3 py-1 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white">Cancelar</button>
              <button onClick={handleApply} disabled={rankState === 'sending'} className="px-4 py-1 text-xs font-bold font-mono bg-[#316ac5] text-white border border-[#1a4a9c] hover:bg-[#3f7ad6] disabled:opacity-50">Aplicar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
