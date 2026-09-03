/**
 * Identificação do tom de uma cifra, a partir da sequência de acordes.
 *
 * O que existia antes era `songKey = matches[0]` — o primeiro acorde escrito. Medido em 50
 * cifras do acervo, isso dava um rótulo que NÃO EXISTE como tom em 23 delas (50%): "D7M",
 * "Bm7", "A4", "E7(#9)", "D#m7(b5/9)". Tom é sempre tríade — raiz + maior/menor. O sufixo
 * não é sujeira a cortar da string, porém: `D#m7(b5/9)` truncado viraria `D#m`, um tom
 * plausível e quase certamente errado, porque meio-diminuto é acorde de passagem (o ii de
 * um ii-V), praticamente nunca tônica. O sufixo é EVIDÊNCIA sobre que papel o acorde tem.
 * Por isso a redução a tríade acontece aqui dentro, como consequência de ter escolhido uma
 * tônica, e nunca como limpeza do texto na saída.
 *
 * ── O modelo: coleção primeiro, tônica depois ──────────────────────────────────────────
 *
 * Um tom maior e seu relativo menor têm exatamente as MESMAS sete notas. Medindo as mesmas
 * 50 cifras, 42 (93%) dão empate técnico entre o par relativo quando se pontua só por
 * "quantas notas encaixam". Contagem de notas não desempata C de Am — nunca vai desempatar.
 *
 * Então a detecção tem dois passos, que respondem a duas perguntas diferentes:
 *
 *   1. COLEÇÃO — em que conjunto de sete notas a música está flutuando? São 12 coleções
 *      diatônicas, cada uma servindo a um par relativo. É aqui que entram as notas em comum
 *      entre os acordes: a abertura estabelece a coleção, e o miolo confirma.
 *
 *   2. REPOUSO — dentro da coleção escolhida, onde a música pousa? É o que separa C de Am,
 *      e é evidência CADENCIAL: o último acorde, a cadência V→I, o dominante da tônica.
 *
 * A ordem importa. Um detector que pontua as 24 tonalidades de uma vez deixa o fit diatônico
 * (que não sabe desempatar relativos) competir com a cadência (que sabe), e o fit ganha por
 * volume. Foi assim que uma primeira versão deste arquivo devolveu "C" para «Tocando Em
 * Frente», que abre e fecha em G — o palpite ingênuo do primeiro acorde acertava e ele não.
 *
 * ── Incerteza é resposta ──────────────────────────────────────────────────────────────
 *
 * `detectKey` devolve uma LISTA ordenada de candidatos com uma confiança, não um palpite
 * único. Em 10 das 45 cifras (22%) o tom nem é estável do começo ao fim: «Chega de Saudade»
 * sai de Dm e termina em D maior, «Garota de Ipanema» tem a ponte em outro tom. Para essas
 * nenhum rótulo único está certo, e dizer "provavelmente Dm ou D" é mais honesto — e mais
 * útil para quem vai tocar — do que afirmar um dos dois.
 *
 * Nota sobre a amostra: as 50 cifras vieram do ranking de mais tocadas, que puxa MPB/bossa
 * — o caso mais difícil que existe em harmonia. O público de viola caipira e sertanejo é
 * bem mais diatônico, então 50% e 22% são tetos, não médias do acervo.
 */
import type { PitchClass } from './types';
import { buildChord, parseChordString, noteNameToPitchClass } from './chordCalculator';
import { NOTE_NAMES_SHARP, NOTE_NAMES_FLAT } from './tunings';

/** Graus da escala maior. As 12 rotações desse conjunto são as 12 coleções diatônicas. */
const ESCALA_MAIOR = [0, 2, 4, 5, 7, 9, 11];

/** Distância da tônica maior até a relativa menor (a sexta): C → Am. */
const RELATIVA_MENOR = 9;

/** Qualidade da tríade de cada grau da escala maior — a mesma para todos os modos. */
const QUALIDADE_DO_GRAU = ['', 'm', 'm', '', '', 'm', 'm(b5)'];

/**
 * Os sete modos gregos, com o peso de quanto cada um APARECE como centro tonal.
 *
 * A coleção diatônica não sabe qual das suas sete notas é a tônica — quem decide é o
 * repouso. Até aqui só se ofereciam duas leituras por coleção (jônio e eólio), e por isso
 * «Tocando Em Frente» (G, F, C, Dm) não tinha resposta certa: é Sol mixolídio, que o
 * modelo não sabia nomear. Com os sete modos a coleção passa a oferecer sete tônicas.
 *
 * O `prior` existe porque as sete NÃO são equiprováveis, e sem ele o ganho viraria ruído:
 * qualquer música em Dó passaria a ter sete leituras empatadas no encaixe, e a cadência
 * sozinha teria de desempatar todas. Os pesos dizem o óbvio da prática — jônio e eólio
 * dominam, mixolídio é corriqueiro em caipira, sertanejo e rock (o bVII), dórico aparece
 * em samba e MPB, frígio e lídio são coloridos e raros como CENTRO, e lócrio não existe
 * como tom: não há repouso possível sobre uma tríade diminuta.
 *
 * Os valores são julgamento de prática musical, não medição — não há no acervo um campo
 * com o modo anotado por gente para calibrá-los. São conservadores de propósito: mexem no
 * desempate, e não têm força para inventar um modo onde a cadência diz outra coisa.
 */
export interface Modo {
  nome: string;
  /** Em que grau da escala maior o modo começa (0 = jônio, 5 = eólio). */
  grau: number;
  /** Sufixo da tríade de tônica — define como o tom é escrito. */
  suffix: string;
  prior: number;
}

export const MODOS: Modo[] = [
  { nome: 'jônio', grau: 0, suffix: '', prior: 1 },
  { nome: 'dórico', grau: 1, suffix: 'm', prior: 0.5 },
  { nome: 'frígio', grau: 2, suffix: 'm', prior: 0.22 },
  { nome: 'lídio', grau: 3, suffix: '', prior: 0.28 },
  { nome: 'mixolídio', grau: 4, suffix: '', prior: 0.6 },
  { nome: 'eólio', grau: 5, suffix: 'm', prior: 1 },
  { nome: 'lócrio', grau: 6, suffix: 'm(b5)', prior: 0.02 },
];

/** Modos em que a sétima maior existe, e portanto o V dominante é idiomático. */
const MODOS_COM_DOMINANTE = new Set(['jônio', 'eólio']);

/**
 * Quanto custa, em pontos, ser um modo raro.
 *
 * O prior entra como penalidade ADITIVA, não como multiplicador do repouso. A diferença
 * importa: o trabalho do prior é desempatar QUAL das sete notas da coleção é a tônica —
 * caso em que o encaixe é idêntico para as sete e só ele decide. Multiplicando o repouso,
 * o prior passava a brigar também com a evidência de COLEÇÃO, que é de outra natureza e
 * mais forte. Em «Tocando Em Frente» isso dava Sol jônio (2 de 4 acordes) por 0,4 ponto
 * sobre Sol mixolídio (4 de 4) — o prior derrubando a leitura que explica o dobro da
 * música. Como penalidade fixa, ele modera a escolha da tônica sem poder desfazer uma
 * coleção que encaixa melhor.
 */
const PENALIDADE_MODO = 8;

