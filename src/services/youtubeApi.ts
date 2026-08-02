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

// ── Consentimento para JavaScript não-livre ─────────────────────────────────
//
// A IFrame API do YouTube é software proprietário. O Viola Libre é livre e roda
// sob o GNU LibreJS, então esse script NÃO pode ser injetado por conta própria:
// ele só entra depois de a pessoa pedir, num botão que diz o que está pedindo.
// Sem isso, a extensão bloqueia o script e o usuário vê um player quebrado sem
// entender o motivo — e o site teria carregado JS não-livre nas costas dele.
//
// A escolha fica lembrada no navegador para não exigir um clique por música;
// limpar os dados do site (ou o botão na Política de Privacidade) desfaz.
//
// São TRÊS estados, não dois. "Ainda não perguntei" é diferente de "disse não":
// no primeiro caso a rolagem precisa pode abrir o diálogo pedindo permissão; no
// segundo, insistir a cada clique em "Rolar" seria transformar uma recusa em
// pergunta infinita.

const CONSENT_KEY = 'viola:consentimento-js-youtube';

export type YouTubeJsConsent = 'nao-perguntado' | 'sim' | 'nao';

/** Erro específico de "ainda não autorizado" — não é falha de rede. */
export class NonFreeJsBlockedError extends Error {
  constructor() {
    super('O JavaScript do YouTube não foi autorizado por quem está usando o site.');
    this.name = 'NonFreeJsBlockedError';
  }
}

const listeners = new Set<() => void>();

function readConsent(): YouTubeJsConsent {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === 'sim' || stored === 'nao' ? stored : 'nao-perguntado';
  } catch {
    // Modo privado/armazenamento bloqueado: sem memória, mas o site funciona —
    // é só uma resposta por sessão.
    return 'nao-perguntado';
  }
}

let consent = readConsent();

export function getYouTubeJsConsent(): YouTubeJsConsent {
  return consent;
}

export function isYouTubeJsAllowed(): boolean {
  return consent === 'sim';
}

function setConsent(value: YouTubeJsConsent): void {
  if (consent === value) return;
  consent = value;
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* sem persistência, vale só nesta sessão */ }
  listeners.forEach(fn => fn());
}

export function allowYouTubeJs(): void {
  setConsent('sim');
}

/**
 * Registra a recusa — ou volta a bloquear o que já tinha sido autorizado.
 *
 * Só afeta os próximos carregamentos: o script já injetado nesta aba continua
 * na memória do navegador até um recarregamento da página.
 */
export function denyYouTubeJs(): void {
  setConsent('nao');
}

/** Assina mudanças de consentimento — é o que faz a UI reagir ao clique. */
export function subscribeYouTubeJs(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
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
  // Antes de qualquer coisa: sem autorização, nem a tag <script> nasce.
  if (consent !== 'sim') return Promise.reject(new NonFreeJsBlockedError());
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
 *
 * Medir duração é conveniência de bastidor, não um pedido de quem está usando o
 * site: se o JS do YouTube ainda não foi autorizado, esta função desiste em
 * silêncio em vez de pedir autorização. O auto-scroll cai na duração deduzida
 * por BPM, que é como ele já se virava quando a medição falhava.
 */
export function fetchYouTubeDuration(videoId: string, timeoutMs = 8000): Promise<number> {
  if (consent !== 'sim') return Promise.resolve(0);
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
