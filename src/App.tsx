import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Instrument, Tuning, Voicing } from './engine/types';
import { PRESET_INSTRUMENTS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from './engine/tunings';
import { buildChord, calculateVoicings, shouldUseFlats, noteNameToPitchClass, evaluatePlayability } from './engine/chordCalculator';
import { InstrumentSelector } from './components/InstrumentSelector';
import { ChordFinder } from './components/ChordFinder';
import { FretboardDiagram, IconNotepad, IconCopy, IconTrash, IconAddDoc } from './components/FretboardDiagram';
import { InteractiveFretboard } from './components/InteractiveFretboard';
import { ScaleTrainer } from './components/ScaleTrainer';
import { TheoryGuide } from './components/TheoryGuide';
import { EarTranscription } from './components/EarTranscription';
import { ViolaDuets } from './components/ViolaDuets';
import { AudioEngine } from './engine/AudioEngine';
import { StarIcon } from './components/Icons';
import { CifrasApp } from './pages/cifras/CifrasApp';

interface PresetSong {
  id: string;
  title: string;
  artist: string;
  genre: string;
  originalKey: string;
  views?: number;
  chordsUsed: string[];
  content: string;
}

const PRESET_SONGS: PresetSong[] = [
  {
    id: "tocando-em-frente",
    title: "Tocando em Frente",
    artist: "Almir Sater / Renato Teixeira",
    genre: "Sertanejo",
    originalKey: "D",
    chordsUsed: ["D", "G", "A7", "Bm", "F#m"],
    content: `[D]É preciso amor pra poder pulsar
[G]É preciso paz pra poder sorrir
[D]É preciso a chuva para florir

[G]Penso que cumprir a vida seja sim[D]plesmente compreender
[G]A marcha e ir tocando em fren[D]te
[A7]Como um velho boiadeiro levando a boi[G]ada
Eu vou tocando os dias pela lon[Bm]ga es[A7]trada [G]eu vou
Es[A7]trada eu [D]sou

[D]Conhecer as manhas e as manhãs
[G]O sabor das massas e das maçãs
[D]É preciso amor pra poder pulsar
[G]O sabor das massas e das maçãs
[D]É preciso a chuva para florir

[G]Todo mundo ama um dia todo mun[D]do chora
[G]Um dia a gente chega e no outro [D]vai embora
[A7]Cada um de nós compõe a sua his[G]tória
E cada ser em si carre[Bm]ga o dom [A7]de ser ca[G]paz
E ser fe[D]liz`
  },
  {
    id: "leaozinho",
    title: "Leãozinho",
    artist: "Caetano Veloso",
    genre: "MPB",
    originalKey: "C",
    chordsUsed: ["C", "G", "Am", "F", "Fm", "Em", "Dm7", "G7"],
    content: `Gosto muito de te [C]ver, leão[G]zinho
Caminhando sob o [Am]sol
Gosto muito de vo[F]cê, leão[Em]zinho

Para en[F]trar na minha [Em]frequência
Com[F]partilhar pura [Em]existência
De[Dm7]pois de perder a [G7]paciência com o [C]mundo [G]

[F]Deitar no teu [Em]colo e fugir do [Am]frio
[F]Deitar no teu [Em]colo e fugir do [Am]frio
[Dm7]Gosto muito de te [G7]ver, leão[C]zinho`
  },
  {
    id: "anunciacao",
    title: "Anunciação",
    artist: "Alceu Valença",
    genre: "MPB",
    originalKey: "G",
    chordsUsed: ["G", "C", "D7", "Em"],
    content: `Na bruma [G]leve das paixões que vem de [C]dentro
Tu vens che[G]gando pra brincar no meu quin[D7]tal
No teu ca[G]belo o frisson do passa[C]rinho
No teu um[G]bigo o fogão de um he[D7]rval

[G]Tu vens, tu [C]vens
Eu já es[G]cuto os teus si[D7]nais
[G]Tu vens, tu [C]vens
Eu já es[G]cuto os teus si[D7]nais

A voz do an[G]jo sussurrou no meu ou[C]vido
Eu não du[G]vido já escuto os teus si[D7]nais
Que tu vi[G]rias numa tarde de do[C]mingo
E o vento [G]norte ventilaria os por[D7]tais

[G]Tu vens, tu [C]vens
Eu já es[G]cuto os teus si[D7]nais`
  },
  {
    id: "evidencias",
    title: "Evidências",
    artist: "Chitãozinho & Xororó",
    genre: "Sertanejo",
    originalKey: "E",
    chordsUsed: ["E", "G#m", "A", "B7", "F#m", "C#m"],
    content: `Quando eu [E]digo que não quero mais você para a mi[G#m]nha vida
É porque eu te [A]amo
E tenho medo de ad[F#m]mitir que ainda estou em suas [B7]mãos

Mas o [E]caso é que eu me afasto e me de[G#m]fendo de você
Mas de[A]pois não sei o que fazer sem [B7]teu a[E]mor

[E]Diga que me ama, [G#m]fala que me quer
[A]Diz que eu sou o homem que [B7]você sempre sonhou
[E]E não me deixe mais [G#m]ficar sofrendo assim
[A]Se entrega de uma vez, de[B7]volve o meu sor[E]riso`
  }
];

function parseChordString(chordStr: string) {
  let root = '';
  let suffix = '';
  let bass = '';

  const parts = chordStr.split('/');
  let mainChord = parts[0].trim();
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (/^\d/.test(part)) {
      mainChord += '/' + part;
    } else {
      bass = part;
    }
  }

  if (mainChord.length >= 2 && (mainChord[1] === '#' || mainChord[1] === 'b')) {
    root = mainChord.slice(0, 2);
    suffix = mainChord.slice(2);
  } else if (mainChord.length >= 1) {
    root = mainChord.slice(0, 1);
    suffix = mainChord.slice(1);
  }

  return { root, suffix, bass };
}

