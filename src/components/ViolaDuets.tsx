import React, { useState } from 'react';
import type { Tuning } from '../engine/types';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from '../engine/tunings';
import { noteNameToPitchClass, midiToNoteName, shouldUseFlats } from '../engine/chordCalculator';

interface ViolaDuetsProps {
  selectedTuning: Tuning;
}

interface DuetPosition {
  degree: number;
  degreeLabel: string;
  noteHigh: string;
  noteLow: string;
  fretHigh: number;
  fretLow: number;
  freqHigh: number;
  freqLow: number;
}

interface DuetType {
  id: string;
  name: string;
  stringHighIdx: number; // index of string (0 to 4)
  stringLowIdx: number;
  degreeOffset: number; // offset in major scale (2 for 6ths, 5 for 3rds)
}

const DUET_TYPES: DuetType[] = [
  { id: "1-3", name: "Dueto 1º e 3º Par (Intervalo de 6ª - Clássico)", stringHighIdx: 4, stringLowIdx: 2, degreeOffset: 2 },
  { id: "1-2", name: "Dueto 1º e 2º Par (Intervalo de 3ª)", stringHighIdx: 4, stringLowIdx: 3, degreeOffset: 5 },
  { id: "2-3", name: "Dueto 2º e 3º Par (Intervalo de 3ª/4ª)", stringHighIdx: 3, stringLowIdx: 2, degreeOffset: 5 },
  { id: "3-5", name: "Dueto 3º e 5º Par (Intervalo de 6ª Grave)", stringHighIdx: 2, stringLowIdx: 0, degreeOffset: 2 },
];

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const DEGREE_LABELS = ["I (Tônica)", "II (Supertônica)", "III (Mediante)", "IV (Subdominante)", "V (Dominante)", "VI (Relativa)", "VII (Sensível)", "VIII (Oitava)"];

let audioCtx: AudioContext | null = null;

const playDuetTone = (freqLow: number, freqHigh: number) => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Synth Low Note
    const oscLow = audioCtx.createOscillator();
    const gainLow = audioCtx.createGain();
    oscLow.type = 'triangle';
    oscLow.frequency.setValueAtTime(freqLow, now);
    gainLow.gain.setValueAtTime(0, now);
    gainLow.gain.linearRampToValueAtTime(0.25, now + 0.015);
    gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    oscLow.connect(gainLow);
    gainLow.connect(audioCtx.destination);
    oscLow.start(now);
    oscLow.stop(now + 0.9);

    // Synth High Note
    const oscHigh = audioCtx.createOscillator();
    const gainHigh = audioCtx.createGain();
    oscHigh.type = 'triangle';
    oscHigh.frequency.setValueAtTime(freqHigh, now);
    gainHigh.gain.setValueAtTime(0, now);
    gainHigh.gain.linearRampToValueAtTime(0.25, now + 0.015);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    oscHigh.connect(gainHigh);
    gainHigh.connect(audioCtx.destination);
    oscHigh.start(now);
    oscHigh.stop(now + 0.9);

  } catch (err) {
    console.error("Erro ao tocar dueto:", err);
  }
};

