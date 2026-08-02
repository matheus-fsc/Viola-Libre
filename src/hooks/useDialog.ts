import { useCallback, useEffect, useRef } from 'react';

/**
 * Comportamento de diálogo modal, na forma que faltava em quase todos os overlays
 * do projeto.
 *
 * O tema Windows XP produz janelas que *parecem* modais — fundo escurecido, barra de
 * título, botão de fechar — mas eram `<div>` comuns. Para quem enxerga isso funciona;
 * para leitor de tela e para navegação por teclado, não existia diálogo nenhum: o foco
 * seguia passeando pela página atrás da janela, e o Esc não fechava.
 *
 * O hook resolve as quatro coisas que fazem um modal ser modal:
 *
 *   1. semântica — role="dialog" + aria-modal, para o leitor anunciar e isolar;
 *   2. Esc fecha;
 *   3. o foco fica preso dentro enquanto estiver aberto (Tab circula);
 *   4. ao fechar, o foco VOLTA para o elemento que abriu — sem isso quem usa teclado
 *      é jogado de volta ao topo da página a cada abrir e fechar.
 *
 * Uso:
 *
 *   const dialog = useDialog({ onClose, titleId: 'titulo-x' });
 *   <div {...dialog.props} ref={dialog.ref}> … </div>
 */

interface UseDialogOptions {
  /** Chamado no Esc e no clique fora, quando habilitados. */
  onClose?: () => void;
  /** `id` do elemento que dá nome ao diálogo. Use um dos dois — este ou `label`. */
  titleId?: string;
  /** Nome do diálogo, quando não há um título visível para referenciar. */
  label?: string;
  /** `false` desliga tudo — para o caso de o overlay estar fechado mas montado. */
  active?: boolean;
}

/** Elementos que podem receber foco por Tab. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog({ onClose, titleId, label, active = true }: UseDialogOptions) {
  const ref = useRef<HTMLDivElement>(null);
  // Guardado no momento da abertura para poder devolver o foco no fim.
  const abridorRef = useRef<HTMLElement | null>(null);

  const focaveis = useCallback((): HTMLElement[] => {
    const raiz = ref.current;
    if (!raiz) return [];
    return [...raiz.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  useEffect(() => {
    if (!active) return;

    abridorRef.current = document.activeElement as HTMLElement | null;

    // Foco inicial no primeiro controle. Sem isso o leitor de tela continua lendo a
    // página de trás, mesmo com o diálogo aberto na frente.
    const primeiro = focaveis()[0] ?? ref.current;
    primeiro?.focus?.();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Armadilha de foco: no primeiro elemento, Shift+Tab volta para o último, e
      // vice-versa. É o que impede o Tab de escapar para a página atrás.
      const lista = focaveis();
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiroEl = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;

      if (e.shiftKey && (atual === primeiroEl || !ref.current?.contains(atual))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiroEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Devolve o foco a quem abriu, se ele ainda estiver na página.
      const abridor = abridorRef.current;
      if (abridor?.isConnected) abridor.focus();
    };
  }, [active, onClose, focaveis]);

  return {
    ref,
    props: {
      role: 'dialog' as const,
      'aria-modal': true,
      ...(titleId ? { 'aria-labelledby': titleId } : {}),
      ...(label ? { 'aria-label': label } : {}),
    },
  };
}
