import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { VirtuosoGrid } from 'react-virtuoso';
import { Flame, Heart, FileText, Mic2, Music, Guitar } from 'lucide-react';
import { 
  getArtists,
  getInitialArtists,
  searchSongsGlobal, 
  getTopSongs, 
  getTopLikes,
  getGeneros,
  getArtistsByGenre,
  getSongs,
  type Artist, 
  type GlobalSearchResult 
} from '../../services/api';

const GridList = React.forwardRef<HTMLDivElement, any>((props, ref) => (
  <div {...props} ref={ref} className="flex flex-wrap pt-2" />
));
const GridItem = (props: any) => (
  <div {...props} className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 p-1.5 flex-none box-border" />
);

export const ArtistList: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      // console.log('VIOLA LIBRE LOG: Altura do container Virtuoso:', entries[0].contentRect.height, 'px');
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'artistas' | 'musicas' | 'top_views' | 'top_likes' | 'generos'>('artistas');
  
  const [songResults, setSongResults] = useState<GlobalSearchResult[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [hasSearchedSongs, setHasSearchedSongs] = useState(false);

  // Estados para Gêneros
  const [generos, setGeneros] = useState<string[]>([]);
  const [loadingGeneros, setLoadingGeneros] = useState(false);
  const [selectedGenero, setSelectedGenero] = useState<string | null>(null);
  const [generoArtists, setGeneroArtists] = useState<Artist[]>([]);
  const [loadingGeneroArtists, setLoadingGeneroArtists] = useState(false);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load artists with 2-step hydration (Above-the-fold Priority)
  useEffect(() => {
    let fullLoaded = false;
    
    // 1. Puxa a amostra minúscula inicial para destravar a tela imediatamente
    getInitialArtists().then((initialData) => {
      if (!fullLoaded && initialData && initialData.length > 0) {
        setArtists(initialData);
        setLoadingArtists(false);
      }
    }).catch(console.error);

    // 2. Puxa silenciosamente o dicionário massivo de 30 mil artistas (300KB)
    getArtists().then((fullData) => {
      fullLoaded = true;
      setArtists(Array.isArray(fullData) ? fullData : []);
      setLoadingArtists(false);
    }).catch(err => {
      console.error(err);
      if (!fullLoaded) {
        setArtists([]);
        setLoadingArtists(false);
      }
    });
  }, []);

  // Load Top Views ou Top Likes
  useEffect(() => {
    if (searchMode === 'top_views') {
      setLoadingSongs(true);
      getTopSongs().then(data => {
        setSongResults(Array.isArray(data) ? data : []);
        setLoadingSongs(false);
      }).catch(() => {
        setSongResults([]);
        setLoadingSongs(false);
      });
    } else if (searchMode === 'top_likes') {
      setLoadingSongs(true);
      getTopLikes().then(data => {
        setSongResults(Array.isArray(data) ? data : []);
        setLoadingSongs(false);
      }).catch(() => {
        setSongResults([]);
        setLoadingSongs(false);
      });
    } else if (searchMode === 'generos') {
      setLoadingGeneros(true);
      getGeneros().then(data => {
        setGeneros(Array.isArray(data) ? data : []);
        setLoadingGeneros(false);
      }).catch(() => {
        setGeneros([]);
        setLoadingGeneros(false);
      });
    }
  }, [searchMode]);

  // Load Artists for a specific Genre
  useEffect(() => {
    if (searchMode === 'generos' && selectedGenero) {
      setLoadingGeneroArtists(true);
      getArtistsByGenre(selectedGenero).then(data => {
        setGeneroArtists(Array.isArray(data) ? data : []);
        setLoadingGeneroArtists(false);
      }).catch(() => {
        setGeneroArtists([]);
        setLoadingGeneroArtists(false);
      });
    }
  }, [searchMode, selectedGenero]);

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
    }, 500);

    return () => clearTimeout(timer);
  }, [search, searchMode]);

  // Helper to normalize text
  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const normalizedSearch = normalizeText(search);
  const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);

  const filteredArtists = useMemo(() => {
    let arr = Array.isArray(artists) ? artists : [];
    
    // Filtro Alfabético
    if (selectedLetter && searchMode === 'artistas') {
      arr = arr.filter(a => {
        const firstChar = normalizeText(a.name)[0];
        if (selectedLetter === '#') return !/[a-z]/.test(firstChar);
        return firstChar === selectedLetter.toLowerCase();
      });
    }

    if (!searchWords.length) return arr;
    
    return arr
      .map(artist => {
        const normName = normalizeText(artist.name);
        let score = 0;
        
        const matchedWords = searchWords.filter(word => normName.includes(word));
        const matchCount = matchedWords.length;
        
        if (normName === normalizedSearch) {
          score = 100;
        } else if (normName.startsWith(normalizedSearch)) {
          score = 50;
        } else if (normName.includes(normalizedSearch)) {
          score = 40;
        } else if (normalizedSearch.includes(normName)) {
          score = 35;
        } else if (matchCount === searchWords.length) {
          score = 15;
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
  }, [artists, normalizedSearch, searchWords, selectedLetter, searchMode]);


  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      {/* Window Header */}
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center font-bold text-sm mb-2 rounded-t select-none">
        <Music size={16} className="mr-2" />
        Explorador de Cifras
      </div>

      <div className="flex-1 bevel-in bg-white p-4 flex flex-col overflow-hidden min-h-0">
        {/* Filtros e Tabs Rápidas */}
        <div className="flex flex-wrap gap-2 mb-4 p-2 bg-[var(--color-winxp-panel)] bevel-out shrink-0">
          <button 
            onClick={() => { setSearchMode('artistas'); setSearch(''); setSelectedGenero(null); }}
            className={`px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'artistas' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            Artistas
          </button>
          <button 
            onClick={() => { setSearchMode('musicas'); setSearch(''); setSelectedGenero(null); }}
            className={`px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'musicas' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            Músicas (Busca)
          </button>
          <button 
            onClick={() => { setSearchMode('top_views'); setSelectedGenero(null); }}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'top_views' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            <Flame size={16} className={searchMode === 'top_views' ? "text-orange-300" : "text-orange-500"} /> + Views
          </button>
          <button 
            onClick={() => { setSearchMode('top_likes'); setSelectedGenero(null); }}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'top_likes' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            <Heart size={16} className={searchMode === 'top_likes' ? "text-red-300" : "text-red-500"} /> + Likes
          </button>
          <button 
            onClick={() => { setSearchMode('generos'); setSelectedGenero(null); }}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'generos' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            <Guitar size={16} /> Gêneros
          </button>
        </div>

        {/* Search Input (Apenas visivel em Artistas ou Musicas) */}
        {(searchMode === 'artistas' || searchMode === 'musicas') && (
          <div className="flex items-center w-full mb-4 shrink-0">
            <input 
              type="text" 
              placeholder={searchMode === 'artistas' ? "Buscar pelo nome do artista..." : "Buscar nome da música (mín. 2 letras)..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bevel-in px-3 py-2 text-sm w-full outline-none"
            />
          </div>
        )}

        {/* Alphabet Filter (Apenas visível em Artistas) */}
        {searchMode === 'artistas' && !search && (
          <div className="flex flex-wrap gap-1 mb-4 justify-center shrink-0">
            {['ALL', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','#'].map(letter => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter === 'ALL' ? null : letter)}
                className={`w-7 h-7 text-xs font-bold flex items-center justify-center border bevel-out transition-colors ${
                  (letter === 'ALL' && !selectedLetter) || letter === selectedLetter 
                    ? 'bg-[#316ac5] text-white border-[#316ac5]' 
                    : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          {searchMode === 'artistas' && (
loadingArtists ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-600">
                Carregando artistas...
              </div>
            ) : (
              <div className="flex-1 w-full min-h-0 flex flex-col" ref={wrapperRef}>
                {filteredArtists.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-8">
                    Nenhum artista encontrado com "{search}"
                  </div>
                ) : (
                  <VirtuosoGrid
                    style={{ flex: 1, width: '100%' }}
                    className="retro-scrollbar pr-2 pb-10"
                      data={filteredArtists}
                      components={{
                        List: GridList,
                        Item: GridItem
                      }}
                      itemContent={(index, artist) => (
                        <div 
                          key={artist.id}
                          onClick={() => navigate(`/${artist.slug}`)}
                          className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none h-[52px]"
                        >
                          <div className="w-8 h-8 mr-3 bg-white bevel-in flex items-center justify-center text-lg text-gray-600 group-hover:text-[#316ac5]">
                            <Mic2 size={18} />
                          </div>
                          <div className="flex flex-col flex-1 truncate">
                            <span className="font-bold text-sm truncate">{artist.name}</span>
                            {artist.genre && <span className="text-[10px] text-gray-500 uppercase">{artist.genre}</span>}
                          </div>
                        </div>
                      )}
                      rangeChanged={({ startIndex, endIndex }) => {
                        const visible = filteredArtists.slice(startIndex, endIndex + 1);
                        visible.forEach((artist, i) => {
                          setTimeout(() => {
                            getSongs(artist.slug).catch(() => {});
                          }, i * 30);
                        });
                      }}
                    />
                )}
              </div>
            )
          )}

          {searchMode === 'musicas' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {loadingSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-600">
                  Buscando músicas...
                </div>
              ) : !hasSearchedSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-500">
                  Digite pelo menos 2 caracteres para buscar músicas em todo o banco.
                </div>
              ) : (
                <div className="flex-1 w-full min-h-0">
                  {songResults.length === 0 && search.length >= 2 ? (
                    <div className="text-center text-sm text-gray-500 py-8">
                      Nenhuma música encontrada contendo "{search}"
                    </div>
                  ) : (
                    <VirtuosoGrid
                      style={{ flex: 1, width: '100%' }}
                      className="retro-scrollbar pr-2 pb-10"
                        data={songResults}
                        listClassName="flex flex-col gap-2 pb-8"
                        itemContent={(index, song) => (
                          <div 
                            key={song.id}
                            onClick={() => navigate(`/${song.artist_slug}/${song.slug}`)}
                            className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none"
                          >
                            <div className="mr-3 text-gray-500 group-hover:text-white">
                              <FileText size={18} />
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
                        )}
                      />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(searchMode === 'top_views' || searchMode === 'top_likes') && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {loadingSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-600">
                  Carregando ranking...
                </div>
              ) : (
                <div className="flex-1 w-full flex flex-col min-h-0">
                  <h3 className="flex items-center gap-2 font-bold text-[#316ac5] mb-2 border-b border-gray-300 pb-1 shrink-0">
                    {searchMode === 'top_views' ? (
                      <><Flame size={18} className="text-orange-500" /> Top 50 Mais Visualizadas</>
                    ) : (
                      <><Heart size={18} className="text-red-500" /> Top 50 Mais Curtidas</>
                    )}
                  </h3>
                  {songResults.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-8">
                      Nenhuma música encontrada no ranking.
                    </div>
                  ) : (
                    <VirtuosoGrid
                      style={{ flex: 1, width: '100%' }}
                      className="retro-scrollbar pr-2 pb-10"
                        data={songResults}
                        listClassName="flex flex-col gap-2 pb-8"
                        itemContent={(index, song) => (
                          <div 
                            key={song.id}
                            onClick={() => navigate(`/${song.artist_slug}/${song.slug}`)}
                            className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none"
                          >
                            <div className="w-6 font-bold text-gray-400 group-hover:text-white">
                              {index + 1}º
                            </div>
                            <div className="mr-3 text-gray-500 group-hover:text-white">
                              {searchMode === 'top_views' ? <Flame size={18} className="text-orange-500 group-hover:text-white" /> : <Heart size={18} className="text-red-500 group-hover:text-white" />}
                            </div>
                            <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{song.title}</span>
                                <span className="text-xs text-gray-500 group-hover:text-gray-200">{song.artist_name}</span>
                              </div>
                              <span className="text-xs font-bold text-gray-500 group-hover:text-gray-200 mt-1 md:mt-0">
                                {searchMode === 'top_views' ? `${song.views} views` : `${song.likes} likes`}
                              </span>
                            </div>
                          </div>
                        )}
                      />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {searchMode === 'generos' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {!selectedGenero ? (
                loadingGeneros ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-600">
                    Carregando gêneros...
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto retro-scrollbar pr-2 pb-10">
                    <div className="flex flex-wrap gap-3 mt-2">
                      {generos.map(g => (
                        <button
                          key={g}
                          onClick={() => setSelectedGenero(g)}
                          className="bevel-out bg-[var(--color-winxp-panel)] px-4 py-3 font-bold text-sm hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white shadow-sm flex items-center gap-2"
                        >
                          <Guitar size={18} className="text-gray-600" /> {g}
                        </button>
                      ))}
                      {generos.length === 0 && (
                        <div className="w-full text-center text-sm text-gray-500 py-8">
                          Nenhum gênero catalogado no momento.
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex items-center gap-3 border-b border-gray-300 pb-2 mb-2 shrink-0">
                    <button 
                      onClick={() => setSelectedGenero(null)}
                      className="text-sm font-bold bg-[#316ac5] text-white px-2 py-1 bevel-out active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
                    >
                      &lt; Voltar
                    </button>
                    <h3 className="font-bold text-[#316ac5] text-lg">Top Artistas: {selectedGenero}</h3>
                  </div>

                  {loadingGeneroArtists ? (
                    <div className="flex items-center justify-center h-full text-sm text-gray-600 py-8">
                      Carregando artistas de {selectedGenero}...
                    </div>
                  ) : (
                    <VirtuosoGrid
                      style={{ flex: 1, width: '100%' }}
                      className="retro-scrollbar pr-2 pb-10"
                        data={generoArtists}
                        components={{
                          List: GridList,
                          Item: GridItem
                        }}
                        itemContent={(index, artist) => (
                          <div 
                            key={artist.id}
                            onClick={() => navigate(`/${artist.slug}`)}
                            className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none h-[52px]"
                          >
                            <div className="w-8 h-8 mr-3 bg-white bevel-in flex items-center justify-center text-lg text-gray-600 group-hover:text-[#316ac5]">
                              <Mic2 size={18} />
                            </div>
                            <div className="flex flex-col flex-1 truncate">
                              <span className="font-bold text-sm truncate">{artist.name}</span>
                            </div>
                          </div>
                        )}
                      />
                      )}
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