export const ViolaDuets: React.FC<ViolaDuetsProps> = ({ selectedTuning }) => {
  const numStrings = selectedTuning.strings.length;
  const maxFrets = 15;

  const [duetRoot, setDuetRoot] = useState<string>("D");
  const [selectedDuetTypeId, setSelectedDuetTypeId] = useState<string>("1-3");
  const [activePosIndex, setActivePosIndex] = useState<number>(0);
  const [isPlayingScale, setIsPlayingScale] = useState(false);

  const roots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  const selectedDuetType = DUET_TYPES.find(d => d.id === selectedDuetTypeId) || DUET_TYPES[0];
  const useFlats = shouldUseFlats(duetRoot);
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  // Calculate the 8 diatonic duet positions
  const getDuetPositions = (): DuetPosition[] => {
    const rootPc = noteNameToPitchClass(duetRoot);
    const positions: DuetPosition[] = [];

    // Major scale notes pitch classes (degree 0 to 7, octave root is degree 7)
    const scalePcs = Array.from({ length: 8 }).map((_, idx) => {
      const scaleIdx = idx % 7;
      const octaveOffset = idx >= 7 ? 12 : 0;
      return ((rootPc + MAJOR_SCALE_INTERVALS[scaleIdx]) % 12) + octaveOffset;
    });

    const openHighMidi = selectedTuning.strings[selectedDuetType.stringHighIdx];
    const openLowMidi = selectedTuning.strings[selectedDuetType.stringLowIdx];

    let prevFretHigh = 0;
    let prevFretLow = 0;

    for (let i = 0; i < 8; i++) {
      const highPc = scalePcs[i] % 12;
      // Harmony note index
      const lowScaleIdx = (i + selectedDuetType.degreeOffset) % 7;
      const lowPc = ((rootPc + MAJOR_SCALE_INTERVALS[lowScaleIdx]) % 12);

      let bestFretHigh = 0;
      let bestFretLow = 0;
      let bestDistance = 999;

      // Scan fretboard to find consonant frets that are close to previous shape
      for (let fH = 0; fH <= maxFrets; fH++) {
        if ((openHighMidi + fH) % 12 === highPc) {
          for (let fL = 0; fL <= maxFrets; fL++) {
            if ((openLowMidi + fL) % 12 === lowPc) {
              // Ensure fret separation is playable (usually <= 2 trastes for duets)
              if (Math.abs(fH - fL) <= 2) {
                const prevH = i === 0 ? 0 : prevFretHigh;
                const prevL = i === 0 ? 0 : prevFretLow;

                // Penalize backward motion to maintain ascending scale flow (except open strings)
                const backH = (fH < prevH && fH !== 0) ? 25 : 0;
                const backL = (fL < prevL && fL !== 0) ? 25 : 0;

                const distance = Math.abs(fH - prevH) + Math.abs(fL - prevL) + Math.abs(fH - fL) + backH + backL;

                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestFretHigh = fH;
                  bestFretLow = fL;
                }
              }
            }
          }
        }
      }

      prevFretHigh = bestFretHigh;
      prevFretLow = bestFretLow;

      const midiHigh = openHighMidi + bestFretHigh;
      const midiLow = openLowMidi + bestFretLow;

      positions.push({
        degree: i,
        degreeLabel: DEGREE_LABELS[i],
        noteHigh: noteNames[midiHigh % 12],
        noteLow: noteNames[midiLow % 12],
        fretHigh: bestFretHigh,
        fretLow: bestFretLow,
        freqHigh: 440 * Math.pow(2, (midiHigh - 69) / 12),
        freqLow: 440 * Math.pow(2, (midiLow - 69) / 12),
      });
    }

    return positions;
  };

  const positions = getDuetPositions();
  const activePosition = positions[activePosIndex] || positions[0];

  const handlePositionClick = (index: number) => {
    setActivePosIndex(index);
    const pos = positions[index];
    playDuetTone(pos.freqLow, pos.freqHigh);
  };

  const handlePlayFullScale = () => {
    if (isPlayingScale) return;
    setIsPlayingScale(true);
    let index = 0;

    const playNext = () => {
      if (index >= positions.length) {
        setIsPlayingScale(false);
        return;
      }
      setActivePosIndex(index);
      playDuetTone(positions[index].freqLow, positions[index].freqHigh);
      index++;
      setTimeout(playNext, 700); // 700ms duration per position
    };

    playNext();
  };

  // Check if a fret cell is active in the currently selected duet position
  const isActiveFretCell = (stringIdx: number, fret: number) => {
    if (stringIdx === selectedDuetType.stringHighIdx && fret === activePosition.fretHigh) return "high";
    if (stringIdx === selectedDuetType.stringLowIdx && fret === activePosition.fretLow) return "low";
    return null;
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 w-full shadow-md">
      
      {/* Box Header (XP look) */}
      <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Escalas Duetadas na Viola Caipira</span>
        <span className="font-mono text-xs">{duetRoot} Maior ({selectedTuning.name.split(' ')[0]})</span>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#d4d0c8] p-3 border border-[#808080] rounded shadow-inner text-xs font-mono">
        
        {/* Key Select Grid */}
        <div className="flex flex-col gap-1">
          <span className="font-bold text-gray-700">Tom de Referência:</span>
          <div className="grid grid-cols-6 gap-1 bg-white p-1.5 border border-[#808080]">
            {roots.map(r => {
              const active = duetRoot === r;
              return (
                <button
                  key={`duet-root-${r}`}
                  onClick={() => { setDuetRoot(r); setActivePosIndex(0); }}
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

        {/* Duet Type Dropdown */}
        <div className="flex flex-col gap-1 justify-center">
          <label className="font-bold text-gray-700" htmlFor="duet-type-select">Tipo de Dueto (Canais):</label>
          <select
            id="duet-type-select"
            value={selectedDuetTypeId}
            onChange={(e) => { setSelectedDuetTypeId(e.target.value); setActivePosIndex(0); }}
            className="bevel-in px-2 py-1.5 bg-white focus:outline-none select-none cursor-pointer w-full"
          >
            {DUET_TYPES.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Action Panel */}
        <div className="flex flex-col gap-1 justify-center items-center">
          <span className="font-bold text-gray-700 mb-1">Demonstração de Ponteio:</span>
          <button
            onClick={handlePlayFullScale}
            disabled={isPlayingScale}
            className="px-4 py-2 w-full bg-gradient-to-r from-[#228b22] to-[#2ecc71] text-white border border-green-800 font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-400 cursor-pointer select-none rounded-sm"
          >
            {isPlayingScale ? "▶ Tocando..." : "▶ Tocar Escala Completa"}
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        
        {/* Fretboard visual neck column */}
        <div className="xl:col-span-2 flex flex-col overflow-x-auto pb-2 retro-scrollbar">
          <div className="min-w-[850px] bg-[#ece9d8] border border-[#808080] p-4 flex flex-col relative select-none">
            
            {/* Fret number markers header */}
            <div className="flex h-6 mb-1 ml-[50px]">
              <div className="w-[30px] border-r-4 border-transparent"></div>
              {Array.from({ length: maxFrets }).map((_, idx) => {
                const fret = idx + 1;
                const hasMark = [3, 5, 7, 9, 12, 15].includes(fret);
                return (
                  <div key={`duet-marker-${fret}`} className="flex-1 flex justify-center text-[10px] font-mono font-bold text-gray-600">
                    {hasMark ? `${fret}ª` : ""}
                  </div>
                );
              })}
            </div>

            {/* Visual Neck */}
            <div className="flex flex-col gap-1 bg-[#8B5A2B] border-2 border-t-[#5B3E1F] border-l-[#5B3E1F] border-r-[#C5A37F] border-b-[#C5A37F] p-2 relative rounded shadow-inner">
              
              {/* String rows */}
              {Array.from({ length: numStrings }).map((_, rIdx) => {
                const stringIdx = numStrings - 1 - rIdx; // lowest pitch string at the top
                const openMidi = selectedTuning.strings[stringIdx];
                
                return (
                  <div key={`duet-row-${stringIdx}`} className="flex items-center h-8 relative z-10">
                    
                    {/* String note label */}
                    <div className="w-[50px] flex items-center pr-2 font-mono text-xs font-bold text-white justify-end">
                      {midiToNoteName(openMidi, useFlats)}
                    </div>

                    {/* Nut (fret 0) spacer */}
                    <div className="w-[30px] flex justify-center items-center relative h-full">
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#C5A37F] border-r border-black/80"></div>
                      {(() => {
                        const cellType = isActiveFretCell(stringIdx, 0);
                        if (!cellType) return null;
                        const labelText = cellType === "high" ? activePosition.noteHigh : activePosition.noteLow;
                        return (
                          <div className="w-6 h-6 rounded-full bg-[#ff9d00] border-2 border-white flex items-center justify-center font-bold text-[9px] text-white shadow z-20">
                            {labelText}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Fret boxes 1 to 15 */}
                    {Array.from({ length: maxFrets }).map((_, fIdx) => {
                      const fret = fIdx + 1;
                      const cellType = isActiveFretCell(stringIdx, fret);
                      
                      return (
                        <div key={`cell-${stringIdx}-${fret}`} className="flex-1 h-full border-r border-[#ece9d8]/40 flex justify-center items-center relative">
                          {/* Fret wire */}
                          <div className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-[#d3d3d3] shadow-[1px_0_1px_rgba(0,0,0,0.5)]"></div>
                          
                          {/* String line horizontal gauge */}
                          <div 
                            style={{
                              height: `${Math.max(1, 3.5 - (stringIdx * 2.5) / (numStrings - 1 || 1))}px`
                            }}
                            className="absolute left-0 right-0 bg-yellow-100/70 z-0"
                          />

                          {/* Render active duet marker dots */}
                          {cellType && (
                            <div className="w-6 h-6 rounded-full bg-[#ff9d00] border-2 border-white flex items-center justify-center font-bold text-[9px] text-white shadow-md z-20 transition-transform scale-110 animate-bounce">
                              {cellType === "high" ? activePosition.noteHigh : activePosition.noteLow}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  </div>
                );
              })}

              {/* Fret markers underlay dots */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                <div className="w-[80px]" />
                {Array.from({ length: maxFrets }).map((_, fIdx) => {
                  const fret = fIdx + 1;
                  const hasMark = [3, 5, 7, 9, 12, 15].includes(fret);
                  return (
                    <div
                      key={`neck-fret-bg-${fret}`}
                      className="flex-1 h-full flex items-center justify-center border-r border-[#ece9d8]/5"
                    >
                      {hasMark && fret !== 12 && (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                      )}
                      {fret === 12 && (
                        <div className="flex flex-col gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Fret numbers footer row */}
            <div className="flex select-none pointer-events-none mt-1.5">
              <div className="w-[80px]" />
              {Array.from({ length: maxFrets }).map((_, idx) => {
                const fret = idx + 1;
                return (
                  <div
                    key={`fret-num-${fret}`}
                    className="flex-1 text-center font-mono text-[9px] font-bold text-gray-500"
                  >
                    {fret}ª
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Right sidebar listing positions */}
        <div className="flex flex-col gap-2 font-mono text-xs bg-white border-2 border-[#808080] border-r-white border-bottom-white p-3 max-h-[350px] overflow-y-auto pr-1 retro-scrollbar">
          <span className="font-bold text-[#002fa7] border-b border-dashed border-[#808080] pb-1.5 block">
            Posições da Escala Duetada:
          </span>
          <div className="flex flex-col gap-1.5">
            {positions.map((pos, idx) => {
              const active = idx === activePosIndex;
              return (
                <button
                  key={`pos-card-${idx}`}
                  onClick={() => handlePositionClick(idx)}
                  className={`w-full text-left p-2 border cursor-pointer select-none transition-all flex flex-col gap-0.5 ${
                    active
                      ? 'bg-[#0058e6] border-[#002fa7] text-white shadow-sm'
                      : 'bg-[#ece9d8] border-[#d4d0c8] text-black hover:bg-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span>Pos. {idx + 1} - {pos.degreeLabel.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-90">{pos.noteLow} + {pos.noteHigh}</span>
                  </div>
                  <div className="text-[9px] opacity-80">
                    Trastes: {selectedDuetType.stringLowIdx === 2 ? '3º' : selectedDuetType.stringLowIdx === 3 ? '2º' : '5º'} Par: Casa {pos.fretLow} | {selectedDuetType.stringHighIdx === 4 ? '1º' : '2º'} Par: Casa {pos.fretHigh}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
