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
const SITUACAO: Record<string, string> = {
  'nao-perguntado': 'ainda não perguntado',
  sim: 'autorizado',
  nao: 'bloqueado',
};

export const YouTubeJsConsentControl: React.FC = () => {
  const consent = useYouTubeJsConsent();
  const allowed = consent === 'sim';
  return (
    <p className="mt-2">
      Situação neste navegador: <strong>{SITUACAO[consent]}</strong>.{' '}
      <button
        type="button"
        onClick={allowed ? denyYouTubeJs : allowYouTubeJs}
        className="underline font-bold cursor-pointer"
      >
        {allowed ? 'Bloquear novamente' : 'Autorizar'}
      </button>
      {allowed && ' — vale a partir do próximo carregamento de vídeo; recarregue a página para tirar da memória o script já baixado.'}
    </p>
  );
};
