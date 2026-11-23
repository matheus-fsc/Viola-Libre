import { create } from 'zustand';
import { buildChordLineText, chordLineAnnotations, chordLineTokens, pixelDeltaToCol, type ChordPos } from '../services/cifraUtils';

// Performance note: updateChordDrag rebuilds the full chord line text on every mousemove
// (O(line length) per pixel). The hot path could be deferred to endChordDrag(), tracking
// only the column during drag for O(1)/frame + O(line) on drop. Not fixing here per Phase 2b scope.

interface ChordDragState {
  lineIdx: number;
  tokenIdx: number;
  origChords: ChordPos[];
  bars: ChordPos[];
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
      const line = get().lines[lineIdx];
      // Move os afixos junto com o acorde, mas mantém as barras na posição do compasso.
      const origChords = chordLineTokens(line);
      _drag = {
        lineIdx, tokenIdx,
        origChords,
        bars: chordLineAnnotations(line, origChords),
        origCol: chords[tokenIdx].col,
        startX, charW,
        lastCol: chords[tokenIdx].col,
      };
      set({ chordDragVisual: { lineIdx, currentCol: chords[tokenIdx].col } });
    },

    updateChordDrag: (clientX) => {
      if (!_drag) return;
      const prefixLength = _drag.origCol - _drag.origChords[_drag.tokenIdx].col;
      const newCol = Math.max(prefixLength, _drag.origCol + pixelDeltaToCol(clientX - _drag.startX, _drag.charW));
      if (newCol === _drag.lastCol) return;
      _drag.lastCol = newCol;
      const d = _drag;
      const newChords = d.origChords.map((c, i) => i === d.tokenIdx ? { ...c, col: newCol - prefixLength } : c);
      const newLines = [...get().lines];
      newLines[d.lineIdx] = buildChordLineText([...d.bars, ...newChords]);
      set({ lines: newLines, chordDragVisual: { lineIdx: d.lineIdx, currentCol: newCol } });
    },

    endChordDrag: () => {
      _drag = null;
      set({ chordDragVisual: null });
    },
  };
});
