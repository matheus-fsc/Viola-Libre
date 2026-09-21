/**
 * O que estes testes protegem.
 *
 * A paridade de chaves já é garantida pelo tipo `Dicionario`, que reprova o `tsc -b`.
 * O que o tipo NÃO pega é o que sobra depois: tradução esquecida com o texto português
 * copiado, chave de interpolação que mudou de nome de um lado só, e travessão voltando
 * para o texto de interface. São justamente os erros que passam pelo compilador e
 * aparecem na tela de quem usa.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import { getIdioma, setIdioma, t, IDIOMAS, idiomaDasEtiquetas, tSeo, type Chave } from './index';

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
      'barraTarefas.editor',
      // Estrangeirismo que a UI em português já usa cru: traduzir "+ Views" para
      // "+ Visualizações" seria trocar o rótulo curto por um que não cabe no botão.
      'explorador.rankingViews',
      'explorador.rankingLikes',
      // Palavras que os dois idiomas escrevem igual: termo técnico de música, sigla,
      // ou rótulo que já era estrangeirismo no português.
      'cifra.loop',
      'cifra.rotuloLoop',
      'cifra.rotuloBpm',
      'cifra.timing',
      'cifra.folhaTabs',
      'cifra.folhaInstrumentoCurto',
      'cifra.folhaApiBpm',
      'tom.pontos',
      // Exemplo de cifra: é uma letra brasileira, e traduzir a letra de exemplo
      // ensinaria a sintaxe com um dado que o acervo não tem.
      'minhasCifras.colchetesExemplo',
      'minhasCifras.conteudoExemplo',
      'minhasCifras.campoTituloExemplo',
      'favoritos.categoriasCurto',
      'cifra.tomOriginal',
      'acordes.tabRotulo',
      // Nome próprio de afinação da viola caipira: «Rio Abaixo» não tem tradução,
      // do mesmo jeito que «Cebolão» não vira «Big Onion».
      'teoria.licao4RioAbaixo',
      'impressao.layout',
      'impressao.rodapeSite',
      // Vocabulário de estúdio: «Intro», «Solo», «Instrumental», «Coda», «Loop», «Play»
      // e «BPM» são os mesmos nos dois idiomas, e «m:ss» é formato de hora.
      'timing.secIntro',
      'timing.secSolo',
      'timing.secInstrumental',
      'timing.secCoda',
      'timing.chipInstr',
      'timing.bpm',
      'timing.tempoPlaceholder',
      'timing.loop',
      'timing.play',
      // «Add», «Timeline», «Reset» e «Tempo» a UI em português já usa cru; «Anunciação»
      // é nome de música e «109 BPM» é número.
      'ouvido.add',
      'ouvido.tempoPadraoMusica',
      'ouvido.tempoPadraoBpm',
      'ouvido.timeline',
      'ouvido.resetRange',
      'ouvido.tempoRotulo',
      // «editor» é a mesma palavra nos dois idiomas.
      'documentos.priv1bForte',
      // Nome de empresa não se traduz.
      'documentos.priv5Cloudflare',
      'documentos.priv5YouTube',
      'documentos.priv5GitHub',
      // Cifra de acorde e a palavra «Original», que os dois idiomas escrevem igual.
      'musica.comoIv7',
      'musica.descOriginal',
    ]);
    for (const chave of Object.keys(PT)) {
      if (iguaisDePropósito.has(chave)) continue;
      // Texto que é só forma: «{secao} · {tempo}», «{n} pts». Tirando as variáveis não
      // sobra palavra nenhuma para traduzir, e exigir diferença aqui obrigaria a inventar
      // uma. A regra é automática de propósito: uma lista de exceções cresceria a cada
      // chave de formato nova e viraria o lugar onde uma tradução esquecida se esconde.
      if (!/\p{L}{2}/u.test(PT[chave].replace(/\{\w+\}/g, ''))) continue;
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

/*
 * A detecção de idioma não tinha teste, e foi por aí que o site passou a abrir em
 * inglês para quase todo mundo: a regra era "português se começar com pt, senão
 * inglês". O único teste que encostava no assunto rodava no Node, onde
 * `navigator.language` não existe — e o caminho do `navigator` vazio era justamente
 * o que devolvia o padrão certo, escondendo o erro.
 */
describe('idiomaDasEtiquetas()', () => {
  it('reconhece português em qualquer região', () => {
    for (const etiqueta of ['pt', 'pt-BR', 'pt-PT', 'PT-br', 'pt_BR']) {
      expect(idiomaDasEtiquetas([etiqueta]), etiqueta).toBe('pt-BR');
    }
  });

  it('reconhece inglês em qualquer região', () => {
    for (const etiqueta of ['en', 'en-US', 'en-GB', 'EN', 'en_US']) {
      expect(idiomaDasEtiquetas([etiqueta]), etiqueta).toBe('en');
    }
  });

  it('respeita a ordem de preferência, e não só a primeira etiqueta', () => {
    expect(idiomaDasEtiquetas(['es-AR', 'pt-BR', 'en-US'])).toBe('pt-BR');
    expect(idiomaDasEtiquetas(['es-AR', 'en-US', 'pt-BR'])).toBe('en');
  });

  it('não escolhe idioma nenhum quando não reconhece', () => {
    expect(idiomaDasEtiquetas(['es-AR', 'fr-FR', 'it-IT'])).toBeNull();
    expect(idiomaDasEtiquetas([])).toBeNull();
    expect(idiomaDasEtiquetas([''])).toBeNull();
  });

  /*
   * O caso que quebrou. Aparelho em inglês não é o mesmo que aparelho sem idioma, mas
   * aparelho em espanhol também não é aparelho em inglês — e era assim que a regra
   * antiga o tratava.
   */
  it('não trata idioma desconhecido como inglês', () => {
    expect(idiomaDasEtiquetas(['es-CL'])).not.toBe('en');
  });
});

/*
 * Em 21/09/2026 a busca do Google mostrava violalibre.com.br com o resumo em inglês:
 * o renderizador roda com `navigator.language` em `en-US`, a interface montava em
 * inglês e a meta description ia para o índice traduzida. Existe UMA URL por página e
 * o conteúdo dela é português — o resumo tem de acompanhar o conteúdo, não quem bate
 * na porta.
 */
describe('tSeo()', () => {
  afterEach(() => setIdioma('pt-BR'));

  it('fica em pt-BR mesmo com a interface em inglês', () => {
    setIdioma('en');
    expect(t('seo.desktop.description')).toBe(EN['seo.desktop.description']);
    expect(tSeo('seo.desktop.description')).toBe(PT['seo.desktop.description']);
  });

  it('vale para todas as chaves de metadado, não só a home', () => {
    setIdioma('en');
    for (const chave of ['seo.chords.title', 'seo.chords.description', 'explorador.seoTitle']) {
      expect(tSeo(chave as Chave), chave).toBe(PT[chave]);
    }
  });

  it('interpola igual ao `t`', () => {
    expect(tSeo('grafo.seoTitle', { musica: 'Tocando Em Frente' })).toContain('Tocando Em Frente');
  });
});
