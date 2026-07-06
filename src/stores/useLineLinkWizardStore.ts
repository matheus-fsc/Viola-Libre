// =============================================================================
// useLineLinkWizardStore — Wizard 3: Vincular Texto
//
// Itera pelas regions kind:'section' (criadas pelo Wizard 1 — useAssistedModeStore) em ordem
// cronológica e pede, para cada uma, o intervalo de linhas de texto correspondente. Independente
// dos outros dois wizards — não compartilha phase/mode/history com eles, e não força nenhuma
// ordem de execução: pode rodar com 0, algumas ou todas as seções já marcadas, e simplesmente
// vincula as que existem até agora.
// =============================================================================

import { create } from 'zustand';
import { useTimingRegionsStore } from './useTimingRegionsStore';
import { useTimingSelectionStore } from './useTimingSelectionStore';

export interface LineLinkWizardState {
  phase: 'closed' | 'reviewing' | 'finished';
  // ids das regions kind:'section', ordenados por startTime — calculado uma vez ao iniciar
  // (startLineLinkPass), não é reativo a novas seções criadas depois: reabrir o wizard recalcula.
  sortedSectionIds: string[];
  currentIndex: number;

  startLineLinkPass(): void;
  confirmCurrentLink(startLine: number, endLine: number): void;
  skipCurrent(): void;
  closeLineLinkPass(): void;
}

// Primeiro índice, a partir de `fromIndex`, cuja section ainda não tem startLine/endLine
// preenchidos. Usado tanto na entrada (pula direto pra primeira pendente) quanto a cada avanço
// (confirmar ou pular) — assim uma seção já vinculada em uma sessão anterior (ou editada
// manualmente) nunca reaparece pedindo vínculo de novo.
function findNextUnlinkedIndex(ids: string[], fromIndex: number): number {
  const regions = useTimingRegionsStore.getState().regions;
  let i = fromIndex;
  while (i < ids.length) {
    const region = regions.find(r => r.id === ids[i]);
    if (!region || region.startLine === null || region.endLine === null) return i;
    i++;
  }
  return i; // === ids.length → não sobrou nenhuma pendente
}

export const useLineLinkWizardStore = create<LineLinkWizardState>((set, get) => ({
  phase: 'closed',
  sortedSectionIds: [],
  currentIndex: 0,

  startLineLinkPass: () => {
    const sortedSectionIds = useTimingRegionsStore.getState().regions
      .filter(r => r.kind === 'section')
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
      .map(r => r.id);
    const currentIndex = findNextUnlinkedIndex(sortedSectionIds, 0);
    const reviewing = currentIndex < sortedSectionIds.length;
    if (reviewing) useTimingSelectionStore.getState().setSelectionMode('section-link');
    set({ sortedSectionIds, currentIndex, phase: reviewing ? 'reviewing' : 'finished' });
  },

  confirmCurrentLink: (startLine, endLine) => {
    const { sortedSectionIds, currentIndex, phase } = get();
    if (phase !== 'reviewing') return;
    const sectionId = sortedSectionIds[currentIndex];
    if (!sectionId) return;

    useTimingRegionsStore.getState().updateRegion(sectionId, {
      startLine: Math.min(startLine, endLine),
      endLine: Math.max(startLine, endLine),
    });

    const selStore = useTimingSelectionStore.getState();
    selStore.setSelectionStart(null);
    selStore.setSelectionEnd(null);

    const nextIndex = findNextUnlinkedIndex(sortedSectionIds, currentIndex + 1);
    const done = nextIndex >= sortedSectionIds.length;
    if (done) selStore.setSelectionMode(null);
    set({ currentIndex: nextIndex, phase: done ? 'finished' : 'reviewing' });
  },

  // Pula a seção atual sem escrever startLine/endLine — fica pendente e reaparece na próxima
  // vez que o wizard for aberto (ou mais adiante nesta mesma sessão, se for a única restante).
  skipCurrent: () => {
    const { sortedSectionIds, currentIndex, phase } = get();
    if (phase !== 'reviewing') return;

    const selStore = useTimingSelectionStore.getState();
    selStore.setSelectionStart(null);
    selStore.setSelectionEnd(null);

    const nextIndex = findNextUnlinkedIndex(sortedSectionIds, currentIndex + 1);
    const done = nextIndex >= sortedSectionIds.length;
    if (done) selStore.setSelectionMode(null);
    set({ currentIndex: nextIndex, phase: done ? 'finished' : 'reviewing' });
  },

  // Fecha o wizard a qualquer momento (seções não vinculadas continuam pendentes — revisitável).
  closeLineLinkPass: () => {
    useTimingSelectionStore.getState().clearGesture();
    set({ phase: 'closed' });
  },
}));
