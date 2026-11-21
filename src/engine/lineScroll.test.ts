import { describe, expect, it } from 'vitest';
import { currentPhraseIndex, stepTimeAtY, stepYAtTime, withoutFingerpicking } from './lineScroll';

const phrase = (lineIndex: number, startTime: number, endTime: number) => ({ lineIndex, startTime, endTime });

describe('withoutFingerpicking', () => {
  it('remove a frase de tab no meio e preserva as durações das outras frases', () => {
    expect(withoutFingerpicking(
      [phrase(0, 1, 3), phrase(1, 4, 7), phrase(3, 9, 12)],
      ['lyric', 'tab', 'chord', 'lyric'],
    )).toEqual({ phrases: [phrase(0, 1, 3), phrase(3, 6, 9)], removedDuration: 3 });
  });

  it('une as durações de um bloco consecutivo com o vão entre letras', () => {
    expect(withoutFingerpicking(
      [phrase(0, 2, 5), phrase(1, 6, 10), phrase(2, 9, 11), phrase(3, 13, 17)],
      ['lyric', 'tab', 'tab', 'lyric'],
    )).toEqual({ phrases: [phrase(0, 2, 5), phrase(3, 5, 9)], removedDuration: 8 });
  });

  it('remove o vão de tablatura entre letras mesmo sem frases de tab', () => {
    expect(withoutFingerpicking(
      [phrase(0, 0, 4), phrase(3, 11, 15)], ['lyric', 'tab', 'tab', 'lyric'],
    )).toEqual({ phrases: [phrase(0, 0, 4), phrase(3, 4, 8)], removedDuration: 7 });
  });

  it('remove tabs no início e no fim sem tirar as outras pausas', () => {
    expect(withoutFingerpicking(
      [phrase(0, 0, 2), phrase(1, 4, 8), phrase(2, 9, 12), phrase(3, 13, 18)],
      ['tab', 'lyric', 'lyric', 'tab'],
    )).toEqual({ phrases: [phrase(1, 2, 6), phrase(2, 7, 10)], removedDuration: 7 });
  });

  it('mantém a introdução só de acordes e corta apenas o riff em tablatura', () => {
    // Caso da Regra Três com um riff: "[Intro] Dm7 G7 Am7" é linha de acorde, tocada no
    // "sem dedilhado"; só o trecho escrito como tab sai da linha do tempo.
    expect(withoutFingerpicking(
      [phrase(0, 0, 11), phrase(2, 11, 16), phrase(3, 16, 24), phrase(5, 24, 28)],
      ['chord', 'section', 'lyric', 'tab', 'chord', 'lyric'],
    )).toEqual({ phrases: [phrase(0, 0, 11), phrase(2, 11, 16), phrase(5, 16, 20)], removedDuration: 8 });
  });

  it('devolve as mesmas frases quando não há tabs', () => {
    const phrases = [phrase(2, 7, 10), phrase(0, 0, 4)];
    expect(withoutFingerpicking(phrases, ['lyric', 'instrumental', 'lyric']))
      .toEqual({ phrases, removedDuration: 0 });
  });

  it('calcula os cortes em ordem cronológica sem reordenar ou alterar a entrada', () => {
    const phrases = [phrase(2, 8, 10), phrase(0, 1, 3), phrase(1, 4, 7)];
    expect(withoutFingerpicking(phrases, ['lyric', 'tab', 'lyric']))
      .toEqual({ phrases: [phrase(2, 3, 5), phrase(0, 1, 3)], removedDuration: 5 });
    expect(phrases).toEqual([phrase(2, 8, 10), phrase(0, 1, 3), phrase(1, 4, 7)]);
  });
});

const anchors = [
  { startTime: 12, endTime: 15, y: 430 },
  { startTime: 2, endTime: 3, y: 100 },
  { startTime: 5, endTime: 8, y: 250 },
];

describe('currentPhraseIndex', () => {
  it('seleciona pelo início em dados fora de ordem e mantém a frase durante as pausas', () => {
    expect(currentPhraseIndex(anchors, 1.99)).toBe(-1);
    expect(currentPhraseIndex(anchors, 2)).toBe(1);
    expect(currentPhraseIndex(anchors, 4)).toBe(1);
    expect(currentPhraseIndex(anchors, 5)).toBe(2);
    expect(currentPhraseIndex(anchors, 11.99)).toBe(2);
    expect(currentPhraseIndex(anchors, 12)).toBe(0);
    expect(currentPhraseIndex(anchors, 20)).toBe(0);
    expect(currentPhraseIndex([], 2)).toBe(-1);
  });
});

describe('stepYAtTime', () => {
  it('segura o topo na introdução e cada posição até o próximo início', () => {
    expect(stepYAtTime(anchors, 1.99)).toBe(0);
    expect(stepYAtTime(anchors, 2)).toBe(100);
    expect(stepYAtTime(anchors, 4.99)).toBe(100);
    expect(stepYAtTime(anchors, 5)).toBe(250);
    expect(stepYAtTime(anchors, 20)).toBe(430);
    expect(stepYAtTime([], 20)).toBe(0);
  });

  it('suaviza o salto com extremos fixos e permanece estável ao terminar', () => {
    expect(stepYAtTime(anchors, 2, 300)).toBe(0);
    expect(stepYAtTime(anchors, 2.3, 300)).toBeCloseTo(100);
    expect(stepYAtTime(anchors, 5, 300)).toBe(100);
    expect(stepYAtTime(anchors, 5.075, 300)).toBeCloseTo(123.4375);
    expect(stepYAtTime(anchors, 5.15, 300)).toBeCloseTo(175);
    expect(stepYAtTime(anchors, 5.3, 300)).toBeCloseTo(250);
    expect(stepYAtTime(anchors, 5.8, 300)).toBe(250);
  });
});

describe('stepTimeAtY', () => {
  it('busca a primeira linha na guia ou abaixo dela', () => {
    expect(stepTimeAtY(anchors, 0)).toBe(2);
    expect(stepTimeAtY(anchors, 100)).toBe(2);
    expect(stepTimeAtY(anchors, 100.5)).toBe(5);
    expect(stepTimeAtY(anchors, 251)).toBe(12);
    expect(stepTimeAtY(anchors, 900)).toBe(12);
    expect(stepTimeAtY([], 100)).toBe(0);
  });

  it('recupera o início de cada âncora, inclusive quando a música volta a uma linha anterior', () => {
    const reordered = [{ startTime: 14, y: 80 }, ...anchors];
    for (const anchor of reordered) {
      expect(stepTimeAtY(reordered, stepYAtTime(reordered, anchor.startTime))).toBe(anchor.startTime);
    }
  });
});
