import { timelineBarSegments, type ScrollSegment } from '../../engine/scrollTimeline';
import { useT } from '../../i18n';
import { repeatPassAtTime, type RepeatRange } from '../../engine/repeatRanges';

export function ScrollTimelineBar({ timeline, total, elapsed, label, repeats, beats = [], downbeats = [], onSeek }: {
  timeline: readonly ScrollSegment[];
  beats?: readonly number[];
  downbeats?: readonly number[];
  total: number;
  elapsed: number;
  label: string | null;
  repeats: readonly RepeatRange[];
  onSeek(time: number): void;
}) {
  const t = useT();
  const time = Math.max(0, Math.min(elapsed, total));
  return (
    <div className="relative h-6 w-full min-w-0 shrink-0 overflow-hidden bevel-in bg-[#eef3fa] focus-within:ring-2 focus-within:ring-[#316ac5]" title={label ?? undefined}>
      {beats.filter(beat => beat >= 0 && beat <= total).map(beat => <span key={beat} aria-hidden="true"
        className={`absolute bottom-0 w-px ${downbeats.includes(beat) ? 'h-2 bg-[#002fa7]' : 'h-1 bg-[#98acd0]'}`}
        style={{ left: `${beat / total * 100}%` }} />)}
      {timelineBarSegments(timeline, total).map((segment, index) => (
        <span key={index} aria-hidden="true"
          style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
          className={`absolute top-2 h-1 ${segment.kind === 'instrumental' ? 'bg-[#996600]'
            : segment.kind === 'hold' ? 'bg-[#d4d0c8]'
              : repeatPassAtTime(repeats, segment.leftPct / 100 * total) ? 'bg-[#385683]' : 'bg-[#558855]'}`} />
      ))}
      <span aria-hidden="true" className="absolute top-0 bottom-0 w-0.5 bg-[#cc3300] pointer-events-none"
        style={{ left: `calc(${time / total * 100}% - ${time === total ? 2 : 0}px)` }} />
      <input type="range" min={0} max={total} step={0.1} value={time}
        aria-label={t('cifra.rolagemTimeline')} aria-valuetext={`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`}
        title={label ?? undefined} onChange={event => onSeek(Number(event.target.value))}
        className="absolute inset-0 w-full h-full m-0 opacity-0 cursor-pointer" />
    </div>
  );
}
