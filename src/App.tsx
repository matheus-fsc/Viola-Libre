/*
 * Viola Libre — o cifrário aberto e matemático da música de raiz
 * Copyright (C) 2026 Matheus Coelho
 * Licenciado sob a GNU AGPL-3.0 — veja o arquivo LICENSE na raiz do projeto.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Instrument, Tuning, Voicing } from './engine/types';
import { PRESET_INSTRUMENTS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from './engine/tunings';
import { buildChord, buildVoicingFromFrets, calculateVoicings, shouldUseFlats, noteNameToPitchClass, evaluatePlayability } from './engine/chordCalculator';
import { InstrumentSelector } from './components/InstrumentSelector';
import { ChordFinder } from './components/ChordFinder';
import { FretboardDiagram, IconNotepad, IconCopy, IconTrash } from './components/FretboardDiagram';
import { ChordEditorModal } from './components/ChordEditorModal';
import { InteractiveFretboard } from './components/InteractiveFretboard';
import { ScaleTrainer } from './components/ScaleTrainer';
import { TheoryGuide } from './components/TheoryGuide';
import { EarTranscription } from './components/EarTranscription';
import { ViolaDuets } from './components/ViolaDuets';
import { StarIcon } from './components/Icons';
import { EditorLoginModal } from './components/EditorLoginModal';
import { InstrumentOnboardingModal } from './components/InstrumentOnboardingModal';
import {
  getStoredEditorSession,
  type EditorSession,
  type ChordRankEntry,
  buildChordId,
  getChordRankings,
  pickCuratedVoicings,
  applyCurationOrder,
  rankChord,
} from './services/authApi';
import { getPreferredInstrumentId, setPreferredInstrumentId } from './utils/instrumentPreference';
import { preloadSoundfont } from './engine/AudioEngine';
import { CifrasApp } from './pages/cifras/CifrasApp';
import { MinhasCifras } from './pages/minhasCifras/MinhasCifras';
import { TermosDeUso } from './pages/termos/TermosDeUso';


const IconInfo: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <circle cx="8" cy="8" r="7" fill="#3a8bfb" stroke="#0058e6" strokeWidth="1"/>
    <circle cx="8" cy="4" r="1.2" fill="#ffffff"/>
    <line x1="8" y1="6.5" x2="8" y2="12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconHelp: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <circle cx="8" cy="8" r="7" stroke="#333333" strokeWidth="1.5"/>
    <path d="M5.5 6a2.5 2.5 0 0 1 5 0c0 1.25-1 2-2 2s-1 1-1 1.5M8 12.5h.01" stroke="#333333" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

interface FavoriteVoicing {
  id: string; // instrumentId-tuningId-chordName-fretsJoined
  chordName: string;
  instrumentName: string;
  tuningName: string;
  frets: number[];
  notes: string[];
  score: number;
}

function App() {
  // Navigation & View States
  const [selectedInst, setSelectedInst] = useState<Instrument>(() => {
    const savedId = getPreferredInstrumentId();
    return PRESET_INSTRUMENTS.find(i => i.id === savedId) || PRESET_INSTRUMENTS[0];
  });
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(() => {
    const savedId = getPreferredInstrumentId();
    const inst = PRESET_INSTRUMENTS.find(i => i.id === savedId) || PRESET_INSTRUMENTS[0];
    return inst.tunings.find(t => t.id === inst.defaultTuningId) || inst.tunings[0];
  });

  // Popup de primeira sessão (ou localStorage limpo) pedindo o instrumento preferido
  const [showInstrumentOnboarding, setShowInstrumentOnboarding] = useState<boolean>(
    () => getPreferredInstrumentId() === null
  );
  const handleInstrumentOnboardingSelect = (inst: Instrument) => {
    setSelectedInst(inst);
    setSelectedTuning(inst.tunings.find(t => t.id === inst.defaultTuningId) || inst.tunings[0]);
    setPreferredInstrumentId(inst.id);
    setShowInstrumentOnboarding(false);
  };
  const handleInstrumentOnboardingSkip = () => {
    setPreferredInstrumentId(PRESET_INSTRUMENTS[0].id);
    setShowInstrumentOnboarding(false);
  };
  
  const [rootName, setRootName] = useState<string>("D");
  const [suffix, setSuffix] = useState<string>(""); // default Major
  const [bassName, setBassName] = useState<string>(""); // default none
  const [customNotes, setCustomNotes] = useState<number[]>([]); // custom notes selected

  // Chord search advanced filters
  const [minFretFilter, setMinFretFilter] = useState<number>(0);
  const [interiorMuteFilter, setInteriorMuteFilter] = useState<'all' | 'hide'>('all');
  const [visibleVariationsLimit, setVisibleVariationsLimit] = useState<number>(20);
  const [editorFrets, setEditorFrets] = useState<number[] | null>(null);

  // Derive Voicings reactively when tuning, instrument, root, suffix or bass changes (pure useMemo, no state/useEffect needed)
  const activeVoicings = useMemo(() => {
    if (!rootName) {
      return [];
    }
    try {
      const chord = buildChord(rootName, suffix, bassName || undefined);
      if (customNotes.length > 0) {
        chord.customNotes = customNotes;
        chord.notes = Array.from(new Set([...chord.notes, ...customNotes]));
      }
      return calculateVoicings(selectedTuning, chord, 12, { violaCebolao: selectedInst.id === 'viola' });
    } catch (err) {
      console.error("Erro ao calcular posições de acordes:", err);
      return [];
    }
  }, [selectedTuning, selectedInst, rootName, suffix, bassName, customNotes]);

  // Apply search filters dynamically to the generated voicings
  const filteredVoicings = useMemo(() => {
    return activeVoicings.filter(voicing => {
      const frettedFrets = voicing.frets.filter(f => f > 0);
      const startFret = frettedFrets.length > 0 ? Math.min(...frettedFrets) : 1;

      if (minFretFilter > 0 && startFret < minFretFilter) return false;
      if (interiorMuteFilter === 'hide' && voicing.hasInteriorMute) return false;

      return true;
    });
  }, [activeVoicings, minFretFilter, interiorMuteFilter]);


  // Aquece o soundfont do instrumento preferido em idle (após os gets iniciais),
  // pra o primeiro clique num acorde na página de cifra não travar baixando ~1-2MB.
  // requestIdleCallback garante que não compete com o load nem com os gets do Orange.
  useEffect(() => {
    const prefId = getPreferredInstrumentId();
    const name = prefId === 'viola' ? 'acoustic_guitar_steel'
               : prefId === 'piano' ? 'acoustic_grand_piano'
               : 'acoustic_guitar_nylon';
    const hasRIC = typeof window.requestIdleCallback === 'function';
    const handle = hasRIC
      ? window.requestIdleCallback(() => preloadSoundfont(name), { timeout: 5000 })
      : window.setTimeout(() => preloadSoundfont(name), 3000);
    return () => {
      if (hasRIC) window.cancelIdleCallback(handle as number);
      else window.clearTimeout(handle as number);
    };
  }, []);

  // Reset visual limit when search parameters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleVariationsLimit(20);
  }, [rootName, suffix, bassName, customNotes, minFretFilter, interiorMuteFilter, selectedTuning]);
  
  // Interactive Neck load state
  const [interactiveLoadedFrets, setInteractiveLoadedFrets] = useState<number[]>([]);
  
  // Favorites State (persisted in localStorage)
  const [favorites, setFavorites] = useState<FavoriteVoicing[]>(() => {
    const stored = localStorage.getItem('viola_libre_favs');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Erro ao carregar favoritos:", e);
      }
    }
    return [];
  });
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  
  // Custom Song Chord Sheet (Cifra) State
  const [cifraVoicings, setCifraVoicings] = useState<FavoriteVoicing[]>(() => {
    const stored = localStorage.getItem('viola_libre_cifra');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Erro ao carregar cifra:", e);
      }
    }
    return [];
  });
  const [showCifraWindow, setShowCifraWindow] = useState<boolean>(false);

  // Editor Login State
  const [showEditorLogin, setShowEditorLogin] = useState<boolean>(false);
  const [editorSession, setEditorSession] = useState<EditorSession | null>(() => getStoredEditorSession());

  // Tab switcher — derived from URL
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = ((): 'cifras' | 'minhascifras' | 'chords' | 'train' | 'ear' | 'favorites' | 'termos' => {
    if (pathname === '/termos') return 'termos';
    if (pathname.startsWith('/cifras')) return 'cifras';
    if (pathname === '/minhascifras') return 'minhascifras';
    if (pathname === '/chords') return 'chords';
    if (pathname === '/treinos') return 'train';
    if (pathname === '/ouvido') return 'ear';
    if (pathname === '/favoritos') return 'favorites';
    return 'cifras';
  })();
  const isTimingRoute = /\/cifras\/[^/]+\/[^/]+\/timing$/.test(pathname);

  // Taskbar collapse state
  const [isTaskbarCollapsed, setIsTaskbarCollapsed] = useState(false);

  // Layout states for hybrid window / docked visualizer
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isDocked, setIsDocked] = useState(true); // Docked by default
  const [isMinimized, setIsMinimized] = useState(false); // Default to docked/expanded (colada) as requested!
  const [editorHeight, setEditorHeight] = useState(380); // Altura do painel do sequenciador (sincronizado com o painel)

  // Sync: when editor is docked+open+expanded, hide taskbar to free space
  // Sync: when editor is docked+open+minimized, restore taskbar
  const prevDockedExpandedRef = React.useRef(false);
  useEffect(() => {
    if (!isDocked || !isEditorOpen || activeTab !== 'ear') {
      // Not in ear tab or not docked — restore taskbar if we had hidden it
      if (prevDockedExpandedRef.current) {
        setIsTaskbarCollapsed(false);
        prevDockedExpandedRef.current = false;
      }
      return;
    }
    const isExpanded = !isMinimized;
    if (isExpanded && !prevDockedExpandedRef.current) {
      // Editor just expanded — hide taskbar
      setIsTaskbarCollapsed(true);
      prevDockedExpandedRef.current = true;
    } else if (!isExpanded && prevDockedExpandedRef.current) {
      // Editor just minimized — show taskbar
      setIsTaskbarCollapsed(false);
      prevDockedExpandedRef.current = false;
    }
  }, [isMinimized, isDocked, isEditorOpen, activeTab]);

  // Timing editor wants maximum vertical space for the timeline — hide the taskbar on entry,
  // restore it on exit (user can still toggle it back manually via the collapse tab).
  const prevTimingRouteRef = React.useRef(false);
  useEffect(() => {
    if (isTimingRoute && !prevTimingRouteRef.current) {
      setIsTaskbarCollapsed(true);
    } else if (!isTimingRoute && prevTimingRouteRef.current) {
      setIsTaskbarCollapsed(false);
    }
    prevTimingRouteRef.current = isTimingRoute;
  }, [isTimingRoute]);

  // Reverse sync: if taskbar is manually shown while editor is docked+expanded, minimize editor
  const prevTaskbarCollapsedRef = React.useRef(false);
  useEffect(() => {
    const wasCollapsed = prevTaskbarCollapsedRef.current;
    prevTaskbarCollapsedRef.current = isTaskbarCollapsed;
    // Only react when taskbar goes from collapsed → expanded (user opened it)
    if (wasCollapsed && !isTaskbarCollapsed && isDocked && isEditorOpen && !isMinimized && activeTab === 'ear') {
      setIsMinimized(true);
    }
  }, [isTaskbarCollapsed, isDocked, isEditorOpen, isMinimized, activeTab]);

  // Taskbar Clock State
  const [time, setTime] = useState<string>("");

  // Update Clock in taskbar
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);



  const handleInstrumentChange = (inst: Instrument) => {
    setSelectedInst(inst);
    // Automatically select the default tuning for this instrument
    const defaultTuning = inst.tunings.find(t => t.id === inst.defaultTuningId) || inst.tunings[0];
    setSelectedTuning(defaultTuning);
  };

  const handleTuningChange = (tuning: Tuning) => {
    setSelectedTuning(tuning);
  };

  const handleCustomTuningChange = (newStrings: number[]) => {
    // Create a temporary custom tuning
    const customTuning: Tuning = {
      id: `custom-${Date.now()}`,
      name: `Personalizada (${newStrings.length} cordas)`,
      strings: newStrings
    };
    setSelectedTuning(customTuning);
  };

  const handleChordChange = (newRoot: string, newSuffix: string, newBass: string = "", newCustomNotes: number[] = []) => {
    setRootName(newRoot);
    setSuffix(newSuffix);
    setBassName(newBass);
    setCustomNotes(newCustomNotes);
  };

  // Toggle voicing in favorites
  const toggleFavorite = (voicing: Voicing) => {
    const customNotesNames = customNotes.map(n => useFlats ? NOTE_NAMES_FLAT[n] : NOTE_NAMES_SHARP[n]).join(',');
    const chordDisplayName = `${rootName}${suffix}${bassName ? `/${bassName}` : ''}${customNotes.length > 0 ? ` + [${customNotesNames}]` : ''}`;
    const id = `${selectedInst.id}-${selectedTuning.id}-${chordDisplayName}-${voicing.frets.join(',')}`;
    const exists = favorites.some(fav => fav.id === id);

    let updated: FavoriteVoicing[];
    if (exists) {
      updated = favorites.filter(fav => fav.id !== id);
    } else {
      updated = [
        ...favorites,
        {
          id,
          chordName: chordDisplayName,
          instrumentName: selectedInst.name,
          tuningName: selectedTuning.name,
          frets: voicing.frets,
          notes: voicing.notes,
          score: voicing.score
        }
      ];
    }
    setFavorites(updated);
    localStorage.setItem('viola_libre_favs', JSON.stringify(updated));
  };

  const isVoicingFavorited = (voicing: Voicing) => {
    const customNotesNames = customNotes.map(n => useFlats ? NOTE_NAMES_FLAT[n] : NOTE_NAMES_SHARP[n]).join(',');
    const chordDisplayName = `${rootName}${suffix}${bassName ? `/${bassName}` : ''}${customNotes.length > 0 ? ` + [${customNotesNames}]` : ''}`;
    const id = `${selectedInst.id}-${selectedTuning.id}-${chordDisplayName}-${voicing.frets.join(',')}`;
    return favorites.some(fav => fav.id === id);
  };

  const toggleCifraVoicing = (voicing: Voicing) => {
    const customNotesNames = customNotes.map(n => useFlats ? NOTE_NAMES_FLAT[n] : NOTE_NAMES_SHARP[n]).join(',');
    const chordDisplayName = `${rootName}${suffix}${bassName ? `/${bassName}` : ''}${customNotes.length > 0 ? ` + [${customNotesNames}]` : ''}`;
    const id = `${selectedInst.id}-${selectedTuning.id}-${chordDisplayName}-${voicing.frets.join(',')}`;
    const exists = cifraVoicings.some(c => c.id === id);

    let updated: FavoriteVoicing[];
    if (exists) {
      updated = cifraVoicings.filter(c => c.id !== id);
    } else {
      updated = [
        ...cifraVoicings,
        {
          id,
          chordName: chordDisplayName,
          instrumentName: selectedInst.name,
          tuningName: selectedTuning.name,
          frets: voicing.frets,
          notes: voicing.notes,
          score: voicing.score
        }
      ];
    }
    setCifraVoicings(updated);
    localStorage.setItem('viola_libre_cifra', JSON.stringify(updated));
  };

  const isVoicingInCifra = (voicing: Voicing) => {
    const customNotesNames = customNotes.map(n => useFlats ? NOTE_NAMES_FLAT[n] : NOTE_NAMES_SHARP[n]).join(',');
    const chordDisplayName = `${rootName}${suffix}${bassName ? `/${bassName}` : ''}${customNotes.length > 0 ? ` + [${customNotesNames}]` : ''}`;
    const id = `${selectedInst.id}-${selectedTuning.id}-${chordDisplayName}-${voicing.frets.join(',')}`;
    return cifraVoicings.some(c => c.id === id);
  };

  // Load a favorited voicing configuration back to the active finder and interactive neck
  const loadFavorite = (fav: FavoriteVoicing) => {
    // 1. Restore instrument
    const inst = PRESET_INSTRUMENTS.find(i => i.name === fav.instrumentName);
    if (inst) {
      setSelectedInst(inst);
    }

    // 2. Restore tuning
    // If it's a custom tuning, create one, otherwise find standard preset
    if (fav.tuningName.startsWith('Personalizada')) {
      const tuning = inst?.tunings.find(t => t.name === fav.tuningName);
      if (tuning) setSelectedTuning(tuning);
    } else {
      const tuning = inst?.tunings.find(t => t.name === fav.tuningName);
      if (tuning) {
        setSelectedTuning(tuning);
      }
    }

    // 3. Load frets to interactive board
    setInteractiveLoadedFrets([...fav.frets]);

    // 4. Try parsing chordName to set root, suffix, bass and customNotes
    let parsedRoot: string;
    let parsedSuffix: string;
    let parsedBass = "";
    let parsedCustomNotes: number[] = [];
    
    let baseChordName = fav.chordName;
    if (baseChordName.includes(" + [")) {
      const parts = baseChordName.split(" + [");
      baseChordName = parts[0];
      const customStr = parts[1].replace("]", "");
      if (customStr) {
        parsedCustomNotes = customStr.split(",").map(name => {
          try {
            return noteNameToPitchClass(name);
          } catch {
            return -1;
          }
        }).filter(n => n !== -1);
      }
    }

    if (baseChordName.includes("/")) {
      const parts = baseChordName.split("/");
      baseChordName = parts[0];
      parsedBass = parts[1];
    }
    
    if (baseChordName.startsWith("C#") || baseChordName.startsWith("D#") || baseChordName.startsWith("F#") || baseChordName.startsWith("G#") || baseChordName.startsWith("A#") ||
        baseChordName.startsWith("Db") || baseChordName.startsWith("Eb") || baseChordName.startsWith("Gb") || baseChordName.startsWith("Ab") || baseChordName.startsWith("Bb")) {
      parsedRoot = baseChordName.slice(0, 2);
      parsedSuffix = baseChordName.slice(2);
    } else {
      parsedRoot = baseChordName.slice(0, 1);
      parsedSuffix = baseChordName.slice(1);
    }

    setRootName(parsedRoot);
    setSuffix(parsedSuffix);
    setBassName(parsedBass);
    setCustomNotes(parsedCustomNotes);
  };

  const clearFavorites = () => {
    setFavorites([]);
    localStorage.removeItem('viola_libre_favs');
  };

  const useFlats = shouldUseFlats(rootName);

  const customNotesNames = customNotes.map(n => useFlats ? NOTE_NAMES_FLAT[n] : NOTE_NAMES_SHARP[n]).join(',');
  const chordDisplayName = `${rootName}${suffix}${bassName ? `/${bassName}` : ''}${customNotes.length > 0 ? ` + [${customNotesNames}]` : ''}`;

  // Editor curation: which voicing (if any) has been ranked by editors as the global
  // default for this chord on this instrument+tuning. Dictionary curation has no song
  // context, so it always uses the global (song_slug = null) scope.
  const dictionaryChordId = rootName ? buildChordId(selectedInst.id, selectedTuning.id, chordDisplayName) : null;
  const [chordRankings, setChordRankings] = useState<ChordRankEntry[]>([]);

  useEffect(() => {
    // Clear synchronously on every chord change — otherwise the previous chord's
    // rankings stay in state during the fetch and can flash a false "curado" badge
    // on the new chord's cards if a frets_array happens to coincide.
    setChordRankings([]);
    if (!dictionaryChordId) return;
    let cancelled = false;
    getChordRankings(dictionaryChordId)
      .then(entries => { if (!cancelled) setChordRankings(entries); })
      .catch(() => { if (!cancelled) setChordRankings([]); });
    return () => { cancelled = true; };
  }, [dictionaryChordId]);

  const curatedVoicings = useMemo(() => pickCuratedVoicings(chordRankings), [chordRankings]);

  const orderedVoicings = useMemo(() => {
    return applyCurationOrder(
      filteredVoicings,
      curatedVoicings.map(c => c.fretsArray),
      (fretsArray) => buildVoicingFromFrets(fretsArray, selectedTuning, false)
    );
  }, [filteredVoicings, curatedVoicings, selectedTuning]);

  const [curatingKey, setCuratingKey] = useState<string | null>(null);

  const handleCurateChord = async (voicing: Voicing) => {
    if (!editorSession || !dictionaryChordId) return;
    const key = voicing.frets.join(',');
    setCuratingKey(key);
    try {
      await rankChord(dictionaryChordId, voicing.frets);
      const entries = await getChordRankings(dictionaryChordId, { forceRefresh: true });
      setChordRankings(entries);
    } catch (err) {
      console.error('Falha ao curar acorde:', err);
    } finally {
      setCuratingKey(null);
    }
  };

  // Lets the curator explicitly order the shortlist of curated variations (instead of
  // it silently following recency). Swaps two neighbors and re-stamps the WHOLE curated
  // list with a fresh descending score ladder, so the new order is unambiguous — a
  // partial/relative score nudge could be masked by another editor's higher score_boost.
  const handleReorderCurated = async (fretsArray: number[], direction: -1 | 1) => {
    if (!editorSession || !dictionaryChordId) return;
    const idx = curatedVoicings.findIndex(c => c.fretsArray.join(',') === fretsArray.join(','));
    const otherIdx = idx + direction;
    if (idx === -1 || otherIdx < 0 || otherIdx >= curatedVoicings.length) return;
    const reordered = [...curatedVoicings];
    [reordered[idx], reordered[otherIdx]] = [reordered[otherIdx], reordered[idx]];
    const key = fretsArray.join(',');
    setCuratingKey(key);
    try {
      await Promise.all(
        reordered.map((c, i) => rankChord(dictionaryChordId, c.fretsArray, { scoreBoost: reordered.length - i }))
      );
      const entries = await getChordRankings(dictionaryChordId, { forceRefresh: true });
      setChordRankings(entries);
    } catch (err) {
      console.error('Falha ao reordenar curadoria:', err);
    } finally {
      setCuratingKey(null);
    }
  };

  // Calcula o paddingBottom dinâmico da página com base no estado atual do sequenciador fixo.
  // Isso garante que o scroll da página sempre alcance o conteúdo abaixo do painel.
  // Só se aplica na aba 'ear' (onde o painel docked do EarTranscription existe de verdade) — sem
  // esse gate, toda outra aba (incl. a rota de timing) herdava até ~388px de padding-bottom
  // órfão reservado pro painel de outra aba, sobrando como espaço vazio (teal) no fim da tela.
  const taskbarH = isTaskbarCollapsed ? 0 : 40;
  const sequencerPad = activeTab === 'ear' && isEditorOpen && isDocked
    ? (isMinimized ? 35 + taskbarH + 8 : editorHeight + taskbarH + 8)
    : 48; // padding padrão quando flutuante, fechado, ou fora da aba 'ear'

  return (
    <div
      className="min-h-screen flex flex-col justify-between overflow-x-hidden font-sans select-none relative"
      style={{ paddingBottom: sequencerPad }}
    >

      {/* --- DESKTOP WINDOW CONTAINER --- */}
      {/* Timing route wants the editor to fill the full viewport (width included) — the
          max-w-7xl cap + outer padding is the "windowed desktop" look every other tab keeps,
          but it left the timing editor centered in a box with teal desktop bleeding through on
          the sides on wide screens. */}
      <div className={`flex-1 flex flex-col items-center justify-start z-10 w-full mx-auto gap-6 ${
        isTimingRoute ? '' : 'p-4 md:p-6 max-w-7xl'
      }`}>
        
        {/* Main Application Window */}
        <div className={`w-full bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl flex flex-col ${isTimingRoute ? 'flex-1 min-h-0' : ''}`}>

          {/* Main Title Bar */}
          <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center rounded-t-md border-b-2 border-[#002fa7] select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-sm tracking-wide font-mono truncate">
                Viola Libre v1.1
              </span>
            </div>
            
            {/* Windows Window Buttons */}
            <div className="flex gap-1">
              <button className="w-[21px] h-[21px] rounded bg-[#0058e6] border border-white flex items-center justify-center font-bold text-xs hover:bg-[#3a8bfb] focus:outline-none cursor-pointer">
                _
              </button>
              <button 
                onClick={() => navigate('/favoritos')}
                className={`w-[21px] h-[21px] rounded border flex items-center justify-center font-bold text-xs focus:outline-none cursor-pointer ${activeTab === 'favorites' ? 'bg-[#ff7f27] border-white text-white' : 'bg-[#0058e6] border-white hover:bg-[#3a8bfb]'}`}
                title="Abrir Favoritos"
              >
                <StarIcon className="w-3.5 h-3.5" fill={activeTab === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
              </button>
              <button 
                onClick={() => setShowAboutModal(true)}
                className="w-[21px] h-[21px] rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 focus:outline-none cursor-pointer"
                title="Sobre"
              >
                ✕
              </button>
            </div>
          </div>



          {/* XP Dialog Tabs (under menu bar) */}
          <div className="flex pl-2 gap-1 bg-[#ece9d8] border-b border-[#d4d0c8] select-none pt-2 z-10 overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              onClick={() => navigate('/cifras')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'cifras'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black'
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span>Explore Cifras</span>
            </button>
            <button
              onClick={() => navigate('/minhascifras')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'minhascifras'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black'
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline">Minhas Cifras</span>
              <span className="inline sm:hidden">Minhas</span>
            </button>
            <button
              onClick={() => navigate('/chords')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'chords'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span>Dicionário de Acordes</span>
            </button>
            <button 
              onClick={() => navigate('/treinos')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'train'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline">Treinos e Teoria</span>
              <span className="inline sm:hidden">Treinos</span>
            </button>
            <button 
              onClick={() => navigate('/ouvido')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'ear'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline">Tirando de Ouvido</span>
              <span className="inline sm:hidden">Ouvido</span>
            </button>
            <button 
              onClick={() => navigate('/favoritos')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline-flex items-center gap-1">
                <StarIcon className="w-3.5 h-3.5 text-[#ff7f27]" fill={activeTab === 'favorites' ? '#ff7f27' : 'none'} stroke="currentColor" strokeWidth="1.5" />
                <span>Meus Favoritos ({favorites.length})</span>
              </span>
              <span className="inline-flex sm:hidden items-center gap-1">
                <StarIcon className="w-3 h-3 text-[#ff7f27]" fill={activeTab === 'favorites' ? '#ff7f27' : 'none'} stroke="currentColor" strokeWidth="1.5" />
                <span>Favoritos ({favorites.length})</span>
              </span>
            </button>
          </div>

          {/* Conditional tab rendering */}
          {activeTab === 'cifras' && (
            <div
              className={`w-full max-w-full flex flex-col p-2 sm:p-4 gap-4 ${isTimingRoute ? 'flex-1 min-h-0' : ''}`}
              style={isTimingRoute ? undefined : { minHeight: '400px' }}
            >
              <CifrasApp />
            </div>
          )}

          {activeTab === 'minhascifras' && (
            <div className="w-full flex flex-col" style={{ minHeight: '600px', height: 'calc(100vh - 160px)' }}>
              <MinhasCifras />
            </div>
          )}

          {/* Conditional tab rendering */}
          {activeTab === 'chords' && (
            <>
              {/* Web App Content Layout */}
              <div className="flex flex-col lg:flex-row p-4 gap-4">
                
                {/* LEFT SIDEBAR: Setup & Chord selectors */}
                <div className="flex flex-col gap-4 w-full lg:w-[320px] shrink-0">
                  
                  {/* Instrument Tuning Panel */}
                  <InstrumentSelector
                    selectedInstrument={selectedInst}
                    selectedTuning={selectedTuning}
                    onInstrumentChange={handleInstrumentChange}
                    onTuningChange={handleTuningChange}
                    onCustomTuningChange={handleCustomTuningChange}
                  />

                  {/* Chord Finder Selection Panel */}
                  <ChordFinder
                    selectedRootName={rootName}
                    selectedSuffix={suffix}
                    selectedBassName={bassName}
                    selectedCustomNotes={customNotes}
                    onChordChange={handleChordChange}
                    resultsCount={filteredVoicings.length}
                  />

                  {/* Advanced Filters Panel */}
                  <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-3 shadow-md">
                    <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
                      <span>Filtros de Busca</span>
                      <span className="font-mono text-xs">XP</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold font-mono text-gray-700 flex justify-between">
                        <span>Casa inicial mínima:</span>
                        {minFretFilter > 0 && <span className="text-[#cc3300] font-bold">≥ {minFretFilter}ª casa</span>}
                      </label>
                      <select
                        value={minFretFilter}
                        onChange={(e) => setMinFretFilter(Number(e.target.value))}
                        className="w-full text-xs font-mono bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none cursor-pointer"
                      >
                        <option value={0}>Todas as casas (Canto/Nut)</option>
                        <option value={1}>1ª Casa ou acima</option>
                        <option value={2}>2ª Casa ou acima</option>
                        <option value={3}>3ª Casa ou acima</option>
                        <option value={4}>4ª Casa ou acima</option>
                        <option value={5}>5ª Casa ou acima (Posições médias)</option>
                        <option value={7}>7ª Casa ou acima (Agudos)</option>
                        <option value={9}>9ª Casa ou acima</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold font-mono text-gray-700">Dificuldade e Abafamento:</label>
                      <select
                        value={interiorMuteFilter}
                        onChange={(e) => setInteriorMuteFilter(e.target.value as 'all' | 'hide')}
                        className="w-full text-xs font-mono bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none cursor-pointer"
                      >
                        <option value="all">Mostrar todas as posições (com penalidade)</option>
                        <option value="hide">Ocultar posições difíceis (abafamento interno)</option>
                      </select>
                    </div>

                    <div className="text-[10px] font-mono text-gray-600 bg-[#d4d0c8] p-1.5 border border-[#808080] select-none flex items-start gap-1.5">
                      <IconInfo className="w-3.5 h-3.5 text-[#0058e6] shrink-0 mt-0.5" />
                      <span><em>Acordes com cordas abafadas no meio são penalizados e classificados como mais difíceis.</em></span>
                    </div>
                  </div>

                </div>

                {/* RIGHT WORKSPACE: Fretboard diagram displays */}
                <div className="flex-1 flex flex-col gap-4">
                  
                  {/* Results Window Box */}
                  <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-4 flex flex-col min-h-[300px]">
                    
                    {/* Window Header */}
                    <div className="flex justify-between items-center border-b border-dashed border-[#808080] pb-2 mb-4 font-mono select-none">
                      <span className="text-xs font-bold text-gray-600">
                        Instrumento: <span className="text-black">{selectedInst.name}</span> | Afinação: <span className="text-[#cc3300] font-bold">{selectedTuning.name}</span>
                      </span>
                      <span className="text-sm font-bold text-[#002fa7]">
                        Cordelete de Acorde: {rootName ? chordDisplayName : "Nenhum"}
                      </span>
                    </div>

                    {/* Diagrams Grid */}
                    {!rootName ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#ece9d8]/50 border border-dotted border-[#808080]">
                        <h3 className="text-base font-bold text-gray-700 font-mono">Nenhum Tom Selecionado</h3>
                        <p className="text-xs text-gray-600 font-mono mt-2 max-w-sm">
                          &lt;- Escolha um tom na barra lateral esquerda para exibir os acordes e as formas no braço.
                        </p>
                      </div>
                    ) : activeVoicings.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#ece9d8]/50 border border-dotted border-[#cc3300]">
                        <h3 className="text-base font-bold text-[#cc3300] font-mono">Forma Incompatível</h3>
                        <p className="text-xs text-gray-600 font-mono mt-1 max-w-sm">
                          Nenhuma posição anatômica válida foi encontrada para o acorde <strong className="text-black">{chordDisplayName}</strong> com a afinação atual.
                          <br /><br />
                          Tente alterar a afinação ou escolha outro tipo de acorde.
                        </p>
                      </div>
                    ) : filteredVoicings.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#ece9d8]/50 border border-dotted border-[#cc3300]">
                        <h3 className="text-base font-bold text-[#cc3300] font-mono">Sem Resultados (Filtro Ativo)</h3>
                        <p className="text-xs text-gray-600 font-mono mt-1 max-w-sm">
                          Nenhuma posição para o acorde <strong className="text-black">{chordDisplayName}</strong> corresponde aos filtros de busca selecionados.
                          <br /><br />
                          Tente diminuir a "Casa Mínima" ou alterar o filtro de "Abafamento Interno".
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 justify-items-center w-full">
                          {orderedVoicings.slice(0, visibleVariationsLimit).map((voicing: Voicing, index: number) => {
                            const isFav = isVoicingFavorited(voicing);
                            const isInCifra = isVoicingInCifra(voicing);
                            const curatedIdx = curatedVoicings.findIndex(c => c.fretsArray.join(',') === voicing.frets.join(','));
                            const isCurated = curatedIdx !== -1;
                            return (
                              <div key={index} className="relative hover:translate-y-[-2px] transition-transform">
                                <FretboardDiagram
                                  voicing={voicing}
                                  tuning={selectedTuning}
                                  chordName={chordDisplayName}
                                  isFavorite={isFav}
                                  onToggleFavorite={() => toggleFavorite(voicing)}
                                  isInCifra={isInCifra}
                                  onToggleCifra={() => toggleCifraVoicing(voicing)}
                                  useFlats={useFlats}
                                  onEditClick={() => setEditorFrets(voicing.frets)}
                                  onCurateClick={editorSession ? () => handleCurateChord(voicing) : undefined}
                                  isCurated={isCurated}
                                  curateBusy={curatingKey === voicing.frets.join(',')}
                                  onPromoteClick={editorSession ? () => handleReorderCurated(voicing.frets, -1) : undefined}
                                  onDemoteClick={editorSession ? () => handleReorderCurated(voicing.frets, 1) : undefined}
                                  canPromote={curatedIdx > 0}
                                  canDemote={curatedIdx !== -1 && curatedIdx < curatedVoicings.length - 1}
                                />
                                <div className="absolute -top-1.5 -left-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-[#228b22] text-white border border-[#1a6b1a] rounded-sm font-mono shadow-md z-10">
                                  #{index + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {orderedVoicings.length > visibleVariationsLimit && (
                          <div className="w-full flex justify-center mt-6 mb-2">
                            <button
                              onClick={() => setVisibleVariationsLimit(orderedVoicings.length)}
                              className="bevel-out bg-[#ece9d8] text-black px-6 py-2 font-bold text-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white transition-all hover:bg-white"
                            >
                              Carregar Mais ({orderedVoicings.length - visibleVariationsLimit} posições ocultas)
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </div>

              </div>

              {/* LOWER WORKSPACE SECTION: Interactive fretboard */}
              <div className="p-4 border-t-2 border-[#d4d0c8] bg-[#ece9d8]">
                <InteractiveFretboard
                  selectedInstrument={selectedInst}
                  selectedTuning={selectedTuning}
                  loadedFrets={interactiveLoadedFrets}
                />
              </div>
            </>
          )}

          {activeTab === 'train' && (
            <div className="p-4 flex flex-col gap-4 w-full">
              {/* Instrument configuration selector at the top */}
              <div className="w-full">
                <InstrumentSelector
                  selectedInstrument={selectedInst}
                  selectedTuning={selectedTuning}
                  onInstrumentChange={handleInstrumentChange}
                  onTuningChange={handleTuningChange}
                  onCustomTuningChange={handleCustomTuningChange}
                />
              </div>

              {/* Scale trainer neck visualizer */}
              <div className="w-full">
                <ScaleTrainer
                  selectedTuning={selectedTuning}
                />
              </div>

              {/* Viola duets visualizer if Viola Caipira is active */}
              {selectedInst.id === 'viola' && (
                <div className="w-full">
                  <ViolaDuets
                    selectedTuning={selectedTuning}
                  />
                </div>
              )}

              {/* Theory guide at the bottom */}
              <div className="border-t border-[#d4d0c8] pt-4 mt-2">
                <TheoryGuide />
              </div>
            </div>
          )}

          {activeTab === 'ear' && (
            <div className="flex flex-col lg:flex-row p-4 gap-4">
              <div className="w-full lg:w-[320px] shrink-0">
                <InstrumentSelector
                  selectedInstrument={selectedInst}
                  selectedTuning={selectedTuning}
                  onInstrumentChange={handleInstrumentChange}
                  onTuningChange={handleTuningChange}
                  onCustomTuningChange={handleCustomTuningChange}
                />
              </div>
              <div className="flex-1 min-w-0">
                <EarTranscription
                  selectedInstrument={selectedInst}
                  selectedTuning={selectedTuning}
                  isEditorOpen={isEditorOpen}
                  setIsEditorOpen={setIsEditorOpen}
                  isDocked={isDocked}
                  setIsDocked={setIsDocked}
                  isMinimized={isMinimized}
                  setIsMinimized={setIsMinimized}
                  isTaskbarCollapsed={isTaskbarCollapsed}
                  editorHeight={editorHeight}
                  onEditorHeightChange={setEditorHeight}
                />
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="p-4">
              <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white p-4 flex flex-col min-h-[350px] font-mono">
                <div className="flex justify-between items-center border-b border-dashed border-[#808080] pb-2 mb-4 select-none">
                  <span className="text-sm font-bold text-[#002fa7] flex items-center gap-1.5">
                    <StarIcon className="w-4 h-4 text-[#ff7f27]" fill="currentColor" />
                    <span>Minhas Posições Favoritadas</span>
                  </span>
                  <button 
                    onClick={clearFavorites}
                    disabled={favorites.length === 0}
                    className="px-3 py-1 text-xs font-bold bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  >
                    Limpar Todos os Favoritos
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {favorites.length === 0 ? (
                    <div className="text-center text-gray-400 py-20 italic text-sm select-none">
                      Nenhuma posição favoritada. Vá na aba "Dicionário de Acordes" e clique no ícone da estrela para salvar posições favoritas!
                    </div>
                  ) : (
                    <div className="overflow-x-auto no-scrollbar w-full min-w-0">
                      <table className="w-full text-xs text-left border-collapse select-none min-w-[600px]">
                        <thead>
                          <tr className="bg-[#d4d0c8] border-b border-[#808080] font-bold text-gray-700">
                            <th className="p-2.5 border-r border-[#808080]">Acorde</th>
                            <th className="p-2.5 border-r border-[#808080]">Instrumento</th>
                            <th className="p-2.5 border-r border-[#808080]">Afinação</th>
                            <th className="p-2.5 border-r border-[#808080]">Digitação (Cordas)</th>
                            <th className="p-2.5 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {favorites.map((fav) => (
                            <tr key={fav.id} className="border-b border-[#d4d0c8] hover:bg-[#c2d7f2]">
                              <td className="p-2.5 border-r border-[#d4d0c8] font-bold text-[#002fa7]">{fav.chordName}</td>
                              <td className="p-2.5 border-r border-[#d4d0c8]">{fav.instrumentName}</td>
                              <td className="p-2.5 border-r border-[#d4d0c8] text-gray-600 font-mono text-[10px]">{fav.tuningName}</td>
                              <td className="p-2.5 border-r border-[#d4d0c8] font-mono text-[11px] font-bold text-[#228b22]">
                                {fav.frets.map(f => f === -1 ? 'X' : f).join('-')}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={() => {
                                    loadFavorite(fav);
                                    navigate('/chords');
                                  }}
                                  className="px-3 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-xs mr-2 hover:bg-white cursor-pointer"
                                  title="Carregar no Localizador de Acordes"
                                >
                                  Carregar no Localizador
                                </button>
                                <button
                                  onClick={() => {
                                    const updated = favorites.filter(f => f.id !== fav.id);
                                    setFavorites(updated);
                                    localStorage.setItem('viola_libre_favs', JSON.stringify(updated));
                                  }}
                                  className="px-3 py-1 bg-[#ff7f27] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] text-white font-bold text-xs hover:bg-orange-600 cursor-pointer"
                                  title="Excluir"
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'termos' && (
            <div className="w-full" style={{ minHeight: '400px' }}>
              <TermosDeUso />
            </div>
          )}

        </div>

      </div>

      {/* --- MOBILE FOOTER (browsewrap) --- */}
      {/* A taskbar (footer XP) é escondida no mobile, então este é o ponto de acesso
          discreto aos Termos de Uso em telas pequenas. */}
      <div className="md:hidden w-full flex justify-center py-3 z-10">
        <button
          onClick={() => navigate('/termos')}
          className={`text-[11px] font-mono underline underline-offset-2 cursor-pointer select-none transition-colors ${
            activeTab === 'termos' ? 'text-white font-bold' : 'text-white/75 hover:text-white'
          }`}
        >
          Termos de Uso
        </button>
      </div>

      {/* --- MINHA CIFRA FLOATING WINDOW --- */}
      {showCifraWindow && (
        <div className="fixed top-12 left-4 md:left-[15%] w-[90%] md:w-[70%] bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl z-50">
          <div className="winxp-gradient-blue text-white px-3 py-1 flex justify-between items-center rounded-t-md select-none font-bold text-sm">
            <span className="flex items-center gap-1.5">
              <IconNotepad className="w-4.5 h-4.5" />
              <span>Minha Cifra (Roteiro de Acordes da Música)</span>
            </span>
            <button 
              onClick={() => setShowCifraWindow(false)}
              className="w-5 h-5 rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <p className="text-xs font-mono text-gray-700 leading-normal">
              Abaixo estão os acordes selecionados para a cifra desta música. Você pode ver os diagramas, carregar no braço ou exportar a digitação.
            </p>
            
            <div className="max-h-[350px] overflow-y-auto bg-white border-2 border-[#808080] border-r-white border-bottom-white p-4 font-mono retro-scrollbar flex flex-wrap gap-4 justify-center">
              {cifraVoicings.length === 0 ? (
                <div className="text-center text-gray-400 py-16 italic text-sm w-full flex flex-col items-center justify-center gap-2">
                  <IconNotepad className="w-6 h-6 text-gray-400" />
                  <span>Nenhum acorde adicionado à cifra. Vá na aba "Dicionário de Acordes" e clique no ícone do bloco de notas para salvar as posições da música aqui!</span>
                </div>
              ) : (
                cifraVoicings.map((fav) => {
                  const voicing: Voicing = {
                    frets: fav.frets,
                    notes: fav.notes,
                    score: fav.score,
                    playabilityIssues: []
                  };
                  const playability = evaluatePlayability(fav.frets);
                  if (playability.barre) {
                    voicing.barre = playability.barre;
                  }
                  
                  const tuningObj: Tuning = {
                    id: 'temp',
                    name: fav.tuningName,
                    strings: selectedTuning.strings
                  };
                  
                  return (
                    <div key={fav.id} className="relative border border-[#808080] p-1 bg-[#ece9d8]">
                      <FretboardDiagram
                        voicing={voicing}
                        tuning={tuningObj}
                        chordName={fav.chordName}
                        isFavorite={favorites.some(f => f.id === fav.id)}
                        onToggleFavorite={() => toggleFavorite(voicing)}
                        isInCifra={true}
                        onToggleCifra={() => {
                          const updated = cifraVoicings.filter(c => c.id !== fav.id);
                          setCifraVoicings(updated);
                          localStorage.setItem('viola_libre_cifra', JSON.stringify(updated));
                        }}
                        useFlats={useFlats}
                      />
                      <button
                        onClick={() => {
                          loadFavorite(fav);
                          setShowCifraWindow(false);
                        }}
                        className="mt-2 w-full py-1 bg-[#0058e6] text-white border border-white font-mono text-xs cursor-pointer text-center font-bold hover:bg-blue-600 active:bg-blue-800"
                      >
                        Carregar no Braço
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 font-mono">
              <span className="text-xs text-gray-600 font-bold">Acordes na Cifra: {cifraVoicings.length}</span>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    const text = cifraVoicings.map(c => `${c.chordName}: ${c.frets.map(f => f === -1 ? 'X' : f).join('-')} (${c.instrumentName})`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert("Cifragem copiada para a área de transferência:\n\n" + text);
                  }}
                  disabled={cifraVoicings.length === 0}
                  className="px-3 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-xs hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Copiar acordes como texto"
                >
                  <IconCopy className="w-3.5 h-3.5" />
                  <span>Copiar Cifragem (Texto)</span>
                </button>
                <button
                  onClick={() => {
                    setCifraVoicings([]);
                    localStorage.removeItem('viola_libre_cifra');
                  }}
                  disabled={cifraVoicings.length === 0}
                  className="px-3 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-xs hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                  <span>Limpar Cifra</span>
                </button>
                <button
                  onClick={() => setShowCifraWindow(false)}
                  className="px-3 py-1 bg-[#0058e6] text-white border border-[#002fa7] font-bold text-xs hover:bg-blue-600 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ABOUT MODAL WINDOW --- */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-[450px] bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl">
            <div className="winxp-gradient-blue text-white px-3 py-1 flex justify-between items-center rounded-t-md font-bold text-sm select-none">
              <span className="flex items-center gap-1.5">
                <IconHelp className="w-4 h-4 text-white" />
                <span>Sobre o Viola Libre</span>
              </span>
              <button 
                onClick={() => setShowAboutModal(false)}
                className="w-5 h-5 rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 font-mono text-xs">
              <div className="flex gap-4 items-start border-b border-[#808080]/30 pb-4">
                <span className="text-4xl">𝄢</span>
                <div>
                  <h2 className="text-base font-bold text-black mb-1">Viola Libre v1.1</h2>
                  <p className="text-gray-600">O Cifrário Matemático da Música Tradicional</p>
                  <p className="text-gray-400 mt-0.5">Licença: Livre / Open Source</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 leading-relaxed text-black/90">
                <p>
                  <strong>Diferente de sistemas engessados</strong>, o Viola Libre calcula
                  as posições das notas baseando-se em equações e intervalos de semitons.
                </p>
                <p>
                  Isso permite trocar de afinação instantaneamente (ex: Cebolão Ré, Cebolão Mi, Rio Abaixo)
                  ou alterar a nota individual de qualquer corda e recalcular tudo instantaneamente.
                </p>
                <p>
                  O projeto homenageia a sonoridade caipira brasileira, e tem como objetivo dar acesso livre,
                  sem anúncios intrusivos e de maneira minimalista a estudantes e mestres do instrumento.
                </p>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="px-4 py-1.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-xs hover:bg-white cursor-pointer"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- WINDOWS XP CLASSIC TASKBAR (Collapsible) --- */}
      {/* Hidden entirely on mobile: it duplicates the top tab nav and eats scarce vertical space. */}
      <footer
        className="hidden md:block fixed bottom-0 left-0 right-0 h-10 z-40 select-none"
        style={{ pointerEvents: 'none' }}
      >
        {/* Collapsed Toggle Tab (small blue pill on the left) */}
        <button
          onClick={() => setIsTaskbarCollapsed(false)}
          className="absolute bottom-0 left-0 h-7 flex items-center justify-center bg-gradient-to-b from-[#245dd7] via-[#0058e6] to-[#245dd7] border-t border-r border-[#3370f8] rounded-tr-sm cursor-pointer hover:brightness-110 active:scale-95 select-none transition-all duration-300 ease-in-out"
          style={{
            width: isTaskbarCollapsed ? '22px' : '0px',
            opacity: isTaskbarCollapsed ? 1 : 0,
            pointerEvents: isTaskbarCollapsed ? 'auto' : 'none',
            overflow: 'hidden'
          }}
          title="Expandir barra de tarefas"
        >
          <span className="text-white text-[9px] font-bold">▶</span>
        </button>

        {/* Full Taskbar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-[#245dd7] via-[#0058e6] to-[#245dd7] border-t-2 border-[#3370f8] flex justify-between items-center px-1 transition-transform duration-300 ease-in-out"
          style={{
            transform: isTaskbarCollapsed ? 'translateX(-100%)' : 'translateX(0)',
            pointerEvents: isTaskbarCollapsed ? 'none' : 'auto'
          }}
        >
          {/* Start Button & Tabs */}
          <div className="flex gap-1.5 items-center h-full">
            {/* Collapse button */}
            <button
              onClick={() => setIsTaskbarCollapsed(true)}
              className="h-[28px] w-[24px] flex items-center justify-center bg-[#ece9d8] text-black border border-white border-r-[#808080] border-b-[#808080] hover:bg-white active:border-t-[#808080] active:border-l-[#808080] rounded cursor-pointer select-none text-[10px] font-bold"
              title="Recolher barra de tarefas"
            >
              ◀
            </button>

            <button 
              onClick={() => navigate('/cifras')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'cifras'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Explore Cifras</span>
            </button>

            <button 
              onClick={() => navigate('/chords')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'chords'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Acordes</span>
            </button>
            
            <button 
              onClick={() => navigate('/favoritos')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Favoritos ({favorites.length})</span>
            </button>

            <button 
              onClick={() => setShowCifraWindow(true)}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                showCifraWindow
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <IconNotepad className="w-3.5 h-3.5" />
              <span>Minha Cifra ({cifraVoicings.length})</span>
            </button>
          </div>

          {/* System Tray (Clock and icons) */}
          <div className="h-[30px] bg-[#0997f7] border-l-2 border-[#1a6b1a] flex items-center px-3 gap-2 text-white font-mono text-xs shadow-[inset_1px_1px_1px_#ffffff30] rounded-l-sm">
            <button 
              onClick={() => setShowEditorLogin(true)}
              className="flex items-center justify-center cursor-pointer hover:bg-white/20 px-1 rounded transition-colors"
              title="Acesso de Editor"
            >
              <span className={editorSession ? "text-[#ddffdd]" : "opacity-70"}>🔑 Editor</span>
            </button>
            <div className="w-[1.5px] h-4 bg-white/30 mx-1"></div>
            <button
              onClick={() => navigate('/termos')}
              className={`cursor-pointer hover:bg-white/20 px-1 rounded transition-colors ${activeTab === 'termos' ? 'text-[#ddffdd] font-bold' : ''}`}
              title="Termos de Uso"
            >
              Termos de Uso
            </button>
            <div className="w-[1.5px] h-4 bg-white/30 mx-1"></div>
            <span className="cursor-pointer" title="Rede Ativa (Livre)">NET</span>
            <span className="cursor-pointer" title="Áudio Ativo (Afinado)">VOL</span>
            <div className="w-[1.5px] h-4 bg-white/30 mx-1"></div>
            <span className="font-bold text-[11px]" title="Hora local do sistema">{time}</span>
          </div>
        </div>
      </footer>

      {editorFrets && (
        <ChordEditorModal
          chordName={chordDisplayName}
          tuning={selectedTuning}
          instrument={selectedInst}
          initialFrets={editorFrets}
          useFlats={useFlats}
          onApply={(frets) => toggleFavorite(buildVoicingFromFrets(frets, selectedTuning, useFlats))}
          onClose={() => setEditorFrets(null)}
        />
      )}

      {showEditorLogin && (
        <EditorLoginModal
          isAuthenticated={!!editorSession}
          onClose={() => setShowEditorLogin(false)}
          onLoginSuccess={(session) => setEditorSession(session)}
        />
      )}

      {showInstrumentOnboarding && (
        <InstrumentOnboardingModal
          onSelect={handleInstrumentOnboardingSelect}
          onSkip={handleInstrumentOnboardingSkip}
        />
      )}
    </div>
  );
}

export default App;
