import React from 'react';

interface ChordFinderProps {
  selectedRootName: string;
  selectedSuffix: string;
  selectedBassName: string;
  selectedCustomNotes: number[];
  onChordChange: (rootName: string, suffix: string, bassName: string, customNotes: number[]) => void;
  resultsCount: number;
}

function parseSuffix(suffix: string) {
  let quality: 'M' | 'm' | 'sus4' | 'sus2' | 'dim' | 'aug';
  let seventh: 'none' | '7' | 'Maj7' | '6' = 'none';
  let has9 = false;
  let hasb5 = false;

  if (suffix.includes('m7(b5)(9)')) {
    quality = 'm';
    seventh = '7';
    hasb5 = true;
    has9 = true;
  } else if (suffix.includes('m7(b5)')) {
    quality = 'm';
    seventh = '7';
    hasb5 = true;
  } else if (suffix.startsWith('m')) {
    quality = 'm';
    if (suffix === 'm7') {
      seventh = '7';
    } else if (suffix === 'm(Maj7)') {
      seventh = 'Maj7';
    } else if (suffix === 'm(add9)') {
      has9 = true;
    } else if (suffix === 'm7(9)') {
      seventh = '7';
      has9 = true;
    } else if (suffix === 'm(Maj7)(9)') {
      seventh = 'Maj7';
      has9 = true;
    } else if (suffix === 'm6') {
      seventh = '6';
    } else if (suffix === 'm6(9)') {
      seventh = '6';
      has9 = true;
    }
  } else if (suffix.startsWith('sus4')) {
    quality = 'sus4';
    if (suffix.includes('7')) seventh = '7';
  } else if (suffix.startsWith('7sus4')) {
    quality = 'sus4';
    seventh = '7';
  } else if (suffix.startsWith('sus2')) {
    quality = 'sus2';
  } else if (suffix.startsWith('dim')) {
    quality = 'dim';
    if (suffix === 'dim7') seventh = '7';
  } else if (suffix.startsWith('aug') || suffix === '7(#5)') {
    quality = 'aug';
    if (suffix.includes('7')) seventh = '7';
  } else {
    // Major quality
    quality = 'M';
    if (suffix === '7') {
      seventh = '7';
    } else if (suffix === 'Maj7') {
      seventh = 'Maj7';
    } else if (suffix === '7(9)') {
      seventh = '7';
      has9 = true;
    } else if (suffix === 'Maj7(9)') {
      seventh = 'Maj7';
      has9 = true;
    } else if (suffix === 'add9') {
      has9 = true;
    } else if (suffix === '7(b5)(9)') {
      seventh = '7';
      hasb5 = true;
      has9 = true;
    } else if (suffix === '7(b5)') {
      seventh = '7';
      hasb5 = true;
    } else if (suffix === '6') {
      seventh = '6';
    } else if (suffix === '6(9)') {
      seventh = '6';
      has9 = true;
    }
  }

  return { quality, seventh, has9, hasb5 };
}

function getSuffixFromBuilder(
  quality: 'M' | 'm' | 'sus4' | 'sus2' | 'dim' | 'aug',
  seventh: 'none' | '7' | 'Maj7' | '6',
  has9: boolean,
  hasb5: boolean
): string {
  if (quality === 'm') {
    if (hasb5) {
      if (seventh === '7') {
        return has9 ? 'm7(b5)(9)' : 'm7(b5)';
      }
      return 'dim';
    }
    if (seventh === '7') {
      return has9 ? 'm7(9)' : 'm7';
    }
    if (seventh === 'Maj7') {
      return has9 ? 'm(Maj7)(9)' : 'm(Maj7)';
    }
    if (seventh === '6') {
      return has9 ? 'm6(9)' : 'm6';
    }
    return has9 ? 'm(add9)' : 'm';
  }
  
  if (quality === 'dim') {
    if (seventh === '7') return 'dim7';
    return 'dim';
  }
  
  if (quality === 'aug') {
    if (seventh === '7') return '7(#5)';
    return 'aug';
  }
  
  if (quality === 'sus4') {
    if (seventh === '7') return '7sus4';
    return 'sus4';
  }
  
  if (quality === 'sus2') {
    return 'sus2';
  }
  
  // Quality: 'M' (Maior)
  if (hasb5) {
    if (seventh === '7') {
      return has9 ? '7(b5)(9)' : '7(b5)';
    }
    return '';
  }
  if (seventh === '7') {
    return has9 ? '7(9)' : '7';
  }
  if (seventh === 'Maj7') {
    return has9 ? 'Maj7(9)' : 'Maj7';
  }
  if (seventh === '6') {
    return has9 ? '6(9)' : '6';
  }
  return has9 ? 'add9' : '';
}

