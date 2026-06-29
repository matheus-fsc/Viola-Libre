import type { Tuning, Chord, Voicing, PitchClass, ReverseChordMatch } from './types';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT, CHORD_FORMULAS } from './tunings';

// Converts a note name (e.g. "C", "F#", "Bb") to a PitchClass (0-11)
export function noteNameToPitchClass(name: string): PitchClass {
  const normalized = name.trim();
  let index = NOTE_NAMES_SHARP.indexOf(normalized);
  if (index !== -1) return index;
  
  index = NOTE_NAMES_FLAT.indexOf(normalized);
  if (index !== -1) return index;
  
  // Handle case-insensitivity or minor typos
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  index = NOTE_NAMES_SHARP.indexOf(upper);
  if (index !== -1) return index;
  
  index = NOTE_NAMES_FLAT.indexOf(upper);
  if (index !== -1) return index;

  throw new Error(`Nota inválida: ${name}`);
}

// Check if a root name indicates we should use flat naming conventions
export function shouldUseFlats(rootName: string): boolean {
  return rootName.includes('b') || rootName === 'F' || rootName === 'd' || rootName === 'g' || rootName === 'c';
}

// Convert MIDI number to note name
export function midiToNoteName(midi: number, useFlats: boolean): string {
  const pc = midi % 12;
  return useFlats ? NOTE_NAMES_FLAT[pc] : NOTE_NAMES_SHARP[pc];
}

// Parse a chord string like "Am7/E" into { root, suffix, bass }
export function parseChordString(chordStr: string): { root: string; suffix: string; bass: string } {
  let root = '';
  let suffix = '';
  let bass = '';

  const parts = chordStr.split('/');
  let mainChord = parts[0].trim();

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (/^\d/.test(part)) {
      mainChord += '/' + part;
    } else {
      bass = part;
    }
  }

  if (mainChord.length >= 2 && (mainChord[1] === '#' || mainChord[1] === 'b')) {
    root = mainChord.slice(0, 2);
    suffix = mainChord.slice(2);
  } else if (mainChord.length >= 1) {
    root = mainChord.slice(0, 1);
    suffix = mainChord.slice(1);
  }

  return { root, suffix, bass };
}

// Transpose a chord string by semitones. Uses +120 offset to handle negative semitones safely.
export function transposeChordString(chordStr: string, semitones: number, preferFlats: boolean): string {
  const { root, suffix, bass } = parseChordString(chordStr);
  if (!root) return chordStr;

  try {
    const rootPc = noteNameToPitchClass(root);
    const transposedRootPc = (rootPc + semitones + 120) % 12;
    const transposedRoot = preferFlats ? NOTE_NAMES_FLAT[transposedRootPc] : NOTE_NAMES_SHARP[transposedRootPc];

    let transposedBass = '';
    if (bass) {
      const bassPc = noteNameToPitchClass(bass);
      const transposedBassPc = (bassPc + semitones + 120) % 12;
      transposedBass = preferFlats ? NOTE_NAMES_FLAT[transposedBassPc] : NOTE_NAMES_SHARP[transposedBassPc];
    }

    return transposedRoot + suffix + (transposedBass ? '/' + transposedBass : '');
  } catch {
    return chordStr;
  }
}

// Unicode / alias normalization — e.g. 'º' (U+00BA ordinal) → '°' (U+00B0 degree)
const SUFFIX_ALIASES: Record<string, string> = {
  'º': '°',     // º → °  (masculine ordinal → degree sign, both mean dim)
  'º7': '°7',   // º7 → °7
  'dim': '°',
  'dim7': '°7',
  'o': '°',
  'o7': '°7',
  '+': 'aug',
  'M7': 'Maj7',
  'maj7': 'Maj7',
  'Δ': 'Maj7',       // Δ → Maj7
  'Δ7': 'Maj7',
  'ø': 'm7(b5)',     // ø → m7(b5) (half-dim)
  'ø7': 'm7(b5)',
  'm+': 'm(#5)',     // m+ → m(#5) (minor augmented)
  'maug': 'm(#5)',
  'm#5': 'm(#5)',
};
function normalizeSuffix(s: string): string { return SUFFIX_ALIASES[s] ?? s; }

