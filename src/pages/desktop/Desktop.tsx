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
 * atalhos; no celular, o menu de apps de um telefone antigo, porque "área de trabalho" não
 * é uma metáfora que exista num aparelho de bolso.
 *
 * O fundo teal com scanlines não é daqui — vem do `body` (src/index.css), então este
 * componente desenha só o que fica *sobre* a mesa.
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
 * Busca da home. Manda pro explorador já com a consulta feita, via `?busca=`.
 *
 * Vai pro modo 'artistas' (o padrão do explorador) e não pro de músicas: procurar pelo nome
 * do artista é como se chega a uma cifra na maioria das vezes, e lá dentro o botão "Músicas"
 * reaproveita o mesmo texto se a pessoa quis o título da canção.
 */
const DesktopSearch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/cifras?busca=${encodeURIComponent(term)}` : '/cifras');
  };

  return (
    <form onSubmit={submit} className={`flex items-stretch gap-1 ${className}`}>
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar artista..."
        aria-label="Buscar artista"
        className="bevel-in px-3 py-2 text-sm w-full outline-none min-w-0"
      />
      <button
        type="submit"
        className="bevel-out bg-[var(--color-winxp-panel)] px-3 shrink-0 flex items-center justify-center hover:bg-white active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white cursor-pointer"
        title="Buscar"
      >
        <Search size={16} className="text-[#0058e6]" />
      </button>
    </form>
  );
};

/** Área de trabalho: ícones soltos sobre o teal, alinhados à esquerda como no XP. */
const DesktopIcons: React.FC<{ shortcuts: Shortcut[] }> = ({ shortcuts }) => (
  // Duas colunas fixas, não auto-fill: espalhados pela largura da tela os ícones leem como
  // barra de ferramentas. Agrupados num bloco no canto superior esquerdo, leem como desktop.
  <ul className="grid grid-cols-[repeat(2,88px)] gap-x-2 gap-y-4 content-start">
    {shortcuts.map(s => (
      <li key={s.to}>
        <Link
          to={s.to}
          className="group flex flex-col items-center gap-1 p-1.5 w-[88px] border border-transparent hover:border-dotted hover:border-white/70 hover:bg-[#0058e6]/30 focus:outline-none focus-visible:border-dotted focus-visible:border-white"
        >
          <span className="relative w-10 h-10 flex items-center justify-center text-white [&>svg]:w-9 [&>svg]:h-9 drop-shadow-[1px_1px_2px_rgba(0,0,0,0.8)]">
            {s.icon}
            {s.badge !== undefined && s.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff7f27] border border-white text-[10px] font-bold leading-4 text-center text-white">
                {s.badge}
              </span>
            )}
          </span>
          {/* Sombra dura atrás do texto: label branca sobre teal claro fica ilegível sem ela. */}
          <span className="text-[11px] leading-tight text-center text-white font-sans [text-shadow:1px_1px_2px_rgba(0,0,0,0.9)]">
            {s.label}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

/** Menu de apps de celular antigo: barra de status + grid 3× de tiles. */
const PhoneMenu: React.FC<{ shortcuts: Shortcut[] }> = ({ shortcuts }) => {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const hhmm = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bevel-out bg-[#c8d8c8] p-1 shadow-2xl">
      {/* Barra de status — o aparelho */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0058e6] text-white font-mono text-[10px] font-bold tracking-wide">
        <span className="flex items-center gap-1"><Signal size={11} /> Viola Libre</span>
        <span className="flex items-center gap-1.5">{hhmm} <BatteryFull size={13} /></span>
      </div>

      <p className="px-2 py-1.5 font-mono text-[11px] font-bold text-[#1a3b1a] border-b border-[#8a9a8a]">
        Menu
      </p>

      <ul className="grid grid-cols-3 gap-1.5 p-1.5">
        {shortcuts.map(s => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-lg bevel-out bg-[#ece9d8] p-1 active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white"
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
      <div className="w-full flex flex-col gap-3 p-3">
        <PhoneMenu shortcuts={shortcuts} />
        <DesktopSearch />
        <EmAltaPanel songs={songs} className="max-h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="w-full flex gap-6 p-6 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <DesktopIcons shortcuts={shortcuts} />
        <DesktopSearch className="max-w-[320px]" />
      </div>
      <EmAltaPanel songs={songs} className="w-[320px] shrink-0 max-h-[70vh]" />
    </div>
  );
};
