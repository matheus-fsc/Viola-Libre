/**
 * Os três stores de feature do editor de timing: Modo Guiado, Vincular Texto e repetição de
 * Loop. Ficam num arquivo só porque o que se testa neles é a orquestração, e ela passa pelos
 * mesmos stores de domínio (player, regiões, seleção, texto) que precisam voltar ao zero
 * entre um caso e outro.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useAssistedModeStore } from './useAssistedModeStore';
import { useLineLinkWizardStore } from './useLineLinkWizardStore';
import { useLoopSaltoWizardStore } from './useLoopSaltoWizardStore';
import { usePlayerStore } from './usePlayerStore';
import { useTimingRegionsStore } from './useTimingRegionsStore';
import { useTimingSelectionStore } from './useTimingSelectionStore';
import { useCifraTextStore } from './useCifraTextStore';
import type { TimingRegion } from '../services/timingRegions';

const stores = [
  useAssistedModeStore, useLineLinkWizardStore, useLoopSaltoWizardStore,
  usePlayerStore, useTimingRegionsStore, useTimingSelectionStore, useCifraTextStore,
] as const;
const iniciais = stores.map(s => s.getState());

beforeEach(() => {
  stores.forEach((s, i) => (s as { setState(v: unknown, r: true): void }).setState(iniciais[i], true));
});

const guiado = () => useAssistedModeStore.getState();
const player = () => usePlayerStore.getState();
const regioes = () => useTimingRegionsStore.getState();

/** Sem YouTube nem <audio> registrados, o player só guarda estado: o tempo anda por `tick`. */
function comMidia() { usePlayerStore.setState({ mediaUrl: 'https://youtu.be/x' }); }
function tocarAte(t: number) { player().tick(t); }

describe('Modo Guiado — passada estrutural', () => {
  it('sem mídia carregada, não abre e avisa', () => {
    guiado().startStructuralPass();
    expect(guiado()).toMatchObject({ active: false, error: 'no-media' });
  });

  it('marca Intro, Verso e dois Refrões, numerando a repetição', () => {
    comMidia();
    guiado().startStructuralPass();
    expect(guiado().phase).toBe('confirm-intro');

    guiado().confirmIntro(true);
    guiado().beginRecording();
    tocarAte(10); guiado().commitBoundary();
    expect(guiado().phase).toBe('ask-next');

    guiado().selectNextType('verse');   tocarAte(30); guiado().commitBoundary();
    guiado().selectNextType('chorus');  tocarAte(45); guiado().commitBoundary();
    guiado().selectNextType('chorus');  tocarAte(60); guiado().commitBoundary();

    expect(regioes().regions.map(r => [r.label, r.startTime, r.endTime])).toEqual([
      ['Introdução', 0, 10],
      ['Verso', 10, 30],
      ['Refrão', 30, 45],
      ['Refrão 2', 45, 60],
    ]);
    // A região recém-criada fica selecionada nas outras vistas (timeline, grade).
    expect(useTimingSelectionStore.getState().selectedRegionId).toBe(guiado().history.at(-1));
  });

  // Toda seção precisa de um SectionType válido: a timeline pinta o clipe a partir dele.
  it('sem introdução, a primeira seção nasce como «Outro»', () => {
    comMidia();
    guiado().startStructuralPass();
    guiado().confirmIntro(false);
    guiado().beginRecording();
    tocarAte(12); guiado().commitBoundary();
    expect(regioes().regions[0]).toMatchObject({ sectionType: 'other', label: 'Outro' });
  });

  it('a primeira gravação começa do zero, onde quer que o player estivesse', () => {
    comMidia();
    player().seek(42);
    guiado().startStructuralPass();
    guiado().confirmIntro(true);
    guiado().beginRecording();
    expect(guiado().segmentStartTime).toBe(0);
  });

  it('introdução já marcada pede confirmação, e substituir apaga a antiga', () => {
    comMidia();
    const antiga = regioes().addRegion({
      kind: 'section', sectionType: 'intro', label: 'Introdução',
      startLine: null, endLine: null, startTime: 0, endTime: 8,
    });
    guiado().startStructuralPass();
    guiado().confirmIntro(true);
    expect(guiado().dupWarning).toMatchObject({ existingRegionId: antiga, endTime: 8 });

    guiado().confirmDupOverwrite();
    expect(regioes().regions).toHaveLength(0);
    expect(guiado()).toMatchObject({ dupWarning: null, phase: 'armed', pendingSectionType: 'intro' });
  });

  it('desfazer remove a última região e volta o player para o começo dela', () => {
    comMidia();
    guiado().startStructuralPass();
    guiado().confirmIntro(true);
    guiado().beginRecording();
    tocarAte(10); guiado().commitBoundary();
    guiado().selectNextType('verse'); tocarAte(30); guiado().commitBoundary();

    guiado().undoLast();
    expect(regioes().regions.map(r => r.label)).toEqual(['Introdução']);
    expect(player().currentTime).toBe(10);
    expect(guiado()).toMatchObject({ phase: 'recording', segmentStartTime: 10 });
  });

  it('commit fora da gravação não cria nada', () => {
    comMidia();
    guiado().startStructuralPass();
    guiado().commitBoundary();
    expect(regioes().regions).toHaveLength(0);
  });

  // Terminar a passada estrutural É dizer onde a música acaba.
  it('finalizar cria o Fine uma vez só', () => {
    comMidia();
    guiado().startStructuralPass();
    tocarAte(170);
    guiado().finish();
    expect(regioes().markers).toMatchObject([{ type: 'fine', time: 170 }]);

    guiado().startStructuralPass();
    guiado().finish();
    expect(regioes().markers).toHaveLength(1);
  });

  it('pausar para editar à mão preserva onde parou', () => {
    comMidia();
    guiado().startStructuralPass();
    guiado().confirmIntro(true);
    guiado().pauseForManualEdit();
    expect(guiado()).toMatchObject({ active: false, phase: 'armed' });
    guiado().resumeAssisted();
    expect(guiado()).toMatchObject({ active: true, phase: 'armed' });
  });
});