// Build a Chord object from root name, formula suffix, and optional bass name
export function buildChord(rootName: string, suffix: string, bassName?: string): Chord {
  const root = noteNameToPitchClass(rootName);
  const formula = CHORD_FORMULAS.find(f => f.suffix === normalizeSuffix(suffix));
  if (!formula) {
    throw new Error(`Fórmula não encontrada para o sufixo: ${suffix}`);
  }

  let notes = formula.intervals.map(interval => (root + interval) % 12);
  
  let bass: PitchClass | undefined = undefined;
  if (bassName) {
    bass = noteNameToPitchClass(bassName);
    if (!notes.includes(bass)) {
      notes = [...notes, bass];
    }
  }
  
  return {
    root,
    rootName,
    formula,
    notes,
    bass,
    bassName
  };
}

// Detailed playability evaluator and barre detector
interface PlayabilityResult {
  isValid: boolean;
  fingersUsed: number;
  barre?: {
    fret: number;
    startString: number;
    endString: number;
  };
  stretch: number;
  playabilityIssues: string[];
  hasInteriorMute?: boolean;
}

export function evaluatePlayability(frets: number[]): PlayabilityResult {
  const issues: string[] = [];
  const fretted = frets.filter(f => f > 0);
  
  if (fretted.length === 0) {
    return { isValid: true, fingersUsed: 0, stretch: 0, playabilityIssues: [] };
  }

  const minFret = Math.min(...fretted);
  const maxFret = Math.max(...fretted);
  const stretch = maxFret - minFret;

  // 1. Check fret stretch stretch
  // Usually, a 4-fret stretch is comfortable. 5-fret is only possible at low frets (fret 1-5)
  if (stretch > 4) {
    if (!(stretch === 5 && minFret <= 2)) {
      return { isValid: false, fingersUsed: 99, stretch, playabilityIssues: ["Abertura de dedos muito grande"] };
    }
  }

  // 2. Identify Barres and count fingers
  // A barre is possible at minFret if there are multiple strings at minFret and no lower notes or open strings in between.
  let barre: PlayabilityResult['barre'] = undefined;
  let fingersUsed = 0;
  
  // Find strings fretted at minFret
  const minFretStrings: number[] = [];
  frets.forEach((fret, idx) => {
    if (fret === minFret) {
      minFretStrings.push(idx);
    }
  });

  // A barre is viable if we have at least 2 strings at minFret,
  // and we don't have any open (0) strings between the start and end of the barre.
  if (minFretStrings.length >= 2) {
    const startString = minFretStrings[0];
    const endString = minFretStrings[minFretStrings.length - 1];
    
    let openStringInBetween = false;
    for (let i = startString; i <= endString; i++) {
      if (frets[i] === 0) {
        openStringInBetween = true;
        break;
      }
    }

    if (!openStringInBetween) {
      barre = {
        fret: minFret,
        startString,
        endString
      };
    }
  }

  if (barre) {
    // If there is a barre, it uses 1 finger (index finger).
    fingersUsed = 1;
    // Any other string fretted at a fret HIGHER than the barre needs a separate finger.
    frets.forEach((fret, idx) => {
      if (fret > minFret) {
        fingersUsed++;
      } else if (fret === minFret && (idx < barre!.startString || idx > barre!.endString)) {
        // Fretted at minFret but outside the barre span (rarely happens with standard configurations)
        fingersUsed++;
      }
    });
  } else {
    // No barre, each fretted string needs a finger.
    fingersUsed = fretted.length;
  }

  // Check for interior mutes (muted string between two played strings)
  let firstPlayed = -1;
  let lastPlayed = -1;
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] >= 0) {
      if (firstPlayed === -1) firstPlayed = i;
      lastPlayed = i;
    }
  }
  let hasInteriorMute = false;
  if (firstPlayed !== -1 && lastPlayed !== -1) {
    for (let i = firstPlayed + 1; i < lastPlayed; i++) {
      if (frets[i] === -1) {
        hasInteriorMute = true;
        break;
      }
    }
  }
  if (hasInteriorMute) {
    issues.push("Abafamento de corda interna");
  }

  // Check finger count (max 4 fingers)
  if (fingersUsed > 4) {
    return { isValid: false, fingersUsed, stretch, playabilityIssues: ["Exige mais de 4 dedos"], hasInteriorMute };
  }

  return {
    isValid: true,
    fingersUsed,
    barre,
    stretch,
    playabilityIssues: issues,
    hasInteriorMute
  };
}