function transposeChordString(chordStr: string, semitones: number, preferFlats: boolean): string {
  const { root, suffix, bass } = parseChordString(chordStr);
  if (!root) return chordStr;
  
  try {
    const rootPc = noteNameToPitchClass(root);
    const transposedRootPc = (rootPc + semitones + 12) % 12;
    const transposedRoot = preferFlats ? NOTE_NAMES_FLAT[transposedRootPc] : NOTE_NAMES_SHARP[transposedRootPc];
    
    let transposedBass = '';
    if (bass) {
      const bassPc = noteNameToPitchClass(bass);
      const transposedBassPc = (bassPc + semitones + 12) % 12;
      transposedBass = preferFlats ? NOTE_NAMES_FLAT[transposedBassPc] : NOTE_NAMES_SHARP[transposedBassPc];
    }
    
    return transposedRoot + suffix + (transposedBass ? '/' + transposedBass : '');
  } catch {
    return chordStr;
  }
}

const IconSearch: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <circle cx="6.5" cy="6.5" r="4.5" stroke="#333333" strokeWidth="1.5" />
    <line x1="10" y1="10" x2="14" y2="14" stroke="#333333" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconFolder: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M1.5 2.5a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-10z" fill="#ffcc66" stroke="#cc9933" strokeWidth="1"/>
    <path d="M1.5 5.5h13" stroke="#cc9933" strokeWidth="1"/>
  </svg>
);

const IconFolderOpen: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M1.5 3.5a1 1 0 0 1 1-1h4l1.5 1.5h6a1 1 0 0 1 1 1v2h-12.5v-3.5z" fill="#d49b25" stroke="#a07010" strokeWidth="1"/>
    <path d="M1 7.5h11l2 6h-11.5l-1.5-6z" fill="#ffcc66" stroke="#cc9933" strokeWidth="1"/>
  </svg>
);

const IconPlay: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M4 2v12l10-6-10-6z" fill="#228b22" stroke="#1a6b1a" strokeWidth="1"/>
  </svg>
);

const IconPause: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="4" y="2" width="3" height="12" fill="#cc3300" stroke="#992200" strokeWidth="1"/>
    <rect x="9" y="2" width="3" height="12" fill="#cc3300" stroke="#992200" strokeWidth="1"/>
  </svg>
);

