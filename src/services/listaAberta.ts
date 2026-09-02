/*
 * A lista que o músico está percorrendo.
 *
 * Quem abre uma cifra a partir de /favoritos quase nunca quer ver UMA música: quer tocar a
 * roda inteira. Sem isto, cada música custava voltar, achar a linha seguinte na lista e
 * clicar — três gestos entre uma canção e a próxima, com o violão na mão.
 *
 * ONDE ISTO MORA, E POR QUÊ NÃO NA URL
 *
 * Vale o mesmo critério do botão "Voltar" (ver `useListScrollRestoration`): a URL descreve
 * A PÁGINA, e `/cifras/almir-sater/tocando-em-frente` é a mesma cifra tendo eu chegado por
 * uma lista, pela busca ou pelo Google. Pôr a lista ali criaria endereços diferentes para
 * o mesmo conteúdo — ruim para quem indexa e para quem compartilha, porque o link levaria
 * junto o rastro de quem mandou. Isto aqui é procedência, e procedência mora na sessão.
 *
 * `sessionStorage` e não `localStorage`: percorrer uma lista é coisa de agora. Voltar ao
 * site amanhã e ainda ser empurrado para a "próxima" de uma roda de ontem seria assombração.
 *
 * A LISTA GUARDA AS CHAVES, NÃO SÓ O NOME DA GAVETA
 *
 * Duas razões. A ordem na tela é a que vale — se a pessoa arrastou as músicas na ordem do
 * show, "próxima" tem que respeitar isso, e o nome da categoria sozinho não diz a ordem. E
 * é o que permite saber quando o músico SAIU da lista: se a cifra aberta não está entre as
 * chaves, a barra simplesmente não aparece, em vez de mentir dizendo "3 de 12".
 */

import { favoriteKey, MAX_ENTRIES } from './cifraFavorites';

export interface ListaAberta {
  /** Rótulo da barra: "Roda de terça", "Todos os favoritos". */
  nome: string;
  /** Para onde o botão do meio leva — a lista de onde as cifras saíram. */
  voltarPara: string;
  /** As chaves `artista/musica`, na ordem exata em que estavam na tela. */
  chaves: string[];
}

const CHAVE = 'vl_lista_aberta';

export const caminhoDaCifra = (chave: string): string => `/cifras/${chave}`;

export function abrirLista(lista: ListaAberta): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Modo privado ou storage cheio: perder o atalho é aceitável, quebrar a navegação não.
  }
}

export function fecharLista(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch { /* idem */ }
}

/**
 * Lê a lista da sessão, desconfiando do que encontra.
 *
 * O `sessionStorage` é do usuário e pode ter sido editado à mão ou ter sobrado de uma
 * versão anterior do formato. Nada aqui é fatal — uma lista ilegível vira `null` e a
 * barra some, que é exatamente o comportamento de quem não veio de lista nenhuma.
 */
export function lerLista(): ListaAberta | null {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    if (!cru) return null;
    const v = JSON.parse(cru) as Partial<ListaAberta>;
    if (typeof v?.nome !== 'string' || typeof v?.voltarPara !== 'string') return null;
    if (!Array.isArray(v.chaves) || v.chaves.length === 0) return null;
    // O mesmo teto da estante: a lista sai dela, e um array absurdo aqui viraria uma barra
    // dizendo "4 de 900000" e um `indexOf` caro a cada troca de música.
    if (v.chaves.length > MAX_ENTRIES) return null;
    if (!v.chaves.every(c => typeof c === 'string')) return null;
    // Caminho relativo, sempre. Um `voltarPara` absoluto viraria redirecionamento para
    // fora do site a partir de dado que o navegador guarda.
    if (!v.voltarPara.startsWith('/') || v.voltarPara.startsWith('//')) return null;
    return { nome: v.nome, voltarPara: v.voltarPara, chaves: v.chaves };
  } catch {
    return null;
  }
}

export interface PosicaoNaLista {
  nome: string;
  voltarPara: string;
  /** Base 1, para mostrar na tela. */
  posicao: number;
  total: number;
  /** Caminhos prontos, ou `null` nas pontas. */
  anterior: string | null;
  proxima: string | null;
  tituloAnterior: string | null;
  tituloProxima: string | null;
}

/**
 * Onde a cifra aberta cai na lista — ou `null` se ela não está nela.
 *
 * `titulos` traduz chave em nome para o `title` dos botões; ele vem da estante, que é
 * quem tem os títulos. Sem ele os botões ainda funcionam, só ficam sem a dica.
 */
export function posicaoNaLista(
  lista: ListaAberta | null,
  artistSlug: string | undefined,
  songSlug: string | undefined,
  titulos?: Map<string, string>
): PosicaoNaLista | null {
  if (!lista || !artistSlug || !songSlug) return null;
  const chave = favoriteKey(artistSlug, songSlug);
  const i = lista.chaves.indexOf(chave);
  if (i === -1) return null;

  const anterior = i > 0 ? lista.chaves[i - 1] : null;
  const proxima = i < lista.chaves.length - 1 ? lista.chaves[i + 1] : null;

  return {
    nome: lista.nome,
    voltarPara: lista.voltarPara,
    posicao: i + 1,
    total: lista.chaves.length,
    anterior: anterior ? caminhoDaCifra(anterior) : null,
    proxima: proxima ? caminhoDaCifra(proxima) : null,
    tituloAnterior: anterior ? titulos?.get(anterior) ?? null : null,
    tituloProxima: proxima ? titulos?.get(proxima) ?? null : null,
  };
}
