/*
 * Cifras guardadas no aparelho.
 *
 * Serve a duas coisas que parecem uma só e não são:
 *
 *   1. VELOCIDADE — "próxima" abre na hora em vez de esperar a rede. É o ganho que se
 *      sente numa roda, quando a música acaba e a mão já está no braço do violão.
 *   2. DISPONIBILIDADE — a cifra continua legível quando a rede cai, quando o sinal do
 *      sítio some, ou quando a API está fora (aconteceu no meio deste trabalho).
 *
 * ONDE, E POR QUE NÃO NO localStorage
 *
 * Uma cifra medida no acervo pesa de 3,6 KB a 21 KB, média perto de 10 KB. Uma roda de
 * quarenta músicas dá ~400 KB e a estante inteira de alguém dá alguns MB — o localStorage
 * tem ~5 MB no total e é onde a lista de favoritos mora. Guardar cifras lá significaria
 * competir com a estante pelo mesmo espaço e arriscar perder a estante, que é a única
 * coisa insubstituível aqui. Além disso ele escreve de forma síncrona: gravar 400 KB
 * travaria a interface.
 *
 * O IndexedDB é assíncrono, tem quota de centenas de MB e é apagável em separado.
 *
 * O QUE ISTO **NÃO** RESOLVE SOZINHO
 *
 * Guardar os dados não põe o site de pé sem rede: sem um service worker, o navegador não
 * consegue nem carregar o HTML e o JavaScript do app para chegar a ler este cache. Este
 * módulo é a metade do problema que trata do conteúdo; a outra metade é a casca do app.
 */

import type { CifraDetail } from './api';

const DB = 'viola_libre_cifras';
const LOJA = 'cifras';
const VERSAO = 1;

export interface CifraGuardada {
  /** `artista/musica`, a mesma chave da estante. */
  chave: string;
  dados: CifraDetail;
  /** ISO. Serve para revalidar o que está velho e para o usuário saber de quando é. */
  salvoEm: string;
  /** Tamanho do JSON em bytes, medido na gravação — somar isto é mais barato que remedir. */
  bytes: number;
}

// ---------------------------------------------------------------------------
// Lógica pura (testável sem navegador)
// ---------------------------------------------------------------------------

/**
 * Média medida no acervo, usada para dizer "vai ocupar mais ou menos tanto" ANTES de
 * baixar — quando ainda não há como saber o tamanho real.
 *
 * Aferida em cinco cifras: 3,6 KB / 5,1 KB / 12,7 KB / 21 KB. A conta é grosseira de
 * propósito, e a tela diz "aproximadamente"; depois de salvar, o número mostrado é o real.
 */
export const BYTES_POR_CIFRA_ESTIMADO = 10 * 1024;

/**
 * Tamanho legível, com a vírgula decimal do português.
 *
 * Vai até GB porque a quota do navegador é medida nessa ordem — sem o degrau, ela aparecia
 * como "3072,1 MB", que é um número que ninguém lê como espaço em disco.
 */
export function formatarBytes(bytes: number): string {
  const K = 1024;
  if (bytes < K) return `${bytes} B`;
  if (bytes < K * K) return `${(bytes / K).toFixed(0)} KB`;
  if (bytes < K * K * K) return `${(bytes / (K * K)).toFixed(1).replace('.', ',')} MB`;
  return `${(bytes / (K * K * K)).toFixed(1).replace('.', ',')} GB`;
}

/** O que falta baixar de uma lista, dado o que já está guardado. */
export function faltaBaixar(chaves: readonly string[], guardadas: ReadonlySet<string>): string[] {
  const vistas = new Set<string>();
  return chaves.filter(c => !guardadas.has(c) && !vistas.has(c) && vistas.add(c));
}

/**
 * Uma resposta que vale a pena guardar?
 *
 * A API devolve 200 com corpo vazio para música inexistente (medido: 34 bytes), e gravar
 * isso deixaria um buraco no cache que se comportaria como "já baixei" e nunca mostraria
 * a cifra. Guardar só o que tem conteúdo é o que impede o cache de memorizar um erro.
 */
export function vaiParaOCache(dados: unknown): dados is CifraDetail {
  const d = dados as Partial<CifraDetail> | null;
  return Boolean(d && typeof d.title === 'string' && d.title
    && typeof d.content_html === 'string' && d.content_html.length > 20);
}

export const tamanhoEmBytes = (dados: CifraDetail): number =>
  new TextEncoder().encode(JSON.stringify(dados)).length;

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

