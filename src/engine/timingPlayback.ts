import { instrumentalScrollSegments } from './scrollTimeline';
import type { MediaType, TimingContribution } from '../services/timingApi';
import type { TimingRegion } from '../services/timingRegions';

export function playbackStartTime(currentTime: number, audioStart: number | null | undefined, mediaType: MediaType, explicitSeek = false): number {
  // Só a partida no zero pula o silêncio; seeks e retomadas preservam a escolha do músico.
  return !explicitSeek && currentTime === 0 && (mediaType === 'audio' || mediaType === 'youtube')
    && audioStart != null && Number.isFinite(audioStart) && audioStart > 0 ? audioStart : currentTime;
}

export function isLineInRange(line: string, index: number, range: { startLine: number | null; endLine: number | null } | null): boolean {
  return !!line.trim() && range?.startLine != null && range.endLine != null
    && index >= range.startLine && index <= range.endLine;
}

export function activePlaybackRegion(regions: readonly TimingRegion[], time: number): TimingRegion | null {
  const active = regions.filter(region => (region.kind === 'phrase' || region.kind === 'instrumental')
    && ((region.kind === 'instrumental' && region.startLine === null && region.endLine === null)
      || (region.startLine != null && region.endLine != null && region.endLine >= region.startLine))
    && region.startTime != null && region.endTime != null
    && time >= region.startTime && time < region.endTime);
  // O bloco instrumental explícito prevalece sobre frases antigas que ainda cubram o mesmo tempo.
  return active.find(region => region.kind === 'instrumental')
    ?? active.sort((a, b) => b.startTime! - a.startTime!)[0] ?? null;
}

export function playbackLineRanges(timing: Pick<TimingContribution, 'phrases' | 'instrumentalSections'>) {
  const ranges = [
    ...timing.phrases.map(phrase => ({
      lineIndex: phrase.lineIndex, endLine: phrase.lineIndex,
      startTime: phrase.startTime, endTime: phrase.endTime, instrumental: false,
    })),
    ...instrumentalScrollSegments(timing),
  ];
  // Payloads antigos podem conter frases de acordes dentro do bloco, sem dividir sua duração.
  return ranges.filter(range => range.instrumental || !ranges.some(section => section.instrumental
    && range.startTime >= section.startTime && range.startTime < section.endTime))
    .sort((a, b) => a.startTime - b.startTime || Number(a.instrumental) - Number(b.instrumental));
}
