import React, { useState, useEffect, useMemo } from 'react';
import type { Instrument, Tuning, Voicing } from './engine/types';
import { PRESET_INSTRUMENTS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from './engine/tunings';
import { buildChord, calculateVoicings, shouldUseFlats, noteNameToPitchClass, evaluatePlayability } from './engine/chordCalculator';
import { InstrumentSelector } from './components/InstrumentSelector';
import { ChordFinder } from './components/ChordFinder';
import { FretboardDiagram, IconNotepad, IconCopy, IconTrash } from './components/FretboardDiagram';
import { InteractiveFretboard } from './components/InteractiveFretboard';
import { ScaleTrainer } from './components/ScaleTrainer';
import { TheoryGuide } from './components/TheoryGuide';
import { EarTranscription } from './components/EarTranscription';
import { ViolaDuets } from './components/ViolaDuets';

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
  const [selectedInst, setSelectedInst] = useState<Instrument>(PRESET_INSTRUMENTS[0]);
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(PRESET_INSTRUMENTS[0].tunings[0]);
  
  const [rootName, setRootName] = useState<string>("D");
  const [suffix, setSuffix] = useState<string>(""); // default Major
  const [bassName, setBassName] = useState<string>(""); // default none
  const [customNotes, setCustomNotes] = useState<number[]>([]); // custom notes selected

  // Chord search advanced filters
  const [minFretFilter, setMinFretFilter] = useState<number>(0);
  const [interiorMuteFilter, setInteriorMuteFilter] = useState<'all' | 'hide'>('all');

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
      return calculateVoicings(selectedTuning, chord);
    } catch (err) {
      console.error("Erro ao calcular posições de acordes:", err);
      return [];
    }
  }, [selectedTuning, rootName, suffix, bassName, customNotes]);

  // Apply search filters dynamically to the generated voicings
  const filteredVoicings = useMemo(() => {
    return activeVoicings.filter((voicing) => {
      // 1. Starting position (min fret) filter
      const frettedOnly = voicing.frets.filter(f => f > 0);
      const minFret = frettedOnly.length > 0 ? Math.min(...frettedOnly) : 0;
      if (minFret < minFretFilter) {
        return false;
      }
      
      // 2. Interior mutes filter
      if (interiorMuteFilter === 'hide' && voicing.hasInteriorMute) {
        return false;
      }
      
      return true;
    });
  }, [activeVoicings, minFretFilter, interiorMuteFilter]);
  
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
  const [showFavoritesWindow, setShowFavoritesWindow] = useState<boolean>(false);
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

  // Tab switcher state
  const [activeTab, setActiveTab] = useState<'chords' | 'train' | 'ear' | 'favorites'>('chords');

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

  // Calcula o paddingBottom dinâmico da página com base no estado atual do sequenciador fixo.
  // Isso garante que o scroll da página sempre alcance o conteúdo abaixo do painel.
  const taskbarH = isTaskbarCollapsed ? 0 : 40;
  const sequencerPad = isEditorOpen && isDocked
    ? (isMinimized ? 35 + taskbarH + 8 : editorHeight + taskbarH + 8)
    : 48; // padding padrão quando flutuante ou fechado

  return (
    <div
      className="min-h-screen flex flex-col justify-between overflow-x-hidden font-sans select-none relative"
      style={{ paddingBottom: sequencerPad }}
    >

      {/* --- DESKTOP WINDOW CONTAINER --- */}
      <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-start z-10 max-w-7xl w-full mx-auto gap-6">
        
        {/* Main Application Window */}
        <div className="w-full bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl flex flex-col">
          
          {/* Main Title Bar */}
          <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center rounded-t-md border-b-2 border-[#002fa7] select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-sm tracking-wide font-mono truncate">
                Viola Libre v1.0 <span className="hidden sm:inline">- O Cifrário Aberto e Matemático</span>
              </span>
            </div>
            
            {/* Windows Window Buttons */}
            <div className="flex gap-1">
              <button className="w-[21px] h-[21px] rounded bg-[#0058e6] border border-white flex items-center justify-center font-bold text-xs hover:bg-[#3a8bfb] focus:outline-none cursor-pointer">
                _
              </button>
              <button 
                onClick={() => setActiveTab('favorites')}
                className={`w-[21px] h-[21px] rounded border flex items-center justify-center font-bold text-xs focus:outline-none cursor-pointer ${activeTab === 'favorites' ? 'bg-[#ff7f27] border-white text-white' : 'bg-[#0058e6] border-white hover:bg-[#3a8bfb]'}`}
                title="Abrir Favoritos"
              >
                ★
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
              onClick={() => setActiveTab('chords')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'chords' 
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline">Cifras e Acordes</span>
              <span className="inline sm:hidden">Cifras</span>
            </button>
            <button 
              onClick={() => setActiveTab('train')}
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
              onClick={() => setActiveTab('ear')}
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
              onClick={() => setActiveTab('favorites')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'favorites' 
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="hidden sm:inline">★ Meus Favoritos ({favorites.length})</span>
              <span className="inline sm:hidden">★ Favoritos ({favorites.length})</span>
            </button>
          </div>

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

                    <div className="text-[10px] font-mono text-gray-600 bg-[#d4d0c8] p-1.5 border border-[#808080] select-none">
                      💡 <em>Acordes com cordas abafadas no meio são penalizados e classificados como mais difíceis.</em>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 justify-items-center">
                        {filteredVoicings.map((voicing: Voicing, index: number) => {
                          const isFav = isVoicingFavorited(voicing);
                          const isInCifra = isVoicingInCifra(voicing);
                          return (
                            <div key={index} className="relative hover:translate-y-[-2px] transition-transform">
                              <FretboardDiagram
                                voicing={voicing}
                                tuning={selectedTuning}
                                chordName={`${chordDisplayName} (Var. ${index + 1})`}
                                isFavorite={isFav}
                                onToggleFavorite={() => toggleFavorite(voicing)}
                                isInCifra={isInCifra}
                                onToggleCifra={() => toggleCifraVoicing(voicing)}
                                useFlats={useFlats}
                              />
                              <div className="absolute top-2 right-12 text-[10px] font-bold px-1 bg-[#228b22] text-white border border-[#1a6b1a] rounded font-mono shadow-sm">
                                #{index + 1}
                              </div>
                            </div>
                          );
                        })}
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
                    ★ Minhas Posições Favoritadas
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
                      Nenhuma posição favoritada. Vá na aba "Cifras e Acordes" e clique em ☆ para salvar posições favoritas!
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
                                    setActiveTab('chords');
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

        </div>

      </div>

      {/* --- FAVORITES FLOATING WINDOW --- */}
      {showFavoritesWindow && (
        <div className="fixed top-10 left-4 md:left-[20%] w-[90%] md:w-[600px] bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl z-50">
          <div className="winxp-gradient-blue text-white px-3 py-1 flex justify-between items-center rounded-t-md select-none font-bold text-sm">
            <span>⭐ Posições Favoritadas (Salvas Localmente)</span>
            <button 
              onClick={() => setShowFavoritesWindow(false)}
              className="w-5 h-5 rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="max-h-[300px] overflow-y-auto bg-white border-2 border-[#808080] border-r-white border-bottom-white p-2 font-mono retro-scrollbar">
              {favorites.length === 0 ? (
                <div className="text-center text-gray-400 py-10 italic text-sm">
                  Nenhuma posição favoritada. Clique em ☆ nos diagramas acima para salvar posições preferidas!
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#d4d0c8] border-b border-[#808080] font-bold text-gray-700">
                      <th className="p-2 border-r border-[#808080]">Acorde</th>
                      <th className="p-2 border-r border-[#808080]">Instrumento</th>
                      <th className="p-2 border-r border-[#808080]">Afinação</th>
                      <th className="p-2 border-r border-[#808080]">Digitação (Cordas)</th>
                      <th className="p-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {favorites.map((fav) => (
                      <tr key={fav.id} className="border-b border-[#d4d0c8] hover:bg-[#c2d7f2]">
                        <td className="p-2 border-r border-[#d4d0c8] font-bold text-[#002fa7]">{fav.chordName}</td>
                        <td className="p-2 border-r border-[#d4d0c8]">{fav.instrumentName}</td>
                        <td className="p-2 border-r border-[#d4d0c8] text-gray-600 font-mono text-[10px]">{fav.tuningName}</td>
                        <td className="p-2 border-r border-[#d4d0c8] font-mono text-[11px] font-bold text-[#228b22]">
                          {fav.frets.map(f => f === -1 ? 'X' : f).join('-')}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => loadFavorite(fav)}
                            className="px-2 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-[10px] mr-1 hover:bg-white cursor-pointer"
                            title="Carregar Posição"
                          >
                            Carregar
                          </button>
                          <button
                            onClick={() => {
                              const updated = favorites.filter(f => f.id !== fav.id);
                              setFavorites(updated);
                              localStorage.setItem('viola_libre_favs', JSON.stringify(updated));
                            }}
                            className="px-2 py-0.5 bg-[#ff7f27] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] text-white font-bold text-[10px] hover:bg-orange-600 cursor-pointer"
                            title="Excluir"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="flex justify-between items-center font-mono">
              <span className="text-[10px] text-gray-600 font-bold">Favoritos Salvos: {favorites.length}</span>
              <div className="flex gap-2">
                <button
                  onClick={clearFavorites}
                  disabled={favorites.length === 0}
                  className="px-3 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] font-bold text-xs hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🗑️ Limpar Tudo
                </button>
                <button
                  onClick={() => setShowFavoritesWindow(false)}
                  className="px-3 py-1 bg-[#0058e6] text-white border border-[#002fa7] font-bold text-xs hover:bg-blue-600 cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div className="text-center text-gray-400 py-16 italic text-sm w-full">
                  Nenhum acorde adicionado à cifra. Vá na aba de acordes e clique no ícone 📝 para salvar as posições da música aqui!
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
              <span>❔ Sobre o Viola Libre</span>
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
                  <h2 className="text-base font-bold text-black mb-1">Viola Libre 1.0</h2>
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
      <footer
        className="fixed bottom-0 left-0 right-0 h-10 z-40 select-none"
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
              onClick={() => setActiveTab('chords')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'chords'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Viola Libre</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('favorites')}
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
            <span className="cursor-pointer" title="Rede Ativa (Livre)">NET</span>
            <span className="cursor-pointer" title="Áudio Ativo (Afinado)">VOL</span>
            <div className="w-[1.5px] h-4 bg-white/30 mx-1"></div>
            <span className="font-bold text-[11px]" title="Hora local do sistema">{time}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
