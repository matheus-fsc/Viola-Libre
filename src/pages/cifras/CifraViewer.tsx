import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Eye, Heart, Pin, Save } from 'lucide-react';
import {
  getCifra, incrementView, favoriteCifra, type CifraDetail,
  saveSequencia, loadSequencia, updateSequencia, deleteSequencia,
  addRecentSequencia, removeRecentSequencia, getRecentSequencias,
  getSongs, type Song,
  type SequenciaData, type RecentSequencia,
} from '../../services/api';
import type { Voicing } from '../../engine/types';
import { buildChord, buildVoicingFromFrets, calculateVoicings, noteNameToPitchClass, parseChordString, transposeChordString } from '../../engine/chordCalculator';
import { PRESET_INSTRUMENTS } from '../../engine/tunings';
import { AudioEngine } from '../../engine/AudioEngine';
import { FretboardDiagram } from '../../components/FretboardDiagram';
import { ChordEditorModal } from '../../components/ChordEditorModal';
import { TabTransposerBlock } from '../../components/TabTransposerBlock';
import { splitHtmlByTabs, TAB_POSITIONS, type ContentSegment } from '../../engine/tabTransposer';
import '../../components/Cifras.css';
import { fetchBestTiming, type TimingContribution } from '../../services/timingApi';
import { getIsMobile } from '../../hooks/useIsMobile';
import { reflowCifraHtml } from '../../services/cifraUtils';


interface VoicingFilter {
  proximity: boolean;
  maxNotes: boolean;
  muteFilter: 'any' | 'with_mute' | 'no_mute';
  prioritizeEasy: boolean;
}
const DEFAULT_FILTER: VoicingFilter = { proximity: false, maxNotes: false, muteFilter: 'any', prioritizeEasy: false };

// Represents one labelled musical section detected from [Rótulo] markers
interface SectionEntry {
  label: string;
  isInstrumental: boolean;
  repeat: number;
  startTime: number;
  endTime: number;
  startY: number;
  endY: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function isChordDiatonic(chordName: string, songKey: string): boolean {
  if (!songKey || !chordName) return false;
  try {
    const { root: chordRoot, suffix: chordSuffix } = parseChordString(chordName);
    const isMinorKey = songKey.endsWith('m') || songKey.endsWith('m7');
    const songKeyRoot = isMinorKey ? songKey.replace(/m7?$/, '') : songKey;
    
    const songKeyRootPc = noteNameToPitchClass(songKeyRoot);
    const chordRootPc = noteNameToPitchClass(chordRoot);
    if (songKeyRootPc === -1 || chordRootPc === -1) return false;
    
    const diff = (chordRootPc - songKeyRootPc + 12) % 12;
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
    const intervals = isMinorKey ? minorIntervals : majorIntervals;
    
    const intervalIdx = intervals.indexOf(diff);
    if (intervalIdx === -1) return false;
    
    const expectedSuffixIsMinor = isMinorKey 
      ? [true, false, false, true, false, false, false][intervalIdx]
      : [false, true, true, false, false, true, false][intervalIdx];
      
    const chordIsMinor = chordSuffix.includes('m') && !chordSuffix.includes('maj');
    return chordIsMinor === expectedSuffixIsMinor;
  } catch {
    return false;
  }
}

export const CifraViewer: React.FC = () => {
  const { artistSlug, '*': songSlug } = useParams<{ artistSlug: string; '*': string }>();
  const [cifra, setCifra] = useState<CifraDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const navigate = useNavigate();

  // Transpose states
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [tabPosIdx, setTabPosIdx] = useState<number>(0);
  const [panelPosition, setPanelPosition] = useState<'left' | 'top' | 'right' | 'bottom'>(() => getIsMobile() ? 'top' : 'left');
  const [showTabs, setShowTabs] = useState(true);
  
  // Scraped original chords
  const [originalChords, setOriginalChords] = useState<string[]>([]);

  // Versões da mesma música (mesmo título, slugs diferentes)
  const [songVersions, setSongVersions] = useState<Song[]>([]);
  
  // New features
  const [songKey, setSongKey] = useState<string>('');
  const [variationIndices, setVariationIndices] = useState<Record<string, number>>({});
  const [favoriteChords, setFavoriteChords] = useState<Record<string, boolean>>({});
  const [infoPopupChord, setInfoPopupChord] = useState<string | null>(null);
  const [voicingFilter, setVoicingFilter] = useState<VoicingFilter>(DEFAULT_FILTER);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);
  const [lockedVariations, setLockedVariations] = useState<Record<string, number>>({});
  const [excludedFromFilter, setExcludedFromFilter] = useState<Record<string, true>>({});
  // User-edited custom chord shapes (override the generated voicing), keyed by chord name.
  const [customVoicings, setCustomVoicings] = useState<Record<string, number[]>>({});
  const [editorChord, setEditorChord] = useState<{ name: string; frets: number[] } | null>(null);

  // Sequence save/load states
  const [seqModalOpen, setSeqModalOpen] = useState<'save' | 'load' | null>(null);
  const [savedHash, setSavedHash] = useState<string | null>(null);
  const [loadHashInput, setLoadHashInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSeq, setIsLoadingSeq] = useState(false);
  const [seqError, setSeqError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentSeqs, setRecentSeqs] = useState<RecentSequencia[]>(() => getRecentSequencias());

  // Instrument and Tuning states
  const [selectedInstId, setSelectedInstId] = useState<string>(PRESET_INSTRUMENTS[0].id);
  const [selectedTuningId, setSelectedTuningId] = useState<string>(PRESET_INSTRUMENTS[0].defaultTuningId || PRESET_INSTRUMENTS[0].tunings[0].id);

