import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { InfiniteLoader } from '../../components/InfiniteLoader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, Heart, FileText, Mic2, Music, Guitar, TrendingUp } from 'lucide-react';

// ─── Genre flag SVGs ──────────────────────────────────────────────────────────
// Simplified cute flags used as button backgrounds in the genre grid.

const FlagBR: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="84" fill="#009B3A"/>
    <polygon points="60,6 114,42 60,78 6,42" fill="#FEDF00"/>
    <circle cx="60" cy="42" r="20" fill="#002776"/>
    <rect x="40" y="39.5" width="40" height="5" fill="white" rx="2.5"/>
    {([[52,36],[60,31],[68,36],[56,47],[64,47]] as [number,number][]).map(([cx,cy],i) => (
      <circle key={i} cx={cx} cy={cy} r="2.5" fill="white"/>
    ))}
  </svg>
);

const FlagUS: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x="0" y={i*12} width="120" height="12" fill={i%2===0 ? "#B22234" : "#F5F5F5"}/>
    ))}
    <rect x="0" y="0" width="50" height="45" fill="#3C3B6E"/>
    {([7,16,25,34] as number[]).flatMap(y => ([8,17,26,35,44] as number[]).map(x => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="white"/>
    )))}
  </svg>
);

const FlagUK: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="84" fill="#012169"/>
    <line x1="0" y1="0" x2="120" y2="84" stroke="white" strokeWidth="16"/>
    <line x1="120" y1="0" x2="0" y2="84" stroke="white" strokeWidth="16"/>
    <line x1="0" y1="0" x2="120" y2="84" stroke="#C8102E" strokeWidth="10"/>
    <line x1="120" y1="0" x2="0" y2="84" stroke="#C8102E" strokeWidth="10"/>
    <rect x="50" y="0" width="20" height="84" fill="white"/>
    <rect x="0" y="32" width="120" height="20" fill="white"/>
    <rect x="54" y="0" width="12" height="84" fill="#C8102E"/>
    <rect x="0" y="36" width="120" height="12" fill="#C8102E"/>
  </svg>
);

const FlagJM: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <polygon points="0,0 120,0 60,42" fill="#FED100"/>
    <polygon points="0,84 120,84 60,42" fill="#FED100"/>
    <polygon points="0,0 0,84 60,42" fill="#009B3A"/>
    <polygon points="120,0 120,84 60,42" fill="#009B3A"/>
    <line x1="0" y1="0" x2="120" y2="84" stroke="black" strokeWidth="14"/>
    <line x1="120" y1="0" x2="0" y2="84" stroke="black" strokeWidth="14"/>
  </svg>
);

const FlagAR: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="84" fill="#74ACDF"/>
    <rect y="28" width="120" height="28" fill="white"/>
    <circle cx="60" cy="42" r="10" fill="#F6B40E"/>
    {Array.from({length:16},(_,i)=>{const a=i*(Math.PI*2/16); return(
      <line key={i} x1="60" y1="42" x2={60+Math.cos(a)*16} y2={42+Math.sin(a)*16} stroke="#F6B40E" strokeWidth="2.5"/>
    )})}<circle cx="60" cy="42" r="6" fill="#843511"/>
  </svg>
);

const FlagFR: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect x="0"  width="40" height="84" fill="#002395"/>
    <rect x="40" width="40" height="84" fill="#EDEDED"/>
    <rect x="80" width="40" height="84" fill="#ED2939"/>
  </svg>
);

const FlagMX: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect x="0"  width="40" height="84" fill="#006847"/>
    <rect x="40" width="40" height="84" fill="#FFFFFF"/>
    <rect x="80" width="40" height="84" fill="#CE1126"/>
    <circle cx="60" cy="42" r="9" fill="#8B6914" opacity="0.8"/>
    <circle cx="60" cy="42" r="5" fill="#A0522D" opacity="0.9"/>
  </svg>
);