// Generate all valid voicings for a given tuning and chord
export function calculateVoicings(tuning: Tuning, chord: Chord, maxFret = 12): Voicing[] {
  const voicings: Voicing[] = [];
  const numStrings = tuning.strings.length;
  const useFlats = shouldUseFlats(chord.rootName);

  // Pre-calculate which frets on which strings are part of the chord
  // stringNotes[stringIndex][fret] = { pitchClass, noteName, midi }
  const stringFretNotes: { pitchClass: PitchClass, name: string, midi: number }[][] = [];
  for (let s = 0; s < numStrings; s++) {
    const openMidi = tuning.strings[s];
    stringFretNotes[s] = [];
    // fret 0 to maxFret
    for (let f = 0; f <= maxFret; f++) {
      const midi = openMidi + f;
      const pc = midi % 12;
      stringFretNotes[s][f] = {
        pitchClass: pc,
        name: midiToNoteName(midi, useFlats),
        midi
      };
    }
  }

  // Backtracking recursive search
  const currentFrets: number[] = new Array(numStrings).fill(-1);

  function search(stringIdx: number, activeFrettedCount: number, minFret: number, maxFretVal: number) {
    // Prune early if stretch is already too large
    if (activeFrettedCount > 0 && (maxFretVal - minFret) > 4) {
      // Allow a stretch of 5 ONLY if minFret <= 2 (close to the nut)
      if (!((maxFretVal - minFret) === 5 && minFret <= 2)) {
        return;
      }
    }

    if (stringIdx === numStrings) {
      // We have a complete shape! Let's check playability and completeness.
      validateAndScoreVoicing(currentFrets);
      return;
    }

    // Option 1: Mute string (-1)
    currentFrets[stringIdx] = -1;
    search(stringIdx + 1, activeFrettedCount, minFret, maxFretVal);

    // Option 2: Open string (0)
    const openPc = stringFretNotes[stringIdx][0].pitchClass;
    if (chord.notes.includes(openPc)) {
      currentFrets[stringIdx] = 0;
      search(stringIdx + 1, activeFrettedCount, minFret, maxFretVal);
    }

    // Option 3: Press a fret (1 to maxFret)
    for (let f = 1; f <= maxFret; f++) {
      const pc = stringFretNotes[stringIdx][f].pitchClass;
      if (chord.notes.includes(pc)) {
        currentFrets[stringIdx] = f;
        
        const newMin = minFret === -1 ? f : Math.min(minFret, f);
        const newMax = maxFretVal === -1 ? f : Math.max(maxFretVal, f);
        
        search(stringIdx + 1, activeFrettedCount + 1, newMin, newMax);
      }
    }
  }

  function validateAndScoreVoicing(frets: number[]) {
    // 1. Check that we are not muting too many strings (at least 3 strings must be played)
    const playedStrings = frets.filter(f => f >= 0);
    if (playedStrings.length < Math.min(3, numStrings)) {
      return;
    }

    // 2. Check if all required intervals are present
    const playedPitchClasses = new Set<PitchClass>();
    frets.forEach((fret, sIdx) => {
      if (fret >= 0) {
        playedPitchClasses.add(stringFretNotes[sIdx][fret].pitchClass);
      }
    });

    let requiredPcs = chord.formula.requiredIntervals
      ? chord.formula.requiredIntervals.map(interval => (chord.root + interval) % 12)
      : chord.notes;

    if (chord.customNotes) {
      requiredPcs = Array.from(new Set([...requiredPcs, ...chord.customNotes]));
    }

    if (chord.bass !== undefined && !requiredPcs.includes(chord.bass)) {
      requiredPcs = [...requiredPcs, chord.bass];
    }

    const hasAllRequired = requiredPcs.every(pc => playedPitchClasses.has(pc));
    if (!hasAllRequired) {
      return;
    }

    // 3. Evaluate physical playability
    const playability = evaluatePlayability(frets);
    if (!playability.isValid) {
      return;
    }

    // 4. Calculate note names played
    const notesPlayed = frets.map((fret, sIdx) => {
      if (fret === -1) return "X";
      return stringFretNotes[sIdx][fret].name;
    });

    // 5. Score voicing
    let score = 100;

    // A. Bass note correctness
    // Find lowest played string (for EADGBE, lowest string is index 0. For Cebolão, index 0 is 5th pair, Lá2)
    // Wait, let's verify if index 0 is indeed the lowest string.
    // In PRESET_INSTRUMENTS, the strings array is [lowest, ..., highest]. Yes, index 0 is lowest!
    let lowestPlayedIdx = -1;
    for (let i = 0; i < numStrings; i++) {
      if (frets[i] >= 0) {
        lowestPlayedIdx = i;
        break;
      }
    }

    if (lowestPlayedIdx !== -1) {
      const bassPc = stringFretNotes[lowestPlayedIdx][frets[lowestPlayedIdx]].pitchClass;
      if (chord.bass !== undefined) {
        if (bassPc !== chord.bass) {
          return; // Discard this voicing because it doesn't have the requested bass note as the lowest note
        }
        score += 35; // Got the exact requested bass note!
      } else {
        if (bassPc === chord.root) {
          score += 25; // Bass is the root! Highly desired.
        } else {
          score -= 20; // Inversion (bass is 3rd, 5th, etc.). Valid but less standard.
        }
      }
    } else {
      if (chord.bass !== undefined) {
        return; // No strings played, but bass was requested
      }
    }

    // B. Fret Stretch penalty
    score -= playability.stretch * 12;

    // C. Finger Count penalty
    score -= playability.fingersUsed * 8;

    // D. Barre penalty
    if (playability.barre) {
      score -= 15;
    }

    // E. Open Strings bonus
    const openCount = frets.filter(f => f === 0).length;
    score += openCount * 18;

    // F. Average Fret penalty (prefer shapes closer to the nut, lower frets)
    const frettedOnly = frets.filter(f => f > 0);
    if (frettedOnly.length > 0) {
      const avgFret = frettedOnly.reduce((a, b) => a + b, 0) / frettedOnly.length;
      score -= avgFret * 4;
    }

    // G. Muted strings penalty (we want full ringing strings, especially on Viola)
    const mutedCount = frets.filter(f => f === -1).length;
    score -= mutedCount * 15;

    // G2. Interior muted string penalty (muting inside played strings is hard!)
    if (playability.hasInteriorMute) {
      score -= 35;
    }

    // H. Completeness bonus (if it has optional tones too)
    const totalUniqueChordTones = chord.notes.length;
    const playedUniqueChordTones = Array.from(playedPitchClasses).filter(pc => chord.notes.includes(pc)).length;
    if (playedUniqueChordTones === totalUniqueChordTones) {
      score += 15; // Complete chord voicing!
    }

    voicings.push({
      frets: [...frets],
      notes: notesPlayed,
      barre: playability.barre,
      score: Math.max(1, Math.round(score)),
      playabilityIssues: playability.playabilityIssues,
      hasInteriorMute: playability.hasInteriorMute
    });
  }

  // Kick off search
  // search(stringIdx, activeFrettedCount, minFret, maxFretVal)
  search(0, 0, -1, -1);

  // Sort voicings:
  // 1. Voicings without interior mutes first
  // 2. Score descending (highest score first)
  // 3. Lowest fret (closer to nut first)
  return voicings.sort((a, b) => {
    const muteA = a.hasInteriorMute ? 1 : 0;
    const muteB = b.hasInteriorMute ? 1 : 0;
    if (muteA !== muteB) {
      return muteA - muteB; // 0 (sem abafamento) antes de 1 (com abafamento)
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const maxFretA = Math.max(...a.frets.filter(f => f > 0), 0);
    const maxFretB = Math.max(...b.frets.filter(f => f > 0), 0);
    return maxFretA - maxFretB;
  });
}

export function detectChord(frets: number[], tuning: Tuning): ReverseChordMatch[] {

  
  // Calculate midi notes played
  const playedMidis: number[] = [];
  let lowestPlayedMidi = -1;
  
  frets.forEach((fret, sIdx) => {
    if (fret >= 0) {
      const midi = tuning.strings[sIdx] + fret;
      playedMidis.push(midi);
      if (lowestPlayedMidi === -1 || midi < lowestPlayedMidi) {
        lowestPlayedMidi = midi;
      }
    }
  });

  if (playedMidis.length === 0) return [];

  const playedPcs = Array.from(new Set(playedMidis.map(m => m % 12)));
  const bassPc = lowestPlayedMidi % 12;
  const useFlats = playedPcs.some(pc => [10, 3, 8, 1].includes(pc)); // heuristic: if has Bb, Eb, Ab, Db
  const noteNames = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const bassNoteName = noteNames[bassPc];

  const matches: ReverseChordMatch[] = [];

  // Iterate over all possible roots (0 to 11)
  for (let r = 0; r < 12; r++) {
    const rootName = noteNames[r];
    
    // Check all chord formulas
    CHORD_FORMULAS.forEach(formula => {
      const formulaPcs = formula.intervals.map(i => (r + i) % 12);
      const requiredPcs = formula.requiredIntervals 
        ? formula.requiredIntervals.map(i => (r + i) % 12)
        : formulaPcs;

      // 1. All played notes must belong to the formula
      const allPlayedAreInFormula = playedPcs.every(pc => formulaPcs.includes(pc));
      
      // 2. All required notes of the formula must be played
      const allRequiredArePlayed = requiredPcs.every(pc => playedPcs.includes(pc));

      if (allPlayedAreInFormula && allRequiredArePlayed) {
        // Is it a perfect match? (Played note classes exactly match the formula pitch classes)
        const isPerfectMatch = playedPcs.length === formulaPcs.length && 
          playedPcs.every(pc => formulaPcs.includes(pc)) &&
          formulaPcs.every(pc => playedPcs.includes(pc));
          
        const isInversion = bassPc !== r;
        
        // Build chord name (e.g. C7 or C7/E)
        let chordName = `${rootName}${formula.suffix}`;
        if (isInversion) {
          chordName += `/${bassNoteName}`;
        }

        matches.push({
          chordName,
          rootName,
          suffix: formula.suffix,
          isPerfectMatch,
          isInversion,
          bassNoteName
        });
      }
    });
  }

  // Sort: perfect matches first, then non-inversions first, then shorter suffix names (simpler chords)
  return matches.sort((a, b) => {
    if (a.isPerfectMatch !== b.isPerfectMatch) {
      return a.isPerfectMatch ? -1 : 1;
    }
    if (a.isInversion !== b.isInversion) {
      return a.isInversion ? 1 : -1;
    }
    return a.chordName.length - b.chordName.length;
  });
}