describe('Modo Guiado — passada de linhas', () => {
  it('sem linha de letra, não abre', () => {
    comMidia();
    useCifraTextStore.getState().setLines(['[Intro]', 'C  G  Am  F']);
    guiado().startLinePass();
    expect(guiado()).toMatchObject({ active: false, error: 'no-lyric-lines' });
  });

  it('agrupa a tablatura num bloco e pula acordes e cabeçalhos', () => {
    comMidia();
    useCifraTextStore.getState().setLines([
      '[Verso]',
      'C          G',
      'Primeira linha da letra',
      '',
      'E|---0---2---|',
      'B|---1---3---|',
      'Segunda linha da letra',
    ]);
    guiado().startLinePass();
    expect(guiado().lyricLineIndices).toEqual([
      { startLine: 2, endLine: 2 },
      { startLine: 4, endLine: 5 },
      { startLine: 6, endLine: 6 },
    ]);
  });

  it('cada commit vira uma frase, e a última encerra a passada', () => {
    comMidia();
    useCifraTextStore.getState().setLines(['Uma linha', 'Outra linha']);
    guiado().startLinePass();
    guiado().beginRecording();
    tocarAte(4); guiado().commitBoundary();
    tocarAte(9); guiado().commitBoundary();

    expect(regioes().regions.map(r => [r.kind, r.startLine, r.startTime, r.endTime])).toEqual([
      ['phrase', 0, 0, 4],
      ['phrase', 1, 4, 9],
    ]);
    expect(guiado().phase).toBe('finished');
    expect(player().isPlaying).toBe(false);
  });
});

function secao(label: string, startTime: number, linhas?: [number, number]): Omit<TimingRegion, 'id'> {
  return {
    kind: 'section', sectionType: 'verse', label, startTime, endTime: startTime + 10,
    startLine: linhas?.[0] ?? null, endLine: linhas?.[1] ?? null,
  };
}

describe('Vincular Texto', () => {
  const wizard = () => useLineLinkWizardStore.getState();

  it('percorre as seções em ordem de tempo, não de criação', () => {
    const b = regioes().addRegion(secao('B', 40));
    const a = regioes().addRegion(secao('A', 10));
    wizard().startLineLinkPass();
    expect(wizard().sortedSectionIds).toEqual([a, b]);
    expect(useTimingSelectionStore.getState().selectionMode).toBe('section-link');
  });

  it('pula direto as seções já vinculadas', () => {
    regioes().addRegion(secao('A', 10, [0, 3]));
    const b = regioes().addRegion(secao('B', 20));
    wizard().startLineLinkPass();
    expect(wizard().sortedSectionIds[wizard().currentIndex]).toBe(b);
  });

  it('tudo vinculado: nem entra em revisão', () => {
    regioes().addRegion(secao('A', 10, [0, 3]));
    wizard().startLineLinkPass();
    expect(wizard().phase).toBe('finished');
  });

  it('confirmar grava o intervalo em ordem, mesmo selecionado de baixo para cima', () => {
    const a = regioes().addRegion(secao('A', 10));
    wizard().startLineLinkPass();
    wizard().confirmCurrentLink(7, 4);
    expect(regioes().regions.find(r => r.id === a)).toMatchObject({ startLine: 4, endLine: 7 });
    expect(wizard().phase).toBe('finished');
    expect(useTimingSelectionStore.getState().selectionMode).toBeNull();
  });

  it('pular deixa a seção pendente para a próxima vez', () => {
    regioes().addRegion(secao('A', 10));
    wizard().startLineLinkPass();
    wizard().skipCurrent();
    expect(wizard().phase).toBe('finished');

    wizard().startLineLinkPass();
    expect(wizard().phase).toBe('reviewing');
  });
});

describe('Repetição de Loop', () => {
  const wizard = () => useLoopSaltoWizardStore.getState();
  const loop: Omit<TimingRegion, 'id'> = {
    kind: 'loop', label: 'Loop', startLine: 2, endLine: 5, startTime: 20, endTime: 35,
  };

  it('sem mídia carregada, não arma', () => {
    const id = regioes().addRegion(loop);
    wizard().markRepeatOccurrence(id);
    expect(wizard()).toMatchObject({ active: false, error: 'no-media' });
  });

  it('dois Enter: o primeiro toca, o segundo grava a ocorrência no loop', () => {
    comMidia();
    const id = regioes().addRegion(loop);
    wizard().markRepeatOccurrence(id);
    tocarAte(80);
    wizard().commitBoundary();
    expect(wizard().phase).toBe('recording');

    tocarAte(95);
    wizard().commitBoundary();
    expect(regioes().regions[0].repeats).toEqual([{ startTime: 80, endTime: 95 }]);
    expect(wizard()).toMatchObject({ active: false, phase: 'closed' });
  });

  it('desfazer no meio da tomada volta a armar sem gravar nada', () => {
    comMidia();
    const id = regioes().addRegion(loop);
    wizard().markRepeatOccurrence(id);
    wizard().commitBoundary();
    wizard().undoLast();
    expect(wizard().phase).toBe('armed');
    expect(regioes().regions[0].repeats).toBeUndefined();
  });
});
