import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { melodyNoteName, melodySolfege, notesToTab } from '../../engine/melody';
import { melodyRangeAt, melodyRanges, type MelodyRange, type MelodyView } from '../../engine/melodyView';
import type { Tuning } from '../../engine/types';
import type { TimingContribution } from '../../services/timingApi';
import { useT } from '../../i18n';

/** Faixa fixa na barra da rolagem. Dentro da letra ela abria um vão em cada frase. */
export function SyncedMelody({ timing, tuning, view, frameRef, time }: {
  timing: TimingContribution;
  tuning: Tuning;
  view: MelodyView;
  frameRef: MutableRefObject<((time: number) => void) | null>;
  time: number;
}) {
  const t = useT();
  const [frameTime, setFrameTime] = useState({ source: time, now: time });
  const clock = frameTime.source === time ? frameTime.now : time;
  useLayoutEffect(() => {
    frameRef.current = now => setFrameTime({ source: time, now });
    return () => { frameRef.current = null; };
  }, [frameRef, time]);
  const wordless = t('melody.wordless');
  const ranges = useMemo(() => timing.melody ? melodyRanges(timing.melody, timing.phrases, view, wordless) : [], [timing, view, wordless]);
  const range = melodyRangeAt(ranges, clock);
  // Altura fixa: a barra não pode pular a cada troca entre canto e pausa.
  return <div className="bevel-in bg-[#f5f8ff] border border-[#98acd0] px-1 py-0.5 text-[10px] text-[#002fa7] font-mono leading-tight w-full min-w-0 md:w-0 md:min-w-full h-[132px] overflow-hidden">
    <div className="text-[#8a4b00] font-bold">⚠ {t('melody.automatic')}</div>
    {range ? <MelodyStrip key={`${range.start}-${range.instrumental}`} range={range} tuning={tuning} time={clock} />
      : <div className="h-[110px] flex items-center justify-center text-gray-600">{t('melody.empty')}</div>}
  </div>;
}

function MelodyStrip({ range, tuning, time }: { range: MelodyRange; tuning: Tuning; time: number }) {
  const { instrumental } = range;
  const t = useT();
  const tab = useMemo(() => notesToTab(range.notes, tuning), [range.notes, tuning]);
  const viewport = useRef<HTMLDivElement>(null);
  const duration = Math.max(0.01, range.end - range.start);
  const width = instrumental ? Math.max(300, duration * 70, range.notes.length * 28) : 400;
  const gutter = instrumental ? 32 : 0;
  const x = (value: number) => gutter + Math.max(0, Math.min(1, (value - range.start) / duration)) * (width - gutter);
  const playhead = x(time);
  useLayoutEffect(() => {
    if (!instrumental || !viewport.current) return;
    const el = viewport.current;
    el.scrollLeft = Math.max(0, playhead - el.clientWidth * 0.35);
  }, [instrumental, playhead]);
  const current = tab.find(note => note.start <= time && note.end > time);
  const minPitch = Math.min(...range.notes.map(n => n.midi)) - 1;
  const maxPitch = Math.max(...range.notes.map(n => n.midi)) + 1;
  const height = 80;
  const y = (midi: number) => 8 + (maxPitch - midi) / (maxPitch - minPitch) * 60;
  const names = [t('melody.do'), t('melody.re'), t('melody.mi'), t('melody.fa'), t('melody.sol'), t('melody.la'), t('melody.si')];
  return <div>
    <div className="flex gap-2 h-4 overflow-hidden whitespace-nowrap">
      <span>{range.label || t(instrumental ? 'melody.instrumental' : 'melody.vocal')}</span>
      <span className="font-bold" aria-live="off">
        {current && <>{melodyNoteName(current.midi)} ({melodySolfege(current.midi, names)}){' '}
          {current.fret === null || current.stringIndex === null ? t('melody.unavailable')
            : t('melody.position', { string: tuning.strings.length - current.stringIndex, fret: current.fret })}</>}
      </span>
    </div>
    <div ref={viewport} className="overflow-x-auto overflow-y-hidden retro-scrollbar max-w-full">
      <svg role="img" aria-label={t(instrumental ? 'melody.instrumental' : 'melody.vocal')}
        viewBox={`0 0 ${width} ${height}`} style={{ width: instrumental ? width : '100%', height, display: 'block' }}>
        {instrumental ? tuning.strings.map((open, i) => {
          const row = 8 + (tuning.strings.length - 1 - i) * 64 / Math.max(1, tuning.strings.length - 1);
          return <g key={i}><line x1={28} x2={width} y1={row} y2={row} stroke="#98acd0" />
            <text x={0} y={row + 3} fontSize={9} fill="#002fa7">{melodyNoteName(open)}</text></g>;
        }) : Array.from({ length: maxPitch - minPitch + 1 }, (_, i) =>
          <line key={i} x1={0} x2={width} y1={y(minPitch + i)} y2={y(minPitch + i)} stroke="#dbe4ef" />)}
        {tab.map((note, i) => {
          const active = note.start <= time && note.end > time;
          const color = active ? '#c06000' : '#316ac5';
          if (instrumental) {
            const row = note.stringIndex === null ? 40 : 8 + (tuning.strings.length - 1 - note.stringIndex) * 64 / Math.max(1, tuning.strings.length - 1);
            return <g key={i}><rect x={x(note.start)} y={row - 7} width={20} height={14} fill={active ? '#fff0cc' : '#f5f8ff'} />
              <text x={x(note.start) + 2} y={row + 4} fontSize={12} fontWeight="bold" fill={color}>{note.fret ?? '?'}</text></g>;
          }
          return <rect key={i} x={x(note.start)} y={y(note.midi) - 3} width={Math.max(1, x(note.end) - x(note.start))} height={6} fill={color} />;
        })}
        <line x1={playhead} x2={playhead} y1={0} y2={height} stroke="#cc0000" strokeWidth={1.5} />
      </svg>
    </div>
  </div>;
}
