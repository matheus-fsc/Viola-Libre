import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music, Guitar, BookOpen, Ear, Flame, Signal, BatteryFull, Search } from 'lucide-react';
import { StarIcon } from '../../components/Icons';
import { IconNotepad } from '../../components/FretboardDiagram';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCifraFavorites } from '../../hooks/useCifraFavorites';
import { getTopSongs, type GlobalSearchResult } from '../../services/api';

/**
 * A tela inicial.
 *
 * Antes o site abria direto no explorador de cifras — um formulário de consulta sobre uma
 * lista alfabética de milhares de artistas, que é a primeira tela de menor sinal possível.
 * Aqui a home assume a identidade do projeto: no desktop, a área de trabalho do XP com
 * atalhos e janelas; no celular, a tela inicial de um telefone antigo, porque "área de
 * trabalho" não é uma metáfora que exista num aparelho de bolso.
 */

interface Shortcut {
  to: string;
  label: string;
  /** Versão curta pro tile do celular, onde a largura é apertada. */
  shortLabel: string;
  icon: React.ReactNode;
  badge?: number;
}

function useShortcuts(): Shortcut[] {
  const favorites = useCifraFavorites();
  return [
    { to: '/cifras', label: 'Explorar Cifras', shortLabel: 'Cifras', icon: <Music /> },
    { to: '/favoritos', label: 'Meus Favoritos', shortLabel: 'Favoritos', icon: <StarIcon />, badge: favorites.entries.length },
    { to: '/minhascifras', label: 'Minhas Cifras', shortLabel: 'Minhas', icon: <IconNotepad className="w-full h-full" /> },
    { to: '/chords', label: 'Dicionário de Acordes', shortLabel: 'Acordes', icon: <Guitar /> },
    { to: '/treinos', label: 'Treinos e Teoria', shortLabel: 'Treinos', icon: <BookOpen /> },
    { to: '/ouvido', label: 'Tirando de Ouvido', shortLabel: 'Ouvido', icon: <Ear /> },
  ];
}

/** Top 10 mais vistas. Enfeite da home: se a API cair, o painel simplesmente não aparece. */
function useTopSongs(): GlobalSearchResult[] {
  const [songs, setSongs] = useState<GlobalSearchResult[]>([]);
  useEffect(() => {
    let cancelled = false;
    getTopSongs()
      .then(data => { if (!cancelled) setSongs(Array.isArray(data) ? data.slice(0, 10) : []); })
      .catch(() => { /* home não trava por causa de enfeite */ });
    return () => { cancelled = true; };
  }, []);
  return songs;
}

/**
 * Papel de parede: a colina do XP redesenhada em SVG.
 *
 * A "Bliss" original é uma fotografia da Microsoft e não pode ser embutida num projeto
 * publicado sob AGPL. Redesenhá-la resolve o direito autoral e é melhor tecnicamente: não
 * há download, e vetor não pixeliza em tela nenhuma. O ArtistList já desenha as bandeiras
 * de gênero assim — é o idioma da casa.
 *
 * `fixed` de propósito: papel de parede cobre a viewport inteira, inclusive atrás da barra
 * de tarefas, sem depender da altura do conteúdo.
 */
