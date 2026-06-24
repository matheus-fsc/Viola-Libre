import React from 'react';
import { usePlayback } from './PlaybackContext';
import type { MelodyNote } from './types';

interface NoteBadgeProps {
  note: MelodyNote;
  flatIdx: number;
  isSelected: boolean;
  cellWidth: number;
  onDragStart: (flatIdx: number) => void;
  onDragEnd: () => void;
  onClick: (flatIdx: number) => void;
  onExtendDuration: (flatIdx: number, delta: number) => void;
  onOpenMenu: (e: React.MouseEvent, flatIdx: number) => void;
  onRemoveNote: (flatIdx: number) => void;
}

const NoteBadge = React.memo<NoteBadgeProps>(({
  note,
  flatIdx,
  isSelected,
  cellWidth,
  onDragStart,
  onDragEnd,
  onClick,
  onExtendDuration,
  onOpenMenu,
  onRemoveNote
}) => {
  const { noteRefs } = usePlayback();

  return (
    <div
      ref={(el) => {
        if (el) {
          noteRefs.current[note.id] = el;
        } else {
          delete noteRefs.current[note.id];
        }
      }}
      draggable
      onDragStart={(e) => {
        onDragStart(flatIdx);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onClick(flatIdx);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemoveNote(flatIdx);
      }}
      className={`flex items-center rounded-sm border py-0.5 px-1 font-mono select-none cursor-grab active:cursor-grabbing shadow-sm justify-between shrink-0 transition-all duration-150 ease-in-out w-full ${
        isSelected
          ? 'bg-[#0058e6] text-white border-[#002fa7] ring-1 ring-[#0058e6]'
          : 'bg-[#ece9d8] text-gray-800 border-gray-400 hover:bg-white hover:scale-[1.02] hover:shadow-md hover:border-[#0058e6]'
      }`}
      style={{ height: '26px' }}
      title={`Nota: ${note.noteName} | Duração: ${note.duration} | Clique com botão direito para excluir`}
    >
      {/* Left Stretch button: < */}
      {cellWidth >= 60 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExtendDuration(flatIdx, -0.25);
          }}
          className={`px-1 py-px bg-gray-300 hover:bg-gray-400 text-gray-800 text-[8px] font-bold rounded-sm cursor-pointer select-none shrink-0 border border-gray-400 active:scale-90 ${
            isSelected ? 'bg-white/20 text-white border-white/40 hover:bg-white/30' : ''
          }`}
          title="Diminuir duração (-1/4 tempo)"
        >
          &lt;
        </button>
      )}
      
      {/* Note Label */}
      <span className="font-bold text-[9px] truncate cursor-pointer flex-1 text-center select-none mx-1">
        {note.noteName}
      </span>
      
      {/* Drag Handle ::: */}
      {cellWidth >= 100 && (
        <span 
          className="text-[9px] font-bold text-gray-400 select-none px-0.5 shrink-0 cursor-grab"
          title="Arraste para mover no tempo ou transpor"
        >
          ::::
        </span>
      )}
      
      {/* Dropdown Action menu ▼ */}
      {cellWidth >= 80 && (
        <button
          onClick={(e) => onOpenMenu(e, flatIdx)}
          className={`hover:bg-black/10 px-1 py-0.5 rounded text-[8px] transition-colors cursor-pointer font-bold shrink-0 ${
            isSelected ? 'text-white' : 'text-gray-500'
          }`}
          title="Ações da Nota"
        >
          ▼
        </button>
      )}
      
      {/* Right Stretch button: > */}
      {cellWidth >= 60 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExtendDuration(flatIdx, 0.25);
          }}
          className={`px-1 py-px bg-gray-300 hover:bg-gray-400 text-gray-800 text-[8px] font-bold rounded-sm cursor-pointer select-none shrink-0 border border-gray-400 active:scale-90 ${
            isSelected ? 'bg-white/20 text-white border-white/40 hover:bg-white/30' : ''
          }`}
          title="Aumentar duração (+1/4 tempo)"
        >
          &gt;
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.isSelected === nextProps.isSelected &&
         prevProps.cellWidth === nextProps.cellWidth &&
         prevProps.note.noteName === nextProps.note.noteName &&
         prevProps.note.duration === nextProps.note.duration &&
         prevProps.flatIdx === nextProps.flatIdx;
});
NoteBadge.displayName = "NoteBadge";

