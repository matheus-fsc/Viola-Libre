import { describe, expect, it } from 'vitest';
import { isValidChordToken, splitChordAnnotation, transposeChordString } from '../engine/chordCalculator';
import { useCifraTextStore } from '../stores/useCifraTextStore';
import { classifyLine } from '../utils/lineClassifier';
import { acordesDaCifra } from './cifraChords';
import { formatCifraChordHtml, isChordLine, parseChordLine, reflowCifraHtml } from './cifraUtils';

describe('pontuação em linhas de acordes', () => {
  it.each([
    ['(Am)', '(', 'Am', ')'],
    ['(Am', '(', 'Am', ''],
    ['Am)', '', 'Am', ')'],
    ['|Am|', '|', 'Am', '|'],
    ['[Am]', '[', 'Am', ']'],
    ['Am]', '', 'Am', ']'],
    ['Em7*', '', 'Em7', '*'],
    ['F#m7*', '', 'F#m7', '*'],
    ['Em7**', '', 'Em7', '**'],
    ['Am,', '', 'Am', ','],
    ['Am.', '', 'Am', '.'],
    ['Am:', '', 'Am', ':'],
    ['Am?', '', 'Am', '?'],
    ['Am~', '', 'Am', '~'],
    ['Am!', '', 'Am', '!'],
    ["Am'", '', 'Am', "'"],
    ['Am"', '', 'Am', '"'],
    ['(Ab7(4/9))', '(', 'Ab7(4/9)', ')'],
    ['[(A7(#5))]**', '[(', 'A7(#5)', ')]**'],
    ['(N.C.)', '(', 'N.C.', ')'],
    ['NC.', '', 'NC.', ''],
  ])('reconhece %s e localiza o núcleo', (token, prefix, core, suffix) => {
    expect(splitChordAnnotation(token)).toEqual({ prefix, core, suffix });
    expect(isValidChordToken(token)).toBe(true);
    expect(classifyLine(token)).toBe('chord');
    expect(parseChordLine(token)).toEqual([{ text: core, col: prefix.length }]);
  });

  it.each(['Ab7(4/9)', 'C7(b9)', 'Gm(7M)', 'A7(#5)', 'Gb7M(#5)', 'F7M(6)', 'G9/13'])(
    'preserva a grafia de %s',
    chord => {
      expect(isValidChordToken(chord)).toBe(true);
      expect(splitChordAnnotation(chord)).toEqual({ prefix: '', core: chord, suffix: '' });
    },
  );

  it.each(['(Passarim', 'vo--------ou)', 'carre|---gou', 'Por----que', '|', '*'])(
    'mantém %s fora das linhas de acordes',
    text => {
      expect(isValidChordToken(text)).toBe(false);
      expect(isChordLine(text)).toBe(false);
      expect(classifyLine(text)).toBe('lyric');
      expect(parseChordLine(text)).toEqual([]);
      expect(formatCifraChordHtml(text, 2)).toBe(text);
    },
  );

  it('distingue cabeçalhos e tablatura de acordes entre colchetes ou barras', () => {
    expect(classifyLine('[Refrão]')).toBe('section');
    expect(classifyLine('[Solo]')).toBe('instrumental');
    expect(classifyLine('E|---0---')).toBe('tab');
    expect(classifyLine('Am|G|')).toBe('chord');
    expect(isChordLine('Am Por----que')).toBe(false);
  });

  it('reconhece a última linha de acordes de Passarim', () => {
    const line = 'Em7*  F#m7*  G#m7*  F#7M(9)';
    expect(classifyLine(line)).toBe('chord');
    expect(parseChordLine(line)).toEqual([
      { text: 'Em7', col: 0 }, { text: 'F#m7', col: 6 },
      { text: 'G#m7', col: 13 }, { text: 'F#7M(9)', col: 20 },
    ]);
    expect(formatCifraChordHtml(line, 2)).toBe('<b>F#m7</b>*  <b>G#m7</b>*  <b>A#m7</b>*  <b>G#7M(9)</b>');
  });

  it('localiza acordes em compassos com ou sem espaços', () => {
    expect(classifyLine('|Am |G |F |E7 |')).toBe('chord');
    expect(parseChordLine('|Am  |G   |F   |E7  |')).toEqual([
      { text: 'Am', col: 1 }, { text: 'G', col: 6 }, { text: 'F', col: 11 }, { text: 'E7', col: 16 },
    ]);
    expect(parseChordLine('\t|Am|G|')).toEqual([{ text: 'Am', col: 2 }, { text: 'G', col: 5 }]);
  });

  it.each([
    ['(Am)', '(Bm)'],
    ['Em7*', 'F#m7*'],
    ['|Am|', '|Bm|'],
    ['(Am/E)*', '(Bm/F#)*'],
    ['(Ab7(4/9))', '(A#7(4/9))'],
  ])('transpõe %s sem mudar a pontuação', (chord, expected) => {
    expect(transposeChordString(chord, 2, false)).toBe(expected);
  });

  it('transpõe só os núcleos em linhas com ou sem a marcação da fonte', () => {
    const source = '(Am)  <b>Em7*</b>\n|Am|G|\n<b>Am</b> Por----que';
    expect(formatCifraChordHtml(source, 2)).toBe('(<b>Bm</b>)  <b>F#m7</b>*\n|<b>Bm</b>|<b>A</b>|\n<b>Bm</b> Por----que');
    expect(acordesDaCifra(source)).toEqual(['Am', 'Em7', 'Am', 'G', 'Am']);
    expect(reflowCifraHtml('|Am|G|')).toBe('<div class="cifra-line">|<b>Am</b>|<b>G</b>|</div>');
    expect(formatCifraChordHtml('<b>A7m</b>', 2)).toBe('<b>B7m</b>');
    expect(formatCifraChordHtml('<b>Am&#x27;</b><br>|Am|', 2)).toBe("<b>Bm</b>'<br>|<b>Bm</b>|");
  });

  it('preserva a pontuação fora do alvo de hover quando há letra abaixo', () => {
    const html = reflowCifraHtml('(<b>Am</b>)  <b>Em7*</b>\nPassarim vo--------ou)');
    expect(html).toContain('(<b>Am</b>)  <b>Em7</b>*');
    expect(html).toContain('>Passarim</span>');
    expect(html).toContain('>vo--------ou)</span>');
  });

  it('preserva os afixos e as barras ao arrastar um acorde no editor', () => {
    const line = '| (Am)  |G|';
    const store = useCifraTextStore.getState();
    store.setLines([line]);
    store.startChordDrag(0, 0, parseChordLine(line), 0, 8);
    store.updateChordDrag(8);
    store.endChordDrag();
    expect(useCifraTextStore.getState().lines).toEqual(['|  (Am) |G|']);
    store.setLines([]);
  });
});


