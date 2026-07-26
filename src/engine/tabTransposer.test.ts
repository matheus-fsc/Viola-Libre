import { describe, expect, it } from 'vitest';
import { splitHtmlByTabs } from './tabTransposer';

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
