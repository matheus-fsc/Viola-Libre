/**
 * O que estes testes protegem.
 *
 * A paridade de chaves já é garantida pelo tipo `Dicionario`, que reprova o `tsc -b`.
 * O que o tipo NÃO pega é o que sobra depois: tradução esquecida com o texto português
 * copiado, chave de interpolação que mudou de nome de um lado só, e travessão voltando
 * para o texto de interface. São justamente os erros que passam pelo compilador e
 * aparecem na tela de quem usa.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import { getIdioma, setIdioma, t, IDIOMAS } from './index';

type No = { [k: string]: string | No };

/** Achata o dicionário em `{ 'sobre.titulo': 'Sobre o Viola Libre', … }`. */
function achatar(no: No, prefixo = ''): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(no)) {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    if (typeof valor === 'string') saida[caminho] = valor;
    else Object.assign(saida, achatar(valor, caminho));
  }
  return saida;
}

const PT = achatar(ptBR as unknown as No);
const EN = achatar(en as unknown as No);

/** `{quantidade}` e `{secao}`, na ordem em que aparecem, sem repetição. */
function variaveis(texto: string): string[] {
  return [...new Set(Array.from(texto.matchAll(/\{(\w+)\}/g), m => m[1]))].sort();
}

describe('dicionários', () => {
  it('têm exatamente as mesmas chaves', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(PT).sort());
  });

  it('não têm texto vazio', () => {
    for (const [chave, texto] of Object.entries({ ...PT, ...EN })) {
      expect(texto.trim(), chave).not.toBe('');
    }
  });

  it('usam as mesmas variáveis de interpolação nos dois idiomas', () => {
    for (const chave of Object.keys(PT)) {
      expect(variaveis(EN[chave]), chave).toEqual(variaveis(PT[chave]));
    }
  });

  /*
   * A regra da casa: travessão não entra em texto de interface. Em tela estreita e no
   * leitor de tela ele vira pausa longa sem função, e a mesma frase sai melhor com
   * vírgula, dois-pontos ou ponto final. O teste existe porque a tecla é fácil de
   * apertar sem querer ao copiar texto de outro lugar do projeto.
   */
  it('não trazem travessão nem meia-risca', () => {
    for (const [chave, texto] of Object.entries({ ...PT, ...EN })) {
      expect(texto, `${chave}: "${texto}"`).not.toMatch(/[—–]/);
    }
  });

  /*
   * Tradução esquecida é uma cópia literal do português. Ficam de fora os casos em que
   * as duas línguas coincidem de verdade: nome próprio, sigla e pontuação solta.
   */
  it('não deixam texto português copiado para o inglês', () => {
    const iguaisDePropósito = new Set([
      'comum.ok',
      'app.tituloJanela',
      'abas.desktop',
      'seo.desktop.title',
      'sobre.nome',
      'sobre.linkLicenca',
      'sobre.licenca',
      'barraTarefas.editor',
      'abasCurtas.privacidade',
      // Estrangeirismo que a UI em português já usa cru: traduzir "+ Views" para
      // "+ Visualizações" seria trocar o rótulo curto por um que não cabe no botão.
      'explorador.rankingViews',
      'explorador.rankingLikes',
    ]);
    for (const chave of Object.keys(PT)) {
      if (iguaisDePropósito.has(chave)) continue;
      expect(EN[chave], chave).not.toBe(PT[chave]);
    }
  });
});

describe('t()', () => {
  beforeEach(() => setIdioma('pt-BR'));

  it('busca o texto do idioma ativo', () => {
    expect(t('comum.fechar')).toBe('Fechar');
    setIdioma('en');
    expect(t('comum.fechar')).toBe('Close');
  });

  it('substitui as variáveis', () => {
    expect(t('favoritas.titulo', { quantidade: 3 })).toContain('(3)');
  });

  it('deixa passar o que não foi informado, em vez de escrever "undefined"', () => {
    expect(t('favoritas.titulo')).toContain('{quantidade}');
  });

  it('começa em pt-BR neste ambiente e troca para os idiomas anunciados', () => {
    expect(getIdioma()).toBe('pt-BR');
    for (const { id } of IDIOMAS) {
      setIdioma(id);
      expect(getIdioma()).toBe(id);
    }
  });
});
