import React from 'react';
import type { Instrument } from '../engine/types';
import { PRESET_INSTRUMENTS } from '../engine/tunings';
import { useDialog } from '../hooks/useDialog';

interface Props {
  onSelect: (inst: Instrument) => void;
  onSkip: () => void;
}

/**
 * Rótulos só desta tela, sem mexer no `name` do instrumento.
 *
 * Aqui a pergunta é "qual é o seu instrumento?", e quem toca guitarra não se reconhece em
 * "Violão" — mas a afinação é a mesma, então o preset serve aos dois. O `name` continua
 * "Violão" no resto do app de propósito: ele aparece em `<select>` estreitos (na barra da
 * cifra o campo tem 90px) onde o nome composto seria cortado no meio.
 */
const ROTULO_ONBOARDING: Record<string, string> = {
  violao: 'Violão/Guitarra',
};

/**
 * O `<wbr>` depois da barra é a única quebra permitida no rótulo composto: sem ele o
 * navegador não garante quebra no `/` e pode partir "Guitarra" ao meio na coluna estreita
 * do telefone. Com ele, ou cabe numa linha só, ou vira "Violão/" + "Guitarra".
 */
function rotulo(inst: Instrument): React.ReactNode {
  const texto = ROTULO_ONBOARDING[inst.id] ?? inst.name;
  if (!texto.includes('/')) return texto;
  return texto.split('/').map((parte, i) => (
    <React.Fragment key={i}>
      {i > 0 && <>/<wbr /></>}
      {parte}
    </React.Fragment>
  ));
}

export const InstrumentOnboardingModal: React.FC<Props> = ({ onSelect, onSkip }) => {
  // Esc equivale a "decidir depois": é a saída sem escolher, que já existe no botão.
  const { ref: dialogRef, props: dialogProps } = useDialog({ onClose: onSkip, titleId: 'titulo-onboarding-instrumento' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-mono">
      {/* `max-h-full` + corpo rolável: são catorze instrumentos, e numa tela de 568px de
          altura o diálogo media 692px — ficava com o topo cortado e o "Decidir depois"
          abaixo da dobra, sem rolagem nenhuma para alcançá-lo. A barra de título fica de
          fora da área que rola, senão a pessoa perde de vista a pergunta que está
          respondendo. */}
      <div ref={dialogRef} {...dialogProps} className="w-[480px] max-w-full max-h-full flex flex-col bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl">
        <div className="shrink-0 winxp-gradient-blue text-white px-3 py-1.5 flex items-center rounded-t-md font-bold text-sm select-none">
          <span id="titulo-onboarding-instrumento">🎸 Qual é o seu instrumento?</span>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs min-h-0 overflow-y-auto retro-scrollbar">
          <p className="text-gray-700 leading-relaxed">
            Escolha seu instrumento principal para carregarmos automaticamente a afinação
            certa sempre que você abrir uma cifra ou o dicionário de acordes. Dá pra trocar
            a qualquer momento depois.
          </p>

          {/* `items-stretch` deixa os botões de uma linha com a mesma altura mesmo quando
              um deles quebra em duas linhas — sem isso, "Violão/Guitarra" ficaria mais alto
              que os vizinhos na largura de telefone. `leading-tight` e `hyphens-none` mantêm
              a quebra contida e sempre na barra, nunca no meio de "Guitarra". */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-stretch">
            {PRESET_INSTRUMENTS.map(inst => (
              <button
                key={inst.id}
                onClick={() => onSelect(inst)}
                className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 sm:px-2 py-3 font-bold text-xs leading-tight hyphens-none hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white cursor-pointer text-center"
              >
                {rotulo(inst)}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-[#808080]/30">
            <button
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-800 underline cursor-pointer text-xs"
            >
              Decidir depois (usar Viola Caipira)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
