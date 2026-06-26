import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getArtists, searchSongsGlobal, type Artist, type GlobalSearchResult } from '../../services/api';

export const ArtistList: React.FC = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'artistas' | 'musicas'>('artistas');
  
  const [songResults, setSongResults] = useState<GlobalSearchResult[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [hasSearchedSongs, setHasSearchedSongs] = useState(false);

  // Lazy loading para renderização (DOM)
  const [visibleCount, setVisibleCount] = useState(50);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  const navigate = useNavigate();

  // Load artists once on mount
  useEffect(() => {
    getArtists().then((data) => {
      setArtists(Array.isArray(data) ? data : []);
      setLoadingArtists(false);
    }).catch(err => {
      console.error(err);
      setArtists([]);
      setLoadingArtists(false);
    });
  }, []);

  // Debounced song search
  useEffect(() => {
    if (searchMode !== 'musicas') return;

    if (search.length < 2) {
      setSongResults([]);
      setHasSearchedSongs(false);
      setLoadingSongs(false);
      return;
    }

    setLoadingSongs(true);
    setHasSearchedSongs(true);

    const timer = setTimeout(() => {
      searchSongsGlobal(search)
        .then(data => {
          setSongResults(Array.isArray(data) ? data : []);
          setLoadingSongs(false);
        })
        .catch(err => {
          console.error(err);
          setSongResults([]);
          setLoadingSongs(false);
        });
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [search, searchMode]);

  // Helper to normalize text (remove accents and lower case)
  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const normalizedSearch = normalizeText(search);
  const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(50);
  }, [normalizedSearch, searchMode]);

  const lastElementRef = React.useCallback((node: HTMLDivElement | null) => {
    if (loadingArtists) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 50);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loadingArtists]);

  const filteredArtists = useMemo(() => {
    const arr = Array.isArray(artists) ? artists : [];
    if (!searchWords.length) return arr;
    
    return arr
      .map(artist => {
        const normName = normalizeText(artist.name);
        let score = 0;
        
        const matchedWords = searchWords.filter(word => normName.includes(word));
        const matchCount = matchedWords.length;
        
        if (normName === normalizedSearch) {
          score = 100; // Exact match
        } else if (normName.startsWith(normalizedSearch)) {
          score = 50; // Starts with
        } else if (normName.includes(normalizedSearch)) {
          score = 40; // Contains exact phrase
        } else if (normalizedSearch.includes(normName)) {
          score = 35; // Search phrase completely contains the artist name
        } else if (matchCount === searchWords.length) {
          score = 15; // Contains all words (any order)
        } else if (matchCount > 0 && matchCount >= Math.ceil(searchWords.length / 2)) {
          const hasSignificantMatch = matchedWords.some(w => w.length > 2);
          if (hasSignificantMatch) score = Math.floor((matchCount / searchWords.length) * 10);
        } else if (matchCount > 0) {
          const hasSignificantMatch = matchedWords.some(w => w.length > 2);
          if (hasSignificantMatch) score = matchCount;
        }
        
        return { artist, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.artist);
  }, [artists, normalizedSearch, searchWords]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      {/* Window Header */}
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center font-bold text-sm mb-2 rounded-t select-none">
        <span className="mr-2">🎵</span>
        Explorador de Cifras
      </div>

      <div className="flex-1 bevel-in bg-white p-4 overflow-y-auto flex flex-col retro-scrollbar">
        {/* Search Controls */}
        <div className="bevel-out bg-[var(--color-winxp-panel)] p-3 mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">Buscar por:</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input 
                type="radio" 
                name="searchMode" 
                checked={searchMode === 'artistas'} 
                onChange={() => setSearchMode('artistas')}
              />
              Artistas
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input 
                type="radio" 
                name="searchMode" 
                checked={searchMode === 'musicas'} 
                onChange={() => setSearchMode('musicas')}
              />
              Músicas
            </label>
          </div>

          <div className="flex-1 flex justify-end items-center w-full md:w-auto">
            <input 
              type="text" 
              placeholder={searchMode === 'artistas' ? "Nome do artista..." : "Nome da música (mínimo 2 letras)..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bevel-in px-2 py-1 text-sm w-full md:w-64 outline-none"
            />
            {/* O botão "Buscar" pode forçar a busca, mas estamos usando debounce também */}
            <button className="bevel-out bg-[var(--color-winxp-panel)] px-3 py-1 ml-2 text-sm font-bold active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">
              Buscar
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {searchMode === 'artistas' ? (
            loadingArtists ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-600">
                Carregando artistas...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredArtists.slice(0, visibleCount).map(artist => (
                  <div 
                    key={artist.id}
                    onClick={() => navigate(`/${artist.slug}`)}
                    className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none"
                  >
                    <div className="w-8 h-8 mr-3 bg-white bevel-in flex items-center justify-center text-lg">
                      🎤
                    </div>
                    <span className="font-bold text-sm truncate">{artist.name}</span>
                  </div>
                ))}
                {visibleCount < filteredArtists.length && (
                  <div ref={lastElementRef} className="col-span-full h-10 flex items-center justify-center text-gray-500 text-sm">
                    Carregando mais...
                  </div>
                )}
                {filteredArtists.length === 0 && (
                  <div className="col-span-full text-center text-sm text-gray-500 py-8">
                    Nenhum artista encontrado com "{search}"
                  </div>
                )}
              </div>
            )
          ) : (
            // Modo Músicas
            <div className="flex flex-col h-full">
              {loadingSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-600">
                  Buscando músicas...
                </div>
              ) : !hasSearchedSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-500">
                  Digite pelo menos 2 caracteres para buscar músicas.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {songResults.map(song => (
                    <div 
                      key={song.id}
                      onClick={() => navigate(`/${song.artist_slug}/${song.slug}`)}
                      className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none"
                    >
                      <div className="mr-3 text-lg group-hover:text-white text-gray-500">
                        📄
                      </div>
                      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{song.title}</span>
                          <span className="text-xs text-gray-500 group-hover:text-gray-200">{song.artist_name}</span>
                        </div>
                        {song.version_name && (
                          <span className="mt-1 md:mt-0 text-xs bg-gray-200 text-gray-700 px-1 border border-gray-400 group-hover:bg-[#1a3b6e] group-hover:text-white group-hover:border-transparent w-fit">
                            {song.version_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {songResults.length === 0 && search.length >= 2 && (
                    <div className="text-center text-sm text-gray-500 py-8">
                      Nenhuma música encontrada contendo "{search}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
