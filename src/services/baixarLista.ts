/*
 * Baixar uma lista inteira para o aparelho.
 *
 * O gesto é "quero essa roda comigo no sítio", e o que ele precisa entregar é previsível:
 * quanto vai demorar, quanto ocupou, e o que deu errado — sem travar a interface no meio.
 */

import { baixarCifraParaCache } from './api';
import { faltaBaixar, resumoDoCache } from './cifraCache';

/**
 * Quantas cifras em voo ao mesmo tempo.
 *
 * Quatro, e não "todas": é uma API pequena, de um projeto sem fins lucrativos, e disparar
 * quarenta requisições de uma vez é o tipo de gentileza que derruba o próprio servidor que
 * se está usando. Quatro mantém a fila andando sem parecer um ataque.
 */
const EM_PARALELO = 4;

export interface ProgressoDownload {
  feitas: number;
  total: number;
  falhas: number;
}

export interface ResultadoDownload {
  baixadas: number;
  falhas: number;
  /** `true` quando o usuário pediu para parar no meio. */
  cancelado: boolean;
  /** Tamanho do cache DEPOIS, medido — não estimado. */
  bytes: number;
  itens: number;
}

/**
 * Baixa o que falta de uma lista, em fila com paralelismo limitado.
 *
 * O que já está guardado é pulado sem tocar a rede: mandar salvar de novo uma roda que já
 * está no aparelho deve ser instantâneo, não um novo download inteiro.
 *
 * `sinal` permite parar no meio. Parar não desfaz: o que já baixou fica, porque metade de
 * uma lista no bolso é melhor que nenhuma, e a próxima tentativa continua de onde parou.
 */
export async function baixarLista(
  chaves: readonly string[],
  aoProgredir?: (p: ProgressoDownload) => void,
  sinal?: AbortSignal
): Promise<ResultadoDownload> {
  const { chaves: jaTem } = await resumoDoCache();
  const fila = faltaBaixar(chaves, jaTem);

  let feitas = 0;
  let falhas = 0;
  let cancelado = false;
  let proxima = 0;

  const trabalhador = async () => {
    for (;;) {
      if (sinal?.aborted) { cancelado = true; return; }
      const i = proxima++;
      if (i >= fila.length) return;
      const [artista, ...resto] = fila[i].split('/');
      const musica = resto.join('/');
      const ok = artista && musica ? await baixarCifraParaCache(artista, musica) : false;
      if (ok) feitas++; else falhas++;
      aoProgredir?.({ feitas, total: fila.length, falhas });
    }
  };

  await Promise.all(Array.from({ length: Math.min(EM_PARALELO, fila.length) }, trabalhador));

  const depois = await resumoDoCache();
  return { baixadas: feitas, falhas, cancelado, bytes: depois.bytes, itens: depois.itens };
}
