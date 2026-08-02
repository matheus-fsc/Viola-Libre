/*
 * Viola Libre — o cifrário aberto e matemático da música de raiz
 * Copyright (C) 2026 Matheus Coelho
 * Licenciado sob a GNU AGPL-3.0 — veja o arquivo LICENSE na raiz do projeto.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CornerUpLeft, Download, FileDown, Pencil, Printer, Scissors } from 'lucide-react';
import { getCifra, type CifraDetail } from '../../services/api';
import {
  buildChord,
  buildVoicingFromFrets,
  calculateVoicings,
  parseChordString,
  transposeChordString,
} from '../../engine/chordCalculator';
import type { Voicing } from '../../engine/types';
import { PRESET_INSTRUMENTS } from '../../engine/tunings';
import {
  splitHtmlByTabs,
  splitTabSystems,
  parseTabText,
  transposeTab,
  getTuningLabelsHighToLow,
  getTuningMidiHighToLow,
  TAB_POSITIONS,
  type ContentSegment,
} from '../../engine/tabTransposer';
import { isChordLine, reflowCifraHtml } from '../../services/cifraUtils';
import { prettifySlug } from '../../services/cifraFavorites';
import { getPreferredInstrumentId } from '../../utils/instrumentPreference';
import { useSeo, SITE_URL } from '../../hooks/useSeo';
import { FretboardDiagram } from '../../components/FretboardDiagram';
import { ChordEditorModal } from '../../components/ChordEditorModal';
import '../../components/Cifras.css';
import './CifraPrint.css';

/**
 * Preferências da folha. Ficam no localStorage porque quem imprime cifra imprime várias:
 * reescolher fonte, colunas e margem a cada música é trabalho repetido à toa.
 */
interface OpcoesFolha {
  tabs: boolean;
  colunas: 1 | 2;
  fonte: number;       // px
  entrelinha: number;  // sem unidade
  margemExtra: number; // mm somados à margem do @page
  cabecalho: boolean;
  rodape: boolean;
  acordesPreto: boolean;
  /** Diagramas das formas no alto da folha. */
  formas: boolean;
  /** Proporcional cabe mais texto por coluna; monoespaçada é a leitura tradicional. */
  proporcional: boolean;
}

const OPCOES_PADRAO: OpcoesFolha = {
  // Tabs desligadas por padrão: são o que faz uma cifra de 2 páginas virar 5, e quem
  // imprime normalmente quer a letra com os acordes em cima.
  tabs: false,
  colunas: 2,
  fonte: 11,
  entrelinha: 1.45,
  margemExtra: 0,
  cabecalho: true,
  // Desligado: o navegador já carimba a URL e o número da página quando o usuário quer
  // isso, e uma cifra na estante de partitura não precisa de propaganda do site.
  rodape: false,
  acordesPreto: false,
  formas: false,
  proporcional: false,
};

/**
 * O que o usuário mandou acontecer antes de uma linha.
 *
 * `coluna` e `pagina` existem separadas porque no CSS de fragmentação elas NÃO são a mesma
 * coisa: uma quebra de coluna na última coluna da página até avança de folha no papel, mas
 * na tela — que não é paginada — ela só cria uma coluna a mais, que sai para fora do papel.
 * Quem quer folha nova pede folha nova.
 */
type Marca = 'coluna' | 'pagina' | 'colar';

const CSS_DA_MARCA: Record<Marca, { quebra: string; cor: string; espessura: string }> = {
  coluna: { quebra: 'break-before:column', cor: '#cc3300', espessura: '1px dashed' },
  pagina: { quebra: 'break-before:page', cor: '#002fa7', espessura: '2px solid' },
  colar: { quebra: 'break-before:avoid-column', cor: '#008000', espessura: '1px dashed' },
};

const CHAVE_OPCOES = 'viola_libre_opcoes_impressao';

function lerOpcoes(): OpcoesFolha {
  try {
    const raw = localStorage.getItem(CHAVE_OPCOES);
    if (!raw) return OPCOES_PADRAO;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return OPCOES_PADRAO;
    // Merge com o padrão: uma versão antiga guardada sem um campo novo não pode
    // deixar a folha com `undefined` no meio de um cálculo de CSS.
    return { ...OPCOES_PADRAO, ...(parsed as Partial<OpcoesFolha>) };
  } catch {
    return OPCOES_PADRAO;
  }
}

function gravarOpcoes(o: OpcoesFolha): void {
  try {
    localStorage.setItem(CHAVE_OPCOES, JSON.stringify(o));
  } catch {
    /* storage bloqueado — as opções valem só nesta visita */
  }
}

