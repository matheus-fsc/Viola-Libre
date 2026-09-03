/*
 * Registro do service worker (ver `public/sw.js`).
 *
 * Fica num módulo próprio, e não solto no `main.tsx`, porque a parte delicada não é
 * registrar — é o que fazer quando uma versão nova assume. Esse trecho merece explicação
 * ao lado dele.
 */

/**
 * Só em produção.
 *
 * Em desenvolvimento o service worker interceptaria os módulos que o Vite serve e o HMR
 * pararia de funcionar de um jeito difícil de diagnosticar: a página deixa de refletir o
 * arquivo salvo, e nada na tela diz por quê.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  /**
   * Havia um controlador ANTES deste registro?
   *
   * É o que separa "instalou agora" de "trocou de versão". Na primeira instalação o
   * `clients.claim()` do worker dispara `controllerchange` sem que nada tenha mudado na
   * página — recarregar ali seria um pulo inexplicável no meio da primeira visita.
   */
  const jaTinhaControlador = Boolean(navigator.serviceWorker.controller);
  let recarregando = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!jaTinhaControlador || recarregando) return;
    // Trava contra laço: `controllerchange` pode disparar mais de uma vez, e um reload por
    // disparo deixaria a aba num ciclo do qual a pessoa não consegue sair.
    recarregando = true;
    window.location.reload();
  });

  // Depois do `load`: registrar durante a carga faria a busca do sw.js competir com a do
  // bundle e da primeira cifra, atrasando justamente a tela que a pessoa está esperando.
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falhar aqui não é fatal: o site funciona exatamente como funcionava antes de o
      // service worker existir. Acontece em contexto não seguro e em alguns modos privados.
    });
  });
}
