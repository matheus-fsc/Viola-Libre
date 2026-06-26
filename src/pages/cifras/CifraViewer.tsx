import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCifra, incrementView, favoriteCifra, updateDifficulty, type CifraDetail } from '../../services/api';
import { buildChord, calculateVoicings, noteNameToPitchClass } from '../../engine/chordCalculator';
import { PRESET_INSTRUMENTS, NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from '../../engine/tunings';
import { FretboardDiagram } from '../../components/FretboardDiagram';
import '../../components/Cifras.css';

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
    const transposedRootPc = (rootPc + semitones + 120) % 12;
    const transposedRoot = preferFlats ? NOTE_NAMES_FLAT[transposedRootPc] : NOTE_NAMES_SHARP[transposedRootPc];
    
    let transposedBass = '';
    if (bass) {
      const bassPc = noteNameToPitchClass(bass);
      const transposedBassPc = (bassPc + semitones + 120) % 12;
      transposedBass = preferFlats ? NOTE_NAMES_FLAT[transposedBassPc] : NOTE_NAMES_SHARP[transposedBassPc];
    }
    
    return transposedRoot + suffix + (transposedBass ? '/' + transposedBass : '');
  } catch {
    return chordStr;
  }
}

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
  
  // Scraped original chords
  const [originalChords, setOriginalChords] = useState<string[]>([]);
  
  // Carousel expanded state
  const [isCarouselExpanded, setIsCarouselExpanded] = useState<boolean>(false);

  // New features
  const [songKey, setSongKey] = useState<string>('');
  const [variationIndices, setVariationIndices] = useState<Record<string, number>>({});
  const [favoriteChords, setFavoriteChords] = useState<Record<string, boolean>>({});
  const [infoPopupChord, setInfoPopupChord] = useState<string | null>(null);

  useEffect(() => {
    if (artistSlug && songSlug) {
      setLoading(true);
      setTransposeOffset(0);
      getCifra(artistSlug, songSlug).then((data) => {
        setCifra(data);
        
        // Varrer acordes do HTML usando a tag <b>
        const regex = /<b>(.*?)<\/b>/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(data.content_html)) !== null) {
          const chord = match[1].trim();
          if (chord && !matches.includes(chord)) {
            matches.push(chord);
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

  const handleDifficulty = async (level: string) => {
    if (!artistSlug || !songSlug || !cifra) return;
    try {
      await updateDifficulty(artistSlug, songSlug, level);
      setCifra({ ...cifra, difficulty: level });
    } catch (e) {
      console.error(e);
    }
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

  // Transposed unique chords for the carousel
  const currentChords = useMemo(() => {
    return originalChords.map(c => transposeChordString(c, transposeOffset, false));
  }, [originalChords, transposeOffset]);

  // Default instrument (Viola) and tuning (Cebolão E) for the diagram rendering
  const defaultInst = PRESET_INSTRUMENTS[0];
  const defaultTuning = defaultInst.tunings[0];

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

      {/* Window Header */}
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center justify-between font-bold text-sm mb-2 rounded-t select-none">
        <div className="flex items-center truncate">
          <span className="mr-2">📝</span>
          <span className="truncate">{cifra.title} - {artistSlug}</span>
        </div>
        <button 
          onClick={() => navigate(`/${artistSlug}`)}
          className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white shrink-0 ml-2"
        >
          Voltar
        </button>
      </div>

      {/* Main layout container with fixed sidebar and scrolling content */}
      <div className="flex-1 flex flex-col gap-2">
        
        {/* Toolbar superior com botões de Tom e metadados */}
        <div className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex flex-wrap items-center justify-between gap-4 text-sm shrink-0">
          
          <div className="flex items-center gap-3">
            <span className="text-gray-600 flex items-center gap-1" title="Visualizações">
              👁️ {cifra.views || 1}
            </span>
            <span className="text-gray-600 flex items-center gap-1" title="Favoritos">
              ❤️ {cifra.favorited || 0}
            </span>
            
            <div className="flex items-center gap-1 ml-2">
              <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Dif:</label>
              <select 
                value={cifra.difficulty || ""}
                onChange={(e) => handleDifficulty(e.target.value)}
                className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer"
              >
                <option value="" disabled>...</option>
                <option value="iniciante">Fácil</option>
                <option value="intermediario">Médio</option>
                <option value="avancado">Difícil</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1 ml-2">
              <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Tom Original:</label>
              <span className="font-bold text-xs bg-white border border-gray-400 px-1 text-[#002fa7] min-w-[20px] text-center">
                {songKey || '?'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
              <span className="text-[11px] font-bold px-1 text-gray-700">TOM:</span>
              <button 
                onClick={() => setTransposeOffset(prev => prev - 1)}
                className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                title="Abaixar meio tom"
              >
                -½
              </button>
              <span className="font-mono text-xs font-bold w-6 text-center text-[#cc3300]">
                {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}
              </span>
              <button 
                onClick={() => setTransposeOffset(prev => prev + 1)}
                className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                title="Aumentar meio tom"
              >
                +½
              </button>
            </div>
            
            <button 
              onClick={handleFavorite}
              disabled={isFavoriting}
              className="bevel-out bg-[var(--color-winxp-panel)] px-3 py-1 text-xs font-bold flex items-center gap-1 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
            >
              <span className={isFavoriting ? 'opacity-50' : ''}>❤️ Favoritar</span>
            </button>
          </div>
        </div>

        {/* Carousel de Acordes Superior */}
        {currentChords.length > 0 && (
          <div className="bevel-out bg-[var(--color-winxp-panel)] p-2 shrink-0 flex flex-col gap-1 transition-all">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsCarouselExpanded(!isCarouselExpanded)}>
              <span className="text-xs font-bold text-[#002fa7] flex items-center gap-1">
                Acordes ({currentChords.length}) - {defaultTuning.name}
              </span>
              <button className="text-[10px] font-bold border border-gray-400 px-2 py-0.5 bg-[#ece9d8] hover:bg-white active:bg-gray-200">
                {isCarouselExpanded ? "Ocultar Diagramas" : "Expandir Visualização"}
              </button>
            </div>
            
            <div className={`flex gap-2 overflow-x-auto retro-scrollbar py-2 ${isCarouselExpanded ? 'items-start' : 'items-center'}`}>
              {currentChords.map((chordName, idx) => {
                const { root, suffix, bass } = parseChordString(chordName);
                let voicings: any[] = [];
                if (root) {
                  try {
                    const chordObj = buildChord(root, suffix, bass || undefined);
                    voicings = calculateVoicings(defaultTuning, chordObj);
                  } catch (e) {
                    // fallback
                  }
                }

                const currentVarIdx = variationIndices[chordName] || 0;
                const bestVoicing = voicings.length > 0 ? voicings[currentVarIdx % voicings.length] : null;

                const handleNextVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setVariationIndices(prev => ({ ...prev, [chordName]: (prev[chordName] || 0) + 1 }));
                };
                
                const handlePrevVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setVariationIndices(prev => {
                    const current = prev[chordName] || 0;
                    return { ...prev, [chordName]: current === 0 ? voicings.length - 1 : current - 1 };
                  });
                };
                
                const isFav = !!favoriteChords[chordName];
                const toggleFav = () => {
                  setFavoriteChords(prev => ({ ...prev, [chordName]: !prev[chordName] }));
                };

                return (
                  <div key={idx} className="bg-white bevel-in p-1 flex flex-col items-center shrink-0 min-w-[70px]">
                    {bestVoicing ? (
                      <FretboardDiagram
                        voicing={bestVoicing}
                        tuning={defaultTuning}
                        chordName={chordName}
                        compact={!isCarouselExpanded}
                        isFavorite={isFav}
                        onToggleFavorite={toggleFav}
                        isInCifra={false}
                        useFlats={false}
                        variationCurrentIndex={currentVarIdx % voicings.length}
                        variationTotal={voicings.length}
                        onNextVariation={handleNextVar}
                        onPrevVariation={handlePrevVar}
                        onInfoClick={() => setInfoPopupChord(chordName)}
                        infoActive={infoPopupChord === chordName}
                      />
                    ) : (
                      <div className="py-2 text-center text-[#cc3300] text-[10px] font-bold">
                        {chordName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cifra Content - Notepad Style */}
        <div className="flex-1 bevel-in bg-white p-4 retro-scrollbar font-mono text-sm leading-relaxed whitespace-pre-wrap text-black">
          <div 
            className="cifra-viewer-content"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        </div>

      </div>
    </div>
  );
};

