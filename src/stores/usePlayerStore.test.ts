import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from './usePlayerStore';
import { useCifraTextStore } from './useCifraTextStore';
import { useTimingSelectionStore } from './useTimingSelectionStore';

const iniciais = [usePlayerStore, useCifraTextStore, useTimingSelectionStore].map(s => s.getState());
beforeEach(() => {
  usePlayerStore.setState(iniciais[0] as ReturnType<typeof usePlayerStore.getState>, true);
  useCifraTextStore.setState(iniciais[1] as ReturnType<typeof useCifraTextStore.getState>, true);
  useTimingSelectionStore.setState(iniciais[2] as ReturnType<typeof useTimingSelectionStore.getState>, true);
  // Arraste e player ficam em variáveis do closure, fora do alcance do `setState`: só as
  // próprias ações os zeram.
  useCifraTextStore.getState().endChordDrag();
  usePlayerStore.getState().clearYtPlayer();
});
afterEach(() => { vi.useRealTimers(); });

const player = () => usePlayerStore.getState();

describe('player — mídia e duração', () => {
  it('carregar limpa o link do YouTube e zera o transporte', () => {
    usePlayerStore.setState({ currentTime: 50, isPlaying: true });
    player().setMediaUrlInput('  https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc  ');
    player().loadMedia();
    expect(player().mediaType).toBe('youtube');
    expect(player().mediaUrl).not.toContain('list=');
    expect(player()).toMatchObject({ currentTime: 0, isPlaying: false, playerReady: false });
  });

  it('campo vazio não carrega nada', () => {
    player().setMediaUrlInput('   ');
    player().loadMedia();
    expect(player().mediaUrl).toBe('');
  });

  it.each([
    ['3:05', 185, '3:05'],
    ['3:5', 185, '3:05'],
    ['0:00', 0, ''],
  ])('duração %j vira %d segundos (%j)', (entrada, segundos, exibido) => {
    player().setDurationInput(entrada);
    player().commitDuration();
    expect(player()).toMatchObject({ duration: segundos, durationInput: exibido });
  });

  it('duração sem «:» é ignorada', () => {
    player().setDuration(100);
    player().setDurationInput('185');
    player().commitDuration();
    expect(player().duration).toBe(100);
  });

  it('player desmontado zera o tempo; montado adota a duração detectada', () => {
    usePlayerStore.setState({ currentTime: 30, isPlaying: true });
    player().setPlayerReady(false);
    expect(player()).toMatchObject({ currentTime: 0, isPlaying: false });
    player().setPlayerReady(true, 200);
    expect(player()).toMatchObject({ playerReady: true, duration: 200 });
  });
});

describe('player — transporte', () => {
  it('prévia de trecho pausa sozinha ao chegar no fim', () => {
    player().previewRange(10, 20);
    expect(player()).toMatchObject({ currentTime: 10, isPlaying: true });
    player().tick(15);
    expect(player().isPlaying).toBe(true);
    player().tick(20);
    expect(player().isPlaying).toBe(false);
  });

  it('o <audio> registrado recebe os comandos', () => {
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), currentTime: 0 };
    player().registerAudio(audio as unknown as HTMLAudioElement);
    player().play();
    player().seek(33);
    player().pause();
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(33);
    player().registerAudio(null);
  });

  it('o YouTube registrado é consultado a cada 250 ms, e parar de consultar ao limpar', () => {
    vi.useFakeTimers();
    const yt = { getCurrentTime: () => 7, destroy: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn() };
    player().registerYtPlayer(yt as never);
    vi.advanceTimersByTime(250);
    expect(player().currentTime).toBe(7);

    player().clearYtPlayer();
    usePlayerStore.setState({ currentTime: 0 });
    vi.advanceTimersByTime(1000);
    expect(player().currentTime).toBe(0);
    expect(yt.destroy).toHaveBeenCalledOnce();
  });
});

describe('player — tap tempo', () => {
  it('batidas a cada 500 ms dão 120 BPM', () => {
    vi.useFakeTimers();
    const agora = vi.spyOn(performance, 'now');
    [0, 500, 1000, 1500].forEach(t => { agora.mockReturnValue(t); player().registerTap(); });
    expect(player().bpm).toBe(120);
    agora.mockRestore();
  });

  // Uma pausa longa é o músico recomeçando, não um andamento de 20 BPM.
  it('depois de 2,5 s parado, recomeça a contagem', () => {
    vi.useFakeTimers();
    const agora = vi.spyOn(performance, 'now');
    [0, 1000].forEach(t => { agora.mockReturnValue(t); player().registerTap(); });
    vi.advanceTimersByTime(2600);
    [10_000, 10_500].forEach(t => { agora.mockReturnValue(t); player().registerTap(); });
    expect(player().bpm).toBe(120);
    agora.mockRestore();
  });
});

describe('texto da cifra — arrastar acorde', () => {
  const texto = () => useCifraTextStore.getState();
  const chords = [{ text: 'C', col: 0 }, { text: 'G', col: 8 }];

  it('arrasta o acorde pela largura do caractere e reescreve a linha', () => {
    texto().setLines(['C       G', 'letra da música']);
    texto().startChordDrag(0, 1, chords, 100, 10);
    texto().updateChordDrag(130);
    expect(texto().lines[0]).toBe('C          G');
    expect(texto().chordDragVisual).toEqual({ lineIdx: 0, currentCol: 11 });
    texto().endChordDrag();
    expect(texto().chordDragVisual).toBeNull();
  });

  it('não passa da coluna zero', () => {
    texto().setLines(['C       G']);
    texto().startChordDrag(0, 0, chords, 100, 10);
    texto().updateChordDrag(0);
    expect(texto().chordDragVisual?.currentCol).toBe(0);
  });

  it('mover sem arraste ativo não faz nada', () => {
    texto().setLines(['C']);
    texto().updateChordDrag(500);
    expect(texto().lines).toEqual(['C']);
  });
});

describe('seleção do editor de timing', () => {
  const sel = () => useTimingSelectionStore.getState();

  it('alternar o mesmo modo desliga; trocar de modo zera o gesto', () => {
    sel().toggleSelectionMode('loop');
    sel().setSelectionStart(3);
    sel().toggleSelectionMode('phrase');
    expect(sel()).toMatchObject({ selectionMode: 'phrase', selectionStart: null });
    sel().toggleSelectionMode('phrase');
    expect(sel().selectionMode).toBeNull();
  });
});