const SymbolGospel: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="84" fill="#F5F0E0"/>
    <rect x="54" y="10" width="12" height="64" fill="#D4AF37" rx="4"/>
    <rect x="28" y="26" width="64" height="12" fill="#D4AF37" rx="4"/>
    <circle cx="84" cy="18" r="9" fill="#FFE87A" opacity="0.65"/>
    <circle cx="94" cy="28" r="5" fill="#FFE87A" opacity="0.45"/>
  </svg>
);

const FlagGeneric: React.FC = () => (
  <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="120" height="84" fill="#dde4f0"/>
    <text x="60" y="52" textAnchor="middle" fontSize="42" fill="#a0b0cc" fontFamily="serif">♪</text>
  </svg>
);

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getGenreFlag(genre: string): React.ReactNode {
  const g = norm(genre);

  if (/mpb|sertanejo|forro|axe|pagode|samba|bossa|caipira|baiao|arrocha|xote|piseiro|pisadinha|tecnobrega|modao|regional|tropica|rock.?nac|pop.?nac|hip.?hop.*(br|nac)|funk.*(br|carioca|nac)|pagod/.test(g))
    return <FlagBR />;

  if (/reggae/.test(g))
    return <FlagJM />;

  if (/tango/.test(g))
    return <FlagAR />;

  if (/rock|metal|punk|grunge|indie|alternativ|hard.?rock|heavy/.test(g))
    return <FlagUK />;

  if (/country|blues|jazz|americana|soul|r.?b|hip.?hop|rap/.test(g))
    return <FlagUS />;

  if (/latino|bolero|flamenco|latin/.test(g))
    return <FlagMX />;

  if (/romani/.test(g))
    return <FlagFR />;

  if (/gospel|religios|espiritua|crist|evan|louvor/.test(g))
    return <SymbolGospel />;

  if (/pop/.test(g))
    return <FlagUS />;

  return <FlagGeneric />;
}
import {
  getArtistsPaginated,
  searchSongsGlobal,
  getTopSongs,
  getTopLikes,
  getGeneros,
  getArtistsByGenre,
  type Artist,
  type GlobalSearchResult
} from '../../services/api';

const SMALL_PAGE = 200;   // tamanho normal (primeiros loads)
const BULK_PAGE  = 2000;  // tamanho bulk (após BULK_AFTER loads)
const BULK_AFTER = 5;     // a partir do N-ésimo load, usa bulk
const BUFFER_TTL = 60 * 60 * 1000; // 1h — validade do cache no localStorage

const bufferKey = (letra: string, q: string, fromOffset: number) =>
  `viola_buf_v1_${letra}_${q}_${fromOffset}`;

const saveBuffer = (letra: string, q: string, fromOffset: number, artists: Artist[], total: number) => {
  try {
    localStorage.setItem(bufferKey(letra, q, fromOffset), JSON.stringify({ artists, total, savedAt: Date.now() }));
  } catch { /* localStorage cheio — ignora */ }
};

const loadBuffer = (letra: string, q: string, fromOffset: number): { artists: Artist[]; total: number } | null => {
  try {
    const raw = localStorage.getItem(bufferKey(letra, q, fromOffset));
    if (!raw) return null;
    const { artists, total, savedAt } = JSON.parse(raw) as { artists: Artist[]; total: number; savedAt: number };
    if (Date.now() - savedAt > BUFFER_TTL) { localStorage.removeItem(bufferKey(letra, q, fromOffset)); return null; }
    localStorage.removeItem(bufferKey(letra, q, fromOffset)); // consomido
    return { artists, total };
  } catch { return null; }
};

type SearchMode = 'artistas' | 'musicas' | 'top_views' | 'top_likes' | 'generos';

const SEARCH_MODES: SearchMode[] = ['artistas', 'musicas', 'top_views', 'top_likes', 'generos'];

/** `?modo=` só vale se for um modo conhecido — qualquer outra coisa cai no padrão. */
function parseSearchMode(raw: string | null): SearchMode {
  return SEARCH_MODES.includes(raw as SearchMode) ? (raw as SearchMode) : 'artistas';
}

