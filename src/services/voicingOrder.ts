// Como ordenar as variações de um acorde no card.
//
// Três fontes disputam a primeira posição, e o músico escolhe qual manda:
//
//   favoritos  (default) — o voto do público, com a curadoria logo atrás
//   curados             — só a decisão dos Editores
//   algoritmo           — nenhuma intervenção: a ordem que o chordCalculator produziu
//
// Este módulo só decide QUAIS formas vão para a frente e em que ordem. Quem de fato
// reordena a lista é `applyCurationOrder` (authApi.ts), que já sabe lidar com uma forma
// escolhida que os filtros do usuário haviam removido — ela é reinserida na frente.

import type { CuratedVoicing } from './authApi';
import type { Chave } from '../i18n';
import { fretsKey, type PopularVoicing } from './chordFavoritesApi';

export type VoicingOrderMode = 'favoritos' | 'curados' | 'algoritmo';

/*
 * Rótulo e dica saem como CHAVE, não como texto: esta lista é montada quando o módulo
 * carrega, e um texto aqui ficaria congelado no idioma que valia naquele instante. Quem
 * desenha chama o `t` na hora.
 */
export const VOICING_ORDER_MODES: ReadonlyArray<{ value: VoicingOrderMode; rotulo: Chave; dica: Chave }> = [
  { value: 'favoritos', rotulo: 'cifra.ordemFavoritos', dica: 'cifra.ordemFavoritosDica' },
  { value: 'curados', rotulo: 'cifra.ordemCurados', dica: 'cifra.ordemCuradosDica' },
  { value: 'algoritmo', rotulo: 'cifra.ordemAlgoritmo', dica: 'cifra.ordemAlgoritmoDica' },
];

const STORAGE_KEY = 'vl_voicing_order_mode_v1';

export function readVoicingOrderMode(): VoicingOrderMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'favoritos' || saved === 'curados' || saved === 'algoritmo') return saved;
  } catch {
    // Modo privado / storage bloqueado — cai no default.
  }
  return 'favoritos';
}

export function writeVoicingOrderMode(mode: VoicingOrderMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Preferência vira sessão-only; não vale quebrar a troca de modo por causa disso.
  }
}

/**
 * As formas que devem ocupar a frente da lista, na ordem.
 *
 * Em 'favoritos' as duas fontes se somam — populares primeiro, curadas em seguida — em vez
 * de uma anular a outra: um acorde que a comunidade nunca votou continua entregando a
 * escolha do Editor em vez de despencar para a ordem crua do algoritmo.
 *
 * A deduplicação é obrigatória, não cosmética: `applyCurationOrder` consome esta lista
 * posição a posição e, para uma forma repetida, a segunda ocorrência não encontra mais o
 * voicing original (já retirado) e acaba sintetizando um card duplicado.
 */
export function frontShapesFor(
  mode: VoicingOrderMode,
  popular: PopularVoicing[],
  curated: CuratedVoicing[]
): number[][] {
  if (mode === 'algoritmo') return [];
  if (mode === 'curados') return dedupe(curated.map(c => c.fretsArray));
  return dedupe([...popular.map(p => p.fretsArray), ...curated.map(c => c.fretsArray)]);
}

function dedupe(shapes: number[][]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const shape of shapes) {
    const key = fretsKey(shape);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shape);
  }
  return out;
}
