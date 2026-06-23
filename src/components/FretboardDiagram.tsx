import React from 'react';
import type { Voicing, Tuning } from '../engine/types';
import { midiToNoteName } from '../engine/chordCalculator';

interface FretboardDiagramProps {
  voicing: Voicing;
  tuning: Tuning;
  chordName: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  useFlats?: boolean;
}

export const FretboardDiagram: React.FC<FretboardDiagramProps> = ({
  voicing,
  tuning,
  chordName,
  isFavorite = false,
  onToggleFavorite,
  useFlats = false
}) => {
  const { frets, notes, barre } = voicing;
  const numStrings = tuning.strings.length;

  // Determine fret range to display
  const frettedOnly = frets.filter(f => f > 0);
  const minFret = frettedOnly.length > 0 ? Math.min(...frettedOnly) : 1;
  const maxFret = frettedOnly.length > 0 ? Math.max(...frettedOnly) : 4;
  
  let startFret = 1;
  let numFretsToDisplay = 4;
  
  if (maxFret > 4) {
    startFret = minFret;
    // Ensure we show at least 4 frets
    const span = maxFret - minFret + 1;
    numFretsToDisplay = Math.max(4, span);
  }

  // Diagram metrics (SVG coordinates)
  const width = 160;
  const height = 200;
  const topPadding = 30;
  const bottomPadding = 25;
  const leftPadding = 30;
  const rightPadding = 20;

  const boardWidth = width - leftPadding - rightPadding;
  const boardHeight = height - topPadding - bottomPadding;

  const stringSpacing = boardWidth / (numStrings - 1);
  const fretSpacing = boardHeight / numFretsToDisplay;

  // Render helpers
  const getStringX = (index: number) => {
    // 0 index is lowest pitch string (rendered on the left), numStrings - 1 is highest pitch (rendered on the right)
    return leftPadding + index * stringSpacing;
  };

  const getFretY = (fretNum: number) => {
    if (fretNum < startFret) return topPadding;
    return topPadding + (fretNum - startFret + 0.5) * fretSpacing;
  };

  // Check if nut should be thick (if showing fret 1 at the top)
  const isNutVisible = startFret === 1;



  return (
    <div className="bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] shadow-sm p-4 w-[200px] flex flex-col items-center relative select-none">
      {/* Title bar of the chord card */}
      <div className="w-full flex justify-between items-center mb-2 px-1 border-b border-[#d4d0c8] pb-1">
        <span className="font-bold text-lg font-mono text-[#002fa7]">{chordName}</span>
        <button
          onClick={onToggleFavorite}
          className="cursor-pointer text-sm focus:outline-none hover:scale-110 transition-transform"
          title={isFavorite ? "Remover dos favoritos" : "Favoritar posição"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>

      {/* SVG Diagram */}
      <svg width={width} height={height} className="overflow-visible">
        {/* Draw Fretboard Background Grid */}
        
        {/* Nut (fret 0 line) */}
        {isNutVisible ? (
          <line
            x1={getStringX(0)}
            y1={topPadding}
            x2={getStringX(numStrings - 1)}
            y2={topPadding}
            stroke="#000000"
            strokeWidth="5"
            strokeLinecap="square"
          />
        ) : (
          <line
            x1={getStringX(0)}
            y1={topPadding}
            x2={getStringX(numStrings - 1)}
            y2={topPadding}
            stroke="#808080"
            strokeWidth="2"
          />
        )}

        {/* Fret Lines */}
        {Array.from({ length: numFretsToDisplay }).map((_, idx) => {
          const fretNum = startFret + idx;
          const y = topPadding + (idx + 1) * fretSpacing;
          return (
            <line
              key={`fret-${fretNum}`}
              x1={getStringX(0)}
              y1={y}
              x2={getStringX(numStrings - 1)}
              y2={y}
              stroke="#808080"
              strokeWidth="2"
            />
          );
        })}

        {/* Vertical String Lines */}
        {Array.from({ length: numStrings }).map((_, idx) => {
          const x = getStringX(idx);
          return (
            <line
              key={`string-${idx}`}
              x1={x}
              y1={topPadding}
              x2={x}
              y2={topPadding + boardHeight}
              stroke="#404040"
              strokeWidth={1.5 + (numStrings - 1 - idx) * 0.3} // make lower strings slightly thicker
            />
          );
        })}

        {/* Fret Number Label (e.g. 5ª on the left) */}
        {!isNutVisible && (
          <text
            x={leftPadding - 8}
            y={topPadding + fretSpacing * 0.6}
            textAnchor="end"
            fontSize="12"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#cc3300"
          >
            {startFret}ª
          </text>
        )}

        {/* Draw Open / Muted Indicators above Nut */}
        {frets.map((fret, idx) => {
          const x = getStringX(idx);
          const y = topPadding - 10;
          if (fret === 0) {
            // Open string circle
            return (
              <circle
                key={`open-${idx}`}
                cx={x}
                cy={y}
                r="4"
                fill="none"
                stroke="#228b22"
                strokeWidth="2"
              />
            );
          } else if (fret === -1) {
            // Muted string 'X'
            return (
              <g key={`muted-${idx}`}>
                <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke="#cc3300" strokeWidth="2" />
                <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke="#cc3300" strokeWidth="2" />
              </g>
            );
          }
          return null;
        })}

        {/* Draw Barre if applicable */}
        {barre && (
          <rect
            x={getStringX(barre.startString) - 5}
            y={getFretY(barre.fret) - 6}
            width={getStringX(barre.endString) - getStringX(barre.startString) + 10}
            height="12"
            rx="6"
            fill="#0058e6"
            opacity="0.85"
          />
        )}

        {/* Draw Pressed Frets Circles */}
        {frets.map((fret, idx) => {
          if (fret <= 0) return null;
          
          const x = getStringX(idx);
          const y = getFretY(fret);
          
          // Skip drawing individual circle if it's already covered by the barre
          // UNLESS it's the start or end of the barre, or has a different fret.
          const isBarreFret = barre && fret === barre.fret && idx >= barre.startString && idx <= barre.endString;

          return (
            <g key={`finger-${idx}`}>
              <circle
                cx={x}
                cy={y}
                r={isBarreFret ? "5" : "8"}
                fill={isBarreFret ? "#ffffff" : "#0058e6"}
                stroke="#002fa7"
                strokeWidth="1.5"
              />
              {!isBarreFret && (
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="#ffffff"
                  fontFamily="sans-serif"
                >
                  {notes[idx].replace('#', '♯').replace('b', '♭')}
                </text>
              )}
            </g>
          );
        })}

        {/* String Open Note Names at the bottom */}
        {tuning.strings.map((openMidi, idx) => {
          const x = getStringX(idx);
          const y = height - 5;
          const noteStr = midiToNoteName(openMidi, useFlats);
          return (
            <text
              key={`note-bottom-${idx}`}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="10"
              fontFamily="monospace"
              fill="#555555"
              fontWeight="bold"
            >
              {noteStr}
            </text>
          );
        })}
      </svg>

      {/* Info text at the bottom */}
      <div className="w-full text-center mt-2 border-t border-[#d4d0c8] pt-1">
        <div className="text-[10px] font-mono text-gray-600 flex justify-between">
          <span>Dificuldade:</span>
          <span className="font-bold text-black">{120 - voicing.score > 80 ? "Difícil" : 120 - voicing.score > 40 ? "Média" : "Fácil"}</span>
        </div>
        <div className="text-[9px] font-mono text-gray-500 text-left mt-0.5 truncate" title={voicing.notes.join(' ')}>
          Notas: {voicing.notes.filter(n => n !== 'X').join(', ')}
        </div>
      </div>
    </div>
  );
};
