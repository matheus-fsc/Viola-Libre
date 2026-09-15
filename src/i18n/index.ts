/*
 * Idioma da interface.
 *
 * Por que um módulo de ~100 linhas em vez de react-i18next: cada dependência que chega
 * ao navegador precisa de rótulo de licença para o GNU LibreJS (ver o README), e o que
 * este site usa de i18n é procurar um texto numa tabela e trocar `{variavel}`. Pluralização
 * por categoria CLDR, carregamento assíncrono de namespace e formatação de data ficariam
 * sem uso. O tipo `Chave` cobre o que a biblioteca daria de verdade: erro de compilação
 * quando a chave não existe ou quando falta a tradução.
 *
 * O dicionário inteiro entra no bundle. São dois idiomas de alguns kB de texto; dividir
 * em chunk por idioma custaria um round-trip antes do primeiro render para economizar
 * menos do que um ícone.
 *
 * Nota de SEO: a detecção pelo navegador vale só quando NÃO há escolha guardada. As URLs
 * canônicas do acervo são em português, então um rastreador com Accept-Language inglês vê
 * a interface em inglês numa URL canônica em pt-BR. O conteúdo indexável (nome de artista,
 * título de música, a cifra) não é traduzido, então o que muda é a moldura. Se um dia isso
 * pesar, o caminho é URL por idioma (`/en/...`) com hreflang, e aí a detecção some daqui.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import type { Chave, Dicionario, Variaveis } from './dicionario';

export type { Chave, Dicionario, Variaveis };

export type Idioma = 'pt-BR' | 'en';

export const IDIOMA_PADRAO: Idioma = 'pt-BR';

/** Rótulo no próprio idioma: quem procura "English" não lê "Inglês" para achá-lo. */
export const IDIOMAS: { id: Idioma; label: string; sigla: string; htmlLang: string; ogLocale: string }[] = [
  { id: 'pt-BR', label: 'Português', sigla: 'PT', htmlLang: 'pt-BR', ogLocale: 'pt_BR' },
  { id: 'en', label: 'English', sigla: 'EN', htmlLang: 'en', ogLocale: 'en_US' },
];

const DICIONARIOS: Record<Idioma, Dicionario> = { 'pt-BR': ptBR, en };

const CHAVE_STORAGE = 'viola_libre_idioma';

function ehIdioma(valor: unknown): valor is Idioma {
  return valor === 'pt-BR' || valor === 'en';
}

/**
 * Escolha guardada primeiro; só depois o navegador. Uma vez escolhido, o idioma é do
 * usuário e não volta a ser adivinhado.
 */
function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CHAVE_STORAGE);
    if (ehIdioma(guardado)) return guardado;
  } catch {
    /* modo privado ou storage bloqueado: cai na detecção */
  }
  // `navigator` existe no Node moderno mas sem `language`, então os dois precisam de guarda.
  const doNavegador = (typeof navigator !== 'undefined' && navigator.language) || '';
  if (doNavegador.toLowerCase().startsWith('pt')) return 'pt-BR';
  return doNavegador ? 'en' : IDIOMA_PADRAO;
}

/*
 * Store mínima com useSyncExternalStore, e não zustand como as outras: o idioma é lido
 * fora de componente também (o `t` avulso abaixo, usado por helpers e por metadados), e
 * aqui não há nada além de um valor e uma lista de inscritos.
 */
let idiomaAtual: Idioma = idiomaInicial();
const inscritos = new Set<() => void>();

function inscrever(fn: () => void): () => void {
  inscritos.add(fn);
  return () => inscritos.delete(fn);
}

/** Mantém o `<html lang>` e o og:locale coerentes com o que está na tela. */
function sincronizarDocumento(idioma: Idioma): void {
  if (typeof document === 'undefined') return;
  const meta = IDIOMAS.find(i => i.id === idioma) ?? IDIOMAS[0];
  document.documentElement.lang = meta.htmlLang;
  const og = document.head.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
  og?.setAttribute('content', meta.ogLocale);
}

sincronizarDocumento(idiomaAtual);

export function getIdioma(): Idioma {
  return idiomaAtual;
}

export function setIdioma(idioma: Idioma): void {
  if (idioma === idiomaAtual) return;
  idiomaAtual = idioma;
  try {
    localStorage.setItem(CHAVE_STORAGE, idioma);
  } catch {
    /* sem storage o idioma vale só nesta sessão, que é melhor que não trocar */
  }
  sincronizarDocumento(idioma);
  inscritos.forEach(fn => fn());
}

/** Percorre `'seo.chords.title'` no dicionário do idioma dado. */
function buscar(idioma: Idioma, chave: string): string {
  let no: unknown = DICIONARIOS[idioma];
  for (const parte of chave.split('.')) {
    if (typeof no !== 'object' || no === null) return chave;
    no = (no as Record<string, unknown>)[parte];
  }
  // O tipo `Chave` já garante que o caminho termina em texto. O guarda aqui é para o
  // caso de um dicionário carregado por caminho não tipado (teste, ferramenta interna).
  return typeof no === 'string' ? no : chave;
}

function interpolar(texto: string, vars?: Variaveis): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (original, nome: string) =>
    nome in vars ? String(vars[nome]) : original,
  );
}

export type Traduzir = (chave: Chave, vars?: Variaveis) => string;

/**
 * Tradução fora de componente (helpers, metadados, funções puras chamadas em efeito).
 * NÃO re-renderiza nada: dentro de componente use `useT`, senão a tela fica no idioma
 * anterior até algo mais forçar o render.
 */
export const t: Traduzir = (chave, vars) => interpolar(buscar(idiomaAtual, chave), vars);

/** Idioma atual, reativo. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(inscrever, getIdioma, () => IDIOMA_PADRAO);
}

/**
 * O `t` de dentro do componente. Trocar de idioma muda a identidade da função, então
 * quem a tiver em array de dependência recalcula, que é justamente o que se quer.
 */
export function useT(): Traduzir {
  const idioma = useIdioma();
  return useCallback((chave, vars) => interpolar(buscar(idioma, chave), vars), [idioma]);
}
