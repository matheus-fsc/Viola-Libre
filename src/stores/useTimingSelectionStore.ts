import { create } from 'zustand';

export interface SelectionState {
  // Cross-component highlight — same id is highlighted in timeline, grid, and future inspector
  selectedRegionId: string | null;
  hoveredRegionId: string | null;

  // Annotation gesture in progress (user is drawing a line-range selection)
  // Reactive because both CifraGridEditor (line highlights) and TimingEditor mini-form read it.
  // Contrast with _drag in useCifraTextStore which drives only chordDragVisual and is closure-private.
  // 'section-link' — Wizard 3 (useLineLinkWizardStore): vincula um intervalo de linhas a uma
  // region kind:'section' já existente, reaproveitando este mesmo mecanismo de clique-em-linha.
  // 'reassign-region-lines' — CifraGridEditor's line-link margin popup: reatribui o intervalo
  // de linhas de UMA region específica já vinculada (qualquer kind), fora do fluxo do Wizard 3.
  selectionMode: 'loop' | 'instrumental' | 'phrase' | 'section-link' | 'reassign-region-lines' | null;
  selectionStart: number | null;
  selectionEnd: number | null;

  selectRegion(id: string | null): void;
  hoverRegion(id: string | null): void;

  setSelectionMode(mode: 'loop' | 'instrumental' | 'phrase' | 'section-link' | 'reassign-region-lines' | null): void;
  setSelectionStart(idx: number | null): void;
  setSelectionEnd(idx: number | null): void;
  // Toggle: if already this mode → clear; else switch mode and reset gesture start/end
  toggleSelectionMode(mode: 'loop' | 'instrumental' | 'phrase'): void;
  // Reset mode + start + end (cancel button, after confirm, etc.)
  clearGesture(): void;
}

export const useTimingSelectionStore = create<SelectionState>(set => ({
  selectedRegionId: null,
  hoveredRegionId: null,
  selectionMode: null,
  selectionStart: null,
  selectionEnd: null,

  selectRegion: (id) => set({ selectedRegionId: id }),
  hoverRegion: (id) => set({ hoveredRegionId: id }),

  setSelectionMode: (mode) => set({ selectionMode: mode }),
  setSelectionStart: (idx) => set({ selectionStart: idx }),
  setSelectionEnd: (idx) => set({ selectionEnd: idx }),

  toggleSelectionMode: (mode) => set(s => ({
    selectionMode: s.selectionMode === mode ? null : mode,
    selectionStart: null,
    selectionEnd: null,
  })),

  clearGesture: () => set({ selectionMode: null, selectionStart: null, selectionEnd: null }),
}));
