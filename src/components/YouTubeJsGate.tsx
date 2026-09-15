import React from 'react';
import { Link } from 'react-router-dom';
import { allowYouTubeJs, denyYouTubeJs, type YouTubeJsConsent } from '../services/youtubeApi';
import { useT, type Chave } from '../i18n';
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
export const YouTubeJsGate: React.FC<YouTubeJsGateProps> = ({ className = '', compact = false }) => {
  const t = useT();
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center px-3 py-3 ${className}`}>
      {/* O que está em negrito é uma frase inteira, e não um pedaço costurado no meio da
          outra: cada idioma põe "não-livre" numa posição diferente da oração, e texto
          partido em três para embrulhar um <strong> só sai certo num deles. */}
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} leading-snug`}>
        <strong>{t('youtube.gateForte')}</strong>{' '}
        {compact ? t('youtube.gateCurto') : t('youtube.gateLongo')}
      </p>
      <button
        type="button"
        onClick={allowYouTubeJs}
        className="bevel-out bg-[var(--color-winxp-panel)] text-black px-2 py-0.5 text-[11px] font-bold border border-gray-400 hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white"
      >
        {t('youtube.gateBotao')}
      </button>
      {/* O link aponta para as Preferências, e não mais para a Política de Privacidade:
          a chave continua nas duas telas, mas agora o lugar de REVER uma escolha é o
          painel que junta todas elas. */}
      <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} opacity-70 leading-snug`}>
        {t('youtube.gateLembrada')}{' '}
        <Link to="/preferencias" className="underline">{t('youtube.gateMudar')}</Link>.
      </p>
    </div>
  );
};

/** Chave da legenda de cada estado: o "ainda não perguntado" não é igual a um "não". */
const LEGENDA: Record<YouTubeJsConsent, Chave> = {
  'nao-perguntado': 'youtube.legendaNaoPerguntado',
  sim: 'youtube.legendaSim',
  nao: 'youtube.legendaNao',
};

/**
 * Chave liga/desliga do JavaScript do YouTube.
 *
 * Uma permissão que só pode ser concedida, nunca retirada, não é permissão —
 * este é o lugar onde ela volta atrás. Desenhada como interruptor e não como
 * link porque o estado precisa ser legível de relance: quem abre as Preferências ou a
 * Política de Privacidade quer saber o que está ligado, não ler um parágrafo para
 * descobrir. O mesmo componente serve às duas telas, e por isso elas nunca discordam.
 */
export const YouTubeJsConsentControl: React.FC = () => {
  const consent = useYouTubeJsConsent();
  const allowed = consent === 'sim';
  const t = useT();

  return (
    <div className="mt-3 bevel-out bg-[var(--color-winxp-bg)] p-2.5 flex flex-col gap-2 max-w-md">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label={t('youtube.chaveAria')}
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
            {allowed ? t('youtube.chaveSim') : t('youtube.chaveNao')}
          </span>
          <span
            className={`absolute top-0 w-[24px] h-[20px] bg-[var(--color-winxp-panel)] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] transition-all duration-150 ${
              allowed ? 'left-[30px]' : 'left-0'
            }`}
          />
        </button>

        <span className="font-mono text-xs sm:text-sm font-bold text-black/85">
          {allowed ? t('youtube.estadoAutorizado') : t('youtube.estadoBloqueado')}
        </span>
      </div>

      <p className="text-[11px] sm:text-xs text-gray-600 leading-snug">
        {t(LEGENDA[consent])}
      </p>
    </div>
  );
};
