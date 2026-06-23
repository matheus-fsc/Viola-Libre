import React, { useState, useEffect } from 'react';
import type { Tuning, Instrument } from '../engine/types';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, CHORD_FORMULAS } from '../engine/tunings';
import { noteNameToPitchClass, midiToNoteName, shouldUseFlats } from '../engine/chordCalculator';

interface EarTranscriptionProps {
  selectedInstrument: Instrument;
  selectedTuning: Tuning;
}

interface KeyConfig {
  name: string;
  root: string;
  type: 'major' | 'minor';
  pitchClasses: number[];
}

interface MelodyNote {
  id: string;
  noteName: string;
  freq: number;
  stringIdx: number;
  fret: number;
}

// Generate the 24 Major & Minor keys
const rootsList = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
const minorIntervals = [0, 2, 3, 5, 7, 8, 10];

const PRESET_KEYS: KeyConfig[] = [];
rootsList.forEach(r => {
  const rootPc = noteNameToPitchClass(r);
  PRESET_KEYS.push({
    name: `${r} Maior`,
    root: r,
    type: 'major',
    pitchClasses: majorIntervals.map(i => (rootPc + i) % 12)
  });
  PRESET_KEYS.push({
    name: `${r} Menor`,
    root: r,
    type: 'minor',
    pitchClasses: minorIntervals.map(i => (rootPc + i) % 12)
  });
});

const getMajorHarmonizedField = (rootPc: number): { name: string; suffix: string; degree: string; role: string; pcs: number[] }[] => {
  const noteName = (pc: number) => NOTE_NAMES_SHARP[pc % 12];
  return [
    { name: noteName(rootPc), suffix: "", degree: "I", role: "Tônica", pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12] },
    { name: noteName(rootPc + 2) + "m", suffix: "m", degree: "II", role: "Supertônica", pcs: [(rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 9) % 12] },
    { name: noteName(rootPc + 4) + "m", suffix: "m", degree: "III", role: "Mediante", pcs: [(rootPc + 4) % 12, (rootPc + 7) % 12, (rootPc + 11) % 12] },
    { name: noteName(rootPc + 5), suffix: "", degree: "IV", role: "Subdominante", pcs: [(rootPc + 5) % 12, (rootPc + 9) % 12, (rootPc + 0) % 12] },
    { name: noteName(rootPc + 7), suffix: "", degree: "V", role: "Dominante", pcs: [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12] },
    { name: noteName(rootPc + 7) + "7", suffix: "7", degree: "V7", role: "Dominante 7ª", pcs: [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12] },
    { name: noteName(rootPc + 9) + "m", suffix: "m", degree: "VI", role: "Relativa", pcs: [(rootPc + 9) % 12, (rootPc + 0) % 12, (rootPc + 4) % 12] },
    { name: noteName(rootPc + 11) + "m7(b5)", suffix: "m7(b5)", degree: "VII", role: "Sensível", pcs: [(rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 9) % 12] },
  ];
};

const getMinorHarmonizedField = (rootPc: number): { name: string; suffix: string; degree: string; role: string; pcs: number[] }[] => {
  const noteName = (pc: number) => NOTE_NAMES_SHARP[pc % 12];
  return [
    { name: noteName(rootPc) + "m", suffix: "m", degree: "I", role: "Tônica", pcs: [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12] },
    { name: noteName(rootPc + 2) + "m7(b5)", suffix: "m7(b5)", degree: "II", role: "Supertônica", pcs: [(rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 8) % 12, (rootPc + 0) % 12] },
    { name: noteName(rootPc + 3), suffix: "", degree: "III", role: "Relativa Maior", pcs: [(rootPc + 3) % 12, (rootPc + 7) % 12, (rootPc + 10) % 12] },
    { name: noteName(rootPc + 5) + "m", suffix: "m", degree: "IV", role: "Subdominante", pcs: [(rootPc + 5) % 12, (rootPc + 8) % 12, (rootPc + 0) % 12] },
    { name: noteName(rootPc + 7) + "m", suffix: "m", degree: "V", role: "Dominante Menor", pcs: [(rootPc + 7) % 12, (rootPc + 10) % 12, (rootPc + 2) % 12] },
    { name: noteName(rootPc + 7) + "7", suffix: "7", degree: "V7", role: "Dominante Harmônica", pcs: [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12] },
    { name: noteName(rootPc + 8), suffix: "", degree: "VI", role: "Mediante", pcs: [(rootPc + 8) % 12, (rootPc + 0) % 12, (rootPc + 3) % 12] },
    { name: noteName(rootPc + 10), suffix: "", degree: "VII", role: "Subtônica", pcs: [(rootPc + 10) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12] },
  ];
};