const BlissBackdrop: React.FC = () => (
  <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
    <svg width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="vl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c5fbe" />
          <stop offset="45%" stopColor="#4b95dd" />
          <stop offset="80%" stopColor="#a8d4f2" />
          <stop offset="100%" stopColor="#d8ecfa" />
        </linearGradient>
        <linearGradient id="vl-hill" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#9ccf4a" />
          <stop offset="40%" stopColor="#6fae2c" />
          <stop offset="100%" stopColor="#3f7a17" />
        </linearGradient>
        <linearGradient id="vl-hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fc44a" />
          <stop offset="100%" stopColor="#5d9a28" />
        </linearGradient>
        {/* Nuvem de cúmulo é borda macia — mas blur demais vira névoa, não nuvem. */}
        <filter id="vl-cloud" x="-40%" y="-60%" width="180%" height="240%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <rect width="1200" height="800" fill="url(#vl-sky)" />

      {/* Deslocadas pro centro/direita: a coluna de ícones mora na esquerda e nuvem atrás
          de label branca custa legibilidade. */}
      <g fill="#ffffff" filter="url(#vl-cloud)">
        <g opacity="0.92">
          <ellipse cx="470" cy="140" rx="92" ry="26" />
          <ellipse cx="432" cy="122" rx="52" ry="24" />
          <ellipse cx="508" cy="120" rx="60" ry="21" />
        </g>
        <g opacity="0.8">
          <ellipse cx="905" cy="98" rx="112" ry="24" />
          <ellipse cx="952" cy="82" rx="64" ry="21" />
          <ellipse cx="856" cy="84" rx="52" ry="18" />
        </g>
        <g opacity="0.45">
          <ellipse cx="690" cy="268" rx="96" ry="15" />
          <ellipse cx="1120" cy="205" rx="84" ry="14" />
        </g>
      </g>

      {/* Colina de trás: dá profundidade e evita o horizonte reto de gráfico. */}
      <path d="M0 560 C 220 500, 430 512, 660 548 C 850 578, 1030 566, 1200 528 L1200 800 L0 800 Z"
            fill="url(#vl-hill-far)" opacity="0.85" />
      {/* Colina principal, com a curva em S que é a assinatura da imagem original. */}
      <path d="M0 660 C 260 556, 520 596, 760 640 C 950 675, 1080 668, 1200 632 L1200 800 L0 800 Z"
            fill="url(#vl-hill)" />
      {/* Realce de luz raspando o topo da colina. */}
      <path d="M0 660 C 260 556, 520 596, 760 640 C 950 675, 1080 668, 1200 632"
            fill="none" stroke="#c3e77a" strokeWidth="3" opacity="0.5" />
    </svg>
  </div>
);

/**
 * Busca da home, como uma janelinha do XP.
 *
 * O buscador do projeto NÃO é unificado — `getArtistsPaginated` e `searchSongsGlobal` são
 * consultas separadas. Então a escolha fica explícita pro usuário em vez de a home decidir
 * por ele e devolver zero resultado quando ele digitou a outra coisa.
 */
const SearchWindow: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [q, setQ] = useState('');
  const [modo, setModo] = useState<'artistas' | 'musicas'>('artistas');
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) { navigate('/cifras'); return; }
    const params = new URLSearchParams({ busca: term });
    if (modo !== 'artistas') params.set('modo', modo);
    navigate(`/cifras?${params}`);
  };

  const tab = (value: 'artistas' | 'musicas', label: string) => (
    <button
      type="button"
      onClick={() => setModo(value)}
      aria-pressed={modo === value}
      className={`flex-1 px-2 py-1 text-xs font-bold border cursor-pointer ${
        modo === value
          ? 'bg-[#316ac5] text-white border-[#316ac5]'
          : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className={`bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl ${className}`}>
      <h2 className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center gap-2 font-bold text-xs sm:text-sm tracking-wide font-mono border-b-2 border-[#002fa7] select-none">
        <Search size={14} className="shrink-0" />
        Buscar cifras
      </h2>
      <form onSubmit={submit} className="p-2 flex flex-col gap-2">
        <div className="flex gap-1">
          {tab('artistas', 'Artistas')}
          {tab('musicas', 'Músicas')}
        </div>
        <div className="flex items-stretch gap-1">
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={modo === 'artistas' ? 'Nome do artista...' : 'Nome da música...'}
            aria-label={modo === 'artistas' ? 'Buscar artista' : 'Buscar música'}
            className="bevel-in px-2 py-1.5 text-sm w-full outline-none min-w-0"
          />
          <button
            type="submit"
            className="bevel-out bg-[var(--color-winxp-panel)] px-3 shrink-0 flex items-center justify-center hover:bg-white active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white cursor-pointer"
            title="Buscar"
          >
            <Search size={16} className="text-[#0058e6]" />
          </button>
        </div>
      </form>
    </section>
  );
};

/**
 * Os itens são <Link> (viram <a href> de verdade), e não onClick+navigate como no resto do
 * app: numa SPA sem prerender, esta é a única página que oferece links internos estáveis
 * pro crawler encontrar as cifras.
 */
const EmAltaPanel: React.FC<{ songs: GlobalSearchResult[]; className?: string }> = ({ songs, className = '' }) => {
  if (songs.length === 0) return null;

  return (
    <section className={`bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl flex flex-col overflow-hidden ${className}`}>
      <h2 className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center gap-2 font-bold text-xs sm:text-sm tracking-wide font-mono border-b-2 border-[#002fa7] select-none">
        <Flame size={15} className="text-orange-300 shrink-0" />
        Em alta
      </h2>
      <ol className="bevel-in bg-white m-1.5 p-1 flex-1 overflow-y-auto retro-scrollbar">
        {songs.map((song, i) => (
          <li key={song.id}>
            <Link
              to={`/cifras/${song.artist_slug}/${song.slug}`}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#316ac5] hover:text-white group"
            >
              <span className="w-5 shrink-0 text-xs font-bold text-gray-400 group-hover:text-white">{i + 1}º</span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-bold truncate">{song.title}</span>
                <span className="text-xs text-gray-500 group-hover:text-gray-200 truncate">{song.artist_name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
};

/**
 * Ícones da área de trabalho: coluna única encostada no canto superior esquerdo, como no XP.
 *
 * Espalhados pela largura eles leem como barra de ferramentas; empilhados no canto, leem
 * como área de trabalho. É a diferença entre parecer um menu e parecer um sistema.
 */
const DesktopIcons: React.FC<{ shortcuts: Shortcut[] }> = ({ shortcuts }) => (
  <ul className="flex flex-col gap-1 w-[92px]">
    {shortcuts.map(s => (
      <li key={s.to}>
        <Link
          to={s.to}
          className="group flex flex-col items-center gap-1 px-1 py-1.5 border border-transparent hover:border-dotted hover:border-white/70 hover:bg-[#0058e6]/40 focus:outline-none focus-visible:border-dotted focus-visible:border-white"
        >
          <span className="relative w-10 h-10 flex items-center justify-center text-white [&>svg]:w-9 [&>svg]:h-9 drop-shadow-[1px_2px_2px_rgba(0,0,0,0.55)]">
            {s.icon}
            {s.badge !== undefined && s.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff7f27] border border-white text-[10px] font-bold leading-4 text-center text-white">
                {s.badge}
              </span>
            )}
          </span>
          {/* Sombra dura atrás do texto: label branca sobre céu claro fica ilegível sem ela. */}
          <span className="text-[11px] leading-tight text-center text-white font-sans [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.8)]">
            {s.label}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

/** Tela inicial do celular antigo: barra de status colada no topo e grid de apps. */
const PhoneHome: React.FC<{ shortcuts: Shortcut[] }> = ({ shortcuts }) => {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const hhmm = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col">
      {/* Barra de status encostada na borda: é o que faz a tela virar "aparelho". */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/35 text-white font-mono text-[11px] font-bold tracking-wide">
        <span className="flex items-center gap-1.5"><Signal size={12} /> Viola Libre</span>
        <span className="flex items-center gap-1.5">{hhmm} <BatteryFull size={15} /></span>
      </div>

      <ul className="grid grid-cols-3 gap-2.5 p-3">
        {shortcuts.map(s => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-xl bevel-out bg-[#ece9d8] p-1 shadow-lg active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white"
            >
              <span className="relative w-8 h-8 flex items-center justify-center text-[#0058e6] [&>svg]:w-7 [&>svg]:h-7">
                {s.icon}
                {s.badge !== undefined && s.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#ff7f27] border border-white text-[10px] font-bold leading-4 text-center text-white">
                    {s.badge}
                  </span>
                )}
              </span>
              <span className="font-mono text-[10px] font-bold leading-none text-center text-black">
                {s.shortLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const Desktop: React.FC = () => {
  const shortcuts = useShortcuts();
  const songs = useTopSongs();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="w-full">
        {/* Mesmo papel de parede do desktop: um aparelho com foto de natureza é plausível,
            e um gradiente chapado deixava as duas telas parecendo projetos diferentes. */}
        <BlissBackdrop />
        <div className="relative z-10 flex flex-col gap-3">
          <PhoneHome shortcuts={shortcuts} />
          <div className="px-3 pb-3 flex flex-col gap-3">
            <SearchWindow />
            <EmAltaPanel songs={songs} className="max-h-[55vh]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <BlissBackdrop />
      {/* Ícones colados no canto; janelas flutuando à direita, como uma sessão em uso. */}
      <div className="relative z-10 flex justify-between items-start gap-6 p-3">
        <DesktopIcons shortcuts={shortcuts} />
        <div className="flex flex-col gap-4 w-[320px] shrink-0 pt-4 pr-3">
          <SearchWindow />
          <EmAltaPanel songs={songs} className="max-h-[55vh]" />
        </div>
      </div>
    </div>
  );
};