const IconArrowLeft: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M8 2l-6 6 6 6M2 8h12" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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
  const [selectedInst, setSelectedInst] = useState<Instrument>(PRESET_INSTRUMENTS[0]);
  const [selectedTuning, setSelectedTuning] = useState<Tuning>(PRESET_INSTRUMENTS[0].tunings[0]);
  
  const [rootName, setRootName] = useState<string>("D");
  const [suffix, setSuffix] = useState<string>(""); // default Major
  const [bassName, setBassName] = useState<string>(""); // default none
  const [customNotes, setCustomNotes] = useState<number[]>([]); // custom notes selected

  // Chord search advanced filters
  const [minFretFilter, setMinFretFilter] = useState<number>(0);
  const [interiorMuteFilter, setInteriorMuteFilter] = useState<'all' | 'hide'>('all');
  const [visibleVariationsLimit, setVisibleVariationsLimit] = useState<number>(20);

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
    return activeVoicings.filter(voicing => {
      const frettedFrets = voicing.frets.filter(f => f > 0);
      const startFret = frettedFrets.length > 0 ? Math.min(...frettedFrets) : 1;
      
      if (minFretFilter > 0 && startFret < minFretFilter) return false;
      if (interiorMuteFilter === 'hide' && voicing.hasInteriorMute) return false;
      
      return true;
    });
  }, [activeVoicings, minFretFilter, interiorMuteFilter]);

  // Reset visual limit when search parameters change
  useEffect(() => {
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
  const [activeTab, setActiveTab] = useState<'cifras' | 'chords' | 'train' | 'ear' | 'favorites'>('cifras');

  // Cifras & Song portal states
  const [selectedSong, setSelectedSong] = useState<PresetSong | null>(null);
  const [cifraSearchQuery, setCifraSearchQuery] = useState<string>("");
  const [cifraSelectedGenre, setCifraSelectedGenre] = useState<string>("all");
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(1);
  const [showCreateCifraModal, setShowCreateCifraModal] = useState<boolean>(false);
  const [customCifras, setCustomCifras] = useState<PresetSong[]>(() => {
    const stored = localStorage.getItem('viola_libre_custom_cifras');
    return stored ? JSON.parse(stored) : [];
  });

  // Song chord variation indices & likes states
  const [songChordVariationIndices, setSongChordVariationIndices] = useState<Record<string, number>>({});
  const [songChordLikes, setSongChordLikes] = useState<Record<string, { likes: number, dislikes: number, status: 'liked' | 'disliked' | null }>>({});

  const getChordLikes = (chordId: string) => {
    if (songChordLikes[chordId]) return songChordLikes[chordId];
    return { likes: 0, dislikes: 0, status: null as 'liked' | 'disliked' | null };
  };

  const isChordDiatonic = (chordName: string, songKey: string): boolean => {
    try {
      const { root, suffix } = parseChordString(chordName);
      const isMinorKey = songKey.endsWith('m');
      const songKeyRoot = isMinorKey ? songKey.slice(0, -1) : songKey;
      const songKeyRootPc = noteNameToPitchClass(songKeyRoot);
      const chordRootPc = noteNameToPitchClass(root);
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
      const isChordMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
      return expectedSuffixIsMinor === isChordMinor;
    } catch {
      return false;
    }
  };

  // Helper to modify a chord in the song and update content/bracket references
  const modifySongChord = (oldChord: string, newChord: string) => {
    if (!selectedSong) return;
    const updatedChords = selectedSong.chordsUsed.map(c => c === oldChord ? newChord : c);
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\[' + escapeRegExp(oldChord) + '\\]', 'g');
    const updatedContent = selectedSong.content.replace(regex, `[${newChord}]`);
    
    const updatedSong = {
      ...selectedSong,
      chordsUsed: updatedChords,
      content: updatedContent
    };
    setSelectedSong(updatedSong);

    if (customCifras.some(c => c.id === selectedSong.id)) {
      const updatedCustom = customCifras.map(c => c.id === selectedSong.id ? updatedSong : c);
      setCustomCifras(updatedCustom);
      localStorage.setItem('viola_libre_custom_cifras', JSON.stringify(updatedCustom));
    }
  };

  const toggleSongChordMinorMajor = (origChord: string) => {
    const { root, suffix, bass } = parseChordString(origChord);
    let newSuffix: string;
    if (suffix.startsWith('m') && !suffix.startsWith('maj')) {
      newSuffix = suffix.slice(1);
    } else {
      newSuffix = 'm' + suffix;
    }
    const newChord = root + newSuffix + (bass ? '/' + bass : '');
    modifySongChord(origChord, newChord);
  };

  const toggleSongChord7th = (origChord: string) => {
    const { root, suffix, bass } = parseChordString(origChord);
    let newSuffix: string;
    if (suffix.includes('7')) {
      newSuffix = suffix.replace('7', '');
    } else {
      if (suffix.startsWith('m')) {
        newSuffix = 'm7' + suffix.slice(1);
      } else {
        newSuffix = '7' + suffix;
      }
    }
    const newChord = root + newSuffix + (bass ? '/' + bass : '');
    modifySongChord(origChord, newChord);
  };

  const editChordInFinder = (chord: string) => {
    const { root, suffix, bass } = parseChordString(chord);
    setRootName(root);
    setSuffix(suffix);
    setBassName(bass || "");
    setCustomNotes([]);
    setActiveTab('chords');
  };

  // Create cifra form states
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongArtist, setNewSongArtist] = useState("");
  const [newSongGenre, setNewSongGenre] = useState("MPB");
  const [newSongContent, setNewSongContent] = useState("");

  // Strum arpeggiation helper
  const playChordVoicing = (voicing: Voicing, tuning: Tuning) => {
    const ae = AudioEngine.getInstance();
    const frets = voicing.frets;
    const strings = tuning.strings;
    let strumDelay = 0;
    frets.forEach((fret, idx) => {
      if (fret === -1) return;
      const noteMidi = strings[idx] + fret;
      setTimeout(() => {
        ae.playMidi(noteMidi, 1.2);
      }, strumDelay);
      strumDelay += 45;
    });
  };

  const playChordByName = (chordStr: string) => {
    const { root, suffix, bass } = parseChordString(chordStr);
    if (!root) return;
    try {
      const parsedChord = buildChord(root, suffix, bass || undefined);
      const voicings = calculateVoicings(selectedTuning, parsedChord);
      if (voicings.length > 0) {
        playChordVoicing(voicings[0], selectedTuning);
      }
    } catch (e) {
      console.error("Erro ao reproduzir acorde pelo nome:", e);
    }
  };

  // Autoscroll effect
  const cifraScrollContainerRef = useRef<HTMLDivElement>(null);

  // Carousel drag-to-scroll refs and handlers
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('a')) {
      return;
    }
    if (!carouselRef.current) return;
    isDraggingRef.current = true;
    carouselRef.current.classList.add('cursor-grabbing');
    startXRef.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeftRef.current = carouselRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    if (carouselRef.current) {
      carouselRef.current.classList.remove('cursor-grabbing');
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (carouselRef.current) {
      carouselRef.current.classList.remove('cursor-grabbing');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    carouselRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isAutoScrolling) {
      intervalId = setInterval(() => {
        if (cifraScrollContainerRef.current) {
          cifraScrollContainerRef.current.scrollTop += autoScrollSpeed;
        }
      }, 50);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoScrolling, autoScrollSpeed]);

  // Render an interactive line of text with superscript chord buttons
  const renderInteractiveLine = (line: string, onChordClick: (chord: string) => void) => {
    const regex = /\[([^\]]+)\]/g;
    const songUseFlats = selectedSong ? shouldUseFlats(selectedSong.originalKey) : false;
    
    if (!line.includes('[')) {
      return <div className="min-h-[1.5rem] font-mono text-xs sm:text-sm text-gray-800">{line || ' '}</div>;
    }
    
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(line)) !== null) {
      const matchIndex = match.index;
      const chordName = match[1];
      
      // Add text segment before this chord
      if (matchIndex > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`} className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
            {line.slice(lastIndex, matchIndex)}
          </span>
        );
      }
      
      // Transpose the chord name
      const transposedChord = transposeChordString(chordName, transposeOffset, songUseFlats);
      
      // Look ahead to get the text after the chord to bind it, or if it's followed by another chord or end of line, we use space
      const nextTextStart = regex.lastIndex;
      const nextMatch = line.slice(nextTextStart);
      const nextChordIndex = nextMatch.indexOf('[');
      const textSegment = nextChordIndex === -1 ? nextMatch : nextMatch.slice(0, nextChordIndex);
      
      elements.push(
        <span key={`chord-${matchIndex}`} className="inline-block relative pt-5 mt-1 select-none mr-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChordClick(transposedChord);
            }}
            className="absolute top-0 left-0 font-bold text-[#0058e6] hover:text-[#cc3300] hover:underline text-[10px] sm:text-xs font-mono focus:outline-none cursor-pointer leading-none"
            title={`Tocar acorde ${transposedChord}`}
          >
            {transposedChord}
          </button>
          <span className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
            {textSegment || ' '}
          </span>
        </span>
      );
      
      lastIndex = matchIndex + chordName.length + 2; // +2 for brackets
    }
    
    // Add remaining text after the last match
    if (lastIndex < line.length) {
      elements.push(
        <span key={`text-end`} className="font-mono text-xs sm:text-sm text-gray-800 whitespace-pre">
          {line.slice(lastIndex)}
        </span>
      );
    }
    
    return (
      <div className="flex flex-wrap items-end min-h-[2.5rem] leading-relaxed">
        {elements}
      </div>
    );
  };

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
      className="h-[100dvh] flex flex-col justify-between overflow-hidden font-sans select-none relative"
      style={{ paddingBottom: sequencerPad }}
    >

      {/* --- DESKTOP WINDOW CONTAINER --- */}
      <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-start z-10 max-w-7xl w-full mx-auto gap-6">
        
        {/* Main Application Window */}
        <div className={`w-full bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl flex flex-col ${activeTab === 'cifras' ? 'flex-1 min-h-0' : ''}`}>
          
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
                onClick={() => setActiveTab('favorites')}
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
              onClick={() => setActiveTab('cifras')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'cifras' 
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span>Explore Cifras</span>
            </button>
            <button 
              onClick={() => setActiveTab('chords')}
              className={`shrink-0 px-2 sm:px-4 py-1.5 font-mono text-[10px] sm:text-xs font-bold rounded-t border-2 border-b-0 cursor-pointer ${
                activeTab === 'chords' 
                  ? 'bg-[#ece9d8] border-white border-t-[#0058e6] border-x-[#808080] translate-y-[2px] z-10 text-black' 
                  : 'bg-[#d4d0c8] border-[#ece9d8] border-r-[#808080] border-bottom-[#808080] text-gray-700 hover:bg-white/50'
              }`}
            >
              <span>Dicionário de Acordes</span>
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
            <div className="flex-1 w-full max-w-full flex flex-col p-2 sm:p-4 gap-4 min-h-0 bg-[#f5f4eb] overflow-hidden">
              <CifrasApp />
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
                          {filteredVoicings.slice(0, visibleVariationsLimit).map((voicing: Voicing, index: number) => {
                            const isFav = isVoicingFavorited(voicing);
                            const isInCifra = isVoicingInCifra(voicing);
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
                                />
                                <div className="absolute -top-1.5 -left-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-[#228b22] text-white border border-[#1a6b1a] rounded-sm font-mono shadow-md z-10">
                                  #{index + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {filteredVoicings.length > visibleVariationsLimit && (
                          <div className="w-full flex justify-center mt-6 mb-2">
                            <button 
                              onClick={() => setVisibleVariationsLimit(filteredVoicings.length)}
                              className="bevel-out bg-[#ece9d8] text-black px-6 py-2 font-bold text-sm active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white transition-all hover:bg-white"
                            >
                              Carregar Mais ({filteredVoicings.length - visibleVariationsLimit} posições ocultas)
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
            <span className="flex items-center gap-1.5">
              <StarIcon className="w-4 h-4 text-[#ff7f27]" fill="currentColor" />
              <span>Posições Favoritadas (Salvas Localmente)</span>
            </span>
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
                  Nenhuma posição favoritada. Clique no ícone da estrela nos diagramas acima para salvar posições preferidas!
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
                  className="px-3 py-1 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] font-bold text-xs hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <IconTrash className="w-3.5 h-3.5 text-red-600" />
                  <span>Limpar Tudo</span>
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

      {/* --- CREATE CIFRA MODAL --- */}
      {showCreateCifraModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-[500px] bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl flex flex-col font-mono">
            {/* Modal Title bar */}
            <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center rounded-t-md font-bold text-sm select-none">
              <div className="flex items-center gap-1.5">
                <IconAddDoc className="w-4 h-4 text-white" />
                <span>Criar Nova Cifra Personalizada</span>
              </div>
              <button 
                onClick={() => {
                  setShowCreateCifraModal(false);
                  setNewSongTitle("");
                  setNewSongArtist("");
                  setNewSongContent("");
                }}
                className="w-[21px] h-[21px] rounded bg-[#cc3300] border border-white flex items-center justify-center font-bold text-xs hover:bg-red-500 cursor-pointer"
              >
                ✕
              </button>
            </div>
            {/* Modal Form content */}
            <div className="p-4 flex flex-col gap-3 text-xs text-black">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-700">Título da Música:</span>
                <input
                  type="text"
                  placeholder="Ex: Tocando em Frente"
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                  className="bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-700">Artista / Autor:</span>
                <input
                  type="text"
                  placeholder="Ex: Almir Sater"
                  value={newSongArtist}
                  onChange={(e) => setNewSongArtist(e.target.value)}
                  className="bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-gray-700">Estilo / Gênero:</span>
                  <select
                    value={newSongGenre}
                    onChange={(e) => setNewSongGenre(e.target.value)}
                    className="bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none cursor-pointer"
                  >
                    <option value="MPB">MPB</option>
                    <option value="Sertanejo">Sertanejo & Viola</option>
                    <option value="Rock">Rock</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-gray-700">Tom de Referência:</span>
                  <select
                    className="bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none cursor-pointer"
                    id="new-song-key"
                  >
                    {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-700">Letra e Acordes (Formato colchetes):</span>
                <span className="text-[10px] text-gray-500 leading-tight">
                  Coloque os acordes entre colchetes acima das sílabas correspondentes. Exemplo:<br />
                  <code>Gosto de te [C]ver, leão[G]zinho</code>
                </span>
                <textarea
                  rows={8}
                  placeholder="[D]É preciso amor pra poder pulsar&#10;[G]É preciso paz pra poder sorrir..."
                  value={newSongContent}
                  onChange={(e) => setNewSongContent(e.target.value)}
                  className="bg-white border-2 border-r-white border-bottom-white border-[#808080] p-2 shadow-inner focus:outline-none font-mono text-[11px] leading-relaxed resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 border-t border-[#d4d0c8] pt-3 mt-1 select-none">
                <button
                  onClick={() => {
                    setShowCreateCifraModal(false);
                    setNewSongTitle("");
                    setNewSongArtist("");
                    setNewSongContent("");
                  }}
                  className="px-4 py-1.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  disabled={!newSongTitle.trim() || !newSongArtist.trim() || !newSongContent.trim()}
                  onClick={() => {
                    const keyEl = document.getElementById('new-song-key') as HTMLSelectElement | null;
                    const key = keyEl ? keyEl.value : 'C';
                    
                    // Extract chords used
                    const extractChordsFromContent = (text: string): string[] => {
                      const regex = /\[([^\]]+)\]/g;
                      const matches: string[] = [];
                      let match;
                      while ((match = regex.exec(text)) !== null) {
                        matches.push(match[1].trim());
                      }
                      return Array.from(new Set(matches));
                    };
                    
                    const extractedChords = extractChordsFromContent(newSongContent);
                    
                    const newSong: PresetSong = {
                      id: `custom-${Date.now()}`,
                      title: newSongTitle.trim(),
                      artist: newSongArtist.trim(),
                      genre: newSongGenre,
                      originalKey: key,
                      chordsUsed: extractedChords.length > 0 ? extractedChords : ["C"],
                      content: newSongContent
                    };
                    
                    const updated = [...customCifras, newSong];
                    setCustomCifras(updated);
                    localStorage.setItem('viola_libre_custom_cifras', JSON.stringify(updated));
                    
                    setShowCreateCifraModal(false);
                    setNewSongTitle("");
                    setNewSongArtist("");
                    setNewSongContent("");
                    setSelectedSong(newSong);
                  }}
                  className="px-4 py-1.5 bg-[#0058e6] text-white border border-white font-bold cursor-pointer hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar Cifra
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
              onClick={() => setActiveTab('cifras')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'cifras'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Explore Cifras</span>
            </button>

            <button 
              onClick={() => setActiveTab('chords')}
              className={`h-[28px] px-3 border text-xs font-mono font-bold rounded flex items-center gap-1.5 select-none cursor-pointer ${
                activeTab === 'chords'
                  ? 'bg-[#3a8bfb] text-white border-[#002fa7] border-t-white border-l-white shadow-[inset_1px_1px_0_#ffffff50]'
                  : 'bg-[#ece9d8] text-black border-white border-r-[#808080] border-bottom-[#808080] hover:bg-white'
              }`}
            >
              <span>Acordes</span>
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
