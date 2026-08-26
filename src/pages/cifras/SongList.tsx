import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, FileText, Layers, Flame, Heart } from 'lucide-react';
import { getSongs, getCifra, type Song } from '../../services/api';
import { prettifySlug } from '../../services/cifraFavorites';
import { useArtistSongFilter, type ArtistSongTab } from '../../hooks/useArtistSongFilter';
import { useListScrollRestoration, useRestoredItemCount } from '../../hooks/useListScrollRestoration';
import { useSeo } from '../../hooks/useSeo';
import { useJsonLd, breadcrumbJsonLd } from '../../hooks/useJsonLd';
import { TopSongsHighlight } from './TopSongsHighlight';

const isPrincipal = (v?: string) => (v || '').toLowerCase().includes('principal');

/** Os dois botões da barra de título, iguais por serem irmãos na mesma barra. */
const botaoBarra =
  'bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0 text-xs items-center gap-1 ' +
  'active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

const TABS: { id: ArtistSongTab; label: string }[] = [
  { id: 'alfabetica', label: 'Ordem alfabética' },
  { id: 'mais-visualizadas', label: 'Mais visualizadas' },
  { id: 'mais-curtidas', label: 'Mais curtidas' },
];

export const SongList: React.FC = () => {
  const { artistSlug } = useParams<{ artistSlug: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Quem volta de uma cifra volta para a lista como a deixou: mesma busca (que vem da URL),
  // mesmas páginas abertas e mesma posição de rolagem.
  const restoredCount = useRestoredItemCount();

  const {
    query, setQuery,
    activeTab, setActiveTab,
    visibleSongs, hasMore, loadMore,
    top20,
  } = useArtistSongFilter(artistSlug ?? '', dedupedSongs, restoredCount ?? undefined);

  useListScrollRestoration(visibleSongs.length, !loading && visibleSongs.length > 0);

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

  const artistName = artistSlug ? prettifySlug(artistSlug) : 'Artista';

  // Zero significa primeira entrada da aba — link direto, sem passo anterior para desfazer.
  const temHistorico = (window.history.state?.idx ?? 0) > 0;

  // "Cifras de X" e não "Músicas de X": é assim que a busca é digitada. O contador de
  // músicas entra na descrição quando já chegou, porque número concreto rende mais
  // clique do que promessa genérica.
  useSeo({
    title: `Cifras de ${artistName}`,
    description: dedupedSongs.length
      ? `${dedupedSongs.length} cifras de ${artistName} para viola caipira, violão e cavaquinho, com os acordes no braço do instrumento e troca de tom.`
      : `Cifras de ${artistName} para viola caipira, violão e cavaquinho, com os acordes no braço do instrumento e troca de tom.`,
    path: `/cifras/${artistSlug ?? ''}`,
    // Mesma regra do explorador: com a busca na URL, cada termo digitado seria uma página
    // nova aos olhos do Google. A canônica já aponta para a lista limpa; o noindex cobre
    // quem chegar por um link filtrado compartilhado.
    noindex: Boolean(query) || activeTab !== 'alfabetica',
  });
  useJsonLd(
    useMemo(
      () =>
        breadcrumbJsonLd([
          { name: 'Cifras', path: '/cifras' },
          { name: artistName, path: `/cifras/${artistSlug ?? ''}` },
        ]),
      [artistName, artistSlug],
    ),
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-winxp-bg)] p-2">
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center font-bold text-sm mb-2 rounded-t select-none justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} aria-hidden="true" />
          {/* A barra de título É o cabeçalho da página — marcá-la como <h1> não muda
              nada visualmente e dá a quem navega por leitor de tela o mesmo ponto de
              referência que a barra dá a quem enxerga. */}
          <h1 className="font-bold text-sm">Músicas de {artistName}</h1>
        </div>
        {/* Mesma separação da página da cifra: um destino fixo e um passo atrás.
            O "Voltar" daqui fazia `navigate('/cifras')` na unha, e com os filtros do
            explorador vivendo na URL isso deixou de ser só impreciso e passou a
            destruir estado: quem vinha de `/cifras?letra=E` voltava para o acervo
            inteiro, no topo. `navigate(-1)` devolve a letra, a busca e a posição. */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Link to="/cifras" title="Explorar todo o acervo" className={`flex ${botaoBarra}`}>
            <FolderOpen size={12} aria-hidden="true" />
            Explorar
          </Link>
          {temHistorico && (
            <button
              onClick={() => navigate(-1)}
              title="Voltar para a página anterior"
              className={`hidden sm:flex ${botaoBarra}`}
            >
              <ArrowLeft size={12} aria-hidden="true" />
              Voltar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 bevel-in bg-white p-4 overflow-y-auto flex flex-col retro-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-600">
            Carregando músicas...
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TopSongsHighlight
              songs={top20}
              hrefFor={(song) => `/cifras/${artistSlug}/${song.slug}`}
            />

            {dedupedSongs.length > 0 && (
              <>
                <div className="flex items-center w-full mb-2">
                  <input
                    type="text"
                    aria-label="Buscar música deste artista"
                    placeholder="Buscar música deste artista..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bevel-in px-3 py-2 text-sm w-full outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-[var(--color-winxp-panel)] bevel-out">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      title={tab.id !== 'alfabetica' ? 'Estatísticas ilustrativas — ranking oficial por artista ainda não existe no backend' : undefined}
                      className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border transition-colors ${activeTab === tab.id ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#e0dfd6] text-black border-gray-400 hover:bg-gray-300'}`}
                    >
                      {tab.id === 'mais-visualizadas' && <Flame size={16} className={activeTab === tab.id ? 'text-orange-300' : 'text-orange-500'} />}
                      {tab.id === 'mais-curtidas' && <Heart size={16} className={activeTab === tab.id ? 'text-red-300' : 'text-red-500'} />}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {visibleSongs.map((song, i) => {
              const nVersions = versionCount.get(song.title.trim().toLowerCase()) || 1;
              return (
                <Link
                  key={song.id}
                  // Âncora da restauração de leitura: é por este índice que a volta
                  // reencontra a linha exata, e não pelo pixel (veja useListScrollRestoration).
                  data-item-lista={i}
                  to={`/cifras/${artistSlug}/${song.slug}`}
                  className="flex items-center p-2 hover:bg-[#316ac5] hover:text-white cursor-pointer select-none group border border-transparent hover:border-dotted hover:border-white transition-none text-inherit no-underline"
                >
                  <div className="mr-3 text-gray-500 group-hover:text-white">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{song.title}</div>
                  </div>
                  {nVersions > 1 && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 border border-amber-400 rounded-sm flex items-center gap-1 font-bold group-hover:bg-[#1a3b6e] group-hover:text-white group-hover:border-transparent" title={`${nVersions} variações disponíveis`}>
                      <Layers size={12} /> {nVersions} variações
                    </span>
                  )}
                </Link>
              );
            })}

            {hasMore && (
              <div className="flex justify-center mt-4 mb-4">
                <button
                  onClick={loadMore}
                  className="bevel-out bg-[var(--color-winxp-panel)] px-6 py-2 font-bold text-sm hover:bg-[#e0dfd6] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white text-black"
                >
                  Exibir Mais
                </button>
              </div>
            )}

            {songs.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-8">
                Nenhuma cifra encontrada para este artista.
              </div>
            )}

            {songs.length > 0 && dedupedSongs.length > 0 && visibleSongs.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-8">
                Nenhuma música encontrada com "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
