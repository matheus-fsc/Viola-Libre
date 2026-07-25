import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Voicing, Tuning } from '../engine/types';
import { MiniFretboard } from './MiniFretboard';

/** Retângulo do acorde na letra, em coordenadas de viewport. */
export interface ChordAnchor {
  chord: string;
  /** Centro horizontal do acorde. */
  x: number;
  /** Topo do acorde — o card tenta abrir logo acima disto. */
  top: number;
  /** Base do acorde — usada quando não há espaço acima e o card vira para baixo. */
  bottom: number;
}

interface ChordHoverCardProps {
  anchor: ChordAnchor;
  voicings: Voicing[];
  index: number;
  tuning: Tuning;
  onSelectIndex: (index: number) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Ref repassada ao nó raiz — o CifraViewer usa para o clique-fora. */
  containerRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const CARD_W = 104;
const BOARD_W = 92;
/** Folga entre o acorde e o card. Curta o bastante para o ponteiro atravessar. */
const GAP = 6;
/** Respiro mínimo em relação às bordas da viewport. */
const MARGIN = 4;

/**
 * Mini-card de acorde que segue o acorde apontado na letra da cifra.
 *
 * O posicionamento é medido, não estimado: o card se mede depois de montado e
 * decide se abre acima ou abaixo do acorde. A versão anterior assumia uma altura
 * fixa (148px) que nunca batia com a real — a altura muda com a janela de
 * trastes, com a linha de notas e com a barra de variações — e o card ficava
 * pairando longe do acorde, com o vão engolindo o ponteiro no caminho.
 */
export const ChordHoverCard: React.FC<ChordHoverCardProps> = ({
  anchor,
  voicings,
  index,
  tuning,
  onSelectIndex,
  onMouseEnter,
  onMouseLeave,
  containerRef,
}) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (containerRef) containerRef.current = node;
  }, [containerRef]);

  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    const place = () => {
      const { width, height } = el.getBoundingClientRect();
      const left = Math.max(MARGIN, Math.min(anchor.x - width / 2, window.innerWidth - width - MARGIN));
      const above = anchor.top - height - GAP;
      const top = above >= MARGIN
        ? above
        : Math.max(MARGIN, Math.min(anchor.bottom + GAP, window.innerHeight - height - MARGIN));
      setPos(prev => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
    };

    place();
    // Trocar de variação muda a janela de trastes e, com ela, a altura do card.
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor.chord, anchor.x, anchor.top, anchor.bottom]);

  const voicing = voicings[index] ?? null;

  // Notas vindas do próprio voicing: o motor já escolhe sustenido ou bemol
  // conforme o acorde. A leitura antiga por índice MIDI forçava sustenido sempre.
  const uniqueNotes = voicing
    ? [...new Set(voicing.notes.filter(n => n && n !== 'X'))]
        .map(n => n.replace('#', '♯').replace('b', '♭'))
        .join(' ')
    : '';

  const step = (delta: number) => {
    const total = voicings.length;
    if (total === 0) return;
    onSelectIndex((index + delta + total) % total);
  };

  const navButton = "bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white";

  return (
    <div
      ref={setRefs}
      className="fixed z-50 bevel-out bg-[#ece9d8] shadow-xl select-none"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        width: CARD_W,
        // Só aparece depois de medido — evita o flash no canto superior esquerdo.
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-1 pt-0.5 pb-1 border-b border-[#d4d0c8] text-center">
        <span className="font-bold text-[11px] font-mono text-[#002fa7] leading-none">{anchor.chord}</span>
      </div>

      <div className="pt-1 flex justify-center">
        {voicing ? (
          <MiniFretboard voicing={voicing} tuning={tuning} width={BOARD_W} />
        ) : (
          <div className="h-[74px] flex items-center justify-center text-[10px] text-gray-400">
            sem posição
          </div>
        )}
      </div>

      {uniqueNotes && (
        <div className="px-1 pt-0.5">
          <span className="text-[8px] text-gray-500 text-center font-mono leading-tight block">
            {uniqueNotes}
          </span>
        </div>
      )}

      {voicings.length > 1 && (
        <div className="flex items-center justify-between px-1 pt-0.5 pb-1 gap-0.5">
          <button className={navButton} onClick={() => step(-1)} title="Variação anterior">◀</button>
          <span className="text-[9px] font-bold text-gray-600">{index + 1}/{voicings.length}</span>
          <button className={navButton} onClick={() => step(1)} title="Próxima variação">▶</button>
        </div>
      )}
    </div>
  );
};