/**
 * Cifra de um grau em algarismo romano, a partir do intervalo até a tônica do modo.
 *
 * Gerar em vez de tabelar sete listas evita que elas se desencontrem, e resolve sozinho o
 * único grau ambíguo: o trítono é #IV quando o modo NÃO tem quarta justa (lídio) e bV
 * quando tem (lócrio).
 */
function numeralDoGrau(intervalo: number, qualidade: string, temQuartaJusta: boolean): string {
  const base: Record<number, string> = {
    0: 'I', 1: 'bII', 2: 'II', 3: 'bIII', 4: 'III', 5: 'IV',
    6: temQuartaJusta ? 'bV' : '#IV',
    7: 'V', 8: 'bVI', 9: 'VI', 10: 'bVII', 11: 'VII',
  };
  const romano = base[intervalo] ?? '?';
  // Maiúscula para tríade maior, minúscula para menor, e ° para a diminuta — a convenção
  // que deixa o campo legível sem precisar repetir o sufixo em cada casa.
  if (qualidade === '') return romano;
  if (qualidade === 'm') return romano.toLowerCase();
  return romano.toLowerCase() + '°';
}

/**
 * Tons que se escrevem com bemol, por convenção (lado bemol do ciclo das quintas).
 * Sem isto o tom de Si bemol sairia rotulado "A#", que ninguém escreve.
 */
