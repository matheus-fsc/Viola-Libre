/*
 * O que sustenta o palpite de tom, aberto para quem quiser conferir.
 *
 * O tom não é um dado que alguém digitou: é uma leitura da cifra inteira (engine/detectKey.ts).
 * Mostrar só o resultado pediria confiança cega — e em boa parte do acervo existem DOIS
 * tons defensáveis, porque um tom maior e seu relativo menor têm as mesmas sete notas.
 *
 * Então em vez de afirmar, este painel mostra a evidência: a confiança da leitura e, para
 * cada tom possível, o campo harmônico com os graus que a música REALMENTE usa marcados.
 * Batendo os dois campos contra os acordes que estão na tela, o músico decide sozinho — e
 * decide melhor do que qualquer heurística, porque ele conhece a música.
 *
 * O botão "avançado" abre a conta inteira. Ali a régua é outra: nada de texto de 8px e
 * lista separada por vírgula. Quem abre aquilo está conferindo um número, e conferir se faz
 * com barra proporcional e tabela — coisas que se leem de relance e se comparam sem contar
 * caractere. Ver `ContaAberta`.
 */
import { useState } from 'react';
import type { DeteccaoTom, CandidatoTom, PapelDeAcorde } from '../../engine/detectKey';

/**
 * Como cada papel se apresenta. A cor codifica FORÇA DE EVIDÊNCIA, não categoria solta:
 * azul é compromisso pleno (o acorde é do tom), verde e âmbar são explicações mais frouxas,
 * cinza é o que o tom não dá conta. Lendo só as cores já se sabe a qualidade da leitura.
 */
const PAPEL: Record<PapelDeAcorde, { rotulo: string; cor: string; fundo: string }> = {
  campo: { rotulo: 'do campo harmônico', cor: '#002fa7', fundo: '#dce6f7' },
  dominante: { rotulo: 'dominante de passagem', cor: '#157a3d', fundo: '#dcefe2' },
  preparacao: { rotulo: 'ii de um ii-V', cor: '#0e6f74', fundo: '#d9eff0' },
  emprestado: { rotulo: 'emprestado do paralelo', cor: '#8a5a00', fundo: '#f5ead2' },
  estranho: { rotulo: 'sem explicação neste tom', cor: '#6b7280', fundo: '#eceaea' },
};

const ORDEM_PAPEL: PapelDeAcorde[] = ['campo', 'dominante', 'preparacao', 'emprestado', 'estranho'];

function num(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

const ROTULO: Record<DeteccaoTom['confidence'], string> = {
  alta: 'alta',
  media: 'média',
  baixa: 'baixa',
};

/** Quantas barrinhas acendem. A margem é contínua; a barra só a torna legível de relance. */
function acesas(d: DeteccaoTom): number {
  if (d.confidence === 'alta') return 5;
  if (d.confidence === 'media') return 3;
  return d.margin > 0.04 ? 2 : 1;
}

/** Cabeçalho de seção. Uma altura só para todas, para o painel não virar colcha. */
function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
      {children}
    </div>
  );
}

/**
 * Diagrama da pontuação: uma barra empilhada com as duas parcelas que a formam.
 *
 * É a peça que responde "por que ESTE tom" antes de qualquer número: dá para ver num relance
 * se a leitura veio do encaixe das notas ou da cadência. Um tom que ganha só no encaixe e
 * quase nada no repouso é um tom que ninguém confirmou tocando — e a barra denuncia isso
 * sem precisar explicar.
 */
