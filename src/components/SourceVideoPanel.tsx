import React, { useCallback, useEffect, useRef, useState } from 'react';
import { extractYouTubeId } from '../services/timingApi';
import { loadYouTubeApi, type YTPlayer } from '../services/youtubeApi';

// Estados do player do YouTube que interessam aqui (a API devolve números crus).
const YT_STATE_PLAYING = 1;

interface SourceVideoPanelProps {
  /** URL da source (link do YouTube semeado pela API ou vindo de um timing da comunidade). */
  videoUrl: string;
  /** Título da música — vai na barra do painel. */
  title: string;
  onClose(): void;
  /**
   * Duração real do vídeo, em segundos, assim que o player fica pronto.
   * É o que permite trocar o tempo deduzido (BPM × nº de acordes) por tempo medido.
   */
  onDurationDetected(seconds: number): void;
}

/**
 * Painel flutuante com a source em vídeo da música.
 *
 * Responsivo por CSS, sem medir a tela em JS:
 * - celular  → encaixado no topo, largura total, altura limitada a 32vh (o controle
 *   de auto-rolagem mora embaixo, à direita; o vídeo em cima não briga com ele);
 * - desktop  → cartão flutuante no canto inferior ESQUERDO, longe do transporte
 *   (inferior direito) e da barra de posição (borda direita).
 *
 * Recolher mantém o <iframe> montado (só zera a altura), então o áudio continua
 * tocando — quem só quer ouvir a referência não perde a reprodução ao encolher.
 */
export const SourceVideoPanel: React.FC<SourceVideoPanelProps> = ({
  videoUrl, title, onClose, onDurationDetected,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [wide, setWide] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const hostWrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  // O callback do pai não precisa ser estável: guardá-lo num ref evita que uma
  // nova referência a cada render destrua e recrie o player no meio da música.
  const onDurationRef = useRef(onDurationDetected);
  onDurationRef.current = onDurationDetected;

  const videoId = extractYouTubeId(videoUrl);

  useEffect(() => {
    const wrap = hostWrapRef.current;
    if (!videoId || !wrap) return;

    let cancelled = false;
    // O YT.Player SUBSTITUI pelo <iframe> o elemento que recebe. Entregamos um nó
    // criado à mão para que o React nunca tente remover um filho que o YouTube já
    // trocou por outro — o wrapper continua sendo o único nó que o React governa.
    const host = document.createElement('div');
    wrap.appendChild(host);

    loadYouTubeApi()
      .then(YT => {
        if (cancelled) return;
        playerRef.current = new YT.Player(host, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: () => {
              const dur = Math.round(playerRef.current?.getDuration() ?? 0);
              if (dur > 0) onDurationRef.current(dur);
            },
            onStateChange: (e) => setPlaying(e.data === YT_STATE_PLAYING),
          },
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* o player pode já ter sumido */ }
      playerRef.current = null;
      wrap.replaceChildren();
    };
  }, [videoId]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo(); else p.playVideo();
  }, [playing]);

  const btn = 'bevel-out bg-[var(--color-winxp-panel)] text-black px-1.5 py-0 text-[11px] leading-tight font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

  return (
    <div
      className={`fixed z-50 select-none bevel-out bg-[var(--color-winxp-panel)] border border-gray-500 shadow-xl
        inset-x-0 top-0
        sm:inset-x-auto sm:top-auto sm:bottom-4 sm:left-4 ${wide ? 'sm:w-[34rem]' : 'sm:w-[22rem]'} sm:max-w-[45vw]`}
    >
      {/* Barra de título */}
      <div className="winxp-gradient-blue text-white px-2 py-1 flex items-center gap-1.5 text-[11px] font-bold">
        <span className="truncate flex-1" title={title}>▶ Source — {title}</span>
        <button onClick={togglePlay} className={btn} title={playing ? 'Pausar vídeo' : 'Tocar vídeo'}>
          {playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setWide(v => !v)}
          className={`${btn} hidden sm:inline-block`}
          title={wide ? 'Diminuir painel' : 'Aumentar painel'}
        >
          {wide ? '⤡' : '⤢'}
        </button>
        <button
          onClick={() => setCollapsed(v => !v)}
          className={btn}
          title={collapsed ? 'Mostrar vídeo' : 'Recolher (o áudio continua)'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
        <button onClick={onClose} className={`${btn} text-[#cc3300]`} title="Fechar vídeo">✕</button>
      </div>

      {/* Vídeo — 16:9 preservado; no celular a altura é limitada e a largura acompanha. */}
      <div
        className="relative bg-black overflow-hidden mx-auto aspect-video w-[min(100%,calc(32vh*16/9))] sm:w-full
                   [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0"
        style={collapsed ? { height: 0 } : undefined}
      >
        <div ref={hostWrapRef} className="absolute inset-0" />
        {(!videoId || failed) && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] text-white/80 px-3">
            {videoId
              ? 'Não foi possível carregar o player do YouTube.'
              : 'O link da source não é um vídeo reconhecido do YouTube.'}
          </div>
        )}
      </div>

      <div className="px-2 py-0.5 text-[9px] text-gray-600 flex items-center justify-between gap-2">
        <span className="truncate">Vídeo hospedado no YouTube</span>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#002fa7] font-bold hover:underline shrink-0"
        >
          Abrir no YouTube ↗
        </a>
      </div>
    </div>
  );
};
