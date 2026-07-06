import { useMemo } from 'react';
import type { TimingRegion } from '../services/timingRegions';

export interface DerivedJump {
  fromRegionId: string;   // first region of the block that repeats (2nd occurrence)
  toRegionId: string;     // first region of the original block (1st occurrence)
  blockLength: number;    // how many regions the block covers (1 for a leftover isolated pair)
  originRegionIds: string[]; // full ordered id list of the 1st occurrence's regions (length === blockLength)
  repeatRegionIds: string[]; // full ordered id list of the repeat occurrence's regions (length === blockLength)
  // 0..1 — how close the two occurrences' durations are, averaged region-by-region across the
  // block. Purely exposed data: not used to decide anything here. A future score-compaction
  // consumer reads this to judge whether the two occurrences were sung/played near-identically
  // (close to 1 → safe to notate as one passage + repeat sign) or diverge enough in timing to
  // deserve their own transcription (close to 0). See computeDurationSimilarity() below for the
  // exact formula — do NOT add compaction logic here, that's a future, separate consumer.
  durationSimilarity: number;
}

const DEFAULT_MIN_BLOCK_SIZE = 3;

function regionDuration(r: TimingRegion): number {
  if (r.startTime == null || r.endTime == null) return 0;
  return r.endTime - r.startTime;
}

// Relative difference between an origin-occurrence duration `a` and a repeat-occurrence
// duration `b`, matching |b - a| / a — guarded against division by zero: two zero-length
// regions are identical (diff 0), a zero-length one paired with a non-zero one is maximally
// different (diff 1).
function relativeDurationDiff(a: number, b: number): number {
  if (a === 0) return b === 0 ? 0 : 1;
  return Math.abs(b - a) / a;
}

// Averages relativeDurationDiff across each paired region in the two same-length blocks, then
// converts to a 0..1 similarity (1 - avgDiff, clamped — a repeat that's 2x+ as long as the
// original would otherwise push the raw value negative).
function computeDurationSimilarity(originBlock: TimingRegion[], repeatBlock: TimingRegion[]): number {
  const k = originBlock.length;
  let sumDiff = 0;
  for (let i = 0; i < k; i++) {
    sumDiff += relativeDurationDiff(regionDuration(originBlock[i]), regionDuration(repeatBlock[i]));
  }
  const avgDiff = sumDiff / k;
  return Math.max(0, Math.min(1, 1 - avgDiff));
}

// Detects structural jumps automatically: once the Wizard 3 (line-link) has given a section
// region both a startLine and an endLine, the ordered-by-time sequence of (startLine,endLine)
// keys IS the song's structure. If a contiguous run of that sequence repeats verbatim somewhere
// later, that's a single structural repeat (a real D.C./D.S.-equivalent) — not one isolated
// coincidence per section. No manual Segno/Coda/to_coda/D.C./D.S. marking needed anymore; see
// useLoopSaltoWizardStore.ts's header for the full rationale.
//
// Revisão do Prompt N (Passo 2): block detection instead of per-key grouping. A groupBy on
// (startLine,endLine) alone drew one arc per repeated section, e.g. 14 parallel arcs for a
// contiguous 14-section repeat — this collapses that into ONE arc spanning the whole block.
// Whatever isn't swallowed by a block (below the size threshold) still falls back to the
// original simple per-key grouping, except it now also checks for a pre-existing manual Loop
// over that same range first — a hand-marked Loop already represents "this repeats here"; a
// derived jump arc on top of it would just be a duplicate signal for the same thing.
//
// Regions without both startLine and endLine (Wizard 3 hasn't linked them yet) are excluded from
// the sequence entirely — there's no line range to compare, so no way to tell if two sections
// are "the same passage."
export function useDerivedJumps(regions: TimingRegion[], minBlockSize = DEFAULT_MIN_BLOCK_SIZE): DerivedJump[] {
  return useMemo(() => {
    const linked = regions
      .filter(r => r.kind === 'section' && r.startLine != null && r.endLine != null)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

    const seq = linked.map(r => `${r.startLine}:${r.endLine}`);
    const covered = new Array(linked.length).fill(false);
    const jumps: DerivedJump[] = [];

    // 1. Repeatedly extract the single largest contiguous repeated block (size >= minBlockSize)
    // remaining in the sequence — one arc per block, not one per section inside it. Extracted
    // indices are marked `covered` so a later, unrelated match can't re-claim them, and a run
    // never extends across an already-covered index (see findLongestRun).
    for (;;) {
      const best = findLongestRun(seq, covered);
      if (!best || best.k < minBlockSize) break;
      const { i, j, k } = best;
      const originBlock = linked.slice(i, i + k);
      const repeatBlock = linked.slice(j, j + k);
      jumps.push({
        fromRegionId: linked[j].id,
        toRegionId: linked[i].id,
        blockLength: k,
        originRegionIds: originBlock.map(r => r.id),
        repeatRegionIds: repeatBlock.map(r => r.id),
        durationSimilarity: computeDurationSimilarity(originBlock, repeatBlock),
      });
      for (let t = 0; t < k; t++) {
        covered[i + t] = true;
        covered[j + t] = true;
      }
    }

    // 2. Leftovers: sections not swallowed by a block above (too short to qualify, e.g. an
    // isolated repeated pair) — same simple exact-key grouping as before, but skipped entirely
    // if a manual Loop region already covers that exact line range.
    const loopRegions = regions.filter(r => r.kind === 'loop' && r.startLine != null && r.endLine != null);
    const hasLoopOver = (startLine: number, endLine: number) =>
      loopRegions.some(l => l.startLine === startLine && l.endLine === endLine);

    const groups = new Map<string, TimingRegion[]>();
    linked.forEach((r, idx) => {
      if (covered[idx]) return;
      const arr = groups.get(seq[idx]) ?? [];
      arr.push(r);
      groups.set(seq[idx], arr);
    });

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [origin, ...rest] = group; // `linked` was pre-sorted by startTime, so this is chronological
      if (hasLoopOver(origin.startLine!, origin.endLine!)) continue;
      for (const occurrence of rest) {
        jumps.push({
          fromRegionId: occurrence.id,
          toRegionId: origin.id,
          blockLength: 1,
          originRegionIds: [origin.id],
          repeatRegionIds: [occurrence.id],
          durationSimilarity: computeDurationSimilarity([origin], [occurrence]),
        });
      }
    }

    return jumps;
  }, [regions, minBlockSize]);
}

