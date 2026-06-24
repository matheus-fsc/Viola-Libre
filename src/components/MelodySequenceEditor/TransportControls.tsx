import React from 'react';
import { UndoIcon, RedoIcon, PlayIcon, PauseIcon, RestartIcon, RobotIcon } from '../Icons';
import { usePlayback } from './PlaybackContext';

interface TransportControlsProps {
  historyIndex: number;
  historyLength: number;
  handleUndo: () => void;
  handleRedo: () => void;
  showHarmonizer: boolean;
  setShowHarmonizer: (show: boolean) => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  historyIndex,
  historyLength,
  handleUndo,
  handleRedo,
  showHarmonizer,
  setShowHarmonizer,
}) => {
  const {
    bpm,
    setBpm,
    isPlayingMelody,
    handlePlayMelody,
    handleRestartMelody,
    melody,
  } = usePlayback();

  return (
    <div className="flex justify-between items-center border-b border-dashed border-[#808080] pb-2 flex-wrap gap-2 select-none">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-700">Sequência ({melody.length} notas):</span>
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        {/* BPM Slider */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
          <span>Tempo:</span>
          <input
            type="range"
            min="60"
            max="220"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            className="w-20 accent-[#0058e6] cursor-pointer"
          />
          <span className="w-14 text-right font-mono">{bpm} BPM</span>
        </div>

        {/* Undo / Redo Buttons */}
        <div className="flex gap-1 border-r border-dashed border-[#808080] pr-3 mr-0.5">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="px-2 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed font-bold active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer select-none text-[10px] rounded-sm flex items-center gap-1"
            title="Desfazer ação (Ctrl+Z)"
          >
            <UndoIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= historyLength - 1}
            className="px-2 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] disabled:opacity-40 disabled:cursor-not-allowed font-bold active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer select-none text-[10px] rounded-sm flex items-center gap-1"
            title="Refazer ação (Ctrl+Y)"
          >
            <RedoIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Play / Pause / Restart */}
        <div className="flex gap-1.5">
          <button 
            onClick={handlePlayMelody}
            disabled={melody.length === 0}
            className={`px-3 py-1 text-white border font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none flex items-center gap-1.5 rounded-sm transition-all ${
              isPlayingMelody 
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-800 hover:from-amber-500 hover:to-amber-400' 
                : 'bg-gradient-to-r from-[#228b22] to-[#2ecc71] border-green-800 hover:from-green-600 hover:to-green-400'
            }`}
            title={isPlayingMelody ? "Pausar reprodução" : "Ouvir melodia"}
          >
            {isPlayingMelody ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
          </button>

          <button 
            onClick={handleRestartMelody}
            disabled={melody.length === 0}
            className="px-3 py-1 bg-[#ece9d8] border border-[#808080] hover:bg-white text-gray-700 font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none flex items-center gap-1.5 rounded-sm transition-all"
            title="Reiniciar da primeira nota"
          >
            <RestartIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Harmonizer Toggle */}
        <button 
          onClick={() => setShowHarmonizer(!showHarmonizer)}
          disabled={melody.length === 0}
          className={`px-3 py-1 border font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none flex items-center gap-1.5 rounded-sm transition-all ${
            showHarmonizer
              ? 'bg-amber-100 border-amber-600 text-amber-900 shadow-inner'
              : 'bg-[#ece9d8] border-[#808080] hover:bg-white text-gray-700'
          }`}
          title="Painel de Harmonização e Geração de Acordes"
        >
          <RobotIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
