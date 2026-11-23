import { useSyncExternalStore } from 'react';
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
/**
 * Reduzir movimento: a mesma escolha do sistema operacional, feita aqui dentro, para quem
 * passa mal com movimento e não pode (ou não quer) mudar o aparelho inteiro. Atributo
 * `data-menos-movimento` no <html>.
 */
const CHAVE_MOVIMENTO = 'viola_libre_menos_movimento';

function ler(chave: string): boolean {
  try {
    return localStorage.getItem(chave) === '1';
  } catch {
    return false;
  }
}

function gravar(chave: string, valor: boolean) {
  try { localStorage.setItem(chave, valor ? '1' : '0'); } catch { /* vale só na sessão */ }
}

function marcarDocumento(atributo: string, ligado: boolean) {
  if (ligado) document.documentElement.setAttribute(atributo, '');
  else document.documentElement.removeAttribute(atributo);
}

interface DesempenhoState {
  ligado: boolean;
  setLigado: (ligado: boolean) => void;
  menosMovimento: boolean;
  setMenosMovimento: (ligado: boolean) => void;
}

export const useDesempenhoStore = create<DesempenhoState>((set) => {
  const ligado = ler(CHAVE);
  const menosMovimento = ler(CHAVE_MOVIMENTO);
  marcarDocumento('data-desempenho', ligado);
  marcarDocumento('data-menos-movimento', menosMovimento);
  return {
    ligado,
    setLigado: (valor) => {
      gravar(CHAVE, valor);
      marcarDocumento('data-desempenho', valor);
      set({ ligado: valor });
    },
    menosMovimento,
    setMenosMovimento: (valor) => {
      gravar(CHAVE_MOVIMENTO, valor);
      marcarDocumento('data-menos-movimento', valor);
      set({ menosMovimento: valor });
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
  const { ligado, menosMovimento } = useDesempenhoStore.getState();
  return ligado || menosMovimento || sistemaPedeMenosMovimento();
}

const CONSULTA_MOVIMENTO = '(prefers-reduced-motion: reduce)';

function assinarSistema(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIMENTO);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

/** Versão reativa de `animacoesDesligadas()`, para componentes que desenham diferente sem animação. */
export function useAnimacoesDesligadas(): boolean {
  const escolha = useDesempenhoStore(s => s.ligado || s.menosMovimento);
  const sistema = useSyncExternalStore(assinarSistema, sistemaPedeMenosMovimento, () => false);
  return escolha || sistema;
}
