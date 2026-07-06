import React from 'react';
import type { Voicing, Tuning } from '../engine/types';
import { midiToNoteName, getVoicingDifficulty } from '../engine/chordCalculator';
import { AudioEngine } from '../engine/AudioEngine';
import { StarIcon } from './Icons';

export const IconWarning: React.FC<{ className?: string }> = ({ className = "w-3 h-3" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M8 2l6 11H2L8 2z" fill="#ffcc00" stroke="#cc9900" strokeWidth="1"/>
    <line x1="8" y1="6" x2="8" y2="9" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="11" r="1" fill="#333"/>
  </svg>
);


export const IconNotepad: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M2.5 1.5h8l3 3v10h-11v-13z" fill="#ffffff" stroke="#333333" strokeWidth="1"/>
    <path d="M10.5 1.5v3h3" fill="#ece9d8" stroke="#333333" strokeWidth="1"/>
    <line x1="4.5" y1="6.5" x2="11.5" y2="6.5" stroke="#3a8bfb" strokeWidth="1"/>
    <line x1="4.5" y1="9.5" x2="11.5" y2="9.5" stroke="#3a8bfb" strokeWidth="1"/>
    <line x1="4.5" y1="12.5" x2="8.5" y2="12.5" stroke="#3a8bfb" strokeWidth="1"/>
    <circle cx="10.5" cy="11.5" r="1.5" fill="#cc3300"/>
    <path d="M11.5 8.5v3" stroke="#cc3300" strokeWidth="1"/>
  </svg>
);

export const IconAddDoc: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M1.5 1.5h7l3 3v4.5h-10v-7.5z" fill="#ffffff" stroke="#555555" strokeWidth="1"/>
    <path d="M8.5 1.5v3h3" fill="#ece9d8" stroke="#555555" strokeWidth="1"/>
    <line x1="3.5" y1="6.5" x2="8.5" y2="6.5" stroke="#3a8bfb" strokeWidth="1"/>
    <circle cx="11.5" cy="11.5" r="4" fill="#228b22" stroke="#1a6b1a" strokeWidth="1"/>
    <line x1="11.5" y1="9.5" x2="11.5" y2="13.5" stroke="#ffffff" strokeWidth="1.5"/>
    <line x1="9.5" y1="11.5" x2="13.5" y2="11.5" stroke="#ffffff" strokeWidth="1.5"/>
  </svg>
);

export const IconRemoveDoc: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M1.5 1.5h7l3 3v4.5h-10v-7.5z" fill="#ffffff" stroke="#555555" strokeWidth="1"/>
    <path d="M8.5 1.5v3h3" fill="#ece9d8" stroke="#555555" strokeWidth="1"/>
    <line x1="3.5" y1="6.5" x2="8.5" y2="6.5" stroke="#3a8bfb" strokeWidth="1"/>
    <circle cx="11.5" cy="11.5" r="4" fill="#cc3300" stroke="#992200" strokeWidth="1"/>
    <line x1="9.5" y1="11.5" x2="13.5" y2="11.5" stroke="#ffffff" strokeWidth="1.5"/>
  </svg>
);

export const IconCopy: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect x="5.5" y="1.5" width="8" height="10" fill="#ffffff" stroke="#808080" strokeWidth="1"/>
    <rect x="2.5" y="4.5" width="8" height="10" fill="#ffffff" stroke="#333333" strokeWidth="1"/>
    <line x1="4.5" y1="7.5" x2="8.5" y2="7.5" stroke="#c2d7f2" strokeWidth="1"/>
    <line x1="4.5" y1="10.5" x2="8.5" y2="10.5" stroke="#c2d7f2" strokeWidth="1"/>
  </svg>
);

export const IconTrash: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M3 3.5h10M6 3.5v-1.5h4v1.5" stroke="#333333" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M4.5 4.5h7l-1 9h-5l-1-9z" fill="#ece9d8" stroke="#333333" strokeWidth="1.2"/>
    <line x1="6.5" y1="6.5" x2="6.5" y2="11.5" stroke="#808080" strokeWidth="1"/>
    <line x1="8.5" y1="6.5" x2="8.5" y2="11.5" stroke="#808080" strokeWidth="1"/>
  </svg>
);

export const IconInfo: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <circle cx="8" cy="8" r="7" fill="#3a8bfb" stroke="#002fa7" strokeWidth="1"/>
    <rect x="7" y="7" width="2" height="5" fill="#ffffff" />
    <circle cx="8" cy="4.5" r="1.2" fill="#ffffff" />
  </svg>
);

