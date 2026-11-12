import { useLayoutEffect, useRef } from 'react';

/**
 * Um ref que sempre aponta para o valor do último render.
 *
 * Serve para callbacks de longa duração (handlers do player do YouTube, downloads em curso)
 * lerem a prop atual sem que ela entre nas dependências do efeito que os criou, o que
 * destruiria e recriaria o player a cada render do pai.
 *
 * Atribuir `ref.current = valor` no corpo do componente faz o mesmo, mas escreve durante o
 * render, que o React pode repetir ou descartar. O layout effect roda depois do commit e
 * antes de qualquer efeito comum ou evento, então quem lê o ref nunca vê um valor velho.
 */
export function useLatest<T>(valor: T) {
  const ref = useRef(valor);
  useLayoutEffect(() => { ref.current = valor; });
  return ref;
}
