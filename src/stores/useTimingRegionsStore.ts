import { create } from 'zustand';
import {
  legacyToRegions,
  regionsToLegacyPayload,
  makeRegionId,
  makeMarkerId,
  type TimingRegion,
  type TimingRegionPatch,
} from '../services/timingRegions';
import type { TimingContribution, TimingMarker, TimingSubmitPayload } from '../services/timingApi';

// StoredMarker wraps TimingMarker with a stable, deterministic id (same strategy as
// TimingRegion: djb2 hash over type+time via makeMarkerId). The id is assigned once
// at creation and never recalculated by updateMarker() — this guarantees that
// targetMarkerId references remain valid even when a marker's time is edited.
export interface StoredMarker extends TimingMarker { id: string; }

/** Patch allowed for updateMarker. `id` is excluded so it can never be overwritten
 *  by an edit — same invariant as TimingRegionPatch for regions. */
export type MarkerPatch = Partial<Omit<StoredMarker, 'id'>>;

export interface TimingRegionsState {
  regions: TimingRegion[];
  markers: StoredMarker[];

  // ── Load ───────────────────────────────────────────────────────────────────
  /** ONLY place where region IDs are (re)calculated. Replaces all local state
   *  from a fetched TimingContribution. */
  loadFromContribution(c: TimingContribution): void;

  // ── Region CRUD ────────────────────────────────────────────────────────────
  /** Appends a new region; id is derived from content via makeRegionId(). Returns the new id. */
  addRegion(region: Omit<TimingRegion, 'id'>): string;
  /** Merges patch into the region with the given id; id is never part of the patch (TimingRegionPatch). */
  updateRegion(id: string, patch: TimingRegionPatch): void;
  removeRegion(id: string): void;

  // ── Marker CRUD ────────────────────────────────────────────────────────────
  /** Appends a new marker; id is derived from type+time via makeMarkerId(). Returns the new id. */
  addMarker(marker: TimingMarker): string;
  /** Merges patch into the marker with the given id. The `id` field is excluded from
   *  MarkerPatch so it can never be overwritten — targetMarkerId references stay valid. */
  updateMarker(id: string, patch: MarkerPatch): void;
  removeMarker(id: string): void;

  // ── Serialization ──────────────────────────────────────────────────────────
  /** ONLY place where regionsToLegacyPayload() is called. Returns the legacy payload
   *  slice ready to merge into TimingSubmitPayload. */
  getSerializedPayload(): Pick<TimingSubmitPayload, 'phrases' | 'loops' | 'instrumentalSections' | 'sections'>;

  // ── Debug/portability snapshot (own format — NOT regionsToLegacyPayload) ──────
  /** Full regions+markers state as pretty-printed JSON — for debug and moving state
   *  between local sessions, not for the backend submit payload. `extra` merges in fields this
   *  store doesn't own (e.g. mediaUrl/bpm from usePlayerStore) — kept as a plain param instead of
   *  importing usePlayerStore here, since domain stores stay isolated from each other; the
   *  caller (TimingEditor) is what already orchestrates both. */
  exportSnapshot(extra?: Record<string, unknown>): string;
  /** Parses and validates `json`, then replaces regions/markers wholesale on success. Throws
   *  with a clear message on invalid JSON or an unexpected shape — never partially applies a
   *  malformed snapshot. Returns the full parsed object (regions/markers plus whatever other
   *  fields — e.g. mediaUrl — were exported alongside them) so the caller can restore those too. */
  importSnapshot(json: string): unknown;
}

// Minimal shape check for importSnapshot — enough to catch "wrong file"/"hand-edited into
// garbage" mistakes without becoming a full runtime schema validator. Deliberately loose on
// everything except the fields every region/marker must have to be usable at all.
const VALID_REGION_KINDS = new Set(['phrase', 'loop', 'instrumental', 'section']);

function assertValidSnapshot(data: unknown): asserts data is { regions: TimingRegion[]; markers: StoredMarker[] } {
  if (!data || typeof data !== 'object') {
    throw new Error('JSON inválido: esperado um objeto com "regions" e "markers".');
  }
  const { regions, markers } = data as Record<string, unknown>;
  if (!Array.isArray(regions) || !Array.isArray(markers)) {
    throw new Error('JSON inválido: "regions" e "markers" precisam ser arrays.');
  }
  regions.forEach((r, i) => {
    if (!r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string') {
      throw new Error(`regions[${i}] inválida: falta "id" (string).`);
    }
    if (!VALID_REGION_KINDS.has((r as { kind?: unknown }).kind as string)) {
      throw new Error(`regions[${i}] inválida: "kind" precisa ser um de ${[...VALID_REGION_KINDS].join(', ')}.`);
    }
  });
  markers.forEach((m, i) => {
    if (!m || typeof m !== 'object') {
      throw new Error(`markers[${i}] inválido: item não é um objeto.`);
    }
    const marker = m as Record<string, unknown>;
    if (typeof marker.id !== 'string') throw new Error(`markers[${i}] inválido: falta "id" (string).`);
    if (typeof marker.type !== 'string') throw new Error(`markers[${i}] inválido: falta "type" (string).`);
    if (typeof marker.time !== 'number') throw new Error(`markers[${i}] inválido: falta "time" (number).`);
  });
}

export const useTimingRegionsStore = create<TimingRegionsState>((set, get) => ({
    regions: [],
    markers: [],

    loadFromContribution: (c) => {
      set({
        regions: legacyToRegions(c),
        markers: (c.markers ?? []).map(m => ({ ...m, id: makeMarkerId(m.type, m.time) })),
      });
    },

    addRegion: (region) => {
      const id = makeRegionId(region);
      set(s => {
        if (s.regions.some(r => r.id === id)) {
          // ID collision (deterministic hash): upsert instead of push to prevent duplicate keys
          return { regions: s.regions.map(r => r.id === id ? { ...region, id } : r) };
        }
        return { regions: [...s.regions, { ...region, id }] };
      });
      return id;
    },

    updateRegion: (id, patch) => {
      set(s => ({ regions: s.regions.map(r => r.id === id ? { ...r, ...patch } : r) }));
    },

    removeRegion: (id) => {
      set(s => ({ regions: s.regions.filter(r => r.id !== id) }));
    },

    addMarker: (marker) => {
      const id = makeMarkerId(marker.type, marker.time);
      set(s => ({ markers: [...s.markers, { ...marker, id }] }));
      return id;
    },

    updateMarker: (id, patch) => {
      // Spread preserves the existing id — patch cannot contain 'id' (MarkerPatch excludes it)
      set(s => ({ markers: s.markers.map(m => m.id === id ? { ...m, ...patch } : m) }));
    },

    removeMarker: (id) => {
      set(s => ({ markers: s.markers.filter(m => m.id !== id) }));
    },

    getSerializedPayload: () => regionsToLegacyPayload(get().regions),

    exportSnapshot: (extra) => {
      const { regions, markers } = get();
      return JSON.stringify({ ...extra, regions, markers }, null, 2);
    },

    importSnapshot: (json) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('JSON inválido: não foi possível fazer parse do arquivo.');
      }
      assertValidSnapshot(parsed); // throws with a clear message on bad shape — no partial apply
      set({ regions: parsed.regions, markers: parsed.markers });
      return parsed;
    },
}));
