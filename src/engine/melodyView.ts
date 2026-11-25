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

const WORDLESS_GAP = 1.5;

/** Canto sem letra (vocalise) não pertence a frase nenhuma; agrupa as notas próximas. */
function wordlessRanges(notes: readonly MelodyNote[], label: string): MelodyRange[] {
  const result: MelodyRange[] = [];
  let group: MelodyNote[] = [];
  const close = () => {
    if (group.length) result.push({ start: group[0].start, end: Math.max(...group.map(n => n.end)), notes: group, label, instrumental: false });
    group = [];
  };
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const last = group.at(-1);
    // Uma faixa longa demais fica ilegível na largura da tela.
    if (last && (note.start - last.end > WORDLESS_GAP || note.end - group[0].start > 8)) close();
    group.push(note);
  }
  close();
  return result;
}

/** Trechos das partes escolhidas, em ordem; a voz vira uma faixa por frase cantada ou vocalise. */
export function melodyRanges(melody: TimingMelody, phrases: readonly { lineIndex: number; startTime: number; endTime: number }[], view: MelodyView, wordlessLabel = ''): MelodyRange[] {
  const used = new Set<MelodyNote>();
  const vocal = !view.vocal ? [] : phrases.flatMap(phrase => {
    const notes = melody.vocal.filter(note => note.start < phrase.endTime && note.end > phrase.startTime
      && (note.lineIndex === undefined || note.lineIndex === phrase.lineIndex));
    notes.forEach(note => used.add(note));
    return notes.length ? [{ start: phrase.startTime, end: phrase.endTime, notes, instrumental: false }] : [];
  });
  const wordless = !view.vocal ? [] : wordlessRanges(melody.vocal.filter(note => !used.has(note)), wordlessLabel);
  const guitar = !view.guitar ? [] : melody.instrumental.filter(section => section.notes.length)
    .map(section => ({ start: section.start, end: section.end, notes: section.notes, label: section.label, instrumental: true }));
  return [...vocal, ...wordless, ...guitar].sort((a, b) => a.start - b.start);
}

/** Com as duas partes ligadas, a voz aparece enquanto soa e o violão volta nas pausas. */
export function melodyRangeAt(ranges: readonly MelodyRange[], time: number): MelodyRange | null {
  const active = ranges.filter(range => time >= range.start && time < range.end);
  return active.find(range => !range.instrumental) ?? active.at(-1) ?? null;
}
