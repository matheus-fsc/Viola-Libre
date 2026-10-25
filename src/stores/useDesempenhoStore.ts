import { create } from 'zustand';

/**
 * Modo desempenho: desliga as animações do site inteiro.
 *
 * Existem dois motivos para querer isso, e o sistema operacional só cobre um. O
 * "reduzir movimento" do aparelho é para quem passa mal com movimento; este aqui é
 * para quem tem aparelho fraco e prefere a tela mudando de uma vez a um quadro
 * engasgado. Os dois valem juntos: qualquer um deles desliga.
 *
 * Alcança dois tipos de animação:
 * - as do CSS (transições do tema, pulsações do braço), pelo atributo
 *   `data-desempenho` no <html>, que o index.css trata igual ao `prefers-reduced-motion`;
 * - as de JS (folhas, janela do vídeo, embalo da rolagem), que consultam
 *   `animacoesDesligadas()` antes de começar cada movimento.
 */
const CHAVE = 'viola_libre_modo_desempenho';

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

function marcarDocumento(ligado: boolean) {
  if (ligado) document.documentElement.setAttribute('data-desempenho', '');
  else document.documentElement.removeAttribute('data-desempenho');
}

interface DesempenhoState {
  ligado: boolean;
  setLigado: (ligado: boolean) => void;
}

export const useDesempenhoStore = create<DesempenhoState>((set) => {
  const ligado = ler();
  marcarDocumento(ligado);
  return {
    ligado,
    setLigado: (valor) => {
      try { localStorage.setItem(CHAVE, valor ? '1' : '0'); } catch { /* vale só na sessão */ }
      marcarDocumento(valor);
      set({ ligado: valor });
    },
  };
});

/** O sistema pediu menos movimento. */
export function sistemaPedeMenosMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animação em JS deve pular direto para o fim? Lido na hora de começar cada movimento,
 * não guardado: trocar a preferência vale já no próximo.
 */
export function animacoesDesligadas(): boolean {
  return useDesempenhoStore.getState().ligado || sistemaPedeMenosMovimento();
}
