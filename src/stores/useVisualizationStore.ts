import { create } from 'zustand';

interface VisualizationState {
  stringOrder: 'standard' | 'inverted' | null;
  setStringOrder: (order: 'standard' | 'inverted') => void;
}

export const useVisualizationStore = create<VisualizationState>((set) => {
  const stored = localStorage.getItem('viola_libre_string_order');
  return {
    stringOrder: stored === 'standard' || stored === 'inverted' ? stored : null,
    setStringOrder: (order) => {
      localStorage.setItem('viola_libre_string_order', order);
      set({ stringOrder: order });
    }
  };
});
