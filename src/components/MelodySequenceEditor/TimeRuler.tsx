import React from 'react';
import { usePlayback } from './PlaybackContext';

export const TimeRuler: React.FC = React.memo(() => {
  const { stepPositions, seekToBeat } = usePlayback();

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only allow left clicks
    
    // Use nativeEvent.offsetX to get position relative to the element without triggering layout reflow
    const startOffsetX = e.nativeEvent.offsetX;
    
    // Ignore clicks on the sticky left label area (0 to 56px)
    if (startOffsetX < 56) return;
    
    e.preventDefault();
    
    // Calculate initial beat and seek
    const startBeat = (startOffsetX - 56) / 120;
    seekToBeat(startBeat, true);

    const startClientX = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate delta relative to start drag position to avoid getBoundingClientRect() completely
      const deltaX = moveEvent.clientX - startClientX;
      const currentOffsetX = startOffsetX + deltaX;
      const beat = (currentOffsetX - 56) / 120;
      seekToBeat(beat, true);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      onMouseDown={handleMouseDown}
      className="cursor-ew-resize select-none"
    >
      {/* Section Markers Row */}
      <div className="flex h-5 bg-gradient-to-b from-[#f5f0e0] to-[#ebe5d3] border-b border-[#d4d0c8] shrink-0 font-mono text-[8px] font-bold select-none">
        {/* Sticky left offset to align with note labels */}
        <div className="sticky left-0 bg-[#ebe5d3] border-r border-[#d4d0c8] w-14 h-full shrink-0 z-20" />
        {stepPositions.map((step, sIdx) => {
          const prevSection = sIdx > 0 ? stepPositions[sIdx - 1].section : null;
          const isNewSection = step.section && step.section !== prevSection;
          return (
            <div 
              key={`section-${step.stepId}`}
              style={{ width: `${step.width}px` }}
              className={`shrink-0 h-full flex items-center px-1 relative ${
                isNewSection ? 'border-l-2 border-amber-500' : 'border-l border-transparent'
              }`}
            >
              {isNewSection && step.section && (
                <span className="text-amber-800 bg-amber-100/80 border border-amber-300 px-1.5 py-0.5 rounded-sm truncate max-w-full shadow-sm whitespace-nowrap">
                  {step.section}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Time Ruler (Régua de Tempo) */}
      <div className="flex h-6 bg-[#f1efe2] border-b border-[#808080] shrink-0 font-mono text-[9px] font-bold text-gray-600 select-none">
        {/* Sticky left offset header label */}
        <div className="sticky left-0 bg-[#ece9d8] border-r border-[#808080] w-14 h-full shrink-0 z-20 flex items-center justify-center text-[8px] text-gray-500 font-bold uppercase tracking-wider">
          Nota
        </div>
        {stepPositions.map((step) => (
          <div 
            key={`ruler-cell-${step.stepId}`}
            style={{ 
              width: `${step.width}px`,
              backgroundImage: 'linear-gradient(90deg, rgba(0, 0, 0, 0.15) 1px, transparent 1px)',
              backgroundSize: '30px 100%'
            }}
            className="shrink-0 h-full border-l border-gray-400 relative flex items-center pl-1.5 select-none"
          >
            <span className="relative z-10 font-mono text-[9px] text-[#404040]">
              {`T: ${step.startBeat.toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

TimeRuler.displayName = 'TimeRuler';
