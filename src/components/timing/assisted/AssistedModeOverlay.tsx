import React, { useEffect, useState } from 'react';
import type { SectionType } from '../../../services/timingApi';
import { formatSeconds } from '../../../services/timingApi';
import { useAssistedModeStore } from '../../../stores/useAssistedModeStore';
import { usePlayerStore } from '../../../stores/usePlayerStore';

// Section chips shown in the ask-next popup — recurring question for "what comes next".
// No 'intro' (already handled once, up front, by the confirm-intro phase — a song shouldn't have
// a 2nd Introdução mid-way), no 'coda' (still a valid SectionType for the manual "+Novo Trecho"
// form, just not suggested here — a Coda is a non-repeated tail section, not something the
// sequential ask-next flow needs to offer), no 'Virada' (kind:'instrumental' quick-fill — removed
// as a creation path entirely, see useAssistedModeStore.ts's header for the compat rationale).
const NEXT_SECTION_CHIPS: { label: string; type: SectionType }[] = [
  { label: 'Verso',    type: 'verse'       },
  { label: 'Pré-Ref', type: 'pre-chorus'  },
  { label: 'Refrão',  type: 'chorus'      },
  { label: 'Ponte',   type: 'bridge'      },
  { label: 'Solo',    type: 'solo'        },
  { label: 'Instr.',  type: 'instrumental' },
  { label: 'Final',   type: 'outro'       },
];

const CHIP_COLORS: Record<SectionType, { bg: string; fg: string; bd: string }> = {
  intro:        { bg: '#f9fafb', fg: '#374151', bd: '#d1d5db' },
  verse:        { bg: '#eff6ff', fg: '#1d4ed8', bd: '#93c5fd' },
  'pre-chorus': { bg: '#faf5ff', fg: '#7e22ce', bd: '#d8b4fe' },
  chorus:       { bg: '#fff7ed', fg: '#c2410c', bd: '#fdba74' },
  bridge:       { bg: '#f0fdfa', fg: '#0f766e', bd: '#5eead4' },
  solo:         { bg: '#f0fdf4', fg: '#15803d', bd: '#86efac' },
  instrumental: { bg: '#ecfdf5', fg: '#065f46', bd: '#6ee7b7' },
  outro:        { bg: '#f1f5f9', fg: '#475569', bd: '#94a3b8' },
  coda:         { bg: '#fdf4ff', fg: '#86198f', bd: '#e879f9' },
  other:        { bg: '#fefce8', fg: '#854d0e', bd: '#fde047' },
};

// ── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40">
    <div className="bevel-out bg-[#ece9d8] border-2 border-[#316ac5] p-4 w-80 max-w-[90vw] flex flex-col gap-3 shadow-xl">
      {children}
    </div>
  </div>
);

// ── Recording indicator ───────────────────────────────────────────────────────
const RecordingBar: React.FC<{
  mode: 'structural' | 'line';
  segmentStartTime: number;
  lineCursor: number | null;
  lyricLineTotal: number | null;
  historyLen: number;
}> = ({ mode, segmentStartTime, lineCursor, lyricLineTotal, historyLen }) => {
  const currentTime = usePlayerStore(s => s.currentTime);
  const elapsed = Math.max(0, currentTime - segmentStartTime);

  const lineContext = mode === 'line' && lineCursor !== null && lyricLineTotal !== null
    ? `Linha ${lineCursor + 1} / ${lyricLineTotal}`
    : null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9997] flex items-center gap-2 px-3 py-1.5
      bg-[#cc0000] text-white text-[10px] font-bold select-none border-b-2 border-[#990000]">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
      <span>{mode === 'structural' ? 'Estrutura' : 'Letras'}</span>
      {lineContext && <span className="opacity-70">— {lineContext}</span>}
      <span className="font-mono ml-1 tabular-nums">{formatSeconds(elapsed)}</span>

      <span className="ml-auto opacity-70 font-normal">⏎ marcar</span>
      {historyLen > 0 && (
        <button
          onClick={() => useAssistedModeStore.getState().undoLast()}
          className="text-white/80 hover:text-white border border-white/30 px-1.5 py-0.5 text-[9px] rounded"
        >
          ⌫ Voltar
        </button>
      )}
      <button
        onClick={() => useAssistedModeStore.getState().exitAssisted()}
        className="text-white/80 hover:text-white border border-white/30 px-1.5 py-0.5 text-[9px] rounded ml-1"
      >
        ✕ Sair
      </button>
    </div>
  );
};

