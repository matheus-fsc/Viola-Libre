import React, { createContext, useContext, useEffect, useRef } from 'react';
import type { MelodyNote, MelodyStep } from './types';
import { getMelodySteps } from './helpers';

interface PlaybackContextType {
  // Subscription hooks/methods (e.g., for theory bubbles)
  subscribeToStepPlaying: (stepId: string, callback: (isPlaying: boolean) => void) => () => void;
  subscribeToPlayhead: (callback: (beat: number) => void) => () => void;
  getCurrentPlayingStepId: () => string | null;
  
  // States
  isPlayingMelody: boolean;
  setIsPlayingMelody: React.Dispatch<React.SetStateAction<boolean>>;
  bpm: number;
  setBpm: (bpm: number) => void;
  melody: MelodyNote[];
  setMelody: React.Dispatch<React.SetStateAction<MelodyNote[]>>;
  
  // Actions
  playNoteSound: (frequency: number, durationSec?: number) => void;
  ensureAudioContextActive?: () => Promise<void>;
  handlePlayMelody: () => Promise<void>;
  handleRestartMelody: () => void;
  seekToBeat: (beat: number, isInteractive?: boolean) => void;
  
  // Refs for UI/DOM direct manipulation (No React re-render cycle)
  playheadRef: React.RefObject<HTMLDivElement | null>;
  playheadHighlightRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isUserScrollingRef: React.RefObject<boolean>;
  noteRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  
  // Additional shared helpers
  stepPositions: (MelodyStep & { startBeat: number; width: number })[];
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};

// Custom hook to subscribe to the playing state of a specific step
export const useIsStepPlaying = (stepId: string) => {
  const context = usePlayback();
  const [isPlaying, setIsPlaying] = React.useState(false);
  
  useEffect(() => {
    // Sync initial state
    const currentPlayingStepId = context.getCurrentPlayingStepId();
    setIsPlaying(currentPlayingStepId === stepId);
    
    // Subscribe to updates
    return context.subscribeToStepPlaying(stepId, (playing) => {
      setIsPlaying(playing);
    });
  }, [context, stepId]);
  
  return isPlaying;
};

interface PlaybackProviderProps {
  melody: MelodyNote[];
  setMelody: React.Dispatch<React.SetStateAction<MelodyNote[]>>;
  isPlayingMelody: boolean;
  setIsPlayingMelody: React.Dispatch<React.SetStateAction<boolean>>;
  bpm: number;
  setBpm: (bpm: number) => void;
  playNoteSound: (frequency: number, durationSec?: number) => void;
  ensureAudioContextActive?: () => Promise<void>;
  children: React.ReactNode;
}

