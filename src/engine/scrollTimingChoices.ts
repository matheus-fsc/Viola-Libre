import type { TimingContribution } from '../services/timingApi';
import type { LineType } from '../utils/lineClassifier';
import { withoutFingerpicking } from './lineScroll';

export type ScrollTimingChoice =
  | { id: 'default'; kind: 'default'; timing: null }
  | { id: 'auto-original' | 'auto-sem-dedilhado'; kind: 'auto' | 'without-fingerpicking'; timing: TimingContribution }
  | { id: string; kind: 'manual'; timing: TimingContribution };

export const DEFAULT_SCROLL_TIMING: ScrollTimingChoice = { id: 'default', kind: 'default', timing: null };

export function buildScrollTimingChoices(
  timings: readonly TimingContribution[],
  lineTypes: readonly LineType[],
  bestTiming: TimingContribution | null,
  remembered: string | null,
): { choices: ScrollTimingChoice[]; selected: ScrollTimingChoice } {
  const choices: ScrollTimingChoice[] = [DEFAULT_SCROLL_TIMING];
  const auto = timings.find(timing => timing.source === 'auto' && timing.id === bestTiming?.id)
    ?? timings.find(timing => timing.source === 'auto');
  if (auto) {
    choices.push({ id: 'auto-original', kind: 'auto', timing: auto });
    const { phrases, removedDuration, loops = auto.loops } = withoutFingerpicking(auto.phrases, lineTypes, auto.loops);
    if (removedDuration > 0) {
      choices.push({
        id: 'auto-sem-dedilhado',
        kind: 'without-fingerpicking',
        timing: { ...auto, phrases, loops, duration: Math.max(0, auto.duration - removedDuration) },
      });
    }
  }
  for (const timing of timings) {
    // Contribuições anteriores ao campo source também são contribuições da comunidade.
    if (timing.source !== 'auto') choices.push({ id: timing.id, kind: 'manual', timing });
  }
  const availableBest = timings.find(timing => timing.id === bestTiming?.id) ?? timings[0];
  const selected = choices.find(choice => choice.id === remembered)
    ?? (availableBest && choices.find(choice => choice.kind !== 'without-fingerpicking' && choice.timing?.id === availableBest.id))
    ?? DEFAULT_SCROLL_TIMING;
  return { choices, selected };
}
