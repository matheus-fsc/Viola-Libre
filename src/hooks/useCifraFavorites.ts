import { useSyncExternalStore } from 'react';
import { getStore, subscribe, type FavoritesStore } from '../services/cifraFavorites';

/**
 * A estante de cifras favoritadas, viva.
 *
 * O coração dentro da cifra e a dashboard em /favoritos leem o MESMO localStorage e
 * precisam concordar na hora: favoritar na música e trocar de aba não pode exigir F5.
 * `useSyncExternalStore` resolve isso sem duplicar estado em contexto — a store já é
 * externa ao React (é o localStorage), e `getStore` devolve referência estável entre
 * escritas, que é a condição para não entrar em loop de render.
 */
export function useCifraFavorites(): FavoritesStore {
  return useSyncExternalStore(subscribe, getStore, getStore);
}