export const temCache = (): boolean => typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  if (!temCache()) return Promise.resolve(null);
  dbPromise ??= new Promise<IDBDatabase | null>(resolve => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB, VERSAO);
    } catch {
      resolve(null); // modo privado em alguns navegadores
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA)) {
        req.result.createObjectStore(LOJA, { keyPath: 'chave' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    // Falhar aqui não é fatal em lugar nenhum: quem chama trata `null` como "sem cache",
    // e o app volta a funcionar exatamente como funcionava antes de existir cache.
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function comLoja<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return abrir().then(db => {
    if (!db) return null;
    return new Promise<T | null>(resolve => {
      let req: IDBRequest<T>;
      try {
        req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
      } catch {
        resolve(null);
        return;
      }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  });
}

export async function lerCifra(chave: string): Promise<CifraGuardada | null> {
  const r = await comLoja<CifraGuardada>('readonly', loja => loja.get(chave) as IDBRequest<CifraGuardada>);
  return r ?? null;
}

export async function guardarCifra(chave: string, dados: CifraDetail): Promise<boolean> {
  if (!vaiParaOCache(dados)) return false;
  const reg: CifraGuardada = {
    chave, dados, salvoEm: new Date().toISOString(), bytes: tamanhoEmBytes(dados),
  };
  const r = await comLoja('readwrite', loja => loja.put(reg) as IDBRequest<IDBValidKey>);
  return r !== null;
}

export async function apagarCifras(chaves: readonly string[]): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>(resolve => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(LOJA, 'readwrite');
    } catch {
      resolve();
      return;
    }
    const loja = tx.objectStore(LOJA);
    for (const c of chaves) loja.delete(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export interface ResumoDoCache {
  chaves: Set<string>;
  itens: number;
  bytes: number;
}

/**
 * O que está guardado, e quanto ocupa.
 *
 * Percorre com cursor em vez de `getAll` porque `getAll` traz o `content_html` de tudo
 * para a memória só para contar — com duzentas cifras isso são alguns MB de string por
 * uma soma que já está gravada em cada registro.
 */
export async function resumoDoCache(): Promise<ResumoDoCache> {
  const vazio: ResumoDoCache = { chaves: new Set(), itens: 0, bytes: 0 };
  const db = await abrir();
  if (!db) return vazio;

  return new Promise<ResumoDoCache>(resolve => {
    const acc: ResumoDoCache = { chaves: new Set(), itens: 0, bytes: 0 };
    let req: IDBRequest<IDBCursorWithValue | null>;
    try {
      req = db.transaction(LOJA, 'readonly').objectStore(LOJA).openCursor();
    } catch {
      resolve(vazio);
      return;
    }
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(acc); return; }
      const v = cur.value as CifraGuardada;
      acc.chaves.add(v.chave);
      acc.itens += 1;
      acc.bytes += v.bytes ?? 0;
      cur.continue();
    };
    req.onerror = () => resolve(vazio);
  });
}

/**
 * Quanto o navegador diz que há de espaço.
 *
 * É uma estimativa do próprio navegador e vem arredondada de propósito (proteção contra
 * fingerprinting), então serve para dar contexto — "400 KB de 2 GB" — e nunca para decidir
 * sozinha se cabe. Ausente em navegador que não implementa: aí a tela simplesmente não
 * mostra a fração.
 */
export async function espacoDoNavegador(): Promise<{ usado: number; total: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || typeof e.quota !== 'number' || typeof e.usage !== 'number') return null;
    return { usado: e.usage, total: e.quota };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Preferência: guardar sozinho?
// ---------------------------------------------------------------------------

/**
 * Três estados, e o terceiro é o que importa.
 *
 *   `'sim'` / `'nao'` — o usuário respondeu.
 *   ausente           — ainda não foi perguntado.
 *
 * Sem distinguir "disse não" de "nunca perguntei", ou a pergunta reaparece para sempre
 * (irritante) ou nunca aparece (o recurso não existe para quem não foi caçá-lo no menu).
 */
export type PreferenciaOffline = 'sim' | 'nao';

const CHAVE_PREF = 'vl_offline_auto';

export function lerPreferencia(): PreferenciaOffline | null {
  try {
    const v = localStorage.getItem(CHAVE_PREF);
    return v === 'sim' || v === 'nao' ? v : null;
  } catch {
    return null;
  }
}

export function gravarPreferencia(v: PreferenciaOffline): void {
  try {
    localStorage.setItem(CHAVE_PREF, v);
  } catch {
    // Storage bloqueado: a preferência vale pela sessão e a pergunta volta depois. Melhor
    // que impedir a escolha.
  }
}

/**
 * Vale perguntar agora?
 *
 * Só uma vez, e só quando há algo a guardar: a pergunta feita numa estante vazia não tem
 * resposta boa — "sim, guarde zero cifras" não significa nada e queima a única chance de
 * perguntar num momento em que o benefício ainda não existe.
 */
export function devePerguntar(pref: PreferenciaOffline | null, favoritos: number): boolean {
  return pref === null && favoritos > 0 && temCache();
}
