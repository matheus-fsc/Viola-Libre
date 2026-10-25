import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  MOLA_FOLHA,
  projetarParada,
  rubberBandClamp,
  maisProximo,
  springAssentou,
  stepSpring,
  velocidadeDeSoltura,
  type Amostra,
  type EstadoMola,
} from '../engine/motion';
import { animacoesDesligadas } from '../stores/useDesempenhoStore';

/** Folga entre a janela e a borda da tela quando ela volta para dentro. */
const MARGEM = 8;
/** Largura mínima: abaixo disso o vídeo vira um selo e a barra de título não cabe. */
const LARGURA_MIN = 200;
/**
 * Larguras em que o dedo encaixa, em fração da largura útil da tela. O dedo cobre o canto
 * que está arrastando e não tem a precisão de pixel do mouse: em vez de deixar a janela
 * onde ele soltou, a mola leva ao tamanho mais próximo.
 */
const ENCAIXES_TOQUE = [0.4, 0.6, 0.8, 1];
/** Proporção do vídeo: arrastar o canto 9px para baixo equivale a 16px para o lado. */
const ASPECTO = 16 / 9;
/**
 * Inércia do arremesso. Mais baixa que a da rolagem (0.998): uma janela solta com força
 * deve deslizar um palmo, não atravessar a tela até a borda oposta.
 */
const DESACELERACAO = 0.99;

interface Geometria {
  x: number;
  y: number;
  w: number;
}


function ler(chave: string): Geometria | null {
  try {
    const g = JSON.parse(localStorage.getItem(chave) ?? 'null');
    if (g && [g.x, g.y, g.w].every(n => typeof n === 'number' && Number.isFinite(n))) return g;
  } catch { /* storage bloqueado ou lixo: cai no padrão */ }
  return null;
}

function gravar(chave: string, g: Geometria) {
  try { localStorage.setItem(chave, JSON.stringify(g)); } catch { /* sem storage, sem memória */ }
}

interface Opcoes {
  /** Onde lembrar posição e tamanho. Mobile e desktop usam chaves diferentes. */
  chave: string;
  /** Geometria da primeira vez, recebendo a altura medida da janela já na largura dada. */
  inicial(alturaDe: (w: number) => number): Geometria;
  /**
   * Faixa no pé da tela que a janela não ocupa: a barra de tarefas do desktop, a barra
   * de destinos do celular. Sem ela a alça do canto ia parar embaixo de outra barra.
   */
  baseOcupada?: number;
}

/**
 * Janela flutuante que arrasta pela barra de título e redimensiona pelo canto.
 *
 * Os limites são a tela: passar deles estica com o elástico, e ao soltar uma mola leva a
 * janela de volta para dentro, herdando a velocidade do arraste. Um arremesso desliza um
 * pouco antes de parar (`projetarParada`), o que deixa jogar o vídeo para um canto.
 *
 * A largura é a única medida de tamanho: a altura sai do 16:9 do vídeo pelo CSS.
 *
 * Como no `useDragSheet`, o movimento é escrito direto no estilo, sem render por frame,
 * e a geometria só é gravada quando a janela para. Enquanto arrasta, quem chama deve
 * desligar os eventos do <iframe> (`arrastando`): sem isso o ponteiro que passa por cima
 * do player some dentro dele e o arraste trava.
 */
