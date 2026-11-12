import { create } from 'zustand';

interface VisualizationState {
  stringOrder: 'standard' | 'inverted' | null;
  setStringOrder: (order: 'standard' | 'inverted') => void;
}

const CHAVE = 'viola_libre_string_order';

// Mesmo cuidado do useNotationStore: ler o storage na carga do módulo não pode derrubar o app
// quando o navegador o bloqueia. Sem storage, o onboarding pergunta de novo a cada sessão.
function lerGuardado(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}

export const useVisualizationStore = create<VisualizationState>((set) => {
  const stored = lerGuardado();
  return {
    stringOrder: stored === 'standard' || stored === 'inverted' ? stored : null,
    setStringOrder: (order) => {
      try { localStorage.setItem(CHAVE, order); } catch { /* segue só na memória */ }
      set({ stringOrder: order });
    }
  };
});
