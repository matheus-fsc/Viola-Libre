import React from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import type { SongWithStats } from '../../services/mockArtistStats';

interface Props {
  songs: SongWithStats[];
  /**
   * Rota de cada música. Substituiu o antigo `onSelect`: com a URL em mãos, o cartão
   * vira <Link> de verdade em vez de <div onClick>.
   *
   * Não é preciosismo — sem href não há navegação por teclado, o leitor de tela não
   * anuncia "link", abrir em nova aba não funciona e nenhum rastreador de busca segue
   * o caminho até a cifra.
   */
  hrefFor: (song: SongWithStats) => string;
}

export const TopSongsHighlight: React.FC<Props> = ({ songs, hrefFor }) => {
  if (songs.length === 0) return null;

  return (
    <div className="mb-4">
      <h3
        className="flex items-center gap-2 font-bold text-[#316ac5] mb-2 border-b border-gray-300 pb-1 cursor-help"
        title="Estatísticas ilustrativas — ranking oficial por artista ainda não existe no backend"
      >
        <Flame size={18} className="text-orange-500" /> Top 20 mais populares
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {songs.map((song, index) => (
          <Link
            key={song.id}
            to={hrefFor(song)}
            className="bevel-out bg-[var(--color-winxp-panel)] p-2 flex items-center gap-2 cursor-pointer hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white select-none text-inherit no-underline"
          >
            <span className="w-6 text-center font-bold text-gray-500" aria-hidden="true">{index + 1}º</span>
            <span className="flex-1 truncate text-sm font-bold">{song.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};
