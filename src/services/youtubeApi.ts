// Carregador único da IFrame API do YouTube.
//
// A API do YouTube expõe UM único gancho global (`window.onYouTubeIframeAPIReady`).
// Se dois componentes montados ao mesmo tempo atribuírem esse gancho, o segundo
// apaga o primeiro e um dos players nunca nasce. Este módulo é o dono do gancho:
// injeta o script uma vez só e entrega a mesma Promise a todos os interessados.
//
// A tag <script> e o <iframe> já estão liberados no CSP (public/_headers):
// script-src https://www.youtube.com https://s.ytimg.com; frame-src https://www.youtube.com

export interface YTPlayerOptions {
  videoId: string;
  height?: string | number;
  width?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
  };
}

export interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_ID = 'yt-api-script';
let pending: Promise<YTNamespace> | null = null;
// Durações já medidas nesta sessão, por videoId. Um <iframe> do YouTube por
// medição é caro; o mesmo vídeo (ida e volta na mesma cifra, ou a mesma source
// em duas telas) responde do cache.
const knownDurations = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    // Outro caminho já pediu o script (versão antiga desta tela, por exemplo):
    // basta esperar o gancho que acabamos de registrar.
    if (document.getElementById(SCRIPT_ID)) return;
    const tag = document.createElement('script');
    tag.id = SCRIPT_ID;
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      // Zera o cache para que uma nova tentativa (rede voltou, adblock desligado)
      // possa reinjetar o script em vez de herdar uma Promise morta.
      pending = null;
      tag.remove();
      reject(new Error('Falha ao carregar a IFrame API do YouTube'));
    };
    document.head.appendChild(tag);
  });

  return pending;
}

/**
 * Mede a duração real de um vídeo do YouTube sem exibi-lo.
 *
 * A IFrame API só entrega `getDuration()` a partir de um player de verdade — não
 * existe rota pública que devolva a duração sem chave de API (o oEmbed não traz
 * esse campo). Então montamos um player fora da tela, lemos os metadados e o
 * destruímos. O vídeo nunca chega a tocar: `playVideo()` não é chamado.
 *
 * Resolve com `0` quando não dá para medir (rede, adblock, vídeo restrito) —
 * quem chama trata isso como "sem duração" e segue com a fonte que já tinha.
 */
export function fetchYouTubeDuration(videoId: string, timeoutMs = 8000): Promise<number> {
  const known = knownDurations.get(videoId);
  if (known != null) return Promise.resolve(known);
  const running = inFlight.get(videoId);
  if (running) return running;

  const run = measureDuration(videoId, timeoutMs)
    .then(seconds => {
      // Só o resultado bom entra no cache: um tropeço de rede não pode condenar
      // o vídeo a ficar sem duração pelo resto da sessão.
      if (seconds > 0) knownDurations.set(videoId, seconds);
      return seconds;
    })
    .catch(() => 0)
    .finally(() => { inFlight.delete(videoId); });

  inFlight.set(videoId, run);
  return run;
}

function measureDuration(videoId: string, timeoutMs: number): Promise<number> {
  return loadYouTubeApi().then(YT => new Promise<number>(resolve => {
    // O wrapper é nosso; o `host` é o nó que o YT.Player SUBSTITUI pelo <iframe>.
    // Descartar o wrapper no fim leva junto o que quer que tenha sobrado ali.
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const host = document.createElement('div');
    wrap.appendChild(host);
    document.body.appendChild(wrap);

    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(giveUp);
      if (poll) clearInterval(poll);
      try { player?.destroy(); } catch { /* o player pode já ter sumido */ }
      wrap.remove();
      resolve(seconds);
    };
    const giveUp: ReturnType<typeof setTimeout> = setTimeout(() => finish(0), timeoutMs);

    // `onReady` costuma já ter os metadados, mas nem sempre: em alguns vídeos o
    // getDuration() responde 0 nos primeiros instantes. Por isso insistimos até
    // vir um número ou o prazo acabar.
    const read = () => {
      const d = Math.round(player?.getDuration() ?? 0);
      if (d > 0) finish(d);
    };

    player = new YT.Player(host, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { rel: 0, playsinline: 1, controls: 0 },
      events: {
        onReady: () => {
          read();
          if (!settled) poll = setInterval(read, 200);
        },
      },
    });
  }));
}
