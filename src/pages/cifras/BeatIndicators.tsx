import { useEffect, useRef, type RefObject } from 'react';
import type { BeatGrid } from '../../services/timingApi';
import { pulseAtTime, type countInAtTime } from '../../engine/scrollTimeline';
import { useAnimacoesDesligadas } from '../../stores/useDesempenhoStore';
import { useT } from '../../i18n';

export function CountInIndicator({ count }: { count: ReturnType<typeof countInAtTime> }) {
  const t = useT();
  if (!count) return null;
  return <span className="rounded-sm border border-[#98acd0] bg-[#eef3fa] px-2 py-1 text-[10px] font-bold text-[#385683]">
    <span className="sr-only" aria-live="polite" aria-atomic="true">{t('cifra.contagemEntrada', { n: count.beat })}</span>
    <span aria-hidden="true" className="inline-flex gap-2">
      {Array.from({ length: count.total }, (_, i) => <span key={i} className={i + 1 === count.beat ? 'underline text-[#002fa7]' : 'opacity-40'}>{i + 1}</span>)}
    </span>
  </span>;
}

export function PulseDisplay({ grid, timeRef, playing }: { grid: BeatGrid; timeRef: RefObject<number>; playing: boolean }) {
  const t = useT();
  const reduced = useAnimacoesDesligadas();
  const dot = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const pulse = pulseAtTime(timeRef.current, grid);
      if (dot.current) {
        // Sem movimento, a cor ainda distingue o início do compasso sem piscar.
        dot.current.style.opacity = !playing || !pulse ? '0.25' : reduced || pulse.lit ? '1' : '0.25';
        dot.current.style.backgroundColor = pulse?.strong ? '#002fa7' : '#558855';
        dot.current.style.boxShadow = pulse?.strong ? '0 0 0 1px #002fa7' : 'none';
      }
      if (bar.current) bar.current.textContent = pulse ? t('cifra.compassoNumero', { n: pulse.bar }) : '';
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [grid, timeRef, playing, reduced, t]);
  return <span className="inline-flex items-center gap-1 text-[10px] text-[#385683]" aria-label={t('cifra.pulsos')}>
    <span ref={dot} aria-hidden="true" className="inline-block h-2 w-2 rounded-full" />
    <span ref={bar} />
  </span>;
}
