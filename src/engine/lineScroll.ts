import type { TimingInstrumental, TimingLoop, TimingPhrase } from '../services/timingApi';
import type { LineType } from '../utils/lineClassifier';

type PhraseStart = { startTime: number };

export type LineScrollAnchor = PhraseStart & { y: number };

export function withoutFingerpicking(
  phrases: readonly TimingPhrase[],
  lineTypes: readonly LineType[],
  loops?: readonly TimingLoop[],
  instrumentalSections?: readonly TimingInstrumental[],
): { phrases: TimingPhrase[]; removedDuration: number; loops?: TimingLoop[]; instrumentalSections?: TimingInstrumental[] } {
  const cuts: Array<{ start: number; end: number }> = [];
  const ordered = [...phrases].sort((a, b) => a.startTime - b.startTime);
  const seenLyricLines = new Set<number>();
  let previousLyric: TimingPhrase | undefined;
  for (const phrase of ordered) {
    const type = lineTypes[phrase.lineIndex];
    if (type === 'tab' && phrase.endTime > phrase.startTime) {
      cuts.push({ start: phrase.startTime, end: phrase.endTime });
    }
    if (type !== 'lyric') continue;
    // Na volta a uma letra já cantada, só os tempos explícitos de tab justificam cortar a pausa.
    if (previousLyric && previousLyric.endTime < phrase.startTime &&
      (phrase.lineIndex >= previousLyric.lineIndex || !seenLyricLines.has(phrase.lineIndex))) {
      const first = Math.min(previousLyric.lineIndex, phrase.lineIndex);
      const last = Math.max(previousLyric.lineIndex, phrase.lineIndex);
      const between = lineTypes.slice(first + 1, last);
      if (between.length && between.every(line => line === 'tab')) {
        cuts.push({ start: previousLyric.endTime, end: phrase.startTime });
      }
    }
    seenLyricLines.add(phrase.lineIndex);
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
  const shift = (time: number) => merged.reduce((total, cut) =>
    total + Math.max(0, Math.min(cut.end, time) - cut.start), 0);
  const shiftTime = (time: number) => time - shift(time);
  return {
    removedDuration,
    phrases: kept.map(phrase => {
      const offset = shift(phrase.startTime);
      return offset ? { ...phrase, startTime: phrase.startTime - offset, endTime: phrase.endTime - offset } : phrase;
    }),
    // O bloco instrumental também precisa acompanhar os cortes no relógio interno.
    ...(instrumentalSections && { instrumentalSections: instrumentalSections.map(section => ({
      ...section,
      mediaTimestampStart: section.mediaTimestampStart == null ? null : shiftTime(section.mediaTimestampStart),
      mediaTimestampEnd: section.mediaTimestampEnd == null ? null : shiftTime(section.mediaTimestampEnd),
    })) }),
    // O contador usa o mesmo relógio encurtado da rolagem, inclusive quando o corte cai no meio de uma passagem.
    ...(loops && { loops: loops.map(loop => ({
      ...loop,
      mediaTimestampStart: loop.mediaTimestampStart === null ? null : shiftTime(loop.mediaTimestampStart),
      mediaTimestampEnd: loop.mediaTimestampEnd === null ? null : shiftTime(loop.mediaTimestampEnd),
      ...(loop.occurrences && { occurrences: loop.occurrences.map(({ startTime, endTime }) => ({
        startTime: shiftTime(startTime),
        endTime: shiftTime(endTime),
      })) }),
    })) }),
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

export function stepTimeAtY(anchors: readonly LineScrollAnchor[], y: number, referenceTime?: number): number {
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
  let match = next ?? last;
  if (match && referenceTime !== undefined) {
    // A posição escolhe a linha, e o relógio distingue as passagens por ela.
    let distance = Math.abs(match.startTime - referenceTime);
    for (const anchor of anchors) {
      if (anchor.y !== match.y) continue;
      const candidate = Math.abs(anchor.startTime - referenceTime);
      if (candidate < distance || (candidate === distance && anchor.startTime < match.startTime)) {
        match = anchor;
        distance = candidate;
      }
    }
  }
  return match?.startTime ?? 0;
}
