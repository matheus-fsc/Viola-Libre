import { describe, expect, it } from 'vitest';
import {
  MOLA_EMBALO,
  MOLA_FOLHA,
  maisProximo,
  mola,
  projetarParada,
  rubberBand,
  rubberBandClamp,
  springAssentou,
  stepSpring,
  velocidadeDeSoltura,
  type EstadoMola,
} from './motion';

describe('rubberBand', () => {
  it('reproduz o exemplo do print: 844pt de dedo viram ~299pt numa tela de 844', () => {
    // c = 0.55, d = 844 → 844·(1 − 1/1.55) ≈ 299.5
    expect(rubberBand(844, 844)).toBeCloseTo(299.48, 1);
  });

  it('nunca passa da dimensão, por mais que o dedo ande', () => {
    expect(rubberBand(1e9, 300)).toBeLessThan(300);
    expect(rubberBand(1e9, 300)).toBeGreaterThan(299);
  });

  it('começa com inclinação c', () => {
    expect(rubberBand(0.001, 500) / 0.001).toBeCloseTo(0.55, 3);
  });

  it('é ímpar: o outro lado do limite é o espelho', () => {
    expect(rubberBand(-120, 400)).toBeCloseTo(-rubberBand(120, 400), 10);
    expect(rubberBand(0, 400)).toBe(0);
  });

  it('cresce sempre, mas cada vez menos', () => {
    let anterior = 0;
    let passoAnterior = Infinity;
    for (let x = 50; x <= 2000; x += 50) {
      const y = rubberBand(x, 600);
      expect(y).toBeGreaterThan(anterior);
      expect(y - anterior).toBeLessThan(passoAnterior);
      passoAnterior = y - anterior;
      anterior = y;
    }
  });

  it('dimensão zero não divide por zero', () => {
    expect(rubberBand(100, 0)).toBe(0);
  });
});

describe('rubberBandClamp', () => {
  it('deixa o miolo em paz', () => {
    expect(rubberBandClamp(50, 0, 100, 300)).toBe(50);
  });

  it('estica pelos dois lados a partir do limite certo', () => {
    expect(rubberBandClamp(-40, 0, 100, 300)).toBeCloseTo(rubberBand(-40, 300), 10);
    expect(rubberBandClamp(140, 0, 100, 300)).toBeCloseTo(100 + rubberBand(40, 300), 10);
  });
});

/** Roda a mola a 60fps até assentar (ou desistir em 5s). */
function simular(inicio: EstadoMola, alvo: number, m = MOLA_FOLHA) {
  let s = inicio;
  let max = s.x;
  let quadros = 0;
  while (!springAssentou(s, alvo) && quadros < 300) {
    s = stepSpring(s, alvo, m, 1 / 60);
    max = Math.max(max, s.x);
    quadros++;
  }
  return { s, max, segundos: quadros / 60 };
}

describe('stepSpring', () => {
  it('a folha abre em menos de meio segundo', () => {
    const { s, segundos } = simular({ x: 0, v: 0 }, 500);
    expect(springAssentou(s, 500)).toBe(true);
    expect(segundos).toBeLessThan(0.5);
  });

  it('a folha quase não passa do alvo (tema XP, sem quique)', () => {
    const { max } = simular({ x: 0, v: 0 }, 500);
    expect(max - 500).toBeLessThan(5);
  });

  it('amortecimento crítico não passa do alvo nunca', () => {
    const { max } = simular({ x: 0, v: 0 }, 1, MOLA_EMBALO);
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('herda a velocidade do gesto: soltar rápido para o alvo chega antes', () => {
    const parada = simular({ x: 0, v: 0 }, 500).segundos;
    const embalada = simular({ x: 0, v: 3000 }, 500).segundos;
    expect(embalada).toBeLessThanOrEqual(parada);
  });

  it('um frame longo dá o mesmo que vários curtos, a menos de meio pixel', () => {
    const longo = stepSpring({ x: 0, v: 0 }, 300, MOLA_FOLHA, 0.1);
    let curto: EstadoMola = { x: 0, v: 0 };
    for (let i = 0; i < 10; i++) curto = stepSpring(curto, 300, MOLA_FOLHA, 0.01);
    expect(Math.abs(longo.x - curto.x)).toBeLessThan(0.5);
  });

  it('não explode com frame enorme e mola rígida', () => {
    const s = stepSpring({ x: 0, v: 0 }, 100, mola(5000, 0.9), 2);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(s.x).toBeCloseTo(100, 0);
  });

  it('dt negativo não anda', () => {
    expect(stepSpring({ x: 3, v: 7 }, 0, MOLA_FOLHA, -1)).toEqual({ x: 3, v: 7 });
  });
});

describe('velocidadeDeSoltura', () => {
  it('mede px/s pelos últimos 80ms', () => {
    const amostras = [
      { t: 0, x: 0 },
      { t: 100, x: 10 },
      { t: 116, x: 30 },
      { t: 132, x: 50 },
    ];
    // Janela de 52 a 132ms: t=0 fica de fora, t=100 entra.
    expect(velocidadeDeSoltura(amostras)).toBeCloseTo(((50 - 10) / 32) * 1000, 5);
  });

  it('dedo que parou antes de soltar soltou parado', () => {
    const amostras = [
      { t: 0, x: 0 },
      { t: 16, x: 200 },
      { t: 300, x: 200 },
    ];
    expect(velocidadeDeSoltura(amostras)).toBe(0);
  });

  it('eventos agrupados no mesmo milissegundo não viram arremesso supersônico', () => {
    const amostras = [
      { t: 100, x: 0 },
      { t: 101, x: 470 },
    ];
    expect(velocidadeDeSoltura(amostras)).toBe(6000);
    expect(velocidadeDeSoltura(amostras.map(a => ({ ...a, x: -a.x })))).toBe(-6000);
  });

  it('menos de duas amostras é zero', () => {
    expect(velocidadeDeSoltura([])).toBe(0);
    expect(velocidadeDeSoltura([{ t: 0, x: 5 }])).toBe(0);
  });
});

describe('projetarParada', () => {
  it('parado fica onde está', () => {
    expect(projetarParada(120, 0)).toBe(120);
  });

  it('um peteleco de 1000px/s anda ~500px na taxa do iOS', () => {
    expect(projetarParada(0, 1000)).toBeCloseTo(499, 0);
  });
});

describe('maisProximo', () => {
  it('escolhe o encaixe mais perto', () => {
    expect(maisProximo(250, [100, 200, 300])).toBe(200);
    expect(maisProximo(260, [100, 200, 300])).toBe(300);
  });

  it('empate fica com o primeiro da lista', () => {
    expect(maisProximo(150, [100, 200])).toBe(100);
  });

  it('lista vazia não inventa encaixe', () => {
    expect(maisProximo(42, [])).toBe(42);
  });
});
