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

// --- Instrument Voice Interface (Strategy Pattern) ---

export interface InstrumentVoice {
  /** Unique identifier for this voice type */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Play a note at the given frequency for the given duration */
  play(ctx: AudioContext, frequency: number, durationSec: number): void;
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

  play(ctx: AudioContext, frequency: number, durationSec: number): void {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = this.waveType;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    const now = ctx.currentTime;
    const safeDuration = Math.max(durationSec, this.attackTime + this.releaseTime + 0.01);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(this.maxGain, now + this.attackTime);
    gainNode.gain.setValueAtTime(this.maxGain, now + safeDuration - this.releaseTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + safeDuration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + safeDuration);
  }
}

/** Plucked string voice (simulates a guitar/viola string pluck) */
export class PluckedStringVoice implements InstrumentVoice {
  readonly id = 'plucked-string';
  readonly name = 'Corda Dedilhada';

  play(ctx: AudioContext, frequency: number, durationSec: number): void {
    const now = ctx.currentTime;
    const safeDuration = Math.max(durationSec, 0.15);

    // Fundamental oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, now);

    // Slight harmonic overtone
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, now);

    // Gain nodes
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const masterGain = ctx.createGain();

    // Pluck envelope: sharp attack, fast decay, gentle release
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.15, now + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + safeDuration);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + safeDuration * 0.5);

    masterGain.gain.setValueAtTime(1, now);

    // Filter to darken the sound over time (like a real string)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 6, now);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + safeDuration);
    filter.Q.setValueAtTime(1, now);

    // Connect
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + safeDuration);
    osc2.stop(now + safeDuration);
  }
}

// --- Registry of available voices ---

const VOICE_REGISTRY: InstrumentVoice[] = [
  new OscillatorVoice(),
  new OscillatorVoice({ waveType: 'sine', maxGain: 0.25 }),
  new OscillatorVoice({ waveType: 'square', maxGain: 0.15 }),
  new OscillatorVoice({ waveType: 'sawtooth', maxGain: 0.15 }),
  new PluckedStringVoice(),
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
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  playNote(frequency: number, durationSec: number = 0.4): void {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.voice.play(this.ctx, frequency, durationSec);
    } catch (err) {
      console.error('AudioEngine: Erro ao reproduzir nota:', err);
    }
  }

  /** Play a note by MIDI number */
  playMidi(midi: number, durationSec: number = 0.4): void {
    const freq = AudioEngine.midiToFrequency(midi);
    this.playNote(freq, durationSec);
  }
}
