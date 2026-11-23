import type { TimingMelody } from '../services/timingApi';

export interface MediaCut { start: number; end: number }

export function normalizeCuts(cuts: readonly MediaCut[]): MediaCut[] {
  const merged: MediaCut[] = [];
  for (const cut of cuts.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start)
    .sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && cut.start <= previous.end) previous.end = Math.max(previous.end, cut.end);
    else merged.push({ ...cut });
  }
  return merged;
}

export function mediaToDerived(t: number, cuts: readonly MediaCut[]): number {
  return t - cuts.reduce((sum, cut) => sum + Math.max(0, Math.min(t, cut.end) - cut.start), 0);
}

export function derivedToMedia(t: number, cuts: readonly MediaCut[]): number {
  let media = t;
  for (const cut of cuts) {
    if (media < cut.start) break;
    media += cut.end - cut.start;
  }
  return media;
}

// O iframe confirma seeks com atraso; segurar a posição evita repetir o salto a cada consulta.
export function createCutClock(cuts: readonly MediaCut[], seekMedia: (time: number) => void) {
  let pending: { target: number; until: number } | null = null;
  const seek = (time: number) => {
    const target = derivedToMedia(time, cuts);
    pending = cuts.length ? { target, until: performance.now() + 1500 } : null;
    seekMedia(target);
  };
  return {
    seek,
    sample(media: number, playing = true): number {
      if (pending) {
        if (media >= pending.target && media <= pending.target + 0.75) pending = null;
        else if (performance.now() < pending.until) return mediaToDerived(pending.target, cuts);
        else pending = null;
      }
      const cut = playing ? cuts.find(c => media >= c.start - 0.15 && media < c.end) : undefined;
      if (cut) {
        seek(mediaToDerived(cut.end, cuts));
        return mediaToDerived(cut.end, cuts);
      }
      return mediaToDerived(media, cuts);
    },
  };
}

// Pulsos dentro do corte deixam de soar e os restantes usam o relógio das frases.
export function cutBeatTimes(times: readonly number[], cuts: readonly MediaCut[]): number[] {
  return times.filter(time => !cuts.some(cut => time >= cut.start && time < cut.end))
    .map(time => mediaToDerived(time, cuts));
}

export function cutMelody(melody: TimingMelody, cuts: readonly MediaCut[]): TimingMelody {
  const merged = normalizeCuts(cuts);
  const shift = <T extends { start: number; end: number }>(entry: T): T => ({
    ...entry, start: mediaToDerived(entry.start, merged), end: mediaToDerived(entry.end, merged),
  });
  const survives = (entry: { start: number; end: number }) =>
    mediaToDerived(entry.end, merged) > mediaToDerived(entry.start, merged);
  // Notas que atravessam um corte conservam só o tempo audível, como as frases.
  return {
    version: 1,
    vocal: melody.vocal.filter(survives).map(shift),
    instrumental: melody.instrumental.filter(survives).map(section => ({
      ...shift(section), notes: section.notes.filter(survives).map(shift),
    })),
  };
}
