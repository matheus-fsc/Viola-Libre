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