function BarraDaPontuacao({ candidato }: { candidato: CandidatoTom }) {
  const a = candidato.analise!;
  const positivo = Math.max(0.001, a.encaixe + a.repouso);
  const pctEncaixe = (a.encaixe / positivo) * 100;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden border border-gray-400 bg-white">
        <div
          className="bg-[#316ac5]"
          style={{ width: `${pctEncaixe}%` }}
          title={`Encaixe da coleção: ${num(a.encaixe)}`}
        />
        <div
          className="bg-[#7ba7e3]"
          style={{ width: `${100 - pctEncaixe}%` }}
          title={`Repouso: ${num(a.repouso)}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[10px] leading-tight">
        <span className="flex items-center gap-1">
          <span className="block h-2.5 w-2.5 bg-[#316ac5]" />
          <span className="text-gray-700">encaixe das notas</span>
          <span className="font-mono font-bold">{num(a.encaixe)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="block h-2.5 w-2.5 bg-[#7ba7e3]" />
          <span className="text-gray-700">repouso</span>
          <span className="font-mono font-bold">{num(a.repouso)}</span>
        </span>
        {a.penalidadeModo !== 0 && (
          <span className="flex items-center gap-1">
            <span className="block h-2.5 w-2.5 border border-gray-400 bg-white" />
            <span className="text-gray-700">modo raro</span>
            <span className="font-mono font-bold text-[#cc3300]">{num(a.penalidadeModo)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Os sinais de repouso como barras proporcionais.
 *
 * A lista crua não deixava ver o que pesou: "+10" e "+2,4" liam-se igual. Em barra, o
 * argumento principal salta — na maioria das cifras é o acorde final, e é bom que quem
 * confere veja isso de imediato, porque é o sinal mais discutível se a cifra tiver um
 * final estranho.
 */
function SinaisDeRepouso({ candidato }: { candidato: CandidatoTom }) {
  const sinais = candidato.analise!.sinais;
  if (sinais.length === 0) {
    return (
      <p className="text-[11px] leading-snug text-gray-500">
        Nenhum sinal de repouso apontou para este tom — ele está aqui só pelo encaixe das
        notas, que não sabe dizer onde a música pousa.
      </p>
    );
  }
  const maior = Math.max(...sinais.map(s => s.pontos));

  return (
    <table className="w-full text-[11px] leading-tight">
      <tbody>
        {sinais.map(s => (
          <tr key={s.nome}>
            <td className="pr-1.5 align-middle" style={{ width: '38%' }}>
              <span className="flex items-center gap-1">
                <span className="w-6 shrink-0 text-right font-mono font-bold text-[#002fa7]">
                  +{num(s.pontos)}
                </span>
                <span className="h-2.5 flex-1 bg-gray-200">
                  <span
                    className="block h-full bg-[#316ac5]"
                    style={{ width: `${(s.pontos / maior) * 100}%` }}
                  />
                </span>
              </span>
            </td>
            <td className="py-0.5 align-middle text-gray-700">{s.nome}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Tabela dos acordes por papel — uma linha por categoria, com as fichas dentro.
 *
 * Agrupar por papel e dar uma ficha a cada acorde é o que substituiu a lista com vírgulas:
 * a contagem fica na borda esquerda, as fichas embrulham sozinhas em tela estreita, e a cor
 * repete a do resto do painel, então a leitura é a mesma em qualquer lugar.
 */
function TabelaDeAcordes({ candidato }: { candidato: CandidatoTom }) {
  const acordes = candidato.analise!.acordes;
  const grupos = ORDEM_PAPEL.map(papel => ({
    papel,
    itens: acordes.filter(x => x.papel === papel),
  })).filter(g => g.itens.length > 0);

  return (
    <table className="w-full border-collapse text-[11px]">
      <tbody>
        {grupos.map(g => {
          const estilo = PAPEL[g.papel];
          return (
            <tr key={g.papel} className="border-t border-[#d4d0c8] first:border-t-0">
              <td className="py-1 pr-2 align-top" style={{ width: '34%' }}>
                <span className="flex items-start gap-1 leading-tight">
                  {/* Sólido, e não a cor de fundo clara das fichas: com fundo claro e borda
                      colorida num quadrado de 10px, isto lia como caixa de seleção
                      DESMARCADA — parecia oferecer um filtro que não existe. */}
                  <span
                    className="mt-0.5 block h-2.5 w-2.5 shrink-0"
                    style={{ background: estilo.cor }}
                  />
                  <span>
                    <span className="font-bold" style={{ color: estilo.cor }}>
                      {estilo.rotulo}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {g.itens.length} de {acordes.length}
                    </span>
                  </span>
                </span>
              </td>
              <td className="py-1 align-top">
                <span className="flex flex-wrap gap-1">
                  {g.itens.map(x => (
                    <span
                      key={x.chord}
                      className="inline-flex items-baseline gap-1 border px-1 py-0.5 leading-none"
                      style={{ background: estilo.fundo, borderColor: estilo.cor }}
                      title={x.detalhe ? `${x.chord} — ${x.detalhe}` : x.chord}
                    >
                      <span className="font-mono font-bold text-black">{x.chord}</span>
                      {x.detalhe && (
                        <span className="text-[9px]" style={{ color: estilo.cor }}>
                          {x.detalhe}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * A conta aberta de um candidato.
 *
 * Fica atrás de um botão porque é auditoria, não uso: quem só quer trocar o tom não deve
 * tropeçar nela. Mas fica DISPONÍVEL porque o painel afirma "confiança alta" e "16 de 22
 * acordes", e afirmação sem como conferir é pedir fé.
 */
function ContaAberta({ candidato, principal }: { candidato: CandidatoTom; principal: boolean }) {
  if (!candidato.analise) return null;

  return (
    <div className="border-b-2 border-[#d4d0c8] px-2 py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold text-black">
          {candidato.nome}
          {!principal && (
            <span className="ml-1 text-[10px] font-normal text-gray-500">alternativa</span>
          )}
        </span>
        <span className="shrink-0 font-mono text-[11px] font-bold text-gray-700">
          {num(candidato.score)} pts
        </span>
      </div>

      <div className="pt-1.5">
        <BarraDaPontuacao candidato={candidato} />
      </div>

      <Secao>Por que a música pousa aqui</Secao>
      <SinaisDeRepouso candidato={candidato} />

      <Secao>Os {candidato.analise.acordes.length} acordes distintos da cifra</Secao>
      <TabelaDeAcordes candidato={candidato} />
    </div>
  );
}

/**
 * O detalhe da conta, no title do resumo.
 *
 * "16 de 22 acordes" é o número honesto do que o tom EXPLICA, mas ele junta três coisas de
 * força diferente. Quem quiser conferir precisa poder abrir a conta — senão o número grande
 * esconde que boa parte dele veio das categorias mais frouxas.
 */
function detalhe(c: CandidatoTom): string {
  const doCampo = c.fits - c.dominantes - c.emprestados - c.preparacoes;
  const partes = [`${doCampo} do campo harmônico`];
  if (c.dominantes > 0) partes.push(`${c.dominantes} dominante(s) de passagem`);
  if (c.preparacoes > 0) partes.push(`${c.preparacoes} preparando um ii-V`);
  if (c.emprestados > 0) partes.push(`${c.emprestados} emprestado(s) do tom paralelo`);
  const fora = c.total - c.fits;
  if (fora > 0) partes.push(`${fora} sem explicação neste tom`);
  return partes.join(' · ');
}

function CampoDoTom({ candidato, principal }: { candidato: CandidatoTom; principal: boolean }) {
  const fora = candidato.total - candidato.fits;
  return (
    <div className="border-b border-[#d4d0c8] px-1.5 py-1.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <span className={`text-[11px] font-bold ${principal ? 'text-[#002fa7]' : 'text-black'}`}>
          {candidato.nome}
          {principal && (
            <span className="ml-1 text-[9px] font-normal text-gray-500">mais provável</span>
          )}
        </span>
        {/* Mostrar quantos ficaram DE FORA é o que impede o número de parecer melhor do que
            é. "16 de 22" já soa bem; "· 6 de fora" diz na mesma linha o tamanho do que este
            tom não dá conta, e o title abre a conta inteira para quem quiser conferir. */}
        <span className="shrink-0 text-[10px] text-gray-500" title={detalhe(candidato)}>
          {candidato.fits} de {candidato.total} acordes
          {fora > 0 && <span className="text-gray-400"> · {fora} de fora</span>}
        </span>
      </div>
      {/* Mesma repartição da fita de tons: flex-1 + min-w-0 para caber em 296px sem estourar. */}
      <div className="flex items-stretch gap-px">
        {candidato.campo.map(g => (
          <div
            key={g.grau}
            title={`${g.grau} — ${g.chord}${g.usado ? ' (a música usa)' : ' (não aparece)'}`}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border py-1 leading-none ${
              g.usado
                ? 'border-[#002fa7] bg-white text-black'
                : 'border-gray-300 bg-[#ece9d8] text-gray-400'
            }`}
          >
            <span className="text-[9px] font-normal text-gray-500">{g.grau}</span>
            <span className="max-w-full truncate text-[10px] font-bold">{g.chord}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TonsPossiveis({ deteccao }: { deteccao: DeteccaoTom | null }) {
  // O hook vem antes de qualquer saída antecipada: a ordem dos hooks tem que ser a mesma
  // em toda renderização, e `deteccao` é nula enquanto a cifra carrega.
  const [avancado, setAvancado] = useState(false);
  if (!deteccao) return null;

  // Com confiança alta não há o que escolher: mostra-se um campo só, como referência.
  // Sem ela, os concorrentes aparecem — é justamente aí que a comparação vale.
  const mostrar = deteccao.confidence === 'alta' ? 1 : Math.min(3, deteccao.candidates.length);
  const n = acesas(deteccao);

  return (
    <div className="mt-1.5 border-t border-[#d4d0c8] pt-1.5">
      <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Confiança
          </span>
          <button
            onClick={() => setAvancado(v => !v)}
            aria-expanded={avancado}
            className="bevel-out cursor-pointer bg-[var(--color-winxp-panel)] px-1.5 py-0.5 text-[10px] font-bold leading-tight text-black hover:bg-white active:border-b-white active:border-l-gray-500 active:border-r-white active:border-t-gray-500"
            title="Ver a conta inteira: de onde saiu a pontuação e o papel de cada acorde"
          >
            avançado {avancado ? '▴' : '▾'}
          </button>
        </span>
        <span className="flex items-center gap-1">
          <span className="flex gap-px" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={`block h-3 w-2 border ${
                  i < n ? 'border-[#316ac5] bg-[#316ac5]' : 'border-gray-400 bg-white'
                }`}
              />
            ))}
          </span>
          <span className="text-[10px] text-gray-600">{ROTULO[deteccao.confidence]}</span>
        </span>
      </div>

      {deteccao.modulates && (
        <p className="px-1.5 pb-1 text-[10px] leading-snug text-[#cc3300]">
          A música muda de tom ao longo dela
          {deteccao.regions.length > 0 && (
            <>
              :{' '}
              {deteccao.regions.map((r, i) => (
                <span key={`${r.from}-${r.key}`}>
                  {i > 0 && ' → '}
                  <strong>{r.key}</strong>
                  {/* O deslocamento em semitons é o que o músico usa para acompanhar; `0`
                      quer dizer mesma tônica com outra cor (Ré menor → Ré maior), e aí não
                      há número a mostrar porque a mão não anda. */}
                  {r.semitons !== 0 && (
                    <span className="font-mono">
                      {' '}
                      {r.semitons > 0 ? '+' : ''}
                      {r.semitons}
                    </span>
                  )}
                </span>
              ))}
            </>
          )}
          .
        </p>
      )}

      <div className="bevel-in bg-white">
        <div className="px-1.5 pt-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
          {mostrar > 1 ? 'Tons possíveis — campo harmônico' : 'Campo harmônico'}
        </div>
        {deteccao.candidates.slice(0, mostrar).map((c, i) => (
          /* `nome` e não `key`: com os modos, "G" e "G mixolídio" têm o mesmo `key` e
             seriam duas linhas com a mesma chave de React. */
          <CampoDoTom key={c.nome} candidato={c} principal={i === 0} />
        ))}
      </div>

      <p className="px-1.5 pt-1 text-[9px] leading-snug text-gray-500">
        Em azul, os graus que aparecem na cifra. Dominante de passagem e acorde emprestado do
        tom paralelo contam na conta acima, mas não marcam grau — não são do campo.
      </p>

      {avancado && (
        <div className="mt-2">
          <div className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Como esta leitura foi feita
          </div>
          <div className="bevel-in bg-white">
            {deteccao.candidates.slice(0, mostrar).map((c, i) => (
              <ContaAberta key={c.nome} candidato={c} principal={i === 0} />
            ))}
          </div>
          <p className="px-1.5 pt-1.5 text-[10px] leading-snug text-gray-600">
            A pontuação só compara candidatos entre si — não tem unidade. A confiança sai da
            margem sobre o melhor rival de <strong>outro tom</strong>
            {deteccao.margin > 0 && `, aqui ${Math.round(deteccao.margin * 100)}%`}: rival que
            chega ao mesmo tom por outro modo não conta, porque aí a dúvida é de campo e não
            de tom.
            {deteccao.modulates && deteccao.regions.length === 0 && (
              <> A música não firma um tom só, e os trechos não têm fronteira nítida para
              apontar.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
