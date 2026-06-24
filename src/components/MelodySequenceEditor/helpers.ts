import type { MelodyNote, MelodyStep } from './types';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from '../../engine/tunings';
import { noteNameToPitchClass } from '../../engine/chordCalculator';

export const getDurationLabel = (duration?: number) => {
  switch (duration) {
    case 0.25: return "𝅘𝅥𝅯 1/4";
    case 0.5: return "𝅘𝅥𝅮 1/2";
    case 1.0: return "♩ 1";
    case 2.0: return "𝅗𝅥 2";
    case 4.0: return "𝅗 4";
    default: return "♩ 1";
  }
};

export const getDiatonicChordsForKey = (
  rootPc: number, 
  type: 'major' | 'minor', 
  style: 'pop' | 'jazz',
  useFlats: boolean
) => {
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const nameOf = (pc: number) => noteNames[(pc + 12) % 12];
  
  const chordsList: { name: string; pcs: number[]; degree: string; baseScore: number }[] = [];
  
  if (type === 'major') {
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc)}7M` : nameOf(rootPc),
      pcs: style === 'jazz' 
        ? [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12, (rootPc + 11) % 12]
        : [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12],
      degree: "I",
      baseScore: 2.0
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 2)}m7` : `${nameOf(rootPc + 2)}m`,
      pcs: style === 'jazz'
        ? [(rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 9) % 12, (rootPc + 0) % 12]
        : [(rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 9) % 12],
      degree: "II",
      baseScore: style === 'jazz' ? 1.2 : 0.8
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 4)}m7` : `${nameOf(rootPc + 4)}m`,
      pcs: style === 'jazz'
        ? [(rootPc + 4) % 12, (rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12]
        : [(rootPc + 4) % 12, (rootPc + 7) % 12, (rootPc + 11) % 12],
      degree: "III",
      baseScore: 0.5
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 5)}7M` : nameOf(rootPc + 5),
      pcs: style === 'jazz'
        ? [(rootPc + 5) % 12, (rootPc + 9) % 12, (rootPc + 0) % 12, (rootPc + 4) % 12]
        : [(rootPc + 5) % 12, (rootPc + 9) % 12, (rootPc + 0) % 12],
      degree: "IV",
      baseScore: 1.5
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 7)}7` : nameOf(rootPc + 7),
      pcs: style === 'jazz'
        ? [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12]
        : [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12],
      degree: "V",
      baseScore: 1.8
    });
    if (style !== 'jazz') {
      chordsList.push({
        name: `${nameOf(rootPc + 7)}7`,
        pcs: [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12],
        degree: "V7",
        baseScore: 1.6
      });
    }
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 9)}m7` : `${nameOf(rootPc + 9)}m`,
      pcs: style === 'jazz'
        ? [(rootPc + 9) % 12, (rootPc + 0) % 12, (rootPc + 4) % 12, (rootPc + 7) % 12]
        : [(rootPc + 9) % 12, (rootPc + 0) % 12, (rootPc + 4) % 12],
      degree: "VI",
      baseScore: 1.2
    });
    chordsList.push({
      name: `${nameOf(rootPc + 11)}m7(b5)`,
      pcs: [(rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 9) % 12],
      degree: "VII",
      baseScore: 0.3
    });
  } else {
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc)}m7` : `${nameOf(rootPc)}m`,
      pcs: style === 'jazz'
        ? [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12, (rootPc + 10) % 12]
        : [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12],
      degree: "I",
      baseScore: 2.0
    });
    chordsList.push({
      name: `${nameOf(rootPc + 2)}m7(b5)`,
      pcs: [(rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 8) % 12, (rootPc + 0) % 12],
      degree: "II",
      baseScore: 0.8
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 3)}7M` : nameOf(rootPc + 3),
      pcs: style === 'jazz'
        ? [(rootPc + 3) % 12, (rootPc + 7) % 12, (rootPc + 10) % 12, (rootPc + 2) % 12]
        : [(rootPc + 3) % 12, (rootPc + 7) % 12, (rootPc + 10) % 12],
      degree: "III",
      baseScore: 1.0
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 5)}m7` : `${nameOf(rootPc + 5)}m`,
      pcs: style === 'jazz'
        ? [(rootPc + 5) % 12, (rootPc + 8) % 12, (rootPc + 0) % 12, (rootPc + 3) % 12]
        : [(rootPc + 5) % 12, (rootPc + 8) % 12, (rootPc + 0) % 12],
      degree: "IV",
      baseScore: 1.2
    });
    chordsList.push({
      name: `${nameOf(rootPc + 7)}m`,
      pcs: [(rootPc + 7) % 12, (rootPc + 10) % 12, (rootPc + 2) % 12],
      degree: "Vm",
      baseScore: 0.8
    });
    chordsList.push({
      name: `${nameOf(rootPc + 7)}7`,
      pcs: [(rootPc + 7) % 12, (rootPc + 11) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12],
      degree: "V7",
      baseScore: 1.8
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 8)}7M` : nameOf(rootPc + 8),
      pcs: style === 'jazz'
        ? [(rootPc + 8) % 12, (rootPc + 0) % 12, (rootPc + 3) % 12, (rootPc + 7) % 12]
        : [(rootPc + 8) % 12, (rootPc + 0) % 12, (rootPc + 3) % 12],
      degree: "VI",
      baseScore: 1.0
    });
    chordsList.push({
      name: style === 'jazz' ? `${nameOf(rootPc + 10)}7` : nameOf(rootPc + 10),
      pcs: style === 'jazz'
        ? [(rootPc + 10) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12, (rootPc + 8) % 12]
        : [(rootPc + 10) % 12, (rootPc + 2) % 12, (rootPc + 5) % 12],
      degree: "VII",
      baseScore: 0.8
    });
  }
  
  return chordsList;
};

