import React from 'react';
import { Link } from 'react-router-dom';
import { allowYouTubeJs, denyYouTubeJs } from '../services/youtubeApi';
import { useYouTubeJsConsent } from '../hooks/useYouTubeJsAllowed';

interface YouTubeJsGateProps {
  /** Classes do container — cada tela encaixa a caixa no seu próprio layout. */
  className?: string;
  /** Versão curta, para espaços apertados como o painel do editor de timing. */
  compact?: boolean;
}

/**
 * Portão de entrada do player do YouTube.
 *
 * Aparece no lugar do vídeo enquanto o JS não-livre do YouTube não foi
 * autorizado. O texto é explícito de propósito: quem escolhe usar um site livre
 * merece saber exatamente o que está aceitando antes de aceitar, e não depois.
 */
export const YouTubeJsGate: React.FC<YouTubeJsGateProps> = ({ className = '', compact = false }) => (
  <div className={`flex flex-col items-center justify-center gap-2 text-center px-3 py-3 ${className}`}>
    <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} leading-snug`}>
      O player do YouTube depende de <strong>JavaScript não-livre</strong>, de terceiros.
      {!compact && ' Ele não é carregado sem o seu consentimento — o resto do site funciona normalmente sem ele.'}
    </p>
    <button
      type="button"
      onClick={allowYouTubeJs}
      className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0.5 text-[11px] font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
    >
      Carregar o player do YouTube
    </button>
    <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} opacity-70 leading-snug`}>
      A escolha fica lembrada neste navegador e pode ser desfeita na{' '}
      <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
    </p>
  </div>
);

/**
 * Controle de autorização para a Política de Privacidade.
 *
 * Uma permissão que só pode ser concedida, nunca retirada, não é permissão. Este
 * é o lugar onde ela volta atrás.
 */
/** Legenda de cada estado — o "ainda não perguntado" não é igual a um "não". */
const LEGENDA: Record<string, string> = {
  'nao-perguntado': 'Ninguém perguntou ainda, e nada foi carregado. A chave liga na primeira vez que você pedir um vídeo — ou aqui mesmo, agora.',
  sim: 'O player pode carregar. Desligar vale a partir do próximo vídeo; recarregue a página para tirar da memória o script já baixado.',
  nao: 'O script do YouTube não é carregado, e o site não perde nada além do player: a rolagem automática deduz o tempo pelo BPM da cifra.',
};

/**
 * Chave liga/desliga do JavaScript do YouTube.
 *
 * Uma permissão que só pode ser concedida, nunca retirada, não é permissão —
 * este é o lugar onde ela volta atrás. Desenhada como interruptor e não como
 * link porque o estado precisa ser legível de relance: quem abre a Política de
 * Privacidade quer saber o que está ligado, não ler um parágrafo para descobrir.
 */
export const YouTubeJsConsentControl: React.FC = () => {
  const consent = useYouTubeJsConsent();
  const allowed = consent === 'sim';

  return (
    <div className="mt-3 bevel-out bg-[var(--color-winxp-bg)] p-2.5 flex flex-col gap-2 max-w-md">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label="Autorizar o JavaScript não-livre do YouTube"
          onClick={allowed ? denyYouTubeJs : allowYouTubeJs}
          // Trilho afundado com o botão em relevo, como um interruptor do XP.
          // As bordas vão explícitas em vez de `bevel-in` porque aquela classe
          // fixa o fundo branco e aqui o fundo é justamente o que muda de cor.
          className={`relative shrink-0 w-[58px] h-[24px] border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white cursor-pointer transition-colors duration-150 ${
            allowed ? 'bg-[var(--color-winxp-green)]' : 'bg-[var(--color-winxp-panel)]'
          }`}
        >
          <span
            className={`absolute top-0 h-[20px] leading-[20px] text-[9px] font-mono font-bold select-none pointer-events-none ${
              allowed ? 'left-[5px] text-white' : 'right-[5px] text-[#606060]'
            }`}
          >
            {allowed ? 'SIM' : 'NÃO'}
          </span>
          <span
            className={`absolute top-0 w-[24px] h-[20px] bg-[var(--color-winxp-panel)] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] transition-all duration-150 ${
              allowed ? 'left-[30px]' : 'left-0'
            }`}
          />
        </button>

        <span className="font-mono text-xs sm:text-sm font-bold text-black/85">
          JavaScript do YouTube: {allowed ? 'autorizado' : 'bloqueado'}
        </span>
      </div>

      <p className="text-[11px] sm:text-xs text-gray-600 leading-snug">
        {LEGENDA[consent]}
      </p>
    </div>
  );
};