export const ChordFinder: React.FC<ChordFinderProps> = ({
  selectedRootName,
  selectedSuffix,
  selectedBassName,
  selectedCustomNotes,
  onChordChange,
  resultsCount
}) => {
  const { quality, seventh, has9, hasb5 } = parseSuffix(selectedSuffix);

  const updateChord = (
    q: 'M' | 'm' | 'sus4' | 'sus2' | 'dim' | 'aug',
    s: 'none' | '7' | 'Maj7' | '6',
    n9: boolean,
    b5: boolean
  ) => {
    let targetSeventh = s;
    if ((q === 'sus2' || q === 'dim' || q === 'aug') && (s === 'Maj7' || s === '6')) {
      targetSeventh = 'none';
    }
    let targetB5 = b5;
    if (q !== 'M' && q !== 'm') {
      targetB5 = false;
    }
    const suffix = getSuffixFromBuilder(q, targetSeventh, n9, targetB5);
    onChordChange(selectedRootName, suffix, selectedBassName, selectedCustomNotes);
  };

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
      onChordChange("", selectedSuffix, selectedBassName, selectedCustomNotes);
    } else {
      onChordChange(targetName, selectedSuffix, selectedBassName, selectedCustomNotes);
    }
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

      {/* Suffix / Quality Grid (Modular Chord Builder) */}
      <div className="flex flex-col gap-2 p-2 bg-[#d4d0c8] border border-[#808080]">
        <span className="text-xs font-bold font-mono text-gray-700">Qualidade e Extensões:</span>
        
        {/* 1. Quality */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-gray-600 font-bold">Qualidade Tríade:</span>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'M', label: 'Maior' },
                { id: 'm', label: 'Menor' },
                { id: 'sus4', label: 'Sus4' },
                { id: 'sus2', label: 'Sus2' },
                { id: 'dim', label: 'Diminuto' },
                { id: 'aug', label: 'Aumentado' }
              ] as { id: 'M' | 'm' | 'sus4' | 'sus2' | 'dim' | 'aug'; label: string }[]
            ).map(q => (
              <button
                key={q.id}
                onClick={() => updateChord(q.id, seventh, has9, hasb5)}
                className={`text-xs font-mono py-1 border select-none cursor-pointer ${
                  quality === q.id
                    ? 'bg-gradient-to-b from-[#0058e6] to-[#3a8bfb] text-white border-[#002fa7] font-bold'
                    : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Seventh */}
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-[10px] font-mono text-gray-600 font-bold">Adicionar Sétima (7ª) ou Sexta (6):</span>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'none', label: 'Sem 7ª' },
                { id: '7', label: 'Dom (7)' },
                { id: 'Maj7', label: 'Maj7' },
                { id: '6', label: 'Sexta (6)' }
              ] as { id: 'none' | '7' | 'Maj7' | '6'; label: string }[]
            ).map(s => {
              const disabled =
                (s.id === '7' && quality === 'sus2') ||
                ((s.id === 'Maj7' || s.id === '6') && quality !== 'M' && quality !== 'm');
              return (
                <button
                  key={s.id}
                  disabled={disabled}
                  onClick={() => updateChord(quality, s.id, has9, hasb5)}
                  className={`text-xs font-mono py-1 border select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    seventh === s.id
                      ? 'bg-gradient-to-b from-[#0058e6] to-[#3a8bfb] text-white border-[#002fa7] font-bold'
                      : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Extensions (9th & b5) */}
        <div className="grid grid-cols-2 gap-1 mt-1">
          {/* Ninth */}
          <button
            disabled={quality !== 'M' && quality !== 'm'}
            onClick={() => updateChord(quality, seventh, !has9, hasb5)}
            className={`text-xs font-mono py-1 border select-none cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              has9
                ? 'bg-gradient-to-b from-[#0058e6] to-[#3a8bfb] text-white border-[#002fa7] font-bold'
                : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
            }`}
          >
            <input type="checkbox" checked={has9} disabled={quality !== 'M' && quality !== 'm'} readOnly className="pointer-events-none" />
            <span>Nona (9)</span>
          </button>

          {/* Flat 5 */}
          <button
            disabled={quality !== 'M' && quality !== 'm'}
            onClick={() => updateChord(quality, seventh, has9, !hasb5)}
            className={`text-xs font-mono py-1 border select-none cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              hasb5
                ? 'bg-gradient-to-b from-[#0058e6] to-[#3a8bfb] text-white border-[#002fa7] font-bold'
                : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080]'
            }`}
          >
            <input type="checkbox" checked={hasb5} disabled={quality !== 'M' && quality !== 'm'} readOnly className="pointer-events-none" />
            <span>Quinta Bemol (b5)</span>
          </button>
        </div>
      </div>

      {/* Notas Customizadas / Dissonâncias */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold font-mono text-gray-700 flex justify-between">
          <span>Adicionar Nota Customizada (Dissonância):</span>
          {selectedCustomNotes.length > 0 && <span className="text-[#cc3300] font-bold">+{selectedCustomNotes.length}</span>}
        </span>
        <div className="grid grid-cols-6 gap-1 p-1 bg-[#d4d0c8] border border-[#808080]">
          {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((noteName, idx) => {
            const active = selectedCustomNotes.includes(idx);
            return (
              <button
                key={noteName}
                onClick={() => {
                  let updated: number[];
                  if (active) {
                    updated = selectedCustomNotes.filter(n => n !== idx);
                  } else {
                    updated = [...selectedCustomNotes, idx];
                  }
                  onChordChange(selectedRootName, selectedSuffix, selectedBassName, updated);
                }}
                className={`text-xs font-mono py-1 border select-none cursor-pointer ${
                  active
                    ? 'bg-gradient-to-b from-[#ff9d00] to-[#ff5f00] text-white border-white font-bold'
                    : 'bg-[#ece9d8] hover:bg-white border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080]'
                }`}
              >
                {noteName}
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
          onChange={(e) => onChordChange(selectedRootName, selectedSuffix, e.target.value, selectedCustomNotes)}
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
          onClick={() => onChordChange("", "", "", [])}
          disabled={!selectedRootName && !selectedBassName && selectedCustomNotes.length === 0}
          className="px-2 py-0.5 bg-[#ece9d8] border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] hover:bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          title="Limpar seleção de acordes"
        >
          Limpar
        </button>
      </div>

    </div>
  );
};