export const IconEdit: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M11.5 1.5l3 3-8 8-3.5.5.5-3.5 8-8z" fill="#ffd24d" stroke="#9a6b00" strokeWidth="1" strokeLinejoin="round"/>
    <path d="M10 3l3 3" stroke="#9a6b00" strokeWidth="1"/>
  </svg>
);

export const IconShield: React.FC<{ className?: string; filled?: boolean }> = ({ className = "w-4 h-4", filled = false }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      d="M8 1.5l5.5 2v4c0 4-2.5 6-5.5 7-3-1-5.5-3-5.5-7v-4l5.5-2z"
      fill={filled ? "#228b22" : "#ece9d8"}
      stroke={filled ? "#1a6b1a" : "#808080"}
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {filled && (
      <path d="M5.5 8l1.7 1.7L10.5 6" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    )}
  </svg>
);

interface FretboardDiagramProps {
  voicing: Voicing;
  tuning: Tuning;
  chordName: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isInCifra?: boolean;
  onToggleCifra?: () => void;
  useFlats?: boolean;
  compact?: boolean;
  variationCurrentIndex?: number;
  variationTotal?: number;
  onNextVariation?: (e: React.MouseEvent) => void;
  onPrevVariation?: (e: React.MouseEvent) => void;
  variationLocked?: boolean;
  onInfoClick?: (e: React.MouseEvent) => void;
  infoActive?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
  onCurateClick?: (e: React.MouseEvent) => void;
  isCurated?: boolean;
  curateBusy?: boolean;
  onPromoteClick?: (e: React.MouseEvent) => void;
  onDemoteClick?: (e: React.MouseEvent) => void;
  canPromote?: boolean;
  canDemote?: boolean;
}

