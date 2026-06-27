import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VirtuosoGrid } from 'react-virtuoso';
import { FolderOpen, FileText } from 'lucide-react';
import { getSongs, getCifra, type Song } from '../../services/api';

export const SongList: React.FC = () => {
  const [scrollerRef, setScrollerRef] = useState<HTMLElement | null>(null);
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (artistSlug) {
      getSongs(artistSlug).then((data) => {
        setSongs(Array.isArray(data) ? data : []);
        setLoading(false);
      }).catch(() => {
        setSongs([]);
        setLoading(false);
      });
    }
  }, [artistSlug]);

  // Virtuoso handles visibility natively, so we removed the global visibleCount queue
  const artistName = artistSlug ? artistSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Artista';

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center font-bold text-sm mb-2 rounded-t select-none justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} />
          Músicas de {artistName}
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
        >
          Voltar
        </button>
      </div>

      <div className="flex-1 bevel-in bg-white p-4 flex flex-col overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-600">
            Carregando músicas...
          </div>
        ) : (
          <div className="flex-1 w-full min-h-0 flex flex-col relative">
            {songs.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-8">
                Nenhuma cifra encontrada para este artista.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto retro-scrollbar" ref={setScrollerRef}>
                {scrollerRef && (
                  <VirtuosoGrid
                    customScrollParent={scrollerRef}
                    style={{ width: '100%' }}
                    data={songs}
                    listClassName="flex flex-col gap-2 pb-8"
                  itemContent={(index, song) => (
                  <div 
                    key={song.id}
                    onClick={() => navigate(`/${artistSlug}/${song.slug}`)}
                    className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none"
                  >
                    <div className="mr-3 text-gray-500 group-hover:text-white">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{song.title}</div>
                    </div>
                    {song.version_name && (
                      <span className="text-xs bg-gray-200 text-gray-700 px-1 border border-gray-400 group-hover:bg-[#1a3b6e] group-hover:text-white group-hover:border-transparent">
                        {song.version_name}
                      </span>
                    )}
                  </div>
                )}
                rangeChanged={({ startIndex, endIndex }) => {
                  if (!artistSlug) return;
                  const visible = songs.slice(startIndex, endIndex + 1);
                  visible.forEach((song, i) => {
                    setTimeout(() => {
                      getCifra(artistSlug, song.slug).catch(() => {});
                    }, i * 30);
                  });
                }}
              />
              )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