describe('índices de linha para o timing', () => {
  it('preserva os índices de acordes e letra unidos no mesmo bloco', () => {
    const html = reflowCifraHtml('Am G\nCanta comigo<br>\n\nOutra frase', 4);
    expect(html).toContain('data-timing-line="5" data-timing-chord="4"');
    expect(html).toContain('data-timing-line="7">Outra frase');
  });
});

describe('isChordLine com parênteses soltos', () => {
  it('aceita a sequência de acordes entre parênteses quebrada em duas linhas', () => {
    expect(isChordLine('( A7  D7  C#7  F#m  A7  D7')).toBe(true);
    expect(isChordLine('F#m  G7  G#7 )     A7')).toBe(true);
    expect(isChordLine('( Am  Em  Am  Em )')).toBe(true);
  });

  it('não transforma parênteses vazios ou letra em linha de acorde', () => {
    expect(isChordLine('( )')).toBe(false);
    expect(isChordLine('( Das feridas que a pobreza cria')).toBe(false);
  });
});

describe('acordes colados depois de parêntese', () => {
  // Falso Brilhante (João Bosco): o acervo traz os dois acordes sem espaço entre eles.
  const linha = '   E(add9)E(#5/add9)                ';

  it('reconhece a linha e separa os dois acordes', () => {
    expect(isChordLine(linha)).toBe(true);
    expect(parseChordLine(linha)).toEqual([
      { text: 'E(add9)', col: 3 },
      { text: 'E(#5/add9)', col: 10 },
    ]);
  });

  it('marca cada acorde no seu próprio <b>', () => {
    expect(acordesDaCifra(`<pre>${linha}\nletra</pre>`)).toEqual(['E(add9)', 'E(#5/add9)']);
  });

  it('não separa texto que não vira dois acordes', () => {
    expect(isChordLine('E(add9)Amor')).toBe(false);
    expect(parseChordLine('Em7(9)')).toEqual([{ text: 'Em7(9)', col: 0 }]);
  });
});
