import { useSyncExternalStore } from 'react';
import {
  getYouTubeJsConsent, isYouTubeJsAllowed, subscribeYouTubeJs, type YouTubeJsConsent,
} from '../services/youtubeApi';

/**
 * Diz se o JavaScript não-livre do YouTube já foi autorizado nesta instalação.
 *
 * O consentimento vive fora do React — o serviço precisa consultá-lo em funções
 * que não são componentes, como `fetchYouTubeDuration` —, então a ponte é o
 * `useSyncExternalStore`. O snapshot do servidor é o estado mais restritivo:
 * sem navegador não há armazenamento onde ler a escolha.
 */
export function useYouTubeJsAllowed(): boolean {
  return useSyncExternalStore(subscribeYouTubeJs, isYouTubeJsAllowed, () => false);
}

/**
 * A resposta completa, incluindo o "ainda não perguntei".
 *
 * Quem só quer saber se pode carregar o player usa `useYouTubeJsAllowed`; este
 * aqui é para quem precisa decidir se vale abrir o diálogo de permissão.
 */
export function useYouTubeJsConsent(): YouTubeJsConsent {
  return useSyncExternalStore(subscribeYouTubeJs, getYouTubeJsConsent, () => 'nao-perguntado' as const);
}
