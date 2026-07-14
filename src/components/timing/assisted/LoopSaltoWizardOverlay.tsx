import React, { useEffect } from 'react';
import { formatSeconds } from '../../../services/timingApi';
import { useLoopSaltoWizardStore } from '../../../stores/useLoopSaltoWizardStore';
import { usePlayerStore } from '../../../stores/usePlayerStore';
import { useTimingRegionsStore } from '../../../stores/useTimingRegionsStore';

// Overlay for useLoopSaltoWizardStore's sole remaining flow: marking an additional occurrence
// of an already-existing Loop region (mode 'repeat'). Loop *creation* no longer goes through
// this store/overlay at all — see useLoopSaltoWizardStore.ts's header.
export const LoopSaltoWizardOverlay: React.FC = () => {
  const {
    active, mode, phase, segmentStartTime,
    pendingRepeatRegionId,
    commitBoundary,
    undoLast, exitAssisted,
  } = useLoopSaltoWizardStore();

  // ── Keyboard shortcuts (only while active) ────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        commitBoundary();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitAssisted();
      } else if (e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, commitBoundary, exitAssisted, undoLast]);

  if (!active || phase === 'closed' || mode !== 'repeat') return null;

  if (phase === 'armed') {
    return (
      <div className="fixed inset-0 z-[9998] flex items-end justify-center pointer-events-none pb-[var(--timeline-h,138px)]">
        <div className="pointer-events-auto bevel-out bg-[#ece9d8] border-2 border-[#316ac5] px-4 py-3 mb-2 flex items-center gap-3 shadow-xl max-w-sm w-full mx-2">
          <span className="text-lg shrink-0">↻</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[11px] text-[#002fa7]">Marcar repetição</p>
            <p className="text-[10px] text-gray-600">Posicione no início e pressione <kbd className="font-mono bg-gray-200 px-1 rounded">⏎</kbd> para marcar</p>
          </div>
          <button onClick={exitAssisted} className="text-gray-400 hover:text-gray-600 text-[10px] shrink-0">✕</button>
        </div>
      </div>
    );
  }

  if (phase === 'recording') {
    const repeatRegion = pendingRepeatRegionId
      ? useTimingRegionsStore.getState().regions.find(r => r.id === pendingRepeatRegionId)
      : null;
    const repeatLabel = repeatRegion?.label ?? 'Loop';
    const currentTime = usePlayerStore.getState().currentTime;
    const elapsed = Math.max(0, currentTime - segmentStartTime);
    return (
      <div className="fixed top-0 left-0 right-0 z-[9997] flex items-center gap-2 px-3 py-1.5
        bg-[#0058e6] text-white text-[10px] font-bold select-none border-b-2 border-[#0040b0]">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
        <span>Repetição — {repeatLabel}</span>
        <span className="font-mono ml-1 tabular-nums">{formatSeconds(elapsed)}</span>
        <span className="ml-auto opacity-70 font-normal">⏎ marcar fim</span>
        <button onClick={undoLast}
          className="text-white/80 hover:text-white border border-white/30 px-1.5 py-0.5 text-[9px] rounded">
          ⌫ Cancelar início
        </button>
        <button onClick={exitAssisted}
          className="text-white/80 hover:text-white border border-white/30 px-1.5 py-0.5 text-[9px] rounded ml-1">
          ✕ Sair
        </button>
      </div>
    );
  }

  return null;
};
