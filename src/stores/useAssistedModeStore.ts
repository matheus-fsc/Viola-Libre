// =============================================================================
// useAssistedModeStore — Coordenador do Modo Guiado
//
// PAPEL DISTINTO DOS 4 STORES DE DOMÍNIO:
// useCifraTextStore, useTimingRegionsStore, usePlayerStore e
// useTimingSelectionStore são fatias isoladas — não importam um ao outro.
// useAssistedModeStore é um store de feature: orquestra os outros stores
// para implementar o wizard de marcação sequencial. Quebrar o isolamento
// aqui é intencional e documentado — este store não tem dados próprios
// além do estado do wizard.
//
// "Virada" (kind:'instrumental' region, no sectionType) foi removida como chip do ask-next —
// selectNextInstrminental()/pendingKind não existem mais aqui. kind:'instrumental' é um valor de
// TimingRegion.kind persistido de verdade (track própria na timeline, badge no CifraGridEditor,
// não é um detalhe de UI do wizard) — mesmo padrão de compatibilidade já aplicado aos markers de
// salto (Segno/D.C./D.S.) e agora a fermata/1ª/2ª casa: leitura/renderização/edição de regions
// kind:'instrumental' já existentes continuam 100% intactas (drag/resize/delete genéricos do
// clip na timeline já cobrem isso), só a via de CRIAÇÃO pelo wizard foi removida. Não havia
// nenhum outro ponto de criação manual desse kind — ele fica só leitura/edição a partir de agora.
// =============================================================================

import { create } from 'zustand';
import type { SectionType } from '../services/timingApi';
import { classifyLine } from '../utils/lineClassifier';
import { useCifraTextStore } from './useCifraTextStore';
import { usePlayerStore } from './usePlayerStore';
import { useTimingRegionsStore } from './useTimingRegionsStore';
import { useTimingSelectionStore } from './useTimingSelectionStore';

