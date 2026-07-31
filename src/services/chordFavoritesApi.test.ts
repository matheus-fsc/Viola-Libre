import { describe, expect, it } from 'vitest';
import { countFor, fretsKey, pickPopularVoicings, type ChordFavoriteEntry } from './chordFavoritesApi';

const entry = (frets: number[], count: number, songSlug: string | null = null): ChordFavoriteEntry =>
  ({ fretsArray: frets, count, songSlug });

// A unicidade do voto no banco depende da serialização da forma. Se `[0,0,2]` e
// `[0, 0, 2]` não colidirem, o ranking se parte em contagens paralelas que nunca somam.
describe('fretsKey', () => {
  it('produz a mesma chave independente de espaçamento na origem', () => {
    expect(fretsKey([0, 0, 2, 2, 1, 0])).toBe('0,0,2,2,1,0');
    expect(fretsKey(JSON.parse('[0, 0, 2, 2, 1, 0]'))).toBe('0,0,2,2,1,0');
  });

  it('preserva corda abafada e trunca ruído decimal', () => {
    expect(fretsKey([-1, 0, 2])).toBe('-1,0,2');
    expect(fretsKey([3.0, 5.0])).toBe('3,5');
  });
});

describe('pickPopularVoicings', () => {
  it('ordena por contagem dentro de cada escopo', () => {
    const out = pickPopularVoicings([entry([1], 3), entry([2], 9), entry([3], 5)]);
    expect(out.map(v => v.count)).toEqual([9, 5, 3]);
    expect(out.every(v => v.scope === 'global')).toBe(true);
  });

  it('põe o escopo da música na frente e mescla os globais atrás', () => {
    const out = pickPopularVoicings(
      [entry([1], 50), entry([2], 2, 'asa-branca')],
      'asa-branca'
    );
    expect(out).toEqual([
      { fretsArray: [2], count: 2, scope: 'song' },
      { fretsArray: [1], count: 50, scope: 'global' },
    ]);
  });

  // Uma forma consagrada no dicionário não pode aparecer duas vezes só porque também
  // foi votada nesta música — `applyCurationOrder` sintetizaria um card duplicado.
  it('não repete a forma que existe nos dois escopos', () => {
    const out = pickPopularVoicings([entry([0, 2, 2], 40), entry([0, 2, 2], 1, 'asa-branca')], 'asa-branca');
    expect(out).toHaveLength(1);
    expect(out[0].scope).toBe('song');
  });

  it('descarta contagem zerada', () => {
    // O anti-spam do servidor devolve 0 para votos anulados; deixar passar permitiria que
    // uma forma envenenada reordenasse o card sem ter voto válido nenhum.
    expect(pickPopularVoicings([entry([1], 0), entry([2], 1)])).toEqual([
      { fretsArray: [2], count: 1, scope: 'global' },
    ]);
  });

  it('ignora o escopo da música quando nenhuma música foi informada', () => {
    const out = pickPopularVoicings([entry([1], 5, 'asa-branca'), entry([2], 1)]);
    expect(out).toEqual([{ fretsArray: [2], count: 1, scope: 'global' }]);
  });
});

describe('countFor', () => {
  it('soma os escopos da mesma forma', () => {
    const list = [entry([0, 2], 4), entry([0, 2], 3, 'asa-branca'), entry([5, 7], 99)];
    expect(countFor(list, [0, 2])).toBe(7);
  });

  it('devolve 0 para forma sem voto', () => {
    expect(countFor([entry([0, 2], 4)], [9, 9])).toBe(0);
  });
});
