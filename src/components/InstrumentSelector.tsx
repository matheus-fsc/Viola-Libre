import React from 'react';
import type { Instrument, Tuning } from '../engine/types';
import { PRESET_INSTRUMENTS, NOTE_NAMES_SHARP } from '../engine/tunings';


interface InstrumentSelectorProps {
  selectedInstrument: Instrument;
  selectedTuning: Tuning;
  onInstrumentChange: (inst: Instrument) => void;
  onTuningChange: (tuning: Tuning) => void;
  onCustomTuningChange: (newStrings: number[]) => void;
}

export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  selectedInstrument,
  selectedTuning,
  onInstrumentChange,
  onTuningChange,
  onCustomTuningChange
}) => {

  const handleInstrumentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const inst = PRESET_INSTRUMENTS.find(i => i.id === e.target.value);
    if (inst) {
      onInstrumentChange(inst);
    }
  };

  const handleTuningSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Check preset tunings first
    const tuning = selectedInstrument.tunings.find(t => t.id === e.target.value);
    if (tuning) {
      onTuningChange(tuning);
    }
  };

  // Adjust midi note of a specific string (0-indexed, lowest to highest)
  const adjustStringPitch = (idx: number, delta: number) => {
    const updatedStrings = [...selectedTuning.strings];
    updatedStrings[idx] = Math.max(12, Math.min(127, updatedStrings[idx] + delta));
    
    // Trigger custom tuning update
    onCustomTuningChange(updatedStrings);
  };

  // Helper to format string note names (e.g. D4, A3, F#3)
  const formatMidiNote = (midi: number) => {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES_SHARP[pc]}${octave}`;
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 max-w-md w-full shadow-md">
      
      {/* Box Header (XP look) */}
      <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Configuração do Instrumento</span>
        <span className="font-mono text-xs">v1.0</span>
      </div>

      {/* Selectors Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold font-mono text-gray-700" htmlFor="instrument-select">Instrumento:</label>
          <select
            id="instrument-select"
            value={selectedInstrument.id}
            onChange={handleInstrumentSelect}
            className="bevel-in px-2 py-1 text-sm bg-white focus:outline-none select-none font-mono cursor-pointer"
          >
            {PRESET_INSTRUMENTS.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold font-mono text-gray-700" htmlFor="tuning-select">Afinação:</label>
          <select
            id="tuning-select"
            value={selectedTuning.id.startsWith('custom-') ? 'custom' : selectedTuning.id}
            onChange={handleTuningSelect}
            className="bevel-in px-2 py-1 text-sm bg-white focus:outline-none select-none font-mono cursor-pointer"
          >
            {selectedInstrument.tunings.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            {selectedTuning.id.startsWith('custom-') && (
              <option value="custom">Personalizada</option>
            )}
          </select>
        </div>
      </div>

      {/* Tuning Editor (Up/Down string notes adjustment) */}
      <div className="border-t border-[#d4d0c8] pt-3">
        <span className="text-xs font-bold font-mono text-gray-700 block mb-2">Ajuste Fino das Cordas (Cursos):</span>
        
        {/* Double-row display for strings */}
        <div className="flex justify-around items-center bg-[#d4d0c8] p-2 border border-[#808080] rounded shadow-inner">
          {selectedTuning.strings.map((midi, idx) => {
            const label = selectedInstrument.id === 'viola' 
              ? `${5 - idx}º Par` 
              : `Cord. ${selectedTuning.strings.length - idx}`;
              
            return (
              <div key={`string-ctrl-${idx}`} className="flex flex-col items-center gap-1 font-mono">
                <span className="text-[10px] text-gray-600 font-bold">{label}</span>
                
                {/* UP button */}
                <button
                  onClick={() => adjustStringPitch(idx, 1)}
                  className="w-7 h-5 flex items-center justify-center bg-[#ece9d8] text-xs font-bold border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-bottom-white cursor-pointer select-none hover:bg-white"
                  title="Aumentar meio tom (+1 semitom)"
                >
                  ▲
                </button>
                
                {/* Note Display Box */}
                <div className="bevel-in w-12 text-center py-1 font-bold text-xs bg-white text-[#002fa7]">
                  {formatMidiNote(midi)}
                </div>
                
                {/* DOWN button */}
                <button
                  onClick={() => adjustStringPitch(idx, -1)}
                  className="w-7 h-5 flex items-center justify-center bg-[#ece9d8] text-xs font-bold border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-bottom-white cursor-pointer select-none hover:bg-white"
                  title="Diminuir meio tom (-1 semitom)"
                >
                  ▼
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500 font-mono mt-2 text-center">
          Dica: Use as setas para criar afinações alternativas instantaneamente!
        </p>
      </div>

    </div>
  );
};