export const PlaybackProvider: React.FC<PlaybackProviderProps> = ({
  melody,
  setMelody,
  isPlayingMelody,
  setIsPlayingMelody,
  bpm,
  setBpm,
  playNoteSound,
  ensureAudioContextActive,
  children
}) => {
  // Refs for high performance playhead and scroll container (direct DOM mutation)
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const playheadHighlightRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<any>(null);
  
  // Cache for scroll container clientWidth to avoid Layout Thrashing (Layout reading inside animation frame)
  const containerWidthRef = useRef<number>(850);

  const updateHighlightToStep = (stepIdx: number) => {
    if (!playheadHighlightRef.current) return;
    if (stepIdx === -1 || !stepPositions[stepIdx]) {
      playheadHighlightRef.current.style.display = 'none';
    } else {
      const step = stepPositions[stepIdx];
      const startPx = 56 + step.startBeat * 120;
      const widthPx = (step.duration || 1.0) * 120;
      playheadHighlightRef.current.style.display = 'block';
      playheadHighlightRef.current.style.left = `${startPx}px`;
      playheadHighlightRef.current.style.width = `${widthPx}px`;
    }
  };
  
  // Dictionary to store DOM elements of NoteBadges directly (No React re-renders)
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeNoteIdsRef = useRef<string[]>([]);
  const activeFretboardIdsRef = useRef<string[]>([]);
  
  // Playback state refs for requestAnimationFrame and setTimeout loops
  const playbackTimeoutRef = useRef<any>(null);
  const currentStepIdxRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const playbackStartRealTimeRef = useRef<number>(0);
  const playbackStartBeatRef = useRef<number>(0);
  
  // Pub/Sub references for step playing state and playhead tick state
  const currentPlayingStepIdRef = useRef<string | null>(null);
  const stepSubscribersRef = useRef<Map<string, Set<(isPlaying: boolean) => void>>>(new Map());
  const playheadSubscribersRef = useRef<Set<(beat: number) => void>>(new Set());

  // Derive steps and stepPositions
  const steps = React.useMemo(() => getMelodySteps(melody), [melody]);
  const stepPositions = React.useMemo(() => {
    let currentBeat = 0;
    return steps.map((step) => {
      const pos = {
        ...step,
        startBeat: currentBeat,
        width: (step.duration || 1.0) * 120
      };
      currentBeat += step.duration || 1.0;
      return pos;
    });
  }, [steps]);

  // Sync scroll container clientWidth on load and window resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (scrollContainerRef.current) {
        containerWidthRef.current = scrollContainerRef.current.clientWidth;
      }
    };
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => {
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, [scrollContainerRef.current]);

  // Lock scroll when the user is scrolling the container natively
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 1000); // 1s lock timeout
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollContainerRef.current]);

  // Direct DOM note highlight updater function (Layout Thrashing free)
  const highlightNotesOfStep = (stepIdx: number) => {
    // 1. Remove playing CSS class from active notes
    activeNoteIdsRef.current.forEach((id) => {
      const el = noteRefs.current[id];
      if (el) {
        el.classList.remove('note-playing');
      }
    });
    activeNoteIdsRef.current = [];

    // 2. Remove playing CSS class from active fretboard cells
    activeFretboardIdsRef.current.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('fretboard-playing');
      }
    });
    activeFretboardIdsRef.current = [];

    // 3. Add playing CSS class to new step notes and fretboard cells
    let nextPlayingStepId: string | null = null;
    if (stepIdx >= 0 && stepIdx < steps.length) {
      const step = steps[stepIdx];
      if (step) {
        nextPlayingStepId = step.stepId;
        
        // Piano Roll Notes
        const newPlayingIds = step.notes.map((n) => n.id);
        newPlayingIds.forEach((id) => {
          const el = noteRefs.current[id];
          if (el) {
            el.classList.add('note-playing');
          }
        });
        activeNoteIdsRef.current = newPlayingIds;

        // Fretboard cells
        const newFretboardIds: string[] = [];
        step.notes.forEach((note) => {
          const fretboardId = `fretboard-cell-${note.stringIdx}-${note.fret}`;
          const el = document.getElementById(fretboardId);
          if (el) {
            el.classList.add('fretboard-playing');
            newFretboardIds.push(fretboardId);
          }
        });
        activeFretboardIdsRef.current = newFretboardIds;
      }
    }

    // 4. Notify step subscribers directly for step highlights (e.g. balloons)
    const prevPlayingStepId = currentPlayingStepIdRef.current;
    if (nextPlayingStepId !== prevPlayingStepId) {
      if (prevPlayingStepId) {
        const callbacks = stepSubscribersRef.current.get(prevPlayingStepId);
        if (callbacks) {
          callbacks.forEach(cb => cb(false));
        }
      }
      if (nextPlayingStepId) {
        const callbacks = stepSubscribersRef.current.get(nextPlayingStepId);
        if (callbacks) {
          callbacks.forEach(cb => cb(true));
        }
      }
      currentPlayingStepIdRef.current = nextPlayingStepId;
    }
  };

  // Subscribe to step playing status changes
  const subscribeToStepPlaying = (stepId: string, callback: (isPlaying: boolean) => void) => {
    if (!stepSubscribersRef.current.has(stepId)) {
      stepSubscribersRef.current.set(stepId, new Set());
    }
    stepSubscribersRef.current.get(stepId)!.add(callback);
    
    return () => {
      const subs = stepSubscribersRef.current.get(stepId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          stepSubscribersRef.current.delete(stepId);
        }
      }
    };
  };

  // Subscribe to raw playhead ticks (e.g., for scrubbing or custom UI)
  const subscribeToPlayhead = (callback: (beat: number) => void) => {
    playheadSubscribersRef.current.add(callback);
    return () => {
      playheadSubscribersRef.current.delete(callback);
    };
  };

  const getCurrentPlayingStepId = () => currentPlayingStepIdRef.current;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  // Sync playhead state if isPlayingMelody is turned off externally
  useEffect(() => {
    if (!isPlayingMelody) {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // Reset DOM highlights
      highlightNotesOfStep(-1);
    }
  }, [isPlayingMelody]);

  // Reset playhead index if melody is cleared or changes size
  useEffect(() => {
    currentStepIdxRef.current = 0;
    if (playheadRef.current) {
      playheadRef.current.style.transform = 'translateX(56px)';
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
    highlightNotesOfStep(-1);
    updateHighlightToStep(-1);
  }, [melody.length]);

  // Animate playhead movement using direct DOM manipulation for maximum efficiency (60fps)
  const updatePlayheadAnimation = () => {
    if (!playheadRef.current || !scrollContainerRef.current) return;
    
    const elapsedSeconds = (performance.now() - playbackStartRealTimeRef.current) / 1000;
    const currentBeat = playbackStartBeatRef.current + elapsedSeconds * (bpm / 60);
    const leftPx = 56 + currentBeat * 120;
    
    // Direct DOM write (avoids re-rendering the React tree)
    playheadRef.current.style.transform = `translateX(${leftPx}px)`;
    
    // Update step highlight
    const stepIdx = findStepIndexForBeat(currentBeat, stepPositions);
    updateHighlightToStep(stepIdx);
    
    // Notify subscribers
    playheadSubscribersRef.current.forEach(cb => cb(currentBeat));
    
    const container = scrollContainerRef.current;
    const targetScroll = leftPx - containerWidthRef.current / 2;
    
    // Auto-scroll only if user is not actively scrolling the grid
    if (!isUserScrollingRef.current) {
      if (targetScroll > 0) {
        container.scrollLeft = targetScroll;
      } else {
        container.scrollLeft = 0;
      }
    }
    
    animationFrameIdRef.current = requestAnimationFrame(updatePlayheadAnimation);
  };

  const playNextFromIndex = (stepIdx: number) => {
    if (stepIdx >= steps.length) {
      setIsPlayingMelody(false);
      currentStepIdxRef.current = 0;
      
      if (playheadRef.current) {
        playheadRef.current.style.transform = 'translateX(56px)';
      }
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      highlightNotesOfStep(-1);
      updateHighlightToStep(-1);
      return;
    }

    const step = steps[stepIdx];
    const currentStepPos = stepPositions[stepIdx];

    // Update direct DOM highlights for active step notes
    highlightNotesOfStep(stepIdx);

    const beatDurationSec = 60 / bpm;
    const stepDur = step.duration || 1.0;
    const durationInSeconds = stepDur * beatDurationSec;

    step.notes.forEach((note) => {
      if (note.freq > 0 && note.fret >= 0) {
        playNoteSound(note.freq, durationInSeconds * 0.9);
      }
    });

    currentStepIdxRef.current = stepIdx + 1;
    playbackTimeoutRef.current = setTimeout(() => {
      playNextFromIndex(stepIdx + 1);
    }, durationInSeconds * 1000);
  };

  const handlePlayMelody = async () => {
    if (steps.length === 0) return;

    if (isPlayingMelody) {
      setIsPlayingMelody(false);
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      highlightNotesOfStep(-1);
      return;
    }

    if (ensureAudioContextActive) {
      await ensureAudioContextActive();
    }

    setIsPlayingMelody(true);

    if (currentStepIdxRef.current >= steps.length || currentStepIdxRef.current < 0) {
      currentStepIdxRef.current = 0;
    }

    const activeStep = stepPositions[currentStepIdxRef.current];
    const startBeat = activeStep ? activeStep.startBeat : 0;
    
    playbackStartBeatRef.current = startBeat;
    playbackStartRealTimeRef.current = performance.now();

    animationFrameIdRef.current = requestAnimationFrame(updatePlayheadAnimation);
    playNextFromIndex(currentStepIdxRef.current);
  };

  const handleRestartMelody = () => {
    currentStepIdxRef.current = 0;
    setIsPlayingMelody(false);
    
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (playheadRef.current) {
      playheadRef.current.style.transform = 'translateX(56px)';
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
    
    highlightNotesOfStep(-1);
    updateHighlightToStep(-1);
    playheadSubscribersRef.current.forEach(cb => cb(0));
  };

  const findStepIndexForBeat = (beat: number, stepsWithPos: typeof stepPositions) => {
    const index = stepsWithPos.findIndex(
      (step) => beat >= step.startBeat && beat < step.startBeat + (step.duration || 1.0)
    );
    if (index !== -1) return index;
    if (stepsWithPos.length > 0 && beat >= stepsWithPos[stepsWithPos.length - 1].startBeat) {
      return stepsWithPos.length - 1;
    }
    return 0;
  };

  const seekToBeat = (beat: number, isInteractive = false) => {
    if (steps.length === 0) return;
    
    let totalBeats = 0;
    stepPositions.forEach(s => {
      totalBeats += s.duration || 1.0;
    });

    const targetBeat = Math.max(0, Math.min(totalBeats, beat));
    const stepIdx = findStepIndexForBeat(targetBeat, stepPositions);
    
    currentStepIdxRef.current = stepIdx;
    
    const leftPx = 56 + targetBeat * 120;
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${leftPx}px)`;
    }
    
    if (isInteractive && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetScroll = leftPx - containerWidthRef.current / 2;
      container.scrollLeft = targetScroll > 0 ? targetScroll : 0;
    }
    
    playheadSubscribersRef.current.forEach(cb => cb(targetBeat));

    // Update active highlight classes directly
    highlightNotesOfStep(stepIdx);
    updateHighlightToStep(stepIdx);

    const step = stepPositions[stepIdx];

    if (isPlayingMelody) {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
      
      const remainingBeats = (step.startBeat + (step.duration || 1.0)) - targetBeat;
      const beatDurationSec = 60 / bpm;
      const remainingTimeSec = Math.max(0.01, remainingBeats * beatDurationSec);
      
      playbackStartBeatRef.current = targetBeat;
      playbackStartRealTimeRef.current = performance.now();
      
      if (step) {
        step.notes.forEach((note) => {
          if (note.freq > 0 && note.fret >= 0) {
            playNoteSound(note.freq, remainingTimeSec * 0.9);
          }
        });
      }
      
      currentStepIdxRef.current = stepIdx + 1;
      playbackTimeoutRef.current = setTimeout(() => {
        playNextFromIndex(stepIdx + 1);
      }, remainingTimeSec * 1000);
    }
  };

  return (
    <PlaybackContext.Provider
      value={{
        subscribeToStepPlaying,
        subscribeToPlayhead,
        getCurrentPlayingStepId,
        isPlayingMelody,
        setIsPlayingMelody,
        bpm,
        setBpm,
        melody,
        setMelody,
        playNoteSound,
        ensureAudioContextActive,
        handlePlayMelody,
        handleRestartMelody,
        seekToBeat,
        playheadRef,
        playheadHighlightRef,
        scrollContainerRef,
        isUserScrollingRef,
        noteRefs,
        stepPositions
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