/** HTML da cifra → texto puro, preservando as quebras de linha originais. */
function htmlParaTexto(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  // &nbsp; vira U+00A0 no textContent: num .txt ele aparece como caractere estranho em
  // vários editores, e o que a linha quer dizer ali é só "espaço".
  return (el.textContent ?? '').replace(/\u00A0/g, ' ');
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Uma linha que parece pauta de tablatura ("E|--3--|", "|-0-2-", "---3---"). */
function pareceLinhaDeTab(linha: string): boolean {
  const t = linha.trim();
  return /^[A-Ga-g#b]{1,3}\|/.test(t) || /^\|+[-x0-9hpb/\\~^.]/.test(t) || /^[-x0-9hpb/\\~^.|]{8,}$/.test(t);
}

/**
 * Texto puro editado à mão → os mesmos segmentos que a cifra original produz.
 *
 * O caminho normal (splitHtmlByTabs) depende da marcação que vem da fonte, e o texto que
 * sai do editor não tem marcação nenhuma. Aqui a divisão é por forma da linha: corridas de
 * duas ou mais linhas de pauta viram um bloco de tab, e o resto vira html — com os acordes
 * de volta em <b>, senão as linhas só de acorde sairiam pretas no meio da letra azul.
 */
function segmentosDoTexto(texto: string): ContentSegment[] {
  const linhas = texto.split('\n');
  const segs: ContentSegment[] = [];
  let i = 0;
  while (i < linhas.length) {
    if (pareceLinhaDeTab(linhas[i]) && pareceLinhaDeTab(linhas[i + 1] ?? '')) {
      const inicio = i;
      while (i < linhas.length && pareceLinhaDeTab(linhas[i])) i++;
      segs.push({ type: 'tab', content: linhas.slice(inicio, i).join('\n') });
      continue;
    }
    const inicio = i;
    while (i < linhas.length && !(pareceLinhaDeTab(linhas[i]) && pareceLinhaDeTab(linhas[i + 1] ?? ''))) i++;
    const bloco = linhas.slice(inicio, i)
      .map(l => (isChordLine(l) ? l.replace(/\S+/g, m => `<b>${escaparHtml(m)}</b>`) : escaparHtml(l)))
      .join('\n');
    segs.push({ type: 'html', content: bloco });
  }
  return segs;
}

const LINHA_VAZIA = '<div class="cifra-line cifra-line-blank">&nbsp;</div>';

/**
 * Reduz qualquer sequência de linhas em branco a uma só.
 *
 * A marcação que vem da fonte separa os blocos com dois, três ou quatro \n, e com as
 * tablaturas ocultas sobra ainda o buraco que elas deixaram. Na tela isso é só rolagem;
 * no papel é folha a mais — que é justamente o que esta página existe para evitar.
 */
function comprimirVazios(html: string): string {
  return html.split(LINHA_VAZIA).filter((p, i) => i === 0 || p !== '').join(LINHA_VAZIA);
}

/**
 * Carimba um número em cada linha do HTML refluído.
 *
 * É o que dá endereço a uma linha depois que ela virou innerHTML: sem isso não há como o
 * clique do usuário dizer "quebre a coluna AQUI" nem como o React lembrar onde foi.
 */
function numerarLinhas(html: string, inicio: number): { html: string; proximo: number } {
  let n = inicio;
  const marcado = html.replace(/<div class="cifra-line/g, () => `<div data-linha="${n++}" class="cifra-line`);
  return { html: marcado, proximo: n };
}

function baixarTexto(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Uma tab reescrita para o instrumento e o tom escolhidos, dividida em sistemas (uma
 * pauta cada). Mesma engine do TabTransposerBlock do visualizador.
 *
 * Vive fora do componente porque a folha e o .txt precisam da MESMA tab: o cabeçalho diz
 * em que afinação a cifra está, e um arquivo que levasse a tab original desmentiria o
 * próprio cabeçalho.
 */
function tabParaInstrumento(texto: string, cordasAlvo: number[], semitons: number, posIdx: number): string[] {
  const midiAlvo = getTuningMidiHighToLow(cordasAlvo);
  const rotulosAlvo = getTuningLabelsHighToLow(cordasAlvo);
  return splitTabSystems(texto).map(t => {
    const tab = parseTabText(t);
    if (!tab) return t;
    const origem = tab.rows.map(r => r.midiOpen).filter(m => m > 0);
    const mesmoInstrumento = origem.length === midiAlvo.length
      && origem.every((m, i) => Math.abs(m - midiAlvo[i]) < 1)
      && semitons === 0;
    if (mesmoInstrumento) return t;
    try {
      return transposeTab(tab, midiAlvo, rotulosAlvo, semitons, TAB_POSITIONS[posIdx].fret);
    } catch {
      return t;
    }
  });
}

/**
 * Um pedaço indivisível da cifra: uma linha ou um bloco de tab inteiro.
 *
 * O paginador trabalha em cima destes, e não do HTML corrido, porque paginar é decidir
 * onde CORTAR — e para isso é preciso saber quais são os pontos onde cortar é permitido.
 * Dentro de um bloco, não é.
 */
interface Bloco {
  html: string;
  /** Número da linha, quando o bloco é uma linha. É por ele que a marca do usuário chega. */
  linha?: number;
}

/**
 * Bloco de tablatura como HTML — sem a moldura XP e sem rolagem horizontal: no papel não
 * há como rolar, então a tab tem que caber ou não vai.
 */
function tabComoHtml(texto: string, cordasAlvo: number[], rotuloAlvo: string, semitons: number, posIdx: number): string {
  const sistemas = tabParaInstrumento(texto, cordasAlvo, semitons, posIdx);
  const titulo = escaparHtml(`Tab · ${rotuloAlvo} · ${TAB_POSITIONS[posIdx].label}`);
  return `<div class="folha-tab"><div class="folha-tab-titulo">${titulo}</div>`
    + sistemas.map(s => `<pre>${escaparHtml(s)}</pre>`).join('')
    + '</div>';
}

/** Quebra o HTML já refluído na lista de blocos que o paginador sabe distribuir. */
function blocosDoHtml(html: string): Bloco[] {
  const caixa = document.createElement('div');
  caixa.innerHTML = html;
  return [...caixa.children].map(el => ({
    html: el.outerHTML,
    linha: el instanceof HTMLElement && el.dataset.linha !== undefined ? Number(el.dataset.linha) : undefined,
  }));
}

/**
 * Distribui os blocos em folhas de `colunas` colunas com `alturaColuna` de altura.
 *
 * É este laço que faz o transbordo virar folha nova em vez de coluna a mais: quando acaba
 * a última coluna da folha, a próxima coluna é a primeira da folha SEGUINTE, e o conteúdo
 * desce. O `column-count` do CSS não tem como fazer isso — ele só sabe abrir mais uma
 * coluna ao lado, que era o que saía para fora do papel.
 *
 * Devolve: folhas → colunas → índices de bloco.
 */
function paginar(
  blocos: Bloco[],
  alturas: number[],
  marcas: Map<number, Marca>,
  colunas: number,
  alturaColuna: number,
  alturaPrimeiraFolha: number,
  folgaDoPuxar: number,
): number[][][] {
  if (blocos.length === 0 || alturaColuna <= 0) return [[[]]];

  const folhas: number[][][] = [[[]]];
  let f = 0, c = 0, usado = 0;
  const atual = () => folhas[f][c];
  // O cabeçalho e os diagramas atravessam a largura inteira da primeira folha, então
  // roubam altura das DUAS colunas dela, não só da primeira. Enquanto isso valia só para
  // a coluna 1, a coluna 2 da capa era paginada com a altura cheia e transbordava.
  const disponivel = () => (f === 0 ? alturaPrimeiraFolha : alturaColuna);

  const novaColuna = () => {
    if (c + 1 < colunas) { c++; } else { folhas.push([]); f++; c = 0; }
    folhas[f][c] ??= [];
    usado = 0;
  };
  const novaFolha = () => {
    folhas.push([]); f++; c = 0; folhas[f][0] = []; usado = 0;
  };

  for (let i = 0; i < blocos.length; i++) {
    const marca = blocos[i].linha !== undefined ? marcas.get(blocos[i].linha!) : undefined;
    const jaTemAlgo = atual().length > 0 || c > 0 || f > 0;

    if (marca === 'pagina' && jaTemAlgo) novaFolha();
    else if (marca === 'coluna' && jaTemAlgo) novaColuna();

    const h = alturas[i] ?? 0;
    // "Puxar para trás" é uma licença para passar do fim da coluna, e só até onde o papel
    // aguenta: a folga é a margem de baixo da folha. Sem ela a marca nunca faria nada — o
    // bloco que abre uma coluna é, por construção, exatamente o que não coube na anterior,
    // então "puxar só se couber" seria uma operação que nunca acontece.
    const teto = disponivel() + (marca === 'colar' ? folgaDoPuxar : 0);
    if (usado + h > teto && atual().length > 0) novaColuna();

    atual().push(i);
    usado += h;
  }
  return folhas;
}

export const CifraPrintPage: React.FC = () => {
  const { artistSlug, songSlug } = useParams<{ artistSlug: string; songSlug: string }>();
  const [params] = useSearchParams();

  const [cifra, setCifra] = useState<CifraDetail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesFolha>(lerOpcoes);

  // O estado que veio do visualizador chega pela URL — assim a folha nasce no mesmo tom e
  // no mesmo instrumento em que o músico estava lendo, e o link é compartilhável.
  const [transpose, setTranspose] = useState<number>(() => {
    const n = Number(params.get('tom'));
    return Number.isFinite(n) ? Math.max(-11, Math.min(11, Math.trunc(n))) : 0;
  });
  const [instId, setInstId] = useState<string>(() => {
    const q = params.get('inst');
    const preferido = getPreferredInstrumentId();
    const id = q ?? preferido ?? '';
    return PRESET_INSTRUMENTS.some(i => i.id === id) ? id : PRESET_INSTRUMENTS[0].id;
  });
  const [afinacaoId, setAfinacaoId] = useState<string>(() => params.get('afin') ?? '');
  const [posIdx, setPosIdx] = useState<number>(() => {
    const n = Number(params.get('pos'));
    return Number.isInteger(n) && n >= 0 && n < TAB_POSITIONS.length ? n : 0;
  });

  // Forma escolhida por acorde: índice da variação e, se o usuário mexeu no editor, a
  // forma dele. Mesmo par do visualizador — a editada manda na gerada.
  const [variacoes, setVariacoes] = useState<Record<string, number>>({});
  const [formasCustom, setFormasCustom] = useState<Record<string, number[]>>({});
  const [editorAcorde, setEditorAcorde] = useState<{ nome: string; frets: number[] } | null>(null);

  // Texto editado à mão. `null` = a cifra como veio. Dele saem a folha E o .txt, então
  // apagar um bloco no editor apaga nos dois.
  const [textoEditado, setTextoEditado] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<string | null>(null);

  // O que o usuário mandou acontecer antes de cada linha. Um mapa e não três conjuntos:
  // as três marcas são mutuamente exclusivas, e um mapa torna isso impossível de violar.
  const [marcas, setMarcas] = useState<Map<number, Marca>>(() => new Map());
  const [modo, setModo] = useState<Marca | 'nenhum'>('nenhum');

  const instrumento = useMemo(
    () => PRESET_INSTRUMENTS.find(i => i.id === instId) ?? PRESET_INSTRUMENTS[0],
    [instId],
  );
  const afinacao = useMemo(
    () => instrumento.tunings.find(t => t.id === afinacaoId) ?? instrumento.tunings[0],
    [instrumento, afinacaoId],
  );

  useEffect(() => { gravarOpcoes(opcoes); }, [opcoes]);

  useEffect(() => {
    if (!artistSlug || !songSlug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    setErro(false);
    getCifra(artistSlug, songSlug)
      .then(setCifra)
      .catch((e) => { console.error(e); setErro(true); })
      .finally(() => setCarregando(false));
  }, [artistSlug, songSlug]);

  const nomeArtista = artistSlug ? prettifySlug(artistSlug) : '';
  const rotaCifra = `/cifras/${artistSlug ?? ''}/${songSlug ?? ''}`;

  // A folha é a mesma cifra que já está indexada em /cifras/artista/musica, só que
  // formatada para papel: indexar as duas seria conteúdo duplicado.
  useSeo(
    cifra
      ? {
          title: `Imprimir ${cifra.title} — ${nomeArtista}`,
          description: `Versão para impressão da cifra de ${cifra.title}, de ${nomeArtista}.`,
          path: `${rotaCifra}/print`,
          noindex: true,
        }
      : null,
  );

  const htmlTransposto = useMemo(() => {
    if (!cifra) return '';
    if (transpose === 0) return cifra.content_html;
    return cifra.content_html.replace(/<b>(.*?)<\/b>/g, (_m, acorde: string) =>
      `<b>${transposeChordString(acorde.trim(), transpose, false)}</b>`);
  }, [cifra, transpose]);

  // Mesma mescla de tabs consecutivas do visualizador: uma tab partida em duas vira um
  // bloco só, com um cabeçalho só. Aqui o conteúdo ainda é o HTML de origem, com as
  // linhas separadas por \n.
  const segmentosOriginais = useMemo<ContentSegment[]>(() => {
    if (!cifra) return [];
    const bruto = splitHtmlByTabs(htmlTransposto);
    const vazio = (s: string) => s.replace(/<[^>]*>/g, '').trim() === '';
    const juntos: ContentSegment[] = [];
    for (const seg of bruto) {
      const ultimo = juntos[juntos.length - 1];
      const penultimo = juntos[juntos.length - 2];
      if (seg.type === 'tab' && ultimo?.type === 'tab') {
        ultimo.content += '\n\n' + seg.content;
        continue;
      }
      if (seg.type === 'tab' && ultimo?.type === 'html' && vazio(ultimo.content) && penultimo?.type === 'tab') {
        juntos.pop();
        juntos[juntos.length - 1].content += '\n\n' + seg.content;
        continue;
      }
      juntos.push({ ...seg });
    }
    return juntos;
  }, [htmlTransposto, cifra]);

  const editado = textoEditado !== null;

  /**
   * O corpo da cifra em texto puro — o que o editor abre e o que vai para o .txt.
   *
   * As tabs entram já reescritas para o instrumento escolhido: o editor mostra o que a
   * folha mostra, e não a tab da fonte.
   */
  const corpoTexto = useMemo(() => {
    const linhas: string[] = [];
    for (const seg of segmentosOriginais) {
      if (seg.type === 'tab') {
        if (!opcoes.tabs) continue;
        linhas.push(...tabParaInstrumento(seg.content, afinacao.strings, transpose, posIdx), '');
      } else {
        linhas.push(htmlParaTexto(seg.content));
      }
    }
    return linhas.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }, [segmentosOriginais, opcoes.tabs, afinacao, transpose, posIdx]);

  const segmentosBrutos = useMemo<ContentSegment[]>(
    () => (textoEditado !== null ? segmentosDoTexto(textoEditado) : segmentosOriginais),
    [textoEditado, segmentosOriginais],
  );

  // Para a tela e para o papel: cada linha vira bloco próprio (reflowCifraHtml) para poder
  // quebrar dentro de uma coluna estreita sem o acorde se soltar da palavra, e ganha um
  // número para o clique de "quebrar coluna aqui" ter onde se prender. As tabs viram HTML
  // aqui também: o paginador precisa de uma lista só, e não de React de um lado e string
  // do outro.
  const blocos = useMemo<Bloco[]>(() => {
    const saida: Bloco[] = [];
    let n = 0;
    for (const seg of segmentosBrutos) {
      if (seg.type === 'tab') {
        if (!opcoes.tabs) continue;
        saida.push({
          html: tabComoHtml(
            seg.content,
            afinacao.strings,
            `${instrumento.name} — ${afinacao.name.split(' (')[0]}`,
            // Texto editado já vem com a tab convertida; transpor de novo a estragaria.
            textoEditado !== null ? 0 : transpose,
            posIdx,
          ),
        });
        continue;
      }
      const { html, proximo } = numerarLinhas(comprimirVazios(reflowCifraHtml(seg.content)), n);
      n = proximo;
      saida.push(...blocosDoHtml(html));
    }
    return saida;
  }, [segmentosBrutos, opcoes.tabs, afinacao, instrumento, transpose, posIdx, textoEditado]);

  // Acordes distintos na ordem em que aparecem — a mesma varredura do visualizador. Um
  // único <b> pode trazer vários acordes separados por espaço.
  const acordes = useMemo(() => {
    const vistos: string[] = [];
    for (const seg of segmentosBrutos) {
      if (seg.type !== 'html') continue;
      for (const m of seg.content.matchAll(/<b>([^<]*)<\/b>/g)) {
        const cru = m[1].replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').trim();
        for (const c of cru.split(/\s+/)) if (c && !vistos.includes(c)) vistos.push(c);
      }
    }
    return vistos;
  }, [segmentosBrutos]);

  const voicingsPorAcorde = useMemo(() => {
    if (!opcoes.formas) return [] as Voicing[][];
    // Notação brasileira: Bb6m → Bbm6, A7m → Am7, etc.
    const normSuffix = (n: string) => n.replace(/^([A-G][b#]?)(\d+)(m)$/, '$1$3$2');
    return acordes.map(nome => {
      const { root, suffix, bass } = parseChordString(normSuffix(nome));
      if (!root) return [] as Voicing[];
      try {
        return calculateVoicings(afinacao, buildChord(root, suffix, bass || undefined), 12, {
          violaCebolao: instrumento.id === 'viola',
        });
      } catch { return [] as Voicing[]; }
    });
  }, [opcoes.formas, acordes, afinacao, instrumento]);

  const tomTexto = transpose === 0 ? 'original' : `${transpose > 0 ? '+' : ''}${transpose} semitons`;

  // ── Medição e paginação ────────────────────────────────────────────────────────
  // Quanto cada bloco ocupa só se sabe depois de o navegador o desenhar, e a folha só pode
  // ser montada depois disso. Daí o medidor invisível: ele desenha tudo uma vez, na largura
  // exata da coluna, e o paginador lê as alturas dali.
  const folhaRef = React.useRef<HTMLElement>(null);
  const [medidas, setMedidas] = useState({ alturas: [] as number[], pagina: 0, topo: 0, rodape: 0, margem: 0 });

  /**
   * Tipografia do corpo — inline, e não por variável CSS.
   *
   * Pela variável, um `.cifra-viewer-content` que já existia ficava com o `font-size`
   * congelado no valor antigo: um elemento novo criado no mesmo pai pegava o tamanho novo,
   * o antigo não. Como é justamente desta medida que o paginador tira quantas folhas a
   * cifra tem, o erro não era cosmético — a folha era paginada com a fonte de antes.
   */
  const estiloTexto = useMemo<React.CSSProperties>(() => ({
    fontSize: `${opcoes.fonte}px`,
    lineHeight: opcoes.entrelinha,
    fontFamily: opcoes.proporcional
      ? "'Segoe UI', system-ui, sans-serif"
      : "'Fira Code', 'Courier New', Courier, monospace",
  }), [opcoes.fonte, opcoes.entrelinha, opcoes.proporcional]);

  /**
   * Mede as alturas num nó DESCARTÁVEL, criado e destruído a cada medição.
   *
   * O medidor era um nó fixo, escondido, que o React só reestilizava. Não funciona: depois
   * do primeiro layout aquela subárvore congelava — o `style` mudava, a medição rodava, e
   * os `getBoundingClientRect` devolviam as alturas da primeira fonte, para sempre. A folha
   * saía paginada pela tipografia de quando a página abriu.
   *
   * Um nó recém-criado não tem layout anterior de onde o navegador possa reaproveitar
   * nada: medir vira uma pergunta que só pode ser respondida calculando.
   */
  const medir = useCallback((texto: React.CSSProperties, htmlDosBlocos: string) => {
    const folha = folhaRef.current;
    const corpo = folha?.querySelector('.folha-corpo');
    const coluna = folha?.querySelector('.folha-coluna');
    if (!folha || !corpo || !coluna) return;

    // Tudo sai da folha que está na tela, por geometria: a área útil é a caixa de conteúdo
    // dela, e o que o cabeçalho e o rodapé roubam é a distância entre as bordas dessa caixa
    // e as do corpo. Medir assim inclui margens sem ter de somá-las na mão, e acompanha
    // qualquer mudança de tipografia — o que sondas de CSS separadas não faziam.
    const r = folha.getBoundingClientRect();
    const cs = getComputedStyle(folha);
    const larguraUtil = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const alturaUtil = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const largura = coluna.getBoundingClientRect().width;
    if (largura <= 0 || alturaUtil <= 0) return;

    // Estas três não dependem da tipografia — só do tamanho do papel e da margem — então
    // podem sair da folha que está na tela sem risco de virem defasadas.
    // As que dependem (alturas das linhas, cabeçalho, rodapé) são medidas em nós NOVOS,
    // porque nó já existente devolve a altura da tipografia anterior, para sempre.
    const medirEm = (largura: number, montar: (caixa: HTMLElement) => void, seletor: string) => {
      const caixa = document.createElement('div');
      caixa.style.cssText = `position:absolute;left:-10000px;top:0;width:${largura}px;`;
      caixa.style.fontSize = String(texto.fontSize ?? '');
      caixa.style.lineHeight = String(texto.lineHeight ?? '');
      caixa.style.fontFamily = String(texto.fontFamily ?? '');
      montar(caixa);
      document.body.appendChild(caixa);
      const resultado = [...caixa.querySelectorAll(seletor)].map(el => el.getBoundingClientRect().height);
      caixa.remove();
      return resultado;
    };

    const alturas = medirEm(largura, c => {
      c.className = 'cifra-viewer-content';
      c.innerHTML = htmlDosBlocos;
    }, ':scope > *');

    // Cabeçalho, diagramas e rodapé vão para um embrulho `flow-root` cada, para a medida
    // incluir as margens deles — na folha são itens de flex, onde margem não colapsa.
    const alturaClonada = (seletores: string[]) => {
      const originais = seletores.map(s => folha.querySelector(s)).filter(Boolean) as Element[];
      if (originais.length === 0) return 0;
      return medirEm(larguraUtil, c => {
        for (const o of originais) {
          const embrulho = document.createElement('div');
          embrulho.style.display = 'flow-root';
          embrulho.className = 'folha-medida';
          embrulho.appendChild(o.cloneNode(true));
          c.appendChild(embrulho);
        }
      }, ':scope > .folha-medida').reduce((a, b) => a + b, 0);
    };

    // Arredondar tudo é o que impede uma diferença de meio pixel entre duas medições de
    // reabrir o ciclo medir → renderizar → medir indefinidamente.
    const novo = {
      pagina: Math.round(alturaUtil),
      topo: Math.round(alturaClonada(['.folha-cabecalho', '.folha-acordes'])),
      rodape: Math.round(alturaClonada(['.folha-rodape'])),
      // Folga do "puxar para trás": a margem de baixo da folha, que é até onde a coluna
      // pode passar sem a linha sair do papel.
      margem: Math.round(parseFloat(cs.paddingBottom)),
      alturas: alturas.map(a => Math.round(a * 100) / 100),
    };
    // O setState só passa adiante quando ALGUMA medida mudou de verdade. É o que impede o
    // par medir→renderizar→medir de virar laço infinito.
    setMedidas(prev =>
      prev.pagina === novo.pagina && prev.topo === novo.topo && prev.rodape === novo.rodape
        && prev.margem === novo.margem
        && prev.alturas.length === novo.alturas.length && prev.alturas.every((a, i) => a === novo.alturas[i])
        ? prev
        : novo);
  }, []);

  /**
   * Remede depois de TODO render — sem lista de dependências.
   *
   * Já teve lista, e ela precisava ser exaustiva: esquecer um item significava paginar com
   * a medida anterior, e a folha saía dividida pela tipografia de antes sem nada na tela
   * denunciando. Já teve ResizeObserver também, que parecia mais robusto por observar o
   * efeito em vez da causa — mas medir → setState → renderizar → redimensionar → medir
   * fecha um laço e trava o navegador.
   *
   * Rodar sempre é seguro porque `setMedidas` só passa adiante quando alguma medida mudou
   * de fato: sem mudança não há novo render, e o ciclo morre no primeiro passo.
   */
  const htmlDosBlocos = useMemo(() => blocos.map(b => b.html).join(''), [blocos]);

  // Trava de segurança. Medir a cada render é seguro enquanto a medida convergir; se um dia
  // algo voltar a fazer a altura de um pedaço da folha depender do resultado da paginação,
  // o ciclo não pode levar o navegador junto. Vinte passadas é muito mais do que qualquer
  // convergência legítima precisa (duas, na prática) e muito menos do que trava a aba.
  const passadasRef = React.useRef(0);
  // Zera a cada mudança vinda do usuário: o contador conta só as passadas de convergência.
  React.useLayoutEffect(() => { passadasRef.current = 0; }, [estiloTexto, htmlDosBlocos, opcoes.colunas, marcas]);
  React.useLayoutEffect(() => {
    if (passadasRef.current > 20) return;
    passadasRef.current++;
    medir(estiloTexto, htmlDosBlocos);
  });

  // A fonte monoespaçada costuma chegar depois da primeira pintura, e com ela toda linha
  // muda de altura. Sem esta segunda passada a folha fica paginada pela fonte de fallback.
  useEffect(() => {
    let vivo = true;
    document.fonts?.ready.then(() => { if (vivo) medir(estiloTexto, htmlDosBlocos); }).catch(() => {});
    return () => { vivo = false; };
  }, [medir, estiloTexto, htmlDosBlocos]);

  const folhas = useMemo(() => {
    if (medidas.pagina <= 0) return null; // ainda não mediu — não dá para paginar no escuro
    const coluna = medidas.pagina - medidas.rodape;
    return paginar(
      blocos, medidas.alturas, marcas, opcoes.colunas,
      coluna, coluna - medidas.topo, medidas.margem,
    );
  }, [blocos, medidas, marcas, opcoes.colunas]);

  const baixarTxt = useCallback(() => {
    if (!cifra) return;
    const cabecalho = [
      cifra.title,
      ...(nomeArtista ? [nomeArtista] : []),
      `Tom: ${tomTexto} · ${instrumento.name} — ${afinacao.name.split(' (')[0]}`,
      '='.repeat(60),
      '',
    ];
    const corpo = textoEditado ?? corpoTexto;
    const rodape = ['', '-'.repeat(60), `${SITE_URL}${rotaCifra}`];
    const nome = `${artistSlug ?? 'cifra'}-${songSlug ?? ''}`.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-');
    baixarTexto(`${nome}.txt`, [...cabecalho, corpo, ...rodape].join('\n'));
  }, [cifra, textoEditado, corpoTexto, nomeArtista, tomTexto, instrumento, afinacao, artistSlug, songSlug, rotaCifra]);

  /**
   * Clique numa linha da folha, com uma das três ferramentas ligada. Clicar de novo com a
   * mesma ferramenta desmarca; com outra, troca a marca — nunca acumula duas na linha.
   *
   * Empurrar e puxar não são a mesma operação com sinal trocado. Empurrar é "corte aqui".
   * Puxar não tem como ser "descorte aqui", porque a linha só está na coluna seguinte por
   * a anterior ter enchido; o que existe é `avoid-column`, que proíbe a quebra naquele
   * ponto e obriga o navegador a cortar mais acima — e a linha volta junto com o corte.
   */
  const cliqueNaFolha = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (modo === 'nenhum') return;
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-linha]');
    if (!alvo) return;
    const n = Number(alvo.dataset.linha);
    setMarcas(prev => {
      const proximo = new Map(prev);
      if (proximo.get(n) === modo) proximo.delete(n); else proximo.set(n, modo);
      return proximo;
    });
  }, [modo]);

  // As marcas são estado do React, mas as linhas são innerHTML — a ponte entre os dois é
  // uma regra CSS gerada com os números escolhidos. Reescrever o HTML a cada clique
  // custaria refazer toda a cifra; uma folha de estilo de três linhas, não.
  const cssMarcas = useMemo(() => {
    const porTipo = new Map<Marca, number[]>();
    for (const [n, marca] of marcas) porTipo.set(marca, [...(porTipo.get(marca) ?? []), n]);
    let css = '';
    for (const [marca, linhas] of porTipo) {
      const { quebra, cor, espessura } = CSS_DA_MARCA[marca];
      const sel = linhas.map(n => `.folha-corpo [data-linha="${n}"]`).join(',');
      // A marca colorida é só da tela: no papel a quebra já se vê por ser uma quebra.
      css += `${sel}{${quebra};}@media screen{${sel}{border-top:${espessura} ${cor};padding-top:2px;}}`;
    }
    return css;
  }, [marcas]);

  const estiloFolha = {
    '--cifra-print-cols': String(opcoes.colunas),
    '--cifra-print-fs': `${opcoes.fonte}px`,
    '--cifra-print-lh': String(opcoes.entrelinha),
    '--cifra-print-margem-extra': `${opcoes.margemExtra}mm`,
    '--cifra-print-chord-color': opcoes.acordesPreto ? '#000000' : '#002fa7',
  } as React.CSSProperties;

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-winxp-panel)] font-mono text-sm">
        Carregando cifra…
      </div>
    );
  }

  if (erro || !cifra) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-winxp-panel)] font-mono text-sm p-4 text-center">
        <p>Não foi possível carregar esta cifra para impressão.</p>
        <Link to={rotaCifra} className="bevel-out bg-[var(--color-winxp-bg)] px-3 py-1 font-bold border border-gray-400">
          ← Voltar para a cifra
        </Link>
      </div>
    );
  }

  const caixa = 'flex items-center gap-2 cursor-pointer';

  // Cabeçalho + formas: só existem na primeira folha, e o medidor precisa deles idênticos
  // para saber quanta altura eles roubam da primeira coluna. Um JSX, dois lugares.
  const topoDaFolha = (
    <>
      {/* A base em pixels vem inline; os tamanhos do cabeçalho são `em` sobre ela. Por
          variável CSS o cabeçalho ficava com o tamanho de quando a página abriu, e o
          espaço que o paginador reservava para ele nunca batia com o real. */}
      {opcoes.cabecalho && (
        <header className="folha-cabecalho" style={{ fontSize: `${opcoes.fonte}px` }}>
          <h1>{cifra.title}</h1>
          {nomeArtista && <p className="folha-artista">{nomeArtista}</p>}
          <div className="folha-meta">
            <span>Tom: {tomTexto}</span>
            <span>{instrumento.name} — {afinacao.name.split(' (')[0]}</span>
            {cifra.bpm != null && <span>BPM: {cifra.bpm}</span>}
            {cifra.version_name && <span>{cifra.version_name}</span>}
          </div>
        </header>
      )}

      {opcoes.formas && acordes.length > 0 && (
        <div className="folha-acordes">
          {acordes.map((nome, i) => {
            const lista = voicingsPorAcorde[i] ?? [];
            const custom = formasCustom[nome];
            const idx = lista.length > 0 ? (variacoes[nome] ?? 0) % lista.length : 0;
            const forma = custom && custom.length === afinacao.strings.length
              ? buildVoicingFromFrets(custom, afinacao, false)
              : lista[idx];
            if (!forma) return null;
            const trocar = (delta: number) => {
              // As setas voltam para as variações geradas: a forma editada à mão sai de
              // cena no momento em que o usuário pede outra.
              setFormasCustom(prev => {
                if (!(nome in prev)) return prev;
                const proximo = { ...prev };
                delete proximo[nome];
                return proximo;
              });
              if (lista.length === 0) return;
              setVariacoes(prev => ({
                ...prev,
                [nome]: ((prev[nome] ?? 0) + delta + lista.length) % lista.length,
              }));
            };
            return (
              <div key={nome} className="folha-acorde">
                <FretboardDiagram voicing={forma} tuning={afinacao} chordName={nome} compact />
                <div className="folha-acorde-controles sem-impressao">
                  <button onClick={() => trocar(-1)} className="px-1 border border-gray-400 bg-[#ece9d8] hover:bg-white" title="Forma anterior">◀</button>
                  <span className="font-mono tabular-nums text-gray-600">
                    {custom ? '✎' : `${idx + 1}/${lista.length || 1}`}
                  </span>
                  <button onClick={() => trocar(1)} className="px-1 border border-gray-400 bg-[#ece9d8] hover:bg-white" title="Próxima forma">▶</button>
                  <button
                    onClick={() => setEditorAcorde({ nome, frets: forma.frets })}
                    className="px-1 border border-gray-400 bg-[#ece9d8] hover:bg-white"
                    title="Editar a forma no braço"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="tela-impressao min-h-screen bg-[#5a7ea8] flex flex-col" style={estiloFolha}>
      {cssMarcas && <style>{cssMarcas}</style>}

      {/* ── Barra de ações (só na tela) ───────────────────────────────────────── */}
      <div className="sem-impressao sticky top-0 z-20 winxp-gradient-blue text-white px-2 py-1.5 flex items-center gap-2 border-b-2 border-[#002fa7]">
        <Link
          to={rotaCifra}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 active:bg-white/30 font-bold text-xs"
          title="Voltar para a cifra"
        >
          <ArrowLeft size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">Voltar</span>
        </Link>
        <span className="flex-1 min-w-0 truncate font-bold text-sm font-mono">
          Imprimir — {cifra.title}
        </span>
        <button
          onClick={() => setMenuAberto(v => !v)}
          className="lg:hidden bevel-out bg-[var(--color-winxp-bg)] text-black px-2 py-1 text-xs font-bold border border-gray-400"
          aria-expanded={menuAberto}
        >
          {menuAberto ? 'Fechar ajustes' : 'Ajustes'}
        </button>
        <button
          onClick={baixarTxt}
          className="bevel-out bg-[var(--color-winxp-bg)] text-black px-2 sm:px-3 py-1 text-xs font-bold border border-gray-400 hover:bg-white flex items-center gap-1"
          title="Baixar a cifra como arquivo de texto"
        >
          <Download size={13} /> <span className="hidden sm:inline">Baixar .txt</span>
        </button>
        <button
          onClick={() => window.print()}
          className="bevel-out bg-[#ff7f27] text-black px-2 sm:px-3 py-1 text-xs font-bold border border-[#c05a10] hover:brightness-105 flex items-center gap-1"
          title="Abrir a caixa de impressão"
        >
          <Printer size={13} /> Imprimir
        </button>
      </div>

      <div className="folha-conteudo flex-1 flex flex-col lg:flex-row items-start justify-center gap-4 p-2 sm:p-4">
        {/* ── Menu de personalização (só na tela) ─────────────────────────────── */}
        <aside
          className={`sem-impressao w-full lg:w-64 shrink-0 bevel-out bg-[var(--color-winxp-bg)] p-2 flex-col gap-3 text-xs lg:sticky lg:top-14 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto retro-scrollbar ${menuAberto ? 'flex' : 'hidden lg:flex'}`}
        >
          <h2 className="font-bold text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-400 pb-1">
            Personalizar folha
          </h2>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-[10px] uppercase text-gray-500">Layout</span>
            <div className="flex gap-1">
              {([1, 2] as const).map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setOpcoes(o => ({ ...o, colunas: c }));
                    // Marca de coluna numa folha de uma coluna só é lixo invisível: some
                    // com ela em vez de deixá-la ressuscitar se o usuário voltar para duas.
                    if (c === 1) {
                      setMarcas(prev => new Map([...prev].filter(([, m]) => m === 'pagina')));
                      setModo(m => (m === 'pagina' || m === 'nenhum' ? m : 'nenhum'));
                    }
                  }}
                  className={`flex-1 py-1 font-bold border leading-tight ${opcoes.colunas === c ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[#ece9d8] border-gray-400 hover:bg-white'}`}
                >
                  {c} coluna{c > 1 ? 's' : ''}
                </button>
              ))}
            </div>
            {opcoes.colunas === 2 && (
              <p className="text-[10px] text-gray-600 leading-snug">
                A 1ª coluna enche até o fim antes de passar para a 2ª, e o que não couber na
                folha desce para a próxima. Em <b>Conteúdo</b> dá para mover um trecho de
                coluna à mão.
              </p>
            )}
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.tabs} onChange={e => setOpcoes(o => ({ ...o, tabs: e.target.checked }))} />
              <span>Incluir tablaturas</span>
            </label>
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.formas} onChange={e => setOpcoes(o => ({ ...o, formas: e.target.checked }))} />
              <span>Formas dos acordes no topo</span>
            </label>
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.cabecalho} onChange={e => setOpcoes(o => ({ ...o, cabecalho: e.target.checked }))} />
              <span>Cabeçalho (título e tom)</span>
            </label>
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.rodape} onChange={e => setOpcoes(o => ({ ...o, rodape: e.target.checked }))} />
              <span>Rodapé (site e nº da folha)</span>
            </label>
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.acordesPreto} onChange={e => setOpcoes(o => ({ ...o, acordesPreto: e.target.checked }))} />
              <span>Acordes em preto</span>
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-[10px] uppercase text-gray-500">Tipografia</span>
            <label className={caixa}>
              <input type="checkbox" checked={opcoes.proporcional} onChange={e => setOpcoes(o => ({ ...o, proporcional: e.target.checked }))} />
              <span>Fonte proporcional (cabe mais)</span>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Fonte</span>
              <span className="font-mono font-bold text-[#005500]">{opcoes.fonte}px</span>
            </label>
            <input
              type="range" min={7} max={16} step={0.5} value={opcoes.fonte}
              onChange={e => setOpcoes(o => ({ ...o, fonte: Number(e.target.value) }))}
              aria-label="Tamanho da fonte"
            />
            <label className="flex items-center justify-between gap-2">
              <span>Entrelinha</span>
              <span className="font-mono font-bold text-[#005500]">{opcoes.entrelinha.toFixed(2)}</span>
            </label>
            <input
              type="range" min={1} max={2} step={0.05} value={opcoes.entrelinha}
              onChange={e => setOpcoes(o => ({ ...o, entrelinha: Number(e.target.value) }))}
              aria-label="Entrelinha"
            />
            <label className="flex items-center justify-between gap-2">
              <span>Margem extra</span>
              <span className="font-mono font-bold text-[#005500]">{opcoes.margemExtra}mm</span>
            </label>
            <input
              type="range" min={0} max={20} step={1} value={opcoes.margemExtra}
              onChange={e => setOpcoes(o => ({ ...o, margemExtra: Number(e.target.value) }))}
              aria-label="Margem extra"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-[10px] uppercase text-gray-500">Música</span>
            <div className="flex items-center gap-1">
              <span className="flex-1">Tom</span>
              <button onClick={() => setTranspose(t => Math.max(-11, t - 1))} disabled={editado} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 font-bold border border-gray-400 disabled:opacity-40" title="Abaixar meio tom">-½</button>
              <span className="font-mono font-bold w-7 text-center text-[#cc3300]">{transpose > 0 ? `+${transpose}` : transpose}</span>
              <button onClick={() => setTranspose(t => Math.min(11, t + 1))} disabled={editado} className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-0.5 font-bold border border-gray-400 disabled:opacity-40" title="Subir meio tom">+½</button>
            </div>
            <label className="flex flex-col gap-0.5">
              <span>Instrumento</span>
              <select
                value={instrumento.id}
                onChange={e => { setInstId(e.target.value); setAfinacaoId(''); setFormasCustom({}); }}
                className="bevel-in bg-white px-1 py-0.5 outline-none cursor-pointer"
              >
                {PRESET_INSTRUMENTS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span>Afinação</span>
              <select
                value={afinacao.id}
                onChange={e => { setAfinacaoId(e.target.value); setFormasCustom({}); }}
                className="bevel-in bg-white px-1 py-0.5 outline-none cursor-pointer"
              >
                {instrumento.tunings.map(t => <option key={t.id} value={t.id}>{t.name.split(' (')[0]}</option>)}
              </select>
            </label>
            {opcoes.tabs && (
              <div className="flex items-center gap-1">
                <span className="flex-1">Pos. tab</span>
                <button onClick={() => setPosIdx(p => (p - 1 + TAB_POSITIONS.length) % TAB_POSITIONS.length)} disabled={editado} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 font-bold border border-gray-400 disabled:opacity-40">◀</button>
                <span className="font-mono font-bold min-w-[42px] text-center text-[#005500]">{TAB_POSITIONS[posIdx].label}</span>
                <button onClick={() => setPosIdx(p => (p + 1) % TAB_POSITIONS.length)} disabled={editado} className="bevel-out bg-[var(--color-winxp-panel)] px-1.5 py-0.5 font-bold border border-gray-400 disabled:opacity-40">▶</button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-[10px] uppercase text-gray-500">Conteúdo</span>
            {/* Ordem: as duas ferramentas de coluna juntas (uma empurra, a outra puxa — são
                o par), e a de página por último, que é a de outra escala.

                Com uma coluna só não existe "coluna ao lado" nem "coluna anterior": as duas
                primeiras sairiam de cena com um clique sem efeito nenhum. */}
            {([
              ...(opcoes.colunas === 2 ? [
                { id: 'coluna' as const, Icone: Scissors, rotulo: 'Próxima coluna', dica: 'Manda a linha, e o que vem depois dela, para a coluna ao lado.' },
                { id: 'colar' as const, Icone: CornerUpLeft, rotulo: 'Puxar para trás', dica: 'Traz a primeira linha da coluna de volta para a anterior, até onde a margem do papel aguentar.' },
              ] : []),
              { id: 'pagina' as const, Icone: FileDown, rotulo: 'Próxima página', dica: 'Começa uma folha nova a partir desta linha.' },
            ]).map(({ id, Icone, rotulo, dica }) => (
              <button
                key={id}
                onClick={() => setModo(m => (m === id ? 'nenhum' : id))}
                className={`flex items-center justify-center gap-1 px-2 py-1 font-bold border ${modo === id ? 'bg-[#316ac5] text-white border-[#316ac5]' : 'bg-[var(--color-winxp-panel)] border-gray-400 hover:bg-white'}`}
                title={dica}
              >
                <Icone size={13} /> {modo === id ? 'Clique numa linha…' : rotulo}
              </button>
            ))}
            {marcas.size > 0 && (
              <button
                onClick={() => setMarcas(new Map())}
                className="px-2 py-0.5 border border-gray-400 bg-[#ece9d8] hover:bg-white"
              >
                Tirar as {marcas.size} marca{marcas.size > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => setRascunho(textoEditado ?? corpoTexto)}
              className="flex items-center justify-center gap-1 px-2 py-1 font-bold border border-gray-400 bg-[var(--color-winxp-panel)] hover:bg-white"
              title="Apagar trechos, juntar linhas, tirar o que não interessa"
            >
              <Pencil size={13} /> Editar o texto
            </button>
            {editado && (
              <>
                <p className="text-[10px] text-gray-600 leading-snug">
                  Texto editado à mão: o tom e as tabs estão congelados como estavam.
                </p>
                <button onClick={() => setTextoEditado(null)} className="px-2 py-0.5 border border-gray-400 bg-[#ece9d8] hover:bg-white">
                  ↺ Voltar ao texto original
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setOpcoes(OPCOES_PADRAO)}
            className="bevel-out bg-[var(--color-winxp-panel)] px-2 py-1 font-bold border border-gray-400 hover:bg-white"
          >
            ↺ Restaurar padrão
          </button>
        </aside>

        {/* ── As folhas ───────────────────────────────────────────────────────── */}
        {/* `data-medidas` existe para depuração: é a única forma de ler, de fora, com que
            números o paginador dividiu a folha — e foi assim que apareceu o caso em que ele
            paginava com a tipografia do passo anterior. */}
        <div
          className="folha-pilha"
          data-medidas={`pag=${Math.round(medidas.pagina)} topo=${Math.round(medidas.topo)} rodape=${Math.round(medidas.rodape)} margem=${Math.round(medidas.margem)} n=${medidas.alturas.length} soma=${Math.round(medidas.alturas.reduce((a, b) => a + b, 0))} fonte=${opcoes.fonte}`}
        >
          {(folhas ?? [[[]]]).map((colunasDaFolha, p) => (
            <article className="folha-impressao" key={p} ref={p === 0 ? folhaRef : undefined}>
              {p === 0 && topoDaFolha}
              <div
                className={`folha-corpo ${modo !== 'nenhum' ? 'folha-corpo-tesoura' : ''}`}
                onClick={cliqueNaFolha}
              >
                {Array.from({ length: opcoes.colunas }, (_, c) => (
                  <div className="folha-coluna" key={c}>
                    <div
                      className="cifra-viewer-content"
                      style={estiloTexto}
                      dangerouslySetInnerHTML={{
                        __html: (colunasDaFolha[c] ?? []).map(i => blocos[i].html).join(''),
                      }}
                    />
                  </div>
                ))}
              </div>
              {/* A contagem de folhas aparece SEMPRE, mesmo com uma só. Condicioná-la a
                  `> 1` fechava um laço: com uma folha o rodapé era mais curto, com o rodapé
                  curto cabia mais e continuava uma folha; ao virar duas, o rodapé crescia,
                  cabia menos... e o navegador travava medindo. A altura do rodapé não pode
                  depender do resultado da paginação. */}
              {/* Só o domínio, não o endereço inteiro: quem tem a folha na mão quer saber
                  onde achar o resto, não copiar a URL da música à mão. */}
              {opcoes.rodape && (
                <footer className="folha-rodape" style={{ fontSize: `${opcoes.fonte}px` }}>
                  <span>violalibre.com.br</span>
                  <span>{p + 1} / {folhas?.length ?? 1}</span>
                </footer>
              )}
            </article>
          ))}
        </div>

      </div>

      {/* ── Editor de texto ─────────────────────────────────────────────────── */}
      {rascunho !== null && (
        <div className="sem-impressao fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-3">
          <div className="bevel-out bg-[var(--color-winxp-bg)] w-full max-w-3xl h-[85vh] flex flex-col p-2 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-bold text-sm">Editar o texto da folha</h2>
              <button onClick={() => setRascunho(null)} className="px-2 py-1 text-xs font-bold border border-gray-400 bg-[#ece9d8] hover:bg-white">Cancelar</button>
              <button
                onClick={() => { setTextoEditado(rascunho); setRascunho(null); }}
                className="px-3 py-1 text-xs font-bold border border-[#c05a10] bg-[#ff7f27] hover:brightness-105"
              >
                Aplicar
              </button>
            </div>
            <p className="text-[11px] text-gray-700 leading-snug">
              Apague o que não for tocar. As linhas de acorde continuam sendo reconhecidas
              pela posição — mantenha o acorde sobre a sílaba, com espaços.
            </p>
            <textarea
              value={rascunho}
              onChange={e => setRascunho(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-0 bevel-in bg-white p-2 font-mono text-xs leading-relaxed outline-none resize-none whitespace-pre overflow-auto retro-scrollbar"
              aria-label="Texto da cifra"
            />
          </div>
        </div>
      )}

      {editorAcorde && (
        <ChordEditorModal
          chordName={editorAcorde.nome}
          tuning={afinacao}
          instrument={instrumento}
          initialFrets={editorAcorde.frets}
          onApply={(frets) => {
            setFormasCustom(prev => ({ ...prev, [editorAcorde.nome]: frets }));
            setEditorAcorde(null);
          }}
          onClose={() => setEditorAcorde(null)}
        />
      )}
    </div>
  );
};
