// =============================================================================
// useLoopSaltoWizardStore — marcar ocorrência adicional de um Loop existente
//
// Drasticamente reduzido: a criação de um Loop novo agora acontece só via "Converter em
// Loop" no menu de contexto de um clip repetido detectado (TimingTimeline.tsx + useDerivedJumps)
// — a região já nasce com startLine/endLine/startTime/endTime/repeats corretos, usando tempos
// já reais das ocorrências fundidas, sem precisar gravar nada. O antigo fluxo de wizard
// (selectLoop → seleção de linhas → contagem de repetição → gravação de uma passada de
// referência) foi removido por completo — não há mais nenhum botão de entrada pra ele.
//
// O que sobra aqui é só o modo 'repeat': marcar que um Loop JÁ EXISTENTE tocou mais uma vez no
// áudio (botão "↻" na lista de Loops da sidebar / no clip da timeline) — completamente
// independente da criação do Loop em si.
//
// markRepeatOccurrence também existia (duplicado) em useAssistedModeStore — removido de lá;
// este store é o canônico agora.
// =============================================================================

import { create } from 'zustand';
import { usePlayerStore } from './usePlayerStore';
import { useTimingRegionsStore } from './useTimingRegionsStore';

export interface LoopSaltoWizardState {
  active: boolean;
  mode:   'repeat' | null;
  phase:  'closed' | 'armed' | 'recording';

  error: string | null;
  showCountdown: boolean;
  segmentStartTime: number;

  pendingRepeatRegionId: string | null;

  // Marking an additional occurrence of an existing loop region
  markRepeatOccurrence(regionId: string): void;

  beginRecording(): void;
  commitBoundary(): void; // armed→recording (Enter) and recording→closed (Enter)

  undoLast(): void; // Backspace mid-take cancels just that take
  exitAssisted(): void;
  pauseForManualEdit(): void;
  resumeAssisted(): void;
}

export const useLoopSaltoWizardStore = create<LoopSaltoWizardState>((set, get) => ({
  active: false,
  mode:   null,
  phase:  'closed',
  error:  null,
  showCountdown: false,
  segmentStartTime: 0,
  pendingRepeatRegionId: null,

  markRepeatOccurrence: (regionId) => {
    if (!usePlayerStore.getState().mediaUrl) {
      set({ error: 'no-media' });
      return;
    }
    usePlayerStore.getState().pause();
    set({
      active: true, mode: 'repeat', phase: 'armed',
      showCountdown: false,
      pendingRepeatRegionId: regionId,
      segmentStartTime: 0, error: null,
    });
  },

  beginRecording: () => {
    usePlayerStore.getState().play();
    const startTime = usePlayerStore.getState().currentTime;
    set({ phase: 'recording', segmentStartTime: startTime });
  },

  // First Enter (phase 'armed') starts playback, second Enter (phase 'recording') commits the
  // new repeat entry onto the target loop region's repeats[].
  commitBoundary: () => {
    const { mode, phase, segmentStartTime, pendingRepeatRegionId } = get();
    if (mode !== 'repeat') return;
    if (phase === 'armed') {
      get().beginRecording();
      return;
    }
    if (phase === 'recording') {
      const endTime = usePlayerStore.getState().currentTime;
      usePlayerStore.getState().pause();
      if (pendingRepeatRegionId) {
        const rStore = useTimingRegionsStore.getState();
        const region = rStore.regions.find(r => r.id === pendingRepeatRegionId);
        const existing = region?.repeats ?? [];
        rStore.updateRegion(pendingRepeatRegionId, {
          repeats: [...existing, { startTime: segmentStartTime, endTime }],
        });
      }
      set({ active: false, phase: 'closed', mode: null, pendingRepeatRegionId: null });
    }
  },

  // Backspace mid-take cancels just that take — no committed repeat entry exists yet to undo.
  undoLast: () => {
    if (get().phase === 'recording') {
      usePlayerStore.getState().pause();
      set({ phase: 'armed' });
    }
  },

  pauseForManualEdit: () => {
    usePlayerStore.getState().pause();
    set({ active: false });
  },

  resumeAssisted: () => set({ active: true }),

  exitAssisted: () => set({
    active: false, phase: 'closed', mode: null,
    pendingRepeatRegionId: null, error: null,
  }),
}));
