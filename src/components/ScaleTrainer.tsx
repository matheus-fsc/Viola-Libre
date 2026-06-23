import React, { useState } from 'react';
import type { Tuning } from '../engine/types';
import { SCALE_FORMULAS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from '../engine/tunings';
import { midiToNoteName, noteNameToPitchClass, shouldUseFlats } from '../engine/chordCalculator';

interface ScaleTrainerProps {
  selectedTuning: Tuning;
}

export const ScaleTrainer: React.FC<ScaleTrainerProps> = ({
  selectedTuning
}) => {
  const numStrings = selectedTuning.strings.length;
  const maxFrets = 15; // scales are nice to see up to 15 frets!

  const [scaleRoot, setScaleRoot] = useState<string>("G");
  const [selectedScaleIndex, setSelectedScaleIndex] = useState<number>(0);
  const [displayMode, setDisplayMode] = useState<'notes' | 'degrees'>('notes');

  const rootPc = noteNameToPitchClass(scaleRoot);
  const activeFormula = SCALE_FORMULAS[selectedScaleIndex];
  
  // Calculate scale pitch classes
  const scalePcs = activeFormula.intervals.map(interval => (rootPc + interval) % 12);
  const useFlats = shouldUseFlats(scaleRoot);
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  const roots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // Helper to determine if a midi note belongs to the scale
  const getScaleToneInfo = (midi: number) => {
    const pc = midi % 12;
    const idx = scalePcs.indexOf(pc);
    if (idx === -1) return null;
    
    return {
      degree: activeFormula.degrees[idx],
      isRoot: pc === rootPc,
      noteName: midiToNoteName(midi, useFlats)
    };
  };

  // Pre-calculate notes in the scale
  const scaleNotesList = activeFormula.intervals.map(interval => {
    const pc = (rootPc + interval) % 12;
    return noteNames[pc];
  });

  const handleRootClick = (root: string) => {
    setScaleRoot(root);
  };

  const handleScaleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedScaleIndex(Number(e.target.value));
  };

  const hasMarker = (fret: number) => {
    return [3, 5, 7, 9, 12, 15].includes(fret);
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 w-full shadow-md">
      
      {/* Box Header (XP look) */}
      <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Treinador de Escalas e Intervalos</span>
        <span className="font-mono text-xs">{scaleRoot} {activeFormula.name}</span>
      </div>

      {/* Control Panel: Root Selector & Scale Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#d4d0c8] p-3 border border-[#808080] rounded shadow-inner">
        {/* Root selection */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold font-mono text-gray-700">Tom Root (Fundamental):</span>
          <div className="grid grid-cols-6 gap-1 bg-white p-1.5 border border-[#808080]">
            {roots.map(r => {
              const active = scaleRoot === r;
              return (
                <button
                  key={r}
                  onClick={() => handleRootClick(r)}
                  className={`text-[10px] font-bold font-mono py-1 cursor-pointer text-center select-none border ${
                    active
                      ? 'bg-[#cc3300] text-white border-white'
                      : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scale select drop-down */}
        <div className="flex flex-col gap-1 justify-center">
          <label className="text-xs font-bold font-mono text-gray-700" htmlFor="scale-select">Tipo de Escala:</label>
          <select
            id="scale-select"
            value={selectedScaleIndex}
            onChange={handleScaleSelect}
            className="bevel-in px-2 py-1.5 text-sm bg-white focus:outline-none select-none font-mono cursor-pointer w-full"
          >
            {SCALE_FORMULAS.map((f, idx) => (
              <option key={idx} value={idx}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Visual Settings & Scale Notes */}
        <div className="flex flex-col gap-1 font-mono text-xs justify-center">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-gray-700">Visualizar por:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setDisplayMode('notes')}
                className={`px-2 py-0.5 border text-[10px] font-bold cursor-pointer ${displayMode === 'notes' ? 'bg-[#0058e6] text-white border-[#002fa7]' : 'bg-[#ece9d8] border-[#808080] hover:bg-white'}`}
              >
                Notas
              </button>
              <button
                onClick={() => setDisplayMode('degrees')}
                className={`px-2 py-0.5 border text-[10px] font-bold cursor-pointer ${displayMode === 'degrees' ? 'bg-[#0058e6] text-white border-[#002fa7]' : 'bg-[#ece9d8] border-[#808080] hover:bg-white'}`}
              >
                Graus
              </button>
            </div>
          </div>
          <div className="bg-white border border-[#808080] p-1.5 text-[11px] font-bold text-gray-800 flex flex-wrap gap-1 leading-normal">
            <span className="text-[#cc3300]">Notas:</span>
            {scaleNotesList.map((n, idx) => (
              <span key={idx} className={n === scaleRoot ? "text-[#228b22] underline" : ""}>
                {n}{idx < scaleNotesList.length - 1 ? "," : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Neck showing Scale Shapes */}
      <div className="flex flex-col overflow-x-auto pb-2 retro-scrollbar">
        <div className="min-w-[850px] bg-[#ece9d8] border border-[#808080] p-4 flex flex-col relative">
          
          {/* Fret Markers Header Row */}
          <div className="flex h-6 mb-1 ml-[50px]">
            <div className="w-[30px] border-r-4 border-transparent"></div>
            {Array.from({ length: maxFrets }).map((_, idx) => {
              const fret = idx + 1;
              return (
                <div key={`marker-${fret}`} className="flex-1 flex justify-center text-[10px] font-mono font-bold text-gray-600">
                  {hasMarker(fret) ? `${fret}ª` : ""}
                </div>
              );
            })}
          </div>

          {/* Scale Fretboard Layout */}
          <div className="flex flex-col gap-1 bg-[#8B5A2B] border-2 border-t-[#5B3E1F] border-l-[#5B3E1F] border-r-[#C5A37F] border-b-[#C5A37F] p-2 relative rounded shadow-inner">
            
            {/* Draw string rows (lowest at the top) */}
            {Array.from({ length: numStrings }).map((_, rIdx) => {
              const sIdx = rIdx;
              const openMidi = selectedTuning.strings[sIdx];
              
              return (
                <div key={`string-row-${sIdx}`} className="flex items-center h-8 relative z-10">
                  
                  {/* String Open Note indicator */}
                  <div className="w-[50px] flex items-center pr-2 font-mono text-xs font-bold text-white justify-end">
                    {midiToNoteName(openMidi, useFlats)}
                  </div>

                  {/* Nut column (open notes) */}
                  <div className="w-[30px] flex justify-center items-center relative h-full">
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#C5A37F] border-r border-black/80"></div>
                    
                    {(() => {
                      const tone = getScaleToneInfo(openMidi);
                      if (!tone) return null;
                      return (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border shadow-sm z-10 ${
                            tone.isRoot
                              ? 'bg-[#cc3300] text-white border-white'
                              : 'bg-[#0058e6] text-white border-white'
                          }`}
                        >
                          {displayMode === 'notes' ? tone.noteName.replace('#', '♯').replace('b', '♭') : tone.degree}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Fret boxes 1 to 15 */}
                  {Array.from({ length: maxFrets }).map((_, fIdx) => {
                    const fret = fIdx + 1;
                    const midi = openMidi + fret;
                    const tone = getScaleToneInfo(midi);
                    
                    return (
                      <div 
                        key={`cell-${sIdx}-${fret}`} 
                        className="flex-1 h-full border-r border-[#ece9d8]/40 flex justify-center items-center relative"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-[#d3d3d3] shadow-[1px_0_1px_rgba(0,0,0,0.5)]"></div>
                        <div 
                          style={{
                            height: `${Math.max(1, 3.5 - (sIdx * 2.5) / (numStrings - 1 || 1))}px`
                          }}
                          className="absolute left-0 right-0 bg-yellow-100/70 z-0"
                        ></div>

                        {/* Inlay dots */}
                        {rIdx === Math.floor(numStrings / 2) && hasMarker(fret) && fret !== 12 && (
                          <div className="absolute w-2 h-2 rounded-full bg-white/20 z-0"></div>
                        )}
                        {rIdx === Math.floor(numStrings / 2) - 1 && fret === 12 && (
                          <div className="absolute w-2 h-2 rounded-full bg-white/20 z-0 transform -translate-y-2"></div>
                        )}
                        {rIdx === Math.floor(numStrings / 2) + 1 && fret === 12 && (
                          <div className="absolute w-2 h-2 rounded-full bg-white/20 z-0 transform translate-y-2"></div>
                        )}

                        {/* Scale Tone Circle */}
                        {tone && (
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold font-mono border shadow-md z-10 transition-transform hover:scale-110 ${
                              tone.isRoot
                                ? 'bg-[#cc3300] text-white border-white ring-2 ring-[#ffe066]/30'
                                : 'bg-[#0058e6] text-white border-white'
                            }`}
                            title={`Nota: ${tone.noteName} (Grau: ${tone.degree})`}
                          >
                            {displayMode === 'notes' ? tone.noteName.replace('#', '♯').replace('b', '♭') : tone.degree}
                          </div>
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

      <div className="bg-[#d4d0c8] p-2.5 border border-[#808080] font-mono text-xs text-gray-700 leading-normal flex flex-col gap-1">
        <p>
          <strong>Como estudar as escalas:</strong>
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1 mt-1 text-[11px]">
          <li>Identifique as notas vermelhas no braço: elas são a <strong>Fundamental (Root)</strong> da escala.</li>
          <li>Pratique tocando as notas na sequência da esquerda para a direita (subindo o tom) para memorizar a fôrma visual da escala no instrumento.</li>
          <li>Alterne a visualização para <strong>Graus</strong> para entender a relação intervalar (Tônica, Terça, Quinta, Sétima, etc.), o que é a chave para compor e solar.</li>
        </ul>
      </div>

    </div>
  );
};
