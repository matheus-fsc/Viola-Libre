import { create } from 'zustand';

/**
 * Pedido de "modo imersivo" feito por uma rota ao App.
 *
 * Quem liga a rolagem automática é a CifraViewer, mas quem controla a barra de tarefas é o
 * App — e entre os dois há o Router, então não dá para passar por prop. Este store é só o
 * recado: a tela pede espaço, o App decide o que recolher (hoje, o footer).
 *
 * O App recolhe na subida e restaura na descida, do mesmo jeito que já faz ao entrar e sair
 * do editor de timing; o usuário continua podendo reabrir o footer na mão.
 */
export interface ImmersiveState {
  /** Alguma tela está pedindo o máximo de altura possível. */
  immersive: boolean;
  setImmersive(on: boolean): void;
}

export const useImmersiveStore = create<ImmersiveState>(set => ({
  immersive: false,
  setImmersive: (on) => set({ immersive: on }),
}));