let audioCtx: AudioContext | null = null;

const playNoteSound = (frequency: number) => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    console.error("Erro ao reproduzir som:", err);
  }
};

export const EarTranscription: React.FC<EarTranscriptionProps> = ({
  selectedInstrument,
  selectedTuning
}) => {
  const numStrings = selectedTuning.strings.length;
  const maxFrets = 12;

  // Selected reference key (initially empty)
  const [referenceKeyName, setReferenceKeyName] = useState<string>("");

  // Melody state: ordered sequence of clicked notes
  const [melody, setMelody] = useState<MelodyNote[]>([]);
  const [isPlayingMelody, setIsPlayingMelody] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(-1);

  // List of chords added by user (e.g. ["Dm", "G", "C"])
  const [selectedChords, setSelectedChords] = useState<string[]>([]);
  
  // States for chord builder input
  const [chordRoot, setChordRoot] = useState<string>("C");
  const [chordSuffix, setChordSuffix] = useState<string>("");

  // Clear state when tuning changes
  useEffect(() => {
    setMelody([]);
    setSelectedChords([]);
    setIsPlayingMelody(false);
    setCurrentPlayingIndex(-1);
  }, [selectedTuning]);

  // Convert referenceKeyName to key configuration
  const activeRefKey = PRESET_KEYS.find(k => k.name === referenceKeyName);
  const useFlats = referenceKeyName ? shouldUseFlats(activeRefKey?.root || "C") : false;
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

  const getNoteNameAtFret = (stringIdx: number, fret: number) => {
    const midi = selectedTuning.strings[stringIdx] + fret;
    const pc = midi % 12;
    return noteNames[pc];
  };

  const getNoteFreqAtFret = (stringIdx: number, fret: number) => {
    const midi = selectedTuning.strings[stringIdx] + fret;
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  const handleCellClick = (stringIdx: number, fret: number) => {
    const noteName = getNoteNameAtFret(stringIdx, fret);
    const freq = getNoteFreqAtFret(stringIdx, fret);
    
    // Play sound immediately
    playNoteSound(freq);

    // Append to melody sequence
    const newNote: MelodyNote = {
      id: `${Date.now()}-${Math.random()}`,
      noteName,
      freq,
      stringIdx,
      fret
    };
    setMelody(prev => [...prev, newNote]);
  };

  const handleClearNotes = () => {
    setMelody([]);
    setIsPlayingMelody(false);
    setCurrentPlayingIndex(-1);
  };

  const handleUndoMelody = () => {
    if (melody.length > 0) {
      setMelody(prev => prev.slice(0, -1));
    }
  };

  const handleRemoveMelodyNote = (indexToRemove: number) => {
    setMelody(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setIsPlayingMelody(false);
    setCurrentPlayingIndex(-1);
  };

  const handlePlayMelody = () => {
    if (melody.length === 0 || isPlayingMelody) return;
    setIsPlayingMelody(true);
    let index = 0;
    
    const playNext = () => {
      if (index >= melody.length) {
        setIsPlayingMelody(false);
        setCurrentPlayingIndex(-1);
        return;
      }
      
      setCurrentPlayingIndex(index);
      playNoteSound(melody[index].freq);
      
      index++;
      setTimeout(playNext, 450); // 450ms tempo per note
    };
    
    playNext();
  };

  const handleClearChords = () => {
    setSelectedChords([]);
  };

  const handleAddChord = () => {
    const chordName = `${chordRoot}${chordSuffix}`;
    if (!selectedChords.includes(chordName)) {
      setSelectedChords([...selectedChords, chordName]);
    }
  };

  const handleRemoveChord = (chord: string) => {
    setSelectedChords(selectedChords.filter(c => c !== chord));
  };

  // Get clicked frets to highlight on the neck (calculated from melody)
  const clickedFrets = new Set(melody.map(m => `${m.stringIdx}-${m.fret}`));

  // Get active pitch classes based on clicked notes (melody) + added chords
  const getActivePitchClasses = () => {
    const activePcs = new Set<number>();

    // 1. Add melody notes pitch classes
    melody.forEach(m => {
      const midi = selectedTuning.strings[m.stringIdx] + m.fret;
      activePcs.add(midi % 12);
    });

    // 2. Add chord notes pitch classes
    selectedChords.forEach(chordStr => {
      let r = "";
      let s = "";
      if (chordStr.startsWith("C#") || chordStr.startsWith("D#") || chordStr.startsWith("F#") || chordStr.startsWith("G#") || chordStr.startsWith("A#") ||
          chordStr.startsWith("Db") || chordStr.startsWith("Eb") || chordStr.startsWith("Gb") || chordStr.startsWith("Ab") || chordStr.startsWith("Bb")) {
        r = chordStr.slice(0, 2);
        s = chordStr.slice(2);
      } else {
        r = chordStr.slice(0, 1);
        s = chordStr.slice(1);
      }

      try {
        const rootPc = noteNameToPitchClass(r);
        const formula = CHORD_FORMULAS.find(f => f.suffix === s);
        if (formula) {
          formula.intervals.forEach(i => {
            activePcs.add((rootPc + i) % 12);
          });
        }
      } catch (err) {
        console.error(err);
      }
    });

    return activePcs;
  };

  const activePcs = getActivePitchClasses();

  // Calculate compatibility for each key
  const keyMatches = PRESET_KEYS.map(key => {
    let matchCount = 0;
    activePcs.forEach(pc => {
      if (key.pitchClasses.includes(pc)) {
        matchCount++;
      }
    });

    const percent = activePcs.size > 0 ? Math.round((matchCount / activePcs.size) * 100) : 0;
    
    const compatibleChords = selectedChords.filter(chordStr => {
      let r = "";
      let s = "";
      if (chordStr.startsWith("C#") || chordStr.startsWith("D#") || chordStr.startsWith("F#") || chordStr.startsWith("G#") || chordStr.startsWith("A#") ||
          chordStr.startsWith("Db") || chordStr.startsWith("Eb") || chordStr.startsWith("Gb") || chordStr.startsWith("Ab") || chordStr.startsWith("Bb")) {
        r = chordStr.slice(0, 2);
        s = chordStr.slice(2);
      } else {
        r = chordStr.slice(0, 1);
        s = chordStr.slice(1);
      }

      const rootPc = noteNameToPitchClass(r);
      const formula = CHORD_FORMULAS.find(f => f.suffix === s);
      if (!formula) return false;
      return formula.intervals.every(i => key.pitchClasses.includes((rootPc + i) % 12));
    });

    return {
      ...key,
      percent,
      matchCount,
      compatibleChordsCount: compatibleChords.length
    };
  });

  const sortedMatches = keyMatches
    .filter(m => m.percent > 0)
    .sort((a, b) => b.percent - a.percent || b.compatibleChordsCount - a.compatibleChordsCount);

  const getRecommendedChords = () => {
    if (melody.length === 0 || sortedMatches.length === 0) return [];
    
    const topMatch = sortedMatches[0];
    const rootPc = noteNameToPitchClass(topMatch.root);
    
    const field = topMatch.type === 'major' 
      ? getMajorHarmonizedField(rootPc)
      : getMinorHarmonizedField(rootPc);
      
    const melodyPcs = new Set(melody.map(m => {
      const midi = selectedTuning.strings[m.stringIdx] + m.fret;
      return midi % 12;
    }));
    
    const recUseFlats = shouldUseFlats(topMatch.root);
    const recNoteNames = recUseFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
    
    const scoredField = field.map(chord => {
      const intersection = chord.pcs.filter(pc => melodyPcs.has(pc));
      const matchCount = intersection.length;
      
      let chordName = chord.name;
      if (recUseFlats) {
        chordName = chord.name
          .replace("C#", "Db")
          .replace("D#", "Eb")
          .replace("F#", "Gb")
          .replace("G#", "Ab")
          .replace("A#", "Bb");
      }
      
      return {
        ...chord,
        displayName: chordName,
        matchCount,
        matchingNotes: intersection.map(pc => recNoteNames[pc])
      };
    });
    
    return scoredField.sort((a, b) => b.matchCount - a.matchCount);
  };

  // Find key fusions (modulations) if top match is < 100% and we have at least 2 active notes
  const fusions: { keyA: string; keyB: string; coverage: number }[] = [];
  const topPercent = sortedMatches[0]?.percent || 0;

  if (topPercent > 0 && topPercent < 100 && activePcs.size >= 2) {
    for (let i = 0; i < PRESET_KEYS.length; i++) {
      for (let j = i + 1; j < PRESET_KEYS.length; j++) {
        const keyA = PRESET_KEYS[i];
        const keyB = PRESET_KEYS[j];
        
        let unionMatchCount = 0;
        activePcs.forEach(pc => {
          if (keyA.pitchClasses.includes(pc) || keyB.pitchClasses.includes(pc)) {
            unionMatchCount++;
          }
        });

        if (unionMatchCount === activePcs.size) {
          fusions.push({
            keyA: keyA.name,
            keyB: keyB.name,
            coverage: 100
          });
        }
      }
    }
  }

  // Helper to check if a fret is part of referenceKey scale
  const isScaleNote = (stringIdx: number, fret: number) => {
    if (!activeRefKey) return false;
    const midi = selectedTuning.strings[stringIdx] + fret;
    return activeRefKey.pitchClasses.includes(midi % 12);
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 w-full shadow-md">
      
      {/* Box Header (XP style) */}
      <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Tirando de Ouvido (Análise de Tom)</span>
        <span className="font-mono text-xs">Assistente Harmonico</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        
        {/* Left/Middle Column: Fretboard & Controls */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#d4d0c8] p-3 border border-[#808080] rounded shadow-inner font-mono text-xs">
            
            {/* Key select guide */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-gray-700" htmlFor="ref-key-select">
                Tom de Referência (Escala Guia):
              </label>
              <select
                id="ref-key-select"
                value={referenceKeyName}
                onChange={(e) => setReferenceKeyName(e.target.value)}
                className="bevel-in px-2 py-1 bg-white focus:outline-none select-none cursor-pointer"
              >
                <option value="">(Nenhum - Limpo)</option>
                {PRESET_KEYS.map(k => (
                  <option key={k.name} value={k.name}>{k.name}</option>
                ))}
              </select>
            </div>

            {/* Chord Adder form */}
            <div className="flex flex-col gap-1">
              <span className="font-bold text-gray-700">Acordes na Música (Cifras):</span>
              <div className="grid grid-cols-4 gap-1 w-full">
                <select
                  value={chordRoot}
                  onChange={(e) => setChordRoot(e.target.value)}
                  className="bevel-in px-1 py-1 bg-white focus:outline-none font-bold cursor-pointer w-full col-span-1 min-w-0"
                >
                  {rootsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={chordSuffix}
                  onChange={(e) => setChordSuffix(e.target.value)}
                  className="bevel-in px-1 py-1 bg-white focus:outline-none cursor-pointer w-full col-span-2 min-w-0"
                >
                  {CHORD_FORMULAS.map(f => {
                    const displaySuffix = f.suffix || "Maior";
                    let shortName = f.name;
                    if (shortName.length > 15) {
                      shortName = shortName.slice(0, 12) + "...";
                    }
                    return (
                      <option key={f.suffix} value={f.suffix}>
                        {displaySuffix} ({shortName})
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={handleAddChord}
                  className="px-1 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] font-bold active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer select-none col-span-1 w-full text-center truncate"
                >
                  + Add
                </button>
              </div>
            </div>

          </div>

          {/* Visual Fretboard */}
          <div className="flex flex-col overflow-x-auto pb-2 retro-scrollbar">
            <div className="min-w-[700px] bg-[#ece9d8] border border-[#808080] p-4 flex flex-col relative select-none">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-[10px] font-mono text-gray-600 mb-2 font-bold w-full">
                <span>Monte a melodia clicando nas notas do braço abaixo na sequência:</span>
                <div className="flex gap-1 shrink-0">
                  <button 
                    onClick={handleUndoMelody}
                    disabled={melody.length === 0}
                    className="px-2 py-0.5 bg-[#d4d0c8] border border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Apagar Última
                  </button>
                  <button 
                    onClick={handleClearNotes}
                    disabled={melody.length === 0}
                    className="px-2 py-0.5 bg-[#d4d0c8] border border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Grid Neck */}
              <div className="relative border-r border-[#808080] bg-[#e3dac9] py-1 shadow-inner">
                {/* Nut (Traste 0) */}
                <div className="absolute left-[59px] top-0 bottom-0 w-[4px] bg-[#8a7f70] border-r border-black z-20" />

                {/* Render strings from top to bottom (Lowest pitch at the top) */}
                {Array.from({ length: numStrings }).map((_, rIdx) => {
                  // Invert indices so lowest pitch string pair (index 0) sits on TOP
                  const stringIdx = numStrings - 1 - rIdx;
                  const openMidi = selectedTuning.strings[stringIdx];
                  const label = selectedInstrument.id === 'viola' 
                    ? `${5 - stringIdx}º Par` 
                    : `Cord. ${numStrings - stringIdx}`;

                  return (
                    <div key={`string-row-${stringIdx}`} className="h-9 flex items-center relative">
                      
                      {/* String horizontal line (with realistic dynamic thickness) */}
                      <div 
                        style={{
                          height: `${Math.max(1, 3.5 - (stringIdx * 2.5) / (numStrings - 1 || 1))}px`
                        }}
                        className="absolute left-[60px] right-0 bg-[#a89f91] border-b border-white/40 pointer-events-none z-10" 
                      />

                      {/* String label */}
                      <div className="w-[55px] font-mono text-[10px] font-bold text-gray-700 flex justify-between px-1 pointer-events-none select-none z-20 bg-[#ece9d8] border-r border-[#d4d0c8] h-full items-center">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-[#002fa7] font-sans font-bold">{midiToNoteName(openMidi, useFlats)}</span>
                      </div>

                      {/* Fret cells */}
                      {Array.from({ length: maxFrets + 1 }).map((_, fret) => {
                        const cellKey = `${stringIdx}-${fret}`;
                        const isClicked = clickedFrets.has(cellKey);
                        const isScale = isScaleNote(stringIdx, fret);
                        const noteName = getNoteNameAtFret(stringIdx, fret);
                        
                        // Check if this specific cell is currently being animated/played
                        const isCurrentlyPlayingCell = isPlayingMelody && 
                          currentPlayingIndex >= 0 && 
                          melody[currentPlayingIndex].stringIdx === stringIdx && 
                          melody[currentPlayingIndex].fret === fret;

                        const isRootNote = activeRefKey && (noteName === activeRefKey.root || (useFlats && noteName === NOTE_NAMES_FLAT[noteNameToPitchClass(activeRefKey.root)]) || (!useFlats && noteName === NOTE_NAMES_SHARP[noteNameToPitchClass(activeRefKey.root)]));

                        return (
                          <div
                            key={`cell-${stringIdx}-${fret}`}
                            onClick={() => handleCellClick(stringIdx, fret)}
                            style={{
                              width: fret === 0 ? '60px' : '52px',
                            }}
                            className={`h-full border-r border-[#8a7f70] flex items-center justify-center cursor-pointer transition-all hover:bg-black/5 relative z-20 ${
                              isCurrentlyPlayingCell
                                ? 'bg-[#ff9d00] text-white font-extrabold scale-105 border border-red-500 z-30 animate-pulse'
                                : isClicked 
                                  ? 'bg-[#0058e6]/70 text-white font-bold' 
                                  : isScale 
                                    ? isRootNote
                                      ? 'bg-[#228b22]/15 hover:bg-[#228b22]/20'
                                      : 'bg-green-100/40'
                                    : ''
                            }`}
                          >
                            {/* Fret number or guide */}
                            <span className="text-[10px] font-mono select-none pointer-events-none">
                              {noteName}
                            </span>

                            {/* Reference scale dot outline if guide is enabled */}
                            {isScale && !isClicked && !isCurrentlyPlayingCell && (
                              <div className={`absolute w-1.5 h-1.5 rounded-full ${isRootNote ? 'bg-red-500' : 'bg-green-600'} opacity-75`} />
                            )}
                          </div>
                        );
                      })}

                    </div>
                  );
                })}

                {/* Fret marker dot background under strings */}
                <div className="absolute inset-0 flex pointer-events-none z-0">
                  <div className="w-[55px]" /> {/* spacing offset */}
                  {Array.from({ length: maxFrets + 1 }).map((_, fret) => {
                    const hasMark = [3, 5, 7, 9, 12].includes(fret);
                    return (
                      <div
                        key={`neck-fret-bg-${fret}`}
                        style={{
                          width: fret === 0 ? '60px' : '52px',
                        }}
                        className="h-full flex items-center justify-center border-r border-[#808080]/10"
                      >
                        {hasMark && fret > 0 && (
                          <div className="w-2.5 h-2.5 rounded-full bg-black/8 opacity-25" />
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Fret numbers footer row */}
              <div className="flex select-none pointer-events-none mt-1.5">
                <div className="w-[55px]" />
                {Array.from({ length: maxFrets + 1 }).map((_, fret) => (
                  <div
                    key={`fret-num-${fret}`}
                    style={{
                      width: fret === 0 ? '60px' : '52px',
                    }}
                    className="text-center font-mono text-[9px] font-bold text-gray-500"
                  >
                    {fret === 0 ? 'Solto' : `${fret}ª`}
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Melody Sequence List and Player Bar */}
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-3 font-mono text-xs flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-dashed border-[#808080] pb-2">
              <span className="font-bold text-gray-700">Sequência da Melodia Tirada ({melody.length} notas):</span>
              <button 
                onClick={handlePlayMelody}
                disabled={melody.length === 0 || isPlayingMelody}
                className="px-3 py-1 bg-gradient-to-r from-[#228b22] to-[#2ecc71] text-white border border-green-800 font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-green-400 cursor-pointer select-none flex items-center gap-1.5 rounded-sm"
              >
                {isPlayingMelody ? "▶ Tocando..." : "▶ Ouvir Melodia"}
              </button>
            </div>

            <div className="flex gap-2 items-center bg-[#ece9d8]/50 border border-dotted border-[#808080] p-2 overflow-x-auto whitespace-nowrap min-h-[50px] retro-scrollbar">
              {melody.length === 0 ? (
                <span className="text-gray-400 italic text-[11px]">Nenhuma nota tocada. Toque no braço acima para construir a melodia passo a passo!</span>
              ) : (
                 melody.map((note, index) => {
                  const isPlaying = isPlayingMelody && currentPlayingIndex === index;
                  return (
                    <div key={note.id} className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRemoveMelodyNote(index)}
                        title="Clique para remover esta nota"
                        className={`px-2 py-1 rounded-sm border font-bold text-xs shadow-sm transition-all cursor-pointer ${
                          isPlaying 
                            ? 'bg-[#ff9d00] text-white border-orange-700 scale-115 font-black ring-2 ring-orange-300' 
                            : 'bg-white text-black border-gray-400 hover:bg-red-600 hover:text-white hover:border-red-700'
                        }`}
                      >
                        {note.noteName}
                      </button>
                      {index < melody.length - 1 && (
                        <span className="text-gray-400 font-bold text-sm">➔</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active notes pool visual indicator */}
          <div className="bg-white border border-[#808080] p-3 font-mono text-xs">
            <span className="font-bold text-gray-600 block mb-2">Pool de Notas Ativas (Diferentes Pitch Classes encontradas):</span>
            <div className="flex flex-wrap gap-1.5">
              {activePcs.size === 0 ? (
                <span className="text-gray-400 italic text-[11px]">Nenhuma nota no pool. Toque no braço ou adicione acordes acima.</span>
              ) : (
                Array.from(activePcs).map(pc => (
                  <span
                    key={`pool-pc-${pc}`}
                    className="px-2 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] font-bold text-[#002fa7]"
                  >
                    {noteNames[pc]}
                  </span>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Chord list & Harmonizer Analyzer */}
        <div className="flex flex-col gap-4">
          
          {/* Chords Added Container */}
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-3 flex flex-col gap-2 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-dashed border-[#808080] pb-1.5">
              <span className="font-bold text-gray-700">Acordes Adicionados:</span>
              <button 
                onClick={handleClearChords}
                disabled={selectedChords.length === 0}
                className="text-[10px] px-1.5 py-0.5 bg-[#d4d0c8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] cursor-pointer"
              >
                Limpar
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1.5 min-h-[50px] items-center p-2 bg-[#ece9d8]/30 border border-dotted border-gray-400 rounded">
              {selectedChords.length === 0 ? (
                <span className="text-gray-400 italic text-[11px]">Nenhum acorde adicionado ainda.</span>
              ) : (
                selectedChords.map(c => (
                  <span 
                    key={`added-chord-${c}`} 
                    className="px-2 py-0.5 bg-gradient-to-r from-[#ff9d00] to-[#ff5f00] text-white border border-orange-600 rounded flex items-center gap-1.5 font-bold shadow-sm"
                  >
                    {c}
                    <button 
                      onClick={() => handleRemoveChord(c)}
                      className="hover:text-red-200 font-extrabold focus:outline-none cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Key Analysis Results */}
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-3 flex flex-col gap-2 font-mono text-xs flex-1">
            <span className="font-bold text-[#002fa7] border-b border-dashed border-[#808080] pb-1.5">
              Sugestão de Tom Compatível:
            </span>

            <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-2 pr-1 retro-scrollbar">
              {activePcs.size === 0 ? (
                <div className="text-gray-400 italic text-[11px] text-center py-8">
                  Adicione notas no braço ou insira acordes ao lado para ver os tons correspondentes.
                </div>
              ) : (
                sortedMatches.slice(0, 5).map(match => {
                  let progressColor = "bg-[#228b22]"; // green
                  if (match.percent < 70) progressColor = "bg-[#ff9d00]"; // orange
                  if (match.percent < 50) progressColor = "bg-[#cc3300]"; // red

                  return (
                    <div 
                      key={`match-${match.name}`} 
                      className="border border-[#808080] p-2 hover:bg-[#ece9d8]/40 flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-black">{match.name}</span>
                        <span className="text-[#002fa7]">{match.percent}% compatível</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-[#ece9d8] border border-[#808080]/30 shadow-inner rounded-sm overflow-hidden">
                        <div 
                          className={`h-full ${progressColor}`}
                          style={{ width: `${match.percent}%` }}
                        />
                      </div>

                      {/* Info on matching chords */}
                      {selectedChords.length > 0 && (
                        <div className="text-[10px] text-gray-600">
                          Acordes no tom: <strong className="text-gray-900">{match.compatibleChordsCount} / {selectedChords.length}</strong>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Key Fusions/Modulations section */}
            {fusions.length > 0 && (
              <div className="border-t border-[#808080]/30 pt-2.5 mt-2">
                <span className="font-bold text-[#cc3300] block mb-1">Possível Modulação / Fusão de Tons:</span>
                <p className="text-[10px] text-gray-600 leading-normal mb-2">
                  Como nenhuma escala cobre 100% das notas inseridas sozinhos, a música pode transitar entre os seguintes tons:
                </p>
                <div className="max-h-[100px] overflow-y-auto flex flex-col gap-1 pr-1 retro-scrollbar">
                  {fusions.slice(0, 3).map((f, idx) => (
                    <div key={`fusion-${idx}`} className="bg-orange-50 border border-orange-200 text-gray-800 p-1.5 text-[10px] font-bold">
                      {f.keyA} ⇄ {f.keyB}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Recommended Chords Container */}
          <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-3 flex flex-col gap-2 font-mono text-xs">
            <span className="font-bold text-[#228b22] border-b border-dashed border-[#808080] pb-1.5 flex items-center gap-1.5">
              Harmonização (Acordes Diatônicos Recomendados):
            </span>
            
            {melody.length === 0 ? (
              <div className="text-gray-400 italic text-[11px] text-center py-4">
                Monte uma melodia para ver sugestões de acordes harmonizados.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 retro-scrollbar">
                <span className="text-[10px] text-gray-500 leading-normal block">
                  Sugestões baseadas no tom principal (<strong>{sortedMatches[0]?.name}</strong>):
                </span>
                
                {getRecommendedChords().map((rec, idx) => {
                  const alreadyAdded = selectedChords.includes(rec.displayName);
                  return (
                    <div 
                      key={`rec-${idx}`} 
                      className="border border-[#808080] p-1.5 hover:bg-[#ece9d8]/40 flex justify-between items-center gap-2"
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-bold text-black text-xs block truncate" title={rec.displayName}>
                          {rec.displayName} <span className="text-[10px] text-gray-500 font-normal">({rec.degree} - {rec.role})</span>
                        </span>
                        {rec.matchCount > 0 ? (
                          <span className="text-[9px] text-[#228b22] block truncate" title={`Compartilha: ${rec.matchingNotes.join(', ')}`}>
                            Contém: {rec.matchingNotes.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[9px] text-gray-400 block truncate">
                            Nenhuma nota compartilhada
                          </span>
                        )}
                      </div>
                      
                      <button
                        onClick={() => {
                          if (!alreadyAdded) {
                            setSelectedChords([...selectedChords, rec.displayName]);
                          }
                        }}
                        disabled={alreadyAdded}
                        className="px-2 py-0.5 text-[10px] font-bold bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white cursor-pointer select-none shrink-0"
                      >
                        {alreadyAdded ? "✓ Adicionado" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
