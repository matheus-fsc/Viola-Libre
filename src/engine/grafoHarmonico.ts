/**
 * O grafo harmônico de uma cifra — a música como rede de estados, não como lista.
 *
 * Adaptado do DEMH (Diagrama de Estados Musicais Harmônicos), de Alexei Alves de Queiroz:
 * um dígrafo em que cada nó é um estado harmônico (o acorde dentro de uma tonalidade) e
 * cada aresta é uma transição realmente tocada, com ordem e repetição. O ponto do modelo é
 * abandonar a leitura linear da esquerda para a direita: uma cifra é cíclica, volta aos
 * mesmos lugares, e desenhá-la em linha esconde justamente isso.
 *
 * ── Por que o anel é o CICLO DE QUINTAS ────────────────────────────────────────────────
 *
 * A posição de cada acorde no anel é a distância dele até a tônica contada em QUINTAS, e
 * não em semitons. Não é escolha estética: os sete graus de um tom formam um trecho
 * CONTÍNUO do ciclo de quintas — sempre, em qualquer tom e em qualquer modo. Então o campo
 * harmônico aparece sozinho como um arco fechado, e tudo que a música pega emprestado cai
 * visivelmente fora dele. A distância angular passa a significar distância harmônica.
 *
 * O outro ganho é nas arestas: a cadência mais comum da música tonal é a de quarta (V→I,
 * ii→V), e nesse anel ela vira um passo entre vizinhos. Uma peça tonal desenha arcos curtos
 * e regulares; uma cromática espalha cordas longas atravessando o círculo. Dá para
 * reconhecer o gênero pela forma antes de ler um rótulo.
 */
import type { PitchClass } from './types';
import { parseChordString, noteNameToPitchClass } from './chordCalculator';
import type { AcordeAnalisado, DeteccaoTom, PapelDeAcorde } from './detectKey';

/**
 * Como a fundamental se moveu de um acorde para o outro.
 *
 * O DEMH codifica o tipo de cadência na própria seta, e é o que se faz aqui. A distinção
 * que interessa não é o nome do intervalo, é a FORÇA: a quarta é o movimento cadencial por
 * excelência, o cromático é condução de voz, e o trítono quase sempre é substituição.
 */
export type MovimentoDaRaiz = 'quarta' | 'segunda' | 'terca' | 'cromatico' | 'tritono' | 'nenhum';

export interface NoDoGrafo {
  /** O acorde como está escrito na cifra. Serve de identidade. */
  id: string;
  papel: PapelDeAcorde;
  /** Grau no campo, quando o acorde é do tom. */
  grau?: string;
  /** Explicação curta do papel, quando não é do campo. */
  detalhe?: string;
  root: PitchClass;
  /** Quantas vezes o acorde aparece na cifra. */
  ocorrencias: number;
  /** Posição no ciclo de quintas relativa à tônica, em [-6, +5]. */
  quintas: number;
  /**
   * Raio do disco, já grande o bastante para o rótulo caber DENTRO dele.
   *
   * Calculado aqui, e não na página, porque o mesmo número decide duas coisas que precisam
   * concordar: o tamanho desenhado e o espaço reservado no empilhamento. Separados, os
   * discos se sobrepunham — a página desenhava um tamanho e o layout reservava outro.
   */
  r: number;
  x: number;
  y: number;
}

export interface ArestaDoGrafo {
  de: string;
  para: string;
  /** Quantas vezes essa transição foi tocada. */
  vezes: number;
  movimento: MovimentoDaRaiz;
}

export interface GrafoHarmonico {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Raio do anel usado no layout — a página desenha em torno dele. */
  raio: number;
  /**
   * Meia-largura do menor quadrado centrado na origem que contém tudo, já com respiro.
   *
   * É o enquadramento inicial. Com uma moldura fixa, uma música de quatro acordes ficava
   * perdida num campo enorme e outra de quarenta estourava a borda — o desenho tem de
   * caber por construção, não por sorte do repertório.
   */
  extensao: number;
  /** A transição mais repetida, para normalizar a espessura das setas. */
  maiorPeso: number;
}

