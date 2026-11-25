import type { MelodyNote, TimingMelody } from '../services/timingApi';

export interface MelodyView { vocal: boolean; guitar: boolean }
export interface MelodyRange { start: number; end: number; notes: readonly MelodyNote[]; label?: string; instrumental: boolean }

export const MELODY_VIEW_KEY = 'viola_melody_view';

export function parseMelodyView(stored: string | null, legacy: string | null): MelodyView {
  try {
    const value: unknown = JSON.parse(stored ?? 'null');
    if (value && typeof value === 'object') {
      const { vocal, guitar } = value as Record<string, unknown>;
      return { vocal: vocal === true, guitar: guitar === true };
    }
  } catch { /* Valor corrompido volta ao padrão. */ }
  // Quem já usava o botão único continua vendo as duas partes.
  return { vocal: legacy === 'true', guitar: legacy === 'true' };
}

export function readMelodyView(): MelodyView {
  try { return parseMelodyView(localStorage.getItem(MELODY_VIEW_KEY), localStorage.getItem('viola_synced_melody')); }
  catch { return { vocal: false, guitar: false }; }
}

/** Trechos das partes escolhidas, em ordem; a voz vira uma faixa por frase cantada. */
export function melodyRanges(melody: TimingMelody, phrases: readonly { lineIndex: number; startTime: number; endTime: number }[], view: MelodyView): MelodyRange[] {
  const vocal = !view.vocal ? [] : phrases.flatMap(phrase => {
    const notes = melody.vocal.filter(note => note.start < phrase.endTime && note.end > phrase.startTime
      && (note.lineIndex === undefined || note.lineIndex === phrase.lineIndex));
    return notes.length ? [{ start: phrase.startTime, end: phrase.endTime, notes, instrumental: false }] : [];
  });
  const guitar = !view.guitar ? [] : melody.instrumental.filter(section => section.notes.length)
    .map(section => ({ start: section.start, end: section.end, notes: section.notes, label: section.label, instrumental: true }));
  return [...vocal, ...guitar].sort((a, b) => a.start - b.start);
}

export function melodyRangeAt(ranges: readonly MelodyRange[], time: number): MelodyRange | null {
  return ranges.filter(range => time >= range.start && time < range.end).at(-1) ?? null;
}
