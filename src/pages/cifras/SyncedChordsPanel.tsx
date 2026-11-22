import type { Tuning, Voicing } from '../../engine/types';
import type { upcomingChords } from '../../engine/upcomingChords';
import { MiniFretboard } from '../../components/MiniFretboard';
import { useT } from '../../i18n';
import { useLayoutEffect, useRef } from 'react';

export function SyncedChordsPanel({ visible, onToggle, chords, next, tuning, voicings }: {
  visible: boolean;
  onToggle(): void;
  chords: string[];
  next: ReturnType<typeof upcomingChords>;
  tuning: Tuning;
  voicings: Record<string, Voicing | null>;
}) {
  const t = useT();
  const slotRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const panel = panelRef.current;
    const area = slot?.parentElement;
    if (!slot || !panel || !area) return;
    const position = () => {
      if (!slot.getBoundingClientRect().width) return;
      const top = slot.getBoundingClientRect().top;
      const available = area.getBoundingClientRect().bottom - top - panel.offsetHeight;
      // A moldura XP recorta overflow e impede sticky; deslocar na própria coluna mantém o painel visível sem cobrir a letra.
      const offset = Math.max(0, Math.min(window.innerHeight * 0.15 - top, available));
      panel.style.transform = `translateY(${offset}px)`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(area);
    observer.observe(panel);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, []);
  return (
    <aside ref={slotRef} className={`synced-chords-panel self-start shrink-0 min-w-0 ${visible ? 'w-60' : ''}`}>
      <div ref={panelRef}>
        <button type="button" onClick={onToggle} aria-expanded={visible}
          className="bevel-out bg-[#ece9d8] border border-gray-400 p-2 text-xs font-bold text-[#002fa7] w-full">
          {t(visible ? 'cifra.acordesPainelOcultar' : 'cifra.acordesPainelMostrar')}
        </button>
        {visible && (
          <div className="bevel-in bg-white p-3 max-h-[60vh] overflow-y-auto retro-scrollbar">
            <h3 className="text-xs font-bold text-[#005500] mb-2">{t('cifra.acordesFraseAtual')}</h3>
            <div className="flex flex-wrap gap-3">
              {chords.map((chord, index) => (
                <div key={index} className="min-w-0 max-w-full">
                  <div className="font-mono text-2xl font-bold text-[#002fa7] break-words">{chord}</div>
                  {voicings[chord] && <MiniFretboard voicing={voicings[chord]} tuning={tuning} width={76} fretSpacing={12} />}
                </div>
              ))}
              {!chords.length && <span className="text-xs text-gray-500">{t('cifra.acordesSemFrase')}</span>}
            </div>
            <h3 className="text-xs font-bold text-gray-600 mt-4 mb-1">{t('cifra.acordesProximasFrases')}</h3>
            {next.map((phrase, index) => (
              <div key={index} className="border-t border-[#d4d0c8] py-2">
                <span className="text-[10px] text-gray-600">{t('cifra.acordesEmSegundos', { s: Math.ceil(phrase.startsIn) })}</span>
                <div className="font-mono text-base font-bold text-[#385683] break-words">
                  {phrase.chords.join('  ') || t('cifra.acordesSemFrase')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
