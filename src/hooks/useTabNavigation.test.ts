import { describe, expect, it } from 'vitest';
import { resolveTabTarget, tabFromPathname, TAB_ROOT_PATH } from './useTabNavigation';

describe('tabFromPathname', () => {
  it('reconhece cada aba pela rota', () => {
    expect(tabFromPathname('/cifras')).toBe('cifras');
    expect(tabFromPathname('/minhascifras')).toBe('minhascifras');
    expect(tabFromPathname('/chords')).toBe('chords');
    expect(tabFromPathname('/treinos')).toBe('train');
    expect(tabFromPathname('/ouvido')).toBe('ear');
    expect(tabFromPathname('/favoritos')).toBe('favorites');
    expect(tabFromPathname('/termos')).toBe('termos');
  });

  it('mantém as sub-rotas de cifras dentro da aba cifras', () => {
    expect(tabFromPathname('/cifras/os-novos-baianos')).toBe('cifras');
    expect(tabFromPathname('/cifras/os-novos-baianos/misterio-do-planeta')).toBe('cifras');
    expect(tabFromPathname('/cifras/os-novos-baianos/misterio-do-planeta/timing')).toBe('cifras');
  });

  it('cai em cifras para rota desconhecida', () => {
    expect(tabFromPathname('/')).toBe('cifras');
    expect(tabFromPathname('/qualquer-coisa')).toBe('cifras');
  });
});

// O ponto do recurso: sair de uma cifra pro Dicionário de Acordes e voltar não
// pode custar refazer artista → música.
describe('resolveTabTarget', () => {
  const cifraAberta = '/cifras/os-novos-baianos/misterio-do-planeta';

  it('volta pro ponto memorizado ao trocar de aba', () => {
    expect(resolveTabTarget('cifras', 'chords', cifraAberta)).toBe(cifraAberta);
  });

  it('vai pra raiz quando a aba ainda não tem memória', () => {
    expect(resolveTabTarget('cifras', 'chords', undefined)).toBe(TAB_ROOT_PATH.cifras);
    expect(resolveTabTarget('train', 'cifras', undefined)).toBe('/treinos');
  });

  // Clicar na aba onde já se está é o gesto de "subir um nível" — sem isso o
  // usuário ficaria preso na cifra sem um caminho óbvio de volta pra lista.
  it('reseta pra raiz ao clicar na aba já ativa', () => {
    expect(resolveTabTarget('cifras', 'cifras', cifraAberta)).toBe(TAB_ROOT_PATH.cifras);
  });

  it('preserva a query string memorizada', () => {
    expect(resolveTabTarget('cifras', 'chords', '/cifras?busca=luiz')).toBe('/cifras?busca=luiz');
  });
});