interface NoteCellProps {
  stepId: string;
  midi: number;
  cellWidth: number;
  isHovered: boolean;
  isOver: boolean;
  cellNotes: { note: MelodyNote; flatIdx: number }[];
  selectedNoteIdx: number | null;
  draggedNoteIdx: number | null;
  setDraggedOverCell: (cell: { stepId: string; midi: number } | null) => void;
  handleMoveNoteToCell: (noteIdx: number, targetStepId: string, targetMidi: number) => void;
  handleCellClickToAddNote: (stepId: string, targetMidi: number) => void;
  handleNoteBadgeClick: (flatIdx: number) => void;
  handleExtendDuration: (flatIdx: number, delta: number) => void;
  handleOpenMenu: (e: React.MouseEvent, index: number) => void;
  handleRemoveMelodyNote: (index: number) => void;
  onDragStart: (flatIdx: number) => void;
  onDragEnd: () => void;
  setHoveredStepId: (stepId: string | null) => void;
  midiToNoteName: (midi: number, useFlats: boolean) => string;
  useFlats: boolean;
}

// Optimized cell wrapper that prevents playback re-renders entirely
const NoteCell = React.memo<NoteCellProps>(({
  stepId,
  midi,
  cellWidth,
  isHovered,
  isOver,
  cellNotes,
  selectedNoteIdx,
  draggedNoteIdx,
  setDraggedOverCell,
  handleMoveNoteToCell,
  handleCellClickToAddNote,
  handleNoteBadgeClick,
  handleExtendDuration,
  handleOpenMenu,
  handleRemoveMelodyNote,
  onDragStart,
  onDragEnd,
  setHoveredStepId,
  midiToNoteName,
  useFlats
}) => {
  return (
    <div
      style={{ 
        width: `${cellWidth}px`,
        backgroundImage: 'linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)',
        backgroundSize: '30px 100%'
      }}
      title={cellNotes.length === 0 ? `Adicionar nota: ${midiToNoteName(midi, useFlats)}` : undefined}
      className={`shrink-0 flex items-center px-1 border-r border-b border-dashed border-gray-200 relative group transition-colors duration-150 hover:bg-amber-100/55 ${
        isHovered ? 'bg-yellow-50/30' : ''
      } ${isOver ? 'bg-blue-100/60 border-blue-400 border-2' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (draggedNoteIdx !== null) {
          setDraggedOverCell({ stepId, midi });
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (draggedNoteIdx !== null) {
          setDraggedOverCell({ stepId, midi });
        }
      }}
      onDragLeave={() => {
        setDraggedOverCell(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggedOverCell(null);
        if (draggedNoteIdx !== null) {
          handleMoveNoteToCell(draggedNoteIdx, stepId, midi);
        }
      }}
      onClick={() => {
        if (cellNotes.length === 0) {
          handleCellClickToAddNote(stepId, midi);
        }
      }}
      onMouseEnter={() => setHoveredStepId(stepId)}
      onMouseLeave={() => setHoveredStepId(null)}
    >
      {cellNotes.map(({ note, flatIdx }) => {
        const isSelected = selectedNoteIdx === flatIdx;
        
        return (
          <NoteBadge
            key={`note-badge-${note.id}`}
            note={note}
            flatIdx={flatIdx}
            isSelected={isSelected}
            cellWidth={cellWidth}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={handleNoteBadgeClick}
            onExtendDuration={handleExtendDuration}
            onOpenMenu={handleOpenMenu}
            onRemoveNote={handleRemoveMelodyNote}
          />
        );
      })}
    </div>
  );
}, (prev, next) => {
  // Check static layout values
  if (prev.isHovered !== next.isHovered) return false;
  if (prev.isOver !== next.isOver) return false;
  if (prev.cellWidth !== next.cellWidth) return false;
  if (prev.useFlats !== next.useFlats) return false;
  
  // Check selection status changes for notes in this cell
  const prevSelected = prev.cellNotes.some(cn => cn.flatIdx === prev.selectedNoteIdx);
  const nextSelected = next.cellNotes.some(cn => cn.flatIdx === next.selectedNoteIdx);
  if (prevSelected !== nextSelected) return false;
  
  // Check notes configuration changes
  if (prev.cellNotes.length !== next.cellNotes.length) return false;
  for (let i = 0; i < prev.cellNotes.length; i++) {
    const pCN = prev.cellNotes[i];
    const nCN = next.cellNotes[i];
    if (pCN.flatIdx !== nCN.flatIdx) return false;
    if (pCN.note.id !== nCN.note.id) return false;
    if (pCN.note.noteName !== nCN.note.noteName) return false;
    if (pCN.note.duration !== nCN.note.duration) return false;
    if (pCN.note.stringIdx !== nCN.note.stringIdx) return false;
    if (pCN.note.fret !== nCN.note.fret) return false;
  }
  return true;
});
NoteCell.displayName = "NoteCell";

interface PianoRollGridProps {
  midiRange: number[];
  midiToNoteName: (midi: number, useFlats: boolean) => string;
  useFlats: boolean;
  noteLookup: Map<string, { note: MelodyNote; flatIdx: number }[]>;
  draggedNoteIdx: number | null;
  setDraggedNoteIdx: (idx: number | null) => void;
  draggedOverCell: { stepId: string; midi: number } | null;
  setDraggedOverCell: (cell: { stepId: string; midi: number } | null) => void;
  handleMoveNoteToCell: (noteIdx: number, targetStepId: string, targetMidi: number) => void;
  handleCellClickToAddNote: (stepId: string, targetMidi: number) => void;
  handleNoteBadgeClick: (flatIdx: number) => void;
  handleExtendDuration: (flatIdx: number, delta: number) => void;
  handleOpenMenu: (e: React.MouseEvent, index: number) => void;
  handleRemoveMelodyNote: (index: number) => void;
  selectedNoteIdx: number | null;
  hoveredStepId: string | null;
  setHoveredStepId: (stepId: string | null) => void;
}

export const PianoRollGrid: React.FC<PianoRollGridProps> = React.memo(({
  midiRange,
  midiToNoteName,
  useFlats,
  noteLookup,
  draggedNoteIdx,
  setDraggedNoteIdx,
  draggedOverCell,
  setDraggedOverCell,
  handleMoveNoteToCell,
  handleCellClickToAddNote,
  handleNoteBadgeClick,
  handleExtendDuration,
  handleOpenMenu,
  handleRemoveMelodyNote,
  selectedNoteIdx,
  hoveredStepId,
  setHoveredStepId
}) => {
  const { stepPositions, playNoteSound } = usePlayback();

  const handleDragEnd = () => {
    setDraggedNoteIdx(null);
    setDraggedOverCell(null);
  };

  return (
    <div className="flex flex-col bg-white shrink-0 relative divide-y divide-gray-200">
      {midiRange.map((midi) => {
        const noteName = midiToNoteName(midi, useFlats);
        const isBlack = (midi % 12) === 1 || (midi % 12) === 3 || (midi % 12) === 6 || (midi % 12) === 8 || (midi % 12) === 10;
        
        return (
          <div 
            key={`grid-row-${midi}`}
            className={`flex items-stretch h-9 shrink-0 ${isBlack ? 'bg-slate-50/55' : 'bg-white'}`}
          >
            {/* Sticky Left Header: Note Label styled like a Piano Key (click to play) */}
            <div 
              onClick={() => {
                const freq = 440 * Math.pow(2, (midi - 69) / 12);
                playNoteSound(freq, 0.5);
              }}
              className={`sticky left-0 w-14 shrink-0 z-20 border-r border-[#808080] flex items-center justify-between pl-1.5 font-bold text-[9px] shadow-[2px_0_4px_rgba(0,0,0,0.1)] border-b cursor-pointer select-none transition-colors duration-75 ${
                isBlack 
                  ? 'bg-[#2a2a2a] text-white border-gray-700 hover:bg-[#444] active:bg-[#555]' 
                  : 'bg-[#fffff8] text-gray-700 border-gray-200 hover:bg-[#e8e4d0] active:bg-[#ddd8c0]'
              }`}
              title={`Tocar ${noteName} (MIDI ${midi})`}
            >
              <span className="opacity-75">{noteName}</span>
              {isBlack && <div className="w-2.5 h-full bg-[#111] rounded-l-sm" />}
            </div>
            
            {/* Step Cells mapped to NoteCell components */}
            {stepPositions.map((step) => {
              const cellNotes = noteLookup.get(`${step.stepId}-${midi}`) || [];
              const isHovered = hoveredStepId === step.stepId;
              const isOver = draggedOverCell?.stepId === step.stepId && draggedOverCell?.midi === midi;
              
              return (
                <NoteCell
                  key={`cell-${step.stepId}-${midi}`}
                  stepId={step.stepId}
                  midi={midi}
                  cellWidth={step.width}
                  isHovered={isHovered}
                  isOver={isOver}
                  cellNotes={cellNotes}
                  selectedNoteIdx={selectedNoteIdx}
                  draggedNoteIdx={draggedNoteIdx}
                  setDraggedOverCell={setDraggedOverCell}
                  handleMoveNoteToCell={handleMoveNoteToCell}
                  handleCellClickToAddNote={handleCellClickToAddNote}
                  handleNoteBadgeClick={handleNoteBadgeClick}
                  handleExtendDuration={handleExtendDuration}
                  handleOpenMenu={handleOpenMenu}
                  handleRemoveMelodyNote={handleRemoveMelodyNote}
                  onDragStart={setDraggedNoteIdx}
                  onDragEnd={handleDragEnd}
                  setHoveredStepId={setHoveredStepId}
                  midiToNoteName={midiToNoteName}
                  useFlats={useFlats}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
PianoRollGrid.displayName = "PianoRollGrid";