export function useFloatingWindow({ chave, inicial, baseOcupada = 0 }: Opcoes) {
  const janelaRef = useRef<HTMLDivElement>(null);
  const geo = useRef<Geometria>({ x: MARGEM, y: MARGEM, w: 320 });
  const vel = useRef({ x: 0, y: 0, w: 0 });
  const quadro = useRef<number | null>(null);
  const gesto = useRef<{
    tipo: 'mover' | 'redimensionar';
    id: number;
    toque: boolean;
    px: number; py: number;
    inicio: Geometria;
    bruto: Geometria;
    amostras: { x: Amostra[]; y: Amostra[]; w: Amostra[] };
  } | null>(null);
  const inicialRef = useRef(inicial);
  useEffect(() => { inicialRef.current = inicial; });

  const pintar = useCallback(() => {
    const el = janelaRef.current;
    if (!el) return;
    const { x, y, w } = geo.current;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.width = `${w}px`;
  }, []);

  const altura = useCallback(() => janelaRef.current?.offsetHeight ?? 0, []);

  /** Limites válidos para a largura dada (a altura acompanha a largura). */
  const limites = useCallback((w: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wMax = Math.max(LARGURA_MIN, vw - 2 * MARGEM);
    const h = altura();
    return {
      wMin: Math.min(LARGURA_MIN, wMax),
      wMax,
      xMax: Math.max(MARGEM, vw - w - MARGEM),
      yMax: Math.max(MARGEM, vh - h - MARGEM - baseOcupada),
    };
  }, [altura, baseOcupada]);

  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  }, []);

  /** Mola de onde a janela está até a posição válida mais próxima de `alvo`. */
  const assentar = useCallback((alvo: Geometria) => {
    parar();
    const fim = () => {
      geo.current = { ...alvo };
      vel.current = { x: 0, y: 0, w: 0 };
      pintar();
      gravar(chave, geo.current);
    };
    if (animacoesDesligadas()) { fim(); return; }
    let anterior: number | null = null;
    const passo = (ts: number) => {
      const dt = anterior === null ? 1 / 60 : Math.min((ts - anterior) / 1000, 0.1);
      anterior = ts;
      const eixos = ['x', 'y', 'w'] as const;
      let parado = true;
      for (const k of eixos) {
        const s: EstadoMola = stepSpring({ x: geo.current[k], v: vel.current[k] }, alvo[k], MOLA_FOLHA, dt);
        geo.current[k] = s.x;
        vel.current[k] = s.v;
        if (!springAssentou(s, alvo[k])) parado = false;
      }
      if (parado) { quadro.current = null; fim(); return; }
      pintar();
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }, [chave, parar, pintar]);

  /** Prende a geometria aos limites da tela atual. */
  const dentro = useCallback((g: Geometria): Geometria => {
    const l0 = limites(g.w);
    const w = Math.min(Math.max(g.w, l0.wMin), l0.wMax);
    const l = limites(w);
    return {
      w,
      x: Math.min(Math.max(g.x, MARGEM), l.xMax),
      y: Math.min(Math.max(g.y, MARGEM), l.yMax),
    };
  }, [limites]);

  // Antes da primeira pintura: posição lembrada ou a padrão, já presa à tela atual.
  useLayoutEffect(() => {
    const alturaDe = (w: number) => {
      geo.current = { ...geo.current, w };
      pintar();
      return altura();
    };
    const g = ler(chave) ?? inicialRef.current(alturaDe);
    geo.current = g;
    pintar();
    geo.current = dentro(g);
    pintar();
  }, [chave, altura, dentro, pintar]);

  // Girar o aparelho ou estreitar a janela não pode deixar o vídeo fora da tela.
  useEffect(() => {
    const onResize = () => { if (!gesto.current) assentar(dentro(geo.current)); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [assentar, dentro]);

  useEffect(() => parar, [parar]);

  const comecar = (tipo: 'mover' | 'redimensionar', e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Botões da barra de título continuam sendo botões.
    if (tipo === 'mover' && (e.target as HTMLElement).closest('button, a')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    parar();
    gesto.current = {
      tipo, id: e.pointerId, toque: e.pointerType !== 'mouse', px: e.clientX, py: e.clientY,
      inicio: { ...geo.current }, bruto: { ...geo.current },
      amostras: { x: [], y: [], w: [] },
    };
    janelaRef.current?.setAttribute('data-arrastando', '');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    const t = e.timeStamp;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (g.tipo === 'mover') {
      g.bruto = { ...g.inicio, x: g.inicio.x + dx, y: g.inicio.y + dy };
      const l = limites(g.inicio.w);
      geo.current = {
        ...geo.current,
        x: rubberBandClamp(g.bruto.x, MARGEM, l.xMax, vw),
        y: rubberBandClamp(g.bruto.y, MARGEM, l.yMax, vh),
      };
    } else {
      // Mouse: só o eixo horizontal, preciso como a borda de uma janela do XP. Dedo: a
      // diagonal do canto, que é o gesto natural do polegar; a vertical entra convertida
      // pela proporção, e a média dos dois eixos tira o tremor de um só deles.
      const dw = g.toque ? (dx + dy * ASPECTO) / 2 : dx;
      g.bruto = { ...g.inicio, w: g.inicio.w + dw };
      const l = limites(g.inicio.w);
      // O canto não pode puxar a janela para fora pela direita.
      const wMax = Math.min(l.wMax, vw - g.inicio.x - MARGEM);
      geo.current = { ...geo.current, w: rubberBandClamp(g.bruto.w, l.wMin, Math.max(l.wMin, wMax), vw) };
    }
    g.amostras.x.push({ t, x: g.bruto.x });
    g.amostras.y.push({ t, x: g.bruto.y });
    g.amostras.w.push({ t, x: g.bruto.w });
    for (const a of Object.values(g.amostras)) if (a.length > 20) a.shift();
    pintar();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    janelaRef.current?.removeAttribute('data-arrastando');
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Amostra da soltura: dedo parado antes de soltar não gera pointermove.
    g.amostras.x.push({ t: e.timeStamp, x: g.bruto.x });
    g.amostras.y.push({ t: e.timeStamp, x: g.bruto.y });
    g.amostras.w.push({ t: e.timeStamp, x: g.bruto.w });
    const v = {
      x: velocidadeDeSoltura(g.amostras.x),
      y: velocidadeDeSoltura(g.amostras.y),
      w: velocidadeDeSoltura(g.amostras.w),
    };
    vel.current = g.tipo === 'mover' ? { x: v.x, y: v.y, w: 0 } : { x: 0, y: 0, w: v.w };
    const projetado = g.tipo === 'mover'
      ? { ...geo.current, x: projetarParada(geo.current.x, v.x, DESACELERACAO), y: projetarParada(geo.current.y, v.y, DESACELERACAO) }
      : { ...geo.current, w: projetarParada(geo.current.w, v.w, DESACELERACAO) };
    if (g.tipo === 'redimensionar' && g.toque) {
      const util = window.innerWidth - 2 * MARGEM;
      const pontos = ENCAIXES_TOQUE.map(f => f * util).filter(w => w >= LARGURA_MIN);
      projetado.w = maisProximo(projetado.w, pontos.length ? pontos : [LARGURA_MIN]);
      // Encolher pelo canto mantém o canto oposto no lugar; crescer além da borda
      // direita empurra a janela para a esquerda (o `dentro` resolve), não a corta.
      if (projetado.x + projetado.w > window.innerWidth - MARGEM) projetado.x = window.innerWidth - MARGEM - projetado.w;
    }
    assentar(dentro(projetado));
  };

  const ponteiro = { onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  /** Leva a janela de volta para dentro da tela, depois de ela mudar de altura sozinha. */
  const reassentar = useCallback(() => {
    if (!gesto.current) assentar(dentro(geo.current));
  }, [assentar, dentro]);

  return {
    janelaRef,
    /** Espalhe na barra de título. */
    barra: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => comecar('mover', e), ...ponteiro },
    /** Espalhe na alça do canto. */
    canto: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => comecar('redimensionar', e), ...ponteiro },
    reassentar,
  };
}
