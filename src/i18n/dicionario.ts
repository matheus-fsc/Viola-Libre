/*
 * O TIPO do dicionário, derivado do pt-BR.
 *
 * Mora em arquivo próprio para quebrar o ciclo: `locales/en.ts` importa o tipo, e o
 * `index.ts` importa os dois dicionários. Se o tipo vivesse no `index.ts`, o `en.ts`
 * importaria o módulo que o importa.
 *
 * `Igual` afrouxa o `as const` do pt-BR: lá cada texto tem o seu tipo literal (bom para
 * autocompletar as CHAVES), mas o inglês precisa poder trazer qualquer string. O que o
 * tipo continua cobrando é a ESTRUTURA: toda chave presente, nenhuma sobrando.
 */
import { ptBR } from './locales/pt-BR';

type Igual<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : Igual<T[K]>;
};

export type Dicionario = Igual<typeof ptBR>;

/**
 * Toda chave possível em notação de ponto: `'sobre.titulo'`, `'seo.chords.title'`…
 *
 * É isto que faz o `t()` errar em tempo de compilação em vez de devolver a própria chave
 * na tela. Chave inexistente, ou caminho que para num objeto em vez de num texto, não
 * compila.
 */
export type Chave<T = Dicionario, Prefixo extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefixo}${K}` : Chave<T[K], `${Prefixo}${K}.`>;
}[keyof T & string];

/** Valores de interpolação: `t('sobre.livreTexto', { licenca: 'AGPL-3.0' })`. */
export type Variaveis = Record<string, string | number>;
