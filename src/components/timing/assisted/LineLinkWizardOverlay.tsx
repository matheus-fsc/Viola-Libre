import React from 'react';
import { formatSeconds } from '../../../services/timingApi';
import { useLineLinkWizardStore } from '../../../stores/useLineLinkWizardStore';
import { useTimingRegionsStore } from '../../../stores/useTimingRegionsStore';
import { useTimingSelectionStore } from '../../../stores/useTimingSelectionStore';
import { usePlayerStore } from '../../../stores/usePlayerStore';

// Não-modal por design: ao contrário do Wizard 1/2, esta é uma revisão calma — o usuário clica
// nas linhas de texto por baixo (mesmo mecanismo de seleção usado pelo editor manual), então o
// painel não pode bloquear cliques na cifra. Sem countdown, sem pausar/retomar áudio em tempo
// real — previewRange() é sob demanda (Restrições do Prompt M).
export const LineLinkWizardOverlay: React.FC = () => {
  const { phase, sortedSectionIds, currentIndex, confirmCurrentLink, skipCurrent, closeLineLinkPass } = useLineLinkWizardStore();
  const { regions } = useTimingRegionsStore();
  const { selectionStart, selectionEnd } = useTimingSelectionStore();

  if (phase === 'closed') return null;

  const totalSections = regions.filter(r => r.kind === 'section').length;
  const linkedCount = regions.filter(r => r.kind === 'section' && r.startLine !== null && r.endLine !== null).length;

  if (phase === 'finished') {
    return (
      <div className="fixed bottom-[138px] left-0 right-0 z-[9997] flex items-center gap-2 px-3 py-2
        bg-[#005500] text-white select-none border-t-2 border-[#003300] shadow-lg">
        <span className="text-base shrink-0">✓</span>
        <div className="flex-1 min-w-0 text-[10px]">
          {totalSections === 0
            ? <span>Nenhuma seção marcada ainda — rode o Modo Guiado — Estrutura primeiro.</span>
            : <span>Todas as {totalSections} seções marcadas têm texto vinculado.</span>}
        </div>
        <button
          onClick={closeLineLinkPass}
          className="bevel-out bg-[#ece9d8] text-black border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
        >
          ✕ Fechar
        </button>
      </div>
    );
  }

  // phase === 'reviewing'
  const sectionId = sortedSectionIds[currentIndex];
  const section = sectionId ? regions.find(r => r.id === sectionId) : null;
  if (!section) return null; // defensivo — não deveria acontecer com currentIndex válido

  const hasLines = selectionStart !== null && selectionEnd !== null;
  const lineInfo = hasLines
    ? `Linhas ${Math.min(selectionStart!, selectionEnd!) + 1}–${Math.max(selectionStart!, selectionEnd!) + 1} selecionadas`
    : selectionStart !== null
      ? `Linha inicial ${selectionStart + 1} — clique na linha final`
      : 'Clique na linha inicial do trecho na cifra abaixo';

  return (
    <div className="fixed bottom-[138px] left-0 right-0 z-[9997] flex items-center gap-2 px-3 py-2
      bg-[#002fa7] text-white select-none border-t-2 border-[#001a5c] shadow-lg flex-wrap">
      <span className="text-base shrink-0">📍</span>
      <div className="flex-1 min-w-0 text-[10px] flex flex-col">
        <span>
          <span className="font-bold">{section.label || 'Seção'}</span>
          <span className="ml-2 opacity-80 font-mono">
            {formatSeconds(section.startTime ?? 0)}–{formatSeconds(section.endTime ?? 0)}
          </span>
          <span className="ml-2 opacity-60">({linkedCount} de {totalSections} seções vinculadas)</span>
        </span>
        <span className="opacity-80">{lineInfo}</span>
      </div>
      <button
        onClick={() => usePlayerStore.getState().previewRange(section.startTime ?? 0, section.endTime ?? 0)}
        className="bevel-out bg-[#ece9d8] text-black border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
      >
        ▶ Ouvir este trecho
      </button>
      <button
        onClick={skipCurrent}
        className="bevel-out bg-[#ece9d8] text-black border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
      >
        ↩ Pular por enquanto
      </button>
      <button
        onClick={() => confirmCurrentLink(selectionStart!, selectionEnd!)}
        disabled={!hasLines}
        className="bevel-out bg-[#d4edda] text-[#005500] border border-green-600 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ✓ Confirmar
      </button>
      <button
        onClick={closeLineLinkPass}
        className="text-white/80 hover:text-white border border-white/30 px-1.5 py-0.5 text-[9px] rounded shrink-0"
      >
        ✕
      </button>
    </div>
  );
};
