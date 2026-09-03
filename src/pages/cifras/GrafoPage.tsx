/*
 * A cifra como grafo — o DEMH aplicado ao acervo.
 *
 * Página própria, e não um painel dentro do visualizador, por três razões concretas: o
 * desenho precisa de área (num popover de 420px o anel fica ilegível), o uso é de estudo e
 * não de execução — ninguém consulta isto no meio de uma música —, e ter URL própria deixa
 * o grafo ser compartilhado e impresso, como já acontece com a folha de impressão.
 *
 * Diferente do `/print`, esta rota mora DENTRO da janela XP: ela é parte do app, não uma
 * saída para o papel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Maximize2, Minus, Music2, Plus } from 'lucide-react';
import { getCifra } from '../../services/api';
import type { CifraDetail } from '../../services/api';
import { detectKey } from '../../engine/detectKey';
import type { PapelDeAcorde } from '../../engine/detectKey';
import { montarGrafo } from '../../engine/grafoHarmonico';
import type { MovimentoDaRaiz, NoDoGrafo } from '../../engine/grafoHarmonico';
import { acordesDaCifra } from '../../services/cifraChords';
import { prettifySlug } from '../../services/cifraFavorites';
import { useSeo } from '../../hooks/useSeo';

/** Mesma paleta do painel de tom: quem viu lá reconhece aqui sem reaprender. */
const PAPEL: Record<PapelDeAcorde, { rotulo: string; cor: string; fundo: string }> = {
  campo: { rotulo: 'do campo harmônico', cor: '#002fa7', fundo: '#dce6f7' },
  dominante: { rotulo: 'dominante de passagem', cor: '#157a3d', fundo: '#dcefe2' },
  preparacao: { rotulo: 'ii de um ii-V', cor: '#0e6f74', fundo: '#d9eff0' },
  emprestado: { rotulo: 'emprestado de outro modo', cor: '#8a5a00', fundo: '#f5ead2' },
  tonicizacao: { rotulo: 'passa por outro tom', cor: '#6b21a8', fundo: '#ece0f5' },
  estranho: { rotulo: 'sem explicação no tom', cor: '#6b7280', fundo: '#eceaea' },
};

/**
 * A seta conta que tipo de movimento houve, como no DEMH.
 *
 * A quarta ganha traço cheio e escuro por ser o movimento cadencial — é ela que constrói a
 * sensação de resolução. Os demais vão perdendo peso conforme se afastam disso, e o
 * cromático fica pontilhado porque quase sempre é condução de voz, não harmonia.
 */
const MOVIMENTO: Record<MovimentoDaRaiz, { cor: string; traco?: string; rotulo: string }> = {
  quarta: { cor: '#002fa7', rotulo: 'quarta (cadência)' },
  segunda: { cor: '#157a3d', rotulo: 'segunda' },
  terca: { cor: '#8a5a00', rotulo: 'terça' },
  cromatico: { cor: '#a33', traco: '4 3', rotulo: 'cromático' },
  tritono: { cor: '#7a3ea3', traco: '1 3', rotulo: 'trítono' },
  nenhum: { cor: '#999', rotulo: 'mesma fundamental' },
};

/** Estado da câmera: escala e deslocamento, em unidades do próprio SVG. */
interface Vista {
  k: number;
  tx: number;
  ty: number;
}

const VISTA_INICIAL: Vista = { k: 1, tx: 0, ty: 0 };
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 6;

function limitar(k: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
}

