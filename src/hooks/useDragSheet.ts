import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  MOLA_FOLHA,
  projetarParada,
  rubberBand,
  springAssentou,
  stepSpring,
  velocidadeDeSoltura,
  type Amostra,
  type EstadoMola,
} from '../engine/motion';

/** Quanto o dedo anda antes de virar arraste. Abaixo disso é toque, e o clique segue. */
const FOLGA_TOQUE = 6;

function prefereMenosMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Opcoes {
  /** true enquanto a folha deve estar na tela. Em false ela desce e chama `onSaiu`. */
  aberta: boolean;
  /** Pedido de fechar vindo do arraste: o dono decide e responde trocando `aberta`. */
  onFechar(): void;
  /** A folha terminou de descer e pode ser desmontada. */
  onSaiu(): void;
}

/**
 * Folha que sobe de baixo, arrasta pela alça e fecha com peteleco.
 *
 * Posição é `translateY` em px: 0 é aberta, a altura da folha é fora da tela. A mola leva
 * de um ponto ao outro, e o arraste entrega a ela a velocidade do dedo, então soltar no
 * meio de um movimento continua o movimento em vez de recomeçar do zero.
 *
 * Nada aqui passa pelo React a cada frame: o rAF escreve `transform` na folha e `opacity`
 * no fundo direto nos refs. Um setState por frame re-renderizaria a CifraViewer inteira,
 * que é quem monta o conteúdo das folhas.
 *
 * O CSS de `prefers-reduced-motion` no index.css não alcança animação feita em JS, então
 * a checagem é aqui: com ela ligada a folha só aparece e some, e o arraste continua
 * funcionando (é o dedo que move, não uma animação).
 */
export function useDragSheet({ aberta, onFechar, onSaiu }: Opcoes) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const fundoRef = useRef<HTMLDivElement>(null);

  const estado = useRef<EstadoMola>({ x: 0, v: 0 });
  const altura = useRef(0);
  const quadro = useRef<number | null>(null);
  const arraste = useRef<{ id: number; y0: number; x0: number; ativo: boolean; amostras: Amostra[] } | null>(null);
  /** Engole o clique que o navegador dispara no fim de um arraste. */
  const engolirClique = useRef(false);

  // Os callbacks mudam de identidade a cada render do dono; o rAF lê sempre o atual.
  const onSaiuRef = useRef(onSaiu);
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onSaiuRef.current = onSaiu;
    onFecharRef.current = onFechar;
  });

  const pintar = useCallback(() => {
    const x = estado.current.x;
    if (folhaRef.current) folhaRef.current.style.transform = `translateY(${x}px)`;
    if (fundoRef.current && altura.current > 0) {
      const fracao = 1 - Math.max(0, Math.min(x / altura.current, 1));
      fundoRef.current.style.opacity = String(fracao);
    }
  }, []);

  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  }, []);

  const animarPara = useCallback((alvo: number, aoChegar?: () => void) => {
    parar();
    if (prefereMenosMovimento()) {
      estado.current = { x: alvo, v: 0 };
      pintar();
      aoChegar?.();
      return;
    }
    let anterior: number | null = null;
    const passo = (ts: number) => {
      // Frame longo (aba voltou do fundo) não deve teleportar a folha.
      const dt = anterior === null ? 1 / 60 : Math.min((ts - anterior) / 1000, 0.1);
      anterior = ts;
      estado.current = stepSpring(estado.current, alvo, MOLA_FOLHA, dt);
      if (springAssentou(estado.current, alvo)) {
        estado.current = { x: alvo, v: 0 };
        pintar();
        quadro.current = null;
        aoChegar?.();
        return;
      }
      pintar();
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }, [parar, pintar]);

  // Antes da primeira pintura: mede e põe a folha fora da tela, para ela subir dali.
  useLayoutEffect(() => {
    altura.current = folhaRef.current?.offsetHeight ?? 0;
    estado.current = { x: altura.current, v: 0 };
    pintar();
  }, [pintar]);

  useEffect(() => {
    if (arraste.current?.ativo) return;
    if (aberta) animarPara(0);
    else animarPara(altura.current, () => onSaiuRef.current());
  }, [aberta, animarPara]);

  useEffect(() => parar, [parar]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Arraste que terminou fora da alça não gera clique; a marca não pode sobrar pro próximo toque.
    engolirClique.current = false;
    arraste.current = { id: e.pointerId, y0: e.clientY, x0: estado.current.x, ativo: false, amostras: [] };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    const dy = e.clientY - a.y0;
    if (!a.ativo) {
      if (Math.abs(dy) < FOLGA_TOQUE) return;
      // Captura só agora: capturar no pointerdown roubaria o clique do ✕ do cabeçalho.
      a.ativo = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      parar();
      altura.current = folhaRef.current?.offsetHeight ?? altura.current;
    }
    const bruto = a.x0 + dy;
    // Para cima de aberta é além do limite: o elástico deixa puxar um pouco e resiste.
    estado.current = { x: bruto < 0 ? rubberBand(bruto, altura.current) : bruto, v: 0 };
    a.amostras.push({ t: e.timeStamp, x: bruto });
    if (a.amostras.length > 20) a.amostras.shift();
    pintar();
  }, [parar, pintar]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    arraste.current = null;
    if (!a.ativo) return;
    engolirClique.current = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    // Parado o dedo não gera pointermove; sem a amostra da soltura, a janela de velocidade
    // contaria do último movimento e um dedo que parou antes de soltar sairia embalado.
    a.amostras.push({ t: e.timeStamp, x: a.x0 + (e.clientY - a.y0) });
    const v = velocidadeDeSoltura(a.amostras);
    estado.current = { x: estado.current.x, v };
    if (projetarParada(estado.current.x, v) > altura.current / 2) {
      // O dono responde com `aberta = false`, e o efeito desce a folha com esta velocidade.
      onFecharRef.current();
    } else {
      animarPara(0);
    }
  }, [animarPara]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!engolirClique.current) return;
    engolirClique.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  /** Espalhe na alça e no cabeçalho: as partes que arrastam. O conteúdo rola, não arrasta. */
  const alca = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClickCapture,
  };

  return { folhaRef, fundoRef, alca };
}
