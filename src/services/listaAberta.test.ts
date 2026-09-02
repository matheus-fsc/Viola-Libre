import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abrirLista,
  caminhoDaCifra,
  fecharLista,
  lerLista,
  posicaoNaLista,
  type ListaAberta,
} from './listaAberta';
import { MAX_ENTRIES } from './cifraFavorites';

// O ambiente dos testes é Node puro (ver vitest.config.ts), então o `sessionStorage` do
// navegador não existe — aqui ele é um mapa, que é tudo que este módulo usa dele.
function instalarSessionStorage() {
  const dados = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
  });
  return dados;
}

const lista = (over: Partial<ListaAberta> = {}): ListaAberta => ({
  nome: 'Roda de terça',
  voltarPara: '/favoritos',
  chaves: ['almir-sater/tocando-em-frente', 'joao-bosco/o-bebado', 'goia/saudade'],
  ...over,
});

describe('abrir, ler e fechar', () => {
  beforeEach(() => { instalarSessionStorage(); });

  it('devolve a mesma lista que foi aberta', () => {
    abrirLista(lista());
    expect(lerLista()).toEqual(lista());
  });

  it('sem lista aberta, devolve null', () => {
    expect(lerLista()).toBeNull();
  });

  it('fechar apaga', () => {
    abrirLista(lista());
    fecharLista();
    expect(lerLista()).toBeNull();
  });
});

/**
 * O `sessionStorage` é do usuário: pode ter sido editado à mão, ter sobrado de uma versão
 * anterior do formato ou vir de outra aba. Nada aqui pode ser fatal — uma lista ilegível
 * tem que virar `null`, que é exatamente o estado de quem não veio de lista nenhuma.
 */
describe('lerLista com conteúdo suspeito', () => {
  let dados: Map<string, string>;
  beforeEach(() => { dados = instalarSessionStorage(); });

  const guardar = (v: unknown) => dados.set('vl_lista_aberta', JSON.stringify(v));

  it('recusa JSON quebrado', () => {
    dados.set('vl_lista_aberta', '{isso não é json');
    expect(lerLista()).toBeNull();
  });

  it('recusa o que não tem a forma de uma lista', () => {
    guardar({ nome: 'x' });
    expect(lerLista()).toBeNull();
    guardar({ nome: 'x', voltarPara: '/favoritos', chaves: 'nao-e-array' });
    expect(lerLista()).toBeNull();
    guardar({ nome: 1, voltarPara: '/favoritos', chaves: ['a/b'] });
    expect(lerLista()).toBeNull();
  });

  it('recusa lista vazia — não há o que percorrer', () => {
    guardar(lista({ chaves: [] }));
    expect(lerLista()).toBeNull();
  });

  it('recusa chave que não é texto', () => {
    guardar({ nome: 'x', voltarPara: '/favoritos', chaves: ['a/b', 42] });
    expect(lerLista()).toBeNull();
  });

  // Sem o teto, a barra diria "4 de 900000" e cada troca de música pagaria um `indexOf`
  // numa lista absurda.
  it('recusa lista acima do teto da estante', () => {
    guardar(lista({ chaves: Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => `a/m${i}`) }));
    expect(lerLista()).toBeNull();
  });

  // `voltarPara` vira o destino de um <Link>. Absoluto, ele tiraria a pessoa do site a
  // partir de um dado que mora no navegador dela.
  it('recusa destino que não é caminho interno', () => {
    for (const destino of ['https://exemplo.com', '//exemplo.com', 'javascript:alert(1)', 'favoritos']) {
      guardar(lista({ voltarPara: destino }));
      expect(lerLista()).toBeNull();
    }
  });

  it('aceita um caminho interno com query', () => {
    guardar(lista({ voltarPara: '/favoritos?cat=abc' }));
    expect(lerLista()?.voltarPara).toBe('/favoritos?cat=abc');
  });
});

describe('posicaoNaLista', () => {
  const l = lista();

  it('acha a cifra e monta os vizinhos', () => {
    const p = posicaoNaLista(l, 'joao-bosco', 'o-bebado');
    expect(p).toMatchObject({
      nome: 'Roda de terça',
      posicao: 2,
      total: 3,
      anterior: '/cifras/almir-sater/tocando-em-frente',
      proxima: '/cifras/goia/saudade',
    });
  });

  // A barra tem que sumir sozinha quando o músico sai da lista pelo "Ver artista" ou pela
  // busca, em vez de continuar afirmando "3 de 12" numa música que não é a terceira de nada.
  it('devolve null para uma cifra fora da lista', () => {
    expect(posicaoNaLista(l, 'outro', 'artista')).toBeNull();
  });

  it('devolve null quando não há lista', () => {
    expect(posicaoNaLista(null, 'joao-bosco', 'o-bebado')).toBeNull();
  });

  it('devolve null sem os slugs da rota', () => {
    expect(posicaoNaLista(l, undefined, 'o-bebado')).toBeNull();
    expect(posicaoNaLista(l, 'joao-bosco', undefined)).toBeNull();
  });

  it('nas pontas, o vizinho que não existe é null', () => {
    expect(posicaoNaLista(l, 'almir-sater', 'tocando-em-frente')).toMatchObject({ anterior: null, posicao: 1 });
    expect(posicaoNaLista(l, 'goia', 'saudade')).toMatchObject({ proxima: null, posicao: 3 });
  });

  // O slug da música chega com barra à frente em alguns caminhos de rota (ver `getCifra`),
  // e sem normalizar a cifra aberta nunca casaria com a chave guardada.
  it('ignora a barra à frente do slug', () => {
    expect(posicaoNaLista(l, 'joao-bosco', '/o-bebado')?.posicao).toBe(2);
  });

  it('traz os títulos dos vizinhos quando a estante os conhece', () => {
    const titulos = new Map([
      ['almir-sater/tocando-em-frente', 'Tocando em Frente'],
      ['goia/saudade', 'Saudade da Minha Terra'],
    ]);
    const p = posicaoNaLista(l, 'joao-bosco', 'o-bebado', titulos);
    expect(p?.tituloAnterior).toBe('Tocando em Frente');
    expect(p?.tituloProxima).toBe('Saudade da Minha Terra');
  });

  it('sem os títulos, os botões continuam válidos', () => {
    const p = posicaoNaLista(l, 'joao-bosco', 'o-bebado', new Map());
    expect(p?.tituloAnterior).toBeNull();
    expect(p?.proxima).toBe('/cifras/goia/saudade');
  });

  // Uma lista de uma música só existe (busca que achou uma). A barra ainda serve: ela é o
  // caminho de volta para a lista.
  it('lista de um item só não quebra', () => {
    const p = posicaoNaLista(lista({ chaves: ['a/b'] }), 'a', 'b');
    expect(p).toMatchObject({ posicao: 1, total: 1, anterior: null, proxima: null });
  });
});

describe('caminhoDaCifra', () => {
  it('monta a rota a partir da chave', () => {
    expect(caminhoDaCifra('almir-sater/tocando-em-frente')).toBe('/cifras/almir-sater/tocando-em-frente');
  });
});
