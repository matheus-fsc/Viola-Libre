import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { melodyNoteName, melodySolfege, notesToTab } from '../../engine/melody';
import type { Tuning } from '../../engine/types';
import type { MelodyNote, TimingContribution } from '../../services/timingApi';
import { useT } from '../../i18n';

type Range = { start: number; end: number; notes: readonly MelodyNote[]; label?: string };
type Slot = { element: HTMLDivElement; range: Range; instrumental: boolean };

export function SyncedMelody({ timing, tuning, contentRef, frameRef, time, layoutKey, showTabs }: {
  timing: TimingContribution;
  tuning: Tuning;
  contentRef: RefObject<HTMLDivElement | null>;
  frameRef: MutableRefObject<((time: number) => void) | null>;
  time: number;
  layoutKey: unknown;
  showTabs: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [frameTime, setFrameTime] = useState({ source: time, now: time });
  const clock = frameTime.source === time ? frameTime.now : time;
  useLayoutEffect(() => {
    frameRef.current = now => setFrameTime({ source: time, now });
    return () => { frameRef.current = null; };
  }, [frameRef, time]);
  useLayoutEffect(() => {
    const content = contentRef.current;
    const melody = timing.melody;
    if (!content || !melody) return;
    const created: Slot[] = [];
    const elements = new Map<HTMLElement, HTMLDivElement>();
    const add = (line: number | null | undefined, range: Range, instrumental: boolean) => {
      const fallbackLine = timing.phrases.find(p => p.startTime >= range.end)?.lineIndex
        ?? timing.phrases.at(-1)?.lineIndex;
      const anchorLine = line ?? fallbackLine;
      const row = anchorLine == null ? null : content.querySelector<HTMLElement>(`[data-timing-line="${anchorLine}"]:not(.cifra-line-blank)`)
        ?? [...content.querySelectorAll<HTMLElement>('[data-timing-tab-start]')].find(el =>
          Number(el.dataset.timingTabStart) <= anchorLine && Number(el.dataset.timingTabEnd) >= anchorLine);
      // Um trecho sem linha escrita usa a letra próxima para manter a melodia na área de leitura.
      const parent = row ?? content;
      let element = elements.get(parent);
      if (!element) {
        element = document.createElement('div');
        element.style.cssText = 'height:144px;width:100%;min-width:0;flex-basis:100%;white-space:normal';
        element.dataset.melodySlot = 'true';
        if (row) row.appendChild(element);
        else content.prepend(element);
        elements.set(parent, element);
      }
      created.push({ element, range, instrumental });
    };
    for (const phrase of timing.phrases) {
      const notes = melody.vocal.filter(note => note.start < phrase.endTime && note.end > phrase.startTime
        && (note.lineIndex === undefined || note.lineIndex === phrase.lineIndex));
      if (notes.length) add(phrase.lineIndex, { start: phrase.startTime, end: phrase.endTime, notes }, false);
    }
    for (const section of melody.instrumental) {
      if (!section.notes.length) continue;
      const linked = timing.instrumentalSections.find(s => s.mediaTimestampStart != null && s.mediaTimestampEnd != null
        && s.mediaTimestampStart <= section.start && s.mediaTimestampEnd > section.start);
      const structural = timing.sections.find(s => s.startTime <= section.start && s.endTime != null && s.endTime > section.start);
      add(linked?.startLine ?? structural?.startLine, section, true);
    }
    // Reservar as faixas uma vez mantém as âncoras de rolagem estáveis durante a troca de frase.
    setSlots(created);
    return () => { for (const element of elements.values()) element.remove(); };
  }, [timing, contentRef, layoutKey, showTabs]);
  return <>{slots.filter(slot => clock >= slot.range.start && clock < slot.range.end).map((slot, i) =>
    createPortal(<MelodyStrip range={slot.range} instrumental={slot.instrumental} tuning={tuning} time={clock} />, slot.element, String(i)))}</>;
}

function MelodyStrip({ range, instrumental, tuning, time }: { range: Range; instrumental: boolean; tuning: Tuning; time: number }) {
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
  return <div className="bevel-in bg-[#f5f8ff] border border-[#98acd0] px-1 py-0.5 text-[10px] text-[#002fa7] font-mono leading-tight my-1" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <div className="flex flex-wrap justify-between gap-x-2">
      <span>{range.label || t(instrumental ? 'melody.instrumental' : 'melody.vocal')}</span>
      <span>{t('melody.automatic')}</span>
    </div>
    <div className="h-7 overflow-hidden font-bold" aria-live="off">
      {current && <>{melodyNoteName(current.midi)} ({melodySolfege(current.midi, names)}){' '}
        {current.fret === null || current.stringIndex === null ? t('melody.unavailable')
          : t('melody.position', { string: tuning.strings.length - current.stringIndex, fret: current.fret })}</>}
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
