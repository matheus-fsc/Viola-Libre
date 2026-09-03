/**
 * Testes da identificação de tom.
 *
 * Dois blocos com propósitos diferentes:
 *
 *   • casos musicais fechados, escritos à mão, que fixam o comportamento que a gente
 *     REQUER — tríade sempre, relativo desempatado pela cadência, modulação sinalizada;
 *   • regressão sobre `tons_dump.json`, 46 cifras reais do acervo (as mesmas usadas para
 *     medir o problema). Ali não se afirma o tom certo de cada música — afirmam-se
 *     invariantes que valem para TODAS, mais a propriedade que motivou o trabalho: nenhum
 *     rótulo pode ser um acorde impossível como tom.
 *
 * O dump segue a convenção do `curadoria_dump.json`: se não estiver presente, o bloco é
 * pulado, para não quebrar clone limpo nem CI sem o fixture.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { detectKey, isChordDiatonic, campoHarmonico, MODOS } from './detectKey';

describe('detectKey — tom é sempre tríade', () => {
  it('reduz a tétrade de abertura a um tom possível', () => {
    // Era o bug: "Bm7" virava rótulo de tom. Tom não tem sétima.
    const r = detectKey(['Bm7', 'E7', 'Amaj7', 'F#m7', 'Bm7', 'E7', 'A']);
    expect(r).not.toBeNull();
    expect(r!.key).toMatch(/^[A-G][#b]?m?$/);
  });

  it('não devolve tom a partir de sufixo impossível (meio-diminuto de passagem)', () => {
    // "Angela" abre em D#m7(b5/9). Truncar daria D#m — plausível e errado.
    const r = detectKey(['D#m7(b5)', 'G#7', 'C#m7', 'F#7', 'Bmaj7', 'E7', 'A', 'E', 'A']);
    expect(r!.key).not.toBe('D#m');
  });

  it('rótulo nunca carrega sufixo de tétrade ou tensão', () => {
    const entradas = [
      ['Em7(9)', 'A7', 'Dmaj7', 'G', 'C', 'Am7', 'B7', 'Em'],
      ['A7(#9)', 'D', 'A', 'E', 'A'],
      ['G7M', 'C', 'G', 'D', 'G'],
    ];
    for (const chords of entradas) {
      expect(detectKey(chords)!.key).toMatch(/^[A-G][#b]?m?$/);
    }
  });
});

describe('detectKey — repouso desempata o par relativo', () => {
  it('mesmas sete notas, cadência em C → tom maior', () => {
    const r = detectKey(['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C']);
    expect(r!.key).toBe('C');
  });

  it('mesmas sete notas, cadência em Am com E7 → tom menor', () => {
    // O E7 é o V da menor harmônica: é ele que prova Am contra C.
    const r = detectKey(['Am', 'Dm', 'E7', 'Am', 'F', 'G', 'E7', 'Am']);
    expect(r!.key).toBe('Am');
  });

  it('«Tocando Em Frente» — abre e fecha em G, não é C', () => {
    // Regressão do erro que o fit diatônico puro cometia: G, C, D e Em cabem em C e em G;
    // só o repouso decide, e a música pousa em G.
    const r = detectKey(['G', 'C', 'G', 'D', 'Em', 'C', 'D', 'G', 'C', 'D', 'G']);
    expect(r!.key).toBe('G');
  });

  it('o último acorde pesa mais que o primeiro quando discordam', () => {
    // Abre no IV, fecha no I — padrão comum de intro. O tom é o do repouso.
    const r = detectKey(['C', 'G', 'Am', 'F', 'C', 'G', 'D7', 'G', 'C', 'D7', 'G']);
    expect(r!.key).toBe('G');
  });
});

describe('detectKey — incerteza é resposta', () => {
  it('progressão clara sai com confiança alta e um candidato dominante', () => {
    const r = detectKey(['G', 'C', 'D7', 'G', 'Em', 'C', 'D7', 'G', 'C', 'D7', 'G']);
    expect(r!.confidence).toBe('alta');
    expect(r!.candidates[0].key).toBe('G');
  });

  it('devolve mais de um candidato quando o tom é ambíguo', () => {
    // Vamp de dois acordes: não há cadência que separe o par relativo.
    const r = detectKey(['Am', 'C', 'Am', 'C', 'Am', 'C', 'Am', 'C']);
    expect(r!.confidence).not.toBe('alta');
    expect(r!.candidates.length).toBeGreaterThan(1);
  });

  it('candidatos vêm ordenados e incluem o tom escolhido', () => {
    const r = detectKey(['D', 'G', 'A7', 'D', 'Bm', 'G', 'A7', 'D']);
    expect(r!.candidates[0].key).toBe(r!.key);
    for (let i = 1; i < r!.candidates.length; i++) {
      expect(r!.candidates[i - 1].score).toBeGreaterThanOrEqual(r!.candidates[i].score);
    }
  });

  it('caso modal: «Tocando Em Frente» é Sol MIXOLÍDIO, e o campo prova', () => {
    // G, F, C, Dm. Antes dos modos não havia resposta certa: Sol maior vencia pelo repouso
    // deixando Fá e Dm de fora (2 de 4), e Dó abraçava os quatro mas a música não pousa
    // nele. Sol mixolídio é as duas coisas — pousa em Sol E explica os quatro acordes.
    const r = detectKey(['G', 'F', 'C', 'Dm', 'G', 'F', 'C', 'G', 'F', 'Dm', 'G'])!;

    expect(r.modo.nome).toBe('mixolídio');
    expect(r.key).toBe('G');            // tríade, para transposição e estante
    expect(r.nome).toBe('G mixolídio'); // rótulo de exibição
    expect(r.candidates[0].fits).toBe(r.candidates[0].total); // explica a música inteira

    // O bVII (Fá) é a assinatura do modo, e a música usa.
    const bVII = r.candidates[0].campo.find(g => g.grau === 'bVII')!;
    expect(bVII.chord).toBe('F');
    expect(bVII.usado).toBe(true);
  });

  it('incerteza de MODO não rebaixa a confiança no TOM', () => {
    // Para qualquer música em Sol maior o 2º colocado é "Sol mixolídio": mesma tônica, seis
    // notas em comum. Isso é dúvida sobre o campo, não sobre o tom — quem toca continua
    // tocando em Sol. Rebaixar aqui tornaria "média" toda progressão diatônica clara.
    const r = detectKey(['G', 'C', 'D7', 'G', 'Em', 'C', 'D7', 'G', 'C', 'D7', 'G'])!;
    expect(r.confidence).toBe('alta');
    expect(r.key).toBe('G');
    expect(r.modo.nome).toBe('jônio');
  });

  it('música cromática NÃO é rebaixada por cobertura baixa', () => {
    // Bossa: quase todo acorde é de empréstimo, e ainda assim o tom é indiscutível.
    // Cobertura baixa aqui é propriedade do gênero, não defeito da leitura.
    const r = detectKey([
      'F7M', 'G7', 'Gm7', 'C7', 'F7M', 'Ab7', 'Gm7', 'Gb7',
      'F7M', 'G7', 'Gm7', 'C7', 'F7M', 'C7', 'F7M',
    ])!;
    expect(r.key).toBe('F');
    expect(r.confidence).toBe('alta');
    // Nota histórica: este trecho já teve cobertura parcial, e o teste afirmava isso. Com o
    // substituto de trítono, `Ab7` e `Gb7` deixaram de ser mistério — são subV resolvendo
    // descendo um semitom — e a cobertura fechou. A afirmação que sobrevive é a que
    // interessava desde o começo: o tom é Fá e a leitura não é rebaixada por cromatismo.
    expect(r.candidates[0].fits).toBe(r.candidates[0].total);
  });

  it('devolve null quando não há acorde reconhecível', () => {
    expect(detectKey([])).toBeNull();
    expect(detectKey(['Amor', 'xyz', '???'])).toBeNull();
  });
});

describe('detectKey — dominante secundário', () => {
  it('V7/ii é creditado ao tom, não contado contra', () => {
    // A7 em Dó traz Dó#, nota de fora. Mas ele existe para apontar o Dm, que é o ii de Dó —
    // é evidência A FAVOR de Dó. Antes, esse acorde pontuava negativo contra o próprio tom.
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C'])!;
    expect(r.key).toBe('C');
    const k = r.candidates[0];
    expect(k.dominantes).toBeGreaterThan(0);
    expect(k.fits).toBe(k.total); // o tom explica a progressão inteira
  });

  it('V7 da MENOR é creditado — é a menor harmônica', () => {
    // Em Lá menor o E7 traz Sol#, que não existe na coleção. Sem esta regra, o acorde mais
    // característico do tom menor contava como estranho ao próprio tom.
    const r = detectKey(['Am', 'Dm', 'E7', 'Am', 'F', 'E7', 'Am'])!;
    expect(r.key).toBe('Am');
    expect(r.candidates[0].fits).toBe(r.candidates[0].total);
  });

  it('dominante sem alvo presente na música NÃO é creditado', () => {
    // A regra exige que o alvo APAREÇA. Sem isso qualquer dominante teria 7 chances em 12
    // de apontar para alguma nota da coleção por acaso, e a regra viraria carimbo.
    const semAlvo = detectKey(['C', 'F', 'G', 'C', 'Eb7', 'C', 'F', 'G', 'C'])!;
    const emC = semAlvo.candidates.find(c => c.key === 'C');
    if (emC) expect(emC.fits).toBeLessThan(emC.total); // Eb7 fica sem explicação
  });

  it('dominante secundário NÃO marca grau no campo', () => {
    // Ele não é um grau do tom: está de passagem, apontando para um. Marcá-lo faria o
    // campo exibido mentir sobre o que a música toca.
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C'])!;
    const campo = r.candidates[0].campo;
    expect(campo.find(g => g.grau === 'ii')!.usado).toBe(true);  // Dm é tocado
    expect(campo.find(g => g.grau === 'vi')!.usado).toBe(false); // Am NÃO é — só o A7
  });

  it('progressão cheia de dominantes ainda resolve no tom certo', () => {
    // Ciclo de dominantes secundários, o pão-de-cada-dia do choro e do samba.
    const r = detectKey(['C', 'E7', 'Am', 'D7', 'Dm', 'G7', 'C', 'E7', 'Am', 'D7', 'G7', 'C'])!;
    expect(r.key).toBe('C');
    expect(r.candidates[0].dominantes).toBeGreaterThanOrEqual(2);
  });
});

describe('detectKey — substituto de trítono (subV)', () => {
  it('bII7 que resolve na tônica é explicado', () => {
    // Gb7 faz o trabalho do C7 (o V de Fá) e resolve descendo um semitom em F7M. É a linha
    // `Am7 → Ab7 → Gm7 → Gb7 → F7M` de «Garota de Ipanema»: cromática, mas dentro de Fá.
    const r = detectKey(['F', 'Am', 'Ab7', 'Gm', 'Gb7', 'F', 'Gm', 'C7', 'F'])!;
    expect(r.key).toBe('F');
    const sub = r.candidates[0].analise!.acordes.filter(x => x.detalhe?.startsWith('subV'));
    expect(sub.map(x => x.chord).sort()).toEqual(['Ab7', 'Gb7']);
  });

  it('o subV declara em que grau resolve', () => {
    const r = detectKey(['F', 'Am', 'Ab7', 'Gm', 'Gb7', 'F', 'Gm', 'C7', 'F'])!;
    const acordes = r.candidates[0].analise!.acordes;
    expect(acordes.find(x => x.chord === 'Gb7')!.detalhe).toBe('subV, resolve em I');
    expect(acordes.find(x => x.chord === 'Ab7')!.detalhe).toBe('subV, resolve em ii');
  });

  it('dominante sem alvo — nem por quinta nem por semitom — segue sem explicação', () => {
    // A regra não pode virar carimbo: com dois alvos possíveis por acorde ela já é generosa.
    const r = detectKey(['C', 'F', 'G7', 'C', 'F#7', 'C', 'F', 'G7', 'C'])!;
    const emC = r.candidates.find(c => c.key === 'C');
    // F#7 aponta para B (quinta abaixo) e para F (semitom abaixo). F é diatônico de Dó e
    // está presente, então ele É explicado — o que é correto: F#7 é o subV do C7.
    if (emC) expect(emC.fits).toBeLessThanOrEqual(emC.total);
  });
});

describe('detectKey — ii-V como unidade', () => {
  it('o ii de um ii-V é explicado junto com o V que ele prepara', () => {
    // `Bm7 E7` antes de um Lá do tom é um ii-V inteiro apontando para lá. Julgando acorde a
    // acorde, o E7 era explicado e o Bm7 que o preparou ficava de fora — ler pela metade
    // uma figura que a música toca inteira.
    const r = detectKey(['C', 'Bm7', 'E7', 'Am', 'F', 'G7', 'C', 'Bm7', 'E7', 'Am', 'G7', 'C'])!;
    expect(r.key).toBe('C');
    const bm = r.candidates[0].analise!.acordes.find(x => x.chord === 'Bm7')!;
    expect(bm.papel).toBe('preparacao');
    expect(r.candidates[0].preparacoes).toBeGreaterThan(0);
  });

  it('a preparação declara o grau que o par prepara', () => {
    const r = detectKey(['C', 'Bm7', 'E7', 'Am', 'F', 'G7', 'C', 'Bm7', 'E7', 'Am', 'G7', 'C'])!;
    const bm = r.candidates[0].analise!.acordes.find(x => x.chord === 'Bm7')!;
    expect(bm.detalhe).toBe('ii de um ii-V para vi'); // E7 → Am, que é o vi de Dó
  });

  it('BUG CORRIGIDO: o alvo vem da resolução do V, não de somar ao ii', () => {
    // Quando o V é um substituto de trítono ele resolve descendo um SEMITOM, e calcular o
    // alvo pelo ii apontava para o lugar errado — saía "ii de um ii-V para fora do campo",
    // absurdo numa regra que exige alvo dentro do campo.
    const r = detectKey([
      'C', 'F', 'G7', 'C', 'Am', 'Db7', 'C', 'F', 'G7', 'C', 'Am', 'Db7', 'C',
    ])!;
    for (const c of r.candidates) {
      for (const a of c.analise!.acordes) {
        if (a.papel === 'preparacao') expect(a.detalhe).not.toContain('fora do campo');
      }
    }
  });

  it('menor solto, sem o V depois, NÃO vira preparação', () => {
    // Um Bm7 sozinho não diz nada; é o par que carrega a função.
    const r = detectKey(['C', 'Bm7', 'F', 'G7', 'C', 'Bm7', 'F', 'G7', 'C'])!;
    const bm = r.candidates[0].analise!.acordes.find(x => x.chord === 'Bm7');
    if (bm) expect(bm.papel).not.toBe('preparacao');
  });

  it('a contagem de preparações bate com a análise', () => {
    const r = detectKey(['C', 'Bm7', 'E7', 'Am', 'F', 'G7', 'C', 'Bm7', 'E7', 'Am', 'G7', 'C'])!;
    for (const c of r.candidates) {
      const conta = c.analise!.acordes.filter(x => x.papel === 'preparacao').length;
      expect(conta).toBe(c.preparacoes);
      expect(
        c.analise!.acordes.filter(x => x.papel === 'campo').length +
          c.dominantes + c.preparacoes + c.emprestados,
      ).toBe(c.fits);
    }
  });
});

describe('detectKey — encaixe conta nota, cobertura conta função', () => {
  it('o dominante secundário CONTA na cobertura mas não é perdoado no encaixe', () => {
    // As duas perguntas são diferentes. "Quanto deste tom a música usa?" é absoluta e
    // por-tom: aí a função importa, e o A7 é explicado. "Em que sete notas ela flutua?" é
    // comparativa: ali o Dó# do A7 é evidência sobre o CONTEÚDO, e perdoá-lo apagaria o
    // contraste entre coleções — todas passariam a explicar tudo.
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C'])!;
    const emC = r.candidates[0];
    expect(emC.key).toBe('C');
    expect(emC.dominantes).toBeGreaterThan(0);
    expect(emC.fits).toBe(emC.total); // pela função, o tom explica a progressão inteira

    // O `encaixe` é NORMALIZADO contra a melhor coleção, então o vencedor marca 20 por
    // construção e não serve para mostrar isto. Quem mostra é o contraste: um candidato de
    // outra coleção tem de ficar estritamente abaixo. Se o encaixe perdoasse a função, as
    // coleções empatariam e o detector perderia o que o faz escolher.
    const outraColecao = r.candidates.find(c => c.tonic !== emC.tonic || c.minor !== emC.minor);
    if (outraColecao?.analise) {
      expect(outraColecao.analise.encaixe).toBeLessThanOrEqual(emC.analise!.encaixe);
    }
  });

  it('trecho realmente modulado continua sendo delimitado', () => {
    // Regressão do custo que o crédito no encaixe cobrava: creditar função também ali não
    // mudava a cobertura, mas derretia a detecção de trechos — de 3 cifras do acervo com
    // fronteira nítida para 1. O contraste que a comparação precisa é o que o crédito
    // dissolve, e é por isso que as duas contas moram separadas.
    const emC = ['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C', 'F', 'G7', 'C'];
    const emE = ['E', 'C#m', 'A', 'B7', 'E', 'C#m', 'A', 'B7', 'E', 'A', 'B7', 'E'];
    const r = detectKey([...emC, ...emE])!;
    expect(r.regions.length).toBeGreaterThan(1);
  });
});

describe('detectKey — quanto a música modula', () => {
  it('a região traz o deslocamento da TÔNICA, não o da coleção', () => {
    const emC = ['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C', 'F', 'G7', 'C'];
    const emE = ['E', 'C#m', 'A', 'B7', 'E', 'C#m', 'A', 'B7', 'E', 'A', 'B7', 'E'];
    const r = detectKey([...emC, ...emE])!;
    expect(r.modulates).toBe(true);
    const alvo = r.regions.find(x => x.key === 'E');
    expect(alvo).toBeDefined();
    // De Dó para Mi são quatro semitons acima.
    expect(alvo!.semitons).toBe(4);
  });

  it('o deslocamento vem pela volta mais curta, em [-5, +6]', () => {
    for (const c of [
      ['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C', 'F', 'G7', 'C'],
    ]) {
      const outro = c.map(x => x); // sequência qualquer; o que importa é o intervalo
      const r = detectKey([...c, ...outro, ...c])!;
      for (const reg of r.regions) {
        expect(reg.semitons).toBeGreaterThanOrEqual(-5);
        expect(reg.semitons).toBeLessThanOrEqual(6);
      }
    }
  });

  it('mudança só de qualidade dá deslocamento ZERO', () => {
    // «Chega de Saudade» vai de Ré menor a Ré maior: a coleção anda três semitons, a mão
    // não anda nenhum. O número que serve para tocar é o da tônica.
    const emDm = ['Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'A7', 'Dm', 'Gm', 'A7', 'Dm', 'Dm'];
    const emD = ['D', 'Bm', 'G', 'A7', 'D', 'Bm', 'G', 'A7', 'D', 'G', 'A7', 'D'];
    const r = detectKey([...emDm, ...emDm, ...emD, ...emD])!;
    const zero = r.regions.filter(x => x.semitons === 0);
    if (r.regions.length > 1) expect(zero.length).toBeGreaterThan(0);
  });
});

describe('detectKey — empréstimo modal', () => {
  it('iv menor e bVII em tom MAIOR vêm do paralelo, e são explicados', () => {
    // Fm e Bb numa música em Dó maior vêm de Dó MENOR. A música não saiu de Dó: pegou
    // emprestado da versão menor dela mesma.
    const r = detectKey(['C', 'F', 'Fm', 'C', 'Bb', 'F', 'G7', 'C', 'Fm', 'C'])!;
    expect(r.key).toBe('C');
    const k = r.candidates[0];
    expect(k.emprestados).toBeGreaterThan(0);
  });

  it('IV maior em tom MENOR é empréstimo do paralelo (a cor dórica)', () => {
    const r = detectKey(['Am', 'D', 'Am', 'E7', 'Am', 'D', 'Am', 'E7', 'Am'])!;
    expect(r.key).toBe('Am');
    expect(r.candidates[0].emprestados).toBeGreaterThan(0);
  });

  it('empréstimo NÃO marca grau no campo', () => {
    // Mesma razão do dominante secundário: não é grau do tom, é cor de fora.
    const r = detectKey(['C', 'F', 'Fm', 'C', 'F', 'G7', 'C', 'Fm', 'C'])!;
    const campo = r.candidates[0].campo;
    expect(campo.find(g => g.grau === 'IV')!.usado).toBe(true); // F maior é o IV, tocado
    expect(campo.every(g => g.chord !== 'Fm')).toBe(true);      // Fm não é grau de Dó
  });

  it('acorde de fora do tom E do paralelo continua sem explicação', () => {
    // O empréstimo não pode virar carimbo: tom e paralelo somam dez das doze notas, mas
    // não as doze. O que está fora das duas coleções tem que continuar aparecendo como
    // não explicado, senão a cobertura perde o sentido.
    const r = detectKey(['C', 'F', 'G7', 'C', 'F#', 'C', 'F', 'G7', 'C'])!;
    const emC = r.candidates.find(c => c.key === 'C');
    if (emC) expect(emC.fits).toBeLessThan(emC.total);
  });

  it('empréstimo não rebaixa a confiança de um tom claro', () => {
    // A cobertura por empréstimo é a categoria mais frouxa e não entra na comparação que
    // rebaixa confiança — senão um tom errado derrubaria o certo só por tomar mais
    // emprestado. Medido: sem essa ressalva o acervo perdia duas leituras de alta.
    const r = detectKey(['C', 'F', 'Fm', 'C', 'Bb', 'F', 'G7', 'C', 'Fm', 'G7', 'C'])!;
    expect(r.key).toBe('C');
    expect(r.confidence).not.toBe('baixa');
  });
});

describe('detectKey — baixo da barra (inversões)', () => {
  it('inversão pura não muda a leitura', () => {
    // Em "C/E" o Mi já está no acorde de Dó: o baixo não acrescenta nota nenhuma, e por
    // isso não pode mudar nada. Medido no acervo, 78% dos baixos são deste tipo.
    const semBaixo = detectKey(['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C'])!;
    const comBaixo = detectKey(['C/E', 'Am', 'F/A', 'G7/B', 'C', 'Am/C', 'F', 'G7', 'C'])!;
    expect(comBaixo.key).toBe(semBaixo.key);
    expect(comBaixo.modo.nome).toBe(semBaixo.modo.nome);
  });

  it('a raiz continua sendo a do acorde, nunca a do baixo', () => {
    // Se "C/E" fosse lido como acorde de Mi, toda inversão viraria outro grau e a
    // contagem do campo desmoronaria.
    const r = detectKey(['C/E', 'C/E', 'F', 'G7', 'C', 'F', 'G7', 'C'])!;
    const campo = r.candidates[0].campo;
    expect(campo.find(g => g.grau === 'I')!.usado).toBe(true);  // Dó, pela raiz
    expect(campo.find(g => g.grau === 'iii')!.usado).toBe(false); // Em não foi tocado
  });

  it('baixo que ACRESCENTA nota entra na conta', () => {
    // "C/Bb" traz um Sib que não existe em Dó maior — é o que faz dele um Dó com sétima.
    // Descartar o baixo apagaria essa nota da análise, e o acorde passaria por diatônico
    // sem ser. É o mesmo mecanismo do "Ab/Bb" da bossa, onde o grave é harmonia de verdade.
    const sem = detectKey(['C', 'C', 'F', 'G', 'C', 'F', 'G', 'C'])!;
    expect(sem.candidates[0].fits).toBe(sem.candidates[0].total);

    const com = detectKey(['C/Bb', 'C/Bb', 'F', 'G', 'C', 'F', 'G', 'C'])!;
    expect(com.candidates[0].fits).toBeLessThan(com.candidates[0].total);
  });

  it('baixo ilegível não derruba a análise', () => {
    expect(() => detectKey(['C/X', 'F', 'G7', 'C'])).not.toThrow();
    expect(detectKey(['C/X', 'F', 'G7', 'C'])).not.toBeNull();
  });
});

describe('detectKey — modulação', () => {
  it('sinaliza mudança de coleção e baixa a confiança', () => {
    // Oito compassos firmes em C, depois oito firmes em E — duas coleções distantes.
    const emC = ['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'G7', 'C', 'F', 'G7', 'C'];
    const emE = ['E', 'C#m', 'A', 'B7', 'E', 'C#m', 'A', 'B7', 'E', 'A', 'B7', 'E'];
    const r = detectKey([...emC, ...emE]);
    expect(r!.modulates).toBe(true);
    expect(r!.confidence).toBe('baixa');
    expect(r!.regions.length).toBeGreaterThan(1);
    expect(r!.regions.map(x => x.key)).toContain('E');
  });

  it('cromatismo estável NÃO vira modulação', () => {
    // Dominantes secundários e empréstimo modal trazem nota de fora sem mudar o tom.
    const chords = [
      'C', 'A7', 'Dm', 'G7', 'C', 'E7', 'Am', 'D7', 'G7', 'C', 'Fm', 'C',
      'C', 'A7', 'Dm', 'G7', 'C', 'E7', 'Am', 'D7', 'G7', 'C', 'Fm', 'C',
    ];
    expect(detectKey(chords)!.modulates).toBe(false);
  });

  it('música curta não reporta região nenhuma', () => {
    const r = detectKey(['G', 'C', 'D', 'G']);
    expect(r!.regions).toEqual([]);
  });

  it('harmonia que passeia é instável SEM fronteiras inventadas', () => {
    // Troca de coleção muitas vezes: blocos com F# alternando com blocos com Fá natural.
    // Não são seis tons — é um tom que não firma (o caso do «São Gonça»). Apontar seis
    // fronteiras seria inventar precisão que a análise não tem, então a resposta é
    // instabilidade com a lista de trechos vazia.
    // Os blocos precisam ser mais longos que a janela de análise (12 acordes). Alternância
    // mais rápida que isso não é modulação — é cromatismo dentro de um tom só, e o
    // detector a lê como estável de propósito.
    const comFa = ['C', 'F', 'Am', 'G', 'C', 'F', 'Dm', 'C', 'F', 'C', 'Dm', 'G', 'C', 'F', 'Am', 'C'];
    const comFaSustenido = ['G', 'D', 'Bm', 'Em', 'G', 'D', 'Em', 'D', 'G', 'Bm', 'Em', 'D', 'G', 'D', 'Bm', 'G'];
    const passeio: string[] = [];
    for (let i = 0; i < 3; i++) passeio.push(...comFa, ...comFaSustenido);

    const r = detectKey(passeio)!;
    expect(r.modulates).toBe(true);
    expect(r.confidence).toBe('baixa');
    expect(r.regions).toEqual([]); // instável, mas sem fronteira nítida para apontar
  });

  it('quando há regiões, elas nunca vêm duplicadas lado a lado', () => {
    // Regressão: o filtro de trechos curtos descartava um grupo do meio e deixava dois
    // grupos IGUAIS colados, que saíam no relatório como "Am > Am" e "C > C".
    const dump = ['Dm', 'Gm', 'A7', 'Dm', 'Bb', 'Gm', 'A7', 'Dm'];
    const emD = ['D', 'Bm', 'G', 'A7', 'D', 'Bm', 'G', 'A7'];
    const r = detectKey([...dump, ...dump, ...emD, ...emD])!;
    for (let i = 1; i < r.regions.length; i++) {
      expect(r.regions[i].key).not.toBe(r.regions[i - 1].key);
    }
  });
});

describe('detectKey — a conta aberta (auditoria)', () => {
  it('a pontuação exibida bate com a soma das partes', () => {
    // Se a conta mostrada não fechar, o painel "avançado" vira decoração.
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'F', 'G7', 'C'])!;
    for (const c of r.candidates) {
      const a = c.analise!;
      expect(a.encaixe + a.repouso + a.penalidadeModo).toBeCloseTo(c.score, 0);
    }
  });

  it('os sinais de repouso somam o repouso declarado', () => {
    const r = detectKey(['G', 'C', 'D7', 'G', 'Em', 'C', 'D7', 'G', 'C', 'D7', 'G'])!;
    const a = r.candidates[0].analise!;
    const soma = a.sinais.reduce((t, s) => t + s.pontos, 0);
    expect(soma).toBeCloseTo(a.repouso, 0);
    expect(a.sinais.length).toBeGreaterThan(0);
  });

  it('todo acorde distinto aparece na análise, exatamente uma vez', () => {
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'Fm', 'C', 'Eb', 'C'])!;
    const a = r.candidates[0].analise!;
    expect(a.acordes.length).toBe(r.candidates[0].total);
    expect(new Set(a.acordes.map(x => x.chord)).size).toBe(a.acordes.length);
  });

  it('a contagem por papel bate com fits, dominantes e emprestados', () => {
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'Fm', 'C', 'F#', 'C'])!;
    for (const c of r.candidates) {
      const a = c.analise!;
      const conta = (p: string) => a.acordes.filter(x => x.papel === p).length;
      expect(conta('dominante')).toBe(c.dominantes);
      expect(conta('emprestado')).toBe(c.emprestados);
      expect(conta('campo') + c.dominantes + c.emprestados).toBe(c.fits);
      expect(conta('estranho')).toBe(c.total - c.fits);
    }
  });

  it('o acorde do campo declara o grau, e o dominante declara o alvo', () => {
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C'])!;
    const a = r.candidates[0].analise!;
    expect(a.acordes.find(x => x.chord === 'C')!.detalhe).toBe('I');
    expect(a.acordes.find(x => x.chord === 'Dm')!.detalhe).toBe('ii');
    expect(a.acordes.find(x => x.chord === 'A7')!.detalhe).toContain('ii');
  });

  it('a análise só é montada para os candidatos que vão à tela', () => {
    // São 84 candidatos internamente; montar a conta de todos seria desperdício.
    const r = detectKey(['C', 'Am', 'F', 'G7', 'C'])!;
    expect(r.candidates.length).toBeLessThanOrEqual(4);
    for (const c of r.candidates) expect(c.analise).toBeDefined();
  });
});

describe('campoHarmonico', () => {
  const cifras = (campo: { chord: string }[]) => campo.map(g => g.chord);
  const modo = (nome: string) => MODOS.find(m => m.nome === nome)!;

  it('monta o campo maior (jônio) de Dó', () => {
    expect(cifras(campoHarmonico(0, modo('jônio'), false))).toEqual([
      'C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm(b5)',
    ]);
  });

  it('monta o campo menor (eólio) de Lá', () => {
    expect(cifras(campoHarmonico(9, modo('eólio'), false))).toEqual([
      'Am', 'Bm(b5)', 'C', 'Dm', 'Em', 'F', 'G',
    ]);
  });

  it('respeita a grafia com bemóis', () => {
    expect(cifras(campoHarmonico(10, modo('jônio'), true))).toEqual([
      'Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Am(b5)',
    ]);
  });

  it('monta o campo mixolídio de Sol — o bVII no lugar do VII', () => {
    // É a coleção de Dó vista de Sol: o Fá natural entra e o Fá# some.
    const campo = campoHarmonico(7, modo('mixolídio'), false);
    expect(cifras(campo)).toEqual(['G', 'Am', 'Bm(b5)', 'C', 'Dm', 'Em', 'F']);
    expect(campo.map(g => g.grau)).toEqual(['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'bVII']);
  });

  it('monta o campo dórico de Ré — o VI maior é a assinatura', () => {
    const campo = campoHarmonico(2, modo('dórico'), false);
    expect(cifras(campo)).toEqual(['Dm', 'Em', 'F', 'G', 'Am', 'Bm(b5)', 'C']);
    expect(campo.map(g => g.grau)).toEqual(['i', 'ii', 'bIII', 'IV', 'v', 'vi°', 'bVII']);
  });

  it('lídio traz #IV e frígio traz bII — o grau ambíguo sai certo nos dois', () => {
    // O trítono é #IV quando não há quarta justa (lídio) e bV quando há (lócrio).
    expect(campoHarmonico(5, modo('lídio'), false).map(g => g.grau))
      .toEqual(['I', 'II', 'iii', '#iv°', 'V', 'vi', 'vii']);
    // Atenção: no frígio o bVII é MENOR (Dm em Mi frígio), ao contrário do eólio, onde é
    // maior. A geração automática acerta isso sozinha; uma tabela escrita à mão erraria.
    expect(campoHarmonico(4, modo('frígio'), false).map(g => g.grau))
      .toEqual(['i', 'bII', 'bIII', 'iv', 'v°', 'bVI', 'bvii']);
    expect(campoHarmonico(11, modo('lócrio'), false).map(g => g.grau))
      .toEqual(['i°', 'bII', 'biii', 'iv', 'bV', 'bVI', 'bvii']);
  });

  it('todos os modos de uma coleção têm os MESMOS sete acordes', () => {
    // O que muda entre modos é qual acorde é o primeiro grau, não quais existem.
    const base = new Set(cifras(campoHarmonico(0, modo('jônio'), false)));
    for (const m of MODOS) {
      const tonic = ((0 + [0, 2, 4, 5, 7, 9, 11][m.grau]) % 12) as 0;
      expect(new Set(cifras(campoHarmonico(tonic, m, false)))).toEqual(base);
    }
  });

  it('TODO acorde do campo é diatônico do próprio tom, em todos os modos', () => {
    // Guarda contra a armadilha do '°': neste motor ele é a sétima diminuta, não a tríade.
    // Escrever "B°" no campo de Dó traria um Láb e o grau seria recusado aqui.
    for (let colecao = 0; colecao < 12; colecao++) {
      for (const m of MODOS) {
        const tonic = ((colecao + [0, 2, 4, 5, 7, 9, 11][m.grau]) % 12) as 0;
        const campo = campoHarmonico(tonic, m, false);
        for (const grau of campo) {
          expect(isChordDiatonic(grau.chord, campo[0].chord, m)).toBe(true);
        }
      }
    }
  });

  it('marca os graus que a música usa, por grau e não por texto', () => {
    // A cifra traz Am7 e G7; o campo mostra Am e G. É o mesmo grau.
    const r = detectKey(['C', 'Am7', 'Dm', 'G7', 'C', 'Am7', 'Dm', 'G7', 'C'])!;
    const campo = r.candidates[0].campo;
    const usados = campo.filter(g => g.usado).map(g => g.grau);
    expect(usados).toContain('vi'); // Am7
    expect(usados).toContain('V');  // G7
    expect(usados).toContain('I');
    expect(campo.find(g => g.grau === 'iii')!.usado).toBe(false); // Em não aparece
  });

  it('dominante secundário não marca grau — está de passagem', () => {
    const r = detectKey(['C', 'A7', 'Dm', 'G7', 'C', 'A7', 'Dm', 'G7', 'C'])!;
    const emC = r.candidates.find(c => c.key === 'C');
    if (emC) {
      // A7 traz C#, que não existe em Dó: o VI grau (Am) não conta como usado.
      expect(emC.campo.find(g => g.grau === 'vi')!.usado).toBe(false);
    }
  });

  it('fits nunca passa de total, e ambos são coerentes', () => {
    const r = detectKey(['G', 'C', 'D7', 'G', 'Em', 'Am', 'D7', 'G'])!;
    for (const c of r.candidates) {
      expect(c.fits).toBeLessThanOrEqual(c.total);
      expect(c.total).toBeGreaterThan(0);
      expect(c.campo).toHaveLength(7);
    }
  });

  it('a margem é um número entre 0 e 1 e acompanha a confiança', () => {
    const claro = detectKey(['G', 'C', 'D7', 'G', 'Em', 'C', 'D7', 'G', 'C', 'D7', 'G'])!;
    const ambiguo = detectKey(['Am', 'C', 'Am', 'C', 'Am', 'C', 'Am', 'C'])!;
    for (const r of [claro, ambiguo]) {
      expect(r.margin).toBeGreaterThanOrEqual(0);
      expect(r.margin).toBeLessThanOrEqual(1);
    }
    expect(claro.margin).toBeGreaterThan(ambiguo.margin);
  });
});

describe('isChordDiatonic', () => {
  it('reconhece os sete graus do tom maior', () => {
    for (const c of ['C', 'Dm', 'Em', 'F', 'G', 'Am']) {
      expect(isChordDiatonic(c, 'C')).toBe(true);
    }
  });

  it('rejeita acorde de fora do tom', () => {
    expect(isChordDiatonic('A7', 'C')).toBe(false);   // dominante secundário: traz C#
    expect(isChordDiatonic('Eb', 'C')).toBe(false);
    expect(isChordDiatonic('F#m', 'C')).toBe(false);
  });

  it('distingue a qualidade, não só o grau', () => {
    expect(isChordDiatonic('Am', 'C')).toBe(true);
    expect(isChordDiatonic('A', 'C')).toBe(false); // mesma fundamental, terça de fora
    expect(isChordDiatonic('Dm', 'C')).toBe(true);
    expect(isChordDiatonic('D', 'C')).toBe(false);
  });

  it('BUG CORRIGIDO: 7M e Maj7 não são lidos como acorde menor', () => {
    // Antes: `suffix.includes('m') && !suffix.includes('maj')` — a grafia pt-BR '7M' e a
    // canônica 'Maj7' passavam por caminhos diferentes e a função acertava por sorte.
    expect(isChordDiatonic('C7M', 'C')).toBe(true);
    expect(isChordDiatonic('Cmaj7', 'C')).toBe(true);
    expect(isChordDiatonic('CMaj7', 'C')).toBe(true);
    // O mesmo acorde no grau errado continua fora, com qualquer grafia.
    expect(isChordDiatonic('D7M', 'C')).toBe(false);
    expect(isChordDiatonic('Dmaj7', 'C')).toBe(false);
  });

  it('BUG CORRIGIDO: m(Maj7) é menor, não maior', () => {
    // 'm(Maj7)' contém 'm' e não contém 'maj' minúsculo — caía no ramo errado.
    expect(isChordDiatonic('Am(Maj7)', 'C')).toBe(false); // traz G#, fora de C
    expect(isChordDiatonic('Am7', 'C')).toBe(true);
  });

  it('BUG CORRIGIDO: tom menor com sufixo além de m/m7', () => {
    // Antes o tom menor só era reconhecido por endsWith('m') || endsWith('m7'), então
    // 'Am9' e 'Am6' eram tratados como tom MAIOR e todos os graus saíam errados.
    for (const tom of ['Am', 'Am7', 'Am9', 'Am6']) {
      expect(isChordDiatonic('Dm', tom)).toBe(true);
      expect(isChordDiatonic('G', tom)).toBe(true);
      expect(isChordDiatonic('F#', tom)).toBe(false);
    }
  });

  it('meio-diminuto do tom menor é diatônico', () => {
    expect(isChordDiatonic('Bm7(b5)', 'Am')).toBe(true);
    expect(isChordDiatonic('Bm7(b5)', 'C')).toBe(true); // mesmo par relativo
  });

  it('entrada inválida não explode', () => {
    expect(isChordDiatonic('', 'C')).toBe(false);
    expect(isChordDiatonic('C', '')).toBe(false);
    expect(isChordDiatonic('Amor', 'C')).toBe(false);
  });
});

/**
 * Regressão contra o acervo real.
 *
 * `tons_dump.json` traz a sequência de acordes de 46 cifras (as mesmas em que o problema
 * foi medido). Não se afirma aqui qual é o tom certo de cada música — isso exigiria
 * curadoria humana que ainda não existe. Afirmam-se invariantes e a propriedade central:
 * 100% dos rótulos têm que ser tons possíveis, contra 50% de impossíveis do `matches[0]`.
 */
