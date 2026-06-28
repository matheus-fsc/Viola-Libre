/**
 * AudioEngine.ts - Extensible Sound Engine with Instrument Strategy Pattern
 * 
 * Architecture:
 *   AudioEngine (singleton) → uses an InstrumentVoice (strategy)
 *   
 *   InstrumentVoice is an interface that any instrument can implement:
 *     - OscillatorVoice (default, Web Audio oscillator)
 *     - Future: SamplerVoice, SoundFontVoice, WavetableVoice, etc.
 * 
 * Usage:
 *   const engine = AudioEngine.getInstance();
 *   engine.playNote(440, 0.4);                    // Play A4 for 0.4s
 *   engine.playMidi(69, 0.4);                     // Play MIDI 69 (A4) for 0.4s
 *   engine.setVoice(new SamplerVoice(...));        // Switch instrument
 */

import Soundfont from 'soundfont-player';
import type { InstrumentName } from 'soundfont-player';

// --- Instrument Voice Interface (Strategy Pattern) ---

export interface InstrumentVoice {
  /** Unique identifier for this voice type */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Play a note at the given frequency for the given duration */
  play(ctx: AudioContext, frequency: number, durationSec: number, delaySec?: number): void;
  /** Optional: release resources when voice is swapped out */
  dispose?(): void;
}

// --- Built-in Voices ---

/** Default oscillator-based voice (triangle wave with envelope) */
export class OscillatorVoice implements InstrumentVoice {
  readonly id = 'oscillator-triangle';
  readonly name = 'Oscilador (Triângulo)';

  private waveType: OscillatorType;
  private attackTime: number;
  private releaseTime: number;
  private maxGain: number;

  constructor(options?: {
    waveType?: OscillatorType;
    attackTime?: number;
    releaseTime?: number;
    maxGain?: number;
  }) {
    this.waveType = options?.waveType ?? 'triangle';
    this.attackTime = options?.attackTime ?? 0.015;
    this.releaseTime = options?.releaseTime ?? 0.05;
    this.maxGain = options?.maxGain ?? 0.3;
  }

  play(ctx: AudioContext, frequency: number, durationSec: number, delaySec: number = 0): void {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = this.waveType;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    const start = ctx.currentTime + delaySec;
    const safeDuration = Math.max(durationSec, this.attackTime + this.releaseTime + 0.01);

    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(this.maxGain, start + this.attackTime);
    gainNode.gain.setValueAtTime(this.maxGain, start + safeDuration - this.releaseTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + safeDuration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + safeDuration);
  }
}

/** Plucked string voice (simulates a guitar/viola string pluck) */
export class PluckedStringVoice implements InstrumentVoice {
  readonly id = 'plucked-string';
  readonly name = 'Corda Dedilhada';

  play(ctx: AudioContext, frequency: number, durationSec: number, delaySec: number = 0): void {
    const start = ctx.currentTime + delaySec;
    const safeDuration = Math.max(durationSec, 0.15);

    // Fundamental oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, start);

    // Slight harmonic overtone
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, start);

    // Gain nodes
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const masterGain = ctx.createGain();

    // Pluck envelope: sharp attack, fast decay, gentle release
    gain1.gain.setValueAtTime(0, start);
    gain1.gain.linearRampToValueAtTime(0.35, start + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.15, start + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.001, start + safeDuration);

    gain2.gain.setValueAtTime(0, start);
    gain2.gain.linearRampToValueAtTime(0.12, start + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.001, start + safeDuration * 0.5);

    masterGain.gain.setValueAtTime(1, start);

    // Filter to darken the sound over time (like a real string)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 6, start);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, start + safeDuration);
    filter.Q.setValueAtTime(1, start);

    // Connect
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + safeDuration);
    osc2.stop(start + safeDuration);
  }
}

/** Realistic SoundFont MIDI Voice (Powered by soundfont-player) */
export class SoundFontVoice implements InstrumentVoice {
  readonly id: string;
  name: string;
  instrumentName: InstrumentName;
  private player: Soundfont.Player | null = null;
  private isLoading = false;

  constructor(id: string, name: string, instrumentName: InstrumentName) {
    this.id = id;
    this.name = name;
    this.instrumentName = instrumentName;
  }

  async load(ctx: AudioContext) {
    if (!this.player && !this.isLoading) {
      this.isLoading = true;
      try {
        this.player = await Soundfont.instrument(ctx, this.instrumentName);
      } catch (err) {
        console.error(`Failed to load soundfont ${this.instrumentName}`, err);
      }
      this.isLoading = false;
    }
  }

  play(ctx: AudioContext, frequency: number, durationSec: number, delaySec: number = 0): void {
    const midi = Math.round(12 * Math.log2(frequency / 440) + 69);

    if (this.player) {
      this.player.play(String(midi), ctx.currentTime + delaySec, { duration: durationSec });
    } else {
      void this.load(ctx).then(() => {
        this.player?.play(String(midi), ctx.currentTime + delaySec, { duration: durationSec });
      });
    }
  }

  dispose() {
    this.player = null;
  }
}

// --- Registry of available voices ---

const VOICE_REGISTRY: InstrumentVoice[] = [
  new SoundFontVoice('violao-nylon', 'Violão Nylon (Real)', 'acoustic_guitar_nylon'),
  new SoundFontVoice('violao-aco', 'Violão Aço (Real)', 'acoustic_guitar_steel'),
  new SoundFontVoice('piano', 'Piano (Real)', 'acoustic_grand_piano'),
  new SoundFontVoice('sanfona', 'Sanfona (Real)', 'accordion'),
  new PluckedStringVoice(),
  new OscillatorVoice(),
  new OscillatorVoice({ waveType: 'sine', maxGain: 0.25 }),
  new OscillatorVoice({ waveType: 'square', maxGain: 0.15 }),
  new OscillatorVoice({ waveType: 'sawtooth', maxGain: 0.15 }),
];

// --- Audio Engine Singleton ---

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private voice: InstrumentVoice;

  private constructor() {
    this.voice = VOICE_REGISTRY[0]; // Default: triangle oscillator
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /** Ensure the AudioContext is created and resumed (call on user gesture) */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /** Get the current instrument voice */
  getVoice(): InstrumentVoice {
    return this.voice;
  }

  /** Set a new instrument voice (strategy swap) */
  setVoice(voice: InstrumentVoice): void {
    if (this.voice.dispose) {
      this.voice.dispose();
    }
    this.voice = voice;
  }

  /** Get all registered voices */
  static getAvailableVoices(): readonly InstrumentVoice[] {
    return VOICE_REGISTRY;
  }

  /** Register a custom voice to the global registry */
  static registerVoice(voice: InstrumentVoice): void {
    if (!VOICE_REGISTRY.find(v => v.id === voice.id)) {
      VOICE_REGISTRY.push(voice);
    }
  }

  /** Convert MIDI note number to frequency (Hz) */
  static midiToFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** Play a note by frequency */
  playNote(frequency: number, durationSec: number = 0.4, delaySec: number = 0): void {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.voice.play(this.ctx, frequency, durationSec, delaySec);
    } catch (err) {
      console.error('AudioEngine: Erro ao reproduzir nota:', err);
    }
  }

  /** Play a note by MIDI number */
  playMidi(midi: number, durationSec: number = 0.4, delaySec: number = 0): void {
    const freq = AudioEngine.midiToFrequency(midi);
    this.playNote(freq, durationSec, delaySec);
  }
}