export function GrafoPage() {
  const { artistSlug, songSlug } = useParams<{ artistSlug: string; songSlug: string }>();
  const navigate = useNavigate();
  const [cifra, setCifra] = useState<CifraDetail | null>(null);
  const [erro, setErro] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const [fixado, setFixado] = useState<string | null>(null);
  const [minimo, setMinimo] = useState(1);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const grupoRef = useRef<SVGGElement | null>(null);

  /**
   * A câmera vive num REF, não em estado, e é escrita direto no DOM.
   *
   * Arrastar e dar zoom disparam dezenas de eventos por segundo. Passando por `useState`,
   * cada um deles re-renderizava a árvore inteira — todos os discos, todas as setas — só
   * para mudar um atributo `transform` de um único `<g>`. O movimento engasgava.
   *
   * Aqui o gesto atualiza o ref e escreve o atributo; o React não renderiza nada durante o
   * arraste. É o mesmo motivo pelo qual mapas fazem isso: a câmera não é dado da aplicação,
   * é estado da superfície de desenho.
   */
  const vista = useRef<Vista>({ ...VISTA_INICIAL });
  const padraoRef = useRef<SVGPatternElement | null>(null);
  const aplicarVista = useCallback(() => {
    const v = vista.current;
    const t = `translate(${v.tx} ${v.ty}) scale(${v.k})`;
    grupoRef.current?.setAttribute('transform', t);
    // A grade acompanha pelo `patternTransform`, e não por um retângulo gigante dentro do
    // grupo transformado. Aquele retângulo cobria oito vezes a moldura para nunca acabar, o
    // que dava dezenas de milhares de ladrilhos para repintar a cada quadro — no Firefox
    // era a maior fatia do engasgo. Assim só se pinta a área visível.
    padraoRef.current?.setAttribute('patternTransform', t);
  }, []);

  /**
   * As atualizações da câmera são agrupadas por quadro.
   *
   * `pointermove` e `wheel` disparam muito acima da taxa de tela; escrevendo o atributo a
   * cada evento, o navegador refazia o layout do SVG várias vezes por quadro e jogava fora
   * quase todo esse trabalho. Guardar o último valor e aplicá-lo uma vez por
   * `requestAnimationFrame` corta isso sem mudar nada do que se vê.
   */
  const quadro = useRef<number | null>(null);
  const pendente = useRef<Vista | null>(null);
  const agendarVista = useCallback((v: Vista) => {
    pendente.current = v;
    if (quadro.current !== null) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = null;
      if (!pendente.current) return;
      vista.current = pendente.current;
      aplicarVista();
    });
  }, [aplicarVista]);

  useEffect(() => () => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
  }, []);

  /* Arrastar e clicar saem do mesmo gesto. Sem guardar quanto o ponteiro andou, todo
     arraste que terminasse em cima de um disco também o selecionaria. */
  const arraste = useRef<
    { x: number; y: number; tx: number; ty: number; escala: number; andou: boolean } | null
  >(null);

  const soltarArraste = useCallback(() => {
    arraste.current = null;
    grupoRef.current?.style.removeProperty('pointer-events');
  }, []);

  /** Converte um ponto da tela para as coordenadas internas do SVG. */
  const paraUsuario = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /**
   * Zoom pela roda, ancorado no cursor.
   *
   * Escutado à mão, e não pelo `onWheel` do React, porque o navegador registra o listener
   * do React como passivo — e listener passivo não pode chamar `preventDefault`, então a
   * página inteira rolava junto com o zoom. Aqui o `{ passive: false }` é explícito.
   *
   * A âncora no cursor é o que faz o gesto parecer um mapa: o ponto sob o dedo não se move.
   *
   * BUG CORRIGIDO — por que isto é um ref de callback e não um `useEffect`: enquanto a
   * cifra carregava, o componente devolvia só "Montando o grafo…", e o `<svg>` sequer
   * existia. O efeito rodava nesse momento, achava o ref vazio, desistia — e como as
   * dependências eram estáveis, nunca mais rodava. O SVG aparecia depois SEM ouvinte
   * nenhum, e a roda do mouse rolava a página em vez de dar zoom. O ref de callback é
   * chamado exatamente quando o elemento entra e sai da árvore, que é quando importa.
   */
  const soltarRoda = useRef<(() => void) | null>(null);
  const montarSvg = useCallback((el: SVGSVGElement | null) => {
    soltarRoda.current?.();
    soltarRoda.current = null;
    svgRef.current = el;
    if (!el) return;

    const naRoda = (e: WheelEvent) => {
      e.preventDefault();
      const m = paraUsuario(e.clientX, e.clientY);
      const v = vista.current;
      const k = limitar(v.k * Math.pow(0.9988, e.deltaY));
      const razao = k / v.k;
      agendarVista({ k, tx: m.x - (m.x - v.tx) * razao, ty: m.y - (m.y - v.ty) * razao });
    };
    el.addEventListener('wheel', naRoda, { passive: false });
    soltarRoda.current = () => el.removeEventListener('wheel', naRoda);
  }, [paraUsuario, agendarVista]);

  /**
   * Zoom pelos botões, ancorado no centro da tela.
   *
   * O centro do viewBox é a origem (0, 0), então a mesma fórmula da roda —
   * `t' = m − (m − t)·razão` — colapsa em `t' = t·razão`.
   */
  const aproximar = useCallback((fator: number) => {
    const v = vista.current;
    const k = limitar(v.k * fator);
    const razao = k / v.k;
    vista.current = { k, tx: v.tx * razao, ty: v.ty * razao };
    aplicarVista();
  }, [aplicarVista]);

  const enquadrar = useCallback(() => {
    vista.current = { ...VISTA_INICIAL };
    aplicarVista();
  }, [aplicarVista]);

  useEffect(() => {
    if (!artistSlug || !songSlug) return;
    // `vivo` evita gravar o resultado de uma busca que já não interessa quando se troca de
    // música antes de a anterior responder.
    let vivo = true;
    getCifra(artistSlug, songSlug)
      .then(d => { if (vivo) setCifra(d); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [artistSlug, songSlug]);

  const dados = useMemo(() => {
    if (!cifra) return null;
    const acordes = acordesDaCifra(cifra.content_html);
    const deteccao = detectKey(acordes);
    if (!deteccao) return null;
    return { deteccao, grafo: montarGrafo(acordes, deteccao), acordes };
  }, [cifra]);

  /**
   * Tudo que não depende da câmera nem do realce, calculado uma vez.
   *
   * A geometria das setas e a vizinhança de cada nó saíam do zero a cada renderização, e
   * cada seta ainda procurava as pontas com uma varredura linear sobre os nós. Com o
   * arraste disparando renderizações, isso virava trabalho quadrático a 60 quadros por
   * segundo. Nada disso muda quando a câmera anda — então nada disso deve recalcular.
   */
  const cena = useMemo(() => {
    if (!dados) return null;
    const { grafo } = dados;
    const porId = new Map(grafo.nos.map(n => [n.id, n] as const));
    const arestas = grafo.arestas.filter(a => a.vezes >= minimo);

    const tracados = arestas.map(a => {
      const de = porId.get(a.de)!;
      const para = porId.get(a.para)!;
      // Curvar a corda evita que ida e volta entre os mesmos dois acordes se sobreponham
      // num traço só — e as duas direções existem o tempo todo na música.
      const dx = para.x - de.x;
      const dy = para.y - de.y;
      const dist = Math.hypot(dx, dy) || 1;
      const cx = (de.x + para.x) / 2 - (dy / dist) * dist * 0.14;
      const cy = (de.y + para.y) / 2 + (dx / dist) * dist * 0.14;

      /* A curva é aparada na BORDA dos dois discos, e a ponta da seta é desenhada aqui como
         polígono — não como `marker` do SVG.
         Dois motivos, e o primeiro é que estava simplesmente errado: terminando no CENTRO
         do disco de destino, a ponta da seta ficava escondida embaixo dele, e o grafo não
         mostrava direção nenhuma. O segundo é desempenho: o Firefox repinta marcadores a
         cada transformação, e eles pesavam no arraste.
         O vetor de saída da quadrática no ponto final é `fim − controle`; é ele que dá a
         direção do recuo e o ângulo da ponta. */
      const sx = cx - de.x;
      const sy = cy - de.y;
      const sl = Math.hypot(sx, sy) || 1;
      const ini = { x: de.x + (sx / sl) * de.r, y: de.y + (sy / sl) * de.r };

      const ex = para.x - cx;
      const ey = para.y - cy;
      const el = Math.hypot(ex, ey) || 1;
      const ux = ex / el;
      const uy = ey / el;
      const fim = { x: para.x - ux * (para.r + 2), y: para.y - uy * (para.r + 2) };

      const COMPRIMENTO = 9;
      const MEIA_LARGURA = 4.5;
      const base = { x: fim.x - ux * COMPRIMENTO, y: fim.y - uy * COMPRIMENTO };
      const ponta = [
        `${fim.x},${fim.y}`,
        `${base.x - uy * MEIA_LARGURA},${base.y + ux * MEIA_LARGURA}`,
        `${base.x + uy * MEIA_LARGURA},${base.y - ux * MEIA_LARGURA}`,
      ].join(' ');

      return {
        ...a,
        d: `M ${ini.x} ${ini.y} Q ${cx} ${cy} ${fim.x} ${fim.y}`,
        ponta,
        espessura: 1 + (a.vezes / grafo.maiorPeso) * 5,
      };
    });

    const vizinhos = new Map<string, Set<string>>();
    for (const a of arestas) {
      if (!vizinhos.has(a.de)) vizinhos.set(a.de, new Set());
      if (!vizinhos.has(a.para)) vizinhos.set(a.para, new Set());
      vizinhos.get(a.de)!.add(a.para);
      vizinhos.get(a.para)!.add(a.de);
    }

    return {
      tracados,
      vizinhos,
      movimentosUsados: new Set(arestas.map(a => a.movimento)),
      papeisUsados: [...new Set(grafo.nos.map(n => n.papel))],
      total: grafo.arestas.length,
      mostradas: arestas.length,
    };
  }, [dados, minimo]);

  const titulo = cifra?.title ?? prettifySlug(songSlug ?? '');
  useSeo({
    title: `Grafo harmônico de ${titulo}`,
    description: `As transições de acordes de ${titulo} desenhadas como rede, sobre o ciclo de quintas.`,
    path: `/cifras/${artistSlug}/${songSlug}/grafo`,
  });

  const ativo = fixado ?? foco;
  const cifraPath = `/cifras/${artistSlug}/${songSlug}`;

  if (erro) {
    return (
      <div className="p-6 text-sm">
        Não deu para carregar esta cifra.{' '}
        <Link to={cifraPath} className="text-[#002fa7] underline">Voltar</Link>
      </div>
    );
  }
  if (!dados || !cena) {
    return <div className="p-6 text-sm text-gray-600">Montando o grafo…</div>;
  }

  const { deteccao, grafo } = dados;
  const ligadoAoAtivo = (id: string) =>
    !ativo || ativo === id || (cena.vizinhos.get(ativo)?.has(id) ?? false);

  // A moldura sai do conteúdo, não de um número fixo: ver `extensao` no motor.
  const VIEW = grafo.extensao;

  return (
    <div className="flex w-full flex-col gap-2 p-2 text-black sm:p-4">
      <div className="bevel-out flex flex-wrap items-center justify-between gap-2 bg-[var(--color-winxp-panel)] px-2 py-1.5">
        <span className="flex items-center gap-2">
          <button
            onClick={() => navigate(cifraPath)}
            className="bevel-out flex cursor-pointer items-center gap-1 bg-[var(--color-winxp-panel)] px-2 py-0.5 text-xs font-bold hover:bg-white active:border-b-white active:border-l-gray-500 active:border-r-white active:border-t-gray-500"
          >
            <ArrowLeft size={13} /> Voltar à cifra
          </button>
          <span className="flex items-center gap-1 text-sm font-bold">
            <Music2 size={15} /> {titulo}
          </span>
        </span>
        <span className="text-xs">
          Tom <strong className="text-[#002fa7]">{deteccao.nome}</strong>
          <span className="text-gray-500"> · confiança {deteccao.confidence}</span>
        </span>
      </div>

      <p className="px-1 text-[11px] leading-snug text-gray-600">
        Cada disco é um acorde da cifra; cada seta, uma passagem realmente tocada — mais
        grossa quanto mais vezes acontece. Os acordes estão dispostos pelo{' '}
        <strong>ciclo de quintas</strong>, e não pela ordem em que aparecem: assim os sete
        graus do tom formam um arco contínuo, e tudo que a música pega de fora cai visivelmente
        para fora dele.
      </p>

      <div className="flex flex-wrap items-center gap-3 px-1 text-[11px]">
        <label className="flex items-center gap-1.5">
          <span className="text-gray-600">mostrar passagens repetidas ao menos</span>
          <input
            type="range"
            min={1}
            max={Math.max(2, Math.min(8, grafo.maiorPeso))}
            value={minimo}
            onChange={e => setMinimo(Number(e.target.value))}
            className="w-24"
          />
          <strong className="w-3">{minimo}</strong>
          <span className="text-gray-600">vez(es)</span>
        </label>
        <span className="text-gray-500">
          {cena.mostradas} de {cena.total} passagens · {grafo.nos.length} acordes
        </span>
        {fixado && (
          <button
            onClick={() => setFixado(null)}
            className="bevel-out cursor-pointer bg-[var(--color-winxp-panel)] px-1.5 py-0.5 font-bold hover:bg-white"
          >
            soltar {fixado}
          </button>
        )}
      </div>

      <div className="bevel-in relative overflow-hidden bg-white">
        <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-0.5">
          <BotaoVista aoClicar={() => aproximar(1.3)} titulo="Aproximar">
            <Plus size={13} />
          </BotaoVista>
          <BotaoVista aoClicar={() => aproximar(1 / 1.3)} titulo="Afastar">
            <Minus size={13} />
          </BotaoVista>
          <BotaoVista aoClicar={enquadrar} titulo="Enquadrar tudo de novo">
            <Maximize2 size={13} />
          </BotaoVista>
        </div>

        <svg
          ref={montarSvg}
          viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
          /* O cursor de "arrastando" sai do `:active` do CSS, e não de estado: ler o ref do
             arraste durante a renderização não é reativo, e guardá-lo em estado faria a
             árvore inteira renderizar de novo a cada apertar de botão. */
          className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
          style={{ maxHeight: '70vh' }}
          role="img"
          aria-label={`Grafo harmônico de ${titulo} no tom de ${deteccao.nome}`}
          onPointerDown={e => {
            // `setPointerCapture` lança quando o ponteiro não está ativo (acontece com
            // eventos sintéticos e quando o alvo sai da árvore). Deixar escapar aqui
            // abortaria o `pointerdown` antes de registrar o arraste, e o gesto morria
            // silenciosamente — a captura é conveniência, não requisito.
            try {
              (e.target as Element).setPointerCapture(e.pointerId);
            } catch {
              /* segue sem captura: o arraste ainda funciona dentro do próprio SVG */
            }
            const v = vista.current;
            // A caixa é medida UMA vez, no começo do gesto: `getBoundingClientRect` força
            // o navegador a recalcular layout, e chamá-lo a cada movimento anulava boa
            // parte do ganho de agrupar por quadro.
            const caixa = svgRef.current!.getBoundingClientRect();
            arraste.current = {
              x: e.clientX,
              y: e.clientY,
              tx: v.tx,
              ty: v.ty,
              escala: (VIEW * 2) / caixa.width,
              andou: false,
            };
            // Sem alvo de ponteiro durante o arraste, o navegador para de testar colisão
            // contra cada disco e cada curva a cada movimento — e não há hover a preservar
            // enquanto se move a câmera.
            grupoRef.current?.style.setProperty('pointer-events', 'none');
          }}
          onPointerMove={e => {
            const a = arraste.current;
            if (!a) return;
            // O deslocamento vem em pixels de tela; converter pelo tamanho renderizado
            // mantém o arraste colado no cursor em qualquer zoom da página.
            const dx = (e.clientX - a.x) * a.escala;
            const dy = (e.clientY - a.y) * a.escala;
            if (Math.hypot(dx, dy) > 4) a.andou = true;
            agendarVista({ ...vista.current, tx: a.tx + dx, ty: a.ty + dy });
          }}
          onPointerUp={soltarArraste}
          onPointerLeave={soltarArraste}
        >
          <defs>
            {/* A grade dá ao desenho um chão: sem ela, arrastar não parece mover nada,
                porque um anel isolado no branco não tem referência de posição. */}
            <pattern
              ref={padraoRef}
              id="grade"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${VISTA_INICIAL.tx} ${VISTA_INICIAL.ty}) scale(${VISTA_INICIAL.k})`}
            >
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eef1f5" strokeWidth="1" />
            </pattern>
          </defs>

          {/* A grade fica FORA do grupo transformado e cobre só a moldura: quem se move é o
              padrão, pelo `patternTransform`. Dentro do grupo, ela precisava de um retângulo
              oito vezes maior que a moldura para nunca acabar — dezenas de milhares de
              ladrilhos repintados a cada quadro. */}
          <rect
            x={-VIEW}
            y={-VIEW}
            width={VIEW * 2}
            height={VIEW * 2}
            fill="url(#grade)"
            pointerEvents="none"
          />

          {/* O `transform` inicial vem daqui; a partir do primeiro gesto quem escreve é o
              `aplicarVista`, direto no DOM. */}
          <g
            ref={grupoRef}
            transform={`translate(${VISTA_INICIAL.tx} ${VISTA_INICIAL.ty}) scale(${VISTA_INICIAL.k})`}
          >
            {/* O anel do campo: a régua contra a qual se lê o quanto um acorde está fora. */}
            <circle cx={0} cy={0} r={grafo.raio} fill="none" stroke="#d4d0c8" strokeWidth={2} />

            {cena.tracados.map(a => {
              const m = MOVIMENTO[a.movimento];
              const destacada = !ativo || a.de === ativo || a.para === ativo;
              return (
                <g key={`${a.de}->${a.para}`} opacity={destacada ? 0.75 : 0.07}>
                  <title>
                    {a.de} → {a.para} · {a.vezes}× · {m.rotulo}
                  </title>
                  <path
                    d={a.d}
                    fill="none"
                    stroke={m.cor}
                    strokeWidth={a.espessura}
                    strokeDasharray={m.traco}
                  />
                  {/* A ponta é sólida mesmo quando a linha é pontilhada: o tracejado conta
                      o TIPO de movimento, e a direção não deve ficar refém dele. */}
                  <polygon points={a.ponta} fill={m.cor} />
                </g>
              );
            })}

            {grafo.nos.map(no => (
              <NoDesenhado
                key={no.id}
                no={no}
                apagado={!ligadoAoAtivo(no.id)}
                ativo={ativo === no.id}
                onHover={setFoco}
                onClick={() => {
                  // Um arraste que terminou sobre o disco não é uma seleção.
                  if (arraste.current?.andou) return;
                  setFixado(f => (f === no.id ? null : no.id));
                }}
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px]">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-gray-600">acordes:</strong>
          {cena.papeisUsados.map(p => (
            <span key={p} className="flex items-center gap-1">
              <span
                className="block h-2.5 w-2.5 rounded-full"
                style={{ background: PAPEL[p].cor }}
              />
              {PAPEL[p].rotulo}
            </span>
          ))}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-gray-600">passagens:</strong>
          {(Object.keys(MOVIMENTO) as MovimentoDaRaiz[])
            .filter(m => cena.movimentosUsados.has(m))
            .map(m => (
              <span key={m} className="flex items-center gap-1">
                <svg width="16" height="6" aria-hidden>
                  <line
                    x1="0" y1="3" x2="16" y2="3"
                    stroke={MOVIMENTO[m].cor}
                    strokeWidth="2.5"
                    strokeDasharray={MOVIMENTO[m].traco}
                  />
                </svg>
                {MOVIMENTO[m].rotulo}
              </span>
            ))}
        </span>
      </div>
    </div>
  );
}

/** Botão pequeno da câmera, sobreposto ao desenho. */
function BotaoVista({
  aoClicar, titulo, children,
}: {
  aoClicar(): void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={aoClicar}
      title={titulo}
      aria-label={titulo}
      className="bevel-out flex cursor-pointer items-center justify-center bg-[var(--color-winxp-panel)] p-1 text-black hover:bg-white active:border-b-white active:border-l-gray-500 active:border-r-white active:border-t-gray-500"
    >
      {children}
    </button>
  );
}

function NoDesenhado({
  no, apagado, ativo, onHover, onClick,
}: {
  no: NoDoGrafo;
  apagado: boolean;
  ativo: boolean;
  onHover(id: string | null): void;
  onClick(): void;
}) {
  const estilo = PAPEL[no.papel];
  // O raio vem do motor, que é quem também reservou o espaço no empilhamento. Recalculá-lo
  // aqui seria o caminho curto para desenhar um tamanho e ter reservado outro.
  const r = no.r;

  return (
    <g
      transform={`translate(${no.x} ${no.y})`}
      opacity={apagado ? 0.12 : 1}
      onMouseEnter={() => onHover(no.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      className="cursor-pointer"
    >
      <title>
        {no.id} · {no.grau ? `grau ${no.grau}` : no.detalhe ?? estilo.rotulo} · {no.ocorrencias}×
      </title>
      <circle
        r={r}
        fill={estilo.fundo}
        stroke={estilo.cor}
        strokeWidth={ativo ? 4 : 2}
      />
      <text
        textAnchor="middle"
        y={no.grau ? -1 : 4}
        fontSize={13}
        fontWeight="bold"
        fill="#000"
      >
        {no.id}
      </text>
      {no.grau && (
        <text textAnchor="middle" y={12} fontSize={11} fill={estilo.cor}>
          {no.grau}
        </text>
      )}
    </g>
  );
}
