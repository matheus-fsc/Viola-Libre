import { beatProgress } from '../../engine/scrollTimeline';
import type { Tuning, Voicing } from '../../engine/types';
import { chordProgress, currentChordSeconds, type chordStripAtTime } from '../../engine/upcomingChords';
import { noteValueForDuration } from '../../engine/noteValue';
import { NoteValueIcon } from '../../components/NoteValueIcon';
import { useAnimacoesDesligadas } from '../../stores/useDesempenhoStore';
import { MiniFretboard } from '../../components/MiniFretboard';
import { useT } from '../../i18n';
import { useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';

/** Blocos da barra sem BPM para contar tempos. Com BPM, é um bloco por tempo do acorde. */
const PROGRESS_STEPS = 10;
const MAX_BEAT_BLOCKS = 16;

export function SyncedChordsPanel({ visible, onToggle, strip, tuning, voicings, bpm, degreeOf, frameRef, beats = [] }: {
  beats?: readonly number[];
  visible: boolean;
  onToggle(): void;
  strip: ReturnType<typeof chordStripAtTime>;
  tuning: Tuning;
  voicings: Record<string, Voicing | null>;
  /** Para desenhar a figura rítmica de cada acorde. Sem BPM, não há figura. */
  bpm: number | null;
  /** Com a preferência de graus: o grau do acorde no tom da tela. O nome segue pequeno embaixo. */
  degreeOf?: (name: string) => string | null;
  /** Preenchido pelo painel: o laço da rolagem chama a cada quadro, logo depois de mover a página, com o tempo da música. */
  frameRef?: MutableRefObject<((time: number) => void) | null>;
}) {
  const t = useT();
  const reduced = useAnimacoesDesligadas();
  const slotRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<(time: number) => void>(() => {});
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
    const frame = (time: number) => {
      position();
      progressRef.current(time);
    };
    if (frameRef) frameRef.current = frame;
    const observer = new ResizeObserver(position);
    observer.observe(area);
    observer.observe(panel);
    window.addEventListener('scroll', position, { capture: true, passive: true });
    window.addEventListener('resize', position);
    return () => {
      if (frameRef?.current === frame) frameRef.current = null;
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [frameRef]);

  const { previous, current, next, afterNext, startsIn } = strip;
  const remainingBeats = next && startsIn !== null && beats.length > 1
    ? Math.max(0, Math.ceil(beatProgress(next.startTime, beats) - beatProgress(next.startTime - startsIn, beats))) : null;
  const waitLabel = startsIn === null ? '' : t('cifra.acordesEmSegundos', { s: Math.ceil(startsIn) });
  const beatLabel = remainingBeats === null ? '' : t('cifra.acordesEmTempos', { n: remainingBeats });
  const currentSeconds = currentChordSeconds(current, next);
  const figures = [
    previous && current ? noteValueForDuration(current.startTime - previous.startTime, bpm) : null,
    currentSeconds === null ? null : noteValueForDuration(currentSeconds, bpm),
    next && afterNext ? noteValueForDuration(afterNext.startTime - next.startTime, bpm) : null,
  ];
  // Antes do primeiro acorde, o lugar do atual mostra a introdução, com figura e barra até o primeiro.
  const intro = !current && next !== null && next.startTime > 0;
  const beatBlocks = figures[1] ? Math.min(MAX_BEAT_BLOCKS, Math.max(1, Math.round(figures[1].beats))) : PROGRESS_STEPS;
  // A barra é escrita direto no DOM a cada quadro, no relógio do laço: um re-render por quadro pesaria,
  // e o tique de 250 ms do relógio faria a barra andar aos trancos.
  useLayoutEffect(() => {
    let applied = -1;
    const apply = (time: number) => {
      const bar = barRef.current;
      const p = chordProgress(current, next, time, reduced ? beatBlocks : 0);
      if (!bar || p === null || p === applied) return;
      applied = p;
      bar.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
    };
    progressRef.current = apply;
    // Parado (pausa, busca), o quadro não vem: o tempo sai do que o render já sabe.
    if (next && startsIn !== null) apply(next.startTime - startsIn);
  }, [current, next, startsIn, reduced, visible, beatBlocks]);
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
                    {index === 1 && intro && (
                      <div className="font-mono text-sm font-bold text-[#002fa7] break-words min-h-7">{t('cifra.acordesIntro')}</div>
                    )}
                    {chord && (
                      <>
                        <div className={`font-mono text-[#002fa7] break-words min-h-7 ${index === 1 ? 'text-lg font-bold' : 'text-sm'}`}>
                          {degreeOf?.(chord.name) ?? chord.name}
                        </div>
                        {degreeOf?.(chord.name) && (
                          <div className="font-mono text-[10px] text-gray-600 break-words -mt-1">{chord.name}</div>
                        )}
                        {voicing && (
                          <div className="w-full [&>svg]:w-full [&>svg]:h-auto">
                            <MiniFretboard voicing={voicing} tuning={tuning} />
                          </div>
                        )}
                      </>
                    )}
                    {figures[index] && (chord || (index === 1 && intro)) && (
                      <NoteValueIcon value={figures[index]} className="mt-1 text-gray-800" />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Fora da fileira que desliza: a barra não anda de lado junto com os acordes. */}
            {/* Vai do atual ao próximo, embaixo dos dois: o que enche é a espera pela troca. */}
            {next && startsIn !== null && (
              <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-1 mt-2">
                <div className="col-start-2 col-span-2 min-w-0">
                  <div role="progressbar" aria-label={t('cifra.acordesBarraRotulo')}
                    aria-valuetext={[waitLabel, beatLabel].filter(Boolean).join(", ")}
                    className="bevel-in relative h-3.5 bg-white border border-gray-400 p-px">
                    <div ref={barRef} className="synced-chords-progress h-full"
                      style={{ clipPath: 'inset(0 100% 0 0)', '--beats': beatBlocks } as CSSProperties} />
                    {/* Os quadrados tracejados aparecem antes de encher: o olho conta quantos tempos o acorde dura.
                        Sem figura (sem BPM) não há tempos de verdade para desenhar. */}
                    {figures[1] && (
                      <div aria-hidden className="absolute inset-px flex pointer-events-none">
                        {Array.from({ length: beatBlocks }, (_, i) => (
                          <div key={i} className={`flex-1 border border-dashed border-black ${i ? '-ml-px' : ''}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5 text-right truncate">
                    {waitLabel}{beatLabel && ` (${beatLabel})`} {' '}{t('cifra.acordesAte', { acorde: degreeOf?.(next.name) ?? next.name })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
