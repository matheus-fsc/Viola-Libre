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

// O store nasce na carga do módulo: uma exceção aqui (storage bloqueado pelo navegador, modo
// privado) derrubaria o app inteiro por causa de uma preferência de rótulo. Sem storage, vale
// o default e a escolha dura só a sessão.
function lerGuardado(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}

export const useNotationStore = create<NotationState>((set) => {
  const guardado = lerGuardado();
  return {
    standard: guardado === 'pt-BR' || guardado === 'intl' ? guardado : DEFAULT_NOTATION,
    setStandard: (s) => {
      try { localStorage.setItem(CHAVE, s); } catch { /* segue só na memória */ }
      set({ standard: s });
    },
  };
});
