import React, { useState } from 'react';

interface Note {
  name: string;
  symbol: string;
  freq: number;
  isSharp?: boolean;
}

const NATURAL_NOTES: Note[] = [
  { name: 'Dó', symbol: 'C', freq: 261.63 },
  { name: 'Ré', symbol: 'D', freq: 293.66 },
  { name: 'Mi', symbol: 'E', freq: 329.63 },
  { name: 'Fá', symbol: 'F', freq: 349.23 },
  { name: 'Sol', symbol: 'G', freq: 392.00 },
  { name: 'Lá', symbol: 'A', freq: 440.00 },
  { name: 'Si', symbol: 'B', freq: 493.88 },
];

const CHROMATIC_WHITE_NOTES: Note[] = [
  { name: 'Dó', symbol: 'C', freq: 261.63, isSharp: false },
  { name: 'Ré', symbol: 'D', freq: 293.66, isSharp: false },
  { name: 'Mi', symbol: 'E', freq: 329.63, isSharp: false },
  { name: 'Fá', symbol: 'F', freq: 349.23, isSharp: false },
  { name: 'Sol', symbol: 'G', freq: 392.00, isSharp: false },
  { name: 'Lá', symbol: 'A', freq: 440.00, isSharp: false },
  { name: 'Si', symbol: 'B', freq: 493.88, isSharp: false },
];

const CHROMATIC_BLACK_NOTES: { note: Note; leftOffset: number }[] = [
  { note: { name: 'Dó#', symbol: 'C#', freq: 277.18, isSharp: true }, leftOffset: 23 },
  { note: { name: 'Ré#', symbol: 'D#', freq: 311.13, isSharp: true }, leftOffset: 55 },
  { note: { name: 'Fá#', symbol: 'F#', freq: 369.99, isSharp: true }, leftOffset: 119 },
  { note: { name: 'Sol#', symbol: 'G#', freq: 415.30, isSharp: true }, leftOffset: 151 },
  { note: { name: 'Lá#', symbol: 'A#', freq: 466.16, isSharp: true }, leftOffset: 183 },
];

let audioCtx: AudioContext | null = null;

const playNoteSound = (frequency: number) => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Retro triangle waves
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  } catch (err) {
    console.error("Erro ao reproduzir som:", err);
  }
};

export const NaturalPiano: React.FC = () => {
  const [activeFreq, setActiveFreq] = useState<number | null>(null);

  const handlePlay = (freq: number) => {
    setActiveFreq(freq);
    playNoteSound(freq);
    setTimeout(() => {
      setActiveFreq(prev => (prev === freq ? null : prev));
    }, 300);
  };

  return (
    <div className="bg-[#d4d0c8] p-1 border border-[#808080] rounded shadow-inner flex flex-col gap-1.5 select-none font-mono">
      <div className="text-[10px] font-bold text-gray-700 flex justify-between items-center">
        <span>Teclado: Notas Naturais (Dó Ré Mi Fá Sol Lá Si)</span>
        <span className="bg-[#002fa7] text-white px-1.5 py-0.5 text-[9px] rounded font-bold">C D E F G A B</span>
      </div>
      
      <div className="flex bg-[#808080] p-1 gap-1 border border-white rounded shadow-inner">
        {NATURAL_NOTES.map((note) => {
          const isActive = activeFreq === note.freq;
          return (
            <button
              key={`natural-${note.symbol}`}
              onClick={() => handlePlay(note.freq)}
              className={`flex-1 h-20 flex flex-col justify-end items-center pb-1.5 rounded-b border border-gray-400 shadow cursor-pointer transition-colors ${
                isActive
                  ? 'bg-gradient-to-b from-[#3a8bfb] to-[#0058e6] text-white border-blue-800'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              <span className="text-[10px] font-bold">{note.name}</span>
              <span className="text-[9px] font-semibold opacity-60">({note.symbol})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ChromaticPiano: React.FC = () => {
  const [activeFreq, setActiveFreq] = useState<number | null>(null);

  const handlePlay = (freq: number) => {
    setActiveFreq(freq);
    playNoteSound(freq);
    setTimeout(() => {
      setActiveFreq(prev => (prev === freq ? null : prev));
    }, 300);
  };

  return (
    <div className="bg-[#d4d0c8] p-1 border border-[#808080] rounded shadow-inner flex flex-col gap-1.5 select-none font-mono">
      <div className="text-[10px] font-bold text-gray-700 flex justify-between items-center">
        <span>Teclado: Escala Cromática Completa (12 notas)</span>
        <span className="bg-[#cc3300] text-white px-1.5 py-0.5 text-[9px] rounded font-bold">12 Notas</span>
      </div>
      
      <div className="bg-[#808080] p-1 border border-white rounded shadow-inner flex justify-center">
        <div className="relative w-[222px] h-[90px] bg-[#808080]">
          
          {/* White Keys */}
          <div className="absolute top-0 left-0 right-0 bottom-0 flex gap-0.5">
            {CHROMATIC_WHITE_NOTES.map((note, index) => {
              const isActive = activeFreq === note.freq;
              return (
                <button
                  key={`chromatic-w-${index}`}
                  onClick={() => handlePlay(note.freq)}
                  style={{ width: '30px' }}
                  className={`shrink-0 h-full flex flex-col justify-end items-center pb-1.5 rounded-b border border-gray-400 shadow cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-gradient-to-b from-[#3a8bfb] to-[#0058e6] text-white border-blue-800 z-10'
                      : 'bg-white text-black hover:bg-gray-100 z-10'
                  }`}
                >
                  <span className="text-[9px] font-bold">{note.name}</span>
                  <span className="text-[8px] font-semibold opacity-60">({note.symbol})</span>
                </button>
              );
            })}
          </div>

          {/* Black Keys */}
          {CHROMATIC_BLACK_NOTES.map(({ note, leftOffset }) => {
            const isActive = activeFreq === note.freq;
            return (
              <button
                key={`chromatic-b-${note.symbol}`}
                onClick={() => handlePlay(note.freq)}
                style={{
                  left: `${leftOffset}px`,
                  width: '16px',
                  height: '50px',
                }}
                className={`absolute top-0 flex flex-col justify-end items-center pb-1 rounded-b shadow cursor-pointer transition-colors z-20 ${
                  isActive
                    ? 'bg-gradient-to-b from-[#ff9d00] to-[#ff5f00] text-white border border-orange-800'
                    : 'bg-black text-white hover:bg-gray-800 border border-black'
                }`}
                title={note.name}
              >
                <span className="text-[8px] font-bold leading-none">{note.name}</span>
                <span className="text-[7px] leading-none opacity-80">{note.symbol}</span>
              </button>
            );
          })}

        </div>
      </div>
    </div>
  );
};
