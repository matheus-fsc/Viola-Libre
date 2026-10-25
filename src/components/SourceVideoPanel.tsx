import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoveDiagonal2 } from 'lucide-react';
import { useT } from '../i18n';
import { extractYouTubeId } from '../services/timingApi';
import { loadYouTubeApi, type YTPlayer } from '../services/youtubeApi';
import { YouTubeJsGate } from './YouTubeJsGate';
import { useYouTubeJsAllowed } from '../hooks/useYouTubeJsAllowed';
import { useFloatingWindow } from '../hooks/useFloatingWindow';
import { useSpringValue } from '../hooks/useSpringValue';
import { getIsMobile } from '../hooks/useIsMobile';

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
 * Janela flutuante com a source em vídeo da música.
 *
 * Arrasta pela barra de título e redimensiona pelo canto inferior direito, no celular e
 * no desktop (`useFloatingWindow`). Só a largura é escolhida; a altura sai do 16:9. Cada
 * modo lembra a sua geometria, porque o lugar bom para o vídeo num telefone em retrato
 * não serve para um monitor. A primeira vez abre onde o painel fixo ficava:
 * - celular  → no topo, largura total (o controle de auto-rolagem mora embaixo);
 * - desktop  → canto inferior ESQUERDO, longe do transporte (inferior direito) e da
 *   barra de posição (borda direita).
 *
 * Abrir, recolher e fechar são animados por mola (`useSpringValue`), e o modo desempenho
 * das Preferências desliga as três. Recolher mantém o <iframe> montado (só leva a altura
 * a zero), então o áudio continua tocando: quem só quer ouvir a referência não perde a
 * reprodução ao encolher.
 */
