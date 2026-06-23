import React from 'react';

import { CHORD_FORMULAS } from '../engine/tunings';

interface ChordFinderProps {
  selectedRootName: string;
  selectedSuffix: string;
  selectedBassName: string;
  onChordChange: (rootName: string, suffix: string, bassName: string) => void;
  resultsCount: number;
}

export const ChordFinder: React.FC<ChordFinderProps> = ({
  selectedRootName,
  selectedSuffix,
  selectedBassName,
  onChordChange,
  resultsCount
}) => {
  // Common roots showing both sharps and flats for clarity
  const roots = [
    { name: "C", alt: "" },
    { name: "C#", alt: "Db" },
    { name: "D", alt: "" },
    { name: "D#", alt: "Eb" },
    { name: "E", alt: "" },
    { name: "F", alt: "" },
    { name: "F#", alt: "Gb" },
    { name: "G", alt: "" },
    { name: "G#", alt: "Ab" },
    { name: "A", alt: "" },
    { name: "A#", alt: "Bb" },
    { name: "B", alt: "" }
  ];

  // Map flat/sharp selection to the active root name
  const handleRootClick = (root: { name: string, alt: string }, useAlt: boolean) => {
    const targetName = useAlt ? root.alt : root.name;
    if (selectedRootName === targetName) {
      onChordChange("", selectedSuffix, selectedBassName);
    } else {
      onChordChange(targetName, selectedSuffix, selectedBassName);
    }
  };

  const handleSuffixClick = (suffix: string) => {
    onChordChange(selectedRootName, suffix, selectedBassName);
  };

  // Helper to check if a root button is active
  const isRootActive = (root: { name: string, alt: string }) => {
    return selectedRootName === root.name || selectedRootName === root.alt;
  };

  // Helper to check if the specific name matches the selected root name
  const isExactNameActive = (name: string) => {
    return selectedRootName === name;
  };

  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] p-4 flex flex-col gap-4 max-w-md w-full shadow-md">
      
      {/* Box Header (XP look) */}
      <div className="bg-gradient-to-r from-[#0058e6] to-[#3a8bfb] text-white px-2 py-1 flex justify-between items-center font-bold text-sm select-none">
        <span>Selecionar Acorde</span>
        <span className="font-mono text-xs">{selectedRootName}{selectedSuffix}{selectedBassName ? `/${selectedBassName}` : ''}</span>
      </div>

      {/* Root Selector Grid */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold font-mono text-gray-700">Tom Fundamental (Root):</span>
        <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-[#d4d0c8] border border-[#808080]">
          {roots.map(root => {
            const hasAlt = root.alt !== "";
            const active = isRootActive(root);
            
            return (
              <div 
                key={root.name} 
                className={`flex flex-col border ${active ? 'border-[#002fa7] bg-[#c2d7f2]' : 'border-[#d4d0c8] bg-[#ece9d8]'} p-0.5 gap-0.5`}
              >
                {!hasAlt ? (
                  <button
                    onClick={() => handleRootClick(root, false)}
                    className={`text-xs font-bold font-mono py-1.5 cursor-pointer text-center select-none w-full border ${
                      isExactNameActive(root.name)
                        ? 'bg-gradient-to-b from-[#ff9d00] to-[#ff5f00] text-white border-white'
                        : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-bottom-white'
                    }`}
                  >
                    {root.name}
                  </button>
                ) : (
                  <div className="flex gap-0.5 w-full">
                    <button
                      onClick={() => handleRootClick(root, false)}
                      className={`text-[10px] font-bold font-mono py-1.5 cursor-pointer text-center select-none flex-1 border ${
                        isExactNameActive(root.name)
                          ? 'bg-gradient-to-b from-[#ff9d00] to-[#ff5f00] text-white border-white'
                          : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
                      }`}
                    >
                      {root.name}
                    </button>
                    <button
                      onClick={() => handleRootClick(root, true)}
                      className={`text-[10px] font-bold font-mono py-1.5 cursor-pointer text-center select-none flex-1 border ${
                        isExactNameActive(root.alt)
                          ? 'bg-gradient-to-b from-[#ff9d00] to-[#ff5f00] text-white border-white'
                          : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
                      }`}
                    >
                      {root.alt}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Suffix / Quality Grid */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold font-mono text-gray-700">Tipo de Acorde:</span>
        <div className="h-[145px] overflow-y-auto pr-1 bg-white border-2 border-[#808080] border-r-white border-bottom-white p-1 flex flex-col gap-1 retro-scrollbar">
          {CHORD_FORMULAS.map(formula => {
            const active = selectedSuffix === formula.suffix;

            return (
              <button
                key={formula.suffix}
                onClick={() => handleSuffixClick(formula.suffix)}
                className={`text-left text-xs font-mono px-2 py-1.5 flex justify-between items-center cursor-pointer border select-none ${
                  active
                    ? 'bg-[#0058e6] text-white border-[#002fa7]'
                    : 'bg-[#ece9d8] text-black border-[#d4d0c8] hover:bg-white hover:border-[#808080]'
                }`}
              >
                <span>
                  <strong>{formula.suffix || 'Maior'}</strong> 
                  <span className={`text-[10px] ml-2 ${active ? 'text-gray-200' : 'text-gray-500'}`}>
                    ({formula.name})
                  </span>
                </span>
                <span className={`text-[9px] font-bold px-1 py-0.2 rounded border ${active ? 'bg-[#002fa7] border-[#3a8bfb]' : 'bg-[#d4d0c8] border-[#808080] text-gray-600'}`}>
                  {formula.intervals.join(',')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bass Selector (Opcional) */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold font-mono text-gray-700">Baixo na Nota (Opcional):</span>
        <select
          value={selectedBassName}
          onChange={(e) => onChordChange(selectedRootName, selectedSuffix, e.target.value)}
          className="w-full text-xs font-mono bg-white border-2 border-r-white border-bottom-white border-[#808080] p-1.5 shadow-inner focus:outline-none cursor-pointer"
        >
          <option value="">Nenhum (Baixo no tom fundamental)</option>
          <option value="C">C</option>
          <option value="C#">C#</option>
          <option value="Db">Db</option>
          <option value="D">D</option>
          <option value="D#">D#</option>
          <option value="Eb">Eb</option>
          <option value="E">E</option>
          <option value="F">F</option>
          <option value="F#">F#</option>
          <option value="Gb">Gb</option>
          <option value="G">G</option>
          <option value="G#">G#</option>
          <option value="Ab">Ab</option>
          <option value="A">A</option>
          <option value="A#">A#</option>
          <option value="Bb">Bb</option>
          <option value="B">B</option>
        </select>
      </div>

      {/* Stats Counter */}
      <div className="bg-[#d4d0c8] p-1.5 border border-[#808080] flex justify-between items-center text-xs font-mono select-none">
        <div className="flex items-center gap-1.5">
          <span>Posições:</span>
          <span className="font-bold text-[#cc3300] bg-white border border-[#808080] px-1.5">{resultsCount}</span>
        </div>
        <button
          onClick={() => onChordChange("", "", "")}
          disabled={!selectedRootName && !selectedBassName}
          className="px-2 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          title="Limpar seleção de acordes"
        >
          Limpar
        </button>
      </div>

    </div>
  );
};
