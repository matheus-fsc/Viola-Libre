import { chordIdentity } from '../engine/chordIdentity';
import { buildVoicingFromFrets } from '../engine/chordCalculator';
import type { Tuning, Voicing } from '../engine/types';
import { applyCurationOrder, buildChordId, pickCuratedVoicings, type ChordRankEntry } from './authApi';
import { pickPopularVoicings, type ChordFavoriteEntry } from './chordFavoritesApi';
import { frontShapesFor, type VoicingOrderMode } from './voicingOrder';

export interface ChordVoicingContext {
  chordNames: readonly string[];
  displayedVoicings: readonly Voicing[][];
  instrumentId: string;
  tuning: Tuning;
  songSlug?: string | null;
  rankings: Record<string, ChordRankEntry[]>;
  favorites: Record<string, ChordFavoriteEntry[]>;
  orderMode: VoicingOrderMode;
  variations: Record<string, number>;
  locked: Record<string, number>;
  custom: Record<string, number[]>;
}

/** Grade e transporte precisam resolver a mesma escolha, inclusive quando a grafia muda. */
export function displayedChordVoicing(name: string, context: ChordVoicingContext) {
  const exact = context.chordNames.indexOf(name);
  const identity = exact < 0 ? chordIdentity(name) : null;
  const index = exact >= 0 ? exact : context.chordNames.findIndex(chord => chordIdentity(chord) === identity);
  // As preferências pertencem ao nome da grade, nunca ao alias encontrado na letra.
  const chordName = context.chordNames[index] ?? name;
  const chordId = buildChordId(context.instrumentId, context.tuning.id, chordName);
  const favoriteEntries = context.favorites[chordId] ?? [];
  const curatedList = pickCuratedVoicings(context.rankings[chordId] ?? [], context.songSlug);
  const popularList = pickPopularVoicings(favoriteEntries, context.songSlug);
  const validShape = (frets: number[]) => frets.length === context.tuning.strings.length;
  const voicings = index < 0 ? [] : applyCurationOrder(
    (context.displayedVoicings[index] ?? []).filter(v => validShape(v.frets)),
    frontShapesFor(context.orderMode, popularList, curatedList).filter(validShape),
    frets => buildVoicingFromFrets(frets, context.tuning, false),
  );
  const rawIdx = context.variations[chordName] ?? 0;
  const effectiveIdx = (context.locked[chordName] ?? rawIdx) % Math.max(voicings.length, 1);
  const generatedVoicing = voicings[effectiveIdx] ?? null;
  const customFrets = context.custom[chordName];
  const bestVoicing = index >= 0 && customFrets && validShape(customFrets)
    ? buildVoicingFromFrets(customFrets, context.tuning, false) : generatedVoicing;
  return { chordId, favoriteEntries, curatedList, voicings, rawIdx, effectiveIdx, generatedVoicing, bestVoicing };
}
