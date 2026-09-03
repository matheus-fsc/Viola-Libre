/**
 * Extrair a sequência de acordes de uma cifra vinda da API.
 *
 * O acervo guarda a cifra como HTML com os acordes em `<b>`. Esta varredura vivia inline no
 * `CifraViewer`, e virou módulo quando uma segunda tela (o grafo harmônico) passou a
 * precisar exatamente da mesma leitura. Duplicar a extração seria o caminho curto para as
 * duas telas discordarem sobre quais são os acordes da música — e aí o tom detectado numa
 * não bateria com o da outra, pelo motivo mais bobo possível.
 */

/**
 * Todos os acordes, na ORDEM da cifra e COM repetições.
 *
 * É esta a forma que a análise precisa: frequência e ordem de repouso são justamente os
 * sinais que decidem o tom (ver `engine/detectKey.ts`). Quem quiser a lista sem repetição —
 * a grade de diagramas, por exemplo — usa `acordesDistintos`.
 */
export function acordesDaCifra(html: string): string[] {
  const regex = /<b>(.*?)<\/b>/g;
  const todos: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    // Um único <b> pode conter vários acordes separados por espaço
    // (ex.: "<b>G#m7(5-)  A#7</b>"). Separa cada acorde para não grudar dois num só.
    const raw = match[1].replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').trim();
    if (!raw) continue;
    for (const acorde of raw.split(/\s+/)) {
      if (acorde) todos.push(acorde);
    }
  }
  return todos;
}

/** Os acordes distintos, na ordem da primeira aparição. */
export function acordesDistintos(todos: string[]): string[] {
  const vistos: string[] = [];
  for (const acorde of todos) {
    if (!vistos.includes(acorde)) vistos.push(acorde);
  }
  return vistos;
}