/** Sete for a: o inverso de 7 módulo 12 é 7, então multiplicar devolve a conta de quintas. */
function quintasAte(pc: PitchClass, tonica: PitchClass): number {
  const n = (((pc - tonica + 12) % 12) * 7) % 12;
  // Traz para a volta curta: o Fá de Dó é −1 quinta, não +11.
  return n > 6 ? n - 12 : n;
}

function movimentoDaRaiz(de: PitchClass, para: PitchClass): MovimentoDaRaiz {
  const d = (para - de + 12) % 12;
  if (d === 0) return 'nenhum';
  if (d === 5 || d === 7) return 'quarta';
  if (d === 1 || d === 11) return 'cromatico';
  if (d === 2 || d === 10) return 'segunda';
  if (d === 3 || d === 4 || d === 8 || d === 9) return 'terca';
  return 'tritono';
}

function raizDe(acorde: string): PitchClass | null {
  try {
    const { root } = parseChordString(acorde);
    if (!root) return null;
    return (noteNameToPitchClass(root) % 12) as PitchClass;
  } catch {
    return null;
  }
}

const RAIO = 290;
/** Quanto um acorde de fora do campo é empurrado para fora do anel. */
const AFASTAMENTO = 92;
/** Respiro entre dois discos empilhados na mesma direção. */
const FOLGA = 16;

/**
 * Raio de um disco: o que for maior entre caber o rótulo e mostrar a frequência.
 *
 * O rótulo manda. Um `Bb7(9/11+)` dentro de um círculo dimensionado só pela frequência
 * transbordava por cima dos vizinhos, e um grafo em que os nomes vazam deixa de ser
 * legível justamente onde a harmonia é mais interessante.
 *
 * A frequência entra pela raiz cúbica: um acorde tocado 50 vezes contra outro de 2 não deve
 * aparecer 25 vezes maior, ou o desenho vira um disco só cercado de satélites.
 */
function raioDoDisco(rotulo: string, ocorrencias: number, maior: number): number {
  const paraOTexto = rotulo.length * 3.7 + 8;
  const paraAFrequencia = 16 + Math.cbrt(ocorrencias / Math.max(1, maior)) * 12;
  return Math.max(paraOTexto, paraAFrequencia);
}

/**
 * Monta o grafo a partir da sequência de acordes e da leitura de tom já feita.
 *
 * Os papéis (campo, dominante, empréstimo…) vêm prontos do `detectKey`: recalculá-los aqui
 * abriria a porta para o grafo contar uma história diferente da que o painel de tom conta,
 * sobre a mesma música. Uma fonte só.
 */
export function montarGrafo(chords: string[], deteccao: DeteccaoTom): GrafoHarmonico {
  // Indexado por TODAS as grafias, e não só pela representante: `Gm7` e `Gm7(11)` são a
  // mesma harmonia para a análise (a tensão é descartada de propósito), mas são dois nós
  // distintos aqui. Procurando só pelo texto exato, o segundo não achava o próprio papel e
  // caía como "sem explicação" ao lado do primeiro, que era o ii do tom.
  const analise = deteccao.candidates[0]?.analise;
  const porAcorde = new Map<string, AcordeAnalisado>();
  for (const a of analise?.acordes ?? []) {
    for (const grafia of a.variantes.length ? a.variantes : [a.chord]) {
      porAcorde.set(grafia, a);
    }
  }

  // Nós: um por acorde distinto, contando repetições.
  const nos = new Map<string, NoDoGrafo>();
  for (const acorde of chords) {
    const existente = nos.get(acorde);
    if (existente) {
      existente.ocorrencias++;
      continue;
    }
    const root = raizDe(acorde);
    if (root === null) continue;
    const info = porAcorde.get(acorde);
    nos.set(acorde, {
      id: acorde,
      papel: info?.papel ?? 'estranho',
      grau: info?.papel === 'campo' ? info.detalhe : undefined,
      detalhe: info?.papel !== 'campo' ? info?.detalhe : undefined,
      root,
      ocorrencias: 1,
      quintas: quintasAte(root, deteccao.tonic),
      r: 0,
      x: 0,
      y: 0,
    });
  }

  // Arestas: transições consecutivas, agregadas. Repetir o mesmo acorde não é transição.
  const arestas = new Map<string, ArestaDoGrafo>();
  for (let i = 0; i < chords.length - 1; i++) {
    const de = chords[i];
    const para = chords[i + 1];
    if (de === para) continue;
    const a = nos.get(de);
    const b = nos.get(para);
    if (!a || !b) continue;
    const chave = `${de} ${para}`;
    const existente = arestas.get(chave);
    if (existente) {
      existente.vezes++;
    } else {
      arestas.set(chave, {
        de,
        para,
        vezes: 1,
        movimento: movimentoDaRaiz(a.root, b.root),
      });
    }
  }

  const lista = [...nos.values()];
  const maisTocado = Math.max(1, ...lista.map(n => n.ocorrencias));
  for (const n of lista) n.r = raioDoDisco(n.id, n.ocorrencias, maisTocado);
  posicionar(lista);

  const listaArestas = [...arestas.values()].sort((x, y) => y.vezes - x.vezes);
  const extensao =
    Math.max(RAIO, ...lista.map(n => Math.max(Math.abs(n.x), Math.abs(n.y)) + n.r)) + 24;
  return {
    nos: [...nos.values()].sort((a, b) => b.ocorrencias - a.ocorrencias),
    arestas: listaArestas,
    raio: RAIO,
    extensao,
    maiorPeso: listaArestas[0]?.vezes ?? 1,
  };
}