export const getIntervalsForSuffix = (suffix: string): number[] => {
  const s = suffix.trim();
  if (s === "m") return [0, 3, 7];
  if (s === "7") return [0, 4, 7, 10];
  if (s === "7M" || s === "maj7" || s === "M7") return [0, 4, 7, 11];
  if (s === "m7") return [0, 3, 7, 10];
  if (s === "m7(b5)" || s === "m7b5") return [0, 3, 6, 10];
  return [0, 4, 7];
};

export const getMelodySteps = (melody: MelodyNote[]): MelodyStep[] => {
  const steps: MelodyStep[] = [];
  const stepMap = new Map<string, MelodyStep>();

  melody.forEach((note) => {
    const sId = note.stepId || `step-${note.id}`;
    
    if (!stepMap.has(sId)) {
      const step: MelodyStep = {
        stepId: sId,
        notes: [note],
        duration: note.duration || 1.0,
        suggestedChord: note.suggestedChord,
        theory: note.theory,
        section: note.section,
      };
      stepMap.set(sId, step);
      steps.push(step);
    } else {
      stepMap.get(sId)!.notes.push(note);
      if (note.suggestedChord) {
        stepMap.get(sId)!.suggestedChord = note.suggestedChord;
      }
      if (note.theory && !stepMap.get(sId)!.theory) {
        stepMap.get(sId)!.theory = note.theory;
      }
      if (note.section && !stepMap.get(sId)!.section) {
        stepMap.get(sId)!.section = note.section;
      }
    }
  });

  return steps;
};

export const generateChordsForMelody = (
  melody: MelodyNote[],
  rootKey: string,
  keyType: 'major' | 'minor',
  style: 'pop' | 'jazz',
  useFlats: boolean
): string[] => {
  if (melody.length === 0) return [];
  
  const rootPc = noteNameToPitchClass(rootKey);
  const chords = getDiatonicChordsForKey(rootPc, keyType, style, useFlats);
  
  const notePositions: { index: number; startBeat: number; duration: number }[] = [];
  let currentBeat = 0;
  for (let i = 0; i < melody.length; i++) {
    notePositions.push({ index: i, startBeat: currentBeat, duration: melody[i].duration || 1.0 });
    currentBeat += melody[i].duration || 1.0;
  }
  
  const getNotePc = (noteName: string): number => {
    if (!noteName || noteName === "Pausa") return -1;
    let r = "";
    for (let c of noteName) {
      if (c === "#" || c === "b" || (c >= "A" && c <= "G")) r += c;
    }
    if (!r) return -1;
    try {
      return noteNameToPitchClass(r);
    } catch {
      return -1;
    }
  };
  
  const numNotes = melody.length;
  const numChords = chords.length;
  const dp: number[][] = Array.from({ length: numNotes }, () => Array(numChords).fill(Infinity));
  const parent: number[][] = Array.from({ length: numNotes }, () => Array(numChords).fill(-1));
  
  for (let c = 0; c < numChords; c++) {
    const chord = chords[c];
    const firstNotePc = getNotePc(melody[0].noteName);
    const fitPenalty = firstNotePc === -1 ? 0 : (chord.pcs.includes(firstNotePc) ? 0 : 2.0);
    dp[0][c] = fitPenalty - chord.baseScore;
  }
  
  for (let i = 1; i < numNotes; i++) {
    const notePc = getNotePc(melody[i].noteName);
    
    for (let c = 0; c < numChords; c++) {
      const chord = chords[c];
      const fitPenalty = notePc === -1 ? 0 : (chord.pcs.includes(notePc) ? 0 : 2.0);
      
      let bestCost = Infinity;
      let bestPrev = -1;
      
      for (let prevC = 0; prevC < numChords; prevC++) {
        let transitionCost = 0;
        if (prevC !== c) {
          transitionCost = 1.0; 
        }
        
        const cost = dp[i - 1][prevC] + transitionCost;
        if (cost < bestCost) {
          bestCost = cost;
          bestPrev = prevC;
        }
      }
      
      dp[i][c] = bestCost + fitPenalty - chord.baseScore;
      parent[i][c] = bestPrev;
    }
  }
  
  let bestFinalCost = Infinity;
  let bestFinalChordIdx = -1;
  for (let c = 0; c < numChords; c++) {
    if (dp[numNotes - 1][c] < bestFinalCost) {
      bestFinalCost = dp[numNotes - 1][c];
      bestFinalChordIdx = c;
    }
  }
  
  if (bestFinalChordIdx === -1) return [];
  
  const result: string[] = [];
  let currChordIdx = bestFinalChordIdx;
  for (let i = numNotes - 1; i >= 0; i--) {
    result[i] = chords[currChordIdx].name;
    currChordIdx = parent[i][currChordIdx];
  }
  
  return result;
};