// ── Main overlay component ────────────────────────────────────────────────────
export const AssistedModeOverlay: React.FC = () => {
  const {
    active, mode, phase, showCountdown,
    pendingSectionType,
    segmentStartTime, lineCursor, lyricLineIndices, history,
    dupWarning,
    confirmIntro, beginRecording, selectNextType,
    confirmDupOverwrite, confirmDupSkip,
    commitBoundary,
    undoLast, exitAssisted, pauseForManualEdit, finish,
  } = useAssistedModeStore();

  // ── Countdown state (UI-local — not in store) ──────────────────────────────
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!active || phase !== 'armed') { setCountdown(null); return; }

    if (!showCountdown) {
      beginRecording();
      return;
    }

    // 3-2-1 countdown
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => { setCountdown(null); beginRecording(); }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active, phase, showCountdown, mode]); // beginRecording is stable (Zustand action)

  // ── Keyboard shortcuts (only while active) ────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (dupWarning) return;
        commitBoundary();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (dupWarning) { confirmDupSkip(); return; }
        pauseForManualEdit();
      } else if (
        e.key === 'Backspace' ||
        ((e.ctrlKey || e.metaKey) && e.key === 'z')
      ) {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, phase, dupWarning, commitBoundary, confirmDupSkip, pauseForManualEdit, undoLast]);

  if (!active || phase === 'closed') return null;

  // ── duplicate-section warning (takes priority over all phase UIs) ─────────
  if (dupWarning) {
    const range = `${formatSeconds(dupWarning.startTime)}–${formatSeconds(dupWarning.endTime)}`;
    return (
      <Modal>
        <p className="font-bold text-sm text-[#cc6600]">Trecho já marcado</p>
        <p className="text-[10px] text-gray-700">
          <strong>{dupWarning.label}</strong> já foi marcado ({range}).
          Deseja substituir ou pular?
        </p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={confirmDupSkip}
            className="flex-1 bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-1.5 text-[10px] font-bold hover:bg-white"
          >
            ← Pular — já está marcado
          </button>
          <button
            onClick={confirmDupOverwrite}
            className="flex-1 bevel-out bg-[#ffe4e4] border border-red-400 px-2 py-1.5 text-[10px] font-bold hover:bg-white text-red-800"
          >
            ✎ Marcar de novo (substitui)
          </button>
        </div>
      </Modal>
    );
  }

  // ── confirm-intro ─────────────────────────────────────────────────────────
  if (phase === 'confirm-intro') {
    return (
      <Modal>
        <p className="font-bold text-sm text-[#002fa7]">Modo Guiado — Estrutura</p>
        <p className="text-[11px] text-gray-700">
          A música tem uma <strong>introdução instrumental</strong> antes da letra começar?
        </p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => confirmIntro(true)}
            className="flex-1 bevel-out bg-[#d4edda] border border-green-500 px-3 py-2 text-xs font-bold hover:bg-white"
          >
            ✓ Sim — tem intro
          </button>
          <button
            onClick={() => confirmIntro(false)}
            className="flex-1 bevel-out bg-[#ece9d8] border border-gray-400 px-3 py-2 text-xs font-bold hover:bg-white"
          >
            ✗ Não
          </button>
        </div>
        <button
          onClick={exitAssisted}
          className="text-[9px] text-gray-400 hover:text-gray-600 text-center"
        >
          Cancelar modo guiado
        </button>
      </Modal>
    );
  }

  // ── armed (countdown) ─────────────────────────────────────────────────────
  if (phase === 'armed' && showCountdown && countdown !== null) {
    return (
      <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black/60 select-none">
        <div className="text-white text-center">
          <div
            key={countdown}
            className="text-[120px] font-black leading-none tabular-nums"
            style={{ textShadow: '0 0 40px rgba(255,255,255,0.5)', animation: 'pulse 0.9s ease-out' }}
          >
            {countdown}
          </div>
          <p className="text-lg mt-2 opacity-70">
            {mode === 'structural'
              ? pendingSectionType
                ? `Pronto para marcar: ${pendingSectionType === 'intro' ? 'Introdução' : pendingSectionType}`
                : 'Pronto para começar'
              : 'Pronto para marcar letras'}
          </p>
          <button
            onClick={exitAssisted}
            className="mt-6 text-white/50 hover:text-white text-sm underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── recording (discrete bar) ───────────────────────────────────────────────
  if (phase === 'recording') {
    return (
      <RecordingBar
        mode={mode as 'structural' | 'line'}
        segmentStartTime={segmentStartTime}
        lineCursor={lineCursor}
        lyricLineTotal={lyricLineIndices?.length ?? null}
        historyLen={history.length}
      />
    );
  }

  // ── ask-next (structural pass) ────────────────────────────────────────────
  if (phase === 'ask-next') {
    const lastLabel = pendingSectionType
      ? `Trecho "${pendingSectionType}" marcado.`
      : 'Trecho inicial marcado.';

    return (
      <Modal>
        <p className="font-bold text-sm text-[#002fa7]">Próximo trecho</p>
        <p className="text-[10px] text-green-700 font-bold">✓ {lastLabel}</p>
        <p className="text-[10px] text-gray-600">Qual é o próximo trecho da música?</p>

        {/* Section type chips */}
        <div className="flex flex-wrap gap-1">
          {NEXT_SECTION_CHIPS.map(({ label, type }) => {
            const c = CHIP_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => selectNextType(type)}
                style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
                className="border px-2 py-1 text-[10px] font-bold rounded hover:brightness-95 transition-all"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Secondary actions */}
        <div className="flex flex-col gap-1 mt-1 border-t border-gray-200 pt-2">
          {history.length > 0 && (
            <button
              onClick={undoLast}
              className="bevel-out bg-[#fff3cd] border border-yellow-400 px-2 py-1 text-[10px] font-bold hover:bg-white text-left"
            >
              ⌫ Voltar — desfazer último trecho
            </button>
          )}
          <button
            onClick={pauseForManualEdit}
            className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-1 text-[10px] hover:bg-white text-left"
          >
            ✎ Ajustar manualmente (mantém o que foi marcado)
          </button>
          <button
            onClick={finish}
            className="bevel-out bg-[#d4edda] border border-green-500 px-2 py-1 text-[10px] font-bold hover:bg-white text-left"
          >
            ✓ Finalizar música
          </button>
        </div>
      </Modal>
    );
  }

  // ── finished (line pass) ──────────────────────────────────────────────────
  if (phase === 'finished') {
    const total = lyricLineIndices?.length ?? 0;
    return (
      <Modal>
        <p className="font-bold text-sm text-[#002fa7]">Alinhar letra — concluído</p>
        <p className="text-[11px] text-green-700 font-bold">
          ✓ {total} {total === 1 ? 'linha marcada' : 'linhas marcadas'} com sucesso!
        </p>
        <p className="text-[11px] text-gray-600">
          Chegou ao fim da letra da cifra. Todas as linhas foram alinhadas ao áudio.
        </p>
        <button
          onClick={finish}
          className="bevel-out bg-[#d4edda] border border-green-500 px-3 py-2 text-xs font-bold hover:bg-white mt-1"
        >
          ✓ Finalizar e voltar ao editor
        </button>
      </Modal>
    );
  }

  return null;
};