// Portuguese display labels (mirrors SECTION_TYPE_META in TimingEditor, kept local to avoid import coupling)
const PT_LABELS: Record<SectionType, string> = {
  intro:        'Introdução',
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

// Only ever raised by confirmIntro() now — selectNextType() no longer has an 'intro' special
// case (that chip was removed from the recurring ask-next popup; a song can't have a 2nd
// Introdução mid-way), so this can no longer be triggered mid-structural-pass. Kept as its own
// type (rather than inlined) since confirmDupOverwrite() still needs the label/times to render.
export interface DupWarning {
  sectionType: SectionType;
  existingRegionId: string;
  label: string;
  startTime: number;
  endTime: number;
}

export interface AssistedModeState {
  active:     boolean;
  mode:       'structural' | 'line' | null;
  phase:      'closed' | 'confirm-intro' | 'armed' | 'recording' | 'ask-next' | 'finished';

  // Structural pass — type of the section being built (null only for the very 1st section of a
  // no-intro pass, before selectNextType has ever run — see commitBoundary's 'other' default).
  pendingSectionType: SectionType | null;

  segmentStartTime: number;

  // Line pass — each entry is either a single lyric line or a grouped tab block.
  lineCursor:       number | null;
  lyricLineIndices: Array<{ startLine: number; endLine: number }> | null;

  // IDs of created regions in order — for Undo
  history: string[];

  // Whether the current 'armed' phase should show the 3-2-1 countdown.
  showCountdown: boolean;

  // Set when startLinePass() finds no lyric lines — UI reads this to show an error
  error: string | null;

  // ── Duplicate-section warning ───────────────────────────────────────────────
  // Set when confirmIntro / selectNextType detects an existing region of the same sectionType.
  // While set, the overlay shows a "já marcado — substituir ou pular?" dialog.
  dupWarning: DupWarning | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  startStructuralPass(): void;
  confirmIntro(hasIntro: boolean): void;
  startLinePass(): void;

  beginRecording(): void;
  armSegment(showCountdown?: boolean): void;
  commitBoundary(): void;

  // Structural pass — section navigation
  selectNextType(type: SectionType): void;

  // Duplicate-section resolution
  confirmDupOverwrite(): void;  // remove existing region, proceed with current intent
  confirmDupSkip(): void;       // dismiss warning, stay in current phase

  undoLast(): void;
  exitAssisted(): void;    // full reset — used by "Finalizar música" and hard exit
  pauseForManualEdit(): void;  // pauses but preserves all wizard state (active=false only)
  resumeAssisted(): void;      // re-opens the overlay exactly where it was paused
  finish(): void;
}

export const useAssistedModeStore = create<AssistedModeState>((set, get) => ({
  active:                false,
  mode:                  null,
  phase:                 'closed',
  pendingSectionType:    null,
  segmentStartTime:      0,
  lineCursor:            null,
  lyricLineIndices:      null,
  history:               [],
  showCountdown:          true,
  error:                  null,
  dupWarning:             null,

  // ── Initialise ─────────────────────────────────────────────────────────────

  startStructuralPass: () => {
    if (!usePlayerStore.getState().mediaUrl) {
      set({ error: 'no-media' });
      return;
    }
    set({
      active: true, mode: 'structural', phase: 'confirm-intro',
      pendingSectionType: null,
      segmentStartTime: 0, lineCursor: null, lyricLineIndices: null,
      history: [], showCountdown: true, error: null,
    });
  },

  confirmIntro: (hasIntro) => {
    if (!hasIntro) {
      set({ pendingSectionType: null, phase: 'armed', showCountdown: true });
      return;
    }
    const existing = useTimingRegionsStore.getState().regions.find(
      r => r.kind === 'section' && r.sectionType === 'intro'
    );
    if (existing) {
      set({
        dupWarning: {
          sectionType: 'intro',
          existingRegionId: existing.id,
          label: PT_LABELS['intro'],
          startTime: existing.startTime ?? 0,
          endTime: existing.endTime ?? 0,
        },
      });
      return;
    }
    set({ pendingSectionType: 'intro', phase: 'armed', showCountdown: true });
  },

  startLinePass: () => {
    if (!usePlayerStore.getState().mediaUrl) {
      set({ error: 'no-media' });
      return;
    }
    const lines = useCifraTextStore.getState().lines;
    // Build grouped entries: each lyric line → its own entry; consecutive tab lines → one block entry.
    const lyricLineIndices: Array<{ startLine: number; endLine: number }> = [];
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) { i++; continue; }
      const type = classifyLine(lines[i]);
      if (type === 'tab') {
        // Consume the entire tab block (stops at blank line or non-tab line)
        const blockStart = i;
        let blockEnd = i;
        i++;
        while (i < lines.length && lines[i].trim() !== '' && classifyLine(lines[i]) === 'tab') {
          blockEnd = i;
          i++;
        }
        lyricLineIndices.push({ startLine: blockStart, endLine: blockEnd });
      } else if (type === 'lyric') {
        lyricLineIndices.push({ startLine: i, endLine: i });
        i++;
      } else {
        i++;  // chord, section, instrumental → skip
      }
    }

    if (lyricLineIndices.length === 0) {
      set({ error: 'no-lyric-lines' });
      return;
    }

    set({
      active: true, mode: 'line', phase: 'armed',
      pendingSectionType: null,
      segmentStartTime: 0,
      lineCursor: 0, lyricLineIndices,
      history: [], showCountdown: true, error: null,
    });
  },

  // ── Recording lifecycle ────────────────────────────────────────────────────

  armSegment: (showCountdown = true) => {
    if (showCountdown) {
      set({ phase: 'armed', showCountdown: true });
    } else {
      get().beginRecording();
    }
  },

  beginRecording: () => {
    const pStore = usePlayerStore.getState();
    // First recording of a structural/line pass always starts from t=0,
    // regardless of where the player was left.
    const { history } = get();
    if (history.length === 0) {
      pStore.seek(0);
    }
    pStore.play();
    const startTime = usePlayerStore.getState().currentTime;
    set({ phase: 'recording', segmentStartTime: startTime });
  },

  commitBoundary: () => {
    const { phase, mode, pendingSectionType, segmentStartTime, lineCursor, lyricLineIndices, history } = get();

    if (phase !== 'recording') return;

    const pStore = usePlayerStore.getState();
    const rStore = useTimingRegionsStore.getState();
    const selStore = useTimingSelectionStore.getState();
    const currentTime = pStore.currentTime;

    if (mode === 'structural') {
      pStore.pause();

      // No-intro case: the very 1st section of a structural pass is committed before the user
      // ever picks a type (confirmIntro(false) leaves pendingSectionType null) — defaults to
      // 'other' rather than leaving sectionType undefined, since every other consumer of
      // TimingRegion (sidebar, TimingTimeline's clip color/reclassify menu) assumes a 'section'
      // region always has a valid SectionType. User can reclassify it via the timeline's
      // "Modificar" menu afterwards.
      const effectiveType = pendingSectionType ?? 'other';
      const baseLabel = PT_LABELS[effectiveType];
      // Non-intro types support multiple numbered occurrences (Verso 2, Refrão 2, …).
      // Count existing regions of this type to derive the next number.
      const existingCount = effectiveType !== 'intro'
        ? rStore.regions.filter(r => r.kind === 'section' && r.sectionType === effectiveType).length
        : 0;
      const label = existingCount > 0 ? `${baseLabel} ${existingCount + 1}` : baseLabel;
      const id = rStore.addRegion({
        kind: 'section',
        startLine: null, endLine: null,
        startTime: segmentStartTime,
        endTime: currentTime,
        label,
        sectionType: effectiveType,
      });

      selStore.selectRegion(id);
      set({
        history: [...history, id],
        segmentStartTime: currentTime,
        phase: 'ask-next',
      });

    } else if (mode === 'line') {
      if (lineCursor === null || lyricLineIndices === null) return;

      const lineEntry = lyricLineIndices[lineCursor];
      const id = rStore.addRegion({
        kind: 'phrase',
        startLine: lineEntry.startLine, endLine: lineEntry.endLine,
        startTime: segmentStartTime,
        endTime: currentTime,
        label: '',
      });

      selStore.selectRegion(id);
      const nextCursor = lineCursor + 1;
      const newHistory = [...history, id];

      if (nextCursor >= lyricLineIndices.length) {
        pStore.pause();
        set({ history: newHistory, lineCursor: nextCursor, segmentStartTime: currentTime, phase: 'finished' });
      } else {
        set({ history: newHistory, lineCursor: nextCursor, segmentStartTime: currentTime });
      }
    }
  },

  // ── Ask-next navigation ────────────────────────────────────────────────────

  // 'intro' can no longer be passed in here — it's not in NEXT_SECTION_CHIPS anymore (a song
  // can't have a 2nd Introdução mid-way; that question is asked once, up front, by confirm-intro).
  // All types support numbered repetitions (Verso 2, Refrão 2, …), handled in commitBoundary.
  selectNextType: (type) => {
    if (get().phase !== 'ask-next') return;
    set({ pendingSectionType: type });
    get().armSegment(false);
  },

  // ── Undo ──────────────────────────────────────────────────────────────────

  undoLast: () => {
    const { history, mode, lineCursor } = get();

    if (history.length === 0) return;

    const pStore = usePlayerStore.getState();
    const rStore = useTimingRegionsStore.getState();
    pStore.pause();

    const lastId = history[history.length - 1];
    const lastRegion = rStore.regions.find(r => r.id === lastId);
    rStore.removeRegion(lastId);

    const reboundTime = lastRegion?.startTime ?? 0;
    pStore.seek(reboundTime);

    set({
      history: history.slice(0, -1),
      segmentStartTime: reboundTime,
      lineCursor: mode === 'line' && lineCursor !== null ? Math.max(0, lineCursor - 1) : lineCursor,
      phase: 'recording',
    });
  },

  // ── Duplicate-section resolution ──────────────────────────────────────────

  // Only ever raised for 'intro' now (see DupWarning's header comment) — always re-arms the
  // intro segment with a fresh countdown, exactly like confirmIntro(true)'s own no-duplicate path.
  confirmDupOverwrite: () => {
    const { dupWarning } = get();
    if (!dupWarning) return;
    useTimingRegionsStore.getState().removeRegion(dupWarning.existingRegionId);
    set({ dupWarning: null, pendingSectionType: 'intro', phase: 'armed', showCountdown: true });
  },

  confirmDupSkip: () => set({ dupWarning: null }),

  // ── Pause / Resume ────────────────────────────────────────────────────────

  // Pauses the wizard overlay without resetting any state — user can edit manually
  // and then resume exactly where they left off.
  pauseForManualEdit: () => {
    usePlayerStore.getState().pause();
    set({ active: false });
  },

  // Re-opens the overlay in the exact phase/state it was paused in.
  // Does NOT restart countdown or play — the user decides when to continue.
  resumeAssisted: () => set({ active: true }),

  // ── Exit ──────────────────────────────────────────────────────────────────

  exitAssisted: () => set({
    active: false, phase: 'closed', mode: null,
    dupWarning: null,
  }),

  // Ends the structural pass. Auto-creates a 'fine' marker at the current time if the session
  // doesn't already have one — Fine is no longer a chip the user picks (Passo 5): finishing the
  // structural pass IS "this is where the song ends" now. Guarded against duplicating a Fine
  // the user already had from before (a manual one loaded from an older contribution, or placed
  // via the legacy notation panel) — checked against the live `markers` array, not a session
  // flag, since that's exactly the case the guard needs to catch.
  // Only applies to the structural pass — the line pass (mode 'line') has no notion of "song
  // ending", it's purely about syncing lyric lines to audio.
  finish: () => {
    if (get().mode === 'structural') {
      const rStore = useTimingRegionsStore.getState();
      if (!rStore.markers.some(m => m.type === 'fine')) {
        rStore.addMarker({ type: 'fine', time: usePlayerStore.getState().currentTime });
      }
    }
    set({
      active: false, phase: 'closed', mode: null,
      dupWarning: null,
    });
  },
}));