/**
 * Coloca os nós no anel, girado para que o campo harmônico fique centrado no topo.
 *
 * O giro não é enfeite: em tom menor os sete graus ocupam o trecho de −4 a +2 quintas, e em
 * tom maior o de −1 a +5. Sem girar, o mesmo campo apareceria em lugares diferentes do anel
 * conforme o modo, e a leitura mudaria de música para música sem que a música mudasse.
 * Centrando pelo meio dos graus que existem, o campo cai sempre no mesmo lugar.
 */
function posicionar(nos: NoDoGrafo[]): void {
  const doCampo = nos.filter(n => n.papel === 'campo');
  const referencia = doCampo.length > 0 ? doCampo : nos;
  const centro =
    referencia.reduce((s, n) => s + n.quintas, 0) / Math.max(1, referencia.length);

  // Vários acordes caem na mesma direção — em Fá, o `Gm7`, o `G7(13)` e o `Gm7(11)` estão
  // todos a duas quintas da tônica. Eles se empilham para fora, e o passo do empilhamento
  // tem de somar os raios REAIS dos dois discos vizinhos: um passo fixo funcionava para
  // rótulos curtos e deixava `Ab7(11+)` por cima do vizinho.
  const porDirecao = new Map<number, NoDoGrafo[]>();
  for (const no of nos) {
    const fila = porDirecao.get(no.quintas);
    if (fila) fila.push(no);
    else porDirecao.set(no.quintas, [no]);
  }

  for (const [quintas, fila] of porDirecao) {
    // Os do campo primeiro, e entre eles o mais tocado: o anel guarda a harmonia do tom, e
    // quem está de passagem orbita por fora. Sem esta ordem, um dominante que aparecesse
    // antes na cifra empurrava para longe o próprio grau que ele prepara.
    fila.sort((a, b) => {
      const campoA = a.papel === 'campo' ? 0 : 1;
      const campoB = b.papel === 'campo' ? 0 : 1;
      return campoA - campoB || b.ocorrencias - a.ocorrencias;
    });

    const passo = quintas - centro;
    const angulo = (passo * 30 - 90) * (Math.PI / 180); // −90°: o topo é o começo
    let raio = RAIO;

    fila.forEach((no, i) => {
      // O primeiro que não é do campo salta para fora do anel, e os seguintes continuam
      // dali — é o que faz o anel ler como fronteira do tom.
      if (no.papel !== 'campo') raio = Math.max(raio, RAIO + AFASTAMENTO);
      no.x = Math.cos(angulo) * raio;
      no.y = Math.sin(angulo) * raio;
      // O centro do próximo precisa deixar passar o raio DOS DOIS discos, mais o respiro.
      raio += no.r + FOLGA + (fila[i + 1]?.r ?? 0);
    });
  }
}
