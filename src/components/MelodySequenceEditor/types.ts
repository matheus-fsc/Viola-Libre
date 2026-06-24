
export interface MelodyNote {
  id: string;
  noteName: string;
  freq: number;
  stringIdx: number;
  fret: number;
  duration: number;
  suggestedChord?: string;
  stepId?: string;
  theory?: string;
  section?: string;
}

export interface MelodyStep {
  stepId: string;
  notes: MelodyNote[];
  duration: number;
  suggestedChord?: string;
  theory?: string;
  section?: string;
}
