import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { Tuning, Instrument } from '../engine/types';
import { noteNameToPitchClass, shouldUseFlats } from '../engine/chordCalculator';

// Subcomponents and types
import type { MelodyNote } from './MelodySequenceEditor/types';
import {
  getDiatonicChordsForKey,
  getIntervalsForSuffix,
  getMelodySteps,
  generateChordsForMelody
} from './MelodySequenceEditor/helpers';
import { PlaybackProvider, usePlayback } from './MelodySequenceEditor/PlaybackContext';
import { TransportControls } from './MelodySequenceEditor/TransportControls';
import { TimeRuler } from './MelodySequenceEditor/TimeRuler';
import { PianoRollGrid } from './MelodySequenceEditor/PianoRollGrid';
// NotePropertiesPanel removed to use compact toolbar

// Re-export type for compatibility with EarTranscription.tsx
export type { MelodyNote };

interface MelodySequenceEditorProps {
  melody: MelodyNote[];
  setMelody: React.Dispatch<React.SetStateAction<MelodyNote[]>>;
  isPlayingMelody: boolean;
  setIsPlayingMelody: React.Dispatch<React.SetStateAction<boolean>>;
  selectedNoteIdx: number | null;
  setSelectedNoteIdx: React.Dispatch<React.SetStateAction<number | null>>;
  bpm: number;
  setBpm: (bpm: number) => void;
  playNoteSound: (frequency: number, durationSec?: number) => void;
  ensureAudioContextActive?: () => Promise<AudioContext | null>;
  selectedTuning: Tuning;
  selectedInstrument: Instrument;
  useFlats: boolean;
  midiToNoteName: (midi: number, useFlats: boolean) => string;
  getNoteNameAtFret: (stringIdx: number, fret: number) => string;
  getNoteFreqAtFret: (stringIdx: number, fret: number) => number;
  numStrings: number;
  maxFrets: number;
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  isDocked: boolean;
  setIsDocked: (docked: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  windowPos: { x: number; y: number };
  setWindowPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  selectedChords: string[];
  setSelectedChords: React.Dispatch<React.SetStateAction<string[]>>;
  sortedMatches?: any[];
  isTaskbarCollapsed: boolean;
  /** Altura atual do painel (controlada pelo pai para sincronizar paddingBottom da página) */
  editorHeight: number;
  onEditorHeightChange: (height: number) => void;
}


const MelodySequenceEditorContent: React.FC<MelodySequenceEditorProps> = ({
  selectedNoteIdx,
  setSelectedNoteIdx,
  selectedTuning,
  selectedInstrument,
  useFlats,
  midiToNoteName,
  getNoteNameAtFret,
  getNoteFreqAtFret,
  numStrings,
  maxFrets,
  isEditorOpen,
  setIsEditorOpen,
  isDocked,
  setIsDocked,
  isMinimized,
  setIsMinimized,
  windowPos,
  setWindowPos,
  selectedChords,
  setSelectedChords,
  sortedMatches,
  isTaskbarCollapsed,
  editorHeight,
  onEditorHeightChange,
}) => {
  const {
    melody,
    setMelody,
    setIsPlayingMelody,
    bpm,
    playheadRef,
    playheadHighlightRef,
    scrollContainerRef,
    isUserScrollingRef,
    playNoteSound
  } = usePlayback();

  const [draggedNoteIdx, setDraggedNoteIdx] = useState<number | null>(null);
  const [draggedOverCell, setDraggedOverCell] = useState<{ stepId: string, midi: number } | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number; index: number } | null>(null);
  const [showHarmonizer, setShowHarmonizer] = useState(false);
  const [harmRoot, setHarmRoot] = useState("C");
  const [harmType, setHarmType] = useState<'major' | 'minor'>("major");
  const [harmStyle, setHarmStyle] = useState<'pop' | 'jazz'>("pop");
  const [timeSignature, setTimeSignature] = useState<string>("4/4");
  const [chordRhythm, setChordRhythm] = useState<string>("every-beat");
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);

  // Vertical MIDI range expansion state
  const [extraHighRows, setExtraHighRows] = useState(0);
  const [extraLowRows, setExtraLowRows] = useState(0);

  // Resizable editor height — controlled by parent via props
  // editorHeight and onEditorHeightChange are received from props (see below)

  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Slow-scroll interval ref
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edge resize refs
  const resizeEdgeRef = useRef<'top' | 'bottom' | null>(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(380);

  // Undo/Redo History States
  const [history, setHistory] = useState<MelodyNote[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Memoized grid range and note lookup maps (O(1) search)
  const midiRange = useMemo(() => {
    const tuningStrings = selectedTuning.strings;
    if (!tuningStrings || tuningStrings.length === 0) return [];
    const lowestInstrumentMidi = tuningStrings[0];
    const highestInstrumentMidi = tuningStrings[tuningStrings.length - 1] + maxFrets;

    const startMidi = Math.max(0, lowestInstrumentMidi - extraLowRows);
    const endMidi = Math.min(127, highestInstrumentMidi + extraHighRows);

    const range = [];
    for (let m = endMidi; m >= startMidi; m--) {
      range.push(m);
    }
    return range;
  }, [selectedTuning, maxFrets, extraHighRows, extraLowRows]);

  const noteLookup = useMemo(() => {
    const lookup = new Map<string, { note: MelodyNote, flatIdx: number }[]>();
    const tuningStrings = selectedTuning.strings;
    
    melody.forEach((note, flatIdx) => {
      const stepId = note.stepId || `step-${note.id}`;
      const openMidi = tuningStrings[note.stringIdx];
      if (openMidi === undefined) return;
      const midi = openMidi + note.fret;
      
      const key = `${stepId}-${midi}`;
      if (!lookup.has(key)) {
        lookup.set(key, []);
      }
      lookup.get(key)!.push({ note, flatIdx });
    });
    
    return lookup;
  }, [melody, selectedTuning]);

  // Sync harmonization parameters based on top chord match
  useEffect(() => {
    if (sortedMatches && sortedMatches.length > 0 && melody.length > 0) {
      const topMatch = sortedMatches[0];
      if (topMatch && topMatch.root) {
        setHarmRoot(topMatch.root);
        setHarmType(topMatch.type);
      }
    }
  }, [sortedMatches, melody.length]);

  // Sync melody state changes with the history stack
  useEffect(() => {
    if (history.length === 0) {
      setHistory([melody]);
      setHistoryIndex(0);
      return;
    }
    
    const currentSnapshot = history[historyIndex];
    const isSame = JSON.stringify(melody) === JSON.stringify(currentSnapshot);
    
    if (!isSame) {
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory([...newHistory, melody]);
      setHistoryIndex(newHistory.length);
    }
  }, [melody]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevMelody = history[prevIndex];
      setHistoryIndex(prevIndex);
      setMelody(prevMelody);
      
      setSelectedNoteIdx(prevSelected => {
        if (prevSelected === null) return null;
        if (prevMelody.length === 0) return null;
        if (prevSelected >= prevMelody.length) {
          return prevMelody.length - 1;
        }
        return prevSelected;
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextMelody = history[nextIndex];
      setHistoryIndex(nextIndex);
      setMelody(nextMelody);
      
      setSelectedNoteIdx(prevSelected => {
        if (prevSelected === null) return null;
        if (nextMelody.length === 0) return null;
        if (prevSelected >= nextMelody.length) {
          return nextMelody.length - 1;
        }
        return prevSelected;
      });
    }
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y (when editor is active)
  useEffect(() => {
    if (!isEditorOpen || isMinimized) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEditorOpen, isMinimized, historyIndex, history]);

  // Click handler to close dropdown menus globally
  useEffect(() => {
    const handleGlobalClick = () => {
      setMenuCoords(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleHarmonizeMelody = () => {
    if (melody.length === 0) return;
    
    const steps = getMelodySteps(melody);
    const melodyForGen = steps.map(step => step.notes[0]);
    
    const suggested = generateChordsForMelody(
      melodyForGen,
      harmRoot,
      harmType,
      harmStyle,
      shouldUseFlats(harmRoot)
    );
    
    const newMelody: MelodyNote[] = [];
    let currentBeat = 0;
    let lastVoicedChord: string | null = null;
    
    steps.forEach((step, idx) => {
      const startBeat = currentBeat;
      currentBeat += step.duration || 1.0;
      
      const chordName = suggested[idx];
      if (!chordName) {
        step.notes.forEach(n => {
          newMelody.push({ ...n, suggestedChord: undefined });
        });
        return;
      }
      
      let root = "";
      let suffix = "";
      if (chordName.startsWith("C#") || chordName.startsWith("D#") || chordName.startsWith("F#") || chordName.startsWith("G#") || chordName.startsWith("A#") ||
          chordName.startsWith("Db") || chordName.startsWith("Eb") || chordName.startsWith("Gb") || chordName.startsWith("Ab") || chordName.startsWith("Bb")) {
        root = chordName.slice(0, 2);
        suffix = chordName.slice(2);
      } else {
        root = chordName.slice(0, 1);
        suffix = chordName.slice(1);
      }
      
      const rootPc = noteNameToPitchClass(root);
      const intervals = getIntervalsForSuffix(suffix);
      const chordPcs = intervals.map(i => (rootPc + i) % 12);
      
      let primaryMelodyNote = step.notes[0];
      let maxMidiVal = -1;
      step.notes.forEach(note => {
        const midi = selectedTuning.strings[note.stringIdx] + note.fret;
        if (midi > maxMidiVal) {
          maxMidiVal = midi;
          primaryMelodyNote = note;
        }
      });
      const midiMelody = selectedTuning.strings[primaryMelodyNote.stringIdx] + primaryMelodyNote.fret;
      
      const occupiedStrings = new Set(step.notes.map(n => n.stringIdx));
      const accompanimentNotes: { stringIdx: number; fret: number }[] = [];
      
      let beatsPerBar = 4.0;
      if (timeSignature === "3/4") beatsPerBar = 3.0;
      else if (timeSignature === "2/4") beatsPerBar = 2.0;
      else if (timeSignature === "6/8") beatsPerBar = 3.0;
      
      let isChordVoicingCandidate = false;
      if (chordRhythm === "every-beat") {
        isChordVoicingCandidate = step.duration >= 1.0;
      } else if (chordRhythm === "every-2-beats") {
        isChordVoicingCandidate = step.duration >= 1.0 && (
          idx === 0 || 
          chordName !== lastVoicedChord || 
          startBeat % 2.0 === 0
        );
      } else if (chordRhythm === "every-bar") {
        isChordVoicingCandidate = step.duration >= 1.0 && (
          idx === 0 || 
          chordName !== lastVoicedChord || 
          startBeat % beatsPerBar === 0
        );
      } else if (chordRhythm === "changes-only") {
        isChordVoicingCandidate = step.duration >= 1.0 && (
          idx === 0 || 
          chordName !== lastVoicedChord
        );
      } else if (chordRhythm === "manual") {
        isChordVoicingCandidate = false;
      }
      
      if (isChordVoicingCandidate) {
        const stringCandidates: { stringIdx: number; candidate: { fret: number, midi: number, isRoot: boolean, distance: number } }[] = [];
        
        for (let s = 0; s < numStrings; s++) {
          if (occupiedStrings.has(s)) continue;
          
          const candidates: { fret: number, midi: number, isRoot: boolean, distance: number }[] = [];
          const openMidi = selectedTuning.strings[s];
          
          for (let f = 0; f <= 5; f++) {
            const noteMidi = openMidi + f;
            if (noteMidi < midiMelody) {
              const pc = noteMidi % 12;
              if (chordPcs.includes(pc)) {
                candidates.push({
                  fret: f,
                  midi: noteMidi,
                  isRoot: pc === rootPc,
                  distance: Math.abs(f - primaryMelodyNote.fret)
                });
              }
            }
          }
          
          if (candidates.length > 0) {
            const isBassString = s === 0 || (s === 1 && !occupiedStrings.has(0));
            candidates.sort((a, b) => {
              if (isBassString) {
                if (a.isRoot && !b.isRoot) return -1;
                if (!a.isRoot && b.isRoot) return 1;
              }
              if (a.fret === 0 && b.fret !== 0) return -1;
              if (a.fret !== 0 && b.fret === 0) return 1;
              return a.distance - b.distance;
            });
            stringCandidates.push({ stringIdx: s, candidate: candidates[0] });
          }
        }
        
        const targetTotalNotes = numStrings >= 5 ? 4 : 3;
        const neededAccompaniment = targetTotalNotes - step.notes.length;
        
        if (neededAccompaniment > 0 && stringCandidates.length > 0) {
          stringCandidates.sort((a, b) => a.stringIdx - b.stringIdx);
          
          accompanimentNotes.push({
            stringIdx: stringCandidates[0].stringIdx,
            fret: stringCandidates[0].candidate.fret
          });
          
          if (neededAccompaniment > 1 && stringCandidates.length > 1) {
            const remaining = stringCandidates.slice(1);
            remaining.sort((a, b) => b.stringIdx - a.stringIdx);
            
            for (let i = 0; i < neededAccompaniment - 1 && i < remaining.length; i++) {
              accompanimentNotes.push({
                stringIdx: remaining[i].stringIdx,
                fret: remaining[i].candidate.fret
              });
            }
          }
        }
        
        lastVoicedChord = chordName;
      }
      
      step.notes.forEach(note => {
        newMelody.push({
          ...note,
          suggestedChord: chordName
        });
      });
      
      accompanimentNotes.forEach((v, vIdx) => {
        const noteName = getNoteNameAtFret(v.stringIdx, v.fret);
        const freq = getNoteFreqAtFret(v.stringIdx, v.fret);
        newMelody.push({
          id: `${Date.now()}-${Math.random()}-${idx}-acc-${vIdx}`,
          stepId: step.stepId,
          noteName,
          freq,
          stringIdx: v.stringIdx,
          fret: v.fret,
          duration: step.duration || 1.0,
          suggestedChord: chordName
        });
      });
    });
    
    setMelody(newMelody);
    setSelectedNoteIdx(null);
  };

  const handleClearChords = () => {
    setMelody(prev => prev.map(note => ({
      ...note,
      suggestedChord: undefined
    })));
  };

  const handleLoadChordsToPool = () => {
    const chordsInMelody = melody
      .map(n => n.suggestedChord)
      .filter((c): c is string => !!c);
    
    if (chordsInMelody.length === 0) return;
    const uniqueChords = Array.from(new Set(chordsInMelody));
    
    setSelectedChords(prev => {
      const merged = [...prev];
      uniqueChords.forEach(c => {
        if (!merged.includes(c)) {
          merged.push(c);
        }
      });
      return merged;
    });
  };

  const handleAddNoteToStep = (stepId: string) => {
    const stepNotes = melody.filter(n => (n.stepId || `step-${n.id}`) === stepId);
    
    const referenceNote = (stepNotes.length > 0 ? stepNotes.find(n => n.fret !== -1) : null)
      || melody.find(n => n.fret !== -1) 
      || ({ stringIdx: 0, fret: 0, duration: 1.0 } as MelodyNote);
      
    const targetStringIdx = referenceNote.stringIdx >= 0 ? referenceNote.stringIdx : 0;
    const targetFret = referenceNote.fret >= 0 ? (referenceNote.fret + 2) % 12 : 2;
    
    const newNote: MelodyNote = {
      id: `${Date.now()}-${Math.random()}`,
      stepId: stepId,
      noteName: getNoteNameAtFret(targetStringIdx, targetFret),
      freq: getNoteFreqAtFret(targetStringIdx, targetFret),
      stringIdx: targetStringIdx,
      fret: targetFret,
      duration: referenceNote.duration || 1.0,
      suggestedChord: referenceNote.suggestedChord,
      theory: referenceNote.theory,
      section: referenceNote.section
    };
    
    setMelody(prev => {
      const restNoteIdx = prev.findIndex(n => (n.stepId || `step-${n.id}`) === stepId && n.fret === -1);
      
      const next = [...prev];
      if (restNoteIdx !== -1) {
        next[restNoteIdx] = newNote;
      } else {
        const lastNoteIdx = prev.map(n => n.stepId || `step-${n.id}`).lastIndexOf(stepId);
        if (lastNoteIdx !== -1) {
          next.splice(lastNoteIdx + 1, 0, newNote);
        } else {
          next.push(newNote);
        }
      }
      return next;
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setMelody(prev => prev.filter(n => (n.stepId || `step-${n.id}`) !== stepId));
    setSelectedNoteIdx(null);
    setIsPlayingMelody(false);
  };

  const handleDuplicateStep = (stepId: string) => {
    const stepNotes = melody.filter(n => (n.stepId || `step-${n.id}`) === stepId);
    if (stepNotes.length === 0) return;
    
    const newStepId = `step-${Date.now()}-${Math.random()}`;
    const copies = stepNotes.map(note => ({
      ...note,
      id: `${Date.now()}-${Math.random()}-${note.id}`,
      stepId: newStepId
    }));
    
    setMelody(prev => {
      const lastNoteIdx = prev.map(n => n.stepId || `step-${n.id}`).lastIndexOf(stepId);
      const next = [...prev];
      next.splice(lastNoteIdx + 1, 0, ...copies);
      return next;
    });
  };

  const handleShiftStep = (stepId: string, direction: 'left' | 'right') => {
    const steps = getMelodySteps(melody);
    const index = steps.findIndex(s => s.stepId === stepId);
    if (index === -1) return;
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === steps.length - 1) return;
    
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    const reorderedSteps = [...steps];
    const temp = reorderedSteps[index];
    reorderedSteps[index] = reorderedSteps[targetIndex];
    reorderedSteps[targetIndex] = temp;
    
    const newMelody: MelodyNote[] = [];
    reorderedSteps.forEach(step => {
      step.notes.forEach(n => {
        newMelody.push(n);
      });
    });
    
    setMelody(newMelody);
  };

  const handleUpdateStepDuration = (stepId: string, newDuration: number) => {
    setMelody(prev => prev.map(note => {
      const sId = note.stepId || `step-${note.id}`;
      if (sId === stepId) {
        return { ...note, duration: newDuration };
      }
      return note;
    }));
  };

  const findStringAndFretForMidi = (targetMidi: number, preferredStringIdx?: number): { stringIdx: number, fret: number } | null => {
    const candidates: { stringIdx: number, fret: number, distance: number }[] = [];
    const strings = selectedTuning.strings;
    for (let s = 0; s < numStrings; s++) {
      const openMidi = strings[s];
      if (openMidi === undefined) continue;
      const fret = targetMidi - openMidi;
      if (fret >= 0 && fret <= maxFrets) {
        const dist = preferredStringIdx !== undefined ? Math.abs(s - preferredStringIdx) : 0;
        candidates.push({ stringIdx: s, fret, distance: dist });
      }
    }
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.fret - b.fret;
    });
    
    return { stringIdx: candidates[0].stringIdx, fret: candidates[0].fret };
  };

  const handleMoveNoteToCell = (noteIdx: number, targetStepId: string, targetMidi: number) => {
    const note = melody[noteIdx];
    if (!note) return;
    
    const found = findStringAndFretForMidi(targetMidi, note.stringIdx);
    if (!found) return;
    
    const updatedNote = {
      ...note,
      stepId: targetStepId,
      stringIdx: found.stringIdx,
      fret: found.fret,
      noteName: getNoteNameAtFret(found.stringIdx, found.fret),
      freq: getNoteFreqAtFret(found.stringIdx, found.fret)
    };
    
    setMelody(prev => {
      const sourceStepId = note.stepId || `step-${note.id}`;
      const sourceStepNotes = prev.filter(n => (n.stepId || `step-${n.id}`) === sourceStepId);
      
      let next: MelodyNote[];
      if (sourceStepNotes.length === 1) {
        next = prev.map((n, idx) => {
          if (idx === noteIdx) {
            return {
              ...n,
              noteName: "Pausa",
              freq: 0,
              stringIdx: -1,
              fret: -1
            };
          }
          return n;
        });
      } else {
        next = prev.filter((_, idx) => idx !== noteIdx);
      }
      
      const targetRestNoteIdx = next.findIndex(n => (n.stepId || `step-${n.id}`) === targetStepId && n.fret === -1);
      
      if (targetRestNoteIdx !== -1) {
        next[targetRestNoteIdx] = updatedNote;
      } else {
        const targetStepIndices = next.map((n, i) => ({ id: n.stepId || `step-${n.id}`, index: i }))
                                      .filter(item => item.id === targetStepId);
        
        if (targetStepIndices.length > 0) {
          const insertAt = targetStepIndices[targetStepIndices.length - 1].index + 1;
          next.splice(insertAt, 0, updatedNote);
        } else {
          const insertAt = Math.min(noteIdx, next.length);
          next.splice(insertAt, 0, updatedNote);
        }
      }
      
      const newIndex = next.findIndex(n => n.id === note.id);
      setTimeout(() => {
        setSelectedNoteIdx(newIndex);
      }, 0);
      return next;
    });
    
    playNoteSound(updatedNote.freq, (updatedNote.duration || 1.0) * (60 / bpm));
  };

  const handleExtendDuration = (flatIdx: number, delta: number) => {
    const note = melody[flatIdx];
    if (!note) return;
    const currentDur = note.duration || 1.0;
    const newDur = Math.max(0.25, Math.min(8.0, currentDur + delta));
    const stepId = note.stepId || `step-${note.id}`;
    handleUpdateStepDuration(stepId, newDur);
  };

  const handleCellClickToAddNote = (stepId: string, targetMidi: number) => {
    const stepNotes = melody.filter(n => (n.stepId || `step-${n.id}`) === stepId);
    const referenceNote = stepNotes.find(n => n.fret !== -1) || stepNotes[0];
    
    const found = findStringAndFretForMidi(targetMidi, referenceNote?.stringIdx >= 0 ? referenceNote.stringIdx : undefined);
    if (!found) return;
    
    const newNoteId = `${Date.now()}-${Math.random()}`;
    const newNote: MelodyNote = {
      id: newNoteId,
      stepId: stepId,
      noteName: getNoteNameAtFret(found.stringIdx, found.fret),
      freq: getNoteFreqAtFret(found.stringIdx, found.fret),
      stringIdx: found.stringIdx,
      fret: found.fret,
      duration: referenceNote ? referenceNote.duration : 1.0,
      suggestedChord: referenceNote?.suggestedChord,
      theory: referenceNote?.theory,
      section: referenceNote?.section
    };
    
    setMelody(prev => {
      const restNoteIdx = prev.findIndex(n => (n.stepId || `step-${n.id}`) === stepId && n.fret === -1);
      
      const next = [...prev];
      if (restNoteIdx !== -1) {
        next[restNoteIdx] = newNote;
      } else {
        const lastNoteIdx = prev.map(n => n.stepId || `step-${n.id}`).lastIndexOf(stepId);
        if (lastNoteIdx !== -1) {
          next.splice(lastNoteIdx + 1, 0, newNote);
        } else {
          next.push(newNote);
        }
      }
      
      const newIndex = next.findIndex(n => n.id === newNote.id);
      setTimeout(() => {
        setSelectedNoteIdx(newIndex);
      }, 0);
      return next;
    });
    
    playNoteSound(newNote.freq, (newNote.duration || 1.0) * (60 / bpm));
  };

  const handleNoteBadgeClick = (flatIdx: number) => {
    setSelectedNoteIdx(flatIdx);
    const note = melody[flatIdx];
    if (note) {
      playNoteSound(note.freq, 0.4);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (menuCoords && menuCoords.index === index) {
      setMenuCoords(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      let y = rect.bottom;
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        y = rect.top - menuHeight;
      }
      setMenuCoords({
        x: rect.left,
        y: y,
        index: index
      });
    }
  };

  const handleRemoveMelodyNote = (indexToRemove: number) => {
    let nextSelectedIdx: number | null = selectedNoteIdx;
    
    if (selectedNoteIdx === indexToRemove) {
      nextSelectedIdx = null; // Clear properties selection panel when converted/removed
    } else if (selectedNoteIdx !== null && selectedNoteIdx > indexToRemove) {
      nextSelectedIdx = selectedNoteIdx - 1;
    }

    setMelody(prev => {
      const noteToRemove = prev[indexToRemove];
      if (!noteToRemove) return prev;
      
      const stepId = noteToRemove.stepId || `step-${noteToRemove.id}`;
      const stepNotes = prev.filter(n => (n.stepId || `step-${n.id}`) === stepId);
      
      if (stepNotes.length === 1) {
        // If it's the only note in the step, convert it to a silent rest note to preserve step columns
        return prev.map((n, idx) => {
          if (idx === indexToRemove) {
            return {
              ...n,
              noteName: "Pausa",
              freq: 0,
              stringIdx: -1,
              fret: -1
            };
          }
          return n;
        });
      } else {
        return prev.filter((_, idx) => idx !== indexToRemove);
      }
    });
    
    setIsPlayingMelody(false);
    setSelectedNoteIdx(nextSelectedIdx);
  };

  const handleUpdateMelodyNote = (index: number, updatedFields: Partial<MelodyNote>) => {
    setMelody(prev => prev.map((note, idx) => {
      if (idx !== index) return note;
      const merged = { ...note, ...updatedFields };
      if (updatedFields.stringIdx !== undefined || updatedFields.fret !== undefined) {
        merged.noteName = getNoteNameAtFret(merged.stringIdx, merged.fret);
        merged.freq = getNoteFreqAtFret(merged.stringIdx, merged.fret);
      }
      return merged;
    }));
  };

  const handleDuplicateNote = (index: number) => {
    const noteToDup = melody[index];
    if (!noteToDup) return;
    const copy: MelodyNote = {
      ...noteToDup,
      id: `${Date.now()}-${Math.random()}`,
      duration: noteToDup.duration || 1.0
    };
    setMelody(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelectedNoteIdx(index + 1);
  };

  const handleShiftPosition = (index: number, direction: 'left' | 'right') => {
    const note = melody[index];
    if (!note) return;
    
    const steps = getMelodySteps(melody);
    const sourceStepId = note.stepId || `step-${note.id}`;
    const currentStepIdx = steps.findIndex(s => s.stepId === sourceStepId);
    if (currentStepIdx === -1) return;
    
    if (direction === 'left' && currentStepIdx === 0) return;
    if (direction === 'right' && currentStepIdx === steps.length - 1) return;
    
    const targetStepIdx = direction === 'left' ? currentStepIdx - 1 : currentStepIdx + 1;
    const targetStepId = steps[targetStepIdx].stepId;
    
    const updatedNote = {
      ...note,
      stepId: targetStepId
    };
    
    setMelody(prev => {
      // 1. Move/remove note at index.
      // If it was the only note in its step, convert it to a rest note at its index.
      // Otherwise, remove it from the array.
      const sourceStepNotes = prev.filter(n => (n.stepId || `step-${n.id}`) === sourceStepId);
      
      let next: MelodyNote[];
      if (sourceStepNotes.length === 1) {
        next = prev.map((n, idx) => {
          if (idx === index) {
            return {
              ...n,
              noteName: "Pausa",
              freq: 0,
              stringIdx: -1,
              fret: -1
            };
          }
          return n;
        });
      } else {
        next = prev.filter((_, idx) => idx !== index);
      }
      
      // 2. Insert updatedNote into targetStepId.
      // If targetStepId has a rest note, we replace it!
      const targetRestNoteIdx = next.findIndex(n => (n.stepId || `step-${n.id}`) === targetStepId && n.fret === -1);
      
      if (targetRestNoteIdx !== -1) {
        next[targetRestNoteIdx] = updatedNote;
      } else {
        // Otherwise, insert after the last note of targetStepId
        const targetStepIndices = next.map((n, i) => ({ id: n.stepId || `step-${n.id}`, index: i }))
                                      .filter(item => item.id === targetStepId);
        
        if (targetStepIndices.length > 0) {
          const insertAt = targetStepIndices[targetStepIndices.length - 1].index + 1;
          next.splice(insertAt, 0, updatedNote);
        } else {
          const insertAt = Math.min(index, next.length);
          next.splice(insertAt, 0, updatedNote);
        }
      }
      
      // Find the new index of our updated note to set selection
      const newIndex = next.findIndex(n => n.id === note.id);
      setTimeout(() => {
        setSelectedNoteIdx(newIndex);
      }, 0);
      return next;
    });
  };

  const handleTransposeNote = (index: number, semitones: number) => {
    const note = melody[index];
    if (!note) return;
    
    const newFret = note.fret + semitones;
    if (newFret >= 0 && newFret <= maxFrets) {
      handleUpdateMelodyNote(index, { fret: newFret });
      const newFreq = getNoteFreqAtFret(note.stringIdx, newFret);
      playNoteSound(newFreq, (note.duration || 1.0) * (60 / bpm));
    }
  };

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if (isDocked) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWindowX = windowPos.x;
    const startWindowY = windowPos.y;
    
    let currentX = startWindowX;
    let currentY = startWindowY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;
      
      currentX = Math.max(0, Math.min(window.innerWidth - 350, startWindowX + deltaX));
      currentY = Math.max(0, Math.min(window.innerHeight - 100, startWindowY + deltaY));
      
      if (editorContainerRef.current) {
        editorContainerRef.current.style.left = `${currentX}px`;
        editorContainerRef.current.style.top = `${currentY}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setWindowPos({ x: currentX, y: currentY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectedNoteIdx === null) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleRemoveMelodyNote(selectedNoteIdx);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (selectedNoteIdx > 0) {
        const newIdx = selectedNoteIdx - 1;
        setSelectedNoteIdx(newIdx);
        playNoteSound(melody[newIdx].freq, 0.4);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (selectedNoteIdx < melody.length - 1) {
        const newIdx = selectedNoteIdx + 1;
        setSelectedNoteIdx(newIdx);
        playNoteSound(melody[newIdx].freq, 0.4);
      }
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      handleDuplicateNote(selectedNoteIdx);
    } else if (e.key === '+') {
      e.preventDefault();
      handleTransposeNote(selectedNoteIdx, 1);
    } else if (e.key === '-') {
      e.preventDefault();
      handleTransposeNote(selectedNoteIdx, -1);
    }
  };

  // Debounced scroll follow bypass to resolve manual scroll conflicts
  const scrollTimeoutRef = useRef<any>(null);
  const handleScrollOrWheel = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 1000); // 1 second debounce timeout
  };

  // --- Slow Scroll Handlers (smooth, 60fps-friendly) ---
  const startSlowScroll = (direction: 'left' | 'right') => {
    stopSlowScroll();
    const container = scrollContainerRef.current;
    if (!container) return;
    isUserScrollingRef.current = true;
    scrollIntervalRef.current = setInterval(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollLeft += direction === 'right' ? 3 : -3;
    }, 16); // ~60fps
  };

  const stopSlowScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    // Release scroll lock after a short delay
    setTimeout(() => { isUserScrollingRef.current = false; }, 300);
  };

  // Cleanup scroll interval on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, []);

  // --- Edge Resize Handlers (top/bottom drag to resize editor height) ---
  const handleEdgeResizeStart = (edge: 'top' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeEdgeRef.current = edge;
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = editorHeight;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - resizeStartYRef.current;
      let newHeight: number;
      if (resizeEdgeRef.current === 'top') {
        newHeight = resizeStartHeightRef.current - deltaY;
      } else {
        newHeight = resizeStartHeightRef.current + deltaY;
      }
      // Clamp between 150px and 800px
      newHeight = Math.max(150, Math.min(800, newHeight));
      onEditorHeightChange(newHeight);
    };

    const handleResizeEnd = () => {
      resizeEdgeRef.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const currentDiatonicChords = getDiatonicChordsForKey(
    noteNameToPitchClass(harmRoot),
    harmType,
    harmStyle,
    shouldUseFlats(harmRoot)
  );
  const diatonicNames = currentDiatonicChords.map(c => c.name);
  const customPoolChords = selectedChords ? selectedChords.filter(c => !diatonicNames.includes(c)) : [];

  if (!isEditorOpen) return null;

  return (
    <div 
      ref={editorContainerRef}
      style={isDocked
        ? { height: isMinimized ? '35px' : `${editorHeight}px`, bottom: isTaskbarCollapsed ? '0px' : '40px' }
        : { left: `${windowPos.x}px`, top: `${windowPos.y}px`, width: '850px', maxWidth: '95vw', position: 'fixed' as const, height: isMinimized ? '35px' : `${editorHeight}px` }
      }
      className={isDocked 
        ? "fixed left-0 right-0 w-full z-50 bg-[#ece9d8] border-t-2 border-[#808080] shadow-[0_-4px_15px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden"
        : "fixed z-50 bg-[#ece9d8] border-2 border-white border-r-[#808080] border-bottom-[#808080] shadow-2xl flex flex-col rounded-t-sm overflow-hidden"
      }
    >
      {/* Top Edge Resize Handle (always visible for resizing the grid area) */}
      <div
        onMouseDown={(e) => handleEdgeResizeStart('top', e)}
        className="h-[6px] cursor-ns-resize bg-gradient-to-b from-[#ece9d8] to-[#d4d0c8] hover:from-[#3a8bfb] hover:to-[#0058e6] transition-colors duration-150 rounded-t-sm select-none flex items-center justify-center"
        title="Arraste para redimensionar a altura do editor"
      >
        <div className="w-10 h-[2px] bg-[#808080] rounded opacity-50" />
      </div>
      {/* Windows XP Window Title Bar */}
      <div 
        onMouseDown={handleTitleMouseDown}
        className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2.5 py-1.5 flex justify-between items-center font-bold text-xs select-none cursor-move"
        style={isDocked ? { cursor: 'default' } : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px]">🎵</span>
          <span className="font-sans text-[11px] tracking-wide">Sequenciador & Editor de Melodia</span>
          {isDocked && (
            <span className="text-[9px] bg-white/20 border border-white/30 text-white px-1.5 py-0.5 rounded-sm font-sans uppercase font-bold tracking-wider">
              Acoplado no Rodapé
            </span>
          )}
        </div>
        <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-5 h-4 bg-[#ece9d8] hover:bg-white active:bg-gray-200 border border-white border-r-[#808080] border-bottom-[#808080] text-black text-[10px] font-bold flex items-center justify-center cursor-pointer select-none"
            title={isMinimized ? "Restaurar" : "Minimizar"}
          >
            {isMinimized ? "🗖" : "🗕"}
          </button>
          <button 
            onClick={() => {
              setIsDocked(!isDocked);
              setIsMinimized(false);
            }}
            className="w-5 h-4 bg-[#ece9d8] hover:bg-white active:bg-gray-200 border border-white border-r-[#808080] border-bottom-[#808080] text-black text-[9px] font-bold flex items-center justify-center cursor-pointer select-none"
            title={isDocked ? "Desacoplar (Janela Flutuante)" : "Acoplar no Rodapé"}
          >
            {isDocked ? (
              <svg className="w-[10px] h-[10px]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="1" width="7" height="7" />
                <rect x="1" y="4" width="7" height="7" fill="#ece9d8" />
              </svg>
            ) : (
              <svg className="w-[10px] h-[10px]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="10" height="6" />
                <rect x="1" y="9" width="10" height="2.5" fill="currentColor" />
              </svg>
            )}
          </button>
          <button 
            onClick={() => setIsEditorOpen(false)}
            className="w-5 h-4 bg-red-600 hover:bg-red-500 border border-red-800 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer select-none"
            title="Fechar Editor"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Content */}
      {!isMinimized && (
        <div className="p-3 font-mono text-xs flex flex-col gap-2 bg-[#ece9d8] flex-1 min-h-0 overflow-y-hidden">
          <TransportControls
            historyIndex={historyIndex}
            historyLength={history.length}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            showHarmonizer={showHarmonizer}
            setShowHarmonizer={setShowHarmonizer}
          />

          {/* Compact Note Properties Toolbar (Word style, compact toolbar) */}
          {(() => {
            const hasActiveNote = selectedNoteIdx !== null && melody[selectedNoteIdx] !== undefined;
            const note = hasActiveNote ? melody[selectedNoteIdx!] : null;
            const stepId = note ? (note.stepId || `step-${note.id}`) : "";
            
            return (
              <div className={`flex flex-wrap items-center gap-2 border border-[#808080] p-1.5 bg-[#f1efe2] rounded-sm text-[10px] select-none shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] transition-opacity duration-150 ${
                !hasActiveNote ? 'opacity-65' : ''
              }`}>
                {/* Note Indicator */}
                {note ? (
                  <div className="bg-[#fff9c4] border border-amber-400 px-2 py-0.5 rounded-sm font-bold text-amber-950 flex items-center gap-1 shadow-sm">
                    <span>📝</span>
                    <span>{note.noteName} ({Math.round(note.freq)} Hz)</span>
                  </div>
                ) : (
                  <div className="bg-gray-200 border border-gray-400 px-2 py-0.5 rounded-sm font-bold text-gray-600 flex items-center gap-1">
                    <span>🚫</span>
                    <span>Nenhuma nota selecionada</span>
                  </div>
                )}

                {/* String / Fret Selectors */}
                <div className="flex items-center gap-1 border-r border-dashed border-[#808080] pr-2">
                  <span className="font-bold text-gray-600">Corda/Par:</span>
                  <select
                    disabled={!hasActiveNote}
                    value={note ? note.stringIdx : ""}
                    onChange={(e) => handleUpdateMelodyNote(selectedNoteIdx!, { stringIdx: parseInt(e.target.value, 10) })}
                    className="bg-[#ece9d8] border border-[#808080] text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!hasActiveNote && <option value="">-</option>}
                    {Array.from({ length: numStrings }).map((_, rIdx) => {
                      const stringIdx = numStrings - 1 - rIdx;
                      const openMidi = selectedTuning.strings[stringIdx];
                      const openName = midiToNoteName(openMidi, useFlats);
                      return (
                        <option key={`opt-string-${stringIdx}`} value={stringIdx}>
                          {selectedInstrument.id === 'viola' ? `${5 - stringIdx}º Par` : `Corda ${numStrings - stringIdx}`} ({openName})
                        </option>
                      );
                    })}
                  </select>

                  <span className="font-bold text-gray-600 ml-1">Traste:</span>
                  <input
                    disabled={!hasActiveNote}
                    type="number"
                    min="0"
                    max={maxFrets}
                    value={note ? note.fret : ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 0 && val <= maxFrets) {
                        handleUpdateMelodyNote(selectedNoteIdx!, { fret: val });
                      }
                    }}
                    className="bg-[#ece9d8] border border-[#808080] text-[10px] px-1 py-0.5 w-10 text-center focus:outline-none rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1 border-r border-dashed border-[#808080] pr-2">
                  <span className="font-bold text-gray-600">Duração:</span>
                  <select
                    disabled={!hasActiveNote}
                    value={note ? (note.duration || 1.0) : 1.0}
                    onChange={(e) => handleUpdateStepDuration(stepId, parseFloat(e.target.value))}
                    className="bg-[#ece9d8] border border-[#808080] text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="0.25">1/4 tempo</option>
                    <option value="0.5">1/2 tempo</option>
                    <option value="1.0">1 tempo</option>
                    <option value="2.0">2 tempos</option>
                    <option value="4.0">4 tempos</option>
                  </select>
                </div>

                {/* Chord Selector */}
                <div className="flex items-center gap-1 border-r border-dashed border-[#808080] pr-2">
                  <span className="font-bold text-gray-600">Acorde:</span>
                  <select
                    disabled={!hasActiveNote}
                    value={note ? (note.suggestedChord || "") : ""}
                    onChange={(e) => handleUpdateMelodyNote(selectedNoteIdx!, { suggestedChord: e.target.value || undefined })}
                    className="bg-[#ece9d8] border border-[#808080] text-[10px] px-1 py-0.5 focus:outline-none cursor-pointer max-w-[90px] rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">(Nenhum)</option>
                    <optgroup label="Acordes do Tom">
                      {currentDiatonicChords.map((chord) => (
                        <option key={`opt-chord-${chord.name}`} value={chord.name}>
                          {chord.name}
                        </option>
                      ))}
                    </optgroup>
                    {customPoolChords.length > 0 && (
                      <optgroup label="Outros do Pool">
                        {customPoolChords.map((chord) => (
                          <option key={`opt-pool-${chord}`} value={chord}>
                            {chord}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Note Actions Toolbar */}
                <div className="flex items-center gap-0.5 border-r border-dashed border-[#808080] pr-2">
                  <span className="font-bold text-gray-500 mr-1">Nota:</span>
                  <button
                    disabled={!hasActiveNote || selectedNoteIdx === 0}
                    onClick={() => handleShiftPosition(selectedNoteIdx!, 'left')}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Mover Nota para Esquerda"
                  >
                    ←
                  </button>
                  <button
                    disabled={!hasActiveNote || selectedNoteIdx === melody.length - 1}
                    onClick={() => handleShiftPosition(selectedNoteIdx!, 'right')}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Mover Nota para Direita"
                  >
                    →
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleTransposeNote(selectedNoteIdx!, 1)}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Transpor +1 Semitom"
                  >
                    ▲
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleTransposeNote(selectedNoteIdx!, -1)}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Transpor -1 Semitom"
                  >
                    ▼
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleDuplicateNote(selectedNoteIdx!)}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Duplicar Nota"
                  >
                    📋
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleRemoveMelodyNote(selectedNoteIdx!)}
                    className="px-1.5 py-0.5 bg-red-600 text-white border border-red-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500 font-bold cursor-pointer rounded-sm"
                    title="Excluir Nota"
                  >
                    🗑️
                  </button>
                </div>

                {/* Step Actions Toolbar */}
                <div className="flex items-center gap-0.5">
                  <span className="font-bold text-gray-500 mr-1">Passo:</span>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleShiftStep(stepId, 'left')}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Mover Passo para Esquerda"
                  >
                    🡄
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleShiftStep(stepId, 'right')}
                    className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm"
                    title="Mover Passo para Direita"
                  >
                    🡆
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleAddNoteToStep(stepId)}
                    className="px-1.5 py-0.5 bg-emerald-600 text-white border border-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500 font-bold cursor-pointer rounded-sm"
                    title="Adicionar Nota ao Passo (Acorde)"
                  >
                    ➕
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleDuplicateStep(stepId)}
                    className="px-1.5 py-0.5 bg-indigo-600 text-white border border-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 font-bold cursor-pointer rounded-sm"
                    title="Duplicar Passo Inteiro"
                  >
                    🗗
                  </button>
                  <button
                    disabled={!hasActiveNote}
                    onClick={() => handleRemoveStep(stepId)}
                    className="px-1.5 py-0.5 bg-red-800 text-white border border-red-950 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 font-bold cursor-pointer rounded-sm"
                    title="Excluir Passo Inteiro"
                  >
                    🚫
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Algorithmic Chord Generator Panel */}
          {showHarmonizer && melody.length > 0 && (
            <div className="bg-[#f1efe2] border border-[#808080] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] p-3 mb-1.5 rounded-sm flex flex-col gap-2.5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[#d4d0c8] pb-1.5">
                <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                  🤖 Gerador de Harmonia Algorítmica (Melodia ➔ Acordes)
                </span>
                <span className="text-[10px] text-gray-500 italic">
                  Tenta ajustar a melhor sequência de acordes diatônicos usando heurística
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700">Tom de Referência:</label>
                  <select
                    value={harmRoot}
                    onChange={(e) => setHarmRoot(e.target.value)}
                    className="bevel-in px-2 py-0.5 bg-[#ece9d8] font-bold text-xs cursor-pointer focus:outline-none w-20"
                  >
                    {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((note) => {
                      const label = shouldUseFlats(note) 
                        ? note.replace("C#","Db").replace("D#","Eb").replace("F#","Gb").replace("G#","Ab").replace("A#","Bb")
                        : note;
                      return (
                        <option key={`harm-root-${note}`} value={note}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700">Modo (Escala):</label>
                  <select
                    value={harmType}
                    onChange={(e) => setHarmType(e.target.value as 'major' | 'minor')}
                    className="bevel-in px-2 py-0.5 bg-[#ece9d8] font-bold text-xs cursor-pointer focus:outline-none w-28"
                  >
                    <option value="major">Maior (Jônio)</option>
                    <option value="minor">Menor (Eólio)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700">Estilo de Progressão:</label>
                  <select
                    value={harmStyle}
                    onChange={(e) => setHarmStyle(e.target.value as 'pop' | 'jazz')}
                    className="bevel-in px-2 py-0.5 bg-[#ece9d8] font-bold text-xs cursor-pointer focus:outline-none w-48"
                  >
                    <option value="pop">Popular / Tradicional (Tríades)</option>
                    <option value="jazz">Jazz / Bossa Nova (Tétrades)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700">Compasso (Régua):</label>
                  <select
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    className="bevel-in px-2 py-0.5 bg-[#ece9d8] font-bold text-xs cursor-pointer focus:outline-none w-20"
                  >
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="2/4">2/4</option>
                    <option value="6/8">6/8</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-gray-700">Rítmica dos Acordes:</label>
                  <select
                    value={chordRhythm}
                    onChange={(e) => setChordRhythm(e.target.value)}
                    className="bevel-in px-2 py-0.5 bg-[#ece9d8] font-bold text-xs cursor-pointer focus:outline-none w-48"
                  >
                    <option value="every-beat">A cada tempo (1/1)</option>
                    <option value="every-2-beats">A cada 2 tempos (1/2)</option>
                    <option value="every-bar">A cada compasso (Compasso Cheio)</option>
                    <option value="changes-only">Apenas na mudança de acorde</option>
                    <option value="manual">Manual (Desativado / Só Rótulos)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 ml-auto pt-4 md:pt-0">
                  <button
                    onClick={handleHarmonizeMelody}
                    className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border border-amber-800 font-bold active:scale-95 cursor-pointer rounded-sm text-[11px] shadow-sm"
                  >
                    ⚡ Harmonizar
                  </button>
                  <button
                    onClick={handleLoadChordsToPool}
                    className="px-2.5 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border border-blue-800 font-bold active:scale-95 cursor-pointer rounded-sm text-[11px] shadow-sm"
                    title="Adiciona todos os acordes gerados na melodia ao pool global da música"
                  >
                    📥 Add ao Pool
                  </button>
                  <button
                    onClick={handleClearChords}
                    className="px-2.5 py-1 bg-[#ece9d8] hover:bg-gray-100 text-gray-700 border border-gray-400 font-bold active:scale-95 cursor-pointer rounded-sm text-[11px] shadow-sm"
                  >
                    🗑 Limpar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid Controls Bar: Horizontal Slow Scroll + Vertical Range Expand */}
          <div className="flex items-center justify-between bg-[#f1efe2] border border-[#808080] p-1 rounded-t-sm gap-1 select-none" style={{ fontSize: '10px' }}>
            {/* LEFT: Horizontal Timeline Slow Scroll */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-600 text-[9px] mr-0.5">Timeline:</span>
              <button
                onMouseDown={() => startSlowScroll('left')}
                onMouseUp={stopSlowScroll}
                onMouseLeave={stopSlowScroll}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px] select-none"
                title="Rolagem lenta para esquerda (segure)"
              >
                ◀ Rolar
              </button>
              <button
                onMouseDown={() => startSlowScroll('right')}
                onMouseUp={stopSlowScroll}
                onMouseLeave={stopSlowScroll}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px] select-none"
                title="Rolagem lenta para direita (segure)"
              >
                Rolar ▶
              </button>
            </div>

            {/* RIGHT: Vertical MIDI Range Expand/Shrink */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-600 text-[9px] mr-0.5">Teclado MIDI:</span>
              <button
                onClick={() => setExtraHighRows(prev => Math.min(prev + 3, 36))}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px]"
                title="Expandir agudos (+3 notas acima)"
              >
                ▲ Agudos
              </button>
              <button
                onClick={() => setExtraHighRows(prev => Math.max(prev - 3, 0))}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Reduzir agudos (-3 notas acima)"
                disabled={extraHighRows === 0}
              >
                ▼ Agudos
              </button>
              <div className="w-px h-4 bg-[#808080] mx-0.5" />
              <button
                onClick={() => setExtraLowRows(prev => Math.min(prev + 3, 36))}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px]"
                title="Expandir graves (+3 notas abaixo)"
              >
                ▼ Graves
              </button>
              <button
                onClick={() => setExtraLowRows(prev => Math.max(prev - 3, 0))}
                className="px-1.5 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] font-bold cursor-pointer rounded-sm text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Reduzir graves (-3 notas abaixo)"
                disabled={extraLowRows === 0}
              >
                ▲ Graves
              </button>
              {(extraHighRows > 0 || extraLowRows > 0) && (
                <button
                  onClick={() => { setExtraHighRows(0); setExtraLowRows(0); }}
                  className="px-1.5 py-0.5 bg-amber-100 border border-amber-400 hover:bg-amber-200 font-bold cursor-pointer rounded-sm text-[9px] text-amber-800"
                  title="Resetar range do teclado MIDI para o padrão"
                >
                  ↺ Reset
                </button>
              )}
            </div>
          </div>

          {/* Draggable Note Sequence Container with FL Studio Style Grid & Time Ruler */}
          <div 
            ref={scrollContainerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onWheel={handleScrollOrWheel}
            className="flex flex-col bg-white border border-[#808080] border-t-0 overflow-auto whitespace-nowrap retro-scrollbar outline-none focus:ring-1 focus:ring-[#0058e6] focus:border-[#0058e6] shadow-inner rounded-b-sm relative flex-1 min-h-0"
            title="Foque aqui para usar atalhos do teclado (Delete, ←/→, +/-, D)"
          >
            {melody.length === 0 ? (
              <span className="p-4 text-gray-400 italic text-[11px] whitespace-normal">Nenhuma nota tocada. Toque no braço acima para construir a melodia passo a passo!</span>
            ) : (
              <div className="relative inline-block min-w-full min-w-max">
                {/* Playhead Pin (using high-performance CSS translateX layout translation) */}
                <div 
                  ref={playheadRef}
                  className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-40 pointer-events-none"
                  style={{ left: '0px', transform: 'translateX(56px)' }}
                >
                  <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-red-600 rotate-45 select-none pointer-events-none" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 50% 100%, 0 50%)' }} />
                </div>

                {/* Playhead Column Highlight Overlay (follows active step during playback) */}
                <div
                  ref={playheadHighlightRef}
                  className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{
                    display: 'none',
                    left: '56px',
                    width: '120px',
                    background: 'linear-gradient(180deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 152, 0, 0.18) 100%)',
                    borderLeft: '2px solid rgba(255, 152, 0, 0.45)',
                    borderRight: '2px solid rgba(255, 152, 0, 0.45)',
                    transition: 'none'
                  }}
                />

                <TimeRuler />

                <PianoRollGrid
                  midiRange={midiRange}
                  midiToNoteName={midiToNoteName}
                  useFlats={useFlats}
                  noteLookup={noteLookup}
                  draggedNoteIdx={draggedNoteIdx}
                  setDraggedNoteIdx={setDraggedNoteIdx}
                  draggedOverCell={draggedOverCell}
                  setDraggedOverCell={setDraggedOverCell}
                  handleMoveNoteToCell={handleMoveNoteToCell}
                  handleCellClickToAddNote={handleCellClickToAddNote}
                  handleNoteBadgeClick={handleNoteBadgeClick}
                  handleExtendDuration={handleExtendDuration}
                  handleOpenMenu={handleOpenMenu}
                  handleRemoveMelodyNote={handleRemoveMelodyNote}
                  selectedNoteIdx={selectedNoteIdx}
                  hoveredStepId={hoveredStepId}
                  setHoveredStepId={setHoveredStepId}
                />
              </div>
            )}
          </div>

          {/* Bottom Edge Resize Handle (only when floating) */}
          {!isDocked && (
            <div
              onMouseDown={(e) => handleEdgeResizeStart('bottom', e)}
              className="h-[6px] cursor-ns-resize bg-gradient-to-b from-[#d4d0c8] to-[#ece9d8] hover:from-[#0058e6] hover:to-[#3a8bfb] transition-colors duration-150 rounded-b-sm select-none flex items-center justify-center"
              title="Arraste para redimensionar a altura do editor"
            >
              <div className="w-10 h-[2px] bg-[#808080] rounded opacity-50" />
            </div>
          )}


        </div>
      )}

      {/* Floating Actions Menu (outside overflow container to prevent clipping) */}
      {menuCoords !== null && melody[menuCoords.index] && (
        <div 
          style={{ 
            position: 'fixed', 
            left: `${menuCoords.x}px`, 
            top: `${menuCoords.y}px`,
            width: '144px',
            zIndex: 9999 
          }}
          className="bg-[#ece9d8] border-2 border-white border-r-[#808080] border-bottom-[#808080] shadow-[2px_2px_10px_rgba(0,0,0,0.3)] rounded-sm py-1 text-[10px] text-gray-800 font-mono select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-0.5 text-[8px] font-bold text-gray-500 uppercase border-b border-gray-300">Nota</div>
          <button
            onClick={() => {
              handleDuplicateNote(menuCoords!.index);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>🗐</span> Duplicar Nota
          </button>
          <button
            onClick={() => {
              handleTransposeNote(menuCoords!.index, 1);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>▴</span> Transpor +1
          </button>
          <button
            onClick={() => {
              handleTransposeNote(menuCoords!.index, -1);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>▾</span> Transpor -1
          </button>
          <button
            onClick={() => {
              handleRemoveMelodyNote(menuCoords!.index);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-red-600 hover:text-white text-red-600 font-bold cursor-pointer flex items-center gap-1.5"
          >
            <span>🗑</span> Excluir Nota
          </button>

          <div className="px-2 py-0.5 mt-1 text-[8px] font-bold text-gray-500 uppercase border-t border-b border-gray-300">Passo (Acorde)</div>
          <button
            onClick={() => {
              handleAddNoteToStep(melody[menuCoords!.index].stepId || `step-${melody[menuCoords!.index].id}`);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>➕</span> Add Nota ao Passo
          </button>
          <button
            onClick={() => {
              handleDuplicateStep(melody[menuCoords!.index].stepId || `step-${melody[menuCoords!.index].id}`);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>🗗</span> Duplicar Passo
          </button>
          <button
            onClick={() => {
              handleShiftStep(melody[menuCoords!.index].stepId || `step-${melody[menuCoords!.index].id}`, 'left');
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>◀</span> Mover Passo Esq.
          </button>
          <button
            onClick={() => {
              handleShiftStep(melody[menuCoords!.index].stepId || `step-${melody[menuCoords!.index].id}`, 'right');
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-[#0058e6] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <span>▶</span> Mover Passo Dir.
          </button>
          <button
            onClick={() => {
              handleRemoveStep(melody[menuCoords!.index].stepId || `step-${melody[menuCoords!.index].id}`);
              setMenuCoords(null);
            }}
            className="w-full text-left px-2 py-1 hover:bg-red-800 hover:text-white text-red-800 font-bold cursor-pointer flex items-center gap-1.5"
          >
            <span>🗑</span> Excluir Passo
          </button>
        </div>
      )}
    </div>
  );
};

export const MelodySequenceEditor: React.FC<MelodySequenceEditorProps> = (props) => {
  return (
    <PlaybackProvider
      melody={props.melody}
      setMelody={props.setMelody}
      isPlayingMelody={props.isPlayingMelody}
      setIsPlayingMelody={props.setIsPlayingMelody}
      bpm={props.bpm}
      setBpm={props.setBpm}
      playNoteSound={props.playNoteSound}
      ensureAudioContextActive={props.ensureAudioContextActive}
    >
      <MelodySequenceEditorContent {...props} />
    </PlaybackProvider>
  );
};
