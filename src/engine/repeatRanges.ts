import type { TimingLoop, TimingOccurrence, TimingPhrase } from '../services/timingApi';

export interface RepeatRange {
  startLine: number;
  endLine: number;
  count: number;
  occurrences: readonly TimingOccurrence[];
}

export function deriveRepeatRanges(phrases: readonly TimingPhrase[]): RepeatRange[] {
  const lastStart = new Map<number, number>();
  const ordered = [...phrases].sort((a, b) => a.startTime - b.startTime).filter(phrase => {
    if (lastStart.get(phrase.lineIndex) === phrase.startTime) return false;
    lastStart.set(phrase.lineIndex, phrase.startTime);
    return true;
  });

  // Pares seguidos no relógio podem pular linhas de acordes ou em branco na cifra.
  // Contar o par evita atribuir ao trecho inteiro uma passagem por apenas uma de suas linhas.
  type Pair = { startLine: number; endLine: number; positions: number[]; next?: Pair };
  const key = (start: number, end: number) => `${start}:${end}`;
  const pairs = new Map<string, Pair>();
  for (let i = 0; i < ordered.length - 1; i++) {
    const first = ordered[i];
    const second = ordered[i + 1];
    if (first.lineIndex >= second.lineIndex || first.startTime >= second.startTime) continue;
    const id = key(first.lineIndex, second.lineIndex);
    const pair = pairs.get(id) ?? { startLine: first.lineIndex, endLine: second.lineIndex, positions: [] };
    pair.positions.push(i);
    pairs.set(id, pair);
  }

  const joined = new Set<Pair>();
  for (const pair of pairs.values()) {
    if (pair.positions.length < 2) continue;
    const nextLine = ordered[pair.positions[0] + 2]?.lineIndex;
    if (nextLine === undefined) continue;
    const next = pairs.get(key(pair.endLine, nextLine));
    // Só funde os pares quando todas as passagens continuam pela mesma próxima linha.
    if (next?.positions.length === pair.positions.length &&
      pair.positions.every((position, pass) => next.positions[pass] === position + 1)) {
      pair.next = next;
      joined.add(next);
    }
  }
  const ranges: RepeatRange[] = [];
  for (const pair of pairs.values()) {
    if (pair.positions.length < 2 || joined.has(pair)) continue;
    let end = pair;
    while (end.next) end = end.next;
    const occurrences = pair.positions.map((position, pass) => ({
      startTime: ordered[position].startTime,
      endTime: ordered[end.positions[pass] + 1].endTime,
    }));
    ranges.push({ startLine: pair.startLine, endLine: end.endLine, count: occurrences.length, occurrences });
  }
  return ranges.sort((a, b) => a.startLine - b.startLine);
}

export function getRepeatRanges(loops: readonly TimingLoop[], phrases: readonly TimingPhrase[]): RepeatRange[] {
  if (loops.length === 0) return deriveRepeatRanges(phrases);
  let inferred: RepeatRange[] | undefined;
  return loops.flatMap(loop => {
    const { startLine, endLine, mediaTimestampStart, mediaTimestampEnd } = loop;
    const count = loop.occurrences?.length ?? loop.repeatCount;
    if (count < 2 || endLine < startLine) return [];
    let occurrences = loop.occurrences;
    if (!occurrences) {
      // As frases podem localizar as passagens de um loop salvo antes de existir occurrences.
      inferred ??= deriveRepeatRanges(phrases);
      const match = inferred.find(range => range.startLine === startLine && range.endLine === endLine)
        ?? inferred.find(range => range.startLine >= startLine && range.endLine <= endLine);
      occurrences = match?.occurrences.slice(0, count) ??
        (mediaTimestampStart != null && mediaTimestampEnd != null
          ? [{ startTime: mediaTimestampStart, endTime: mediaTimestampEnd }]
          : []);
    }
    return [{ startLine, endLine, count, occurrences }];
  });
}

export function repeatPassAtTime(ranges: readonly RepeatRange[], time: number): { pass: number; count: number } | null {
  for (const { occurrences, count } of ranges) {
    const index = occurrences.findIndex(({ startTime, endTime }) => time >= startTime && time < endTime);
    if (index !== -1) return { pass: index + 1, count };
  }
  return null;
}
