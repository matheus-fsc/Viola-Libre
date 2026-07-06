import { create } from 'zustand';
import { detectMediaType, cleanYouTubeUrl, formatSeconds } from '../services/timingApi';
import type { MediaType } from '../services/timingApi';

// YT player instance — defined locally; component keeps Window extension via declare global
interface YTPlayerInstance {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

export interface PlayerState {
  // ── Reactive ──────────────────────────────────────────────────────────────
  mediaUrlInput: string;
  mediaUrl: string;
  mediaType: MediaType;
  playerReady: boolean;
  currentTime: number;
  duration: number;
  durationInput: string;
  bpm: number | null;
  isPlaying: boolean;

  // ── Media / URL ────────────────────────────────────────────────────────────
  setMediaUrlInput(v: string): void;
  /** Parses mediaUrlInput, normalises URL, commits mediaUrl + mediaType. */
  loadMedia(): void;

  // ── Duration / BPM ────────────────────────────────────────────────────────
  setDuration(n: number): void;
  setDurationInput(v: string): void;
  /** Parse current durationInput ("m:ss") and commit to duration. */
  commitDuration(): void;
  setBpm(bpm: number | null): void;

  // ── Transport ─────────────────────────────────────────────────────────────
  play(): void;
  pause(): void;
  seek(t: number): void;
  /** seek(start) + play + auto-pause at end. Called by preview-range buttons. */
  previewRange(start: number, end: number): void;

  // ── State updates from component effects ──────────────────────────────────
  /** Called by component onReady callbacks. Optionally sets duration if > 0. */
  setPlayerReady(ready: boolean, detectedDuration?: number): void;
  /** Called from polling intervals with current playback position. */
  tick(t: number): void;

  // ── Tap BPM ───────────────────────────────────────────────────────────────
  registerTap(): void;

  // ── DOM element registration (called from component useEffects) ────────────
  /** Passes YT player instance to the store; starts internal polling. */
  registerYtPlayer(player: YTPlayerInstance): void;
  /** Stops polling, destroys YT player, resets playerReady. */
  clearYtPlayer(): void;
  /** Registers the <audio> element so play/pause/seek can control it. */
  registerAudio(el: HTMLAudioElement | null): void;

  // ── Bulk load (community tab "Editar minha contribuição") ─────────────────
  loadContribution(c: {
    bpm: number | null;
    duration: number;
    mediaUrl?: string | null;
    mediaType?: MediaType;
  }): void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // Private mutable refs — NOT Zustand reactive state (no re-renders, no serialisation)
  let _ytPlayer: YTPlayerInstance | null = null;
  let _audio: HTMLAudioElement | null = null;
  let _pollingId: ReturnType<typeof setInterval> | null = null;
  let _previewEnd: number | null = null;
  let _tapTimes: number[] = [];
  let _tapResetTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    mediaUrlInput: '',
    mediaUrl: '',
    mediaType: null,
    playerReady: false,
    currentTime: 0,
    duration: 0,
    durationInput: '',
    bpm: null,
    isPlaying: false,

    setMediaUrlInput: (v) => set({ mediaUrlInput: v }),

    loadMedia: () => {
      const raw = get().mediaUrlInput.trim();
      if (!raw) return;
      const type = detectMediaType(raw);
      const url = type === 'youtube' ? cleanYouTubeUrl(raw) : raw;
      set({ mediaUrl: url, mediaUrlInput: url, mediaType: type, playerReady: false, currentTime: 0, isPlaying: false });
    },

    setDuration: (n) => set({ duration: n, durationInput: n > 0 ? formatSeconds(n) : '' }),

    setDurationInput: (v) => set({ durationInput: v }),

    commitDuration: () => {
      const parts = get().durationInput.split(':');
      if (parts.length !== 2) return;
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      const total = mins * 60 + secs;
      set({ duration: total, durationInput: total > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : '' });
    },

    setBpm: (bpm) => set({ bpm }),

    play: () => {
      _ytPlayer?.playVideo();
      _audio?.play().catch(() => {});
      set({ isPlaying: true });
    },

    pause: () => {
      _ytPlayer?.pauseVideo();
      _audio?.pause();
      set({ isPlaying: false });
    },

    seek: (t) => {
      _ytPlayer?.seekTo(t, true);
      if (_audio) _audio.currentTime = t;
      set({ currentTime: t });
    },

    previewRange: (start, end) => {
      _previewEnd = end;
      get().seek(start);
      get().play();
    },

    setPlayerReady: (ready, detectedDuration) => {
      const patch: Partial<PlayerState> = { playerReady: ready };
      if (!ready) { patch.currentTime = 0; patch.isPlaying = false; }
      if (detectedDuration != null && detectedDuration > 0) {
        patch.duration = detectedDuration;
        patch.durationInput = formatSeconds(detectedDuration);
      }
      set(patch);
    },

    tick: (t) => {
      set({ currentTime: t });
      if (_previewEnd != null && t >= _previewEnd) {
        _previewEnd = null;
        get().pause();
      }
    },

    registerTap: () => {
      const now = performance.now();
      _tapTimes.push(now);
      if (_tapTimes.length > 8) _tapTimes.shift();
      if (_tapResetTimer) clearTimeout(_tapResetTimer);
      _tapResetTimer = setTimeout(() => { _tapTimes = []; }, 2500);
      if (_tapTimes.length >= 2) {
        let sum = 0;
        for (let i = 1; i < _tapTimes.length; i++) sum += _tapTimes[i] - _tapTimes[i - 1];
        set({ bpm: Math.round(60000 / (sum / (_tapTimes.length - 1))) });
      }
    },

    registerYtPlayer: (player) => {
      _ytPlayer = player;
      // Start internal polling — cleared by clearYtPlayer on unmount / media change
      if (_pollingId) clearInterval(_pollingId);
      _pollingId = setInterval(() => {
        if (!_ytPlayer) return;
        get().tick(_ytPlayer.getCurrentTime());
      }, 250);
    },

    clearYtPlayer: () => {
      if (_pollingId) { clearInterval(_pollingId); _pollingId = null; }
      try { _ytPlayer?.destroy(); } catch { /* player may already be gone */ }
      _ytPlayer = null;
    },

    registerAudio: (el) => { _audio = el; },

    loadContribution: (c) => {
      const patch: Partial<PlayerState> = {
        bpm: c.bpm,
        duration: c.duration,
        durationInput: c.duration > 0 ? formatSeconds(c.duration) : '',
      };
      if (c.mediaUrl) {
        patch.mediaUrl = c.mediaUrl;
        patch.mediaUrlInput = c.mediaUrl;
        patch.mediaType = c.mediaType ?? null;
      }
      set(patch);
    },
  };
});
