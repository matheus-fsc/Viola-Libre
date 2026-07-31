import { describe, expect, it } from 'vitest';
import { parseTabText, splitHtmlByTabs, splitTabSystems } from './tabTransposer';

// A marcação que vem do CifraClub encosta partes da tab FORA do elemento da tab:
// o <span class="tablatura"> embrulha um <span class="cnt">, a legenda "Parte N de M"
// fica solta acima e, quando a fonte quebra, sobra uma linha de tab solta abaixo.
// Se a segmentação não adotar tudo isso, "Ocultar Tabs" deixa lixo no meio da letra.
describe('splitHtmlByTabs', () => {
  const tabLines =
    'E|-----2-5-----2-5--------------------------|\n' +
    'B|-2-3-----2-3------------------------------|\n' +
    'G|-2-------2--------------------------------|\n' +
    'D|-4-------4--------------------------------|';

  const soHtml = (html: string) =>
    splitHtmlByTabs(html)
      .filter(s => s.type === 'html')
      .map(s => s.content)
      .join('\n');

  it('consome o </span> externo do <span class="tablatura"> aninhado', () => {
    const html = `<pre>[Intro]\n\n<span class="tablatura">   <b>Bm7</b>\n<span class="cnt">${tabLines}</span></span>\n\n[Estrofe]\n</pre>`;
    const segs = splitHtmlByTabs(html);

    expect(segs.filter(s => s.type === 'tab')).toHaveLength(1);
    expect(soHtml(html)).not.toContain('</span>');
  });

  it('leva a legenda "Parte N de M" junto com o bloco de tab', () => {
    const html = `<pre>[Intro]\n\nParte 1 de 9\n\n<span class="tablatura">   <b>Bm7</b>\n<span class="cnt">${tabLines}</span></span>\n</pre>`;

    expect(soHtml(html)).not.toMatch(/Parte 1 de 9/);
    const tab = splitHtmlByTabs(html).find(s => s.type === 'tab');
    expect(tab?.content).toMatch(/^Parte 1 de 9\n\n/);
  });

  it('recolhe a linha de tab que a fonte deixou fora do elemento', () => {
    // Caso real de "O Bêbado e a Equilibrista": a última corda escapou do <span class="cnt">
    // e ainda veio com barra invertida no lugar do pipe, virando um acorde <b>E</b> na letra.
    const solta = '<b>E</b>\\------------------------------------------|';
    const html = `<pre><span class="tablatura">   <b>Bm7</b>\n<span class="cnt">${tabLines}</span></span>\n${solta}\n\n[Intro Solo]\n</pre>`;

    const resto = soHtml(html);
    expect(resto).not.toContain('----');
    expect(resto).toContain('[Intro Solo]');
    expect(splitHtmlByTabs(html).find(s => s.type === 'tab')?.content).toMatch(/E\\-{4,}\|$/);
  });

  it('não engole linha de letra parecida com tab', () => {
    const html = `<pre>Me      lembrou     Carlitos\n\n<span class="tablatura"><span class="cnt">${tabLines}</span></span>\n</pre>`;
    expect(soHtml(html)).toContain('Me      lembrou     Carlitos');
  });

  it('deixa os segmentos vizinhos em branco para o viewer mesclar tabs coladas', () => {
    const html =
      `<pre><span class="tablatura"><span class="cnt">${tabLines}</span></span>\n\n` +
      `Parte 2 de 2\n\n<span class="tablatura"><span class="cnt">${tabLines}</span></span>\n</pre>`;
    const segs = splitHtmlByTabs(html);
    const entre = segs[segs.findIndex(s => s.type === 'tab') + 1];

    expect(entre.type).toBe('html');
    expect(entre.content.trim()).toBe('');
  });
});

// A fonte quebra a tab em 32 colunas. Quando a continuação vem separada por uma
// linha em branco tudo funciona, mas quando vem separada só pela linha de acordes
// da metade seguinte as duas metades viravam UM sistema de 12 cordas — aí a
// detecção de afinação falhava ("Instrumento detectado") e a transposição chutava
// a oitava das cordas graves. Caso real: [Primeira Parte] de "Mistério do Planeta".
describe('splitTabSystems', () => {
  const meiaTab = (marca: string) =>
    `E|-----------------${marca}-----------------|\n` +
    `B|-2-----2-----0---5-----5-----5-----------|\n` +
    `G|-2-----2-----2---4-----3-----6-----------|\n` +
    `D|-2-----1-----1---------------5-----------|\n` +
    `A|-------2-----2---4-----4-----------------|\n` +
    `E|-2---------------------------5-----------|`;

  it('corta o sistema na linha de acordes que cola as duas metades', () => {
    const bloco = `Parte 1 de 4\n   F#m7  B7(9) B7\n${meiaTab('4')}\n  B7  A7  G#7\n${meiaTab('7')}`;
    const sistemas = splitTabSystems(bloco);

    expect(sistemas).toHaveLength(2);
    expect(sistemas[0]).toContain('Parte 1 de 4');
    expect(sistemas[1]).toMatch(/^ {2}B7 {2}A7 {2}G#7\n/);
    for (const s of sistemas) {
      const tab = parseTabText(s);
      expect(tab?.rows).toHaveLength(6);
      expect(tab?.sourceName).toBe('Violão Padrão (EADGBE)');
      expect(tab?.rows.map(r => r.midiOpen)).toEqual([64, 59, 55, 50, 45, 40]);
    }
  });

  it('continua cortando na linha em branco', () => {
    expect(splitTabSystems(`${meiaTab('4')}\n\n${meiaTab('7')}`)).toHaveLength(2);
  });

  it('mantém o cabeçalho de várias linhas junto do sistema', () => {
    const sistemas = splitTabSystems(`Parte 1 de 3\n  A7M       C#m7\n${meiaTab('4')}`);

    expect(sistemas).toHaveLength(1);
    expect(sistemas[0].split('\n').slice(0, 2)).toEqual(['Parte 1 de 3', '  A7M       C#m7']);
  });
});
