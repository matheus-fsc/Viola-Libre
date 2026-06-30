import React, { useEffect, useState, useMemo } from 'react';
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
import { buildChord, calculateVoicings, noteNameToPitchClass, parseChordString, transposeChordString } from '../../engine/chordCalculator';
import { PRESET_INSTRUMENTS } from '../../engine/tunings';
import { AudioEngine } from '../../engine/AudioEngine';
import { FretboardDiagram } from '../../components/FretboardDiagram';
import { TabTransposerBlock } from '../../components/TabTransposerBlock';
import { splitHtmlByTabs, TAB_POSITIONS, type ContentSegment } from '../../engine/tabTransposer';
import '../../components/Cifras.css';


interface VoicingFilter {
  proximity: boolean;
  maxNotes: boolean;
  muteFilter: 'any' | 'with_mute' | 'no_mute';
  prioritizeEasy: boolean;
}
const DEFAULT_FILTER: VoicingFilter = { proximity: false, maxNotes: false, muteFilter: 'any', prioritizeEasy: false };

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
  const [panelPosition, setPanelPosition] = useState<'left' | 'top' | 'right' | 'bottom'>('left');
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
    return merged;
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
    return currentChords.map(chordName => {
      const { root, suffix, bass } = parseChordString(chordName);
      if (!root) return [] as Voicing[];
      try {
        const chordObj = buildChord(root, suffix, bass || undefined);
        return calculateVoicings(currentTuning, chordObj);
      } catch { return [] as Voicing[]; }
    });
  }, [currentChords, currentTuning]);

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
          <div className={`bevel-out bg-[var(--color-winxp-panel)] p-2 flex flex-wrap items-center justify-between gap-3 text-sm shrink-0 ${panelPosition === 'bottom' ? 'order-last' : ''}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={cyclePosition} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0 text-sm font-bold border border-gray-400" title="Mover painel">{PANEL_ICONS[panelPosition]}</button>
              <span className="text-gray-600 flex items-center gap-1 font-bold" title="Visualizações"><Eye size={16} className="text-blue-600" /> {cifra.views || 1}</span>
              <span className="text-gray-600 flex items-center gap-1 font-bold" title="Favoritos"><Heart size={16} className="text-red-500" /> {cifra.favorited || 0}</span>
              <div className="flex items-center gap-1">
                <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Tom:</label>
                <span className="font-bold text-xs bg-white border border-gray-400 px-1 text-[#002fa7] min-w-[20px] text-center">{songKey || '?'}</span>
              </div>
              <div className="flex items-center gap-1">
                <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Variações:</label>
                <select value={currentVersionSlug} onChange={(e) => handleVersionChange(e.target.value)} disabled={versionOptions.length <= 1} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[120px] disabled:opacity-60 disabled:cursor-default">
                  {versionOptions.map(v => (<option key={v.id} value={v.slug}>{v.version_name || 'Principal'}</option>))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Instrumento:</label>
                <select value={selectedInstId} onChange={(e) => { const newInst = PRESET_INSTRUMENTS.find(i => i.id === e.target.value); if (newInst) { setSelectedInstId(newInst.id); setSelectedTuningId(newInst.defaultTuningId || newInst.tunings[0].id); setTabPosIdx(0); } }} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[100px]">
                  {PRESET_INSTRUMENTS.map(inst => (<option key={inst.id} value={inst.id}>{inst.name}</option>))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="font-bold text-[11px] uppercase tracking-wider text-gray-700">Afinação:</label>
                <select value={selectedTuningId} onChange={(e) => setSelectedTuningId(e.target.value)} className="bevel-in bg-white px-1 py-0 text-xs outline-none cursor-pointer max-w-[100px]">
                  {currentInst.tunings.map(tuning => (<option key={tuning.id} value={tuning.id}>{tuning.name.split(' (')[0]}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
                <span className="text-[11px] font-bold px-1 text-gray-700">TOM:</span>
                <button onClick={() => setTransposeOffset(p => p - 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white" title="Abaixar meio tom">-½</button>
                <span className="font-mono text-xs font-bold w-6 text-center text-[#cc3300]">{transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}</span>
                <button onClick={() => setTransposeOffset(p => p + 1)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white" title="Aumentar meio tom">+½</button>
              </div>
              <div className="flex items-center bg-[#d4d0c8] bevel-in px-1 py-1 gap-1">
                <span className="text-[11px] font-bold px-1 text-gray-700">POS.TAB:</span>
                <button onClick={() => setTabPosIdx(p => (p - 1 + TAB_POSITIONS.length) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">◀</button>
                <span className="font-mono text-xs font-bold min-w-[44px] text-center text-[#005500]">{TAB_POSITIONS[tabPosIdx].label}</span>
                <button onClick={() => setTabPosIdx(p => (p + 1) % TAB_POSITIONS.length)} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">▶</button>
              </div>
              <button onClick={() => setShowTabs(v => !v)} className={`bevel-out px-3 py-1 text-xs font-bold border border-gray-400 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white ${!showTabs ? 'bg-[#316ac5] text-white' : 'bg-[var(--color-winxp-panel)] text-[#002fa7]'}`}>{showTabs ? 'Tabs ▼' : 'Tabs ▶'}</button>
              <button onClick={handleFavorite} disabled={isFavoriting} className="bevel-out bg-[var(--color-winxp-panel)] px-3 py-1 text-xs font-bold flex items-center gap-1 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black">
                <Heart size={14} className={`${isFavoriting ? 'opacity-50' : ''} ${cifra.favorited && cifra.favorited > 0 ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
                <span className={isFavoriting ? 'opacity-50' : ''}>Favoritar</span>
              </button>
              <button onClick={() => setSeqModalOpen('save')} className={`bevel-out px-3 py-1 text-xs font-bold flex items-center gap-1 active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black ${savedHash ? 'bg-[#d4edda] border border-green-500' : 'bg-[var(--color-winxp-panel)]'}`} title="Salvar ou carregar sequência de acordes">
                <Save size={13} className={savedHash ? 'text-green-700' : 'text-gray-600'} />
                <span>{savedHash ? 'Sequência ✓' : 'Sequência'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Área de conteúdo: carousel + cifra */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">

        {/* Carousel de Acordes Superior */}
        {currentChords.length > 0 && (
          <div className="bevel-out bg-[var(--color-winxp-panel)] p-2 shrink-0 flex flex-col gap-1 transition-all">
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
                  <div className="absolute right-0 top-full mt-1 z-40 bg-[#ece9d8] bevel-out shadow-lg w-60 text-xs select-none">
                    <div className="winxp-gradient-blue text-white px-2 py-0.5 flex items-center justify-between font-bold">
                      <span>Filtrar Variações</span>
                      <button
                        onClick={() => setFilterPopupOpen(false)}
                        className="bg-red-600 border border-white border-r-gray-600 border-b-gray-600 px-1.5 text-white font-bold leading-tight"
                      >
                        ×
                      </button>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-gray-600 uppercase tracking-wider text-[9px] mb-1">Ordenação (combinável)</p>
                      <label className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-white">
                        <input type="checkbox" checked={voicingFilter.proximity} className="accent-[#316ac5]"
                          onChange={e => { setVoicingFilter(f => ({ ...f, proximity: e.target.checked })); setVariationIndices({}); }} />
                        ★ Acordes próximos
                      </label>
                      <label className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-white">
                        <input type="checkbox" checked={voicingFilter.maxNotes} className="accent-[#316ac5]"
                          onChange={e => { setVoicingFilter(f => ({ ...f, maxNotes: e.target.checked })); setVariationIndices({}); }} />
                        ♪ Mais notas soando
                      </label>
                      <p className="font-bold text-gray-600 uppercase tracking-wider text-[9px] mt-2 mb-1">Abafamento Interno</p>
                      {([
                        ['any',       'Qualquer'],
                        ['with_mute', '≈ Com abafamento'],
                        ['no_mute',   '○ Sem abafamento'],
                      ] as const).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-white">
                          <input type="radio" name="muteFilter" className="accent-[#316ac5]"
                            checked={voicingFilter.muteFilter === val}
                            onChange={() => { setVoicingFilter(f => ({ ...f, muteFilter: val })); setVariationIndices({}); }} />
                          {label}
                        </label>
                      ))}
                      <div className="border-t border-gray-400 mt-2 pt-2">
                        <label className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-white">
                          <input type="checkbox" checked={voicingFilter.prioritizeEasy} className="accent-[#316ac5]"
                            onChange={e => { setVoicingFilter(f => ({ ...f, prioritizeEasy: e.target.checked })); setVariationIndices({}); }} />
                          Priorizar acordes fáceis
                        </label>
                        <p className="text-gray-400 px-1 text-[9px] leading-tight mt-0.5">Exibe só acordes sem barra, sem abafamento interno e até traste 5</p>
                      </div>
                      <div className="border-t border-gray-400 mt-2 pt-2 flex justify-end">
                        <button
                          onClick={() => { setVoicingFilter(DEFAULT_FILTER); setVariationIndices({}); setLockedVariations({}); setExcludedFromFilter({}); }}
                          className="bevel-out bg-[#ece9d8] border border-gray-400 px-2 py-0.5 hover:bg-white font-bold text-[10px]"
                        >
                          Restaurar padrão
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto retro-scrollbar py-2 items-center">
              {currentChords.map((chordName, idx) => {
                const voicings = displayedVoicings[idx] ?? [];
                const isChordLocked = chordName in lockedVariations;

                // Índice efetivo: respeita cadeado
                const rawIdx = variationIndices[chordName] ?? 0;
                const effectiveIdx = isChordLocked
                  ? (lockedVariations[chordName] ?? 0) % Math.max(voicings.length, 1)
                  : rawIdx % Math.max(voicings.length, 1);

                const bestVoicing = voicings.length > 0 ? voicings[effectiveIdx] : null;

                const handleNextVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isChordLocked) return;
                  setVariationIndices(prev => ({ ...prev, [chordName]: rawIdx + 1 }));
                };

                const handlePrevVar = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isChordLocked) return;
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
                    } else if (bestVoicing) {
                      // effectiveIdx is an index in displayedVoicings (sorted/filtered).
                      // After locking the chord becomes a passthrough using allVoicings (original order).
                      // We must store the index in allVoicings, not in the sorted array.
                      const allIdx = allVoicings[idx].indexOf(bestVoicing);
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
                  <div key={idx} className="bg-white bevel-in p-1 flex flex-col items-center shrink-0 min-w-[70px]">
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
                      />
                    ) : (
                      <div className="py-2 text-center text-[#cc3300] text-[10px] font-bold">
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
        <div className="flex-1 bevel-in bg-white p-4 retro-scrollbar font-mono text-sm leading-relaxed text-black overflow-x-hidden overflow-y-auto">
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
                className="cifra-viewer-content whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: seg.content }}
              />
            )
          )}
        </div>

        </div>{/* fim área de conteúdo */}

      </div>
    </div>
  );
};

