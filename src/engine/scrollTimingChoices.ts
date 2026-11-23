import type { TimingContribution } from '../services/timingApi';
import type { LineType } from '../utils/lineClassifier';
import { buildCommunityCards } from './timingVariants';

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
    const derived = buildCommunityCards(timings, lineTypes).find(card => card.withoutTabs && card.timing.source === 'auto' && card.timing.id === auto.id);
    if (derived) choices.push({ id: 'auto-sem-dedilhado', kind: 'without-fingerpicking', timing: derived.timing });
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

export function chooseTrainingTiming(choices: readonly ScrollTimingChoice[], best: TimingContribution | null): ScrollTimingChoice | null {
  const synced = choices.filter(c => c.timing && (c.timing.phrases.length > 0 || c.timing.instrumentalSections.some(s =>
    s.startLine != null && s.endLine != null && s.mediaTimestampStart != null && s.mediaTimestampEnd != null)));
  const community = synced.filter(c => c.kind === 'manual');
  return community.find(c => c.timing?.id === best?.id)
    ?? [...community].sort((a, b) => Number(!!b.timing?.reviewed) - Number(!!a.timing?.reviewed)
      || (b.timing?.votes ?? 0) - (a.timing?.votes ?? 0))[0]
    ?? synced.find(c => c.id === 'auto-original') ?? null;
}
