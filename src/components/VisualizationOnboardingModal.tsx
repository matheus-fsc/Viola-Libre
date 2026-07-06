import React from 'react';
import { useVisualizationStore } from '../stores/useVisualizationStore';
import { PRESET_INSTRUMENTS } from '../engine/tunings';
import { FretboardDiagram } from './FretboardDiagram';

export const VisualizationOnboardingModal: React.FC = () => {
  const { stringOrder, setStringOrder } = useVisualizationStore();

  if (stringOrder !== null) return null;

  const guitar = PRESET_INSTRUMENTS.find(i => i.id === 'violao');
  const tuning = guitar?.tunings.find(t => t.id === 'violao-padrao');

  if (!tuning) return null;

  const amVoicing = {
    frets: [-1, 0, 2, 2, 1, 0],
    notes: ['X', 'A', 'E', 'A', 'C', 'E'],
    score: 0,
    playabilityIssues: [],
  };

  const handleSelect = (order: 'standard' | 'inverted') => {
    setStringOrder(order);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#ece9d8] border-[3px] border-[#0058e6] shadow-2xl rounded-t-lg flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-[#0a246a] to-[#3a6ea5] text-white px-3 py-1.5 flex justify-between items-center rounded-t-sm border-b-2 border-[#002fa7] select-none">
          <span className="font-bold text-sm tracking-wide font-mono">
            Preferência de Visualização
          </span>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="text-center">
            <h2 className="text-lg font-bold text-[#002fa7] font-mono mb-2">
              Como você prefere ler as cordas?
            </h2>
            <p className="text-sm text-gray-700 font-mono">
              Antes de modificar o acorde, escolha a ordem das cordas que você prefere.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            <div 
              className="bg-white border-2 border-gray-400 p-4 flex flex-col items-center gap-4 cursor-pointer hover:border-[#0058e6] hover:bg-[#f0f5ff] transition-all rounded shadow"
              onClick={() => handleSelect('standard')}
            >
              <div className="text-center font-mono">
                <div className="font-bold text-black text-base">Padrão</div>
                <div className="text-xs text-gray-600 mt-1">Grave no Topo/Esquerda</div>
                <div className="text-xs text-[#0058e6] mt-1 font-bold">E A D G B E</div>
              </div>
              <div className="pointer-events-none">
                <FretboardDiagram 
                  voicing={amVoicing} 
                  tuning={tuning} 
                  chordName="Am" 
                  compact={false}
                  forceInverted={false}
                />
              </div>
              <button className="bg-[#0058e6] text-white px-4 py-2 font-bold font-mono text-xs rounded hover:bg-[#3a8bfb]">
                Selecionar Padrão
              </button>
            </div>

            <div 
              className="bg-white border-2 border-gray-400 p-4 flex flex-col items-center gap-4 cursor-pointer hover:border-[#0058e6] hover:bg-[#f0f5ff] transition-all rounded shadow"
              onClick={() => handleSelect('inverted')}
            >
              <div className="text-center font-mono">
                <div className="font-bold text-black text-base">Invertida</div>
                <div className="text-xs text-gray-600 mt-1">Agudo no Topo/Esquerda</div>
                <div className="text-xs text-[#0058e6] mt-1 font-bold">E B G D A E</div>
              </div>
              <div className="pointer-events-none">
                <FretboardDiagram 
                  voicing={amVoicing} 
                  tuning={tuning} 
                  chordName="Am" 
                  compact={false}
                  forceInverted={true}
                />
              </div>
              <button className="bg-[#0058e6] text-white px-4 py-2 font-bold font-mono text-xs rounded hover:bg-[#3a8bfb]">
                Selecionar Invertida
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
