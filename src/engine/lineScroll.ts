import type { TimingPhrase } from '../services/timingApi';
import type { LineType } from '../utils/lineClassifier';

type PhraseStart = { startTime: number };

export type LineScrollAnchor = PhraseStart & { y: number };

export function withoutFingerpicking(
  phrases: readonly TimingPhrase[],
  lineTypes: readonly LineType[],
): { phrases: TimingPhrase[]; removedDuration: number } {
  const cuts: Array<{ start: number; end: number }> = [];
  const ordered = [...phrases].sort((a, b) => a.startTime - b.startTime);
  let previousLyric: TimingPhrase | undefined;
  for (const phrase of ordered) {
    const type = lineTypes[phrase.lineIndex];
    if (type === 'tab' && phrase.endTime > phrase.startTime) {
      cuts.push({ start: phrase.startTime, end: phrase.endTime });
    }
    if (type !== 'lyric') continue;
    if (previousLyric && previousLyric.endTime < phrase.startTime) {
      const first = Math.min(previousLyric.lineIndex, phrase.lineIndex);
      const last = Math.max(previousLyric.lineIndex, phrase.lineIndex);
      const between = lineTypes.slice(first + 1, last);
      if (between.length && between.every(line => line === 'tab')) {
        cuts.push({ start: previousLyric.endTime, end: phrase.startTime });
      }
    }
    previousLyric = phrase;
  }

  // Une intervalos porque o vão entre duas letras pode já conter frases de tab.
  const merged: typeof cuts = [];
  for (const cut of cuts.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && cut.start <= previous.end) previous.end = Math.max(previous.end, cut.end);
    else merged.push(cut);
  }
  const removedDuration = merged.reduce((total, cut) => total + (cut.end - cut.start), 0);
  const kept = phrases.filter(phrase => lineTypes[phrase.lineIndex] !== 'tab');
  return {
    removedDuration,
    phrases: kept.map(phrase => {
      const shift = merged.reduce((total, cut) =>
        total + Math.max(0, Math.min(cut.end, phrase.startTime) - cut.start), 0);
      return shift ? { ...phrase, startTime: phrase.startTime - shift, endTime: phrase.endTime - shift } : phrase;
    }),
  };
}

export function currentPhraseIndex(phrases: readonly PhraseStart[], t: number): number {
  let index = -1;
  for (let i = 0; i < phrases.length; i++) {
    // O início seguinte encerra a espera, inclusive quando há um trecho instrumental.
    if (phrases[i].startTime <= t && (index < 0 || phrases[i].startTime >= phrases[index].startTime)) {
      index = i;
    }
  }
  return index;
}

export function easeScrollY(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return to;
  const p = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return from + (to - from) * p * p * (3 - 2 * p);
}

export function stepYAtTime(anchors: readonly LineScrollAnchor[], t: number, transitionMs = 0): number {
  const index = currentPhraseIndex(anchors, t);
  if (index < 0) return 0;
  const { y, startTime } = anchors[index];
  const elapsedMs = (t - startTime) * 1000;
  if (elapsedMs >= transitionMs) return y;
  const earlier = anchors.filter(a => a.startTime < startTime);
  const previous = currentPhraseIndex(earlier, t);
  return easeScrollY(earlier[previous]?.y ?? 0, y, elapsedMs, transitionMs);
}

export function stepTimeAtY(anchors: readonly LineScrollAnchor[], y: number): number {
  let next: LineScrollAnchor | undefined;
  let last: LineScrollAnchor | undefined;
  for (const anchor of anchors) {
    // A primeira linha abaixo da guia é a que o músico poderá ler ao retomar.
    if (anchor.y >= y && (!next || anchor.y < next.y || (anchor.y === next.y && anchor.startTime < next.startTime))) {
      next = anchor;
    }
    if (!last || anchor.y > last.y || (anchor.y === last.y && anchor.startTime > last.startTime)) {
      last = anchor;
    }
  }
  return (next ?? last)?.startTime ?? 0;
}