  // BPM / auto-scroll / loop
  const [localBpm, setLocalBpm] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollMult, setScrollMult] = useState(1);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const [previewTiming, setPreviewTiming] = useState<TimingContribution | null>(null);
  const [bestTiming, setBestTiming] = useState<TimingContribution | null>(null);
  const [scrollFrac, setScrollFrac] = useState(0);
  const [lyricsPopup, setLyricsPopup] = useState<{ chord: string; x: number; y: number } | null>(null);
  const [currentSection, setCurrentSection] = useState<string | null>(null);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const prevTimeRef = useRef<number | null>(null);
  const chordMapRef = useRef<Array<{ chordY: number; time: number }>>([]);
  const sectionTimelineRef = useRef<SectionEntry[]>([]);
  const prevSectionRef = useRef<string | null>(null);
  const lyricsPopupRef = useRef<HTMLDivElement>(null);
  const popupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror mutable values for rAF closure (updated each render)
  const scrollMultRef = useRef(scrollMult);
  const loopARef = useRef(loopA);
  const loopBRef = useRef(loopB);
  const cifraForRaf = useRef(cifra);
  scrollMultRef.current = scrollMult;
  loopARef.current = loopA;
  loopBRef.current = loopB;
  cifraForRaf.current = cifra;

  useEffect(() => {
    const engine = AudioEngine.getInstance();
    const voices = AudioEngine.getAvailableVoices();

    let targetVoiceId = 'violao-nylon';
    if (selectedInstId === 'viola') {
      targetVoiceId = 'violao-aco';
    } else if (selectedInstId === 'piano') {
      targetVoiceId = 'piano';
    }

    const voice = voices.find(v => v.id === targetVoiceId);
    if (voice) {
      engine.setVoice(voice);
    }
  }, [selectedInstId]);

  useEffect(() => {
    if (artistSlug && songSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      setTransposeOffset(0);
      getCifra(artistSlug, songSlug).then((data) => {
        setCifra(data);
        
        // Varrer acordes do HTML usando a tag <b>
        const regex = /<b>(.*?)<\/b>/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(data.content_html)) !== null) {
          // Um único <b> pode conter vários acordes separados por espaço
          // (ex.: "<b>G#m7(5-)  A#7</b>"). Separa cada acorde para não grudar dois num só.
          const raw = match[1].replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').trim();
          if (!raw) continue;
          for (const chord of raw.split(/\s+/)) {
            if (chord && !matches.includes(chord)) {
              matches.push(chord);
            }
          }
        }
        setOriginalChords(matches);
        if (matches.length > 0) {
          setSongKey(matches[0]); // Guess key from first chord
        }

        setLoading(false);
        incrementView(artistSlug, songSlug).catch(console.error);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [artistSlug, songSlug]);

  // Carrega as versões da música (mesmo título) para o seletor de versão
  useEffect(() => {
    if (!artistSlug || !cifra?.title) return;
    const titleKey = cifra.title.trim().toLowerCase();
    getSongs(artistSlug)
      .then(all => setSongVersions(all.filter(s => s.title.trim().toLowerCase() === titleKey)))
      .catch(() => setSongVersions([]));
  }, [artistSlug, cifra?.title]);

  const handleFavorite = async () => {
    if (!artistSlug || !songSlug || isFavoriting || !cifra) return;
    setIsFavoriting(true);
    try {
      await favoriteCifra(artistSlug, songSlug);
      setCifra({ ...cifra, favorited: (cifra.favorited || 0) + 1 });
    } catch (e) {
      console.error(e);
    } finally {
      setIsFavoriting(false);
    }
  };

  // Desabilita restauração de scroll do browser — após Ctrl+R o scroll voltaria
  // para a posição anterior, desincronizando o auto-scroll com o topo da cifra.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    return () => { if ('scrollRestoration' in history) history.scrollRestoration = 'auto'; };
  }, []);

  // Ativar auto-scroll: volta pro topo para sincronizar com o início da música
  const handleToggleAutoScroll = () => {
    if (!autoScroll) window.scrollTo(0, 0);
    setAutoScroll(p => !p);
  };

  // Auto-scroll: interpola posição pelo mapa de acordes (velocidade não-uniforme)
  // ou usa velocidade constante como fallback quando o mapa está vazio.
  useEffect(() => {
    if (!autoScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      prevTimeRef.current = null;
      setCurrentSection(null);
      prevSectionRef.current = null;
      return;
    }
    elapsedRef.current = 0;
    const step = (ts: number) => {
      if (prevTimeRef.current === null) prevTimeRef.current = ts;
      const dt = Math.min(ts - prevTimeRef.current, 100);
      prevTimeRef.current = ts;
      const maxSc = document.documentElement.scrollHeight - window.innerHeight;
      if (maxSc <= 0) { rafRef.current = requestAnimationFrame(step); return; }
      const mult = scrollMultRef.current;
      elapsedRef.current += (dt / 1000) * mult;
      const map = chordMapRef.current;
      let targetY: number;
      if (map.length >= 2) {
        const t = elapsedRef.current;
        const last = map[map.length - 1];
        if (t >= last.time) {
          targetY = maxSc;
        } else {
          let lo = 0, hi = map.length - 1;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (map[mid].time <= t) lo = mid; else hi = mid; }
          const { chordY: y0, time: t0 } = map[lo];
          const { chordY: y1, time: t1 } = map[hi];
          const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
          // Posiciona o acorde na linha de leitura (30vh do topo)
          targetY = Math.max(0, y0 + (y1 - y0) * frac - window.innerHeight * 0.30);
        }
      } else {
        // Fallback: velocidade constante por duração ou 60px/s
        const dur = cifraForRaf.current?.duration ?? null;
        const pxPerSec = dur ? Math.max(40, maxSc / dur) : 60;
        targetY = window.scrollY + pxPerSec * (dt / 1000) * mult;
      }
      const la = loopARef.current;
      const lb = loopBRef.current;
      if (la !== null || lb !== null) {
        const loopEnd = lb ?? maxSc;
        if (targetY >= loopEnd) {
          targetY = la ?? 0;
          // Sincroniza elapsedRef com a posição A para continuar o mapa coerentemente
          const startChordY = targetY + window.innerHeight * 0.30;
          const idx = map.findIndex(p => p.chordY > startChordY);
          elapsedRef.current = idx > 0 ? map[idx - 1].time : 0;
        }
      } else if (targetY >= maxSc) {
        window.scrollTo(0, maxSc);
        setAutoScroll(false);
        return;
      }
      window.scrollTo(0, Math.max(0, Math.min(targetY, maxSc)));
      // Section detection — only triggers a re-render when section changes
      const tl = sectionTimelineRef.current;
      if (tl.length > 0) {
        let secLabel: string | null = null;
        const t = elapsedRef.current;
        for (let i = tl.length - 1; i >= 0; i--) {
          if (t >= tl[i].startTime) { secLabel = tl[i].label; break; }
        }
        if (secLabel !== prevSectionRef.current) {
          prevSectionRef.current = secLabel;
          setCurrentSection(secLabel);
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoScroll]);

  // Scroll position tracker via window scroll
  useEffect(() => {
    const updateMax = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setMaxScroll(max);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) setScrollFrac(window.scrollY / max);
    };
    updateMax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateMax);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateMax);
    };
  }, [cifra]);

  // Constrói o mapa de timing com dois critérios:
  // 1. Peso proporcional ao nº de acordes por linha (grupo denso = mais tempo)
  // 2. Seções instrumentais detectadas via labels [Interlude], [Solo], [Ponte], etc.
  //    recebem multiplicador 2× — o scroll desacelera mesmo quando há poucos acordes.
  useEffect(() => {
    if (!cifra) { chordMapRef.current = []; return; }
    const frame = requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) { chordMapRef.current = []; return; }
      const bEls = Array.from(el.querySelectorAll('.cifra-viewer-content b')) as HTMLElement[];
      if (bEls.length === 0) { chordMapRef.current = []; return; }
      // Posição Y absoluta na página (window.scrollY=0 após reset no carregamento)
      const rawYs = bEls.map(b => b.getBoundingClientRect().top + window.scrollY);
      // Agrupa acordes por linha (≤ 24px = mesma linha) e conta quantos por grupo
      const groups: { y: number; count: number }[] = [];
      for (const y of rawYs) {
        const last = groups[groups.length - 1];
        if (last && y - last.y <= 24) last.count++;
        else groups.push({ y, count: 1 });
      }
      const n = groups.length;
      if (n === 0) { chordMapRef.current = []; return; }

      const INSTR_RE = /\b(interlude|interlúdio|interludio|solo|ponte|bridge|instrumental|intro|introdução|introducao)\b/i;
      const REPEAT_RE = /(\d+)\s*[xX]|[xX]\s*(\d+)/;
      const labelRe = /\[([^\]]+)\]/g;
      const sectionMarkers: { charPos: number; label: string; instrumental: boolean; repeat: number }[] = [];
      let lm: RegExpExecArray | null;
      while ((lm = labelRe.exec(cifra.content_html)) !== null) {
        const labelText = lm[1];
        const isInstrumental = INSTR_RE.test(labelText);
        let repeat = 1;
        const mRep = REPEAT_RE.exec(labelText);
        if (mRep) {
          repeat = parseInt(mRep[1] ?? mRep[2], 10);
        } else {
          const afterEnd = lm.index + lm[0].length;
          const nlIdx = cifra.content_html.indexOf('\n', afterEnd);
          const afterText = cifra.content_html.slice(afterEnd, nlIdx === -1 ? afterEnd + 25 : Math.min(nlIdx, afterEnd + 25));
          const mAfter = REPEAT_RE.exec(afterText);
          if (mAfter) {
            repeat = parseInt(mAfter[1] ?? mAfter[2], 10);
          } else if (/repeti[rt]/i.test(afterText)) {
            const mNum = /(\d+)/.exec(afterText);
            repeat = mNum ? parseInt(mNum[1], 10) : 2;
          }
        }
        sectionMarkers.push({ charPos: lm.index, label: labelText, instrumental: isInstrumental, repeat: Math.max(1, Math.min(repeat, 8)) });
      }
      // Posição char de cada <b> no HTML bruto (mesma ordem que no DOM)
      const chordCharPos: number[] = [];
      const bRe = /<b>/gi;
      let bm: RegExpExecArray | null;
      while ((bm = bRe.exec(cifra.content_html)) !== null) chordCharPos.push(bm.index);

      const INSTR_MULT = 2.0;
      let domChordIdx = 0;
      const weights: number[] = [];
      for (const g of groups) {
        const firstCharPos = chordCharPos[domChordIdx] ?? 0;
        let instrumental = false;
        let repeat = 1;
        for (const sec of sectionMarkers) {
          if (sec.charPos <= firstCharPos) { instrumental = sec.instrumental; repeat = sec.repeat; }
          else break;
        }
        weights.push(g.count * (instrumental ? INSTR_MULT : 1.0) * repeat);
        domChordIdx += g.count;
      }

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const activeTiming = previewTiming ?? bestTiming ?? null;
      const dur = activeTiming?.duration ?? cifra.duration ?? null;
      const bpm = activeTiming?.bpm ?? localBpm ?? cifra.bpm ?? 120;
      const totalTime = dur ?? (60 / bpm) * 4 * bEls.length;
      const map: Array<{ chordY: number; time: number }> = [];
      let cumWeight = 0;
      for (let i = 0; i < n; i++) {
        map.push({ chordY: groups[i].y, time: (cumWeight / totalWeight) * totalTime });
        cumWeight += weights[i];
      }
      map.push({ chordY: groups[n - 1].y + window.innerHeight, time: totalTime });
      chordMapRef.current = map;

      // Build section timeline: maps each [Label] to a time range and Y range.
      // Used by the rAF loop to identify which musical section is currently playing.
      // charPos of each group's first chord (to match against section marker positions)
      const groupFirstCharPos: number[] = [];
      let ci2 = 0;
      for (const g of groups) {
        groupFirstCharPos.push(chordCharPos[ci2] ?? 0);
        ci2 += g.count;
      }
      const timeline: SectionEntry[] = [];
      for (let si = 0; si < sectionMarkers.length; si++) {
        const marker = sectionMarkers[si];
        const firstGroupIdx = groupFirstCharPos.findIndex(cp => cp >= marker.charPos);
        if (firstGroupIdx < 0) continue;
        const startTime = map[firstGroupIdx].time;
        const startY = groups[firstGroupIdx].y;
        const nextMarker = sectionMarkers[si + 1];
        let endTime = totalTime;
        let endY = groups[n - 1].y + window.innerHeight;
        if (nextMarker) {
          const ng = groupFirstCharPos.findIndex(cp => cp >= nextMarker.charPos);
          if (ng >= 0) { endTime = map[ng].time; endY = groups[ng].y; }
        }
        timeline.push({ label: marker.label, isInstrumental: marker.instrumental, repeat: marker.repeat, startTime, endTime, startY, endY });
      }
      sectionTimelineRef.current = timeline;

      // ── Diagnóstico de timing ──────────────────────────────────────────────
      console.group(`[AutoScroll] ${cifra.title}`);
      console.log('Fonte totalTime :', dur != null ? `duration da API (${dur}s)` : `fallback BPM (bpm=${bpm}, tags=<b>×${bEls.length}) → ${totalTime.toFixed(1)}s`);
      console.log('totalTime       :', `${totalTime.toFixed(1)}s  (${(totalTime/60).toFixed(2)} min)`);
      console.log('Grupos de linhas:', n, '  Acordes totais (<b>):', bEls.length);
      console.log('Seções detectadas:', sectionMarkers.map(s => ({
        pos: s.charPos, label: s.label, instrumental: s.instrumental, repeat: s.repeat,
      })));
      console.log('Timeline de seções:', timeline.map(s => ({
        label: s.label, instr: s.isInstrumental, repeat: s.repeat,
        start: `${s.startTime.toFixed(1)}s`, end: `${s.endTime.toFixed(1)}s`,
        startY: s.startY.toFixed(0), endY: s.endY.toFixed(0),
      })));
      // Top-5 grupos com mais peso
      const ranked = weights
        .map((w, i) => ({ i, w, count: groups[i].count, time: map[i].time.toFixed(1) }))
        .sort((a, b) => b.w - a.w)
        .slice(0, 5);
      console.log('Top-5 grupos por peso:', ranked);
      // Distribuição por quarto da música
      const q = [0, 0.25, 0.5, 0.75, 1].map(frac => {
        const t = frac * totalTime;
        const entry = map.find(p => p.time >= t) ?? map[map.length - 1];
        return { pct: `${(frac*100).toFixed(0)}%`, t: `${t.toFixed(1)}s`, y: entry.chordY.toFixed(0) };
      });
      console.table(q);
      console.groupEnd();
      // ── fim diagnóstico ───────────────────────────────────────────────────
    });
    return () => cancelAnimationFrame(frame);
  }, [cifra, localBpm, previewTiming, bestTiming]);

  // Reset BPM/scroll/loop ao trocar de música
  useEffect(() => {
    setLocalBpm(null);
    setAutoScroll(false);
    setLoopA(null);
    setLoopB(null);
    setCurrentSection(null);
    prevSectionRef.current = null;
    sectionTimelineRef.current = [];
    window.scrollTo(0, 0);
  }, [artistSlug, songSlug]);

  // Fecha o mini-popup ao clicar fora dele (capture phase, sem roubar foco) ou ao rolar
  useEffect(() => {
    if (!lyricsPopup) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (lyricsPopupRef.current?.contains(e.target as Node)) return;
      setLyricsPopup(null);
    };
    const closeScroll = () => setLyricsPopup(null);
    document.addEventListener('click', close, true);
    document.addEventListener('touchstart', close, { capture: true, passive: true } as AddEventListenerOptions);
    window.addEventListener('scroll', closeScroll, { passive: true });
    return () => {
      document.removeEventListener('click', close, true);
      document.removeEventListener('touchstart', close, true);
      window.removeEventListener('scroll', closeScroll);
    };
  }, [lyricsPopup]);

  useEffect(() => {
    if (songSlug) fetchBestTiming(songSlug).then(setBestTiming).catch(() => {});
  }, [songSlug]);

  useEffect(() => {
    if (!songSlug) return;
    const stored = localStorage.getItem(`viola_preview_timing_${songSlug}`);
    if (!stored) { setPreviewTiming(null); return; }
    try { setPreviewTiming(JSON.parse(stored)); } catch { setPreviewTiming(null); }
  }, [songSlug]);

  const buildSeqData = (): SequenciaData => ({
    artistSlug: artistSlug || '',
    songSlug: songSlug || '',
    songTitle: cifra?.title || '',
    transposeOffset,
    selectedInstId,
    selectedTuningId,
    voicingFilter,
    variationIndices,
    lockedVariations,
    excludedFromFilter,
  });

  const refreshRecent = () => setRecentSeqs(getRecentSequencias());

  const handleSaveSeq = async (forceNew = false) => {
    if (!cifra) return;
    setIsSaving(true);
    setSeqError(null);
    try {
      const data = buildSeqData();
      let hash: string;
      if (savedHash && !forceNew) {
        await updateSequencia(savedHash, data);
        hash = savedHash;
      } else {
        const result = await saveSequencia(data);
        hash = result.hash;
        setSavedHash(hash);
      }
      addRecentSequencia({ hash, title: cifra.title, artistSlug: artistSlug || '', savedAt: new Date().toISOString() });
      refreshRecent();
    } catch (e) {
      setSeqError('Erro ao salvar. Tente novamente.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSeq = async (hash: string) => {
    if (!hash) return;
    setIsLoadingSeq(true);
    setSeqError(null);
    try {
      const result = await loadSequencia(hash);
      const d = result.data;
      setTransposeOffset(d.transposeOffset);
      setSelectedInstId(d.selectedInstId);
      setSelectedTuningId(d.selectedTuningId);
      setVoicingFilter(d.voicingFilter);
      setVariationIndices(d.variationIndices);
      setLockedVariations(d.lockedVariations);
      setExcludedFromFilter(d.excludedFromFilter as Record<string, true>);
      setSavedHash(hash);
      setSeqModalOpen(null);
      setLoadHashInput('');
    } catch (e) {
      setSeqError('Hash não encontrado ou inválido.');
      console.error(e);
    } finally {
      setIsLoadingSeq(false);
    }
  };

  const handleDeleteSeq = async (hash: string) => {
    try {
      await deleteSequencia(hash);
      removeRecentSequencia(hash);
      if (savedHash === hash) setSavedHash(null);
      refreshRecent();
    } catch (e) {
      setSeqError('Erro ao deletar.');
      console.error(e);
    }
  };

  const handleCopyHash = () => {
    if (!savedHash) return;
    navigator.clipboard.writeText(savedHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(console.error);
  };

  // Derive transformed HTML based on transpose offset
  const displayHtml = useMemo(() => {
    if (!cifra) return '';
    if (transposeOffset === 0) return cifra.content_html;

    return cifra.content_html.replace(/<b>(.*?)<\/b>/g, (match, chordName) => {
      const transposed = transposeChordString(chordName.trim(), transposeOffset, false);
      return `<b>${transposed}</b>`;
    });
  }, [cifra, transposeOffset]);

  // Split displayHtml into html/tab segments for the tab transposer
  const cifraSegments = useMemo<ContentSegment[]>(() => {
    if (!cifra) return [];
    const raw = splitHtmlByTabs(displayHtml);
    // Mescla tabs consecutivas (separadas apenas por html em branco) num único
    // bloco — assim uma tab quebrada em 2 partes vira 1 bloco (1 cabeçalho, compacto).
    const isBlankHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim() === '';
    const merged: ContentSegment[] = [];
    for (const seg of raw) {
      const last = merged[merged.length - 1];
      const prev = merged[merged.length - 2];
      if (seg.type === 'tab' && last?.type === 'tab') {
        last.content += '\n\n' + seg.content;
        continue;
      }
      if (seg.type === 'tab' && last?.type === 'html' && isBlankHtml(last.content) && prev?.type === 'tab') {
        merged.pop();
        merged[merged.length - 1].content += '\n\n' + seg.content;
        continue;
      }
      merged.push({ ...seg });
    }
    return merged.map(seg => seg.type === 'html' ? { ...seg, content: reflowCifraHtml(seg.content) } : seg);
  }, [displayHtml, cifra]);

  // Transposed unique chords for the carousel
  const currentChords = useMemo(() => {
    return originalChords.map(c => transposeChordString(c, transposeOffset, false));
  }, [originalChords, transposeOffset]);

  const currentInst = useMemo(
    () => PRESET_INSTRUMENTS.find(i => i.id === selectedInstId) || PRESET_INSTRUMENTS[0],
    [selectedInstId]
  );
  const currentTuning = useMemo(
    () => currentInst.tunings.find(t => t.id === selectedTuningId) || currentInst.tunings[0],
    [currentInst, selectedTuningId]
  );

  const isVertical = panelPosition === 'left' || panelPosition === 'right';
  const PANEL_ICONS: Record<typeof panelPosition, string> = { left: '◧', top: '▀', right: '◨', bottom: '▄' };
  const cyclePosition = () => setPanelPosition(p => ({ left: 'top', top: 'right', right: 'bottom', bottom: 'left' } as const)[p]);

  // Versão atualmente exibida (slug normalizado para comparar com o param da rota)
  const normSlug = (s?: string) => (s || '').replace(/^\//, '');
  // Opções do seletor: as versões carregadas ou, na ausência delas, a versão atual.
  // Sempre tem ao menos 1 entrada para que o controle apareça mesmo sem variações.
  const versionOptions = useMemo<Song[]>(() => {
    if (songVersions.length > 0) return songVersions;
    if (!cifra) return [];
    return [{ id: cifra.id, title: cifra.title, slug: normSlug(songSlug), version_name: cifra.version_name }];
  }, [songVersions, cifra, songSlug]);
  const currentVersionSlug = useMemo(() => {
    const match = versionOptions.find(s => normSlug(s.slug) === normSlug(songSlug));
    return match ? match.slug : (versionOptions[0]?.slug ?? '');
  }, [versionOptions, songSlug]);
  const handleVersionChange = (slug: string) => {
    navigate(`/cifras/${artistSlug}/${normSlug(slug)}`);
  };

  // Pré-computa todos os voicings (fora do .map para reutilizar no proximity sort)
  const allVoicings = useMemo(() => {
    // Notação brasileira: Bb6m → Bbm6, A7m → Am7, etc.
    const normSuffix = (n: string) => n.replace(/^([A-G][b#]?)(\d+)(m)$/, '$1$3$2');
    return currentChords.map(chordName => {
      const { root, suffix, bass } = parseChordString(normSuffix(chordName));
      if (!root) return [] as Voicing[];
      try {
        const chordObj = buildChord(root, suffix, bass || undefined);
        return calculateVoicings(currentTuning, chordObj, 12, { violaCebolao: selectedInstId === 'viola' });
      } catch { return [] as Voicing[]; }
    });
  }, [currentChords, currentTuning, selectedInstId]);

  const displayedVoicings = useMemo(() => {
    const { proximity, maxNotes, muteFilter, prioritizeEasy } = voicingFilter;
    const isDefault = !proximity && !maxNotes && muteFilter === 'any' && !prioritizeEasy;
    if (isDefault && Object.keys(excludedFromFilter).length === 0) return allVoicings;

    const countNotes = (v: Voicing) => v.frets.filter(f => f >= 0).length;

    const hasInternalMute = (v: Voicing): boolean => {
      let first = -1, last = -1;
      for (let s = 0; s < v.frets.length; s++) {
        if (v.frets[s] >= 0) { if (first === -1) first = s; last = s; }
      }
      if (first === -1 || first === last) return false;
      for (let s = first + 1; s < last; s++) { if (v.frets[s] < 0) return true; }
      return false;
    };

    // Filtro hard: remove voicings com barra, traste alto (>5) ou abafamento interno
    // Fallback para array original se nenhum voicing passar
    const filterEasy = (arr: Voicing[]): Voicing[] => {
      if (!prioritizeEasy) return arr;
      const easy = arr.filter(v => {
        if (v.barre) return false;
        const fretted = v.frets.filter(f => f > 0);
        return (fretted.length === 0 || Math.max(...fretted) <= 5) && !hasInternalMute(v);
      });
      return easy.length > 0 ? easy : arr;
    };

    // Acordes travados ou excluídos ficam com allVoicings (sem filtro aplicado)
    const isPassthrough = (i: number) =>
      lockedVariations[currentChords[i]] !== undefined || currentChords[i] in excludedFromFilter;

    // Excluídos também são pulados na cadeia de proximidade
    const findPrevRef = (i: number, result: Voicing[][]): { arr: Voicing[]; name: string } | null => {
      for (let j = i - 1; j >= 0; j--) {
        if (!(currentChords[j] in excludedFromFilter) && result[j].length > 0) {
          return { arr: result[j], name: currentChords[j] };
        }
      }
      return null;
    };

    const getEffIdx = (chordName: string, arr: Voicing[]): number =>
      (lockedVariations[chordName] ?? variationIndices[chordName] ?? 0) % arr.length;

    const compareStatic = (a: Voicing, b: Voicing): number => {
      if (maxNotes) { const d = countNotes(b) - countNotes(a); if (d !== 0) return d; }
      if (muteFilter === 'with_mute') { const d = Number(hasInternalMute(b)) - Number(hasInternalMute(a)); if (d !== 0) return d; }
      if (muteFilter === 'no_mute')   { const d = Number(hasInternalMute(a)) - Number(hasInternalMute(b)); if (d !== 0) return d; }
      return 0;
    };

    const compareWithProximity = (a: Voicing, b: Voicing, ref: Voicing): number => {
      const refAct = ref.frets.filter(f => f > 0);
      const refAvg = refAct.length ? refAct.reduce((x, y) => x + y, 0) / refAct.length : 0;
      let sharedA = 0, sharedB = 0;
      for (let s = 0; s < ref.frets.length; s++) {
        if (ref.frets[s] > 0 && a.frets[s] === ref.frets[s]) sharedA++;
        if (ref.frets[s] > 0 && b.frets[s] === ref.frets[s]) sharedB++;
      }
      if (sharedA !== sharedB) return sharedB - sharedA;
      const aAct = a.frets.filter(f => f > 0);
      const bAct = b.frets.filter(f => f > 0);
      const aAvg = aAct.length ? aAct.reduce((x, y) => x + y, 0) / aAct.length : 0;
      const bAvg = bAct.length ? bAct.reduce((x, y) => x + y, 0) / bAct.length : 0;
      const proxDiff = Math.abs(aAvg - refAvg) - Math.abs(bAvg - refAvg);
      if (proxDiff !== 0) return proxDiff;
      return compareStatic(a, b);
    };

    if (proximity && maxNotes) {
      const result: Voicing[][] = [];
      for (let i = 0; i < allVoicings.length; i++) {
        const raw = allVoicings[i];
        if (raw.length === 0 || isPassthrough(i)) { result.push(raw); continue; }

        const base = filterEasy(raw);
        const prevRef = findPrevRef(i, result);
        const proxSorted = prevRef
          ? [...base].sort((a, b) => compareWithProximity(a, b, prevRef.arr[getEffIdx(prevRef.name, prevRef.arr)]))
          : [...base].sort(compareStatic);
        const notesSorted = [...base].sort((a, b) => {
          const d = countNotes(b) - countNotes(a); if (d !== 0) return d;
          if (muteFilter === 'with_mute') { const md = Number(hasInternalMute(b)) - Number(hasInternalMute(a)); if (md !== 0) return md; }
          if (muteFilter === 'no_mute')   { const md = Number(hasInternalMute(a)) - Number(hasInternalMute(b)); if (md !== 0) return md; }
          return 0;
        });
        result.push([...proxSorted, ...notesSorted]);
      }
      return result;
    }

    if (proximity) {
      const result: Voicing[][] = [];
      for (let i = 0; i < allVoicings.length; i++) {
        const raw = allVoicings[i];
        if (raw.length === 0 || isPassthrough(i)) { result.push(raw); continue; }

        const base = filterEasy(raw);
        const prevRef = findPrevRef(i, result);
        result.push(prevRef
          ? [...base].sort((a, b) => compareWithProximity(a, b, prevRef.arr[getEffIdx(prevRef.name, prevRef.arr)]))
          : [...base].sort(compareStatic)
        );
      }
      return result;
    }

    return allVoicings.map((raw, i) => {
      if (raw.length === 0 || isPassthrough(i)) return raw;
      return [...filterEasy(raw)].sort(compareStatic);
    });
  }, [voicingFilter, allVoicings, variationIndices, currentChords, lockedVariations, excludedFromFilter]);

  const isFilterActive = voicingFilter.proximity || voicingFilter.maxNotes || voicingFilter.muteFilter !== 'any' || voicingFilter.prioritizeEasy;

  const lyricsVoicings: Voicing[] = lyricsPopup ? (() => {
    const cidx = currentChords.indexOf(lyricsPopup.chord);
    if (cidx >= 0) return displayedVoicings[cidx] ?? [];
    try {
      const { root, suffix, bass } = parseChordString(lyricsPopup.chord);
      if (!root) return [];
      return calculateVoicings(currentTuning, buildChord(root, suffix, bass || undefined), 12, { violaCebolao: selectedInstId === 'viola' });
    } catch { return []; }
  })() : [];
  const lyricsVidx = lyricsPopup
    ? (variationIndices[lyricsPopup.chord] ?? 0) % Math.max(lyricsVoicings.length, 1)
    : 0;
  const lyricsVoicing = lyricsVoicings[lyricsVidx] ?? null;

  const playLyricsChordSound = (voicing: Voicing) => {
    const engine = AudioEngine.getInstance();
    engine.ensureContext().then(() => {
      let delay = 0;
      for (let i = 0; i < currentTuning.strings.length; i++) {
        if (voicing.frets[i] === -1) continue;
        engine.playMidi(currentTuning.strings[i] + voicing.frets[i], 2.0, delay);
        delay += 0.035;
      }
    }).catch(console.error);
  };

  const cancelPopupClose = () => {
    if (popupCloseTimer.current) { clearTimeout(popupCloseTimer.current); popupCloseTimer.current = null; }
  };
  const schedulePopupClose = () => {
    cancelPopupClose();
    popupCloseTimer.current = setTimeout(() => setLyricsPopup(null), 180);
  };

  const showPopupForTarget = (target: HTMLElement) => {
    if (target.tagName !== 'B') return false;
    const chordName = target.textContent?.trim() ?? '';
    if (!chordName) return false;
    cancelPopupClose();
    if (chordName !== lyricsPopup?.chord) {
      const rect = target.getBoundingClientRect();
      setLyricsPopup({ chord: chordName, x: rect.left + rect.width / 2, y: rect.top });
    }
    return true;
  };

  const handleLyricsMouseOver = (e: React.MouseEvent) => {
    const hit = showPopupForTarget(e.target as HTMLElement);
    if (!hit && lyricsPopup) schedulePopupClose();
  };

  // Som no pointerdown: dispara antes dos listeners de capture/click
  // que fecham o popup, garantindo que lyricsVoicing ainda é válido
  const handleLyricsPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'B') return;
    cancelPopupClose();
    // Caso 1: popup já mostrado por hover → usa lyricsVoicing direto
    if (lyricsVoicing) { playLyricsChordSound(lyricsVoicing); return; }
    // Caso 2: clique sem hover prévio → calcula voicing do nome
    const chordName = target.textContent?.trim() ?? '';
    const cidx = currentChords.indexOf(chordName);
    const vArr = cidx >= 0 ? (displayedVoicings[cidx] ?? []) : [];
    const vidx = (variationIndices[chordName] ?? 0) % Math.max(vArr.length, 1);
    if (vArr[vidx]) playLyricsChordSound(vArr[vidx]);
  };

  // Click ainda atualiza a posição do popup (sem som — som já ocorreu no pointerdown)
  const handleLyricsChordClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'B') return;
    const chordName = target.textContent?.trim() ?? '';
    if (!chordName) return;
    cancelPopupClose();
    const rect = target.getBoundingClientRect();
    setLyricsPopup({ chord: chordName, x: rect.left + rect.width / 2, y: rect.top });
  };

  const effectiveBpm = localBpm ?? (cifra?.bpm ?? null);
  const bpmModified = localBpm !== null && localBpm !== cifra?.bpm;
  const durationStr = cifra?.duration != null
    ? `${Math.floor(cifra.duration / 60)}:${String(cifra.duration % 60).padStart(2, '0')}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-winxp-bg)] text-sm text-gray-600">
        Carregando cifra...
      </div>
    );
  }

  if (!cifra) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-winxp-bg)]">
        <h2 className="text-lg font-bold mb-2">Cifra não encontrada</h2>
        <button 
          onClick={() => navigate(-1)} 
          className="bevel-out bg-[var(--color-winxp-panel)] px-4 py-1 text-sm font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[var(--color-winxp-bg)] p-2 relative">
      
      {/* Info Popup Overlay */}
      {infoPopupChord && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-[#ece9d8] border border-white border-r-[#808080] border-b-[#808080] shadow-xl max-w-sm w-full p-4 bevel-out">
              <div className="flex justify-between items-center mb-4 winxp-gradient-blue text-white px-2 py-1 rounded">
                 <h3 className="font-bold text-sm">Informações do Acorde</h3>
                 <button onClick={() => setInfoPopupChord(null)} className="text-white hover:text-gray-200 text-xs font-bold bg-red-600 px-1 border border-white border-r-gray-500 border-b-gray-500 active:border-t-gray-500 active:border-l-gray-500 active:border-r-white active:border-b-white">X</button>
              </div>
              <p className="text-sm mb-3 font-bold text-[#002fa7]">
                 Acorde: {infoPopupChord}<br/>
                 Tom da Música: {transposeChordString(songKey, transposeOffset, false) || '?'}
              </p>
              {isChordDiatonic(infoPopupChord, transposeChordString(songKey, transposeOffset, false)) ? (
                <div className="bg-white text-black p-2 text-sm border-2 border-green-500 shadow-inner flex gap-2">
                   <span className="text-green-600 font-bold">✓</span>
                   <span>Este acorde <strong>faz parte</strong> (é diatônico) do tom da música.</span>
                </div>
              ) : (
                <div className="bg-white text-black p-2 text-sm border-2 border-[#cc3300] shadow-inner flex gap-2">
                   <span className="text-[#cc3300] font-bold">⚠️</span>
                   <span>Este acorde <strong>está fora</strong> do tom principal da música (pode ser de empréstimo ou passagem).</span>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Sequence Modal */}
      {seqModalOpen && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#ece9d8] bevel-out shadow-xl w-80 select-none">
            <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center justify-between font-bold text-sm">
              <div className="flex items-center gap-1.5">
                <Save size={13} />
                <span>Sequência de Acordes</span>
              </div>
              <button
                onClick={() => { setSeqModalOpen(null); setSeqError(null); }}
                className="bg-red-600 border border-white border-r-gray-600 border-b-gray-600 px-1.5 text-white font-bold leading-tight"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-400">
              <button
                onClick={() => { setSeqModalOpen('save'); setSeqError(null); }}
                className={`px-3 py-1 text-xs font-bold border-r border-gray-400 ${seqModalOpen === 'save' ? 'bg-[#ece9d8]' : 'bg-[#d4d0c8] hover:bg-[#e8e4d8]'}`}
              >
                Salvar
              </button>
              <button
                onClick={() => { setSeqModalOpen('load'); setSeqError(null); }}
                className={`px-3 py-1 text-xs font-bold ${seqModalOpen === 'load' ? 'bg-[#ece9d8]' : 'bg-[#d4d0c8] hover:bg-[#e8e4d8]'}`}
              >
                Carregar
              </button>
            </div>

            <div className="p-3 text-xs flex flex-col gap-2">
              {seqError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 text-[10px]">{seqError}</div>
              )}

              {seqModalOpen === 'save' && (
                <>
                  {savedHash ? (
                    <>
                      <p className="text-gray-600 text-[10px]">Sequência salva. Guarde o hash para editar depois:</p>
                      <div className="flex gap-1">
                        <input
                          readOnly
                          value={savedHash}
                          className="bevel-in bg-white px-2 py-0.5 text-[10px] font-mono flex-1 min-w-0 text-gray-800"
                        />
                        <button
                          onClick={handleCopyHash}
                          className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 font-bold hover:bg-white whitespace-nowrap text-[10px]"
                        >
                          {copied ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSaveSeq(false)}
                          disabled={isSaving}
                          className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-3 py-0.5 font-bold hover:bg-white flex-1 disabled:opacity-50 text-[10px]"
                        >
                          {isSaving ? 'Salvando...' : 'Atualizar'}
                        </button>
                        <button
                          onClick={() => handleSaveSeq(true)}
                          disabled={isSaving}
                          className="bevel-out bg-[#ece9d8] border border-gray-400 px-3 py-0.5 font-bold hover:bg-white flex-1 disabled:opacity-50 text-[10px]"
                        >
                          Salvar novo
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 text-[10px]">Salva instrumento, tom, filtros e variações fixadas. Um hash único será gerado.</p>
                      <button
                        onClick={() => handleSaveSeq(false)}
                        disabled={isSaving}
                        className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-3 py-1 font-bold hover:bg-white w-full disabled:opacity-50 text-[10px]"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar Sequência'}
                      </button>
                    </>
                  )}

                  {recentSeqs.length > 0 && (
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">Recentes:</p>
                      <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto retro-scrollbar">
                        {recentSeqs.map(seq => (
                          <div key={seq.hash} className="flex items-center gap-1 bg-white border border-gray-200 px-1 py-0.5">
                            <span className="flex-1 text-[10px] truncate">
                              {seq.title} <span className="text-gray-400 font-mono">({seq.hash.slice(0, 8)}…)</span>
                            </span>
                            <button
                              onClick={() => handleDeleteSeq(seq.hash)}
                              className="text-[9px] text-red-500 hover:text-red-700 font-bold shrink-0 px-0.5"
                              title="Deletar"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {seqModalOpen === 'load' && (
                <>
                  <p className="text-gray-600 text-[10px]">Digite o hash para carregar uma sequência salva:</p>
                  <div className="flex gap-1">
                    <input
                      value={loadHashInput}
                      onChange={e => setLoadHashInput(e.target.value.trim())}
                      onKeyDown={e => e.key === 'Enter' && handleLoadSeq(loadHashInput)}
                      placeholder="Cole o hash aqui..."
                      className="bevel-in bg-white px-2 py-0.5 text-[10px] font-mono flex-1 min-w-0 outline-none"
                    />
                    <button
                      onClick={() => handleLoadSeq(loadHashInput)}
                      disabled={!loadHashInput || isLoadingSeq}
                      className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-2 py-0.5 font-bold hover:bg-white disabled:opacity-50 whitespace-nowrap text-[10px]"
                    >
                      {isLoadingSeq ? '...' : 'Carregar'}
                    </button>
                  </div>

                  {recentSeqs.length > 0 && (
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">Recentes:</p>
                      <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto retro-scrollbar">
                        {recentSeqs.map(seq => (
                          <div key={seq.hash} className="flex items-center gap-1 bg-white border border-gray-200 px-1 py-0.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] truncate font-bold">{seq.title}</div>
                              <div className="text-[9px] text-gray-400 font-mono truncate">{seq.hash}</div>
                            </div>
                            <button
                              onClick={() => handleLoadSeq(seq.hash)}
                              disabled={isLoadingSeq}
                              className="text-[9px] font-bold bevel-out bg-[#ece9d8] border border-gray-400 px-1.5 py-0 hover:bg-white shrink-0 disabled:opacity-50"
                            >
                              Usar
                            </button>
                            <button
                              onClick={() => handleDeleteSeq(seq.hash)}
                              className="text-[9px] text-red-500 hover:text-red-700 font-bold shrink-0 px-0.5"
                              title="Deletar"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Window Header */}
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center justify-between font-bold text-sm mb-2 rounded-t select-none">
        <div className="flex items-center gap-2 truncate">
          <FileText size={16} />
          <span className="truncate">{cifra.title} - {artistSlug}</span>
        </div>
        <button 
          onClick={() => navigate(`/cifras/${artistSlug}`)}
          className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white shrink-0 ml-2"
        >
          Voltar
        </button>
      </div>

      {/* Preview timing banner */}
      {previewTiming && (
        <div className="bevel-out bg-[#d4edda] border border-green-500 px-3 py-1 text-xs flex items-center justify-between gap-2 shrink-0">
          <span className="font-bold text-[#155724]">
            🎵 Auto-scroll usando timing contribuído — BPM: {previewTiming.bpm}, duração: {Math.floor(previewTiming.duration / 60)}:{String(Math.round(previewTiming.duration % 60)).padStart(2, '0')}
          </span>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => navigate(`/cifras/${artistSlug}/${songSlug}/timing`)}
              className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-2 py-0 text-[10px] font-bold hover:bg-white"
            >
              Editar
            </button>
            <button
              onClick={() => { setPreviewTiming(null); if (songSlug) localStorage.removeItem(`viola_preview_timing_${songSlug}`); }}
              className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-400 px-1.5 py-0 text-[10px] font-bold hover:bg-white text-[#cc3300]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main layout container */}
      <div className={`flex-1 flex gap-2 min-h-0 ${isVertical ? 'flex-row' : 'flex-col'}`}>
        
        {/* ── Painel adaptativo (lateral ou horizontal) ── */}
        {isVertical ? (
          <aside className={`bevel-out bg-[var(--color-winxp-panel)] flex flex-col gap-1.5 p-2 shrink-0 overflow-y-auto text-xs w-44 ${panelPosition === 'right' ? 'order-last' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px] uppercase text-gray-500">Painel</span>
              <button onClick={cyclePosition} className="bevel-out bg-[var(--color-winxp-panel)] px-1 py-0 text-sm leading-none border border-gray-400" title="Mover painel">{PANEL_ICONS[panelPosition]}</button>
            </div>

            <div className="flex gap-2 text-[10px] text-gray-600">
              <span className="flex items-center gap-0.5"><Eye size={11} className="text-blue-600" /> {cifra.views || 1}</span>
              <span className="flex items-center gap-0.5"><Heart size={11} className="text-red-500" /> {cifra.favorited || 0}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-bold text-[10px] uppercase text-gray-500 shrink-0">Tom:</span>
              <span className="font-bold text-xs bg-white border border-gray-400 px-1 text-[#002fa7] min-w-[20px] text-center">{songKey || '?'}</span>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">Variações:</label>
              <select value={currentVersionSlug} onChange={(e) => handleVersionChange(e.target.value)} disabled={versionOptions.length <= 1} className="bevel-in bg-white px-1 py-0 text-xs w-full outline-none cursor-pointer disabled:opacity-60 disabled:cursor-default">
                {versionOptions.map(v => (<option key={v.id} value={v.slug}>{v.version_name || 'Principal'}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">Instrumento:</label>
              <select value={selectedInstId} onChange={(e) => { const newInst = PRESET_INSTRUMENTS.find(i => i.id === e.target.value); if (newInst) { setSelectedInstId(newInst.id); setSelectedTuningId(newInst.defaultTuningId || newInst.tunings[0].id); setTabPosIdx(0); } }} className="bevel-in bg-white px-1 py-0 text-xs w-full outline-none cursor-pointer">
                {PRESET_INSTRUMENTS.map(inst => (<option key={inst.id} value={inst.id}>{inst.name}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">Afinação:</label>
              <select value={selectedTuningId} onChange={(e) => setSelectedTuningId(e.target.value)} className="bevel-in bg-white px-1 py-0 text-xs w-full outline-none cursor-pointer">
                {currentInst.tunings.map(tuning => (<option key={tuning.id} value={tuning.id}>{tuning.name.split(' (')[0]}</option>))}
              </select>
            </div>

            <hr className="border-gray-300" />

            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">TOM:</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setTransposeOffset(p => p - 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">-½</button>
                <span className="font-mono text-xs font-bold flex-1 text-center text-[#cc3300]">{transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}</span>
                <button onClick={() => setTransposeOffset(p => p + 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">+½</button>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">POS.TAB:</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setTabPosIdx(p => (p - 1 + TAB_POSITIONS.length) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">◀</button>
                <span className="font-mono text-xs font-bold flex-1 text-center text-[#005500]">{TAB_POSITIONS[tabPosIdx].label}</span>
                <button onClick={() => setTabPosIdx(p => (p + 1) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">▶</button>
              </div>
            </div>

            <hr className="border-gray-300" />

            {/* BPM */}
            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500 flex items-center justify-between">
                <span>BPM {bpmModified && <span className="text-[#cc3300]">*</span>}</span>
                {cifra.bpm != null && <span className="font-normal text-gray-400 text-[9px]">API: {cifra.bpm}</span>}
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => setLocalBpm(p => Math.max(20, (p ?? effectiveBpm ?? 100) - 1))} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">−</button>
                <span className={`font-mono text-xs font-bold flex-1 text-center ${bpmModified ? 'text-[#cc3300]' : 'text-[#005500]'}`}>{effectiveBpm ?? '—'}</span>
                <button onClick={() => setLocalBpm(p => Math.min(300, (p ?? effectiveBpm ?? 100) + 1))} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">+</button>
              </div>
              {bpmModified && (
                <button onClick={() => setLocalBpm(null)} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-xs w-full border border-gray-400 hover:bg-white" title="Restaurar BPM da API">↺ Restaurar</button>
              )}
              {durationStr && <span className="text-[9px] text-gray-400 text-center">⏱ {durationStr}</span>}
              <button disabled className="bevel-out bg-[#f0f0f0] px-2 py-0.5 text-[9px] w-full border border-gray-300 text-gray-400 cursor-not-allowed" title="Em breve: contribua com BPM e duração para a comunidade">↑ Enviar BPM</button>
              <button onClick={() => navigate(`/cifras/${artistSlug}/${songSlug}/timing`)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-[9px] w-full border border-gray-400 font-bold hover:bg-white text-black">
                ✏️ Timing
              </button>
            </div>

            {/* Auto-scroll */}
            <div className="flex flex-col gap-0.5">
              <label className="font-bold text-[10px] uppercase text-gray-500">Rolar Auto:</label>
              <button onClick={handleToggleAutoScroll} className={`bevel-out px-2 py-1 text-xs font-bold w-full border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${autoScroll ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-black hover:bg-white'}`}>
                {autoScroll ? '⏸ Parar' : '▶ Rolar'}
              </button>
              <div className="flex gap-1">
                {([0.5, 1, 2] as const).map(m => (
                  <button key={m} onClick={() => setScrollMult(m)} className={`flex-1 text-[10px] font-bold py-0.5 border leading-tight ${scrollMult === m ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`}>{m}×</button>
                ))}
              </div>
            </div>

            {/* Loop A→B */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[10px] uppercase text-gray-500">Loop:</label>
                {(loopA !== null || loopB !== null) && (
                  <button onClick={() => { setLoopA(null); setLoopB(null); }} className="text-[9px] font-bold border border-gray-400 px-1 bg-[#ece9d8] hover:bg-white text-[#cc3300]">✕</button>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setLoopA(window.scrollY)} className={`flex-1 text-[10px] font-bold py-0.5 border leading-tight ${loopA !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`} title="Marcar ponto A na posição atual">{loopA !== null ? 'A ✓' : '[A]'}</button>
                <button onClick={() => setLoopB(window.scrollY)} className={`flex-1 text-[10px] font-bold py-0.5 border leading-tight ${loopB !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`} title="Marcar ponto B na posição atual">{loopB !== null ? 'B ✓' : '[B]'}</button>
              </div>
            </div>

            <hr className="border-gray-300" />

            <button onClick={() => setShowTabs(v => !v)} className={`bevel-out px-2 py-1 text-xs font-bold w-full text-left border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${!showTabs ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-black hover:bg-white'}`}>
              {showTabs ? 'Ocultar Tabs' : '▶ Mostrar Tabs'}
            </button>

            <button onClick={handleFavorite} disabled={isFavoriting} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 text-xs font-bold flex items-center gap-1 w-full border border-gray-400 hover:bg-white disabled:opacity-50 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black">
              <Heart size={12} className={`${isFavoriting ? 'opacity-50' : ''} ${cifra.favorited && cifra.favorited > 0 ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
              <span className={isFavoriting ? 'opacity-50' : ''}>Favoritar</span>
            </button>

            <button onClick={() => setSeqModalOpen('save')} className={`bevel-out px-2 py-1 text-xs font-bold flex items-center gap-1 w-full border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black ${savedHash ? 'bg-[#d4edda] border-green-500' : 'bg-[var(--color-winxp-panel)]'}`}>
              <Save size={11} className={savedHash ? 'text-green-700' : 'text-gray-600'} />
              <span>{savedHash ? 'Sequência ✓' : 'Sequência'}</span>
            </button>
          </aside>
        ) : (
          <div className={`bevel-out bg-[var(--color-winxp-panel)] p-1.5 sm:p-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-2 sm:gap-3 text-xs sm:text-sm shrink-0 ${panelPosition === 'bottom' ? 'order-last' : ''}`}>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 shrink-0">
              <button onClick={cyclePosition} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0 text-sm font-bold border border-gray-400" title="Mover painel">{PANEL_ICONS[panelPosition]}</button>
              <span className="text-gray-600 flex items-center gap-1 font-bold" title="Visualizações"><Eye size={16} className="text-blue-600" /> {cifra.views || 1}</span>
              <span className="text-gray-600 flex items-center gap-1 font-bold" title="Favoritos"><Heart size={16} className="text-red-500" /> {cifra.favorited || 0}</span>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-400/60" />

            {/* Grupo: Música (tom + versão) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 leading-none">Música</span>
              <div className="flex items-center gap-1.5 sm:gap-3 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar [&>*]:shrink-0">
                <div className="flex items-center gap-1">
                  <label className="hidden sm:inline font-bold text-[11px] uppercase tracking-wider text-gray-700">Tom:</label>
                  <span className="font-bold text-xs bg-white border border-gray-400 px-1 text-[#002fa7] min-w-[20px] text-center">{songKey || '?'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="hidden sm:inline font-bold text-[11px] uppercase tracking-wider text-gray-700">Variações:</label>
                  <select value={currentVersionSlug} onChange={(e) => handleVersionChange(e.target.value)} disabled={versionOptions.length <= 1} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[100px] sm:max-w-[120px] disabled:opacity-60 disabled:cursor-default">
                    {versionOptions.map(v => (<option key={v.id} value={v.slug}>{v.version_name || 'Principal'}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-400/60" />

            {/* Grupo: Instrumento (instrumento + afinação) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 leading-none">Instrumento</span>
              <div className="flex items-center gap-1.5 sm:gap-3 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar [&>*]:shrink-0">
                <div className="flex items-center gap-1">
                  <label className="hidden sm:inline font-bold text-[11px] uppercase tracking-wider text-gray-700">Instrumento:</label>
                  <select value={selectedInstId} onChange={(e) => { const newInst = PRESET_INSTRUMENTS.find(i => i.id === e.target.value); if (newInst) { setSelectedInstId(newInst.id); setSelectedTuningId(newInst.defaultTuningId || newInst.tunings[0].id); setTabPosIdx(0); } }} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[90px] sm:max-w-[100px]">
                    {PRESET_INSTRUMENTS.map(inst => (<option key={inst.id} value={inst.id}>{inst.name}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="hidden sm:inline font-bold text-[11px] uppercase tracking-wider text-gray-700">Afinação:</label>
                  <select value={selectedTuningId} onChange={(e) => setSelectedTuningId(e.target.value)} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[90px] sm:max-w-[100px]">
                    {currentInst.tunings.map(tuning => (<option key={tuning.id} value={tuning.id}>{tuning.name.split(' (')[0]}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-400/60" />

            {/* Grupo: Transposição (tom da execução + posição da tab) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 leading-none">Transposição</span>
              <div className="flex items-center gap-1.5 sm:gap-3 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar [&>*]:shrink-0">
                <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
                  <span className="hidden sm:inline text-[11px] font-bold px-1 text-gray-700">TOM:</span>
                  <button onClick={() => setTransposeOffset(p => p - 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white" title="Abaixar meio tom">-½</button>
                  <span className="font-mono text-xs font-bold w-6 text-center text-[#cc3300]">{transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}</span>
                  <button onClick={() => setTransposeOffset(p => p + 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white" title="Aumentar meio tom">+½</button>
                </div>
                <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
                  <span className="hidden sm:inline text-[11px] font-bold px-1 text-gray-700">POS.TAB:</span>
                  <button onClick={() => setTabPosIdx(p => (p - 1 + TAB_POSITIONS.length) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">◀</button>
                  <span className="font-mono text-xs font-bold min-w-[44px] text-center text-[#005500]">{TAB_POSITIONS[tabPosIdx].label}</span>
                  <button onClick={() => setTabPosIdx(p => (p + 1) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">▶</button>
                </div>
                <button onClick={() => setShowTabs(v => !v)} className={`bevel-out px-3 py-1 text-xs font-bold border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${!showTabs ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-[#002fa7]'}`}>{showTabs ? 'Tabs ▼' : 'Tabs ▶'}</button>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-400/60" />

            {/* Grupo: Reprodução (BPM, auto-rolar, velocidade, loop) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 leading-none">Reprodução</span>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar [&>*]:shrink-0">
                <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
                  <span className="hidden sm:inline text-[11px] font-bold px-1 text-gray-700">BPM:</span>
                  <button onClick={() => setLocalBpm(p => Math.max(20, (p ?? effectiveBpm ?? 100) - 1))} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">−</button>
                  <span className={`font-mono text-xs font-bold w-9 text-center ${bpmModified ? 'text-[#cc3300]' : 'text-[#005500]'}`}>{effectiveBpm != null ? `${effectiveBpm}${bpmModified ? '*' : ''}` : '—'}</span>
                  <button onClick={() => setLocalBpm(p => Math.min(300, (p ?? effectiveBpm ?? 100) + 1))} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">+</button>
                  {bpmModified && <button onClick={() => setLocalBpm(null)} className="bevel-out bg-[var(--color-winxp-panel)] px-1 py-0.5 text-xs border border-gray-400 hover:bg-white" title="Restaurar BPM da API">↺</button>}
                </div>
                <button onClick={handleToggleAutoScroll} className={`bevel-out px-3 py-1 text-xs font-bold border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${autoScroll ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-[#002fa7]'}`}>
                  {autoScroll ? '⏸' : '▶'} Rolar
                </button>
                {([0.5, 1, 2] as const).map(m => (
                  <button key={m} onClick={() => setScrollMult(m)} className={`text-[10px] font-bold px-1.5 py-1 border leading-tight ${scrollMult === m ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`}>{m}×</button>
                ))}
                <button onClick={() => setLoopA(window.scrollY)} className={`px-2 py-1 text-xs font-bold border leading-tight active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${loopA !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[var(--color-winxp-panel)] border-gray-400 hover:bg-white'}`} title="Marcar ponto A do loop">A</button>
                <button onClick={() => setLoopB(window.scrollY)} className={`px-2 py-1 text-xs font-bold border leading-tight active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${loopB !== null ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[var(--color-winxp-panel)] border-gray-400 hover:bg-white'}`} title="Marcar ponto B do loop">B</button>
                {(loopA !== null || loopB !== null) && (
                  <button onClick={() => { setLoopA(null); setLoopB(null); }} className="px-2 py-1 text-xs font-bold border border-gray-400 bg-[#ece9d8] text-[#cc3300] hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">✕ Loop</button>
                )}
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-400/60" />

            {/* Grupo: Ações (favoritar, sequência, contribuir timing) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 leading-none">Ações</span>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar [&>*]:shrink-0">
                <button onClick={handleFavorite} disabled={isFavoriting} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 sm:px-3 text-xs font-bold flex items-center gap-1 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black" title="Favoritar">
                  <Heart size={14} className={`${isFavoriting ? 'opacity-50' : ''} ${cifra.favorited && cifra.favorited > 0 ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
                  <span className={`hidden sm:inline ${isFavoriting ? 'opacity-50' : ''}`}>Favoritar</span>
                </button>
                <button onClick={() => setSeqModalOpen('save')} className={`bevel-out px-2 py-1 sm:px-3 text-xs font-bold flex items-center gap-1 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black ${savedHash ? 'bg-[#d4edda] border border-green-500' : 'bg-[var(--color-winxp-panel)]'}`} title="Salvar ou carregar sequência de acordes">
                  <Save size={13} className={savedHash ? 'text-green-700' : 'text-gray-600'} />
                  <span className="hidden sm:inline">{savedHash ? 'Sequência ✓' : 'Sequência'}</span>
                </button>
                <button onClick={() => navigate(`/cifras/${artistSlug}/${songSlug}/timing`)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 sm:px-3 text-xs font-bold border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black hover:bg-white" title="Contribuir timing">
                  ✏️ <span className="hidden sm:inline">Contribuir timing</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Área de conteúdo: carousel + cifra */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">

        {/* Carousel de Acordes Superior */}
        {currentChords.length > 0 && (
          <div className="bevel-out bg-[var(--color-winxp-panel)] p-1.5 sm:p-2 shrink-0 flex flex-col gap-1 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#002fa7] flex items-center gap-1">
                Acordes ({currentChords.length}) - {currentTuning.name}
              </span>
              <div className="flex gap-1 items-center relative">
                {isFilterActive && (
                  <button
                    onClick={() => { setVoicingFilter(DEFAULT_FILTER); setVariationIndices({}); setLockedVariations({}); setExcludedFromFilter({}); }}
                    className="text-[10px] font-bold border border-gray-400 px-2 py-0.5 bg-[#ece9d8] hover:bg-white text-[#cc3300]"
                    title="Restaurar todos os filtros ao padrão"
                  >
                    Restaurar
                  </button>
                )}
                <button
                  onClick={() => setFilterPopupOpen(p => !p)}
                  className={`text-[10px] font-bold border px-2 py-0.5 ${isFilterActive ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] text-black border-gray-400 hover:bg-white'}`}
                  title="Filtrar variações de acordes"
                >
                  {isFilterActive ? 'Filtros ▼' : 'Filtros ▽'}
                </button>
                {filterPopupOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setFilterPopupOpen(false)} />
                )}
                {filterPopupOpen && (
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88vw] max-w-xs sm:absolute sm:left-auto sm:top-full sm:right-0 sm:translate-x-0 sm:translate-y-0 sm:mt-1 sm:w-60 z-40 bg-[#ece9d8] bevel-out shadow-lg text-xs select-none max-h-[80vh] overflow-y-auto">
                    <div className="winxp-gradient-blue text-white px-2 py-1 sm:py-0.5 flex items-center justify-between font-bold">
                      <span>Filtrar Variações</span>
                      <button
                        onClick={() => setFilterPopupOpen(false)}
                        className="bg-red-600 border border-white border-r-gray-600 border-b-gray-600 px-2 py-0.5 sm:px-1.5 sm:py-0 text-white font-bold leading-tight"
                      >
                        ×
                      </button>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-gray-600 uppercase tracking-wider text-[9px] mb-1">Ordenação (combinável)</p>
                      <label className="flex items-center gap-2 py-1.5 sm:py-0.5 px-1 cursor-pointer hover:bg-white">
                        <input type="checkbox" checked={voicingFilter.proximity} className="accent-[#316ac5] w-4 h-4 sm:w-auto sm:h-auto"
                          onChange={e => { setVoicingFilter(f => ({ ...f, proximity: e.target.checked })); setVariationIndices({}); }} />
                        ★ Acordes próximos
                      </label>
                      <label className="flex items-center gap-2 py-1.5 sm:py-0.5 px-1 cursor-pointer hover:bg-white">
                        <input type="checkbox" checked={voicingFilter.maxNotes} className="accent-[#316ac5] w-4 h-4 sm:w-auto sm:h-auto"
                          onChange={e => { setVoicingFilter(f => ({ ...f, maxNotes: e.target.checked })); setVariationIndices({}); }} />
                        ♪ Mais notas soando
                      </label>
                      <p className="font-bold text-gray-600 uppercase tracking-wider text-[9px] mt-2 mb-1">Abafamento Interno</p>
                      {([
                        ['any',       'Qualquer'],
                        ['with_mute', '≈ Com abafamento'],
                        ['no_mute',   '○ Sem abafamento'],
                      ] as const).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-2 py-1.5 sm:py-0.5 px-1 cursor-pointer hover:bg-white">
                          <input type="radio" name="muteFilter" className="accent-[#316ac5] w-4 h-4 sm:w-auto sm:h-auto"
                            checked={voicingFilter.muteFilter === val}
                            onChange={() => { setVoicingFilter(f => ({ ...f, muteFilter: val })); setVariationIndices({}); }} />
                          {label}
                        </label>
                      ))}
                      <div className="border-t border-gray-400 mt-2 pt-2">
                        <label className="flex items-center gap-2 py-1.5 sm:py-0.5 px-1 cursor-pointer hover:bg-white">
                          <input type="checkbox" checked={voicingFilter.prioritizeEasy} className="accent-[#316ac5] w-4 h-4 sm:w-auto sm:h-auto"
                            onChange={e => { setVoicingFilter(f => ({ ...f, prioritizeEasy: e.target.checked })); setVariationIndices({}); }} />
                          Priorizar acordes fáceis
                        </label>
                        <p className="text-gray-400 px-1 text-[9px] leading-tight mt-0.5">Exibe só acordes sem barra, sem abafamento interno e até traste 5</p>
                      </div>
                      <div className="border-t border-gray-400 mt-2 pt-2 flex justify-end">
                        <button
                          onClick={() => { setVoicingFilter(DEFAULT_FILTER); setVariationIndices({}); setLockedVariations({}); setExcludedFromFilter({}); }}
                          className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-1 sm:py-0.5 hover:bg-white font-bold text-[10px]"
                        >
                          Restaurar padrão
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-1 sm:gap-2 overflow-x-auto retro-scrollbar py-2 items-center">
              {currentChords.map((chordName, idx) => {
                const voicings = displayedVoicings[idx] ?? [];
                const isChordLocked = chordName in lockedVariations;

                // Índice efetivo: respeita cadeado
                const rawIdx = variationIndices[chordName] ?? 0;
                const effectiveIdx = isChordLocked
                  ? (lockedVariations[chordName] ?? 0) % Math.max(voicings.length, 1)
                  : rawIdx % Math.max(voicings.length, 1);

                const generatedVoicing = voicings.length > 0 ? voicings[effectiveIdx] : null;
                // A user-edited shape (from the chord editor) overrides the generated one.
                const customFrets = customVoicings[chordName];
                const bestVoicing = customFrets
                  ? buildVoicingFromFrets(customFrets, currentTuning, false)
                  : generatedVoicing;

                const clearCustom = () => setCustomVoicings(prev => {
                  if (!(chordName in prev)) return prev;
                  const next = { ...prev };
                  delete next[chordName];
                  return next;
                });

                const handleNextVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isChordLocked) return;
                  clearCustom(); // arrows return to the generated variations
                  setVariationIndices(prev => ({ ...prev, [chordName]: rawIdx + 1 }));
                };

                const handlePrevVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isChordLocked) return;
                  clearCustom();
                  setVariationIndices(prev => ({
                    ...prev,
                    [chordName]: rawIdx === 0 ? voicings.length - 1 : rawIdx - 1,
                  }));
                };

                const isFav = !!favoriteChords[chordName];
                const toggleFav = () => setFavoriteChords(prev => ({ ...prev, [chordName]: !prev[chordName] }));

                const isChordExcluded = chordName in excludedFromFilter;

                const toggleLock = () => {
                  setLockedVariations(prev => {
                    const next = { ...prev };
                    if (isChordLocked) {
                      delete next[chordName];
                    } else if (generatedVoicing) {
                      // effectiveIdx is an index in displayedVoicings (sorted/filtered).
                      // After locking the chord becomes a passthrough using allVoicings (original order).
                      // We must store the index in allVoicings, not in the sorted array.
                      const allIdx = allVoicings[idx].indexOf(generatedVoicing);
                      next[chordName] = allIdx >= 0 ? allIdx : 0;
                    }
                    return next;
                  });
                };

                const toggleExclude = () => {
                  setExcludedFromFilter(prev => {
                    const next = { ...prev } as Record<string, true>;
                    if (isChordExcluded) delete next[chordName];
                    else next[chordName] = true;
                    return next;
                  });
                };

                return (
                  <div key={idx} className="bg-white bevel-in p-0.5 sm:p-1 flex flex-col items-center shrink-0 min-w-[56px] sm:min-w-[70px]">
                    {bestVoicing ? (
                      <FretboardDiagram
                        voicing={bestVoicing}
                        tuning={currentTuning}
                        chordName={chordName}
                        compact={true}
                        isFavorite={isFav}
                        onToggleFavorite={toggleFav}
                        isInCifra={false}
                        useFlats={false}
                        variationCurrentIndex={effectiveIdx}
                        variationTotal={voicings.length}
                        onNextVariation={handleNextVar}
                        onPrevVariation={handlePrevVar}
                        variationLocked={isChordLocked}
                        onInfoClick={() => setInfoPopupChord(chordName)}
                        infoActive={infoPopupChord === chordName}
                        onEditClick={() => bestVoicing && setEditorChord({ name: chordName, frets: bestVoicing.frets })}
                      />
                    ) : (
                      <div className="py-2 text-center text-[#cc3300] text-[10px] font-bold max-w-[90px] break-words leading-tight">
                        {chordName}
                      </div>
                    )}
                    <div className="flex gap-0.5 mt-0.5">
                      <button
                        onClick={toggleLock}
                        className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0 border leading-tight ${
                          isChordLocked
                            ? 'bg-[#316ac5] text-white border-[#316ac5]'
                            : 'bg-[#ece9d8] text-gray-500 border-gray-300 hover:bg-white'
                        }`}
                        title={isChordLocked ? 'Soltar variação fixada' : 'Fixar variação atual como âncora'}
                      >
                        <Pin size={9} className={isChordLocked ? 'fill-white' : ''} />
                        {isChordLocked ? 'Fixado' : 'Fixar'}
                      </button>
                      {isFilterActive && (
                        <button
                          onClick={toggleExclude}
                          className={`text-[9px] font-bold px-1.5 py-0 border leading-tight ${
                            isChordExcluded
                              ? 'bg-[#c06000] text-white border-[#c06000]'
                              : 'bg-[#ece9d8] text-gray-500 border-gray-300 hover:bg-white'
                          }`}
                          title={isChordExcluded ? 'Reaplicar filtro neste acorde' : 'Usar ordem padrão neste acorde'}
                        >
                          {isChordExcluded ? 'Padrão' : 'Filtro'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cifra Content - Notepad Style */}
        <div className="flex-1 min-h-0 flex gap-0.5 overflow-hidden">
          <div ref={contentRef} onPointerDown={handleLyricsPointerDown} onClick={handleLyricsChordClick} onMouseOver={handleLyricsMouseOver} onMouseLeave={schedulePopupClose} className="flex-1 min-w-0 min-h-0 bevel-in bg-white p-2 sm:p-4 retro-scrollbar font-mono text-sm leading-relaxed text-black overflow-x-hidden overflow-y-auto">
            {cifraSegments.map((seg, i) =>
              seg.type === 'tab' ? (
                showTabs ? (
                  <TabTransposerBlock
                    key={i}
                    originalText={seg.content}
                    targetStrings={currentTuning.strings}
                    targetLabel={`${currentInst.name} — ${currentTuning.name.split(' (')[0]}`}
                    extraSemitones={transposeOffset}
                    posIdx={tabPosIdx}
                  />
                ) : null
              ) : (
                <div
                  key={i}
                  className="cifra-viewer-content"
                  dangerouslySetInnerHTML={{ __html: seg.content }}
                />
              )
            )}
          </div>
          {/* Loop strip — mostra região A→B e posição atual */}
          {(loopA !== null || loopB !== null) && maxScroll > 0 && (
            <div className="w-3 shrink-0 bg-[#d4d0c8] bevel-in relative">
              <div
                className="absolute left-0 right-0 bg-[#316ac5] opacity-75 min-h-[2px]"
                style={{
                  top: `${((loopA ?? 0) / maxScroll) * 100}%`,
                  height: `${Math.max(2, (((loopB ?? maxScroll) - (loopA ?? 0)) / maxScroll) * 100)}%`,
                }}
              />
              <div
                className="absolute left-0 right-0 h-0.5 bg-[#cc3300]"
                style={{ top: `${scrollFrac * 100}%` }}
              />
            </div>
          )}
        </div>

        </div>{/* fim área de conteúdo */}

      </div>

      {/* Mini chord popup — aparece acima do acorde clicado na cifra */}
      {lyricsPopup && (() => {
        const POP_W = 104;
        const POP_H = 148;
        const vx = Math.max(4, Math.min(lyricsPopup.x - POP_W / 2, window.innerWidth - POP_W - 4));
        const above = lyricsPopup.y - POP_H - 8;
        const vy = above >= 4 ? above : lyricsPopup.y + 20;

        const svgW = 92, svgH = 88;
        const lPad = 12, rPad = 3, tPad = 13, bPad = 3;
        const boardW = svgW - lPad - rPad;
        const boardH = svgH - tPad - bPad;
        const numStr = currentTuning.strings.length;
        const sSp = numStr > 1 ? boardW / (numStr - 1) : boardW;
        const numFrets = 5;
        const fSp = boardH / numFrets;
        const frets = lyricsVoicing?.frets ?? [];
        const activeFrets = frets.filter(f => f > 0);
        const minFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
        const startFret = minFret > 1 ? minFret : 1;
        const sX = (i: number) => lPad + i * sSp;
        const dotFY = (f: number) => tPad + (f - startFret + 0.5) * fSp;

        const noteNames = lyricsVoicing
          ? frets.map((f, i) => {
              if (f === -1) return null;
              const midi = currentTuning.strings[i] + f;
              return NOTE_NAMES[(midi % 12 + 12) % 12];
            }).filter(Boolean)
          : [];
        const uniqueNotes = [...new Set(noteNames)].join(' ');

        return (
          <div
            ref={lyricsPopupRef}
            className="fixed z-50 bevel-out bg-[#ece9d8] shadow-xl select-none"
            style={{ left: vx, top: vy, width: POP_W }}
            onMouseEnter={cancelPopupClose}
            onMouseLeave={schedulePopupClose}
          >
            <div className="pt-1.5 pb-0 flex justify-center">
              {lyricsVoicing ? (
                <svg width={svgW} height={svgH}>
                  {startFret === 1 && (
                    <rect x={lPad} y={tPad - 3} width={boardW} height={3} fill="#333" />
                  )}
                  {startFret > 1 && (
                    <text x={lPad - 2} y={tPad + fSp * 0.5} textAnchor="end" fontSize={7} fill="#555" dominantBaseline="middle">{startFret}</text>
                  )}
                  {Array.from({ length: numFrets }, (_, k) => (
                    <line key={k} x1={lPad} y1={tPad + (k + 1) * fSp} x2={lPad + boardW} y2={tPad + (k + 1) * fSp} stroke="#bbb" strokeWidth={0.6} />
                  ))}
                  {Array.from({ length: numStr }, (_, i) => (
                    <line key={i} x1={sX(i)} y1={tPad} x2={sX(i)} y2={tPad + boardH} stroke="#777" strokeWidth={0.6} />
                  ))}
                  {frets.map((f, i) =>
                    f === 0 ? (
                      <circle key={i} cx={sX(i)} cy={tPad - 6} r={3.5} fill="none" stroke="#333" strokeWidth={0.9} />
                    ) : f === -1 ? (
                      <text key={i} x={sX(i)} y={tPad - 6} textAnchor="middle" fontSize={7} fill="#cc3300" dominantBaseline="middle">✕</text>
                    ) : null
                  )}
                  {frets.map((f, i) =>
                    f > 0 && f >= startFret && f < startFret + numFrets ? (
                      <circle key={i} cx={sX(i)} cy={dotFY(f)} r={Math.min(sSp * 0.37, 6)} fill="#002fa7" />
                    ) : null
                  )}
                </svg>
              ) : (
                <div className="h-[88px] flex items-center justify-center text-[10px] text-gray-400">—</div>
              )}
            </div>
            {uniqueNotes && (
              <div className="px-1.5 pb-0.5">
                <span className="text-[8px] text-gray-500 text-center font-mono leading-tight block">{uniqueNotes}</span>
              </div>
            )}
            {lyricsVoicings.length > 1 && (
              <div className="flex items-center justify-between px-1 pb-1 gap-0.5">
                <button
                  onClick={() => {
                    const total = lyricsVoicings.length;
                    const newIdx = (lyricsVidx - 1 + total) % total;
                    setVariationIndices(prev => ({ ...prev, [lyricsPopup.chord]: newIdx }));
                    playLyricsChordSound(lyricsVoicings[newIdx]);
                  }}
                  className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                >◀</button>
                <span className="text-[9px] font-bold text-gray-600">{lyricsVidx + 1}/{lyricsVoicings.length}</span>
                <button
                  onClick={() => {
                    const total = lyricsVoicings.length;
                    const newIdx = (lyricsVidx + 1) % total;
                    setVariationIndices(prev => ({ ...prev, [lyricsPopup.chord]: newIdx }));
                    playLyricsChordSound(lyricsVoicings[newIdx]);
                  }}
                  className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                >▶</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Floating auto-scroll control — canto inferior direito, sempre visível */}
      <div className="fixed bottom-4 right-4 z-50 bevel-out bg-[var(--color-winxp-panel)] border border-gray-500 shadow-xl px-2 py-1.5 flex items-center gap-2 text-xs select-none">
        <button
          onClick={handleToggleAutoScroll}
          className={`bevel-out px-3 py-1 font-bold border border-gray-400 min-w-[90px] text-center active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${autoScroll ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-[#002fa7] hover:bg-white'}`}
        >
          {autoScroll ? '⏸ Pausar' : '▶ Auto-Rolar'}
        </button>
        <div className="flex gap-0.5">
          {([0.5, 1, 2] as const).map(m => (
            <button
              key={m}
              onClick={() => setScrollMult(m)}
              className={`text-[10px] font-bold px-1.5 py-0.5 border leading-tight ${scrollMult === m ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`}
            >
              {m}×
            </button>
          ))}
        </div>
        {effectiveBpm != null && (
          <span className="font-mono text-[10px] font-bold text-[#005500] border-l border-gray-400 pl-1.5">♩ {effectiveBpm}</span>
        )}
        {(loopA !== null && loopB !== null) && (
          <span className="text-[10px] font-bold text-[#316ac5] border-l border-gray-400 pl-1.5">⟳ Loop</span>
        )}
        {currentSection && autoScroll && (
          <span
            className="text-[10px] font-bold text-[#660033] border-l border-gray-400 pl-1.5 max-w-[110px] truncate"
            title={currentSection}
          >
            {currentSection}
          </span>
        )}
      </div>

      {/* Linha de leitura — guia visual a 30% da viewport enquanto auto-scroll está ativo */}
      {autoScroll && (
        <div
          className="fixed left-0 right-0 pointer-events-none z-40 border-t-2 border-[#316ac5] opacity-30"
          style={{ top: '30vh' }}
        />
      )}

      {editorChord && (
        <ChordEditorModal
          chordName={editorChord.name}
          tuning={currentTuning}
          instrument={currentInst}
          initialFrets={editorChord.frets}
          onApply={(frets) => setCustomVoicings(prev => ({ ...prev, [editorChord.name]: frets }))}
          onClose={() => setEditorChord(null)}
        />
      )}
    </div>
  );
};

