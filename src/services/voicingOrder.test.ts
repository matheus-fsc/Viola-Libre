import { describe, expect, it } from 'vitest';
import { frontShapesFor } from './voicingOrder';
import type { PopularVoicing } from './chordFavoritesApi';
import type { CuratedVoicing } from './authApi';

const pop = (frets: number[], count: number): PopularVoicing => ({ fretsArray: frets, count, scope: 'global' });
const cur = (frets: number[]): CuratedVoicing => ({ fretsArray: frets, scope: 'global', totalScore: 0, curatorCount: 1 });

describe('frontShapesFor', () => {
  it('não move nada no modo algoritmo', () => {
    expect(frontShapesFor('algoritmo', [pop([1], 9)], [cur([2])])).toEqual([]);
  });

  it('usa só a curadoria no modo curados', () => {
    expect(frontShapesFor('curados', [pop([1], 9)], [cur([2])])).toEqual([[2]]);
  });

  // Favoritos manda, mas a curadoria não é descartada: acorde que a comunidade ainda não
  // votou continua entregando a escolha do Editor em vez de cair na ordem crua.
  it('soma populares e curados, nessa ordem, no modo favoritos', () => {
    expect(frontShapesFor('favoritos', [pop([1], 9)], [cur([2])])).toEqual([[1], [2]]);
  });

  // Sem isso, `applyCurationOrder` não acha o voicing na segunda passada (já retirado da
  // lista) e sintetiza um card duplicado da mesma forma.
  it('deduplica a forma que é popular E curada', () => {
    const shapes = frontShapesFor('favoritos', [pop([0, 2, 2], 9)], [cur([0, 2, 2]), cur([5, 7, 7])]);
    expect(shapes).toEqual([[0, 2, 2], [5, 7, 7]]);
  });

  it('deduplica repetição dentro da própria curadoria', () => {
    expect(frontShapesFor('curados', [], [cur([3]), cur([3])])).toEqual([[3]]);
  });
});
