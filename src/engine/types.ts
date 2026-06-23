export type PitchClass = number; // 0 to 11 (C = 0, C# = 1, ... B = 11)

export interface NoteInfo {
  name: string;      // e.g., "C#", "Bb"
  pitchClass: PitchClass;
  octave?: number;   // optional MIDI octave
}

export interface Tuning {
  id: string;
  name: string;
  strings: number[]; // MIDI note numbers from lowest string to highest string (e.g., [45, 50, 54, 57, 62] for Cebolão Ré)
}

export interface Instrument {
  id: string;
  name: string;
  tunings: Tuning[];
  defaultTuningId: string;
}

export interface ChordFormula {
  name: string;          // e.g., "Maj", "m", "7", "m7b5", "7b5"
  suffix: string;        // e.g., "M", "m", "7", "m7(b5)", "7(b5)"
  intervals: number[];   // Semitones from root (e.g., [0, 4, 7] for Major)
  requiredIntervals?: number[]; // Intervals that must be present (e.g., the flat 5 in a flat 5 chord)
}

export interface Chord {
  root: PitchClass;      // 0 to 11
  rootName: string;      // e.g., "Bb"
  formula: ChordFormula;
  notes: PitchClass[];   // Absolute pitch classes of the chord (e.g., [10, 2, 4, 8] for Bb7b5)
  bass?: PitchClass;     // e.g., 4 (E) in C/E
  bassName?: string;     // e.g., "E" in C/E
}

export interface Voicing {
  frets: number[];       // Fret for each string (-1 for muted, 0 for open, 1+ for fretted)
  notes: string[];       // Note name played on each string
  barre?: {
    fret: number;
    startString: number; // index of starting string (0-based)
    endString: number;   // index of ending string (0-based)
  };
  score: number;         // Calculated playability score
  playabilityIssues: string[];
}

export interface ReverseChordMatch {
  chordName: string;
  rootName: string;
  suffix: string;
  isPerfectMatch: boolean;
  isInversion: boolean;
  bassNoteName: string;
}

export interface ScaleFormula {
  name: string;          // e.g., "Maior", "Menor Natural"
  intervals: number[];   // Semitones from root (e.g., [0, 2, 4, 5, 7, 9, 11])
  degrees: string[];     // Degree labels (e.g., ["I", "II", "III", "IV", "V", "VI", "VII"])
}

export interface Scale {
  root: PitchClass;      // 0 to 11
  rootName: string;      // e.g., "C"
  formula: ScaleFormula;
  notes: PitchClass[];   // Absolute pitch classes in the scale (e.g., [0, 2, 4, 5, 7, 9, 11])
}


