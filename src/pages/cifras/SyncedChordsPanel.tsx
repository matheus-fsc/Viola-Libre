import type { Tuning, Voicing } from '../../engine/types';
import type { chordStripAtTime } from '../../engine/upcomingChords';
import { MiniFretboard } from '../../components/MiniFretboard';
import { useT } from '../../i18n';
import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';

export function SyncedChordsPanel({ visible, onToggle, strip, tuning, voicings, positionRef }: {
  visible: boolean;
  onToggle(): void;
  strip: ReturnType<typeof chordStripAtTime>;
  tuning: Tuning;
  voicings: Record<string, Voicing | null>;
  /** Preenchido pelo painel: o laço da rolagem chama logo depois de mover a página, no mesmo quadro. */
  positionRef?: MutableRefObject<(() => void) | null>;
}) {
  const t = useT();
  const slotRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Direção da troca: avançar desliza da direita, voltar (busca para trás) desliza da esquerda.
  const chordKey = strip.current?.startTime ?? -1;
  const [shown, setShown] = useState({ key: chordKey, direction: 0 });
  if (shown.key !== chordKey) setShown({ key: chordKey, direction: chordKey > shown.key ? 1 : -1 });
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const panel = panelRef.current;
    const area = slot?.parentElement;
    if (!slot || !panel || !area) return;
    let applied: number | null = null;
    const position = () => {
      if (!slot.getBoundingClientRect().width) return;
      const top = slot.getBoundingClientRect().top;
      const available = area.getBoundingClientRect().bottom - top - panel.offsetHeight;
      // A moldura XP recorta overflow e impede sticky; deslocar na própria coluna mantém o painel visível sem cobrir a letra.
      const offset = Math.max(0, Math.min(window.innerHeight * 0.15 - top, available));
      if (offset === applied) return;
      applied = offset;
      panel.style.transform = `translateY(${offset}px)`;
    };
    position();
    if (positionRef) positionRef.current = position;
    const observer = new ResizeObserver(position);
    observer.observe(area);
    observer.observe(panel);
    window.addEventListener('scroll', position, { capture: true, passive: true });
    window.addEventListener('resize', position);
    return () => {
      if (positionRef?.current === position) positionRef.current = null;
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [positionRef]);
  return (
    <aside ref={slotRef} className={`synced-chords-panel self-start shrink-0 min-w-0 ${visible ? 'w-64' : ''}`}>
      <div ref={panelRef}>
        <button type="button" onClick={onToggle} aria-expanded={visible}
          className="bevel-out bg-[#ece9d8] border border-gray-400 p-2 text-xs font-bold text-[#002fa7] w-full">
          {t(visible ? 'cifra.acordesPainelOcultar' : 'cifra.acordesPainelMostrar')}
        </button>
        {visible && (
          <div className="bevel-in bg-white p-2 overflow-hidden">
            <div key={shown.key}
              className={`grid grid-cols-[1fr_1.2fr_1fr] gap-1 items-start ${shown.direction > 0 ? 'synced-chords-forward' : shown.direction < 0 ? 'synced-chords-back' : ''}`}>
              {([['cifra.acordesAnterior', strip.previous], ['cifra.acordesAtual', strip.current],
                ['cifra.acordesProximo', strip.next]] as const).map(([label, chord], index) => {
                const voicing = chord ? voicings[chord.name] : null;
                return (
                  <div key={label} className={`synced-chords-slot min-w-0 text-center ${index === 1 ? '' : 'opacity-40'}`}>
                    <h3 className="text-[10px] uppercase text-gray-600">{t(label)}</h3>
                    {chord && (
                      <>
                        <div className={`font-mono text-[#002fa7] break-words min-h-7 ${index === 1 ? 'text-lg font-bold' : 'text-sm'}`}>
                          {chord.name}
                        </div>
                        {voicing && (
                          <div className="w-full [&>svg]:w-full [&>svg]:h-auto">
                            <MiniFretboard voicing={voicing} tuning={tuning} />
                          </div>
                        )}
                      </>
                    )}
                    {index === 2 && strip.startsIn !== null && (
                      <div className="text-[10px] text-gray-600 mt-1">
                        {t('cifra.acordesEmSegundos', { s: Math.ceil(strip.startsIn) })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
