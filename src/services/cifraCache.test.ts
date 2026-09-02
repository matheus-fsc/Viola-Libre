import { describe, expect, it } from 'vitest';
import {
  faltaBaixar,
  formatarBytes,
  tamanhoEmBytes,
  vaiParaOCache,
  BYTES_POR_CIFRA_ESTIMADO,
} from './cifraCache';
import type { CifraDetail } from './api';

const cifra = (over: Partial<CifraDetail> = {}): CifraDetail => ({
  id: 1,
  title: 'Tocando em Frente',
  content_html: '<pre><b>G</b> Ainda que eu tenha muito o que falar…</pre>',
  views: 10,
  favorited: 2,
  difficulty: null,
  version_name: '',
  ...over,
});

/**
 * A API devolve 200 com corpo vazio para música inexistente (medido: 34 bytes). Guardar
 * isso deixaria no cache um buraco que se comporta como "já baixei" e nunca mostra a
 * cifra — o cache memorizaria um erro.
 */
describe('vaiParaOCache', () => {
  it('aceita uma cifra de verdade', () => {
    expect(vaiParaOCache(cifra())).toBe(true);
  });

  it('recusa resposta vazia ou sem conteúdo', () => {
    expect(vaiParaOCache(null)).toBe(false);
    expect(vaiParaOCache({})).toBe(false);
    expect(vaiParaOCache(cifra({ title: '' }))).toBe(false);
    expect(vaiParaOCache(cifra({ content_html: '' }))).toBe(false);
    expect(vaiParaOCache(cifra({ content_html: '<pre></pre>' }))).toBe(false);
  });
});

describe('faltaBaixar', () => {
  it('deixa de fora o que já está guardado', () => {
    expect(faltaBaixar(['a/1', 'b/2', 'c/3'], new Set(['b/2']))).toEqual(['a/1', 'c/3']);
  });

  it('não baixa a mesma cifra duas vezes numa lista com repetição', () => {
    expect(faltaBaixar(['a/1', 'a/1', 'b/2'], new Set())).toEqual(['a/1', 'b/2']);
  });

  it('lista já inteira no aparelho não gera download nenhum', () => {
    expect(faltaBaixar(['a/1', 'b/2'], new Set(['a/1', 'b/2']))).toEqual([]);
  });
});

describe('formatarBytes', () => {
  it('escolhe a unidade e usa a vírgula do português', () => {
    expect(formatarBytes(512)).toBe('512 B');
    expect(formatarBytes(10 * 1024)).toBe('10 KB');
    expect(formatarBytes(1024 * 1024)).toBe('1,0 MB');
    expect(formatarBytes(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });

  it('nada guardado é zero, não vazio', () => {
    expect(formatarBytes(0)).toBe('0 B');
  });

  // A quota do navegador é medida em GB; sem este degrau ela aparecia como "3072,1 MB",
  // que é um número que ninguém lê como espaço em disco.
  it('chega a GB, que é a ordem da quota do navegador', () => {
    expect(formatarBytes(3 * 1024 * 1024 * 1024)).toBe('3,0 GB');
    expect(formatarBytes(1024 * 1024 * 1024 - 1)).toMatch(/MB$/);
  });
});

describe('tamanhoEmBytes', () => {
  it('mede em bytes UTF-8, não em caracteres', () => {
    // "ç" e "ã" ocupam dois bytes cada: contar caracteres subestimaria todo título em
    // português, que é a maioria do acervo.
    const comAcento = tamanhoEmBytes(cifra({ title: 'Coração' }));
    const semAcento = tamanhoEmBytes(cifra({ title: 'Coracao' }));
    expect(comAcento).toBe(semAcento + 2);
  });

  // A estimativa mostrada antes de baixar sai desta média; se ela ficar longe do real, a
  // tela passa a prometer um tamanho que não se cumpre.
  it('a média estimada é da ordem de uma cifra real', () => {
    const real = tamanhoEmBytes(cifra({ content_html: '<pre>' + 'linha da letra\n'.repeat(600) + '</pre>' }));
    expect(real).toBeGreaterThan(BYTES_POR_CIFRA_ESTIMADO / 4);
    expect(real).toBeLessThan(BYTES_POR_CIFRA_ESTIMADO * 4);
  });
});
