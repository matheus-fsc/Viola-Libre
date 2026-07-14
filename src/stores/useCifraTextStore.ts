import { create } from 'zustand';
import { buildChordLineText, pixelDeltaToCol, type ChordPos } from '../services/cifraUtils';

// Performance note: updateChordDrag rebuilds the full chord line text on every mousemove
// (O(line length) per pixel). The hot path could be deferred to endChordDrag(), tracking
// only the column during drag for O(1)/frame + O(line) on drop. Not fixing here per Phase 2b scope.

interface ChordDragState {
  lineIdx: number;
  tokenIdx: number;
  origChords: ChordPos[];
  origCol: number;
  startX: number;
  charW: number;
  lastCol: number;
}

export interface CifraTextState {
  lines: string[];
  chordDragVisual: { lineIdx: number; currentCol: number } | null;

  setLines(lines: string[]): void;
  updateLine(index: number, text: string): void;
  startChordDrag(lineIdx: number, tokenIdx: number, chords: ChordPos[], startX: number, charW: number): void;
  updateChordDrag(clientX: number): void;
  endChordDrag(): void;
}

export const useCifraTextStore = create<CifraTextState>((set, get) => {
  // Mutable drag state — NOT reactive Zustand state (no re-renders during drag except for chordDragVisual)
  let _drag: ChordDragState | null = null;

  return {
    lines: [],
    chordDragVisual: null,

    setLines: (lines) => set({ lines }),

    updateLine: (index, text) => {
      const lines = [...get().lines];
      lines[index] = text;
      set({ lines });
    },

    startChordDrag: (lineIdx, tokenIdx, chords, startX, charW) => {
      _drag = {
        lineIdx, tokenIdx,
        origChords: chords.map(c => ({ ...c })),
        origCol: chords[tokenIdx].col,
        startX, charW,
        lastCol: chords[tokenIdx].col,
      };
      set({ chordDragVisual: { lineIdx, currentCol: chords[tokenIdx].col } });
    },

    updateChordDrag: (clientX) => {
      if (!_drag) return;
      const newCol = Math.max(0, _drag.origCol + pixelDeltaToCol(clientX - _drag.startX, _drag.charW));
      if (newCol === _drag.lastCol) return;
      _drag.lastCol = newCol;
      const d = _drag;
      const newChords = d.origChords.map((c, i) => i === d.tokenIdx ? { ...c, col: newCol } : c);
      const newLines = [...get().lines];
      newLines[d.lineIdx] = buildChordLineText(newChords);
      set({ lines: newLines, chordDragVisual: { lineIdx: d.lineIdx, currentCol: newCol } });
    },

    endChordDrag: () => {
      _drag = null;
      set({ chordDragVisual: null });
    },
  };
});
