import type { TimingRegion } from '../../services/timingRegions';
import type { SectionType } from '../../services/timingApi';

export type ClipKind = 'loop' | 'instrumental' | 'phrase' | 'section';

export interface TimelineClip {
  kind: ClipKind;
  clipKey: string;    // unique React key — regionId for canonical, regionId-repeat-N for repeats
  regionId: string;   // stable region ID — same for all occurrences of the same loop
  start: number;
  end: number;
  label: string;
  color: string;
  openEnded?: boolean;  // section with endTime === null, rendered up to `duration`
  isRepeat?: boolean;   // true for repeat occurrences (not the canonical 1st appearance)
  repeatIndex?: number; // 0-based index within repeats[] — present only when isRepeat=true
}

const CLIP_COLORS: Record<'loop' | 'instrumental' | 'phrase', string> = {
  loop: '#60a5fa',
  instrumental: '#34d399',
  phrase: '#a78bfa',
};

const SECTION_COLORS: Record<SectionType, string> = {
  intro:        '#9ca3af',
  verse:        '#60a5fa',
  'pre-chorus': '#a78bfa',
  chorus:       '#fb923c',
  bridge:       '#2dd4bf',
  solo:         '#4ade80',
  instrumental: '#34d399',
  outro:        '#6b7280',
  coda:         '#f472b6',
  other:        '#facc15',
};

// Portuguese labels + display order for SectionType — shared by TimingEditor's own section-type
// metadata (which additionally carries itemClass/barColor for the sidebar) and by
// TimingTimeline's "Reclassificar como" clip menu, which only needs the plain label list.
export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  intro:        'Intro',
  verse:        'Verso',
  'pre-chorus': 'Pré-Refrão',
  chorus:       'Refrão',
  bridge:       'Ponte',
  solo:         'Solo',
  instrumental: 'Instrumental',
  outro:        'Final',
  coda:         'Coda',
  other:        'Outro',
};

export const SECTION_ORDER: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'solo', 'instrumental', 'outro', 'coda', 'other',
];

export function buildTracksFromRegions(
  regions: TimingRegion[],
  duration: number,
): Record<ClipKind, TimelineClip[]> {
  const loop: TimelineClip[] = [];
  const instrumental: TimelineClip[] = [];
  const phrase: TimelineClip[] = [];
  const section: TimelineClip[] = [];

  for (const r of regions) {
    switch (r.kind) {
      case 'loop':
        if (r.startTime != null && r.endTime != null) {
          // Canonical occurrence
          loop.push({ kind: 'loop', clipKey: r.id, regionId: r.id, start: r.startTime, end: r.endTime, label: r.label, color: CLIP_COLORS.loop });
          // Additional repeat occurrences — same regionId, distinct clipKey
          if (r.repeats) {
            r.repeats.forEach((rep, i) => {
              loop.push({
                kind: 'loop',
                clipKey: `${r.id}-repeat-${i}`,
                regionId: r.id,
                start: rep.startTime,
                end: rep.endTime,
                label: r.label,
                color: CLIP_COLORS.loop,
                isRepeat: true,
                repeatIndex: i,
              });
            });
          }
        }
        break;
      case 'instrumental':
        if (r.startTime != null && r.endTime != null)
          instrumental.push({ kind: 'instrumental', clipKey: r.id, regionId: r.id, start: r.startTime, end: r.endTime, label: r.label, color: CLIP_COLORS.instrumental });
        break;
      case 'phrase':
        if (r.startTime != null && r.endTime != null)
          phrase.push({ kind: 'phrase', clipKey: r.id, regionId: r.id, start: r.startTime, end: r.endTime, label: `L${(r.startLine ?? 0) + 1}`, color: CLIP_COLORS.phrase });
        break;
      case 'section':
        if (r.startTime != null)
          section.push({
            kind: 'section',
            clipKey: r.id,
            regionId: r.id,
            start: r.startTime,
            end: r.endTime ?? duration,
            label: r.label,
            color: SECTION_COLORS[r.sectionType!] ?? '#9ca3af',
            openEnded: r.endTime === null,
          });
        break;
    }
  }

  return { loop, instrumental, phrase, section };
}

// Same palette TimingTimeline uses for its clips — reused by CifraGridEditor's line-link
// margin indicator so a region's color is consistent wherever it's shown.
export function getRegionColor(r: Pick<TimingRegion, 'kind' | 'sectionType'>): string {
  if (r.kind === 'section') return SECTION_COLORS[r.sectionType!] ?? '#9ca3af';
  if (r.kind === 'loop' || r.kind === 'instrumental' || r.kind === 'phrase') return CLIP_COLORS[r.kind];
  return '#9ca3af';
}

export function xToTime(clientX: number, rect: DOMRect, duration: number): number {
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  return rect.width > 0 ? (x / rect.width) * duration : 0;
}

export function clampRange(start: number, end: number, duration: number, minDur = 0.2): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, duration));
  let e = Math.max(0, Math.min(end, duration));
  if (s > e) [s, e] = [e, s];
  if (e - s < minDur) {
    e = Math.min(duration, s + minDur);
    if (e - s < minDur) s = Math.max(0, e - minDur);
  }
  return { start: s, end: e };
}
