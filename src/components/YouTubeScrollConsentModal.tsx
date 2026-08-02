import React from 'react';
import { allowYouTubeJs, denyYouTubeJs } from '../services/youtubeApi';

interface YouTubeScrollConsentModalProps {
  /** Chamado depois da resposta, para a tela fechar o diálogo. */
  onAnswered(): void;
}

/**
 * Pergunta, antes de medir a duração da música no YouTube.
 *
 * A rolagem automática fica muito mais precisa quando sabe a duração real da
 * gravação, e o único jeito de descobrir isso sem chave de API é montar um
 * player do YouTube fora da tela. Isso significa duas coisas que o músico
 * precisa poder recusar: carregar JavaScript proprietário e entregar ao Google
 * o IP dele junto com o vídeo que está estudando.
 *
 * Recusar não quebra a rolagem — ela volta a deduzir o tempo pelo BPM, que é
 * como o site funcionava antes de existir a medição.
 */
export const YouTubeScrollConsentModal: React.FC<YouTubeScrollConsentModalProps> = ({ onAnswered }) => {
  const answer = (allow: boolean) => {
    if (allow) allowYouTubeJs(); else denyYouTubeJs();
    onAnswered();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#ece9d8] border-[3px] border-[#0058e6] shadow-2xl rounded-t-lg flex flex-col w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#0a246a] to-[#3a6ea5] text-white px-3 py-1.5 flex justify-between items-center rounded-t-sm border-b-2 border-[#002fa7] select-none">
          <span className="font-bold text-sm tracking-wide font-mono">Rolagem precisa</span>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-3 font-mono text-sm text-gray-800">
          <p>
            Para acertar o ritmo da rolagem, o site precisa saber a{' '}
            <strong>duração real da gravação</strong>. Hoje o único jeito de descobrir isso é
            abrir um player do YouTube escondido e perguntar a ele.
          </p>
          <p className="text-xs bg-white border border-gray-400 p-2 leading-relaxed">
            Isso carrega <strong>JavaScript não-livre</strong> do YouTube e entrega ao Google o
            seu IP e qual vídeo está sendo consultado. Se você recusar, a rolagem continua
            funcionando: ela deduz o tempo pelo BPM da cifra, com menos precisão.
          </p>
          <p className="text-xs text-gray-600">
            Sua resposta fica lembrada neste navegador e pode ser trocada na Política de
            Privacidade.
          </p>

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => answer(false)}
              className="bevel-out bg-[var(--color-winxp-panel)] px-3 py-1 text-xs font-bold border border-gray-400 hover:bg-white cursor-pointer"
            >
              Não, seguir pelo BPM
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className="bg-[#0058e6] text-white px-3 py-1 font-bold text-xs rounded hover:bg-[#3a8bfb] cursor-pointer"
            >
              Sim, usar a rolagem precisa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
