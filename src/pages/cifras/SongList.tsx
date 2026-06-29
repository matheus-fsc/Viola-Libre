import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderOpen, FileText, Layers } from 'lucide-react';
import { getSongs, getCifra, type Song } from '../../services/api';

const isPrincipal = (v?: string) => (v || '').toLowerCase().includes('principal');

export const SongList: React.FC = () => {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(32);
  const navigate = useNavigate();

  // Deduplica por título: músicas com mesmo nome em versões diferentes aparecem
  // uma única vez (preferindo a versão "Principal"). O contador guarda quantas
  // versões existem para exibir o selo "+N versões".
  const { dedupedSongs, versionCount } = useMemo(() => {
    const byTitle = new Map<string, Song>();
    const count = new Map<string, number>();
    for (const s of songs) {
      const key = s.title.trim().toLowerCase();
      count.set(key, (count.get(key) || 0) + 1);
      const existing = byTitle.get(key);
      if (!existing || (!isPrincipal(existing.version_name) && isPrincipal(s.version_name))) {
        byTitle.set(key, s);
      }
    }
    return { dedupedSongs: Array.from(byTitle.values()), versionCount: count };
  }, [songs]);

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

  // Prefetch silencioso: só as primeiras 6 músicas, sem re-disparar ao paginar
  const prefetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!artistSlug || songs.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    songs.slice(0, 6).forEach((song, i) => {
      const key = `${artistSlug}/${song.slug}`;
      if (prefetchedRef.current.has(key)) return;
      prefetchedRef.current.add(key);
      timers.push(setTimeout(() => {
        getCifra(artistSlug, song.slug).catch(() => {});
      }, i * 400));
    });
    return () => timers.forEach(clearTimeout);
  }, [songs, artistSlug]); // visibleCount removido intencionalmente

  const artistName = artistSlug ? artistSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Artista';

  return (
    <div className="flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center font-bold text-sm mb-2 rounded-t select-none justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} />
          Músicas de {artistName}
        </div>
        <button
          onClick={() => navigate('/cifras')}
          className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
        >
          Voltar
        </button>
      </div>

      <div className="flex-1 bevel-in bg-white p-4 overflow-y-auto flex flex-col retro-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-600">
            Carregando músicas...
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dedupedSongs.slice(0, visibleCount).map(song => {
              const nVersions = versionCount.get(song.title.trim().toLowerCase()) || 1;
              return (
                <div
                  key={song.id}
                  onClick={() => navigate(`/cifras/${artistSlug}/${song.slug}`)}
                  className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none"
                >
                  <div className="mr-3 text-gray-500 group-hover:text-white">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{song.title}</div>
                  </div>
                  {nVersions > 1 && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-1 border border-gray-400 flex items-center gap-1 group-hover:bg-[#1a3b6e] group-hover:text-white group-hover:border-transparent" title={`${nVersions} versões disponíveis`}>
                      <Layers size={11} /> {nVersions} versões
                    </span>
                  )}
                </div>
              );
            })}

            {visibleCount < dedupedSongs.length && (
              <div className="flex justify-center mt-4 mb-4">
                <button
                  onClick={() => setVisibleCount(prev => prev + 32)}
                  className="bevel-out bg-[var(--color-winxp-panel)] px-6 py-2 font-bold text-sm hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black"
                >
                  Exibir Mais ({dedupedSongs.length - visibleCount} restantes)
                </button>
              </div>
            )}

            {songs.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-8">
                Nenhuma cifra encontrada para este artista.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
