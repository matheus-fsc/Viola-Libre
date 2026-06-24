import React, { useState } from 'react';
import type { Tuning, Instrument } from '../engine/types';
import { detectChord, midiToNoteName, shouldUseFlats } from '../engine/chordCalculator';

interface InteractiveFretboardProps {
  selectedInstrument: Instrument;
  selectedTuning: Tuning;

  loadedFrets?: number[];
}

export const InteractiveFretboard: React.FC<InteractiveFretboardProps> = ({
  selectedInstrument,
  selectedTuning,

  loadedFrets
}) => {
  const numStrings = selectedTuning.strings.length;
  const maxFrets = 12;

  const [prevTuning, setPrevTuning] = useState<Tuning>(selectedTuning);
  const [prevLoadedFrets, setPrevLoadedFrets] = useState<number[] | undefined>(loadedFrets);

  // State for active frets on each string (0: open, -1: muted, 1-12: fretted)
  const [activeFrets, setActiveFrets] = useState<number[]>(() => {
    if (loadedFrets && loadedFrets.length === numStrings) {
      return [...loadedFrets];
    }
    return new Array(numStrings).fill(0);
  });

  // Sync activeFrets state when selectedTuning or loadedFrets changes
  if (selectedTuning !== prevTuning || loadedFrets !== prevLoadedFrets) {
    setPrevTuning(selectedTuning);
    setPrevLoadedFrets(loadedFrets);
    if (loadedFrets && loadedFrets.length === numStrings) {
      setActiveFrets([...loadedFrets]);
    } else {
      setActiveFrets(new Array(numStrings).fill(0));
    }
  }

  // Derive detected chords whenever active frets or tuning changes
  const detectedChords = React.useMemo(() => {
    if (activeFrets.length === numStrings) {
      return detectChord(activeFrets, selectedTuning);
    }
    return [];
  }, [activeFrets, selectedTuning, numStrings]);

  const handleCellClick = (stringIdx: number, fret: number) => {
    const next = [...activeFrets];
    if (next[stringIdx] === fret) {
      // Toggle off -> set to open (0) or if already open, set to muted (-1)
      next[stringIdx] = fret === 0 ? -1 : 0;
    } else {
      next[stringIdx] = fret;
    }
    setActiveFrets(next);
  };

  const handleMuteToggle = (stringIdx: number) => {
    const next = [...activeFrets];
    next[stringIdx] = next[stringIdx] === -1 ? 0 : -1;
    setActiveFrets(next);
  };

  const handleClear = () => {
    setActiveFrets(new Array(numStrings).fill(-1)); // mute all
  };

  const handleResetOpen = () => {
    setActiveFrets(new Array(numStrings).fill(0)); // open all
  };



  const useFlats = shouldUseFlats(detectedChords[0]?.rootName || "C");

  // Strings labels from bottom to top (grave to agudo)
  // Inside layout:
  // String indices are 0 to numStrings-1. Index 0 is the lowest pitch string.
  // We render the highest pitch string at the top (index numStrings-1) and the lowest at the bottom (index 0).
  // This matches standard tablature/neck representation!
  const getNoteAtFret = (stringIdx: number, fret: number) => {
    if (fret === -1) return "X";
    const midi = selectedTuning.strings[stringIdx] + fret;
    return midiToNoteName(midi, useFlats);
  };

  // Helper to draw standard fret markers (3ª, 5ª, 7ª, 9ª, 12ª houses)
  const hasMarker = (fret: number) => {
    return [3, 5, 7, 9, 12].includes(fret);
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 w-full shadow-md">
      
      {/* Header (XP look) */}
      <div className="bg-gradient-to-r from-[#5a8f29] to-[#80bd41] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Dicionário Inverso (Clique no Braço)</span>
        <span className="font-mono text-xs">Modo Interativo</span>
      </div>

      <div className="flex flex-col gap-3 overflow-x-auto pb-2 retro-scrollbar">
        {/* Visual Neck */}
        <div className="min-w-[700px] bg-[#ece9d8] border border-[#808080] p-4 flex flex-col relative">
          
          {/* Fret Markers Header Row */}
          <div className="flex h-6 mb-1 ml-[90px]">
            {/* Nut spacer */}
            <div className="w-[30px] border-r-4 border-transparent"></div>
            {/* Frets marker texts */}
            {Array.from({ length: maxFrets }).map((_, idx) => {
              const fret = idx + 1;
              return (
                <div key={`marker-${fret}`} className="flex-1 flex justify-center text-[10px] font-mono font-bold text-gray-600">
                  {hasMarker(fret) ? `${fret}ª` : ""}
                </div>
              );
            })}
          </div>

          {/* Strings neck wrapper */}
          <div className="flex flex-col gap-1 bg-[#8B5A2B] border-2 border-t-[#5B3E1F] border-l-[#5B3E1F] border-r-[#C5A37F] border-b-[#C5A37F] p-2 relative rounded shadow-inner">
            
            {/* Draw string rows from lowest string (top) to highest string (bottom) */}
            {Array.from({ length: numStrings }).map((_, rIdx) => {
              const sIdx = rIdx;
              const openMidi = selectedTuning.strings[sIdx];
              const isMuted = activeFrets[sIdx] === -1;
              const activeFretVal = activeFrets[sIdx];
              
              return (
                <div key={`string-row-${sIdx}`} className="flex items-center h-8 relative z-10">
                  
                  {/* Left String Controls: Name + Mute button */}
                  <div className="w-[85px] flex items-center gap-1.5 pr-2 border-r border-[#ece9d8]/50 z-20">
                    <button
                      onClick={() => handleMuteToggle(sIdx)}
                      className={`w-6 h-6 flex items-center justify-center font-mono text-xs font-bold border rounded-sm cursor-pointer select-none ${
                        isMuted 
                          ? 'bg-[#ff7f27] text-white border-white' 
                          : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080]'
                      }`}
                      title={isMuted ? "Tocar corda" : "Abafar corda"}
                    >
                      {isMuted ? "X" : "O"}
                    </button>
                    <span className="text-xs font-mono font-bold text-white w-10 truncate">
                      {midiToNoteName(openMidi, useFlats)}
                    </span>
                  </div>

                  {/* Nut (fret 0) open string column */}
                  <div 
                    onClick={() => handleCellClick(sIdx, 0)}
                    className="w-[30px] flex justify-center items-center relative h-full cursor-pointer hover:bg-black/5"
                  >
                    {/* Metal bar nut */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#C5A37F] border-r border-black/80"></div>
                    
                    <button
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border pointer-events-none select-none z-10 ${
                        activeFretVal === 0
                          ? 'bg-[#228b22] text-white border-white'
                          : 'bg-[#d4d0c8]/30 text-gray-300 border-gray-400'
                      }`}
                    >
                      {activeFretVal === 0 ? "0" : ""}
                    </button>
                  </div>

                  {/* Fret Boxes 1 to 12 */}
                  {Array.from({ length: maxFrets }).map((_, fIdx) => {
                    const fret = fIdx + 1;
                    const isActive = activeFretVal === fret;
                    const noteName = getNoteAtFret(sIdx, fret);
                    
                    return (
                      <div 
                        key={`cell-${sIdx}-${fret}`} 
                        onClick={() => handleCellClick(sIdx, fret)}
                        className="flex-1 h-full border-r border-[#ece9d8]/40 flex justify-center items-center relative cursor-pointer hover:bg-black/5 group"
                      >
                        {/* Metal fret wire */}
                        <div className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-[#d3d3d3] shadow-[1px_0_1px_rgba(0,0,0,0.5)]"></div>
                        
                        {/* String visual line running through center */}
                        <div 
                          style={{
                            height: `${Math.max(1, 3.5 - (sIdx * 2.5) / (numStrings - 1 || 1))}px`
                          }}
                          className="absolute left-0 right-0 bg-yellow-100/70 z-0"
                        ></div>

                        {/* Inlay dots (markers) on the background */}
                        {rIdx === Math.floor(numStrings / 2) && hasMarker(fret) && fret !== 12 && (
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-white/20 z-0"></div>
                        )}
                        {rIdx === Math.floor(numStrings / 2) - 1 && fret === 12 && (
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-white/20 z-0 transform -translate-y-2"></div>
                        )}
                        {rIdx === Math.floor(numStrings / 2) + 1 && fret === 12 && (
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-white/20 z-0 transform translate-y-2"></div>
                        )}

                        {/* Clickable fret finger box */}
                        <button
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border pointer-events-none select-none z-10 transition-all ${
                            isActive
                              ? 'bg-[#0058e6] text-white border-white scale-110 shadow-md'
                              : 'bg-transparent border-transparent text-transparent group-hover:text-white/60'
                          }`}
                        >
                          {isActive ? noteName.replace('#', '♯').replace('b', '♭') : noteName}
                        </button>
                      </div>
                    );
                  })}

                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* Control Buttons & Detection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#d4d0c8] pt-3">
        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-bottom-white cursor-pointer select-none hover:bg-white flex-1"
          >
            Abafar Todas (X)
          </button>
          <button
            onClick={handleResetOpen}
            className="px-3 py-1.5 text-xs font-bold font-mono bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-bottom-white cursor-pointer select-none hover:bg-white flex-1"
          >
            Soltas Todas (O)
          </button>
        </div>

        {/* Display Current Notes Played */}
        <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 font-mono flex flex-col justify-center">
          <span className="text-[10px] text-gray-500 font-bold">Notas Pressionadas:</span>
          <div className="text-sm font-bold text-[#002fa7] flex gap-1.5 mt-1 overflow-x-auto">
            {activeFrets.map((fret, idx) => {
              const label = selectedInstrument.id === 'viola' ? `${5 - idx}º` : `${numStrings - idx}`;
              const note = getNoteAtFret(idx, fret);
              return (
                <div key={`note-p-${idx}`} className="flex flex-col items-center bg-[#ece9d8] border border-[#808080] px-1.5 py-0.5 rounded-sm min-w-10">
                  <span className="text-[8px] text-gray-500">{label}</span>
                  <span className={fret === -1 ? 'text-[#cc3300]' : 'text-[#228b22]'}>{note}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detected Chord Matches */}
        <div className="bg-[#d4d0c8] p-2 border border-[#808080] font-mono flex flex-col">
          <span className="text-[10px] text-gray-600 font-bold block mb-1">Acordes Identificados:</span>
          
          <div className="flex-1 h-[55px] overflow-y-auto bg-white border border-[#808080] p-1 flex flex-col gap-1 retro-scrollbar">
            {detectedChords.length === 0 ? (
              <span className="text-[10px] text-gray-400 italic text-center block mt-3">Nenhum acorde mapeado</span>
            ) : (
              detectedChords.map((match, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center text-xs px-1.5 py-0.5 hover:bg-[#c2d7f2] rounded-sm select-none"
                >
                  <span className="font-bold text-[#002fa7]">{match.chordName}</span>
                  <div className="flex gap-1.5 text-[9px] items-center">
                    {match.isPerfectMatch && (
                      <span className="bg-[#228b22] text-white px-1 font-bold rounded-sm" title="Todos os graus presentes">Perfeito</span>
                    )}
                    {match.isInversion && (
                      <span className="bg-[#808080] text-white px-1 rounded-sm" title="Baixo em nota diferente da fundamental">Invertido</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
