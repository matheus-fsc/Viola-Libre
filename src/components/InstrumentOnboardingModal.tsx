import React from 'react';
import type { Instrument } from '../engine/types';
import { PRESET_INSTRUMENTS } from '../engine/tunings';

interface Props {
  onSelect: (inst: Instrument) => void;
  onSkip: () => void;
}

export const InstrumentOnboardingModal: React.FC<Props> = ({ onSelect, onSkip }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-mono">
      <div className="w-[480px] max-w-full bg-[#ece9d8] border-[3px] border-[#0058e6] rounded-t-lg shadow-2xl">
        <div className="winxp-gradient-blue text-white px-3 py-1.5 flex items-center rounded-t-md font-bold text-sm select-none">
          <span>🎸 Qual é o seu instrumento?</span>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <p className="text-gray-700 leading-relaxed">
            Escolha seu instrumento principal para carregarmos automaticamente a afinação
            certa sempre que você abrir uma cifra ou o dicionário de acordes. Dá pra trocar
            a qualquer momento depois.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_INSTRUMENTS.map(inst => (
              <button
                key={inst.id}
                onClick={() => onSelect(inst)}
                className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-3 font-bold text-xs hover:bg-white active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white cursor-pointer text-center"
              >
                {inst.name}
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