export const SourceVideoPanel: React.FC<SourceVideoPanelProps> = ({
  videoUrl, title, onClose, onDurationDetected,
}) => {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile] = useState(getIsMobile);
  // O que mora no pé da tela: no desktop a barra de tarefas (h-10 do App), no celular a
  // barra de destinos da cifra (56px de altura mais 8px de folga, mais a margem).
  const baseOcupada = mobile ? 72 : 40;
  const { janelaRef, barra, canto, reassentar } = useFloatingWindow({
    chave: `viola_video_janela_${mobile ? 'mobile' : 'desktop'}`,
    baseOcupada,
    inicial: (alturaDe) => {
      const vw = window.innerWidth;
      if (mobile) return { x: 8, y: 8, w: vw - 16 };
      const w = Math.min(352, vw * 0.45);
      return { x: 16, y: window.innerHeight - baseOcupada - alturaDe(w) - 16, w };
    },
  });
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // O player só nasce depois que a pessoa autoriza o JS não-livre do YouTube.
  const ytAllowed = useYouTubeJsAllowed();

  const hostWrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  // O callback do pai não precisa ser estável: guardá-lo num ref evita que uma
  // nova referência a cada render destrua e recrie o player no meio da música.
  const onDurationRef = useRef(onDurationDetected);
  onDurationRef.current = onDurationDetected;

  const videoId = extractYouTubeId(videoUrl);

  useEffect(() => {
    const wrap = hostWrapRef.current;
    if (!videoId || !wrap || !ytAllowed) return;

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
  }, [videoId, ytAllowed]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo(); else p.playVideo();
  }, [playing]);

  // Aparecer e sumir: a janela cresce de 94% e ganha opacidade ao abrir, e faz o
  // caminho inverso antes de desmontar. Vive num nó de dentro porque o de fora já
  // usa `transform` para a posição, e as duas coisas brigariam pelo mesmo estilo.
  const aparicaoRef = useRef<HTMLDivElement>(null);
  const aparicao = useSpringValue((p) => {
    const el = aparicaoRef.current;
    if (!el) return;
    el.style.opacity = String(Math.max(0, Math.min(p, 1)));
    el.style.transform = p >= 1 ? '' : `scale(${0.94 + 0.06 * p})`;
  }, 0);
  useLayoutEffect(() => {
    aparicao.definir(0);
    aparicao.ir(1);
  }, [aparicao]);
  const [fechando, setFechando] = useState(false);
  const fechar = () => {
    setFechando(true);
    aparicao.ir(0, onClose);
  };

  // Recolher anima a altura do vídeo de 16:9 até zero. O <iframe> fica montado, então
  // o áudio segue. Ao reabrir, a janela pode ter crescido para fora da tela: o
  // `reassentar` a traz de volta quando a mola chega.
  const videoRef = useRef<HTMLDivElement>(null);
  const recolhimento = useSpringValue((p) => {
    const el = videoRef.current;
    if (!el) return;
    el.style.height = p >= 1 ? '' : `${Math.max(0, p) * el.offsetWidth * 9 / 16}px`;
  }, 1);
  const alternarRecolhido = () => {
    const recolher = !collapsed;
    setCollapsed(recolher);
    recolhimento.ir(recolher ? 0 : 1, recolher ? undefined : reassentar);
  };

  const btn = 'bevel-out bg-[var(--color-winxp-panel)] text-black px-1.5 py-0 text-[11px] leading-tight font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white';

  return (
    <div
      ref={janelaRef}
      className={`fixed left-0 top-0 z-50 select-none will-change-transform
                  [&[data-arrastando]_iframe]:pointer-events-none ${fechando ? 'pointer-events-none' : ''}`}
    >
      <div
        ref={aparicaoRef}
        className="bevel-out bg-[var(--color-winxp-panel)] border border-gray-500 shadow-xl opacity-0"
      >
        {/* Barra de título */}
        <div
          {...barra}
          className="winxp-gradient-blue text-white px-2 py-1 flex items-center gap-1.5 text-[11px] font-bold cursor-move touch-none"
          title={t('cifra.videoArrastar')}
        >
          <span className="truncate flex-1" title={title}>▶ Source — {title}</span>
          <button onClick={togglePlay} className={btn} title={playing ? t('cifra.videoPausar') : t('cifra.videoTocar')}>
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={alternarRecolhido}
            className={btn}
            title={collapsed ? t('cifra.videoMostrar') : t('cifra.videoRecolher')}
          >
            {collapsed ? '▲' : '▼'}
          </button>
          <button onClick={fechar} className={`${btn} text-[#cc3300]`} title={t('cifra.videoFechar')}>✕</button>
        </div>

        {/* Vídeo: 16:9 preservado, a largura vem da janela. */}
        <div
          ref={videoRef}
          className="relative bg-black overflow-hidden aspect-video w-full
                     [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0"
        >
          <div ref={hostWrapRef} className="absolute inset-0" />
          {!videoId ? (
            <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] text-white/80 px-3">
              {t('cifra.videoNaoReconhecido')}
            </div>
          ) : !ytAllowed ? (
            <YouTubeJsGate className="absolute inset-0 bg-[#1a1a1a] text-white/90 [&_a]:text-white" />
          ) : failed ? (
            <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] text-white/80 px-3">
              {t('cifra.videoFalhouPlayer')}
            </div>
          ) : null}
        </div>

        {/* Rodapé. A alça de redimensionar é a última peça da linha, e não um canto
            sobreposto: assim ela nunca cobre o link. Mouse: a marca XP de três riscos,
            discreta no canto. Dedo (`pointer-coarse`): o rodapé cresce para 44px, o alvo
            mínimo de toque, e a alça vira um botão separado por um filete, para não ser
            confundida com o link. O comportamento de cada uma está no hook. */}
        <div className="flex items-stretch text-[9px] pointer-coarse:text-[11px] text-gray-600">
          <div className="flex-1 min-w-0 px-2 py-0.5 pointer-coarse:py-0 flex items-center justify-between gap-2">
            <span className="truncate">{t('cifra.videoHospedado')}</span>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#002fa7] font-bold hover:underline shrink-0 pointer-coarse:py-3"
            >
              {t('cifra.videoAbrirNoYouTube')}
            </a>
          </div>
          <div
            {...canto}
            className="shrink-0 touch-none cursor-nwse-resize flex items-end justify-end w-4 p-0.5
                       pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:p-1 pointer-coarse:items-center pointer-coarse:justify-center
                       pointer-coarse:border-l pointer-coarse:border-gray-400"
            role="separator"
            aria-label={t('cifra.videoRedimensionar')}
            title={t('cifra.videoRedimensionar')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="text-gray-500 pointer-coarse:hidden">
              <path d="M9 1 1 9M9 4 4 9M9 7 7 9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span
              aria-hidden
              className="hidden pointer-coarse:flex w-full h-full items-center justify-center bevel-out bg-[var(--color-winxp-panel)] border border-gray-500"
            >
              <MoveDiagonal2 size={16} className="text-gray-700" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