// Given the id of one 'section' region belonging to a detected repeat (either the origin or a
// repeat occurrence), reconstructs the FULL set of occurrences of that block — not just the pair
// captured by a single DerivedJump. Needed because the leftover per-key grouping pass (see above)
// emits one DerivedJump per extra occurrence beyond the 2nd, all sharing the same originRegionIds
// — so a block repeated 3+ times shows up as multiple jumps here, which this reconstructs into
// one ordered (chronological) list of occurrences, each itself an ordered list of regions (length
// > 1 only for a block detected by the block-extraction pass above).
// Returns null if `regionId` isn't part of any detected repeat, or if fewer than 2 occurrences
// could be resolved (should not normally happen once at least one jump matched).
export function findLoopConversionOccurrences(
  regionId: string,
  regions: TimingRegion[],
  derivedJumps: DerivedJump[],
): TimingRegion[][] | null {
  const touching = derivedJumps.filter(j =>
    j.originRegionIds.includes(regionId) || j.repeatRegionIds.includes(regionId),
  );
  if (touching.length === 0) return null;

  const idListsByKey = new Map<string, string[]>();
  idListsByKey.set(touching[0].originRegionIds.join('|'), touching[0].originRegionIds);
  for (const j of touching) idListsByKey.set(j.repeatRegionIds.join('|'), j.repeatRegionIds);

  const occurrences: TimingRegion[][] = [];
  for (const ids of idListsByKey.values()) {
    const list = ids.map(id => regions.find(r => r.id === id)).filter((r): r is TimingRegion => !!r);
    if (list.length !== ids.length) return null; // a referenced region vanished — bail defensively
    occurrences.push(list);
  }
  occurrences.sort((a, b) => (a[0].startTime ?? 0) - (b[0].startTime ?? 0));
  return occurrences.length >= 2 ? occurrences : null;
}

// Finds the (i, j, k) triple — two non-overlapping runs of length k starting at i and j (i < j),
// with seq[i..i+k) === seq[j..j+k) — that maximizes k among positions not yet `covered`. A run
// stops extending the moment it would step onto an already-covered index, so a block already
// extracted can never be partially re-consumed by a later, overlapping match.
function findLongestRun(seq: string[], covered: boolean[]): { i: number; j: number; k: number } | null {
  const n = seq.length;
  let best: { i: number; j: number; k: number } | null = null;
  for (let i = 0; i < n; i++) {
    if (covered[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (covered[j]) continue;
      let k = 0;
      while (
        i + k < n && j + k < n &&
        !covered[i + k] && !covered[j + k] &&
        seq[i + k] === seq[j + k]
      ) {
        k++;
      }
      if (k > 0 && (!best || k > best.k)) best = { i, j, k };
    }
  }
  return best;
}
