import { create } from 'zustand';
import { DEFAULT_NOTATION, type NotationStandard } from '../engine/notation';

/**
 * Padrão de notação escolhido por quem usa. Governa só o RÓTULO dos acordes reconhecidos —
 * a leitura das cifras continua fixa na convenção brasileira, que é propriedade da fonte
 * (ver o cabeçalho de engine/notation.ts). Trocar aqui nunca muda as notas de um acorde.
 *
 * O default é 'pt-BR' e não vem do idioma do navegador: o acervo é de cifra brasileira, e
 * abrir o site num aparelho em inglês não deveria rotular um F–A–C–G de outro jeito que o
 * da cifra que está na tela.
 */
const CHAVE = 'viola_libre_notacao';

interface NotationState {
  standard: NotationStandard;
  setStandard: (s: NotationStandard) => void;
}

export const useNotationStore = create<NotationState>((set) => {
  const guardado = localStorage.getItem(CHAVE);
  return {
    standard: guardado === 'pt-BR' || guardado === 'intl' ? guardado : DEFAULT_NOTATION,
    setStandard: (s) => {
      localStorage.setItem(CHAVE, s);
      set({ standard: s });
    },
  };
});
