/**
 * Física de movimento da interface: elástico de borda e mola amortecida.
 *
 * Puro, sem DOM: os hooks em `src/hooks/` cuidam do requestAnimationFrame e de escrever o
 * `transform`. Aqui ficam só as contas, para o vitest conferir sem navegador.
 *
 * Unidades: posição em px, velocidade em px/s, tempo em segundos.
 */

/**
 * Elástico de borda, o mesmo do iOS: `(1 − 1/(c·x/d + 1)) · d`.
 *
 * Quanto mais o dedo passa do limite, menos a tela acompanha, e ela nunca anda mais que
 * `d`. Perto de zero a inclinação é `c`, então o primeiro pixel já resiste um pouco: com
 * c = 0.55 o dedo anda 10px e a tela 5,5px, que é o que faz a borda parecer firme e não
 * mole. O sinal de `x` é preservado, para servir aos dois lados do limite.
 */
export function rubberBand(x: number, d: number, c = 0.55): number {
  if (d <= 0) return 0;
  const sinal = Math.sign(x);
  const abs = Math.abs(x);
  return sinal * (1 - 1 / ((c * abs) / d + 1)) * d;
}

/**
 * Prende `x` em [min, max], mas com elástico em vez de parede: o excesso de cada lado passa
 * pelo `rubberBand` com a mesma dimensão `d`.
 */
export function rubberBandClamp(x: number, min: number, max: number, d: number, c = 0.55): number {
  if (x < min) return min + rubberBand(x - min, d, c);
  if (x > max) return max + rubberBand(x - max, d, c);
  return x;
}

export interface Mola {
  /** Rigidez k: quanto a mola puxa por pixel de distância. */
  k: number;
  /** Amortecimento b: quanto ela freia por px/s de velocidade. */
  b: number;
  /** Massa m. */
  m: number;
}

/**
 * Monta uma mola pela razão de amortecimento ζ, que é o que se ajusta de olho:
 * ζ = 1 chega sem passar do alvo (amortecimento crítico), ζ < 1 passa e volta.
 *
 * O tema Windows XP não tinha mola nenhuma; um quique visível destoaria dele. Por isso os
 * presets abaixo ficam em ζ ≥ 0.9, onde o excesso é de um ou dois pixels.
 */
export function mola(k: number, zeta: number, m = 1): Mola {
  return { k, b: 2 * zeta * Math.sqrt(k * m), m };
}

/** Folhas do mobile: abrem em ~0,3s e passam do alvo menos de 1%. */
export const MOLA_FOLHA = mola(420, 0.9);

/** Velocidade do auto scroll voltando depois do gesto: sem quique, ~0,6s até o embalo. */
export const MOLA_EMBALO = mola(64, 1);

export interface EstadoMola {
  x: number;
  v: number;
}

/**
 * Avança `m·x″ = −k·(x − alvo) − b·x′` por `dt` segundos.
 *
 * Euler semi-implícito (velocidade primeiro, posição com a velocidade nova), em subpassos
 * de no máximo 1/240s. O Euler comum ganha energia e uma mola rígida explode num frame
 * longo; o semi-implícito é estável nesse passo para as rigidezes daqui. O subpasso é o
 * que deixa um frame de 100ms (aba que voltou do fundo) dar o mesmo resultado que dez de
 * 10ms.
 */
export function stepSpring(estado: EstadoMola, alvo: number, mola: Mola, dt: number): EstadoMola {
  const SUBPASSO = 1 / 240;
  let { x, v } = estado;
  let resta = Math.max(0, dt);
  while (resta > 0) {
    const h = Math.min(resta, SUBPASSO);
    const a = (-mola.k * (x - alvo) - mola.b * v) / mola.m;
    v += a * h;
    x += v * h;
    resta -= h;
  }
  return { x, v };
}

/**
 * Parou? Perto do alvo e quase sem velocidade. As tolerâncias padrão são para pixels:
 * meio pixel não se vê, e 5px/s leva mais de um frame para andar um décimo de pixel.
 */
export function springAssentou(estado: EstadoMola, alvo: number, tolX = 0.5, tolV = 5): boolean {
  return Math.abs(estado.x - alvo) < tolX && Math.abs(estado.v) < tolV;
}

export interface Amostra {
  /** Tempo em ms (o `timeStamp` do evento). */
  t: number;
  x: number;
}

/**
 * Velocidade em px/s com que o dedo soltou, pelas amostras dos últimos `janelaMs`.
 *
 * Só a janela final conta: um dedo que arrastou rápido e parou antes de soltar soltou
 * parado, e a mola não deve sair disparada. Com menos de duas amostras na janela, zero.
 *
 * O resultado é limitado a `max`. Eventos agrupados chegam com 1ms ou menos entre si
 * (frame travado, automação), e centenas de pixels nesse intervalo davam centenas de
 * milhares de px/s: a mola atirava a janela para fora da tela antes de trazê-la de volta.
 * 6000px/s fica na faixa do maior arremesso de um polegar.
 */
export function velocidadeDeSoltura(amostras: readonly Amostra[], janelaMs = 80, max = 6000): number {
  if (amostras.length < 2) return 0;
  const ultima = amostras[amostras.length - 1];
  let primeira = ultima;
  for (let i = amostras.length - 2; i >= 0; i--) {
    if (ultima.t - amostras[i].t > janelaMs) break;
    primeira = amostras[i];
  }
  const dt = ultima.t - primeira.t;
  if (dt <= 0) return 0;
  const v = ((ultima.x - primeira.x) / dt) * 1000;
  return Math.max(-max, Math.min(max, v));
}

/**
 * Onde o movimento pararia sozinho, se só a inércia agisse (a "projeção" do UIScrollView).
 *
 * É o que decide se uma folha fecha: um peteleco rápido fecha mesmo arrastando pouco,
 * porque a projeção passa da metade. `desaceleracao` é a fração de velocidade que sobra
 * por milissegundo; 0.998 é a taxa normal de rolagem do iOS.
 */
export function projetarParada(x: number, v: number, desaceleracao = 0.998): number {
  return x + ((v / 1000) * desaceleracao) / (1 - desaceleracao);
}

/** O ponto da lista mais perto de `x`. Empate fica com o primeiro. Lista vazia devolve `x`. */
export function maisProximo(x: number, pontos: readonly number[]): number {
  let melhor = x;
  let dist = Infinity;
  for (const p of pontos) {
    const d = Math.abs(p - x);
    if (d < dist) { dist = d; melhor = p; }
  }
  return melhor;
}
