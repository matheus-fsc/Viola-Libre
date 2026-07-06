import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  submitTiming, fetchTimings, voteTiming, getOrCreateEditorHash,
  extractYouTubeId, formatSeconds,
  type TimingContribution, type SectionType, type MarkerType, type MediaType,
} from '../services/timingApi';
import type { TimingRegion } from '../services/timingRegions';
import type { StoredMarker } from '../stores/useTimingRegionsStore';
import { TimingTimeline } from './timing/TimingTimeline';
import { type ClipKind } from './timing/timingTracks';
import { CifraGridEditor } from './timing/CifraGridEditor';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useCifraTextStore } from '../stores/useCifraTextStore';
import { useTimingRegionsStore } from '../stores/useTimingRegionsStore';
import { useTimingSelectionStore } from '../stores/useTimingSelectionStore';
import { useAssistedModeStore } from '../stores/useAssistedModeStore';
import { AssistedModeOverlay } from './timing/assisted/AssistedModeOverlay';
import { useLoopSaltoWizardStore } from '../stores/useLoopSaltoWizardStore';
import { LoopSaltoWizardOverlay } from './timing/assisted/LoopSaltoWizardOverlay';
import { useLineLinkWizardStore } from '../stores/useLineLinkWizardStore';
import { LineLinkWizardOverlay } from './timing/assisted/LineLinkWizardOverlay';
import { AutoScrollPreview } from './timing/AutoScrollPreview';

// YT IFrame API — only the Window extension stays here; YTPlayerInstance lives in usePlayerStore
interface YTPlayerOptions {
  videoId: string;
  height: string | number;
  width: string | number;
  events?: { onReady?: () => void };
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => ReturnType<typeof Object> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const INSTR_RE = /\b(interlude|interlúdio|interludio|solo|ponte|bridge|instrumental|intro|introdução|introducao|finalização)\b/i;
const SECTION_LINE_RE = /^\[([^\]]+)\]$/;

// Section type metadata — ptLabel is Portuguese display name, barColor is for the timeline
const SECTION_TYPE_META: Record<SectionType, { ptLabel: string; itemClass: string; barColor: string }> = {
  intro:          { ptLabel: 'Introdução',  itemClass: 'bg-gray-100 text-gray-700 border-gray-300',          barColor: '#9ca3af' },
  verse:          { ptLabel: 'Verso',       itemClass: 'bg-blue-50 text-blue-700 border-blue-300',           barColor: '#60a5fa' },
  'pre-chorus':   { ptLabel: 'Pré-Refrão', itemClass: 'bg-purple-50 text-purple-700 border-purple-300',     barColor: '#a78bfa' },
  chorus:         { ptLabel: 'Refrão',      itemClass: 'bg-orange-50 text-orange-700 border-orange-300',     barColor: '#fb923c' },
  bridge:         { ptLabel: 'Ponte',       itemClass: 'bg-teal-50 text-teal-700 border-teal-300',           barColor: '#2dd4bf' },
  solo:           { ptLabel: 'Solo',        itemClass: 'bg-green-50 text-green-700 border-green-300',        barColor: '#4ade80' },
  instrumental:   { ptLabel: 'Instrumental',itemClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',  barColor: '#34d399' },
  outro:          { ptLabel: 'Final',       itemClass: 'bg-gray-200 text-gray-800 border-gray-400',          barColor: '#6b7280' },
  coda:           { ptLabel: 'Coda',        itemClass: 'bg-pink-50 text-pink-700 border-pink-300',           barColor: '#f472b6' },
  other:          { ptLabel: 'Outro',       itemClass: 'bg-yellow-50 text-yellow-700 border-yellow-300',     barColor: '#facc15' },
};

const SECTION_ORDER: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'solo', 'instrumental', 'outro', 'coda', 'other',
];

// Notation marker metadata — symbol shown in UI, plain-Portuguese description for cifra users
const MARKER_META: Record<MarkerType, {
  symbol: string;
  name: string;
  description: string;
  pinColor: string;
}> = {
  segno:          { symbol: '𝄋', name: 'Segno',          pinColor: '#7c3aed', description: 'Ponto de referência — a música volta para cá quando indicado por "D.S."' },
  coda:           { symbol: '𝄉', name: 'Coda',            pinColor: '#0f766e', description: 'Início do trecho final alternativo — a música pula para cá quando indicado "al Coda"' },
  fine:           { symbol: 'Fine', name: 'Fine',         pinColor: '#b91c1c', description: 'Fim real da música — a música termina aqui quando retorna via D.C. ou D.S.' },
  fermata:        { symbol: '𝄐', name: 'Fermata',         pinColor: '#1d4ed8', description: 'Nota sustentada — o músico segura essa nota mais tempo do que o ritmo indicaria' },
  d_c_al_coda:   { symbol: 'D.C.', name: 'D.C. al Coda', pinColor: '#c2410c', description: 'Da Capo al Coda — volta ao início da música, toca até encontrar "al Coda" e então pula para 𝄉' },
  d_s_al_coda:   { symbol: 'D.S.', name: 'D.S. al Coda', pinColor: '#c2410c', description: 'Dal Segno al Coda — volta ao 𝄋, toca até encontrar "al Coda" e então pula para 𝄉' },
  d_c_al_fine:   { symbol: 'D.C.', name: 'D.C. al Fine', pinColor: '#a16207', description: 'Da Capo al Fine — volta ao início da música e toca até o marcador "Fine"' },
  d_s_al_fine:   { symbol: 'D.S.', name: 'D.S. al Fine', pinColor: '#a16207', description: 'Dal Segno al Fine — volta ao 𝄋 e toca até o marcador "Fine"' },
  first_ending:  { symbol: '[1.', name: '1ª Casa',        pinColor: '#065f46', description: '1ª Casa (1st ending) — trecho tocado apenas na primeira passagem; na repetição é substituído pela 2ª Casa' },
  second_ending: { symbol: '[2.', name: '2ª Casa',        pinColor: '#065f46', description: '2ª Casa (2nd ending) — trecho alternativo tocado a partir da segunda passagem, substituindo a 1ª Casa' },
  to_coda:       { symbol: 'al 𝄉', name: 'To Coda',       pinColor: '#0f766e', description: 'Ponto exato de onde a música salta para a Coda (𝄉) após o retorno' },
};

// MARKER_META and LINK_TARGET_TYPE below still cover every MarkerType — old data (and the
// "⇢ vincular destino" affordance on already-existing legacy markers) must keep working. There is
// no creation path left for ANY marker type anymore: segno/coda/to_coda/D.C./D.S./fine never had
// one beyond the old manual grid (already removed), and fermata/first_ending/second_ending lost
// their last one (the Wizard 1 ask-next chips) too — see useAssistedModeStore.ts's header.
// Structural repeats/song-end are still detected automatically (useDerivedJumps, finish()'s
// auto-Fine); everything under "Marcadores de Partitura" is now purely read/edit of existing data.

// Which marker types require a targetMarkerId pointing to another marker.
// D.C. variants are intentionally absent — their target is always time=0 (implicit).
const LINK_TARGET_TYPE: Partial<Record<MarkerType, MarkerType>> = {
  to_coda:     'coda',
  d_s_al_coda: 'segno',
  d_s_al_fine: 'segno',
};

