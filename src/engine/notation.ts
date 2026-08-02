/**
 * Padrão de notação de acordes.
 *
 * A tabela CHORD_FORMULAS tem 17 grupos de sinônimos — conjuntos de intervalos idênticos
 * escritos de formas diferentes ('add9' | '9' | '(add9)' | '2'). Sem uma preferência, o
 * reconhecimento reverso escolhia por desempate arbitrário (nome mais curto), e o shape de
 * F com nona virava "F2" em vez do "F9" que o cifrista brasileiro escreve.
 *
 * IMPORTANTE — isto governa só a EXIBIÇÃO, nunca a leitura. O parsing continua fixo na
 * convenção brasileira, porque ela é propriedade da FONTE da cifra, não de quem lê: se o
 * parsing seguisse este seletor, trocar o padrão faria 'B°' ganhar ou perder uma nota e a
 * cifra passaria a soar errada. Aqui só se decide o RÓTULO de um acorde já definido.
 *
 * As preferências de pt-BR foram medidas em 50 cifras do corpus (nº de músicas distintas
 * por grafia). As marcadas «convenção» não tiveram ocorrência e seguem o padrão dos irmãos
 * já medidos.
 */
export type NotationStandard = 'pt-BR' | 'intl';

export const NOTATION_STANDARDS: { id: NotationStandard; label: string }[] = [
  { id: 'pt-BR', label: 'Brasileiro' },
  { id: 'intl', label: 'Internacional' },
];

export const DEFAULT_NOTATION: NotationStandard = 'pt-BR';

/** Cada linha é um grupo de sinônimos, em ordem de preferência para cada padrão. */
const GRUPOS: { ptBR: string[]; intl: string[] }[] = [
  { ptBR: ['7M', 'Maj7'], intl: ['Maj7', '7M'] },                                  // 7M=21  Maj7=0
  { ptBR: ['m7(5-)', 'm7(b5)'], intl: ['m7(b5)', 'm7(5-)'] },                       // 7 / 3
  { ptBR: ['7(5-)', '7(b5)'], intl: ['7(b5)', '7(5-)'] },                           // convenção
  { ptBR: ['°', '°7', 'dim7'], intl: ['dim7', '°7', '°'] },                         // °=10  dim7=0
  { ptBR: ['4', 'sus4', 'sus'], intl: ['sus4', 'sus', '4'] },                       // 4=2  sus4=0
  { ptBR: ['7(9)', '7/9'], intl: ['7(9)', '7/9'] },                                 // 7(9)=13
  { ptBR: ['m7(9)', 'm9', 'm7/9'], intl: ['m9', 'm7(9)', 'm7/9'] },                 // m7(9)=13  m9=2
  { ptBR: ['7(9-)', '7(b9)', '7/9-'], intl: ['7(b9)', '7(9-)', '7/9-'] },           // 10 / 4
  { ptBR: ['7(9+)', '7(#9)', '7/9+'], intl: ['7(#9)', '7(9+)', '7/9+'] },           // 2 / 0
  { ptBR: ['9', 'add9', '(add9)', '2'], intl: ['add9', '(add9)', '9', '2'] },       // 9=6  2=2  add9=1
  { ptBR: ['m(add9)', 'madd9', 'm2'], intl: ['m(add9)', 'madd9', 'm2'] },           // convenção
  { ptBR: ['7M(9)', 'Maj7(9)', 'Maj9'], intl: ['Maj9', 'Maj7(9)', '7M(9)'] },       // 7M(9)=7
  { ptBR: ['7(4)', '7sus4'], intl: ['7sus4', '7(4)'] },                             // 7(4)=5  7sus4=0
  { ptBR: ['7(5+)', '7(#5)'], intl: ['7(#5)', '7(5+)'] },                           // empate 2/2
  { ptBR: ['m7(11)', 'm7(4)'], intl: ['m7(11)', 'm7(4)'] },                         // m7(11)=3
  { ptBR: ['7(9/11)', '11'], intl: ['11', '7(9/11)'] },                             // 7(9/11)=2
];

const RANKS: Record<NotationStandard, Map<string, number>> = {
  'pt-BR': new Map(),
  intl: new Map(),
};
for (const g of GRUPOS) {
  g.ptBR.forEach((suf, i) => RANKS['pt-BR'].set(suf, i));
  g.intl.forEach((suf, i) => RANKS.intl.set(suf, i));
}

/**
 * Posição do sufixo dentro do seu grupo de sinônimos: 0 = grafia preferida.
 * Sufixo sem sinônimo (a maioria) devolve 0 — não há o que desempatar, e assim ele nunca
 * perde para um sinônimo de outro grupo.
 */
export function notationRank(suffix: string, standard: NotationStandard = DEFAULT_NOTATION): number {
  return RANKS[standard].get(suffix) ?? 0;
}
