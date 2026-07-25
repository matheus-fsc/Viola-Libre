import React from 'react';
import type { Voicing, Tuning } from '../engine/types';
import { useVisualizationStore } from '../stores/useVisualizationStore';

interface MiniFretboardProps {
  voicing: Voicing;
  tuning: Tuning;
  /** Largura total do SVG. A altura é derivada da janela de trastes do acorde. */
  width?: number;
  /** Distância vertical entre trastes. Fixa: o diagrama cresce, não achata. */
  fretSpacing?: number;
  /** Sobrepõe a preferência global de ordem de cordas. */
  forceInverted?: boolean;
}

/** Abaixo disso o diagrama vira uma tira sem contexto de braço. */
const MIN_WINDOW = 4;
/** Acima disso o acorde é impraticável e o desenho fica ilegível de tão esticado. */
const MAX_WINDOW = 7;

/**
 * Diagrama de acorde em miniatura — a versão de tooltip do FretboardDiagram.
 *
 * Mesma linguagem visual do diagrama grande (paleta, pestana, marcadores de corda
 * solta/abafada, ordem de cordas do useVisualizationStore), mas sem título, áudio,
 * favoritos ou textos de dificuldade: aqui cabe só o braço.
 *
 * A geometria deriva os paddings do raio do dedo, então nenhum ponto é cortado
 * pela borda do SVG — o desenho inline anterior fixava rPad=3 com dedos de raio
 * ~5.7 e comia as cordas das pontas.
 */
export const MiniFretboard: React.FC<MiniFretboardProps> = ({
  voicing,
  tuning,
  width = 92,
  fretSpacing = 15,
  forceInverted,
}) => {
  const { frets, barre } = voicing;
  const numStrings = tuning.strings.length;

  const stringOrder = useVisualizationStore(state => state.stringOrder);
  const isInverted = forceInverted !== undefined ? forceInverted : stringOrder === 'inverted';

  const frettedOnly = frets.filter(f => f > 0);
  const minFret = frettedOnly.length > 0 ? Math.min(...frettedOnly) : 1;
  const maxFret = frettedOnly.length > 0 ? Math.max(...frettedOnly) : MIN_WINDOW;

  // A janela acompanha a extensão real do acorde. O desenho anterior fixava 5
  // trastes a partir da mínima e descartava silenciosamente qualquer dedo que
  // sobrasse — acordes abertos como um G com baixo no 7 apareciam incompletos.
  const startFret = maxFret > MIN_WINDOW ? minFret : 1;
  const numFrets = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, maxFret - startFret + 1));
  const showNut = startFret === 1;

  // Paddings a partir do raio do dedo: a estimativa usa o espaçamento bruto, que
  // é sempre ≥ o espaçamento final, então a folga reservada nunca fica curta.
  const labelGutter = showNut ? 0 : 11;
  const rawSpacing = Math.max(width - labelGutter - 2, 1) / Math.max(numStrings - 1, 1);
  const dotR = Math.min(rawSpacing * 0.34, 5.5);
  const markerR = Math.min(dotR * 0.62, 3.4);

  // O +1 cobre o stroke do dedo, que pinta meio traço para fora do raio.
  const leftPad = labelGutter + dotR + 1;
  const rightPad = dotR + 1;
  const topPad = markerR * 2 + 4;
  const bottomPad = 2;

  const boardW = width - leftPad - rightPad;
  const boardH = numFrets * fretSpacing;
  const height = topPad + boardH + bottomPad;
  const stringSpacing = numStrings > 1 ? boardW / (numStrings - 1) : boardW;

  const getStringX = (index: number) => {
    const visualIndex = isInverted ? numStrings - 1 - index : index;
    return leftPad + visualIndex * stringSpacing;
  };
  const getFretY = (fret: number) => topPad + (fret - startFret + 0.5) * fretSpacing;
  const isInWindow = (fret: number) => fret >= startFret && fret < startFret + numFrets;

  const markerY = markerR + 1;
  const activeBarre = barre && isInWindow(barre.fret) ? barre : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      {/* Pestana: barra grossa quando o diagrama começa na casa 1, traço fino caso contrário */}
      {showNut ? (
        <rect x={leftPad} y={topPad - 2.5} width={boardW} height={2.5} fill="#000000" />
      ) : (
        <line x1={leftPad} y1={topPad} x2={leftPad + boardW} y2={topPad} stroke="#808080" strokeWidth={1} />
      )}

      {/* Trastes */}
      {Array.from({ length: numFrets }, (_, k) => (
        <line
          key={`fret-${k}`}
          x1={leftPad}
          y1={topPad + (k + 1) * fretSpacing}
          x2={leftPad + boardW}
          y2={topPad + (k + 1) * fretSpacing}
          stroke="#808080"
          strokeWidth={1}
        />
      ))}

      {/* Cordas — a espessura segue a corda física, não a posição na tela */}
      {Array.from({ length: numStrings }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={getStringX(i)}
          y1={topPad}
          x2={getStringX(i)}
          y2={topPad + boardH}
          stroke="#404040"
          strokeWidth={0.6 + (numStrings - 1 - i) * 0.12}
        />
      ))}

      {/* Número da casa inicial, quando o diagrama não começa na pestana */}
      {!showNut && (
        <text
          x={leftPad - dotR - 1}
          y={topPad + fretSpacing * 0.5}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={7}
          fontWeight="bold"
          fontFamily="monospace"
          fill="#cc3300"
        >
          {startFret}
        </text>
      )}

      {/* Cordas soltas (○) e abafadas (✕) acima da pestana */}
      {frets.map((fret, i) => {
        const x = getStringX(i);
        if (fret === 0) {
          return (
            <circle
              key={`open-${i}`}
              cx={x}
              cy={markerY}
              r={markerR}
              fill="none"
              stroke="#228b22"
              strokeWidth={1.2}
            />
          );
        }
        if (fret === -1) {
          const a = markerR * 0.8;
          return (
            <g key={`muted-${i}`} stroke="#cc3300" strokeWidth={1.2} strokeLinecap="round">
              <line x1={x - a} y1={markerY - a} x2={x + a} y2={markerY + a} />
              <line x1={x + a} y1={markerY - a} x2={x - a} y2={markerY + a} />
            </g>
          );
        }
        return null;
      })}

      {/* Pestana do dedo indicador */}
      {activeBarre && (() => {
        const x1 = getStringX(activeBarre.startString);
        const x2 = getStringX(activeBarre.endString);
        return (
          <rect
            x={Math.min(x1, x2) - dotR}
            y={getFretY(activeBarre.fret) - dotR * 0.62}
            width={Math.abs(x2 - x1) + dotR * 2}
            height={dotR * 1.24}
            rx={dotR * 0.62}
            fill="#0058e6"
            opacity={0.85}
          />
        );
      })()}

      {/* Dedos */}
      {frets.map((fret, i) => {
        if (fret <= 0 || !isInWindow(fret)) return null;
        const onBarre = !!activeBarre && fret === activeBarre.fret
          && i >= activeBarre.startString && i <= activeBarre.endString;
        return (
          <circle
            key={`finger-${i}`}
            cx={getStringX(i)}
            cy={getFretY(fret)}
            r={onBarre ? dotR * 0.6 : dotR}
            fill={onBarre ? '#ffffff' : '#0058e6'}
            stroke="#002fa7"
            strokeWidth={0.8}
          />
        );
      })}
    </svg>
  );
};
