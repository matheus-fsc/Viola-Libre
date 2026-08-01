import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Moldura comum dos documentos do projeto (Termos, Privacidade, Agradecimentos).
 *
 * Nasceu do Termos de Uso, que era o único. Com três documentos irmãos, copiar a moldura
 * três vezes garantiria que eles divergissem no primeiro ajuste de estilo — e documento
 * legal que parece de outro site levanta suspeita justamente onde se quer confiança.
 */

export const Section: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-sm sm:text-base font-bold text-[#002fa7] font-mono border-b border-dashed border-[#808080] pb-1">
      {n}. {title}
    </h2>
    <div className="flex flex-col gap-2 text-xs sm:text-sm leading-relaxed text-black/90">
      {children}
    </div>
  </section>
);

/** Lista com marcador, para as enumerações de dados e serviços. */
export const Lista: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="flex flex-col gap-1.5 pl-4 list-disc marker:text-[#0058e6]">
    {children}
  </ul>
);

export const Link: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target={href.startsWith('mailto:') ? undefined : '_blank'}
    rel="noopener noreferrer"
    className="text-[#0058e6] underline hover:text-[#3a8bfb] font-bold break-words"
  >
    {children}
  </a>
);

export const DocumentoPage: React.FC<{
  title: string;
  intro?: React.ReactNode;
  lastUpdated?: string;
  children: React.ReactNode;
}> = ({ title, intro, lastUpdated, children }) => {
  const navigate = useNavigate();

  return (
    <div className="p-2 sm:p-4">
      <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white flex flex-col font-sans">

        <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center gap-2 select-none">
          <span className="font-bold text-xs sm:text-sm font-mono truncate">{title}</span>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 px-2 py-0.5 bg-[#ece9d8] text-black border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-[10px] sm:text-xs hover:bg-white cursor-pointer"
            title="Voltar à área de trabalho"
          >
            ← Voltar
          </button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-3xl">
          {intro && (
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{intro}</p>
          )}

          {children}

          {lastUpdated && (
            <div className="border-t border-[#808080] pt-3 mt-1 text-[11px] sm:text-xs text-gray-500 font-mono select-none">
              Última atualização: {lastUpdated}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
