export interface ScrubBase {
  time: number;
  /** Pixels por segundo da faixa no começo do arraste. */
  scale: number;
  /** A tablatura anda com o dedo; na voz, que cabe inteira, quem anda é o cursor. */
  contentFollows: boolean;
}

export function scrubTime(base: ScrubBase, dx: number, total: number): number {
  if (!(base.scale > 0) || !Number.isFinite(dx)) return base.time;
  const delta = dx / base.scale * (base.contentFollows ? -1 : 1);
  return Math.max(0, Math.min(total, base.time + delta));
}