function getAutoLabel(type: SectionType, regions: { kind: string; sectionType?: SectionType }[]): string {
  const { ptLabel } = SECTION_TYPE_META[type];
  const count = regions.filter(r => r.kind === 'section' && r.sectionType === type).length;
  return count === 0 ? ptLabel : `${ptLabel} ${count + 1}`;
}

function parseTimeString(str: string): number {
  const parts = str.trim().split(':');
  if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseFloat(parts[1]) || 0);
  return parseFloat(str) || 0;
}

type EditorMode = 'editing' | 'testing' | 'submitting' | 'done';

interface TimingEditorProps {
  slug: string;
  lines: string[];
  onPreviewTiming: (timing: TimingContribution | null) => void;
}

export const TimingEditor: React.FC<TimingEditorProps> = ({ slug, lines, onPreviewTiming }) => {
  const [mode, setMode] = useState<EditorMode>('editing');
  const [activeTab, setActiveTab] = useState<'editor' | 'community'>('editor');

  // Player state — lives in usePlayerStore
  const {
    mediaUrlInput, mediaUrl, mediaType, playerReady, currentTime: playerCurrentTime,
    duration, durationInput, bpm, isPlaying,
    setMediaUrlInput, loadMedia, setDurationInput, commitDuration, setBpm, registerTap,
    previewRange,
    setPlayerReady, registerYtPlayer, clearYtPlayer, registerAudio, loadContribution,
  } = usePlayerStore();

  // Metadata
  const [editorAlias, setEditorAlias] = useState<string>('');

  // Regions + markers — source of truth in the store
  const { regions, markers } = useTimingRegionsStore();

  // Timed sections (new — timestamp-based, for sheet-music structure)
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [sectionFormType, setSectionFormType] = useState<SectionType>('intro');
  const [sectionFormLabel, setSectionFormLabel] = useState('Introdução');
  const [sectionFormStart, setSectionFormStart] = useState('');
  const [sectionFormEnd, setSectionFormEnd] = useState('');


  // Line selection — reactive state lives in the store, shared with CifraGridEditor
  const {
    selectionMode, selectionStart, selectionEnd,
    setSelectionStart, setSelectionEnd,
  } = useTimingSelectionStore();

  const {
    error: assistedModeError,
    active: wizardActive,
    mode: wizardMode,
    phase: wizardPhase,
    pendingSectionType: wizardSectionType,
    history: wizardHistory,
    lineCursor: wizardLineCursor,
    lyricLineIndices: wizardLyricLineIndices,
  } = useAssistedModeStore();

  // True when a wizard session is paused (pauseForManualEdit) and can be resumed.
  const hasPausedSession = wizardMode !== null && !wizardActive;

  // Cifra text edit mode
  const [editingCifraText, setEditingCifraText] = useState(false);
  const [editTextValue, setEditTextValue] = useState('');

  // Auto-scroll preview — tests scroll against useTimingRegionsStore's in-memory regions
  // (nothing needs to be saved first). Independent from mode==='testing' (handleUseContribution,
  // Community tab), which previews the real CifraViewer's separate DOM/chord-density heuristic.
  const [testingScroll, setTestingScroll] = useState(false);

  // Reassign-lines flow — lifted up from CifraGridEditor so both its line-link margin popup
  // and the "Trechos vinculados" sidebar list below trigger the exact same in-progress state
  // (a single source of truth; neither place caches its own copy).
  const [reassigningRegionId, setReassigningRegionId] = useState<string | null>(null);

  // Submit
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [durError, setDurError] = useState<string | null>(null);
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Community
  const [contributions, setContributions] = useState<TimingContribution[]>([]);
  const [loadingContribs, setLoadingContribs] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  // DOM refs — only elements that must be kept in the component
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Marker link selector — opened after creating a linkable marker or clicking one in the timeline
  const [pendingLinkSource, setPendingLinkSource] = useState<string | null>(null);
  const [linkCandidates, setLinkCandidates] = useState<StoredMarker[]>([]);

  // Lines from store — synced from prop; chord drag mutations go through useCifraTextStore
  const { lines: editedLines } = useCifraTextStore();
  useEffect(() => { useCifraTextStore.getState().setLines(lines); }, [lines]);

  // Section header line indices (for wizard structural-pass scroll)
  const sectionLineIndices = useMemo(
    () => editedLines.reduce<number[]>((acc, line, idx) => {
      if (SECTION_LINE_RE.test(line.trim())) acc.push(idx);
      return acc;
    }, []),
    [editedLines]
  );

  // Refs that survive re-renders — track structural scroll position across commits
  const lastScrolledSectionRef = useRef(-1);
  const processedWizardHistoryLen = useRef(0);

  // ── Space bar — global play/pause shortcut ──────────────────────────────────
  // Was previously piggybacked on a ref set by the (now-removed) phrase-sequencer's own space
  // handling — removing that feature during the chip-palette cleanup took this down with it as
  // an unintended side effect. Restored as its own window-level listener, independent of focus on
  // any specific element, guarded so it doesn't fire while typing in a text field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      e.preventDefault();
      const pStore = usePlayerStore.getState();
      if (pStore.isPlaying) pStore.pause(); else pStore.play();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── YouTube player ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType !== 'youtube' || !mediaUrl) return;
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) return;

    clearYtPlayer();

    const createPlayer = () => {
      if (!ytContainerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player: any = new window.YT!.Player(ytContainerRef.current, {
        videoId,
        height: 180,
        width: '100%',
        events: {
          onReady: () => {
            registerYtPlayer(player);
            const dur = Math.round(player.getDuration());
            setPlayerReady(true, dur > 0 ? dur : undefined);
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => { clearYtPlayer(); };
  }, [mediaUrl, mediaType]);

  // ── Audio polling (tick delegated to store) ────────────────────────────────
  useEffect(() => {
    if (mediaType !== 'audio') return;
    const audio = audioRef.current;
    if (!audio) return;
    registerAudio(audio);
    const id = setInterval(() => {
      if (audio.paused) return;
      usePlayerStore.getState().tick(audio.currentTime);
    }, 250);
    return () => { clearInterval(id); registerAudio(null); };
  }, [mediaType, mediaUrl]);

  // ── Community ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'community' || communityLoaded) return;
    setLoadingContribs(true);
    fetchTimings(slug)
      .then(data => { setContributions(data); setCommunityLoaded(true); })
      .catch(() => setCommunityLoaded(true))
      .finally(() => setLoadingContribs(false));
  }, [activeTab, communityLoaded, slug]);

  // Keep the active lyric line visible while sequentially syncing (karaoke-style auto-advance)
  useEffect(() => {
    if (!selectionMode || selectionStart === null) return;
    lineRefs.current[selectionStart]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selectionMode, selectionStart]);

  // Reset structural scroll state when a new structural pass starts
  useEffect(() => {
    if (wizardMode === 'structural') {
      lastScrolledSectionRef.current = -1;
      processedWizardHistoryLen.current = 0;
    }
  }, [wizardMode]);

  // Structural pass: after committing intro/verse, scroll to the next section header
  useEffect(() => {
    if (wizardMode !== 'structural' || wizardPhase !== 'ask-next') return;
    if (wizardSectionType !== 'intro' && wizardSectionType !== 'verse') return;
    if (wizardHistory.length <= processedWizardHistoryLen.current) return;
    processedWizardHistoryLen.current = wizardHistory.length;
    const nextLine = sectionLineIndices.find(idx => idx > lastScrolledSectionRef.current);
    if (nextLine !== undefined) {
      lastScrolledSectionRef.current = nextLine;
      lineRefs.current[nextLine]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [wizardMode, wizardPhase, wizardSectionType, wizardHistory, sectionLineIndices]);

  // Line pass: keep the current lyric phrase visible as the cursor advances
  useEffect(() => {
    if (wizardMode !== 'line' || wizardLineCursor === null || !wizardLyricLineIndices) return;
    const entry = wizardLyricLineIndices[wizardLineCursor];
    if (!entry) return;
    lineRefs.current[entry.startLine]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [wizardMode, wizardLineCursor, wizardLyricLineIndices]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Debug/portability snapshot — own format (regions + markers), not the backend payload.
  // Also carries mediaUrl/mediaType/duration/bpm — without them, reimporting a snapshot would
  // leave the player pointing at nothing and force re-pasting the media link every time.
  // useTimingRegionsStore doesn't know about usePlayerStore (domain stores stay isolated from
  // each other — see useTimingRegionsStore.ts) so this component is what combines the two,
  // same as handleEditMyContribution already does below.
  const handleExportSnapshot = () => {
    const ps = usePlayerStore.getState();
    const json = useTimingRegionsStore.getState().exportSnapshot({
      mediaUrl: ps.mediaUrl,
      mediaType: ps.mediaType,
      duration: ps.duration,
      bpm: ps.bpm,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viola-timing-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting the same file later still fires onChange
    if (!file) return;
    if (!confirm('Isso substitui todas as regions e markers atuais pelo conteúdo do arquivo. Continuar?')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = useTimingRegionsStore.getState().importSnapshot(String(reader.result));
        const extra = data as Record<string, unknown>;
        const validMediaTypes: MediaType[] = ['youtube', 'audio', 'other', null];
        loadContribution({
          bpm: typeof extra.bpm === 'number' ? extra.bpm : null,
          duration: typeof extra.duration === 'number' ? extra.duration : 0,
          mediaUrl: typeof extra.mediaUrl === 'string' ? extra.mediaUrl : undefined,
          mediaType: validMediaTypes.includes(extra.mediaType as MediaType) ? (extra.mediaType as MediaType) : undefined,
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao importar o arquivo.');
      }
    };
    reader.readAsText(file);
  };

  // Reassign-lines flow — used both by CifraGridEditor's line-link margin popup ("Reatribuir
  // linhas") and by the "Trechos vinculados" sidebar list's "Revincular" button below. Reuses
  // the same line-range selection mechanism as everywhere else (useTimingSelectionStore) — the
  // drag/click gesture itself is untouched, only which region the confirmed range gets written
  // to changes.
  const startReassignLines = useCallback((region: TimingRegion) => {
    const selStore = useTimingSelectionStore.getState();
    selStore.clearGesture();
    selStore.setSelectionMode('reassign-region-lines');
    setReassigningRegionId(region.id);
  }, []);

  const confirmReassignLines = useCallback(() => {
    if (!reassigningRegionId || selectionStart === null || selectionEnd === null) return;
    useTimingRegionsStore.getState().updateRegion(reassigningRegionId, {
      startLine: Math.min(selectionStart, selectionEnd),
      endLine: Math.max(selectionStart, selectionEnd),
    });
    useTimingSelectionStore.getState().clearGesture();
    setReassigningRegionId(null);
  }, [reassigningRegionId, selectionStart, selectionEnd]);

  const cancelReassignLines = useCallback(() => {
    useTimingSelectionStore.getState().clearGesture();
    setReassigningRegionId(null);
  }, []);

  const handleAddSection = () => {
    const label = sectionFormLabel.trim() || SECTION_TYPE_META[sectionFormType].ptLabel;
    const startRaw = sectionFormStart.trim();
    const endRaw = sectionFormEnd.trim();
    const startTime = startRaw ? parseTimeString(startRaw) : usePlayerStore.getState().currentTime;
    const endTime = endRaw ? parseTimeString(endRaw) : null;
    useTimingRegionsStore.getState().addRegion({
      kind: 'section', startLine: null, endLine: null,
      startTime, endTime, label, sectionType: sectionFormType,
    });
    // Chain: next section's start = this section's end
    setSectionFormStart(endRaw);
    setSectionFormEnd('');
    // Auto-increment label for same type
    const n = regions.filter(r => r.kind === 'section' && r.sectionType === sectionFormType).length + 2;
    setSectionFormLabel(`${SECTION_TYPE_META[sectionFormType].ptLabel} ${n}`);
  };

  // After creating a linkable marker, auto-link if 1 candidate exists, else open selector.
  // NOTE: with segno/coda/to_coda/d_c_*/d_s_* removed from the manual creation grid and the drag
  // palette, no reachable creation path passes a `type` that LINK_TARGET_TYPE recognizes anymore —
  // this stays defined (and correct) purely so the "⇢ vincular destino" affordance keeps working on
  // already-existing legacy markers loaded from old contributions/snapshots.
  const maybePromptLink = (newId: string, type: MarkerType) => {
    const targetType = LINK_TARGET_TYPE[type];
    if (!targetType) return;
    const candidates = useTimingRegionsStore.getState().markers.filter(m => m.id !== newId && m.type === targetType);
    if (candidates.length === 1) {
      useTimingRegionsStore.getState().updateMarker(newId, { targetMarkerId: candidates[0].id });
    } else if (candidates.length > 1) {
      setPendingLinkSource(newId);
      setLinkCandidates(candidates);
    }
  };

  // Called from TimingTimeline when user clicks a linkable marker pin to (re)assign its target.
  const handleMarkerClick = (markerId: string) => {
    const mk = useTimingRegionsStore.getState().markers.find(m => m.id === markerId);
    if (!mk) return;
    const targetType = LINK_TARGET_TYPE[mk.type];
    if (!targetType) return;
    const candidates = useTimingRegionsStore.getState().markers.filter(m => m.id !== markerId && m.type === targetType);
    if (candidates.length === 0) return;
    setPendingLinkSource(markerId);
    setLinkCandidates(candidates);
  };

  // Line click — used by Wizard 3's line-linking and the "Reatribuir/Revincular linhas" flow
  // (both drive selectionMode themselves: 'section-link' / 'reassign-region-lines'). The old
  // 'phrase'/'loop'/'instrumental' manual-selection branch was removed along with the chip
  // palette and the phrase sequencer — those selectionMode values are never set anymore.
  const handleLineClick = (idx: number) => {
    if (!selectionMode) return;
    if (selectionStart === null) {
      setSelectionStart(idx);
      setSelectionEnd(null);
      return;
    }
    if (selectionEnd !== null) return;
    if (idx < selectionStart) { setSelectionStart(idx); return; }
    setSelectionEnd(idx);
  };

  // ── Timeline range editing (drag-to-create the "+Novo Trecho" form's start/end) ───────────
  const handleTimelineCreateRange = (kind: ClipKind, start: number, end: number) => {
    if (kind !== 'section') return; // only 'section' creationKind is offered now (see below)
    setSectionFormStart(formatSeconds(start));
    setSectionFormEnd(formatSeconds(end));
  };

  const handleStopTest = () => {
    onPreviewTiming(null);
    setMode('editing');
  };

  const handleSubmit = async () => {
    const ps = usePlayerStore.getState();
    if (!ps.duration || ps.duration <= 0) { setDurError('Duração obrigatória'); return; }
    setDurError(null);
    setMode('submitting');
    setSubmitError(null);
    try {
      const rs = useTimingRegionsStore.getState();
      const payload = rs.getSerializedPayload();
      // Strip store-local fields (id, targetMarkerId) — backend doesn't accept them yet.
    // targetMarkerId is kept in TimingMarker as local-only; remove this strip once the
    // backend exposes it natively alongside TimingRegion ids.
    const rawMarkers = rs.markers.map(({ id: _id, targetMarkerId: _link, ...m }) => m);
      const result = await submitTiming(slug, {
        editorHash: getOrCreateEditorHash(),
        editorAlias: editorAlias || undefined,
        mediaUrl: ps.mediaUrl || undefined,
        mediaType: ps.mediaType || undefined,
        bpm: ps.bpm ?? undefined,
        duration: ps.duration,
        ...payload,
        markers: rawMarkers,
      });
      setSubmittedHash(result.editorHash || getOrCreateEditorHash());
      localStorage.setItem(`viola_timing_id_${slug}`, result.id);
      setMode('done');
    } catch {
      setSubmitError('Erro ao enviar. Tente novamente.');
      setMode('editing');
    }
  };

  const handleVote = useCallback(async (id: string) => {
    try {
      const result = await voteTiming(id);
      setContributions(prev => prev.map(c => c.id === id ? { ...c, votes: result.votes } : c));
    } catch { /* silent */ }
  }, []);

  const handleUseContribution = useCallback((c: TimingContribution) => {
    onPreviewTiming(c);
    setMode('testing');
  }, [onPreviewTiming]);

  const handleEditMyContribution = (c: TimingContribution) => {
    loadContribution({ bpm: c.bpm || null, duration: c.duration, mediaUrl: c.mediaUrl, mediaType: c.mediaType });
    useTimingRegionsStore.getState().loadFromContribution(c);
    setEditorAlias(c.editorAlias ?? '');
    setActiveTab('editor');
  };

  // ── Line highlight ────────────────────────────────────────────────────────
  const myTimingId = localStorage.getItem(`viola_timing_id_${slug}`);

  // sortedSections is TimingRegion[] (kind === 'section'), not TimingSection[] — uses sectionType/startTime
  const sortedSections = useMemo(
    () => regions.filter(r => r.kind === 'section').sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)),
    [regions],
  );
  const sortedMarkers = useMemo(() => [...markers].sort((a, b) => a.time - b.time), [markers]);

  // Sections the Wizard 3 (or the "Revincular" flow below) has actually linked to a line range —
  // strict subset of sortedSections, which lists every section regardless of link status.
  const linkedSections = useMemo(
    () => sortedSections.filter(r => r.startLine != null && r.endLine != null),
    [sortedSections],
  );
  const reassigningRegion = reassigningRegionId ? regions.find(r => r.id === reassigningRegionId) ?? null : null;

  // Only 'section' is offered now — the "+Novo Trecho" form's timeline drag-to-fill start/end.
  // Loop/instrumental/phrase creation-by-drag was removed with the chip palette.
  const creationKind: ClipKind | null = sectionFormOpen ? 'section' : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <AssistedModeOverlay />
      <LoopSaltoWizardOverlay />
      <LineLinkWizardOverlay />
      {/* Reassign-lines banner — active while reassigningRegionId is set (from the line-link
          margin popup in CifraGridEditor, or the "Revincular" button in the sidebar below) */}
      {reassigningRegion && (
        <div className="fixed bottom-[138px] left-0 right-0 z-[9997] flex items-center gap-2 px-3 py-2
          bg-[#002fa7] text-white select-none border-t-2 border-[#001a5c] shadow-lg">
          <span className="text-base shrink-0">🔁</span>
          <div className="flex-1 min-w-0 text-[10px]">
            <span className="font-bold">{reassigningRegion.label || reassigningRegion.kind}</span>
            <span className="ml-2 opacity-80">
              {selectionStart !== null && selectionEnd !== null
                ? `Linhas ${Math.min(selectionStart, selectionEnd) + 1}–${Math.max(selectionStart, selectionEnd) + 1} selecionadas`
                : selectionStart !== null
                  ? `Linha inicial ${selectionStart + 1} — clique na linha final`
                  : 'Clique na nova linha inicial do trecho na cifra abaixo'}
            </span>
          </div>
          <button
            onClick={cancelReassignLines}
            className="bevel-out bg-[#ece9d8] text-black border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
          >
            ✕ Cancelar
          </button>
          <button
            onClick={confirmReassignLines}
            disabled={selectionStart === null || selectionEnd === null}
            className="bevel-out bg-[#d4edda] text-[#005500] border border-green-600 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✓ Confirmar
          </button>
        </div>
      )}
      {mode === 'testing' && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#316ac5] text-white text-sm font-bold flex items-center justify-between px-4 py-2 shadow-lg">
          <span>Modo teste ativo — timing injetado no auto-scroll</span>
          <button onClick={handleStopTest} className="bevel-out bg-white text-[#002fa7] px-3 py-0.5 text-xs font-bold border border-gray-400 hover:bg-[#ece9d8]">
            ⏹ Parar
          </button>
        </div>
      )}

      <div className={`h-full flex flex-col text-xs select-none bg-[#ece9d8] ${mode === 'testing' ? 'pt-10' : ''}`}>

        {/* Tabs */}
        <div className="flex items-center border-b border-gray-400 shrink-0 bg-[#d4d0c8]">
          {(['editor', 'community'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 font-bold text-xs border-r border-gray-400 ${activeTab === tab ? 'bg-[#ece9d8]' : 'hover:bg-[#ddd9cc]'}`}
            >
              {tab === 'editor' ? '✏️ Editor' : `👥 Comunidade${contributions.length > 0 ? ` (${contributions.length})` : ''}`}
            </button>
          ))}
          {activeTab === 'editor' && mode !== 'done' && (
            <button
              onClick={handleSubmit}
              disabled={mode === 'submitting'}
              className="ml-auto mr-1.5 bevel-out bg-[#002fa7] text-white px-3 py-1 text-xs font-bold border border-[#001a5c] hover:bg-[#316ac5] disabled:opacity-50"
            >
              {mode === 'submitting' ? '⏳ Enviando...' : '📤 Enviar Contribuição'}
            </button>
          )}
        </div>

        {/* ── Editor tab ── */}
        {activeTab === 'editor' && mode !== 'done' && (
          <div className={`flex-1 flex min-h-0 ${mode === 'testing' ? 'opacity-40 pointer-events-none' : ''}`}>

            {/* Left column */}
            <div className="w-72 shrink-0 flex flex-col border-r border-gray-300 overflow-y-auto retro-scrollbar pb-[142px]">

              {/* Media */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">Referência de mídia</p>
                <div className="flex gap-1">
                  <input
                    value={mediaUrlInput}
                    onChange={e => setMediaUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadMedia()}
                    placeholder="YouTube ou link de áudio..."
                    className="bevel-in bg-white px-1.5 py-0.5 text-[10px] flex-1 min-w-0 outline-none"
                  />
                  <button onClick={loadMedia} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-[10px] font-bold border border-gray-400 hover:bg-white shrink-0">
                    ▶
                  </button>
                </div>

                {mediaType === 'youtube' && <div ref={ytContainerRef} className="w-full" style={{ height: 150 }} />}
                {mediaType === 'audio' && mediaUrl && (
                  <audio
                    ref={audioRef}
                    controls
                    src={mediaUrl}
                    onLoadedMetadata={() => {
                      const audio = audioRef.current;
                      const dur = audio ? Math.round(audio.duration) : 0;
                      registerAudio(audio);
                      setPlayerReady(true, isFinite(dur) && dur > 0 ? dur : undefined);
                    }}
                    className="w-full"
                  />
                )}
                {mediaType === 'other' && mediaUrl && (
                  <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-[#002fa7] underline text-[10px]">Abrir mídia ↗</a>
                )}
              </div>

              {/* BPM */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">BPM <span className="normal-case font-normal text-gray-400">(opcional)</span></p>
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    value={bpm ?? ''}
                    min={20} max={300} step={1}
                    placeholder="—"
                    onChange={e => setBpm(e.target.value ? Math.round(parseFloat(e.target.value)) : null)}
                    className="bevel-in bg-white px-1.5 py-0.5 text-xs w-14 outline-none font-mono"
                  />
                  <button
                    onPointerDown={registerTap}
                    className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 text-[10px] font-bold border border-gray-400 hover:bg-white select-none flex-1 text-center"
                  >
                    {bpm ? `♩ ${bpm}` : 'Tap BPM'}
                  </button>
                  {bpm !== null && (
                    <button onClick={() => setBpm(null)} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] border border-gray-400 hover:bg-white text-[#cc3300]">↺</button>
                  )}
                </div>
                <p className="text-[9px] text-gray-400">Toque Tap BPM no ritmo da música</p>
              </div>

              {/* Duration */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">
                  Duração {durError && <span className="text-[#cc3300] normal-case font-normal">(obrigatória)</span>}
                </p>
                <input
                  type="text"
                  value={durationInput}
                  onChange={e => setDurationInput(e.target.value)}
                  onBlur={() => { commitDuration(); if (usePlayerStore.getState().duration > 0) setDurError(null); }}
                  placeholder="m:ss"
                  className={`bevel-in bg-white px-1.5 py-0.5 text-xs w-full outline-none font-mono ${durError ? 'border border-[#cc3300]' : ''}`}
                />
                <p className="text-[9px] text-gray-400">Auto-preenchido ao carregar vídeo/áudio</p>
              </div>

              {/* Alias */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">Apelido <span className="normal-case font-normal text-gray-400">(opcional)</span></p>
                <input
                  type="text"
                  value={editorAlias}
                  onChange={e => setEditorAlias(e.target.value)}
                  placeholder="Anônimo"
                  className="bevel-in bg-white px-1.5 py-0.5 text-[10px] w-full outline-none"
                />
              </div>

              {/* Backup — export/import full regions+markers state as JSON (debug/portability;
                  own format, NOT the backend submit payload — see regionsToLegacyPayload) */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">Backup (debug)</p>
                <div className="flex gap-1">
                  <button
                    onClick={handleExportSnapshot}
                    className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 text-[10px] font-bold border border-gray-400 hover:bg-white flex-1"
                  >
                    ⬇ Exportar JSON
                  </button>
                  <button
                    onClick={() => importFileInputRef.current?.click()}
                    className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 text-[10px] font-bold border border-gray-400 hover:bg-white flex-1"
                  >
                    ⬆ Importar JSON
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFileChange}
                    className="hidden"
                  />
                </div>
                <p className="text-[9px] text-gray-400">
                  Exporta/importa regions + markers para debug e portabilidade entre sessões — substitui tudo, não é o formato enviado ao backend.
                </p>
              </div>

              {/* ── Trechos (timed sections) ── */}
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">
                    Trechos
                    {sortedSections.length > 0 && <span className="ml-1 font-normal normal-case text-gray-400">({sortedSections.length})</span>}
                  </p>
                  <button
                    onClick={() => setSectionFormOpen(v => !v)}
                    className="bevel-out bg-[#ece9d8] border border-gray-400 px-1.5 py-0.5 text-[9px] font-bold hover:bg-white"
                  >
                    {sectionFormOpen ? '✕' : '+ Novo'}
                  </button>
                </div>

                {sectionFormOpen && (
                  <div className="flex flex-col gap-1 bevel-in bg-white p-1.5">
                    {/* Type */}
                    <select
                      value={sectionFormType}
                      onChange={e => {
                        const t = e.target.value as SectionType;
                        setSectionFormType(t);
                        setSectionFormLabel(getAutoLabel(t, regions));
                      }}
                      className="bevel-in bg-white px-1 py-0.5 text-[10px] w-full outline-none"
                    >
                      {SECTION_ORDER.map(k => (
                        <option key={k} value={k}>{SECTION_TYPE_META[k].ptLabel}</option>
                      ))}
                    </select>

                    {/* Label */}
                    <input
                      value={sectionFormLabel}
                      onChange={e => setSectionFormLabel(e.target.value)}
                      placeholder="Nome do trecho"
                      className="bevel-in bg-white px-1.5 py-0.5 text-[10px] w-full outline-none"
                    />

                    {/* Start time */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500 w-8 shrink-0">Início</span>
                      <input
                        value={sectionFormStart}
                        onChange={e => setSectionFormStart(e.target.value)}
                        placeholder="m:ss"
                        className="bevel-in bg-white px-1 py-0.5 text-[10px] flex-1 outline-none font-mono"
                      />
                    </div>

                    {/* End time */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500 w-8 shrink-0">Fim</span>
                      <input
                        value={sectionFormEnd}
                        onChange={e => setSectionFormEnd(e.target.value)}
                        placeholder="m:ss"
                        className="bevel-in bg-white px-1 py-0.5 text-[10px] flex-1 outline-none font-mono"
                      />
                    </div>

                    <p className="text-[9px] text-gray-400 text-center">
                      💡 Arraste na régua abaixo pra preencher início/fim
                    </p>

                    <button
                      onClick={handleAddSection}
                      className="bevel-out bg-[#d4edda] border border-green-500 px-2 py-1 text-[10px] font-bold hover:bg-white"
                    >
                      ✓ Adicionar Trecho
                    </button>
                  </div>
                )}

                {/* Sections list */}
                {sortedSections.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {sortedSections.map(r => {
                      const meta = SECTION_TYPE_META[r.sectionType!] ?? SECTION_TYPE_META.other;
                      const dur = r.endTime !== null ? r.endTime! - r.startTime! : null;
                      return (
                        <div key={r.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${meta.itemClass}`}>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold truncate block">{r.label}</span>
                            <span className="font-mono text-[9px] opacity-70 flex items-center gap-1 mt-0.5">
                              <span>{formatSeconds(r.startTime ?? 0)} →</span>
                              <input
                                type="number"
                                value={dur !== null ? Math.round(dur) : ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  useTimingRegionsStore.getState().updateRegion(r.id, {
                                    endTime: isNaN(val) ? null : (r.startTime ?? 0) + val,
                                  });
                                }}
                                className="w-10 px-0.5 py-0 border border-gray-300 rounded outline-none text-black bg-white"
                                placeholder="Duração"
                                title="Duração em segundos"
                              />
                              <span>s</span>
                            </span>
                          </div>
                          <button
                            onClick={() => useTimingRegionsStore.getState().removeRegion(r.id)}
                            className="text-red-500 font-bold text-[9px] shrink-0 px-0.5 hover:text-red-700"
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Trechos vinculados (sections with a Wizard 3 line link) ──
                  Separate list from "Marcações de letra" below (that one is loop/instrumental/
                  phrase) — same domain as "Trechos" above, but filtered to only the ones that
                  already have startLine/endLine, with per-item revincular/remover actions. */}
              {linkedSections.length > 0 && (
                <div className="p-2 border-b border-gray-200 flex flex-col gap-1">
                  <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">
                    Trechos vinculados
                    <span className="ml-1 font-normal normal-case text-gray-400">({linkedSections.length})</span>
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {linkedSections.map(r => {
                      const meta = SECTION_TYPE_META[r.sectionType!] ?? SECTION_TYPE_META.other;
                      return (
                        <div key={r.id} className={`flex flex-col gap-0.5 px-1.5 py-1 rounded border text-[10px] ${meta.itemClass}`}>
                          <span className="font-bold truncate">{r.label}</span>
                          <span className="font-mono text-[9px] opacity-70">
                            {formatSeconds(r.startTime ?? 0)}–{formatSeconds(r.endTime ?? 0)}
                            <span className="mx-1">·</span>
                            linhas {r.startLine! + 1}–{r.endLine! + 1}
                          </span>
                          <div className="flex gap-1 mt-0.5">
                            <button
                              onClick={() => startReassignLines(r)}
                              className="bevel-out bg-white border border-gray-400 px-1.5 py-0.5 text-[9px] font-bold hover:bg-blue-50 flex-1"
                            >
                              🔁 Revincular
                            </button>
                            <button
                              onClick={() => useTimingRegionsStore.getState().updateRegion(r.id, { startLine: null, endLine: null })}
                              className="bevel-out bg-white border border-gray-400 px-1.5 py-0.5 text-[9px] font-bold hover:bg-red-50 text-red-600 flex-1"
                              title="Remove só o vínculo com o texto — a seção continua marcada no tempo"
                            >
                              ✕ Remover vínculo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Marcadores de partitura ──
                  No creation entry point left at all (see useAssistedModeStore.ts's header) —
                  purely read/edit of markers already in the data (old contributions, or a marker
                  finish() auto-created). Gated on having something to show, matching "Trechos
                  vinculados"/"Marcações de letra" below — otherwise this was a bare header always
                  rendered with nothing under it for any song with zero markers so far. */}
              {(sortedMarkers.length > 0 || (pendingLinkSource && linkCandidates.length > 0)) && (
              <div className="p-2 border-b border-gray-200 flex flex-col gap-1.5">
                <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">
                  Marcadores de Partitura
                  {sortedMarkers.length > 0 && <span className="ml-1 font-normal normal-case text-gray-400">({sortedMarkers.length})</span>}
                </p>

                {/* Link selector — shown after creating/clicking a linkable marker */}
                {pendingLinkSource && linkCandidates.length > 0 && (() => {
                  const srcMarker = markers.find(m => m.id === pendingLinkSource);
                  if (!srcMarker) return null;
                  const srcMeta = MARKER_META[srcMarker.type];
                  const confirmLink = (targetId: string | undefined) => {
                    useTimingRegionsStore.getState().updateMarker(pendingLinkSource, { targetMarkerId: targetId });
                    setPendingLinkSource(null);
                    setLinkCandidates([]);
                  };
                  return (
                    <div className="bevel-in bg-[#fffbeb] p-2 border-2 border-yellow-400 flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm shrink-0" style={{ color: srcMeta.pinColor }}>{srcMeta.symbol}</span>
                        <span className="font-bold text-[10px]">Qual destino?</span>
                        <button onClick={() => { setPendingLinkSource(null); setLinkCandidates([]); }}
                          className="ml-auto text-[9px] text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {linkCandidates.map(c => {
                          const cm = MARKER_META[c.type];
                          const isCurrent = srcMarker.targetMarkerId === c.id;
                          return (
                            <button key={c.id} onClick={() => confirmLink(c.id)}
                              className={`flex items-center gap-1.5 px-1.5 py-1 text-[10px] border rounded text-left hover:bg-white ${isCurrent ? 'bg-white border-yellow-500 font-bold' : 'bg-[#ece9d8] border-gray-300'}`}
                            >
                              <span className="font-mono shrink-0" style={{ color: cm.pinColor }}>{cm.symbol}</span>
                              <span className="font-mono">{formatSeconds(c.time)}</span>
                              {isCurrent && <span className="text-[8px] text-yellow-600 ml-auto">atual</span>}
                            </button>
                          );
                        })}
                        <button onClick={() => confirmLink(undefined)}
                          className="text-[9px] text-gray-400 hover:text-gray-600 text-left px-1 mt-0.5">
                          ✕ remover vínculo
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Placed markers list */}
                {sortedMarkers.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {sortedMarkers.map(mk => {
                      const m = MARKER_META[mk.type];
                      const isLinkable = !!LINK_TARGET_TYPE[mk.type];
                      const targetMk = mk.targetMarkerId ? markers.find(t => t.id === mk.targetMarkerId) : null;
                      return (
                        <div key={mk.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-white border-gray-200 text-[10px]">
                          <span className="font-mono shrink-0 w-6 text-center font-bold" style={{ color: m.pinColor }}>{m.symbol}</span>
                          <span className="flex-1 font-bold truncate">{m.name}</span>
                          {targetMk && (
                            <span className="text-[8px] text-gray-400 shrink-0 font-mono">
                              → {MARKER_META[targetMk.type].symbol} {formatSeconds(targetMk.time)}
                            </span>
                          )}
                          {isLinkable && !targetMk && (
                            <button
                              onClick={() => handleMarkerClick(mk.id)}
                              className="text-[8px] text-yellow-600 hover:text-yellow-800 shrink-0 px-0.5 border border-yellow-400 rounded"
                              title="Vincular destino"
                            >⇢</button>
                          )}
                          <span className="font-mono text-gray-500 shrink-0">
                            {formatSeconds(mk.time)}{mk.endTime !== undefined ? `–${formatSeconds(mk.endTime)}` : ''}
                          </span>
                          <button
                            onClick={() => useTimingRegionsStore.getState().removeMarker(mk.id)}
                            className="text-red-500 font-bold text-[9px] shrink-0 px-0.5 hover:text-red-700"
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Line-range sections summary */}
              {regions.some(r => r.kind === 'loop' || r.kind === 'instrumental' || r.kind === 'phrase') && (
                <div className="p-2 border-b border-gray-200 flex flex-col gap-1">
                  <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">Marcações de letra</p>
                  {regions.filter(r => r.kind === 'loop').map(r => (
                    <div key={r.id} className="flex flex-col bg-blue-50 border border-blue-200 rounded overflow-hidden">
                      <div className="flex items-center gap-1 px-1.5 py-0.5">
                        <span className="text-[10px] flex-1 truncate">🔁 <b>{r.label}</b> L{r.startLine! + 1}–{r.endLine! + 1} · {r.repeatCount}×{r.startTime != null ? ` ⏱${formatSeconds(r.startTime)}` : ''}</span>
                        <button
                          onClick={() => useLoopSaltoWizardStore.getState().markRepeatOccurrence(r.id)}
                          title="Marcar mais uma ocorrência desta repetição no áudio"
                          className="text-[8px] text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-1 py-0.5 shrink-0 font-bold"
                        >↻</button>
                        <button onClick={() => useTimingRegionsStore.getState().removeRegion(r.id)} className="text-red-500 font-bold text-[9px] shrink-0 px-0.5">×</button>
                      </div>
                      {r.repeats && r.repeats.length > 0 && (
                        <div className="flex flex-col gap-px px-1.5 pb-0.5 border-t border-blue-200">
                          {r.repeats.map((rep, i) => (
                            <div key={i} className="flex items-center gap-1 text-[9px] text-blue-700">
                              <span className="opacity-50">↳</span>
                              <span className="font-mono">×{i + 2}</span>
                              <span className="font-mono flex-1">{formatSeconds(rep.startTime)}–{formatSeconds(rep.endTime)}</span>
                              <button
                                onClick={() => {
                                  const existing = r.repeats ?? [];
                                  useTimingRegionsStore.getState().updateRegion(r.id, { repeats: existing.filter((_, idx) => idx !== i) });
                                }}
                                className="text-red-400 font-bold shrink-0 hover:text-red-600"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {regions.filter(r => r.kind === 'instrumental').map(r => (
                    <div key={r.id} className="flex items-center gap-1 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                      <span className="text-[10px] flex-1 truncate">
                        🎸 <b>{r.label}</b> {r.startLine !== null && r.endLine !== null ? `L${r.startLine + 1}–${r.endLine + 1}` : '(só áudio)'}
                        {r.startTime != null ? ` ⏱${formatSeconds(r.startTime)}` : ''}
                      </span>
                      <button onClick={() => useTimingRegionsStore.getState().removeRegion(r.id)} className="text-red-500 font-bold text-[9px] shrink-0 px-0.5">×</button>
                    </div>
                  ))}
                  {regions.filter(r => r.kind === 'phrase').map(r => (
                    <div key={r.id} className="flex items-center gap-1 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                      <span className="text-[10px] flex-1 truncate">🎤 <b>Frase</b> L{r.startLine! + 1} ⏱{formatSeconds(r.startTime ?? 0)}–{formatSeconds(r.endTime ?? 0)}</span>
                      <button onClick={() => useTimingRegionsStore.getState().removeRegion(r.id)} className="text-red-500 font-bold text-[9px] shrink-0 px-0.5">×</button>
                    </div>
                  ))}
                </div>
              )}

              {submitError && (
                <div className="m-2 mt-auto bg-red-100 border border-red-400 text-red-700 px-2 py-1 text-[10px]">{submitError}</div>
              )}
            </div>

            {/* Right column: full cifra */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">

              {/* Barra de wizards — 3 botões: Estrutura (Wizard 1), Alinhar letra (Wizard de
                  linha), Vincular Texto (Wizard 3). Paleta manual de chips e drag-and-drop
                  removidos — toda criação de region agora passa pelos wizards ou por
                  "Converter em Loop" no menu de contexto de um clip repetido detectado
                  (TimingTimeline.tsx). */}
              <div className="shrink-0 border-b border-gray-400 bg-[#d4d0c8] select-none">
                <div className="flex items-center gap-1 px-2 py-1">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide mr-1 shrink-0">Modo Guiado</span>
                  <button
                    onClick={() => useAssistedModeStore.getState().startStructuralPass()}
                    className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
                    title="Marcar trechos estruturais (Intro, Verso, Refrão…) em tempo real"
                  >
                    ♪ Estrutura
                  </button>
                  <button
                    onClick={() => useAssistedModeStore.getState().startLinePass()}
                    className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
                    title="Alinhar cada linha de letra ao áudio (timing sequencial)"
                  >
                    ≡ Alinhar letra
                  </button>
                  {hasPausedSession && (
                    <button
                      onClick={() => useAssistedModeStore.getState().resumeAssisted()}
                      className="bevel-out bg-[#d4edda] border border-green-500 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
                      title="Retomar o Modo Guiado de onde parou"
                    >
                      ↩ Retomar
                    </button>
                  )}
                  {assistedModeError === 'no-media' && (
                    <span className="text-[9px] text-red-600">
                      Insira um link de áudio/vídeo antes de usar o Modo Guiado.
                    </span>
                  )}
                  {assistedModeError === 'no-lyric-lines' && (
                    <span className="text-[9px] text-red-600">
                      Nenhuma linha de letra detectada na cifra.
                    </span>
                  )}
                  <span className="w-px h-3 bg-gray-400 shrink-0" />
                  <button
                    onClick={() => useLineLinkWizardStore.getState().startLineLinkPass()}
                    className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white shrink-0"
                    title="Vincular cada seção marcada (Intro, Verso…) ao intervalo de linhas correspondente"
                  >
                    📍 Vincular Texto
                  </button>
                  {/* Preview de rolagem — testa contra as regions em memória, sem salvar nada */}
                  <span className="w-px h-3 bg-gray-400 shrink-0" />
                  <button
                    onClick={() => setTestingScroll(v => !v)}
                    className={`bevel-out border px-2 py-0.5 text-[9px] font-bold shrink-0 ${
                      testingScroll ? 'bg-[#316ac5] text-white border-[#001a5c]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'
                    }`}
                    title="Testar a rolagem automática usando as regions atuais (em memória, sem precisar salvar)"
                  >
                    {testingScroll ? '⏹ Parar teste' : '🔍 Testar rolagem'}
                  </button>
                </div>
              </div>

              {/* Legend + edit toggle */}
              <div className="flex items-center gap-4 px-3 py-1 text-[9px] border-b border-gray-200 shrink-0 bg-[#f5f3ee]">
                {!editingCifraText && <>
                  <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-blue-50 border-l-2 border-blue-400 inline-block" /> Loop</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-green-50 border-l-2 border-green-400 inline-block" /> Instrumental</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-purple-50 border-l-2 border-purple-400 inline-block" /> Frase</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-yellow-200 border-l-2 border-yellow-500 inline-block" /> Início selecionado</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2.5 bg-yellow-100 inline-block" /> Selecionado</span>
                </>}
                {editingCifraText && <span className="text-[9px] text-[#002fa7] font-bold">✎ Editando texto da cifra</span>}
                <div className="ml-auto flex gap-1">
                  {!editingCifraText && (
                    <button
                      onClick={() => { setEditTextValue(editedLines.join('\n')); setEditingCifraText(true); }}
                      className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[9px] font-bold hover:bg-white"
                      title="Editar o texto da cifra diretamente"
                    >
                      ✎ Editar texto
                    </button>
                  )}
                  {editingCifraText && <>
                    <button
                      onClick={() => {
                        useCifraTextStore.getState().setLines(editTextValue.split('\n'));
                        setEditingCifraText(false);
                      }}
                      className="bevel-out bg-[#d4edda] border border-green-500 px-2 py-0.5 text-[9px] font-bold hover:bg-white"
                    >
                      ✓ Salvar
                    </button>
                    <button
                      onClick={() => setEditingCifraText(false)}
                      className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[9px] hover:bg-white"
                    >
                      Cancelar
                    </button>
                  </>}
                </div>
              </div>

              {/* Cifra / Chord-grid editor */}
              <div className="flex-1 overflow-y-auto retro-scrollbar bg-white pb-[142px]">
                {editingCifraText ? (
                  <textarea
                    value={editTextValue}
                    onChange={e => setEditTextValue(e.target.value)}
                    className="w-full h-full min-h-[400px] p-3 font-mono text-[11px] leading-5 resize-none outline-none border-0 bg-white text-gray-800"
                    spellCheck={false}
                    autoFocus
                  />
                ) : testingScroll ? (
                  <AutoScrollPreview />
                ) : (
                  <CifraGridEditor
                    lineRefs={lineRefs as React.MutableRefObject<(HTMLElement | null)[]>}
                    onLineClick={handleLineClick}
                    onStartReassign={startReassignLines}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {activeTab === 'editor' && mode === 'done' && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bevel-out bg-[#d4edda] border border-green-500 p-4 w-full max-w-sm flex flex-col gap-3">
              <p className="font-bold text-[#155724] text-sm">✅ Contribuição salva!</p>
              {submittedHash && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-gray-600">Código de edição:</span>
                  <code className="bevel-in bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#002fa7]">{submittedHash}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(submittedHash).then(() => { setCopiedHash(true); setTimeout(() => setCopiedHash(false), 2000); }).catch(() => {}); }}
                    className="bevel-out bg-[#ece9d8] border border-gray-400 px-1.5 py-0.5 text-[10px] font-bold hover:bg-white"
                  >
                    {copiedHash ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
              <button onClick={() => { setActiveTab('community'); setCommunityLoaded(false); }} className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-3 py-1 text-xs font-bold hover:bg-white self-start">
                Ver contribuições da comunidade
              </button>
            </div>
          </div>
        )}

        {/* ── Community tab ── */}
        {activeTab === 'community' && (
          <div className="flex-1 overflow-y-auto retro-scrollbar p-3 flex flex-col gap-2">
            {loadingContribs && <p className="text-xs text-gray-500 text-center py-10">Carregando...</p>}
            {!loadingContribs && contributions.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-10">Nenhuma contribuição ainda. Seja o primeiro!</p>
            )}
            {contributions.map(c => (
              <div key={c.id} className={`bevel-out p-2 flex flex-col gap-1.5 ${c.id === myTimingId ? 'bg-[#fffde7] border border-yellow-400' : 'bg-white'}`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-[10px]">
                    {c.bpm ? `♩ ${c.bpm} BPM · ` : ''}⏱ {formatSeconds(c.duration)}
                    {c.editorAlias && <span className="text-gray-500 font-normal"> · {c.editorAlias}</span>}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => handleVote(c.id)} className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[10px] font-bold hover:bg-white">👍 {c.votes}</button>
                    <button onClick={() => handleUseContribution(c)} className="bevel-out bg-[#002fa7] text-white border border-[#001a5c] px-2 py-0.5 text-[10px] font-bold hover:bg-[#316ac5]">Usar este</button>
                  </div>
                </div>
                {c.mediaUrl && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="truncate text-[9px] font-mono">{c.mediaUrl}</span>
                    <a href={c.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-[#002fa7] shrink-0">↗</a>
                  </div>
                )}
                {/* Trechos timeline in community card */}
                {c.sections?.length > 0 && c.duration > 0 && (
                  <div className="relative h-4 bg-gray-100 rounded overflow-hidden">
                    {[...c.sections].sort((a, b) => a.startTime - b.startTime).map((s, i) => {
                      const meta = SECTION_TYPE_META[s.type];
                      const left = (s.startTime / c.duration) * 100;
                      const endT = s.endTime ?? c.duration;
                      const width = Math.max(((endT - s.startTime) / c.duration) * 100, 0.5);
                      return (
                        <div
                          key={i}
                          title={`${s.label}  ${formatSeconds(s.startTime)}${s.endTime !== null ? ` → ${formatSeconds(s.endTime)}` : ''}`}
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: meta.barColor }}
                          className="absolute top-0 bottom-0 border-r border-white/50"
                        />
                      );
                    })}
                  </div>
                )}
                {c.sections?.length > 0 && (
                  <p className="text-[9px] text-gray-500">
                    {[...c.sections].sort((a, b) => a.startTime - b.startTime).map(s =>
                      `${s.label} (${formatSeconds(s.startTime)}${s.endTime !== null ? `–${formatSeconds(s.endTime)}` : ''})`
                    ).join(' · ')}
                  </p>
                )}
                {c.markers?.length > 0 && (
                  <p className="text-[10px] text-gray-600 flex flex-wrap gap-x-2 gap-y-0.5">
                    {[...c.markers].sort((a, b) => a.time - b.time).map((mk, i) => {
                      const m = MARKER_META[mk.type];
                      return (
                        <span key={i} className="font-mono" style={{ color: m.pinColor }}>
                          {m.symbol} <span className="text-gray-500 font-sans">{m.name}</span> {formatSeconds(mk.time)}
                        </span>
                      );
                    })}
                  </p>
                )}
                {c.loops?.length > 0 && <p className="text-[10px] text-blue-700">🔁 {c.loops.map(l => `${l.label} (${l.repeatCount}×${l.mediaTimestampStart != null ? ` ⏱${formatSeconds(l.mediaTimestampStart)}` : ''})`).join(' · ')}</p>}
                {c.instrumentalSections?.length > 0 && <p className="text-[10px] text-green-700">🎸 {c.instrumentalSections.map(s => `${s.label}${s.mediaTimestampStart != null ? ` ⏱${formatSeconds(s.mediaTimestampStart)}` : ''}`).join(' · ')}</p>}
                {c.id === myTimingId && (
                  <button onClick={() => handleEditMyContribution(c)} className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 text-[10px] font-bold hover:bg-white self-start">✏️ Editar minha contribuição</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline fixed footer — floats at bottom of viewport */}
      {activeTab === 'editor' && mode !== 'done' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 shadow-[0_-2px_6px_rgba(0,0,0,0.25)]">
          <TimingTimeline
            markerMeta={MARKER_META}
            creationKind={creationKind}
            onCreateRange={handleTimelineCreateRange}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      )}
    </>
  );
};
