type PhraseStart = { startTime: number };

export type LineScrollAnchor = PhraseStart & { y: number };

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
