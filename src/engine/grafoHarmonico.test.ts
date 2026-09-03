/**
 * Testes do grafo harmônico.
 *
 * O que se afirma aqui são invariantes de LEITURA: o desenho precisa ser interpretável sem
 * legenda decorada, e isso depende de três garantias — o campo cai num arco contínuo, os
 * discos não se sobrepõem, e o rótulo cabe dentro do disco.
 */
import { describe, it, expect } from 'vitest';
import { detectKey } from './detectKey';
import { montarGrafo } from './grafoHarmonico';

const EM_C = ['C', 'Am', 'F', 'G7', 'C', 'Am', 'Dm', 'G7', 'C', 'F', 'G7', 'C'];

function grafoDe(chords: string[]) {
  const d = detectKey(chords)!;
  return { d, g: montarGrafo(chords, d) };
}

describe('grafoHarmonico — nós', () => {
  it('um nó por acorde distinto, com as repetições contadas', () => {
    const { g } = grafoDe(EM_C);
    expect(new Set(g.nos.map(n => n.id)).size).toBe(g.nos.length);
    expect(g.nos.reduce((s, n) => s + n.ocorrencias, 0)).toBe(EM_C.length);
    expect(g.nos.find(n => n.id === 'C')!.ocorrencias).toBe(4);
  });

  it('o papel vem do detectKey, não é recalculado', () => {
    const { d, g } = grafoDe(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C']);
    const analise = new Map(d.candidates[0].analise!.acordes.map(a => [a.chord, a.papel]));
    for (const no of g.nos) {
      if (analise.has(no.id)) expect(no.papel).toBe(analise.get(no.id));
    }
    expect(g.nos.find(n => n.id === 'A7')!.papel).toBe('dominante');
  });

  it('BUG CORRIGIDO: grafias diferentes do mesmo esqueleto acham o próprio papel', () => {
    // `Gm7` e `Gm7(11)` são a mesma harmonia para a análise (a tensão é descartada), então
    // ela guarda uma entrada só. Procurando pelo texto exato, a segunda grafia não achava
    // o papel e caía como "sem explicação" ao lado da primeira, que era o ii do tom.
    const chords = ['F', 'Gm7', 'C7', 'F', 'Gm7(11)', 'C7', 'F', 'Gm7', 'C7', 'F'];
    const { g } = grafoDe(chords);
    const a = g.nos.find(n => n.id === 'Gm7')!;
    const b = g.nos.find(n => n.id === 'Gm7(11)')!;
    expect(b.papel).toBe(a.papel);
    expect(b.grau).toBe(a.grau);
  });
});

describe('grafoHarmonico — layout', () => {
  it('os graus do campo formam um arco CONTÍNUO do ciclo de quintas', () => {
    // É a propriedade que justifica o anel: se o campo se espalhasse, a distância angular
    // deixaria de significar distância harmônica e o desenho não diria nada.
    const { g } = grafoDe(EM_C);
    const posicoes = [...new Set(g.nos.filter(n => n.papel === 'campo').map(n => n.quintas))]
      .sort((a, b) => a - b);
    for (let i = 1; i < posicoes.length; i++) {
      expect(posicoes[i] - posicoes[i - 1]).toBe(1);
    }
  });

  it('nenhum par de discos se sobrepõe', () => {
    // Regressão do relato de sobreposição: o empilhamento usava passo fixo e ignorava o
    // tamanho real dos discos, então rótulo longo cobria o vizinho.
    const { g } = grafoDe([
      'F', 'Gm7', 'Gm7(11)', 'G7(13)', 'C7(9-)', 'Ab7(11+)', 'Gb7(11+)', 'F',
      'Bb7(9/11+)', 'F', 'Gm7', 'C7(9-)', 'F',
    ]);
    for (let i = 0; i < g.nos.length; i++) {
      for (let j = i + 1; j < g.nos.length; j++) {
        const a = g.nos[i];
        const b = g.nos[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('o disco é grande o bastante para o rótulo caber dentro', () => {
    const { g } = grafoDe(['F', 'Bb7(9/11+)', 'Gm7', 'C7(9-)', 'F', 'Bb7(9/11+)', 'F']);
    for (const no of g.nos) {
      // ~7,4px por caractere em 13px negrito; o diâmetro tem de passar disso.
      expect(no.r * 2).toBeGreaterThan(no.id.length * 7.4);
    }
  });

  it('acorde de fora do tom fica além do anel; do campo, sobre ele', () => {
    const { g } = grafoDe(['C', 'Am', 'F', 'G7', 'C', 'Eb', 'C', 'F', 'G7', 'C']);
    const raio = (n: { x: number; y: number }) => Math.hypot(n.x, n.y);
    const naBorda = g.nos.filter(n => n.papel === 'campo').map(raio);
    const foraDoTom = g.nos.filter(n => n.papel === 'estranho').map(raio);
    if (foraDoTom.length && naBorda.length) {
      expect(Math.min(...foraDoTom)).toBeGreaterThan(Math.min(...naBorda));
    }
  });
});

describe('grafoHarmonico — arestas', () => {
  it('agrega transições repetidas e ignora acorde repetido', () => {
    const { g } = grafoDe(['C', 'C', 'G7', 'C', 'G7', 'C']);
    expect(g.arestas.find(a => a.de === 'C' && a.para === 'G7')!.vezes).toBe(2);
    expect(g.arestas.some(a => a.de === a.para)).toBe(false);
  });

  it('classifica o movimento da fundamental', () => {
    const { g } = grafoDe(['C', 'G7', 'C', 'D', 'C', 'E', 'C', 'Db', 'C', 'F#', 'C']);
    const mov = (de: string, para: string) =>
      g.arestas.find(a => a.de === de && a.para === para)?.movimento;
    expect(mov('G7', 'C')).toBe('quarta');   // a cadência
    expect(mov('C', 'D')).toBe('segunda');
    expect(mov('C', 'E')).toBe('terca');
    expect(mov('C', 'Db')).toBe('cromatico');
    expect(mov('C', 'F#')).toBe('tritono');
  });

  it('as arestas vêm ordenadas e o maior peso bate com a primeira', () => {
    const { g } = grafoDe(EM_C);
    for (let i = 1; i < g.arestas.length; i++) {
      expect(g.arestas[i - 1].vezes).toBeGreaterThanOrEqual(g.arestas[i].vezes);
    }
    expect(g.maiorPeso).toBe(g.arestas[0].vezes);
  });

  it('toda aresta liga dois nós que existem', () => {
    const { g } = grafoDe(EM_C);
    const ids = new Set(g.nos.map(n => n.id));
    for (const a of g.arestas) {
      expect(ids.has(a.de)).toBe(true);
      expect(ids.has(a.para)).toBe(true);
    }
  });

  it('sequência sem acorde reconhecível não derruba a montagem', () => {
    const d = detectKey(['C', 'F', 'G7', 'C'])!;
    expect(() => montarGrafo(['C', 'Amor', 'xyz', 'F', 'G7', 'C'], d)).not.toThrow();
  });
});