const COLECOES_COM_BEMOL = new Set<PitchClass>([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db

export type Confianca = 'alta' | 'media' | 'baixa';

/** Um sinal de repouso que pontuou, com quanto valeu. Para o painel de auditoria. */
export interface SinalDeRepouso {
  nome: string;
  pontos: number;
}

/** O papel que um acorde da música cumpre num tom candidato. */
export type PapelDeAcorde = 'campo' | 'dominante' | 'preparacao' | 'emprestado' | 'estranho';

export interface AcordeAnalisado {
  /** Como está escrito na cifra. */
  chord: string;
  /**
   * Todas as grafias que compartilham este esqueleto, incluindo `chord`.
   *
   * `Gm7` e `Gm7(11)` são a mesma harmonia para a análise — a tensão é descartada de
   * propósito — e por isso contam uma vez só. Mas continuam sendo dois acordes escritos na
   * cifra, e quem exibe precisa poder achar o papel de qualquer um dos dois.
   */
  variantes: string[];
  papel: PapelDeAcorde;
  /** Quando é do campo: o grau ('IV'). Quando é dominante: o alvo que ele toniciza. */
  detalhe?: string;
}

/**
 * A conta inteira de um candidato, aberta.
 *
 * Existe porque o painel afirma coisas — "confiança alta", "16 de 22 acordes" — e quem lê
 * merece poder conferir em vez de acreditar. Não é log de depuração: é a mesma informação
 * que a decisão usou, dita em português. Se a conta não puder ser mostrada sem envergonhar
 * o algoritmo, o problema é do algoritmo.
 *
 * Só é preenchida para os candidatos que vão à tela. Calcular para os 84 seria desperdício.
 */
export interface AnaliseCandidato {
  /** Encaixe da coleção, de 0 a 20. */
  encaixe: number;
  /** Soma dos sinais de repouso. */
  repouso: number;
  /** Desconto por ser um modo raro (0 para jônio e eólio). */
  penalidadeModo: number;
  sinais: SinalDeRepouso[];
  acordes: AcordeAnalisado[];
}

/** Um grau do campo harmônico, pronto para exibir. */
export interface GrauDoCampo {
  /** Cifra do grau em algarismo romano: 'I', 'ii', 'vii°'. */
  grau: string;
  /** O acorde daquele grau neste tom: 'G', 'Am', 'F#m(b5)'. */
  chord: string;
  /** true quando a música REALMENTE usa um acorde desse grau. */
  usado: boolean;
}

export interface CandidatoTom {
  /**
   * Rótulo em TRÍADE: "G", "Em", "Bb". É o que alimenta a transposição e o que vai para a
   * estante — por isso continua sendo só raiz + qualidade, mesmo quando o modo é outro.
   * O modo viaja separado em `modo`, e o rótulo de exibição é o `nome`.
   */
  key: string;
  /** Como mostrar para gente: "G", "Em", "G mixolídio". */
  nome: string;
  /** O modo desta leitura. Jônio e eólio são o maior e o menor de sempre. */
  modo: Modo;
  tonic: PitchClass;
  minor: boolean;
  /** Pontuação bruta. Só serve para comparar candidatos entre si, não tem unidade. */
  score: number;
  /**
   * Quantos acordes DISTINTOS da música este tom EXPLICA — diatônicos mais dominantes
   * secundários. Não é "quantos pertencem ao campo": em MPB isso seria um número
   * pessimista e inútil, porque o gênero vive de dominante de passagem.
   */
  fits: number;
  /** Destes, quantos entraram como dominante secundário e não como grau do campo. */
  dominantes: number;
  /** Destes, quantos entraram como o "ii" de um ii-V que aponta para dentro do tom. */
  preparacoes: number;
  /** Destes, quantos vieram emprestados do tom paralelo (o `Fm` de uma música em Dó). */
  emprestados: number;
  /** A conta aberta. Só vem preenchida nos candidatos que chegam à tela. */
  analise?: AnaliseCandidato;
  /** Total de acordes distintos reconhecidos na música — o denominador de `fits`. */
  total: number;
  /**
   * Os sete graus deste tom, com a marca de quais a música usa.
   *
   * É o que torna um palpite verificável em vez de uma afirmação de autoridade: o músico
   * bate o campo contra os acordes que está vendo na tela e decide sozinho. Quando há dois
   * tons defensáveis, é comparando os dois campos que a escolha fica óbvia.
   */
  campo: GrauDoCampo[];
}

export interface RegiaoTonal {
  /** Índices no array de acordes recebido, inclusivos. */
  from: number;
  to: number;
  key: string;
  tonic: PitchClass;
  /**
   * Quanto a TÔNICA deste trecho está deslocada da tônica de casa, em semitons, pela volta
   * mais curta.
   *
   * Saber ONDE a música muda de tom é meia resposta; quem vai tocar precisa saber QUANTO.
   * Mede-se a tônica e não a coleção de propósito: em «Chega de Saudade» o trecho vai de Ré
   * menor para Ré maior, e a coleção anda três semitons enquanto a mão não anda nenhum. O
   * número que serve para tocar é o da tônica — `0` aqui significa "mesma nota, outra cor",
   * que é exatamente o que acontece.
   *
   * Normalizado para [-5, +6] pela mesma razão do `shortestTranspose`: "+7" e "-5" chegam no
   * mesmo tom, mas só um dos dois descreve o movimento.
   */
  semitons: number;
}

export interface DeteccaoTom {
  /** O melhor palpite. Sempre tríade. */
  key: string;
  tonic: PitchClass;
  minor: boolean;
  confidence: Confianca;
  /** Como mostrar para gente: "G", "Em", "G mixolídio". */
  nome: string;
  /** O modo da leitura vencedora. */
  modo: Modo;
  /**
   * Margem do 1º candidato sobre o 2º, de 0 a 1 — a distância que separa a resposta da
   * melhor alternativa. É de onde sai a `confidence`, exposta em número para que o painel
   * possa mostrar o quanto de folga existe em vez de só a palavra.
   */
  margin: number;
  /** Se o rótulo deve ser escrito com bemóis (tom de Fá, Sib, Mib…). */
  preferFlats: boolean;
  /** Candidatos ordenados, o melhor primeiro. Inclui o próprio `key`. */
  candidates: CandidatoTom[];
  /** true quando a música não fica na mesma coleção do início ao fim. */
  modulates: boolean;
  /**
   * Trechos com coleção própria, quando dá para delimitá-los. Pode vir VAZIO mesmo com
   * `modulates` — é o caso da harmonia que passeia sem fronteira nítida, em que apontar
   * trechos seria inventar precisão que a análise não tem.
   */
  regions: RegiaoTonal[];
}

/** Esqueleto harmônico de um acorde: o que ele afirma sobre a tonalidade. */
interface Esqueleto {
  /** O acorde como está escrito na cifra. Só serve ao painel de auditoria. */
  texto: string;
  root: PitchClass;
  /** Notas definidoras em pitch class: fundamental, terça (ou sus), quinta, sétima. */
  pcs: PitchClass[];
  /** true = terça menor. null = sem terça (sus / power chord). */
  minor: boolean | null;
  /** Sétima dominante com terça maior — o acorde que aponta uma tônica uma quinta abaixo. */
  dominant: boolean;
}

/**
 * Tensões (9/11/13) são descartadas do esqueleto de propósito.
 *
 * Em MPB quase todo acorde traz b9, #11 ou 13, e essas notas são cromáticas por natureza —
 * pousá-las na conta faria «Corcovado» não encaixar em coleção nenhuma. É a mesma política
 * que o motor já aplica em REDUCIBLE_INTERVALS (chordCalculator.ts): extensão natural é
 * decoração, o que define o acorde é a fundamental, a terça e a sétima.
 */
const LIMITE_ESQUELETO = 12;

const cacheEsqueleto = new Map<string, Esqueleto | null>();

function esqueletoDe(acorde: string): Esqueleto | null {
  const emCache = cacheEsqueleto.get(acorde);
  if (emCache !== undefined) return emCache;

  let resultado: Esqueleto | null = null;
  try {
    const { root, suffix, bass } = parseChordString(acorde);
    if (root) {
      const chord = buildChord(root, suffix);
      const intervalos = chord.formula.intervals.filter(iv => iv < LIMITE_ESQUELETO);
      const pcs = intervalos.map(iv => ((chord.root + iv) % 12) as PitchClass);

      // O baixo da barra só entra quando ACRESCENTA nota. Medido no acervo: dos 315 baixos
      // explícitos, 247 (78%) são inversão pura — a nota já está no acorde, e incluí-la não
      // mudaria uma vírgula do encaixe. Os 68 restantes trazem nota nova (o "Ab/Bb" da
      // bossa, que é um Bb com quarta e sétima) e essa nota é harmonia de verdade.
      //
      // A raiz continua sendo a do acorde, nunca a do baixo: em "C/E" quem fala sobre o tom
      // é o Dó. Trocar a raiz pela nota do grave faria toda inversão virar um acorde
      // diferente e destruiria a contagem de graus.
      if (bass) {
        try {
          const bpc = (noteNameToPitchClass(bass) % 12) as PitchClass;
          if (!pcs.includes(bpc)) pcs.push(bpc);
        } catch {
          // Baixo ilegível é ignorado; o acorde ainda vale pelo que se sabe dele.
        }
      }

      const temTercaMenor = intervalos.includes(3);
      const temTercaMaior = intervalos.includes(4);
      resultado = {
        texto: acorde,
        root: chord.root,
        pcs,
        minor: temTercaMenor ? true : temTercaMaior ? false : null,
        dominant: temTercaMaior && intervalos.includes(10),
      };
    }
  } catch {
    // Token que o motor não sabe montar (marca de seção, "N.C.", lixo do HTML) não vota.
    resultado = null;
  }

  cacheEsqueleto.set(acorde, resultado);
  return resultado;
}

/** As sete pitch classes da coleção cuja tônica maior é `tonicaMaior`. */
function colecaoDe(tonicaMaior: PitchClass): Set<PitchClass> {
  return new Set(ESCALA_MAIOR.map(iv => ((tonicaMaior + iv) % 12) as PitchClass));
}

/**
 * Que papel um acorde cumpre dentro de uma coleção.
 *
 * A pergunta "esse acorde pertence ao tom?" é curta demais para MPB. Medido no acervo, o
 * tom vencedor cobre em média 52% dos acordes — não porque a leitura esteja errada, mas
 * porque o gênero é assim: dominante secundário, empréstimo e substituto em toda esquina.
 * Contar isso como "não pertence" faz a análise brigar com a música.
 *
 * O dominante secundário é o caso mais comum e o mais fácil de reconhecer. `A7` em Dó não
 * é evidência CONTRA Dó — é evidência A FAVOR, porque existe para apontar o Dm, que é o ii
 * de Dó. O Dó# que ele traz é justamente a sensível do alvo, não uma nota de outro tom.
 *
 * Isso vale também para o V da menor: em Lá menor o `E7` traz Sol#, que não existe na
 * coleção — é a menor harmônica. Sem esta regra, o acorde mais característico do tom menor
 * contava como estranho ao próprio tom.
 *
 * Exige-se que o alvo apareça na música COMO ACORDE DIATÔNICO, e não que seja apenas uma
 * nota da coleção. A diferença decide casos reais: numa peça que vai de Dó para Mi maior, o
 * `B7` aponta para Mi, e Mi é nota de Dó — pela regra frouxa o `B7` seria creditado a Dó e a
 * modulação sumiria do radar. Mas o acorde de Mi MAIOR não pertence a Dó (lá o grau é Em).
 * Dominante secundário toniciza um acorde que é do tom; se o alvo não é do tom, quem está
 * saindo do tom é a música, e é isso que se deve enxergar.
 */
type PapelNoTom = 'diatonico' | 'dominante' | 'preparacao' | 'estranho';

function ehDiatonico(esq: Esqueleto, colecao: Set<PitchClass>): boolean {
  return esq.pcs.every(pc => colecao.has(pc));
}

/** Raízes que aparecem na música tocando um acorde diatônico da coleção. */
function alvosDiatonicos(
  esqueletos: (Esqueleto | null)[],
  colecao: Set<PitchClass>,
): Set<PitchClass> {
  const alvos = new Set<PitchClass>();
  for (const e of esqueletos) if (e && ehDiatonico(e, colecao)) alvos.add(e.root);
  return alvos;
}

/**
 * Para onde um acorde dominante aponta, se é que aponta para dentro do tom.
 *
 * Um dominante resolve de duas maneiras, e as duas são função dominante:
 *
 *   • descendo uma QUINTA — o dominante secundário de sempre. `A7` → `Dm`.
 *   • descendo um SEMITOM — o substituto de trítono (subV), que troca o dominante por outro
 *     a um trítono dele e mantém o mesmo par de notas característico. `Gb7` faz o trabalho
 *     do `C7`, e resolve em `F7M`.
 *
 * O subV é o que estava faltando para a bossa. Em «Garota de Ipanema» a linha `Am7 → Ab7 →
 * Gm7 → Gb7 → F7M` tinha dois acordes marcados "sem explicação" — e os dois são subV que
 * resolvem descendo um semitom para um grau do tom (`Ab7`→`Gm7`, o ii; `Gb7`→`F7M`, a
 * tônica). A música não sai de Fá ali; era a análise que não sabia ler o recurso.
 *
 * Nas duas regras o alvo precisa aparecer na música COMO ACORDE DIATÔNICO, e não apenas ser
 * uma nota da coleção — mesma exigência, pela mesma razão: sem ela qualquer dominante
 * acharia um alvo por acaso e a explicação viraria carimbo.
 */
function alvoDoDominante(
  esq: Esqueleto,
  alvos: Set<PitchClass>,
): { pc: PitchClass; sub: boolean } | null {
  if (!esq.dominant) return null;
  const porQuinta = ((esq.root + 5) % 12) as PitchClass;
  if (alvos.has(porQuinta)) return { pc: porQuinta, sub: false };
  const porSemitom = ((esq.root + 11) % 12) as PitchClass;
  if (alvos.has(porSemitom)) return { pc: porSemitom, sub: true };
  return null;
}

/**
 * As raízes que aparecem como o "ii" de um ii-V cujo V aponta para dentro do tom.
 *
 * MPB e choro encadeiam ii-V o tempo todo, e o par é uma UNIDADE: o menor prepara o
 * dominante, o dominante resolve. Julgando acorde a acorde, o dominante era explicado (ele
 * aponta para um grau do tom) e o menor que o preparou ficava de fora — o que é ler pela
 * metade uma figura que a música toca inteira.
 *
 * Esta é a única regra que precisa da SEQUÊNCIA, e não do acorde isolado: um Bm7 solto não
 * diz nada, mas `Bm7 E7` antes de um Lá do tom é um ii-V inteiro apontando para lá. Daí ela
 * ficar aqui fora, numa passada própria, em vez de dentro do `papelNaColecao`.
 */
function preparacoesDeIIV(
  esqueletos: (Esqueleto | null)[],
  alvos: Set<PitchClass>,
): Map<PitchClass, PitchClass> {
  // Guarda o ALVO junto, e não só a raiz do ii. O alvo tem de vir da resolução do próprio
  // V, nunca de somar dois semitons ao ii: quando o V é um substituto de trítono ele
  // resolve descendo um semitom, e a conta pelo ii apontava para o lugar errado — era o que
  // produzia o absurdo "ii de um ii-V para fora do campo", numa regra que exige alvo dentro.
  const porRaiz = new Map<PitchClass, PitchClass>();
  const validos = esqueletos.filter((e): e is Esqueleto => e !== null);
  for (let i = 0; i < validos.length - 1; i++) {
    const ii = validos[i];
    const v = validos[i + 1];
    // O ii é menor, e o V vem uma quarta acima dele. É essa distância que faz do par um
    // ii-V, e não dois acordes quaisquer em sequência.
    if (ii.minor !== true || !v.dominant) continue;
    if (((ii.root + 5) % 12) !== v.root) continue;
    const alvo = alvoDoDominante(v, alvos);
    if (alvo && !porRaiz.has(ii.root)) porRaiz.set(ii.root, alvo.pc);
  }
  return porRaiz;
}

function papelNaColecao(
  esq: Esqueleto,
  colecao: Set<PitchClass>,
  alvos: Set<PitchClass>,
  preparacoes?: Map<PitchClass, PitchClass>,
): PapelNoTom {
  if (ehDiatonico(esq, colecao)) return 'diatonico';
  if (alvoDoDominante(esq, alvos)) return 'dominante';
  if (esq.minor === true && preparacoes?.has(esq.root)) return 'preparacao';
  return 'estranho';
}


/**
 * Empréstimo modal: o acorde vem do TOM PARALELO — mesma tônica, qualidade trocada.
 *
 * `Fm`, `Ab`, `Bb` e `Eb` numa música em Dó maior são a cor mais usada da MPB depois do
 * dominante secundário. Todos vêm de Dó MENOR, e é essa a explicação: a música não saiu de
 * Dó, ela pegou emprestado da versão menor dela mesma. No sentido contrário vale igual — o
 * `F` maior em Lá menor (o IV dórico) e o acorde maior de tônica no fim (terça de Picardia).
 *
 * Repare que isto NÃO cabe no encaixe de coleção, e por isso mora no nível do candidato: o
 * paralelo depende da TÔNICA, não da coleção. Dó maior e Lá menor compartilham as mesmas
 * sete notas, mas o paralelo de um é Dó menor e o do outro é Lá maior — coleções distintas.
 * A separação em dois passos continua valendo; o empréstimo é um crédito que só a segunda
 * etapa, que já sabe a tônica, tem informação para conceder.
 *
 * O empréstimo conta na COBERTURA e não na pontuação. Um bônus de pontuação chegou a ser
 * testado (peso 4 sobre a fração de acordes emprestados) e foi medido: em 46 cifras não
 * mudou um único tom nem uma única confiança. Um botão de calibragem que não move nada é
 * passivo, não patrimônio — então saiu. A razão de fundo é que tom e paralelo somam dez das
 * doze notas: dar poder de pontuação ao empréstimo deixaria qualquer candidato capaz de
 * explicar quase tudo, e a análise perderia justamente o poder de discriminar.
 */

/** A coleção do tom paralelo: mesma tônica, qualidade trocada. */
function colecaoParalela(tonic: PitchClass, minor: boolean): Set<PitchClass> {
  // Paralelo de um tom maior é o menor de mesma tônica, cuja coleção nasce uma terça menor
  // acima (Dó menor usa a coleção de Mib). E vice-versa.
  return colecaoDe((minor ? tonic : (tonic + 3) % 12) as PitchClass);
}

/**
 * Peso posicional de um acorde na música.
 *
 * A abertura estabelece a coleção — é ali que o ouvido decide em que conjunto de notas a
 * música está flutuando — e o fim confirma, porque é onde ela repousa. O miolo é onde moram
 * os empréstimos e dominantes secundários, que dizem menos sobre o tom e mais sobre o
 * caminho. Daí o peso em U: pontas pesam mais que meio.
 */
function pesoPosicional(indice: number, total: number): number {
  if (indice < 8) return 1.6;                 // abertura: estabelece
  if (indice >= total - 4) return 1.6;        // repouso: confirma
  return 1;
}

/**
 * Pontua o quanto uma sequência de acordes cabe em cada uma das 12 coleções diatônicas.
 * Devolve um array indexado pela tônica MAIOR da coleção.
 */
function pontuarColecoes(esqueletos: (Esqueleto | null)[]): number[] {
  const total = esqueletos.length;
  const notas: number[] = new Array(12).fill(0);

  for (let tonicaMaior = 0; tonicaMaior < 12; tonicaMaior++) {
    const colecao = colecaoDe(tonicaMaior as PitchClass);
    // Duas passadas: primeiro que acordes são diatônicos (os alvos possíveis), depois a
    // pontuação — um dominante só é secundário se tonicizar um alvo que já se sabe do tom.
    let soma = 0;
    for (let i = 0; i < total; i++) {
      const esq = esqueletos[i];
      if (!esq) continue;

      // AQUI conta nota, e só nota — nenhum crédito por função.
      //
      // As duas perguntas do detector são diferentes, e misturá-las custa caro. "Em que
      // sete notas esta música flutua?" é comparativa: a nota de fora que um dominante
      // secundário traz é EVIDÊNCIA sobre o conteúdo, e perdoá-la aqui apaga o contraste
      // entre coleções — todas passam a explicar tudo. Já "quanto deste tom a música usa?"
      // (o `fits`) é absoluta e por-tom, e aí a função é exatamente o que importa.
      //
      // Medido: creditar função também no encaixe não mudava a cobertura (80% nos dois
      // casos), mas derretia a detecção de trechos modulados — de 3 cifras com fronteira
      // nítida para 1. O contraste que a comparação precisa é o que o crédito dissolve.
      let dentro = 0;
      for (const pc of esq.pcs) if (colecao.has(pc)) dentro++;
      const fora = esq.pcs.length - dentro;
      // Fit normalizado em [-1, 1]: um acorde inteiramente dentro vale +1, inteiramente
      // fora vale -1. Normalizar pelo tamanho evita que uma tétrade pese o dobro de uma
      // tríade só por ter mais notas para contar.
      soma += pesoPosicional(i, total) * ((dentro - fora) / esq.pcs.length);
    }
    notas[tonicaMaior] = soma;
  }
  return notas;
}

/**
 * Evidência de repouso para uma tônica candidata dentro de uma coleção já escolhida.
 *
 * É este passo que separa C de Am — e só ele consegue, porque as notas são as mesmas.
 * Os sinais, do mais forte ao mais fraco:
 *
 *   • cadência V→I de fato tocada (o dominante seguido da tônica) — a prova mais direta
 *     de repouso que uma cifra pode dar;
 *   • último acorde — onde a música pousa. Medido nas 50 cifras, é o sinal isolado mais
 *     confiável: «Tocando Em Frente» abre e fecha em G, e o fit diatônico sozinho dizia C;
 *   • existir o dominante da tônica em algum lugar — em tom menor o V vem maior/dominante
 *     (menor harmônica), então um E7 num contexto C/Am aponta Am, não C;
 *   • primeiro acorde — vota, mas vale menos: em 29 das 45 cifras (64%) ele discorda do
 *     último, e quando discordam é o último que costuma estar certo;
 *   • frequência do acorde de tônica ao longo da música.
 */
function pontuarTonica(
  esqueletos: (Esqueleto | null)[],
  tonic: PitchClass,
  minor: boolean,
  modo?: Modo,
): { total: number; sinais: SinalDeRepouso[] } {
  const validos = esqueletos.filter((e): e is Esqueleto => e !== null);
  if (validos.length === 0) return { total: 0, sinais: [] };

  const sinais: SinalDeRepouso[] = [];
  let score = 0;
  const anota = (nome: string, pontos: number) => {
    if (pontos !== 0) sinais.push({ nome, pontos });
  };
  const ehTonica = (e: Esqueleto) => e.root === tonic && (e.minor === minor || e.minor === null);
  const dominanteDaTonica = (tonic + 7) % 12;

  // cadência V→I realmente tocada
  for (let i = 1; i < validos.length; i++) {
    const ant = validos[i - 1];
    const cur = validos[i];
    if (ant.root === dominanteDaTonica && ant.dominant && ehTonica(cur)) {
      score += 6;
      anota(`cadência V→I tocada (${ant.texto} → ${cur.texto})`, 6);
      break; // uma cadência já prova o ponto; repetir não prova mais
    }
  }

  // repouso final
  const ultimo = validos[validos.length - 1];
  if (ultimo.root === tonic) {
    const p = ehTonica(ultimo) ? 10 : 4;
    score += p;
    anota(`repouso: a música termina em ${ultimo.texto}`, p);
  }

  // O dominante existe em algum lugar? (sinal decisivo do menor: V maior sobre tônica
  // menor.) Só vale nos modos em que a sétima maior existe: num mixolídio ou dórico o V é
  // menor, e encontrar um V7 ali é evidência CONTRA o modo, não a favor — por isso o bônus
  // simplesmente não se aplica, em vez de premiar quem não deveria.
  const dominanteIdiomatico = !modo || MODOS_COM_DOMINANTE.has(modo.nome);
  const oDominante = validos.find(e => e.root === dominanteDaTonica && e.dominant);
  if (dominanteIdiomatico && oDominante) {
    const p = minor ? 5 : 3;
    score += p;
    anota(`o dominante do tom aparece (${oDominante.texto})`, p);
  }

  // abertura
  const primeiro = validos[0];
  if (primeiro.root === tonic) {
    const p = ehTonica(primeiro) ? 5 : 2;
    score += p;
    anota(`abertura: a música começa em ${primeiro.texto}`, p);
  }

  // frequência do acorde de tônica
  const ocorrencias = validos.filter(ehTonica).length;
  const pFreq = Math.min(4, (ocorrencias / validos.length) * 12);
  score += pFreq;
  anota(
    `o acorde de tônica aparece ${ocorrencias}x em ${validos.length}`,
    Math.round(pFreq * 10) / 10,
  );

  return { total: score, sinais };
}

/**
 * Os sete graus, em algarismo romano e no sufixo de cada um.
 *
 * O VII grau do tom maior sai como `m(b5)`, e não como `°`: neste motor `°` guarda a
 * SÉTIMA diminuta ([0,3,6,9]) por ser a grafia brasileira, enquanto a tríade diminuta é
 * `dim` (ver SUFFIX_ALIASES em chordCalculator.ts). Escrever "B°" no campo de Dó faria o
 * próprio `isChordDiatonic` recusá-lo, porque a sétima diminuta traz um Láb que não existe
 * em Dó. `m(b5)` diz exatamente a tríade certa e o motor a monta sem ambiguidade.
 */
/**
 * Monta o campo harmônico de um modo — os sete acordes que nascem da sua escala.
 *
 * Todos os modos de uma coleção compartilham os MESMOS sete acordes; o que muda é qual
 * deles é o primeiro grau, e portanto o papel de cada um. Por isso o campo é uma rotação:
 * gerar a partir da coleção garante que os sete modos nunca se desencontrem entre si.
 *
 * `usadosPorGrau`, quando dado, marca quais graus a música realmente toca. A checagem é por
 * GRAU e não por texto: uma cifra que traz "Am7" usa o vi de Dó tanto quanto uma que traz
 * "Am", e comparar strings perderia isso.
 */
export function campoHarmonico(
  tonic: PitchClass,
  modo: Modo,
  comBemol: boolean,
  usadosPorGrau?: Set<PitchClass>,
): GrauDoCampo[] {
  const tabela = comBemol ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const raizDoModo = ESCALA_MAIOR[modo.grau];
  const intervalos = ESCALA_MAIOR.map((_, i) => {
    const idx = (modo.grau + i) % 7;
    return (ESCALA_MAIOR[idx] - raizDoModo + 12) % 12;
  });
  const temQuartaJusta = intervalos.includes(5);

  return intervalos.map((iv, i) => {
    const idx = (modo.grau + i) % 7;
    const qualidade = QUALIDADE_DO_GRAU[idx];
    const pc = ((tonic + iv) % 12) as PitchClass;
    return {
      grau: numeralDoGrau(iv, qualidade, temQuartaJusta),
      chord: tabela[pc] + qualidade,
      usado: usadosPorGrau ? usadosPorGrau.has(pc) : false,
    };
  });
}

function nomeDoTom(tonic: PitchClass, minor: boolean, comBemol: boolean): string {
  const tabela = comBemol ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return tabela[tonic] + (minor ? 'm' : '');
}

/** Extrai os acordes válidos e seus esqueletos, preservando a ordem e as repetições. */
function esqueletosDe(chords: string[]): (Esqueleto | null)[] {
  return chords.map(esqueletoDe);
}

/**
 * Detecta o tom de uma sequência de acordes (na ordem em que aparecem na cifra, COM
 * repetições — a frequência é sinal). Devolve `null` quando não há acorde reconhecível.
 */
export function detectKey(chords: string[]): DeteccaoTom | null {
  const esqueletos = esqueletosDe(chords);
  const validos = esqueletos.filter(e => e !== null).length;
  if (validos === 0) return null;

  const notasColecao = pontuarColecoes(esqueletos);

  // Cada coleção oferece SETE candidatos a tônica, um por modo grego. O score soma o
  // encaixe da coleção (normalizado) com a evidência de repouso pesada pelo prior do modo —
  // nesta ordem de grandeza, para que a cadência decida a tônica sem poder atropelar a
  // coleção, e para que o modo raro só vença quando a cadência realmente insistir nele.
  const maxColecao = Math.max(...notasColecao);
  const candidates: CandidatoTom[] = [];

  // Acordes DISTINTOS da música. A chave é o ESQUELETO (raiz + notas definidoras), não a
  // raiz: numa cifra de MPB a mesma raiz aparece como A, A7M e A7(9-), que são harmonias
  // diferentes e evidências diferentes. Chavear por raiz guardava só a primeira e fazia o
  // "X de Y acordes" mentir para menos.
  const distintos = new Map<string, Esqueleto>();
  // Grafias diferentes do MESMO esqueleto — `Gm7` e `Gm7(11)`, `D7(9)` e `D7(9-)`. Contam
  // uma vez só na análise, porque são a mesma harmonia (a tensão é descartada de
  // propósito), mas quem exibe precisa saber que ambas existem: no grafo cada grafia é um
  // nó, e sem esta lista a segunda não achava o próprio papel e caía como "sem explicação".
  const variantes = new Map<string, string[]>();
  for (const e of esqueletos) {
    if (!e) continue;
    const chave = `${e.root}:${[...e.pcs].sort((a, b) => a - b).join(',')}`;
    if (!distintos.has(chave)) distintos.set(chave, e);
    const lista = variantes.get(chave);
    if (lista) {
      if (!lista.includes(e.texto)) lista.push(e.texto);
    } else {
      variantes.set(chave, [e.texto]);
    }
  }

  for (let tonicaMaior = 0; tonicaMaior < 12; tonicaMaior++) {
    const encaixe = maxColecao > 0 ? notasColecao[tonicaMaior] / maxColecao : 0;
    const comBemol = COLECOES_COM_BEMOL.has(tonicaMaior as PitchClass);
    const colecao = colecaoDe(tonicaMaior as PitchClass);
    const alvos = alvosDiatonicos(esqueletos, colecao);
    const preparacoes = preparacoesDeIIV(esqueletos, alvos);

    // Acordes que cabem inteiros na coleção, e as raízes deles — que são os graus a marcar
    // no campo. Um dominante secundário (que traz nota de fora) não marca grau nenhum, e é
    // isso mesmo: ele não pertence ao campo, está de passagem.
    const usados = new Set<PitchClass>();
    let cabem = 0;
    let dominantes = 0;
    let preparacoesContadas = 0;
    // Os que a coleção não explica ficam guardados: o empréstimo modal ainda pode dar conta
    // deles, mas só na etapa seguinte, que é a única que sabe qual é a tônica.
    const estranhos: Esqueleto[] = [];
    for (const esq of distintos.values()) {
      const papel = papelNaColecao(esq, colecao, alvos, preparacoes);
      if (papel === 'diatonico') {
        usados.add(esq.root);
        cabem++;
      } else if (papel === 'dominante') {
        // Conta como explicado, mas NÃO marca grau: um dominante secundário não é um grau
        // do campo, está de passagem apontando para um. Marcá-lo faria o campo exibido
        // mentir sobre o que a música toca.
        cabem++;
        dominantes++;
      } else if (papel === 'preparacao') {
        cabem++;
        preparacoesContadas++;
      } else {
        estranhos.push(esq);
      }
    }

    for (const modo of MODOS) {
      const tonic = ((tonicaMaior + ESCALA_MAIOR[modo.grau]) % 12) as PitchClass;
      const minor = modo.suffix.startsWith('m');
      const repouso = pontuarTonica(esqueletos, tonic, minor, modo);

      // Empréstimo modal: dos acordes que a coleção não explicou, quantos são do tom
      // paralelo? Como o paralelo depende da tônica, isto só pode ser contado aqui.
      const paralela = colecaoParalela(tonic, minor);
      const emprestados = estranhos.filter(e => ehDiatonico(e, paralela)).length;

      const tabela = comBemol ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
      const key = tabela[tonic] + (minor ? 'm' : '');
      const penalidadeModo = (modo.prior - 1) * PENALIDADE_MODO;
      // Jônio e eólio JÁ se chamam maior e menor: escrever "G jônio" seria pedantismo num
      // painel de cifra. Os outros cinco precisam do nome, senão "G" mixolídio e "G" maior
      // apareceriam como o mesmo tom com campos diferentes.
      const ehComum = modo.nome === 'jônio' || modo.nome === 'eólio';
      candidates.push({
        key,
        nome: ehComum ? key : `${tabela[tonic]} ${modo.nome}`,
        modo,
        tonic,
        minor,
        score: encaixe * 20 + repouso.total + penalidadeModo,
        analise: {
          encaixe: Math.round(encaixe * 200) / 10,
          repouso: Math.round(repouso.total * 10) / 10,
          penalidadeModo: Math.round(penalidadeModo * 10) / 10,
          sinais: repouso.sinais,
          acordes: [], // preenchido só para os que vão à tela (ver abaixo)
        },
        fits: cabem + emprestados,
        dominantes,
        preparacoes: preparacoesContadas,
        emprestados,
        total: distintos.size,
        campo: campoHarmonico(tonic, modo, comBemol, usados),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const melhor = candidates[0];
  const segundo = candidates[1];

  // Confiança pela margem relativa entre o 1º e o 2º. Uma margem apertada é exatamente o
  // caso em que existem dois tons defensáveis, e é isso que a UI precisa saber para
  // oferecer os dois em vez de afirmar um.
  // A margem mede a segurança sobre o TOM, e por isso ignora rivais que chegam ao mesmo
  // tom por outro modo. Para qualquer música em Sol maior, o segundo colocado é sempre
  // "Sol mixolídio" — os dois compartilham seis das sete notas e a mesma tônica. Medir
  // contra ele rebaixaria toda progressão diatônica clara a "média", quando na verdade não
  // há dúvida nenhuma sobre o tom ser Sol: a dúvida é sobre o modo, que muda o campo
  // exibido e não o tom em que se toca. Então o concorrente que conta é o primeiro com
  // rótulo DIFERENTE, e a disputa entre modos aparece na lista de candidatos, onde é útil.
  const rivalDeOutroTom = candidates.find(c => c.key !== melhor.key) ?? segundo;
  const margem =
    melhor.score > 0 ? (melhor.score - rivalDeOutroTom.score) / melhor.score : 0;
  const { instavel, regions } = detectarRegioes(esqueletos, chords.length);
  const modulates = instavel;
  for (const r of regions) {
    const bruto = ((r.tonic - melhor.tonic) % 12 + 12) % 12;
    r.semitons = bruto > 6 ? bruto - 12 : bruto;
  }

  // A margem mede a distância para o SEGUNDO candidato; ela não sabe dizer se o primeiro é
  // bom. Um tom pode vencer com folga e ainda assim explicar metade da música: é o caso do
  // modal. «Tocando Em Frente» é G, F, C, Dm — G mixolídio. Nenhum dos 24 tons maiores ou
  // menores descreve isso: Sol vence por repouso mas deixa Fá e Dm de fora, Dó abraça os
  // quatro acordes mas a música não repousa nele.
  //
  // O sinal NÃO pode ser a cobertura absoluta do vencedor: em bossa quase todo acorde é
  // cromático, e «Garota de Ipanema» cobre 3 de 9 sendo Fá indiscutível. Cobertura baixa
  // aí é propriedade do gênero, não defeito da leitura — punir por isso rebaixaria o
  // acervo inteiro. O que de fato acusa problema é OUTRO candidato cobrir mais que o
  // vencedor: aí existe uma leitura que explica mais música, e o músico precisa vê-la.
  // A comparação de cobertura ignora o que cada candidato explicou por EMPRÉSTIMO: essa é
  // a categoria mais frouxa, e deixá-la rebaixar confiança faria um tom errado derrubar o
  // certo só por conseguir tomar emprestado mais coisa. Contam o campo e os dominantes, que
  // são compromissos fortes. Medido: sem esta ressalva o acervo perdia duas leituras de
  // confiança alta para média, sem que nenhum tom estivesse errado.
  const cobertura = (c: CandidatoTom) => c.fits - c.emprestados;
  const melhorCobertura = Math.max(...candidates.map(cobertura));
  const rivalCobreMais = melhorCobertura - cobertura(melhor);

  let confidence: Confianca;
  if (modulates) confidence = 'baixa';
  else if (margem >= 0.25) confidence = 'alta';
  else if (margem >= 0.1) confidence = 'media';
  else confidence = 'baixa';

  if (confidence === 'alta' && rivalCobreMais >= 2) confidence = 'media';

  // Só os candidatos que ainda estão no páreo — uma lista de 24 não ajuda ninguém. Duas
  // regras moldam a lista:
  //
  //   • alternativa que não explica acorde NENHUM da música não é alternativa. Antes,
  //     «Garota de Ipanema» vinha com "ou Gm", um tom cujo campo não cobre um único acorde
  //     da peça — oferecer isso é pior do que não oferecer nada, porque parece informação.
  //   • entre as que sobram, ordena-se por COBERTURA, não por pontuação: o que o músico
  //     quer comparar é quanto de música cada leitura explica, e é justamente o rival que
  //     cobre mais que precisa aparecer (o C de 4/4 ao lado do G de 2/4).
  const noPareo = (melhor.score > 0
    ? candidates.filter(c => c.score >= melhor.score * 0.75)
    : candidates
  ).filter(c => c === melhor || c.fits > 0);

  // O rival que cobre mais entra MESMO com pontuação baixa — e é obrigatório que entre,
  // porque foi ele que derrubou a confiança logo acima. Em «Tocando Em Frente» o Dó cobre
  // 4 de 4 mas pontua pouco (a música não repousa nele) e o corte por pontuação o
  // eliminava: sobrava a ressalva sem a razão dela, que é o pior resultado possível.
  const maisCoberto = candidates.find(c => cobertura(c) === melhorCobertura);
  const pool = new Set(noPareo);
  if (rivalCobreMais >= 2 && maisCoberto) pool.add(maisCoberto);

  const alternativas = [...pool]
    .filter(c => c !== melhor)
    .sort((a, b) => b.fits - a.fits || b.score - a.score);

  const limite = confidence === 'alta' ? 0 : 3;
  const escolhidos = [melhor, ...alternativas.slice(0, limite)];

  // A conta acorde-a-acorde só é montada para os que vão à tela. Fazê-la para os 84
  // candidatos seria desperdício, e nenhum painel mostraria 84 leituras.
  for (const c of escolhidos) {
    if (!c.analise) continue;
    const colecao = colecaoDe(((c.tonic - ESCALA_MAIOR[c.modo.grau] + 24) % 12) as PitchClass);
    const alvos = alvosDiatonicos(esqueletos, colecao);
    const preparacoes = preparacoesDeIIV(esqueletos, alvos);
    const paralela = colecaoParalela(c.tonic, c.minor);
    const grauPorRaiz = new Map(
      c.campo.map(g => [noteNameToPitchClass(g.chord.replace(/m\(b5\)$|m$/, '')), g.grau]),
    );

    const chaveDe = (e: Esqueleto) =>
      `${e.root}:${[...e.pcs].sort((a, b) => a - b).join(',')}`;

    c.analise.acordes = [...distintos.values()].map(esq => {
      const grafias = variantes.get(chaveDe(esq)) ?? [esq.texto];
      const papel = papelNaColecao(esq, colecao, alvos, preparacoes);
      if (papel === 'diatonico') {
        return {
          chord: esq.texto,
          variantes: grafias,
          papel: 'campo' as const,
          detalhe: grauPorRaiz.get(esq.root) ?? undefined,
        };
      }
      if (papel === 'dominante') {
        const alvo = alvoDoDominante(esq, alvos)!;
        const grau = grauPorRaiz.get(alvo.pc) ?? 'um grau do tom';
        return {
          chord: esq.texto,
          variantes: grafias,
          papel: 'dominante' as const,
          detalhe: alvo.sub ? `subV, resolve em ${grau}` : `toniciza ${grau}`,
        };
      }
      if (papel === 'preparacao') {
        const alvo = preparacoes.get(esq.root)!;
        return {
          chord: esq.texto,
          variantes: grafias,
          papel: 'preparacao' as const,
          detalhe: `ii de um ii-V para ${grauPorRaiz.get(alvo) ?? 'o tom'}`,
        };
      }
      if (ehDiatonico(esq, paralela)) {
        return {
          chord: esq.texto,
          variantes: grafias,
          papel: 'emprestado' as const,
          detalhe: c.minor ? 'vem do paralelo maior' : 'vem do paralelo menor',
        };
      }
      return { chord: esq.texto, variantes: grafias, papel: 'estranho' as const };
    });
  }

  return {
    key: melhor.key,
    tonic: melhor.tonic,
    minor: melhor.minor,
    confidence,
    nome: melhor.nome,
    modo: melhor.modo,
    margin: Math.max(0, Math.min(1, margem)),
    preferFlats: COLECOES_COM_BEMOL.has(
      (melhor.minor ? (melhor.tonic + 3) % 12 : melhor.tonic) as PitchClass,
    ),
    candidates: escolhidos,
    modulates,
    regions: modulates ? regions : [],
  };
}

/**
 * Janela usada para procurar mudança de coleção, em acordes.
 *
 * O passo é menor que a janela de propósito: com passo igual à janela, um trecho modulado
 * do tamanho de UMA janela produz uma única leitura da coleção nova, e ela é descartada
 * pelo MIN_JANELAS abaixo. Sobrepondo a 4, uma ponte de 12 acordes já rende duas leituras
 * — que é o menor trecho que ainda merece ser chamado de tom próprio.
 */
const JANELA = 12;
const PASSO = 4;

/**
 * Procura trechos que passaram a flutuar em OUTRA coleção — a modulação.
 *
 * A janela olha coleção, não tônica: é a entrada de notas novas que caracteriza a mudança
 * de padrão, e é justamente isso que uma tônica nova traz consigo. Exige-se margem sobre a
 * coleção global (`FOLGA`) porque dominante secundário e empréstimo modal também trazem
 * nota de fora sem que o tom mude — sem essa folga «Corcovado», que é cromática mas estável,
 * apareceria como quatro modulações.
 *
 * Janelas vizinhas com a mesma coleção viram uma região só; regiões curtas demais são
 * descartadas, porque duas janelas de passagem não fazem um tom novo.
 */
const FOLGA = 1.15;
const MIN_JANELAS = 2;

interface Grupo {
  inicio: number;
  fim: number;
  colecao: number;
  n: number;
}

/** Agrupa janelas vizinhas de mesma coleção num trecho só. */
function agrupar(janelas: { inicio: number; fim: number; colecao: number }[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const j of janelas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.colecao === j.colecao) {
      ultimo.fim = j.fim;
      ultimo.n++;
    } else {
      grupos.push({ inicio: j.inicio, fim: j.fim, colecao: j.colecao, n: 1 });
    }
  }
  return grupos;
}

/**
 * Acima disto, o que se detectou não é modulação — é instabilidade tonal.
 *
 * Uma música que muda de tom muda uma ou duas vezes: a ponte sobe, o final sobe. Nove
 * trechos alternando não descrevem nove tons, descrevem uma harmonia que passeia (o caso do
 * «São Gonça», que fica indo e voltando entre a coleção de Sol e a de Dó por causa do bVII).
 * Nesse caso a resposta honesta é dizer que o tom não está firme SEM apontar fronteiras que
 * não existem — daí `instavel: true` com a lista de trechos vazia.
 */
const MAX_REGIOES = 4;

function detectarRegioes(
  esqueletos: (Esqueleto | null)[],
  total: number,
): { instavel: boolean; regions: RegiaoTonal[] } {
  if (total < JANELA * 2) return { instavel: false, regions: [] };

  const globais = pontuarColecoes(esqueletos);
  const colecaoGlobal = globais.indexOf(Math.max(...globais));

  const janelas: { inicio: number; fim: number; colecao: number }[] = [];
  for (let i = 0; i + JANELA <= total; i += PASSO) {
    const trecho = esqueletos.slice(i, i + JANELA);
    const notas = pontuarColecoes(trecho);
    const melhor = notas.indexOf(Math.max(...notas));
    // Só conta como coleção diferente se vencer a global com folga dentro da janela.
    const colecao =
      melhor !== colecaoGlobal && notas[melhor] > notas[colecaoGlobal] * FOLGA
        ? melhor
        : colecaoGlobal;
    janelas.push({ inicio: i, fim: i + JANELA - 1, colecao });
  }

  // Janela isolada entre duas vizinhas iguais é ruído, não tom novo: um dominante
  // secundário ou um empréstimo modal derruba UMA leitura sem que a música tenha saído do
  // lugar. Achatar contra os vizinhos antes de agrupar é o que impede «São Gonça» de sair
  // com dez "modulações" alternando a cada janela.
  for (let i = 1; i < janelas.length - 1; i++) {
    const ant = janelas[i - 1].colecao;
    if (ant === janelas[i + 1].colecao && janelas[i].colecao !== ant) {
      janelas[i].colecao = ant;
    }
  }

  // Trecho curto demais é absorvido por quem veio antes — duas janelas de passagem não
  // fazem um tom próprio. Absorver (em vez de descartar, como antes) é o que evita deixar
  // dois grupos IGUAIS colados no resultado, que apareciam como "Am > Am" e "C > C".
  let grupos = agrupar(janelas);
  for (let i = 1; i < grupos.length; i++) {
    if (grupos[i].n < MIN_JANELAS) grupos[i].colecao = grupos[i - 1].colecao;
  }
  grupos = agrupar(
    grupos.map(g => ({ inicio: g.inicio, fim: g.fim, colecao: g.colecao })),
  );
  // O primeiro grupo pode ter ficado curto sem ninguém para absorvê-lo.
  if (grupos.length > 1 && grupos[0].fim - grupos[0].inicio + 1 < JANELA + PASSO) {
    grupos[1].inicio = grupos[0].inicio;
    grupos.shift();
  }

  if (grupos.length < 2) return { instavel: false, regions: [] };
  if (grupos.length > MAX_REGIOES) return { instavel: true, regions: [] };

  const regions = grupos.map(g => {
    const trecho = esqueletos.slice(g.inicio, g.fim + 1);
    const comBemol = COLECOES_COM_BEMOL.has(g.colecao as PitchClass);
    const relativaMenor = ((g.colecao + RELATIVA_MENOR) % 12) as PitchClass;
    const maior = pontuarTonica(trecho, g.colecao as PitchClass, false).total;
    const menor = pontuarTonica(trecho, relativaMenor, true).total;
    const minor = menor > maior;
    const tonicaDoTrecho = minor ? relativaMenor : (g.colecao as PitchClass);
    return {
      from: g.inicio,
      to: Math.min(g.fim, total - 1),
      key: nomeDoTom(tonicaDoTrecho, minor, comBemol),
      tonic: tonicaDoTrecho,
      // Preenchido em detectKey, que é quem conhece a tônica de casa.
      semitons: 0,
    };
  });

  return { instavel: true, regions };
}

/**
 * O acorde pertence ao tom? (é diatônico)
 *
 * Veio do CifraViewer.tsx, onde era teoria musical solta num arquivo de 2700 linhas, sem
 * teste. Dois defeitos foram corrigidos na mudança:
 *
 *   • a qualidade do acorde era lida por `suffix.includes('m') && !includes('maj')`. Como o
 *     normalizeSuffix do motor produz 'Maj7' com M maiúsculo e o padrão pt-BR usa '7M'
 *     (notation.ts), a função acertava por coincidência de grafia, não por desenho — e
 *     'm(Maj7)' ou 'm7(b5)' caíam no ramo errado. Agora a terça vem da FÓRMULA.
 *   • o tom menor era reconhecido por `endsWith('m') || endsWith('m7')`, então 'Am9' e
 *     'Am6' eram tratados como tom MAIOR. Agora `key` já chega como tríade do detectKey.
 *
 * Aceita tanto o rótulo de tom ("G", "Em") quanto uma cifra completa, por robustez com
 * chamadores antigos.
 */
export function isChordDiatonic(chordName: string, key: string, modo?: Modo): boolean {
  if (!chordName || !key) return false;

  const tomEsq = esqueletoDe(key);
  const acordeEsq = esqueletoDe(chordName);
  if (!tomEsq || !acordeEsq) return false;

  // Sem modo declarado, o tom é lido como jônio ou eólio — o comportamento de sempre, que
  // é o certo para a esmagadora maioria das cifras. Com modo, a coleção é outra: em Sol
  // mixolídio o Fá é diatônico, e em Sol maior não é. Quem chama a partir de um `detectKey`
  // deve passar `deteccao.modo`, senão a resposta descreve um tom que não é o da música.
  const tomMenor = tomEsq.minor === true;
  const grauNaColecao = modo ? ESCALA_MAIOR[modo.grau] : tomMenor ? RELATIVA_MENOR : 0;
  const tonicaMaior = ((tomEsq.root - grauNaColecao + 24) % 12) as PitchClass;
  const colecao = colecaoDe(tonicaMaior);

  // Diatônico = todas as notas definidoras cabem na coleção. Isso já cobre o grau E a
  // qualidade de uma vez: Am cabe em C, mas A maior não, porque traz o C# de fora.
  return acordeEsq.pcs.every(pc => colecao.has(pc));
}