export const FretboardDiagram: React.FC<FretboardDiagramProps> = ({
  voicing,
  tuning,
  chordName,
  isFavorite = false,
  onToggleFavorite,
  isInCifra = false,
  onToggleCifra,
  useFlats = false,
  compact = false,
  variationCurrentIndex,
  variationTotal,
  onNextVariation,
  onPrevVariation,
  variationLocked = false,
  onInfoClick,
  infoActive = false,
  onEditClick,
  onCurateClick,
  isCurated = false,
  curateBusy = false,
  onPromoteClick,
  onDemoteClick,
  canPromote = false,
  canDemote = false
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

  const handlePlayChord = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const engine = AudioEngine.getInstance();
    await engine.ensureContext();

    let strumDelay = 0;
    for (let i = 0; i < numStrings; i++) {
      const fret = frets[i];
      if (fret === -1) continue;

      engine.playMidi(tuning.strings[i] + fret, 2.0, strumDelay);
      strumDelay += 0.035;
    }
  };

  return (
    <div
      onClick={handlePlayChord}
      className={(compact
      ? "bg-transparent text-black w-full flex flex-col items-center relative select-none p-0.5 sm:p-1 cursor-pointer hover:bg-gray-100 transition-colors rounded"
      : "bg-[#ece9d8] text-black border-2 border-white border-r-[#808080] border-bottom-[#808080] shadow-sm p-4 w-[200px] flex flex-col items-center relative select-none cursor-pointer hover:bg-[#e4dfc9] transition-colors"
    ) + (isCurated ? " ring-2 ring-[#228b22] ring-inset" : "")}>
      {isCurated && (
        <div className="absolute -top-1.5 -right-1.5 z-10 bg-[#228b22] border border-[#1a6b1a] rounded-full w-4 h-4 flex items-center justify-center shadow" title="Variação curada pelos Editores">
          <IconShield className="w-2.5 h-2.5" filled />
        </div>
      )}
      {/* Title bar of the chord card */}
      <div className="w-full flex justify-between items-center mb-1 sm:mb-2 px-1 border-b border-[#d4d0c8] pb-1">
        <span className={compact ? "font-bold text-sm sm:text-base md:text-lg font-mono text-[#002fa7]" : "font-bold text-lg font-mono text-[#002fa7]"}>{chordName}</span>
        <div className="flex gap-2 items-center">
          {onInfoClick && (
            <button
              onClick={onInfoClick}
              className={`cursor-pointer focus:outline-none hover:scale-110 transition-transform flex items-center justify-center ${infoActive ? 'scale-110 drop-shadow-md' : ''}`}
              title="Informações de Teoria (Tom)"
            >
              <IconInfo className="w-4 h-4" />
            </button>
          )}
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="cursor-pointer focus:outline-none hover:scale-110 transition-transform flex items-center justify-center"
              title="Modificar acorde no braço"
            >
              <IconEdit className="w-4 h-4" />
            </button>
          )}
          {onCurateClick && (
            <button
              onClick={onCurateClick}
              disabled={curateBusy}
              className="cursor-pointer focus:outline-none hover:scale-110 transition-transform flex items-center justify-center disabled:opacity-50"
              title={isCurated ? 'Variação curada pelos Editores' : 'Curar esta variação como recomendada'}
            >
              <IconShield className="w-4 h-4" filled={isCurated} />
            </button>
          )}
          {isCurated && (onPromoteClick || onDemoteClick) && (
            <div className="flex flex-col leading-none -my-1">
              <button
                onClick={onPromoteClick}
                disabled={!canPromote || curateBusy}
                className="cursor-pointer focus:outline-none hover:text-[#0058e6] disabled:opacity-25 disabled:cursor-default text-gray-600 text-[9px] leading-none"
                title="Priorizar esta variação (subir posição entre as curadas)"
              >
                ▲
              </button>
              <button
                onClick={onDemoteClick}
                disabled={!canDemote || curateBusy}
                className="cursor-pointer focus:outline-none hover:text-[#0058e6] disabled:opacity-25 disabled:cursor-default text-gray-600 text-[9px] leading-none"
                title="Baixar prioridade desta variação"
              >
                ▼
              </button>
            </div>
          )}
          {onToggleCifra && (
            <button
              onClick={onToggleCifra}
              className="cursor-pointer focus:outline-none hover:scale-110 transition-transform flex items-center justify-center"
              title={isInCifra ? "Remover da Cifra" : "Adicionar à Cifra"}
            >
              {isInCifra ? <IconRemoveDoc className="w-4 h-4" /> : <IconAddDoc className="w-4 h-4" />}
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={`cursor-pointer focus:outline-none hover:scale-110 transition-transform flex items-center justify-center ${isFavorite ? 'text-[#ff7f27]' : 'text-gray-500 hover:text-gray-700'}`}
              title={isFavorite ? "Remover dos favoritos" : "Favoritar posição"}
            >
              <StarIcon className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
            </button>
          )}
        </div>
      </div>

      {/* SVG Diagram */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={compact ? "overflow-visible w-full h-auto max-w-[104px] sm:max-w-[150px]" : "overflow-visible"}
      >
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

      {/* Info text at the bottom — hidden on mobile in compact mode to save vertical space */}
      <div className={`w-full text-center border-t border-[#d4d0c8] pt-1 ${compact ? 'mt-1 sm:mt-2' : 'mt-2'}`}>
        <div className={`${compact ? 'hidden sm:flex' : 'flex'} text-[10px] font-mono text-gray-600 justify-between items-center`}>
          <span>Dificuldade:</span>
          <span className="font-bold text-black">{getVoicingDifficulty(frets).label}</span>
        </div>
        {voicing.hasInteriorMute && (
          <div className={`${compact ? 'hidden sm:flex' : 'flex'} text-[9px] font-bold text-[#cc3300] font-mono mt-1 bg-[#ffcccc]/70 border border-[#cc3300] rounded px-1 py-0.5 text-center shadow-sm select-none items-center justify-center gap-1`}>
            <IconWarning className="w-3 h-3 text-[#cc3300]" />
            <span>Abafamento Interno</span>
          </div>
        )}
        <div className={`${compact ? 'hidden sm:block' : 'block'} text-[9px] font-mono text-gray-500 text-left mt-1.5 truncate`} title={voicing.notes.join(' ')}>
          Notas: {voicing.notes.filter(n => n !== 'X').join(', ')}
        </div>

        {variationTotal && variationTotal > 1 && variationCurrentIndex !== undefined && (variationLocked || (onNextVariation && onPrevVariation)) && (
          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 border-t border-[#ece9d8] bg-[#f5f5f5] px-1 rounded">
            {variationLocked ? (
              <span className="w-6" />
            ) : (
              <button
                onClick={onPrevVariation}
                className="px-2 py-0.5 text-[#0058e6] hover:bg-[#e0e0e0] font-bold text-[10px] rounded"
                title="Variação Anterior"
              >
                &lt;
              </button>
            )}
            <span className={`text-[9px] font-bold ${variationLocked ? 'text-[#cc3300]' : 'text-gray-700'}`}>
              {variationCurrentIndex + 1} / {variationTotal}
            </span>
            {variationLocked ? (
              <span className="w-6" />
            ) : (
              <button
                onClick={onNextVariation}
                className="px-2 py-0.5 text-[#0058e6] hover:bg-[#e0e0e0] font-bold text-[10px] rounded"
                title="Próxima Variação"
              >
                &gt;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
