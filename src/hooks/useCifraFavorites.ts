import { useEffect, useSyncExternalStore } from 'react';
import { getStore, subscribe, syncFavoritesFromServer, type FavoritesStore } from '../services/cifraFavorites';

/**
 * Reconcilia com o servidor uma vez por carregamento de página.
 *
 * O sync morava só na dashboard, então dar Ctrl+R numa cifra deixava o coração apagado até
 * o usuário abrir /favoritos — mesmo com a identidade intacta e a música lá no servidor.
 *
 * O guarda é de módulo, não de componente: a dashboard e o CifraViewer usam o mesmo hook e
 * podem montar juntos, e duas reconciliações simultâneas disputariam as remoções pendentes.
 */
let syncStarted = false;

export function useFavoritesBootSync(): void {
  useEffect(() => {
    if (syncStarted) return;
    syncStarted = true;
    void syncFavoritesFromServer();
  }, []);
}

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
