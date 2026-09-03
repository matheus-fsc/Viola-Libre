import type { DeteccaoTom } from '../../engine/detectKey';

/**
 * Como o painel conta o tom detectado — e, quando é o caso, que não tem certeza.
 *
 * O tom sai de uma análise da cifra inteira (`engine/detectKey.ts`), não de um dado que
 * alguém digitou. Em boa parte do acervo existem DOIS tons defensáveis para a mesma
 * música: maior e seu relativo menor têm as mesmas sete notas, e só a cadência separa os
 * dois — quando a música tem cadência clara. Afirmar um deles nesses casos é apostar com
 * a cara do músico, que vai ler "Original: G" e confiar.
 *
 * Então a frase acompanha a confiança: afirma quando dá, oferece as alternativas quando
 * não dá, e avisa quando a música simplesmente não fica no mesmo tom do começo ao fim.
 */
export function descricaoDoTom(deteccao: DeteccaoTom | null): string | undefined {
  if (!deteccao) return undefined;

  // `nome` e não `key`: o rótulo de exibição carrega o modo quando ele não é o maior nem
  // o menor de sempre ("G mixolídio"), e é essa a informação que muda o campo harmônico.
  const alternativas = deteccao.candidates
    .slice(1, 3)
    .map(c => c.nome)
    .filter(k => k !== deteccao.nome);

  if (deteccao.confidence === 'alta' && !deteccao.modulates) {
    return `Original: ${deteccao.nome}`;
  }

  const ou = alternativas.length ? ` ou ${alternativas.join(', ')}` : '';
  if (deteccao.modulates) {
    // Aqui o aviso vale mais que a alternativa: numa música que modula, nenhum rótulo
    // único está certo, e o que o músico precisa saber é que o tom vai mudar.
    return `Provavelmente ${deteccao.nome}${ou} — muda de tom ao longo da música`;
  }
  return `Talvez ${deteccao.nome}${ou}`;
}
