/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { MelodyNote, MelodyStep } from './types';
import { getMelodySteps } from './helpers';

// Helper function defined outside the component to bypass React Hook purity checks on render scope.
const getPlaybackNowMs = () => performance.now();

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
  ensureAudioContextActive?: () => Promise<AudioContext | null>;
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
  const currentPlayingId = context.getCurrentPlayingStepId();
  const [isPlaying, setIsPlaying] = React.useState(currentPlayingId === stepId);
  const [prevStepId, setPrevStepId] = React.useState(stepId);
  const [prevPlayingId, setPrevPlayingId] = React.useState(currentPlayingId);

  if (stepId !== prevStepId || currentPlayingId !== prevPlayingId) {
    setPrevStepId(stepId);
    setPrevPlayingId(currentPlayingId);
    setIsPlaying(currentPlayingId === stepId);
  }
  
  useEffect(() => {
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
  ensureAudioContextActive?: () => Promise<AudioContext | null>;
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
  // Derive steps and stepPositions purely at the start of the component to avoid "used before declared" issues.
  const steps = React.useMemo(() => getMelodySteps(melody), [melody]);
  const stepPositions = React.useMemo(() => {
    const positions: (MelodyStep & { startBeat: number; width: number })[] = [];
    let beatSum = 0;
    for (const step of steps) {
      positions.push({
        ...step,
        startBeat: beatSum,
        width: (step.duration || 1.0) * 120
      });
      beatSum += step.duration || 1.0;
    }
    return positions;
  }, [steps]);

  // Refs for high performance playhead and scroll container (direct DOM mutation)
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const playheadHighlightRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Cache for scroll container clientWidth to avoid Layout Thrashing (Layout reading inside animation frame)
  const containerWidthRef = useRef<number>(850);

  // Flag to ignore scroll events triggered programmatically by the auto-follow logic
  const programmaticScrollRef = useRef<boolean>(false);

  const setContainerScrollLeft = (value: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    programmaticScrollRef.current = true;
    container.scrollLeft = value;
    // Clear flag shortly after to allow genuine user scroll events
    setTimeout(() => { programmaticScrollRef.current = false; }, 50);
  };

  const updateHighlightToStep = useCallback((stepIdx: number) => {
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
  }, [stepPositions]);
  
  // Dictionary to store DOM elements of NoteBadges directly (No React re-renders)
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeNoteIdsRef = useRef<string[]>([]);
  const activeFretboardIdsRef = useRef<string[]>([]);
  
  // Playback state refs for requestAnimationFrame and setTimeout loops
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStepIdxRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const playbackStartRealTimeRef = useRef<number>(0);
  const playbackStartBeatRef = useRef<number>(0);
  // Audio timing base (optional). When available, audioCtxRef provides high-resolution audio clock.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackStartAudioTimeRef = useRef<number | null>(null);
  // Track last step index whose notes were triggered — used by the RAF-driven scheduler
  const lastPlayedStepIdxRef = useRef<number | null>(null);
  // Throttle debug logging from RAF to avoid console spam
  
  // Pub/Sub references for step playing state and playhead tick state
  const currentPlayingStepIdRef = useRef<string | null>(null);
  const stepSubscribersRef = useRef<Map<string, Set<(isPlaying: boolean) => void>>>(new Map());
  const playheadSubscribersRef = useRef<Set<(beat: number) => void>>(new Set());
  // Mirror isPlayingMelody in a ref so RAF callbacks see latest value (avoid stale closures)
  const isPlayingMelodyRef = useRef<boolean>(isPlayingMelody);
  React.useEffect(() => { isPlayingMelodyRef.current = isPlayingMelody; }, [isPlayingMelody]);

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
  }, [scrollContainerRef]);

  // Lock scroll when the user is scrolling the container natively
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
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
  }, [scrollContainerRef]);

  // Direct DOM note highlight updater function (Layout Thrashing free)
  const highlightNotesOfStep = useCallback((stepIdx: number) => {
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
  }, [steps]);

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
  }, [isPlayingMelody, highlightNotesOfStep]);

  // Reset playhead index if melody is cleared or changes size
  useEffect(() => {
    currentStepIdxRef.current = 0;
    lastPlayedStepIdxRef.current = null;
    if (playheadRef.current) {
      playheadRef.current.style.transform = 'translateX(56px)';
    }
    if (scrollContainerRef.current) {
      setContainerScrollLeft(0);
    }
    highlightNotesOfStep(-1);
    updateHighlightToStep(-1);
  }, [melody.length, highlightNotesOfStep, updateHighlightToStep]);

  // Animate playhead movement using direct DOM manipulation for maximum efficiency (60fps)
  const updatePlayheadAnimation = () => {
    // If refs aren't ready yet, schedule another frame to retry (refs may be set shortly after mount)
    if (!playheadRef.current || !scrollContainerRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(updatePlayheadAnimation);
      return;
    }
    
    // Use audio clock if available for tighter alignment with audio playback,
    // otherwise fallback to performance.now.
    let elapsedSeconds: number;
    if (audioCtxRef.current && playbackStartAudioTimeRef.current != null) {
      elapsedSeconds = audioCtxRef.current.currentTime - playbackStartAudioTimeRef.current;
    } else {
      elapsedSeconds = (getPlaybackNowMs() - playbackStartRealTimeRef.current) / 1000;
    }
    const currentBeat = playbackStartBeatRef.current + elapsedSeconds * (bpm / 60);
    const leftPx = 56 + currentBeat * 120;
    
    // Direct DOM write (avoids re-rendering the React tree)
    playheadRef.current.style.transform = `translateX(${leftPx}px)`;
    
    // Update step highlight and play notes on step boundary transitions
    const stepIdx = findStepIndexForBeat(currentBeat, stepPositions);
    updateHighlightToStep(stepIdx);
    
    // If playing and we moved to a new step, trigger audio highlights and note playback
    if (isPlayingMelodyRef.current && stepIdx !== lastPlayedStepIdxRef.current) {
      lastPlayedStepIdxRef.current = stepIdx;
      highlightNotesOfStep(stepIdx);
      const step = stepPositions[stepIdx];
      if (step) {
        const beatDurationSec = 60 / bpm;
        const stepDur = step.duration || 1.0;
        const durationInSeconds = stepDur * beatDurationSec;

        // If we have an AudioContext from ensureAudioContextActive, schedule notes on audio clock
        if (audioCtxRef.current && playbackStartAudioTimeRef.current != null) {
          const ctx = audioCtxRef.current;
          const stepStartAudioTime = playbackStartAudioTimeRef.current + (step.startBeat - playbackStartBeatRef.current) * beatDurationSec;
          const now = ctx.currentTime;
          const startTime = Math.max(stepStartAudioTime, now + 0.001);

          step.notes.forEach((note) => {
            if (note.freq > 0 && note.fret >= 0) {
              try {
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(note.freq, ctx.currentTime);

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.015);
                gainNode.gain.setValueAtTime(0.3, startTime + durationInSeconds - 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + durationInSeconds);

                osc.connect(gainNode);
                gainNode.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + durationInSeconds);
              } catch (err) {
                console.error('[PlaybackContext] error scheduling on audioCtx', err);
              }
            }
          });
        } else {
          // Fallback to playNoteSound prop if no audio context available
          step.notes.forEach((note) => {
            if (note.freq > 0 && note.fret >= 0) {
              playNoteSound(note.freq, durationInSeconds * 0.9);
            }
          });
        }
      }
    }
    
    // Notify subscribers
    playheadSubscribersRef.current.forEach(cb => cb(currentBeat));
    
    const targetScroll = leftPx - containerWidthRef.current / 2;
    
    // Auto-scroll only if user is not actively scrolling the grid
    if (!isUserScrollingRef.current) {
      const scrollVal = targetScroll > 0 ? targetScroll : 0;
      setContainerScrollLeft(scrollVal);
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
        setContainerScrollLeft(0);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      highlightNotesOfStep(-1);
      updateHighlightToStep(-1);
      return;
    }

    // Note playback is handled exclusively by the RAF (updatePlayheadAnimation)
    // to avoid double-triggering notes. playNextFromIndex only tracks step index.
    currentStepIdxRef.current = stepIdx + 1;
    const step = steps[stepIdx];
    const beatDurationSec = 60 / bpm;
    const stepDur = step.duration || 1.0;
    const durationInSeconds = stepDur * beatDurationSec;
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
      const maybe = await ensureAudioContextActive();
      if (maybe && typeof (maybe as AudioContext).currentTime === 'number') {
        const audioCtx = maybe as AudioContext;
        audioCtxRef.current = audioCtx;
        // Captura currentTime APÓS o resume para evitar agendar notas no passado
        playbackStartAudioTimeRef.current = audioCtx.currentTime;
      } else {
        audioCtxRef.current = null;
        playbackStartAudioTimeRef.current = null;
      }
    }

    setIsPlayingMelody(true);

    const activeStep = stepPositions[currentStepIdxRef.current];
    const startBeat = activeStep ? activeStep.startBeat : 0;
    
    playbackStartBeatRef.current = startBeat;
    playbackStartRealTimeRef.current = getPlaybackNowMs();
    // Reset last played index so the RAF-driven scheduler triggers the current step immediately
    lastPlayedStepIdxRef.current = currentStepIdxRef.current - 1;

    // Immediately center the playhead so UI focuses the red pointer
    const initialLeftPx = 56 + playbackStartBeatRef.current * 120;
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${initialLeftPx}px)`;
    }
    if (scrollContainerRef.current) {
      setContainerScrollLeft(initialLeftPx - containerWidthRef.current / 2);
    }

    animationFrameIdRef.current = requestAnimationFrame(updatePlayheadAnimation);
  };

  const handleRestartMelody = () => {
    currentStepIdxRef.current = 0;
    setIsPlayingMelody(false);
    lastPlayedStepIdxRef.current = null;
    
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
      setContainerScrollLeft(0);
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
      const targetScroll = leftPx - containerWidthRef.current / 2;
      setContainerScrollLeft(targetScroll > 0 ? targetScroll : 0);
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