export const ArtistList: React.FC = () => {
  // ── Artistas (server-side infinite scroll) ───────────────────
  const [pagedArtists, setPagedArtists] = useState<Artist[]>([]);
  const [totalArtists, setTotalArtists] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [loadTrigger, setLoadTrigger] = useState(0);
  const pageLoadingRef = useRef(false);
  const pageOffsetRef = useRef(0);
  const totalArtistsRef = useRef(0);
  const consecutiveLoadsRef = useRef(0);
  const artistBufferRef = useRef<Artist[]>([]);
  useLayoutEffect(() => { pageOffsetRef.current = pageOffset; }, [pageOffset]);
  useLayoutEffect(() => { totalArtistsRef.current = totalArtists; }, [totalArtists]);

  // A busca vive na URL (?busca=&modo=): é o que deixa a área de trabalho mandar o usuário
  // pra cá já com a consulta feita, e de quebra torna um resultado compartilhável por link.
  // Só o valor INICIAL vem dos params — depois o estado local manda e a URL o acompanha,
  // senão os dois se realimentariam.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('busca') ?? '';
  const initialMode = parseSearchMode(searchParams.get('modo'));

  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);

  const [songResults, setSongResults] = useState<GlobalSearchResult[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [hasSearchedSongs, setHasSearchedSongs] = useState(false);

  // Estados para Gêneros
  const [generos, setGeneros] = useState<string[]>([]);
  const [loadingGeneros, setLoadingGeneros] = useState(false);
  const [selectedGenero, setSelectedGenero] = useState<string | null>(null);
  const [generoArtists, setGeneroArtists] = useState<Artist[]>([]);
  const [loadingGeneroArtists, setLoadingGeneroArtists] = useState(false);

  // visibleCount só usado pelos modos musicas/top/generos (client-side slice)
  // Os dois rankings são um modo só na interface ("Populares"), dois no estado.
  const isPopulares = searchMode === 'top_views' || searchMode === 'top_likes';

  const [visibleCount, setVisibleCount] = useState(32);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const navigate = useNavigate();

  // Debounce da busca (evita requests a cada tecla). Roda em todos os modos, não só em
  // 'artistas': quem consome `debouncedSearch` já se protege sozinho, e a sincronia da URL
  // abaixo pendura nele pra não escrever no histórico a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Estado -> URL. `replace` porque cada tecla não merece uma entrada no histórico: o botão
  // voltar do navegador deve sair da busca, não desfazê-la letra por letra.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('busca', debouncedSearch);
    if (searchMode !== 'artistas') next.set('modo', searchMode);
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchMode, setSearchParams]);

  // Carrega primeira página quando filtros mudam.
  // useLayoutEffect (e não useEffect) garante que setIsLoadingPage(true) commita
  // ANTES do paint — senão o React pinta um frame com a lista vazia e sem loading,
  // que aparece como "Nenhum artista encontrado" antes da resposta chegar.
  useLayoutEffect(() => {
    if (searchMode !== 'artistas') return;
    pageOffsetRef.current = 0;
    totalArtistsRef.current = 0;
    consecutiveLoadsRef.current = 0;
    artistBufferRef.current = [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPagedArtists([]);
    setTotalArtists(0);
    setPageOffset(0);
    pageLoadingRef.current = true;
    setIsLoadingPage(true);
    getArtistsPaginated(0, SMALL_PAGE, selectedLetter ?? '', debouncedSearch)
      .then(page => {
        pageOffsetRef.current = page.artists.length;
        totalArtistsRef.current = page.total;
        setPagedArtists(page.artists);
        setTotalArtists(page.total);
        setPageOffset(page.artists.length);
      })
      .catch(console.error)
      .finally(() => { pageLoadingRef.current = false; setIsLoadingPage(false); });
  }, [searchMode, selectedLetter, debouncedSearch]);

  const loadNextArtistPage = () => {
    if (pageLoadingRef.current || pageOffsetRef.current >= totalArtistsRef.current) return;

    const done = () => {
      pageLoadingRef.current = false;
      setIsLoadingPage(false);
      setLoadTrigger(t => t + 1);
    };

    // 1. Serve do buffer em memória
    if (artistBufferRef.current.length > 0) {
      const batch = artistBufferRef.current.splice(0, SMALL_PAGE);
      pageOffsetRef.current += batch.length;
      setPagedArtists(prev => [...prev, ...batch]);
      setPageOffset(pageOffsetRef.current);
      setLoadTrigger(t => t + 1);
      return;
    }

    // 2. Tenta restaurar buffer do localStorage
    const letra = selectedLetter ?? '';
    const q = debouncedSearch;
    const cached = loadBuffer(letra, q, pageOffsetRef.current);
    if (cached) {
      artistBufferRef.current = cached.artists;
      totalArtistsRef.current = cached.total;
      setTotalArtists(cached.total);
      const batch = artistBufferRef.current.splice(0, SMALL_PAGE);
      pageOffsetRef.current += batch.length;
      setPagedArtists(prev => [...prev, ...batch]);
      setPageOffset(pageOffsetRef.current);
      setLoadTrigger(t => t + 1);
      return;
    }

    // 3. Fetch da API — tamanho adaptativo
    consecutiveLoadsRef.current += 1;
    const fetchSize = consecutiveLoadsRef.current >= BULK_AFTER ? BULK_PAGE : SMALL_PAGE;
    const currentOffset = pageOffsetRef.current;

    pageLoadingRef.current = true;
    setIsLoadingPage(true);

    getArtistsPaginated(currentOffset, fetchSize, letra, q)
      .then(page => {
        const toShow = page.artists.slice(0, SMALL_PAGE);
        const excess = page.artists.slice(SMALL_PAGE);

        if (excess.length > 0) {
          artistBufferRef.current = excess;
          saveBuffer(letra, q, currentOffset + toShow.length, excess, page.total);
        }

        pageOffsetRef.current = currentOffset + toShow.length;
        totalArtistsRef.current = page.total;
        setPagedArtists(prev => [...prev, ...toShow]);
        setTotalArtists(page.total);
        setPageOffset(pageOffsetRef.current);
        done();
      })
      .catch(err => {
        console.error(err);
        const delay = err?.response?.status === 429 ? 2000 : 0;
        setTimeout(done, delay);
      });
  };

  // Load Top Views ou Top Likes
  useEffect(() => {
    if (searchMode === 'top_views') {
      /* eslint-disable react-hooks/set-state-in-effect */
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
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [searchMode]);

  // Load Artists for a specific Genre
  useEffect(() => {
    if (searchMode === 'generos' && selectedGenero) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      /* eslint-disable react-hooks/set-state-in-effect */
      setSongResults([]);
      setHasSearchedSongs(false);
      setLoadingSongs(false);
      /* eslint-enable react-hooks/set-state-in-effect */
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

  // Reset client-side visibleCount para modos que ainda usam slice local
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(32);
  }, [searchMode, selectedGenero]);


  return (
    <div className="flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      {/* Window Header — só no desktop. No celular a app bar logo acima já diz "Explore
          Cifras": repetir o rótulo custa 44px de altura pra não informar nada. */}
      <div className="hidden md:flex winxp-gradient-blue text-white px-2 py-1 items-center font-bold text-sm mb-2 rounded-t select-none">
        <Music size={16} className="mr-2" />
        Explorador de Cifras
      </div>

      {/* p-2 no celular: largura de leitura é o recurso escasso ali, e 16px de cada lado
          saem caros num aparelho de 360px. */}
      <div className="flex-1 bevel-in bg-white p-2 md:p-4 overflow-y-auto flex flex-col retro-scrollbar">
        {/* Filtros e Tabs Rápidas */}
        {/* Artistas <-> Músicas preservam a consulta digitada: digitar um nome e querer vê-lo
            como música é o gesto natural, e limpar o campo ali obrigava a redigitar.

            No celular os cinco modos quebravam em três linhas (86px) antes de qualquer
            conteúdo. Viram uma faixa que rola na horizontal — mesma solução da barra de abas,
            com `touch-pan-x` pra travar o gesto no eixo X. Do `md` pra cima volta a quebrar,
            que lá sobra largura e ver tudo de uma vez é melhor. */}
        <div className="flex flex-nowrap md:flex-wrap gap-2 mb-4 p-2 bg-[var(--color-winxp-panel)] bevel-out overflow-x-auto md:overflow-x-visible touch-pan-x overscroll-x-contain no-scrollbar [&>button]:shrink-0">
          <button
            onClick={() => { setSearchMode('artistas'); setSelectedGenero(null); }}
            className={`px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'artistas' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            Artistas
          </button>
          <button
            onClick={() => { setSearchMode('musicas'); setSelectedGenero(null); }}
            className={`px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'musicas' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            Músicas (Busca)
          </button>
          {/* "+ Views" e "+ Likes" eram dois modos irmãos disputando espaço com os outros
              três. Viram um só: Populares abre o ranking (visualizações por padrão) e a
              escolha entre os dois desce pra uma segunda fileira, que só existe quando é
              relevante. O estado continua sendo top_views/top_likes — nada muda na URL nem
              nos deep links. */}
          <button
            onClick={() => { setSearchMode('top_views'); setSelectedGenero(null); }}
            aria-expanded={isPopulares}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${isPopulares ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            <TrendingUp size={16} className={isPopulares ? 'text-orange-300' : 'text-orange-500'} /> Populares
          </button>
          <button
            onClick={() => { setSearchMode('generos'); setSelectedGenero(null); }}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'generos' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
          >
            <Guitar size={16} /> Gêneros
          </button>
        </div>

        {/* Segunda fileira de Populares: qual ranking. Só existe dentro do modo, então não
            cobra espaço de quem está navegando artistas. */}
        {isPopulares && (
          <div className="flex flex-wrap gap-2 mb-4 px-1">
            <button
              onClick={() => setSearchMode('top_views')}
              aria-pressed={searchMode === 'top_views'}
              className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'top_views' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
            >
              <Flame size={16} className={searchMode === 'top_views' ? 'text-orange-300' : 'text-orange-500'} /> + Views
            </button>
            <button
              onClick={() => setSearchMode('top_likes')}
              aria-pressed={searchMode === 'top_likes'}
              className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${searchMode === 'top_likes' ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
            >
              <Heart size={16} className={searchMode === 'top_likes' ? 'text-red-300' : 'text-red-500'} /> + Likes
            </button>
          </div>
        )}

        {/* Search Input (Apenas visivel em Artistas ou Musicas) */}
        {(searchMode === 'artistas' || searchMode === 'musicas') && (
          <div className="flex items-center w-full mb-4">
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
          /* Mesma ideia dos modos: 28 letras quebravam em três ou quatro linhas no celular.
             Uma faixa que rola alcança qualquer letra com um arraste do polegar, e devolve
             ~90px de altura antes do primeiro artista. */
          <div className="flex flex-nowrap md:flex-wrap gap-1 mb-4 md:justify-center overflow-x-auto md:overflow-x-visible touch-pan-x overscroll-x-contain no-scrollbar [&>button]:shrink-0">
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
        <div className="flex-1 pb-10">
          {searchMode === 'artistas' && (
            (isLoadingPage && pagedArtists.length === 0) ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-600">
                Carregando artistas...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pagedArtists.map(artist => (
                    <div
                      key={artist.id}
                      onClick={() => navigate(`/cifras/${artist.slug}`)}
                      className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
                    >
                      <div className="w-8 h-8 mr-3 bg-white bevel-in flex items-center justify-center text-lg text-gray-600 group-hover:text-[#316ac5]">
                        <Mic2 size={18} />
                      </div>
                      <div className="flex flex-col flex-1 truncate">
                        <span className="font-bold text-sm truncate">{artist.name}</span>
                        {artist.genre && <span className="text-[10px] text-gray-500 uppercase">{artist.genre}</span>}
                      </div>
                    </div>
                  ))}
                  {pagedArtists.length === 0 && !isLoadingPage && search === debouncedSearch && (
                    <div className="col-span-full text-center text-sm text-gray-500 py-8">
                      Nenhum artista encontrado com "{debouncedSearch}"
                    </div>
                  )}
                </div>

                <InfiniteLoader
                  hasMore={pageOffset < totalArtists}
                  onLoadMore={loadNextArtistPage}
                  checkTrigger={loadTrigger}
                  label="Carregando mais artistas..."
                />
              </div>
            )
          )}

          {searchMode === 'musicas' && (
            <div className="flex flex-col h-full">
              {loadingSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-600">
                  Buscando músicas...
                </div>
              ) : !hasSearchedSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-500">
                  Digite pelo menos 2 caracteres para buscar músicas em todo o banco.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {songResults.slice(0, visibleCount).map(song => (
                    <div
                      key={song.id}
                      onClick={() => navigate(`/cifras/${song.artist_slug}/${song.slug}`)}
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
                  ))}
                  {songResults.length === 0 && search.length >= 2 && (
                    <div className="text-center text-sm text-gray-500 py-8">
                      Nenhuma música encontrada contendo "{search}"
                    </div>
                  )}

                  <InfiniteLoader
                    hasMore={visibleCount < songResults.length}
                    onLoadMore={() => setVisibleCount(v => v + 32)}
                    label="Carregando mais músicas..."
                  />
                </div>
              )}
            </div>
          )}

          {(searchMode === 'top_views' || searchMode === 'top_likes') && (
            <div className="flex flex-col h-full">
              {loadingSongs ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-600">
                  Carregando ranking...
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <h3 className="flex items-center gap-2 font-bold text-[#316ac5] mb-2 border-b border-gray-300 pb-1">
                    {searchMode === 'top_views' ? (
                      <><Flame size={18} className="text-orange-500" /> Top 50 Mais Visualizadas</>
                    ) : (
                      <><Heart size={18} className="text-red-500" /> Top 50 Mais Curtidas</>
                    )}
                  </h3>
                  {songResults.slice(0, visibleCount).map((song, index) => (
                    <div
                      key={song.id}
                      onClick={() => navigate(`/cifras/${song.artist_slug}/${song.slug}`)}
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
                      </div>
                    </div>
                  ))}
                  {songResults.length === 0 && (
                    <div className="text-center text-sm text-gray-500 py-8">
                      Nenhuma música encontrada no ranking.
                    </div>
                  )}
                  <InfiniteLoader
                    hasMore={visibleCount < songResults.length}
                    onLoadMore={() => setVisibleCount(v => v + 32)}
                  />
                </div>
              )}
            </div>
          )}

          {searchMode === 'generos' && (
            <div className="flex flex-col h-full">
              {!selectedGenero ? (
                loadingGeneros ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-600">
                    Carregando gêneros...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {generos.map(g => (
                      <button
                        key={g}
                        onClick={() => setSelectedGenero(g)}
                        className="group relative overflow-hidden bevel-out bg-[var(--color-winxp-panel)] px-5 py-4 font-bold text-sm hover:bg-[#e8e6dc] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white shadow-sm min-w-[130px] cursor-pointer"
                      >
                        {/* Flag background */}
                        <span className="absolute inset-0 opacity-[0.22] group-hover:opacity-[0.35] transition-opacity duration-150 pointer-events-none select-none">
                          {getGenreFlag(g)}
                        </span>
                        {/* Content */}
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <Guitar size={15} className="text-gray-700 shrink-0" />
                          <span>{g}</span>
                        </span>
                      </button>
                    ))}
                    {generos.length === 0 && (
                      <div className="w-full text-center text-sm text-gray-500 py-8">
                        Nenhum gênero catalogado no momento.
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 border-b border-gray-300 pb-2 mb-2">
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
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {generoArtists.slice(0, visibleCount).map(artist => (
                          <div
                            key={artist.id}
                            onClick={() => navigate(`/cifras/${artist.slug}`)}
                            className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none"
                            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
                          >
                            <div className="w-8 h-8 mr-3 bg-white bevel-in flex items-center justify-center text-lg text-gray-600 group-hover:text-[#316ac5]">
                              <Mic2 size={18} />
                            </div>
                            <span className="font-bold text-sm truncate">{artist.name}</span>
                          </div>
                        ))}
                      </div>

                      <InfiniteLoader
                        hasMore={visibleCount < generoArtists.length}
                        onLoadMore={() => setVisibleCount(v => v + 32)}
                        label="Carregando mais artistas..."
                      />
                    </>
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