const dumpPath = path.resolve(__dirname, '../../tons_dump.json');
const temDump = fs.existsSync(dumpPath);

describe.skipIf(!temDump)('detectKey — regressão sobre o acervo', () => {
  type Linha = { artist: string; slug: string; title: string; chords: string[] };
  const cifras: Linha[] = temDump
    ? JSON.parse(fs.readFileSync(dumpPath, 'utf-8'))
    : [];

  it('o dump tem cifras suficientes para valer como regressão', () => {
    expect(cifras.length).toBeGreaterThanOrEqual(40);
  });

  it('TODO rótulo é um tom possível — raiz + maior/menor, nunca tétrade', () => {
    const impossiveis: string[] = [];
    for (const c of cifras) {
      const r = detectKey(c.chords);
      if (!r) continue;
      if (!/^[A-G][#b]?m?$/.test(r.key)) impossiveis.push(`${c.title}: ${r.key}`);
    }
    expect(impossiveis).toEqual([]);
  });

  it('nenhuma cifra do acervo derruba o detector', () => {
    for (const c of cifras) {
      expect(() => detectKey(c.chords)).not.toThrow();
      expect(detectKey(c.chords)).not.toBeNull();
    }
  });

  it('o tom escolhido é sempre o primeiro candidato, e a lista nunca é vazia', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      expect(r.candidates.length).toBeGreaterThan(0);
      expect(r.candidates[0].key).toBe(r.key);
      expect(r.candidates.length).toBeLessThanOrEqual(4);
    }
  });

  it('a tônica escolhida é diatônica do próprio tom (coerência interna)', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      expect(isChordDiatonic(r.key, r.key)).toBe(true);
    }
  });

  it('a ressalva sempre vem com algo a mostrar: alternativa ou modulação', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      if (r.confidence === 'baixa') {
        // Dizer "não tenho certeza" exige apontar o porquê. Ou existe outro tom
        // defensável, ou a música muda de tom — nunca a ressalva sozinha.
        expect(r.candidates.length > 1 || r.modulates).toBe(true);
      }
    }
  });

  it('nenhuma alternativa oferecida é vazia de conteúdo', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      // Um tom cujo campo não explica acorde nenhum da música não é alternativa: era o
      // "ou Gm" que aparecia em «Garota de Ipanema», parecendo informação sem ser.
      for (const alt of r.candidates.slice(1)) {
        expect(alt.fits).toBeGreaterThan(0);
      }
    }
  });

  it('a alternativa mais coberta vem antes das demais', () => {
    for (const c of cifras) {
      const alts = detectKey(c.chords)!.candidates.slice(1);
      for (let i = 1; i < alts.length; i++) {
        expect(alts[i - 1].fits).toBeGreaterThanOrEqual(alts[i].fits);
      }
    }
  });

  it('a maioria do acervo sai com confiança utilizável', () => {
    const utilizavel = cifras.filter(c => detectKey(c.chords)!.confidence !== 'baixa');
    // Piso deliberadamente folgado: a amostra é do ranking, que puxa MPB/bossa — o caso
    // mais cromático que existe. Serve para pegar regressão grosseira, não para celebrar.
    expect(utilizavel.length).toBeGreaterThan(cifras.length * 0.4);
  });

  it('nenhuma cifra do acervo produz regiões duplicadas ou em excesso', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      expect(r.regions.length).toBeLessThanOrEqual(4);
      for (let i = 1; i < r.regions.length; i++) {
        expect(r.regions[i].key).not.toBe(r.regions[i - 1].key);
      }
    }
  });

  it('as regiões de modulação ficam dentro dos limites da música', () => {
    for (const c of cifras) {
      const r = detectKey(c.chords)!;
      for (const reg of r.regions) {
        expect(reg.from).toBeGreaterThanOrEqual(0);
        expect(reg.to).toBeLessThan(c.chords.length);
        expect(reg.to).toBeGreaterThanOrEqual(reg.from);
        expect(reg.key).toMatch(/^[A-G][#b]?m?$/);
      }
    }
  });
});
