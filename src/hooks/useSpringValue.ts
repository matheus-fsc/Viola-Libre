import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MOLA_FOLHA, springAssentou, stepSpring, type EstadoMola, type Mola } from '../engine/motion';
import { animacoesDesligadas } from '../stores/useDesempenhoStore';

/**
 * Um número que anda até o alvo por uma mola, pintado por quem chama a cada frame.
 *
 * Imperativo de propósito: `ir` e `definir` não passam pelo React, e `pintar` escreve
 * direto no estilo. Serve para progresso de 0 a 1 (aparecer, recolher) onde um estado
 * do React re-renderizaria o componente sessenta vezes por segundo.
 *
 * Com animações desligadas (modo desempenho ou sistema), `ir` pinta o alvo e chega.
 */
export function useSpringValue(pintar: (x: number) => void, inicial: number, mola: Mola = MOLA_FOLHA) {
  const estado = useRef<EstadoMola>({ x: inicial, v: 0 });
  const quadro = useRef<number | null>(null);
  const pintarRef = useRef(pintar);
  useEffect(() => { pintarRef.current = pintar; });

  const parar = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  }, []);

  const definir = useCallback((x: number) => {
    parar();
    estado.current = { x, v: 0 };
    pintarRef.current(x);
  }, [parar]);

  const ir = useCallback((alvo: number, aoChegar?: () => void) => {
    parar();
    if (animacoesDesligadas()) {
      definir(alvo);
      aoChegar?.();
      return;
    }
    let anterior: number | null = null;
    const passo = (ts: number) => {
      const dt = anterior === null ? 1 / 60 : Math.min((ts - anterior) / 1000, 0.1);
      anterior = ts;
      estado.current = stepSpring(estado.current, alvo, mola, dt);
      // Tolerância de progresso, não de pixel: 0.002 de 1 já não se vê.
      if (springAssentou(estado.current, alvo, 0.002, 0.02)) {
        estado.current = { x: alvo, v: 0 };
        pintarRef.current(alvo);
        quadro.current = null;
        aoChegar?.();
        return;
      }
      pintarRef.current(estado.current.x);
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }, [definir, mola, parar]);

  useEffect(() => parar, [parar]);

  // Estável entre renders: quem chama costuma pôr o par num array de dependências.
  return useMemo(() => ({ ir, definir }), [ir, definir]);
}
