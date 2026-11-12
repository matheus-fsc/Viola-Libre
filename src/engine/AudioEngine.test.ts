import { afterEach, describe, expect, it, vi } from 'vitest';

// O download do soundfont é rede; aqui ele vira uma promessa que o teste resolve quando quer,
// para observar o que acontece com as notas pedidas enquanto ele não chega.
const soundfont = vi.hoisted(() => ({ instrument: vi.fn() }));
vi.mock('soundfont-player', () => ({ default: soundfont }));

import { AudioEngine, SoundFontVoice, type InstrumentVoice } from './AudioEngine';

afterEach(() => { soundfont.instrument.mockReset(); vi.unstubAllGlobals(); });

const ctx = { currentTime: 0 } as unknown as AudioContext;

function adiado<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej; });
  return { promessa, resolver, rejeitar };
}

describe('frequência', () => {
  it.each([[69, 440], [57, 220], [81, 880], [60, 261.6256]])('MIDI %d → %d Hz', (midi, hz) => {
    expect(AudioEngine.midiToFrequency(midi)).toBeCloseTo(hz, 3);
  });
});

describe('vozes', () => {
  it('ids únicos no registro', () => {
    const ids = AudioEngine.getAvailableVoices().map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('registrar uma voz com id já usado não duplica', () => {
    const antes = AudioEngine.getAvailableVoices().length;
    AudioEngine.registerVoice({ id: 'piano', name: 'outro piano', play: () => {} });
    expect(AudioEngine.getAvailableVoices()).toHaveLength(antes);
  });

  it('trocar de voz libera a anterior e toca na nova, na frequência do MIDI', () => {
    vi.stubGlobal('window', { AudioContext: class { state = 'running'; currentTime = 0; } });
    const engine = AudioEngine.getInstance();
    const anterior = engine.getVoice();
    const dispose = vi.spyOn(anterior as InstrumentVoice & { dispose(): void }, 'dispose');
    const nova = { id: 'teste', name: 'teste', play: vi.fn() };

    engine.setVoice(nova);
    engine.playMidi(69, 0.5, 0.1);

    expect(dispose).toHaveBeenCalledOnce();
    expect(nova.play).toHaveBeenCalledWith(expect.anything(), 440, 0.5, 0.1);
    engine.setVoice(anterior);
  });
});

describe('soundfont', () => {
  it('as notas de um acorde pedidas antes do download tocam todas quando ele chega', async () => {
    const download = adiado<{ play: ReturnType<typeof vi.fn> }>();
    soundfont.instrument.mockReturnValue(download.promessa);
    const voz = new SoundFontVoice('v', 'v', 'acoustic_guitar_nylon');

    // Mi maior no violão: seis cordas no mesmo clique.
    for (const midi of [40, 47, 52, 56, 59, 64]) voz.play(ctx, AudioEngine.midiToFrequency(midi), 1);
    expect(soundfont.instrument).toHaveBeenCalledOnce();

    const player = { play: vi.fn() };
    download.resolver(player);
    await vi.waitFor(() => expect(player.play).toHaveBeenCalledTimes(6));
    expect(player.play.mock.calls.map(c => c[0])).toEqual(['40', '47', '52', '56', '59', '64']);
  });

  it('carregado, toca direto sem baixar de novo', async () => {
    const player = { play: vi.fn() };
    soundfont.instrument.mockResolvedValue(player);
    const voz = new SoundFontVoice('v', 'v', 'piano' as never);
    await voz.load(ctx);
    voz.play(ctx, 440, 1, 0.25);
    expect(player.play).toHaveBeenCalledWith('69', 0.25, { duration: 1 });
    expect(soundfont.instrument).toHaveBeenCalledOnce();
  });

  // Offline no primeiro clique não pode condenar a voz para a sessão inteira.
  it('se o download falha, o próximo clique tenta de novo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    soundfont.instrument.mockRejectedValueOnce(new Error('offline'));
    const voz = new SoundFontVoice('v', 'v', 'piano' as never);
    await voz.load(ctx);

    const player = { play: vi.fn() };
    soundfont.instrument.mockResolvedValueOnce(player);
    await voz.load(ctx);
    voz.play(ctx, 440, 1);
    expect(player.play).toHaveBeenCalledOnce();
  });
});
