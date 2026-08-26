// Favoritos de CIFRA — a estante pessoal do usuário, organizável em categorias.
//
// Não confundir com os dois vizinhos:
//   • chordFavoritesApi.ts → voto público em QUAL forma de um acorde é a boa.
//   • App.tsx / viola_libre_favs → posições de acorde salvas no Dicionário de Acordes.
//
// Aqui o dono do dado é o navegador, não o servidor. O site não tem login, então uma
// lista que só existisse remotamente estaria a um localStorage limpo de sumir sem
// recuperação possível. A ordem de autoridade é:
//
//   1. localStorage  — fonte da verdade, funciona offline, responde na hora.
//   2. arquivo .json — backup explícito que o usuário baixa; carrega a identidade junto.
//   3. servidor      — espelho de melhor esforço, e a rede de segurança quando o
//                      localStorage se perde mas o hash foi restaurado de um backup.
//
// As categorias vivem só nos níveis 1 e 2: o servidor guarda apenas a lista simples de
// músicas favoritadas, e organizar é um gesto pessoal que não precisa de round-trip.

import { z } from 'zod';
import {
  favoriteCifra,
  getUserFavorites,
  getUserHash,
  isValidUserHash,
  setUserHash,
  syncFavoritesToServer,
  type FavoritedSong,
} from './api';

// ---------------------------------------------------------------------------
// Tipos e schemas
// ---------------------------------------------------------------------------

export interface FavoriteCategory {
  id: string;
  name: string;
  createdAt: string;
  /**
   * `'link'` quando a gaveta nasceu de uma lista compartilhada. Ausente nas feitas à mão.
   *
   * A diferença não é decorativa: uma lista que chegou de fora pode ser jogada fora
   * inteira, com as músicas junto (ver `deleteImportedList`), e uma gaveta que o usuário
   * montou não pode — apagá-la nunca leva favoritos embora.
   */
  source?: 'link';
  /**
   * Ordem manual das cifras nesta gaveta, por chave (`artista/musica`).
   *
   * Guardar a ordem por chave, e não uma posição em cada entrada, é o que permite que a
   * mesma cifra fique em duas gavetas com ordens diferentes — que é o normal: numa ela é a
   * terceira do show, na outra é a primeira do estudo.
   *
   * É uma DICA, não um índice: chave que sobrou de uma cifra removida é ignorada na
   * leitura, e cifra que não está aqui vai para o fim. Assim a ordem nunca some por estar
   * dessincronizada da lista.
   */
  order?: string[];
}

export interface FavoriteEntry {
  artistSlug: string;
  songSlug: string;
  title: string;
  /** Nome de exibição do artista. `null` quando só temos o slug (a rota da cifra não o traz). */
  artistName: string | null;
  versionName: string | null;
  categoryIds: string[];
  addedAt: string;
  /**
   * O tom em que ESTA pessoa toca a música, em semitons a partir do original. `0` é o
   * original — que é também o que vale para toda entrada gravada antes deste campo existir.
   *
   * Fica na estante e não no servidor pelo mesmo motivo das categorias: é escolha pessoal.
   * Duas pessoas favoritam a mesma cifra e cada uma a toca no tom da própria voz.
   */
  transpose: number;
  /**
   * Tom original da cifra, como o visualizador o detectou (o primeiro acorde).
   *
   * Guardado junto porque sem ele o `transpose` não vira nome de tom: "+2" não diz nada
   * na lista, "Lá" diz. `null` quando a cifra não tinha acorde nenhum para deduzir.
   */
  originalKey: string | null;
  /**
   * `true` quando a cifra ENTROU na estante por uma lista compartilhada — quer dizer, não
   * estava aqui antes. Ausente em tudo que o usuário favoritou por conta própria.
   *
   * É o que separa "cifra que veio no pacote" de "cifra que já era minha e por acaso
   * também estava na lista do amigo". Sem essa marca, jogar a lista fora levaria junto um
   * favorito que a pessoa escolheu sozinha, meses antes, e ela nunca saberia por quê.
   */
  fromLink?: true;
}

export interface FavoritesStore {
  version: 1;
  categories: FavoriteCategory[];
  entries: FavoriteEntry[];
  /**
   * Chaves desfavoritadas aqui cuja remoção o servidor ainda não confirmou.
   *
   * Sem isso, desfavoritar sem rede seria desfeito sozinho: a remoção fica só local, o
   * servidor continua com a música e o próximo sync a traria de volta. O usuário veria a
   * cifra ressuscitar sem ter feito nada.
   */
  pendingRemovals: string[];
}

// ---------------------------------------------------------------------------
// Tetos
// ---------------------------------------------------------------------------
//
// O arquivo importado é conteúdo hostil por definição: chega de fora, e a forma mais
// provável de ele chegar é alguém mandando "toma minha lista" por WhatsApp. Não dá para
// executar código a partir dele (é `JSON.parse`, e todo texto sai em nó de texto do JSX,
// nunca em HTML), mas dá para travar a aba: o merge é feito por índice, e ainda assim um
// arquivo de milhões de entradas custaria memória e uma serialização gigante no
// localStorage. Os tetos abaixo cortam isso antes de qualquer trabalho.
//
// Os números são folgados para uso real — a maior lista plausível de um usuário tem
// centenas de músicas, não milhares.

export const MAX_ENTRIES = 5_000;
export const MAX_CATEGORIES = 200;
/** 4 MB cobre 5.000 entradas com sobra; acima disso o arquivo não é uma estante. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Duas oitavas de folga para o tom guardado.
 *
 * O que se grava passa por `shortestTranspose` e cabe em [-5, +6]; o teto existe para o
 * que chega de fora. Fica aqui em cima, e não junto dos outros tetos lá embaixo, porque
 * `entrySchema` o usa e é avaliado na carga do módulo.
 */
export const MAX_TRANSPOSE = 24;

// Slugs seguem a mesma regra do `actionSchema` de api.ts — o que não casa aqui seria
// recusado com 422 lá. Validar na entrada do arquivo importado evita gravar no
// localStorage uma entrada que nunca conseguiria sincronizar.
const slugSchema = z.string().min(1).regex(/^[a-zA-Z0-9-]+$/);

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  createdAt: z.string(),
  // `.catch(undefined)` em vez de `.optional()` puro: um `source: 42` num arquivo forjado
  // não pode derrubar a categoria inteira, só o campo.
  source: z.literal('link').optional().catch(undefined),
  // Mesmo teto das entradas — a ordem não pode ser maior que a estante que ela ordena.
  order: z.array(z.string()).max(MAX_ENTRIES).optional().catch(undefined),
});

const entrySchema = z.object({
  artistSlug: slugSchema,
  songSlug: slugSchema,
  title: z.string().min(1),
  artistName: z.string().nullable().catch(null),
  versionName: z.string().nullable().catch(null),
  categoryIds: z.array(z.string()).catch([]),
  addedAt: z.string().catch(() => new Date().toISOString()),
  // Teto e piso porque `transposeChordString` soma o deslocamento a `+120` antes do módulo
  // 12: um `-999` vindo de um arquivo forjado sairia do outro lado com nota errada em vez
  // de erro. `.catch(0)` também é o que dá o valor às entradas gravadas antes do campo.
  transpose: z.number().int().min(-MAX_TRANSPOSE).max(MAX_TRANSPOSE).catch(0),
  originalKey: z.string().max(12).nullable().catch(null),
  fromLink: z.literal(true).optional().catch(undefined),
});

/**
 * Array que perde só a linha podre.
 *
 * Um `z.array(schema)` comum é tudo-ou-nada: uma única entrada com slug inválido faria o
 * `.catch` devolver lista vazia e o backup inteiro viraria nada. Como este arquivo é a
 * última cópia que o usuário tem, validar item a item e descartar apenas o que não presta
 * é a diferença entre perder uma música e perder a estante.
 */
const resilientArray = <T extends z.ZodType>(item: T) =>
  z.array(z.unknown())
    .catch([])
    .transform(items =>
      items
        .map(raw => item.safeParse(raw))
        .filter((r): r is { success: true; data: z.infer<T> } => r.success)
        .map(r => r.data)
    );

export const favoritesStoreSchema = z.object({
  version: z.literal(1),
  categories: resilientArray(categorySchema),
  entries: resilientArray(entrySchema),
  // Ausente nas estantes gravadas antes do campo existir.
  pendingRemovals: z.array(z.string()).catch([]),
});

/**
 * O arquivo que o usuário baixa.
 *
 * `userHash` viaja junto de propósito: é ele que transforma o download num backup de
 * verdade em vez de uma cópia da lista. Sem o hash, importar num navegador limpo
 * devolveria as músicas mas deixaria para trás tudo que já estava no servidor.
 * É opcional na leitura para que um arquivo editado à mão (ou de uma versão futura que
 * decida omiti-lo) ainda importe as músicas.
 */
export const favoritesFileSchema = z.object({
  app: z.literal('viola-libre'),
  kind: z.literal('favoritos'),
  version: z.literal(1),
  exportedAt: z.string(),
  userHash: z.string().optional(),
  /**
   * Como quem montou a lista a chamou — "Roda de terça", "pro casamento da Bia".
   *
   * Só faz sentido no compartilhamento: um backup pessoal é a estante inteira e não tem
   * nome. Do lado de quem recebe é o que diz o que aquilo é antes de importar, e vira a
   * gaveta sugerida para guardar as músicas. Mesmo teto de nome de categoria.
   */
  listName: z.string().max(60).optional().catch(undefined),
  categories: resilientArray(categorySchema),
  entries: resilientArray(entrySchema),
});

export type FavoritesFile = z.infer<typeof favoritesFileSchema>;

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

export const emptyStore = (): FavoritesStore =>
  ({ version: 1, categories: [], entries: [], pendingRemovals: [] });

/**
 * Índice chave→entrada.
 *
 * Sem ele, cada operação de merge varria a lista inteira e o custo virava quadrático:
 * medido em 16ms para 500 entradas, 811ms para 5.000 e 3,2s para 10.000 — dobrar o
 * tamanho quadruplicava o tempo, então um arquivo grande congelava a aba antes de
 * qualquer teto ser atingido.
 */
const indexEntries = (entries: FavoriteEntry[]): Map<string, FavoriteEntry> => {
  const index = new Map<string, FavoriteEntry>();
  for (const entry of entries) index.set(entryKey(entry), entry);
  return index;
};

/** Slug de música chega com barra à frente em alguns caminhos de rota (ver `getCifra`). */
export const normalizeSongSlug = (songSlug: string): string =>
  songSlug.startsWith('/') ? songSlug.slice(1) : songSlug;

/** Identidade de uma cifra na estante. Igual à da URL, para casar sem tradução. */
export const favoriteKey = (artistSlug: string, songSlug: string): string =>
  `${artistSlug}/${normalizeSongSlug(songSlug)}`;

export const entryKey = (entry: Pick<FavoriteEntry, 'artistSlug' | 'songSlug'>): string =>
  favoriteKey(entry.artistSlug, entry.songSlug);

export const isFavorited = (store: FavoritesStore, artistSlug: string, songSlug: string): boolean => {
  const key = favoriteKey(artistSlug, songSlug);
  return store.entries.some(e => entryKey(e) === key);
};

export const findEntry = (
  store: FavoritesStore,
  artistSlug: string,
  songSlug: string
): FavoriteEntry | undefined => {
  const key = favoriteKey(artistSlug, songSlug);
  return store.entries.find(e => entryKey(e) === key);
};

/** Entrada nova entra no topo — a estante é cronológica invertida por padrão. */
export const addEntry = (store: FavoritesStore, entry: FavoriteEntry): FavoritesStore => {
  const key = entryKey(entry);
  const known = store.entries.find(e => entryKey(e) === key);
  const normalized: FavoriteEntry = {
    ...entry,
    songSlug: normalizeSongSlug(entry.songSlug),
    // Refavoritar não pode apagar a organização nem a data original: o usuário pode ter
    // desfavoritado sem querer e clicado de novo.
    categoryIds: known ? known.categoryIds : entry.categoryIds,
    addedAt: known ? known.addedAt : entry.addedAt,
    // `transpose` e `originalKey` NÃO são preservados: quem favorita está com a cifra
    // aberta em algum tom agora, e é esse o tom que ele quer guardar. Se a música já
    // estava na estante, o tom antigo já foi aplicado ao abrir — então "o de agora" e "o
    // de antes" são o mesmo valor, a menos que ele tenha mudado de ideia no meio.
  };
  return { ...store, entries: [normalized, ...store.entries.filter(e => entryKey(e) !== key)] };
};

/**
 * Tira a cifra da estante e **registra a remoção**.
 *
 * O registro não é detalhe: a rota do servidor é um toggle, não um delete, e o que sai só
 * daqui continua lá. Sem a pendência, a próxima reconciliação (que roda a cada carga de
 * página) puxaria a música de volta e o usuário veria o favorito ressuscitar sozinho —
 * era exatamente o que acontecia ao remover pelo coração da lista de /favoritos.
 *
 * `toggleCifraFavorite` recalcula a pendência por cima disto, então continua mandando lá.
 */
export const removeEntry = (store: FavoritesStore, artistSlug: string, songSlug: string): FavoritesStore => {
  const key = favoriteKey(artistSlug, songSlug);
  const existia = store.entries.some(e => entryKey(e) === key);
  return {
    ...store,
    entries: store.entries.filter(e => entryKey(e) !== key),
    pendingRemovals: existia
      ? Array.from(new Set([...store.pendingRemovals, key]))
      : store.pendingRemovals,
  };
};

/** A gaveta nasceu de um link — pode ser jogada fora inteira. Ver `deleteImportedList`. */
export const isImportedList = (cat: FavoriteCategory): boolean => cat.source === 'link';

/**
 * A cifra some junto com a lista?
 *
 * Só se as duas coisas valerem: ela CHEGOU por um link (não era favorito de antes) e esta
 * é a última gaveta em que ela está. Qualquer outra etiqueta — inclusive de outra lista
 * importada — significa que ela tem vida fora deste pacote.
 */
const soVeioDaLista = (e: FavoriteEntry, catId: string): boolean =>
  e.fromLink === true && e.categoryIds.every(id => id === catId);

export interface PlanoDeDescarte {
  /** Cifras que saem da estante junto com a lista. */
  removidas: number;
  /** Cifras que ficam: já eram suas, ou estão em outra categoria. */
  mantidas: number;
}

export const planoDeDescarteDaLista = (store: FavoritesStore, catId: string): PlanoDeDescarte => {
  const naLista = store.entries.filter(e => e.categoryIds.includes(catId));
  const removidas = naLista.filter(e => soVeioDaLista(e, catId)).length;
  return { removidas, mantidas: naLista.length - removidas };
};

export const chavesDescartadasComLista = (store: FavoritesStore, catId: string): string[] =>
  store.entries.filter(e => e.categoryIds.includes(catId) && soVeioDaLista(e, catId)).map(entryKey);

/**
 * Joga fora uma lista que chegou por link, com as músicas dela.
 *
 * Diferente de `deleteCategory`, que é organização e nunca descarta cifra. Aqui o gesto é
 * "não quero esse pacote", e ele leva junto o que veio no pacote — mas nunca o que já era
 * do usuário nem o que ele arquivou em outra gaveta.
 */
export const deleteImportedList = (store: FavoritesStore, catId: string): FavoritesStore => {
  const removidas = new Set(chavesDescartadasComLista(store, catId));
  return {
    ...store,
    categories: store.categories.filter(c => c.id !== catId),
    entries: store.entries
      .filter(e => !removidas.has(entryKey(e)))
      .map(e => (e.categoryIds.includes(catId)
        ? { ...e, categoryIds: e.categoryIds.filter(id => id !== catId) }
        : e)),
    pendingRemovals: Array.from(new Set([...store.pendingRemovals, ...removidas])),
  };
};

// ── Ordem manual dentro de uma gaveta ──────────────────────────────────────

export const setCategoryOrder = (store: FavoritesStore, catId: string, keys: string[]): FavoritesStore => ({
  ...store,
  categories: store.categories.map(c => (c.id === catId ? { ...c, order: keys } : c)),
});

/**
 * Ordena pela ordem manual da gaveta. O que a ordem não menciona vai para o fim, na ordem
 * em que chegou — cifra nova numa lista já organizada aparece no fim, não some nem
 * embaralha o que já estava arrumado.
 */
export const sortByOrder = (entries: FavoriteEntry[], order: string[] | undefined): FavoriteEntry[] => {
  if (!order || order.length === 0) return entries;
  const pos = new Map(order.map((k, i) => [k, i]));
  // `MAX_SAFE_INTEGER` e não `Infinity`: com dois ausentes, `Infinity - Infinity` é `NaN`,
  // e um comparador que devolve `NaN` tem resultado indefinido.
  const em = (e: FavoriteEntry) => pos.get(entryKey(e)) ?? Number.MAX_SAFE_INTEGER;
  return [...entries].sort((a, b) => em(a) - em(b));
};

/** Move uma chave para a posição `destino` (base 0), empurrando o resto. */
export const moveKey = (keys: string[], key: string, destino: number): string[] => {
  const de = keys.indexOf(key);
  if (de === -1) return keys;
  const alvo = Math.max(0, Math.min(keys.length - 1, destino));
  if (alvo === de) return keys;
  const next = [...keys];
  next.splice(de, 1);
  next.splice(alvo, 0, key);
  return next;
};

const makeId = (): string =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Texto sem acento e sem caixa, para comparar do jeito que o usuário compara.
 *
 * O intervalo é o bloco Combining Diacritical Marks (U+0300–U+036F) — exatamente o que
 * `normalize('NFD')` destaca das letras acentuadas. Serve tanto para a busca ("sertao"
 * achar "Sertão") quanto para nome de categoria ("Roda de viola" e "roda de viola" são a
 * mesma gaveta na cabeça de quem organiza, e duas gavetas idênticas pareceriam bug).
 */
export const foldText = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const normalizeCategoryName = (name: string): string => foldText(name.trim());

export const createCategory = (
  store: FavoritesStore,
  name: string
): { store: FavoritesStore; category: FavoriteCategory } => {
  const trimmed = name.trim();
  const existing = store.categories.find(c => normalizeCategoryName(c.name) === normalizeCategoryName(trimmed));
  if (existing) return { store, category: existing };

  const category: FavoriteCategory = { id: makeId(), name: trimmed, createdAt: new Date().toISOString() };
  return { store: { ...store, categories: [...store.categories, category] }, category };
};

export const renameCategory = (store: FavoritesStore, id: string, name: string): FavoritesStore => ({
  ...store,
  categories: store.categories.map(c => (c.id === id ? { ...c, name: name.trim() } : c)),
});

/**
 * Some com a gaveta, não com as músicas.
 *
 * Apagar uma categoria é organização, não descarte — as cifras voltam para "Todos". Se
 * levasse as músicas junto, um clique errado destruiria favoritos que o usuário passou
 * meses juntando.
 */
export const deleteCategory = (store: FavoritesStore, id: string): FavoritesStore => ({
  ...store,
  categories: store.categories.filter(c => c.id !== id),
  entries: store.entries.map(e => ({ ...e, categoryIds: e.categoryIds.filter(cid => cid !== id) })),
});

export const setEntryCategories = (store: FavoritesStore, key: string, categoryIds: string[]): FavoritesStore => ({
  ...store,
  entries: store.entries.map(e => (entryKey(e) === key ? { ...e, categoryIds: Array.from(new Set(categoryIds)) } : e)),
});

/**
 * Grava o tom em que o usuário toca esta música.
 *
 * `originalKey` viaja junto porque a estante não tem a cifra em mãos para deduzi-lo — e
 * sem ele a lista mostraria "+2" onde deveria mostrar "Lá". Quando o visualizador não
 * conseguiu detectar o tom, o que já estava guardado é preservado: um `null` de agora não
 * pode apagar um nome que uma visita anterior conseguiu descobrir.
 */
export const setEntryTom = (
  store: FavoritesStore,
  key: string,
  transpose: number,
  originalKey: string | null
): FavoritesStore => ({
  ...store,
  entries: store.entries.map(e =>
    entryKey(e) === key ? { ...e, transpose, originalKey: originalKey ?? e.originalKey } : e
  ),
});

/**
 * Uma estante reduzida a um punhado de entradas, levando só as categorias que elas usam.
 *
 * É o que se compartilha: mandar a gaveta "Roda de viola" não deve entregar junto a lista
 * completa de gavetas de quem mandou — a organização de alguém diz mais sobre a pessoa do
 * que as músicas.
 */
export const subsetStore = (store: FavoritesStore, entries: FavoriteEntry[]): FavoritesStore => {
  const usadas = new Set(entries.flatMap(e => e.categoryIds));
  return {
    ...store,
    // `source` fica para trás: se a gaveta veio de um link para MIM, isso é fato da minha
    // estante, não da lista. Quem receber decide o que ela é do lado de lá (é o `viaLink`
    // do `mergeImported`). `order` vai junto — a sequência do show é parte do que se manda.
    categories: store.categories.filter(c => usadas.has(c.id)).map(({ source: _ignora, ...c }) => c),
    entries,
    pendingRemovals: [],
  };
};

export const toggleEntryCategory = (store: FavoritesStore, key: string, categoryId: string): FavoritesStore => ({
  ...store,
  entries: store.entries.map(e => {
    if (entryKey(e) !== key) return e;
    const has = e.categoryIds.includes(categoryId);
    return { ...e, categoryIds: has ? e.categoryIds.filter(c => c !== categoryId) : [...e.categoryIds, categoryId] };
  }),
});

/**
 * Quantas cifras em cada gaveta — o número que aparece na barra lateral.
 *
 * Objeto sem protótipo porque as chaves são ids que podem vir de um arquivo importado.
 * Num `{}` comum, um id `"constructor"` faria `counts[id] ?? 0` achar a função herdada em
 * vez de `undefined` e a contagem viraria uma string absurda na tela.
 */
export const countByCategory = (store: FavoritesStore): Record<string, number> => {
  const counts: Record<string, number> = Object.create(null);
  for (const entry of store.entries) {
    for (const id of entry.categoryIds) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

export const uncategorizedCount = (store: FavoritesStore): number =>
  store.entries.filter(e => e.categoryIds.length === 0).length;

/**
 * Vira slug em nome legível: `joao-bosco` → `Joao Bosco`.
 *
 * A rota da cifra só entrega o slug do artista, então favoritar de dentro da música
 * grava um nome aproximado. `mergeServerList` corrige depois com o nome real, que a rota
 * de favoritos do servidor devolve.
 */
export const prettifySlug = (slug: string): string =>
  slug.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Traz para a estante local o que o servidor conhece.
 *
 * União, nunca substituição: uma resposta do servidor não pode apagar favoritos feitos
 * offline que ainda não subiram. O que o servidor acrescenta é o nome real do artista —
 * ele tem o dado que a rota da cifra não entrega.
 */
export const mergeServerList = (store: FavoritesStore, remote: FavoritedSong[]): FavoritesStore => {
  const index = indexEntries(store.entries);
  const novas: FavoriteEntry[] = [];

  for (const song of remote) {
    if (!song.artist_slug || !song.slug) continue;
    const key = favoriteKey(song.artist_slug, song.slug);
    const known = index.get(key);
    if (known) {
      index.set(key, { ...known, artistName: song.artist_name ?? known.artistName, title: song.title || known.title });
    } else if (index.size + novas.length < MAX_ENTRIES) {
      novas.push({
        artistSlug: song.artist_slug,
        songSlug: normalizeSongSlug(song.slug),
        title: song.title,
        artistName: song.artist_name ?? null,
        versionName: song.version_name ?? null,
        categoryIds: [],
        // O servidor não guarda tom — ele espelha só a lista. Quem vem de lá chega no
        // original, e o tom pessoal continua sendo coisa de cada navegador.
        transpose: 0,
        originalKey: null,
        // A data do servidor, quando existe. Carimbar `now()` amontoava tudo que veio de
        // lá no topo da ordem cronológica, como se tivesse sido favoritado no instante em
        // que a página abriu — a ordem real não sobrevivia à troca de aparelho.
        addedAt: song.favorited_at ?? new Date().toISOString(),
      });
    }
  }

  // Preserva a ordem original das conhecidas e põe as novas no topo, como `addEntry` faria.
  return { ...store, entries: [...novas, ...store.entries.map(e => index.get(entryKey(e)) ?? e)] };
};

/**
 * Funde um backup importado na estante atual.
 *
 * Categorias casam por NOME, não por id: os ids são gerados por navegador, então importar
 * de outro aparelho criaria uma segunda "Estudar" ao lado da que já existe. Casando por
 * nome, os ids do arquivo são remapeados para os locais e as duas gavetas viram uma.
 *
 * Nunca remove nada — importar é somar acervos, e quem quiser começar do zero limpa a
 * lista antes.
 */
export const mergeImported = (
  store: FavoritesStore,
  file: FavoritesFile,
  opts: { viaLink?: boolean } = {}
): FavoritesStore => {
  // Categorias: casa por nome via índice, e para de criar ao bater o teto — um arquivo com
  // 100.000 gavetas não pode inutilizar a barra lateral de quem importou.
  const categorias = [...store.categories];
  const porNome = new Map(categorias.map(c => [normalizeCategoryName(c.name), c]));
  const idMap = new Map<string, string>();

  for (const cat of file.categories) {
    const nome = normalizeCategoryName(cat.name);
    let alvo = porNome.get(nome);
    if (!alvo) {
      if (categorias.length >= MAX_CATEGORIES) continue;
      // `source: 'link'` só nas gavetas CRIADAS por este import. Uma que já existia
      // continua sendo do usuário — a lixeira dela não pode passar a levar músicas.
      alvo = {
        id: makeId(),
        name: cat.name.trim(),
        createdAt: cat.createdAt,
        ...(opts.viaLink ? { source: 'link' as const } : {}),
        ...(cat.order ? { order: cat.order } : {}),
      };
      categorias.push(alvo);
      porNome.set(nome, alvo);
    }
    idMap.set(cat.id, alvo.id);
  }

  const idsValidos = new Set(categorias.map(c => c.id));
  const index = indexEntries(store.entries);
  const novas: FavoriteEntry[] = [];

  for (const entry of file.entries) {
    // Só ids que existem de fato depois do remapeamento: um `categoryIds` forjado
    // apontando para gaveta inexistente viraria etiqueta fantasma na contagem.
    const mapeados = entry.categoryIds
      .map(id => idMap.get(id))
      .filter((id): id is string => Boolean(id) && idsValidos.has(id!));

    const key = favoriteKey(entry.artistSlug, entry.songSlug);
    const known = index.get(key);

    if (known) {
      // O tom de quem importa não se mexe. A música já estava na estante, então já havia
      // uma decisão sobre em que tom tocá-la — e a de outra pessoa não a substitui. Só uma
      // música NOVA chega com o tom do arquivo, e aí não há nada para atropelar.
      index.set(key, { ...known, categoryIds: Array.from(new Set([...known.categoryIds, ...mapeados])) });
    } else if (index.size + novas.length < MAX_ENTRIES) {
      // A marca vai só no que é NOVO. Se a cifra já estava na estante, ela continua sendo
      // escolha do usuário — o `known` acima nem passa por aqui.
      novas.push({
        ...entry,
        songSlug: normalizeSongSlug(entry.songSlug),
        categoryIds: mapeados,
        ...(opts.viaLink ? { fromLink: true as const } : {}),
      });
    }
  }

  return {
    ...store,
    categories: categorias,
    entries: [...novas, ...store.entries.map(e => index.get(entryKey(e)) ?? e)],
  };
};

/**
 * Monta o arquivo de export.
 *
 * `userHash` é opcional porque os dois usos são incompatíveis:
 *
 *   • BACKUP pessoal — leva a identidade, e por isso recupera tudo que está no servidor.
 *     É um arquivo tão sensível quanto uma senha: quem o tem VIRA o usuário ao importar.
 *   • COMPARTILHAR a lista — sem identidade. Um amigo importa as músicas sem herdar a
 *     conta anônima de ninguém.
 *
 * Sem essa separação, "manda tua lista de favoritos" entregaria a identidade junto, e o
 * gesto mais natural do mundo viraria um vazamento.
 */
export const buildExportFile = (
  store: FavoritesStore,
  userHash?: string | null,
  listName?: string | null
): FavoritesFile => ({
  app: 'viola-libre',
  kind: 'favoritos',
  version: 1,
  exportedAt: new Date().toISOString(),
  ...(userHash ? { userHash } : {}),
  ...(listName?.trim() ? { listName: listName.trim().slice(0, 60) } : {}),
  categories: store.categories,
  entries: store.entries,
});

export interface ParseResult {
  ok: boolean;
  file?: FavoritesFile;
  error?: string;
}

/**
 * Lê um arquivo de backup com desconfiança.
 *
 * O usuário pode arrastar qualquer .json para cá — inclusive um exportado de outro app,
 * ou um corrompido pela metade num download interrompido. Os campos `app`/`kind` são o
 * que distingue "arquivo errado" (mensagem clara) de "arquivo nosso quebrado".
 */
export const parseImportedFile = (raw: string): ParseResult => {
  // Antes de `JSON.parse`: um arquivo de centenas de MB não deve nem chegar ao parser,
  // que aloca a árvore inteira em memória antes de qualquer validação.
  if (raw.length > MAX_FILE_BYTES) {
    return { ok: false, error: 'Arquivo grande demais para ser uma lista de favoritos.' };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }

  // Corta pelo tamanho declarado antes de validar item a item: validar 2 milhões de
  // entradas para depois descartá-las já é o trabalho que se quer evitar.
  const bruto = json as { entries?: unknown; categories?: unknown } | null;
  if (Array.isArray(bruto?.entries) && bruto.entries.length > MAX_ENTRIES) {
    return { ok: false, error: `Backup com músicas demais (limite de ${MAX_ENTRIES}).` };
  }
  if (Array.isArray(bruto?.categories) && bruto.categories.length > MAX_CATEGORIES) {
    return { ok: false, error: `Backup com categorias demais (limite de ${MAX_CATEGORIES}).` };
  }

  const parsed = favoritesFileSchema.safeParse(json);
  if (!parsed.success) {
    const shape = json as { app?: unknown; kind?: unknown } | null;
    if (shape?.app !== 'viola-libre' || shape?.kind !== 'favoritos') {
      return { ok: false, error: 'Este arquivo não é um backup de favoritos do Viola Libre.' };
    }
    return { ok: false, error: 'O backup está corrompido ou é de uma versão incompatível.' };
  }

  return { ok: true, file: parsed.data };
};

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'vl_cifra_favorites_v1';

let cache: FavoritesStore | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): FavoritesStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = favoritesStoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyStore();
  } catch {
    return emptyStore(); // modo privado, storage bloqueado ou JSON quebrado
  }
}

/**
 * Instantâneo atual. Estável por referência entre escritas — `useSyncExternalStore` faria
 * loop infinito de render se cada leitura devolvesse um objeto novo.
 */
export function getStore(): FavoritesStore {
  cache ??= readFromStorage();
  return cache;
}

export function setStore(next: FavoritesStore): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage cheio ou modo privado: a estante vale pela sessão em vez de quebrar o app.
  }
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Aplica uma transformação pura e publica o resultado. */
export function updateStore(fn: (store: FavoritesStore) => FavoritesStore): FavoritesStore {
  const next = fn(getStore());
  setStore(next);
  return next;
}

// ---------------------------------------------------------------------------
// Ações com rede
// ---------------------------------------------------------------------------

export interface ToggleCifraFavoriteResult {
  favorited: boolean;
  /** Contagem pública devolvida pelo servidor, ou `null` quando ele não respondeu. */
  count: number | null;
  /** `true` quando a gravação local valeu mas a sincronização falhou. */
  offline: boolean;
}

/**
 * Liga/desliga a cifra na estante.
 *
 * Otimista por opção: o localStorage muda antes da rede. Favoritar é um gesto que precisa
 * de resposta imediata, e a lista local é a fonte da verdade de qualquer jeito — esperar
 * o servidor só adicionaria latência a uma decisão que não é dele.
 *
 * O servidor é avisado em seguida. Se ele responder com um estado diferente do pretendido
 * (aconteceu de outro dispositivo já ter votado, por exemplo), o local se corrige.
 */
export async function toggleCifraFavorite(
  input: Omit<FavoriteEntry, 'categoryIds' | 'addedAt'>
): Promise<ToggleCifraFavoriteResult> {
  const songSlug = normalizeSongSlug(input.songSlug);
  const wanted = !isFavorited(getStore(), input.artistSlug, songSlug);

  const key = favoriteKey(input.artistSlug, songSlug);

  /**
   * `pendingRemoval` marca uma remoção que o servidor ainda não confirmou. Favoritar de
   * novo sempre limpa a marca: a intenção mais recente é a que vale, e uma marca esquecida
   * faria o próximo sync apagar do servidor algo que o usuário acabou de refavoritar.
   */
  const apply = (on: boolean, pendingRemoval: boolean) => {
    updateStore(store => {
      const base = on
        ? addEntry(store, { ...input, songSlug, categoryIds: [], addedAt: new Date().toISOString() })
        : removeEntry(store, input.artistSlug, songSlug);
      const outras = base.pendingRemovals.filter(k => k !== key);
      return { ...base, pendingRemovals: pendingRemoval ? [...outras, key] : outras };
    });
  };
  apply(wanted, false);

  try {
    const result = await favoriteCifra(input.artistSlug, songSlug);
    if (result.favorited !== wanted) apply(result.favorited, false);
    return { favorited: result.favorited, count: result.count, offline: false };
  } catch (err) {
    console.error('Favorito de cifra não sincronizou com o servidor:', err);
    // O favorito local fica de pé: perder a estante por causa de rede seria pior que
    // uma contagem momentaneamente dessincronizada. Uma REMOÇÃO, porém, precisa ficar
    // registrada — senão o próximo sync a desfaz puxando a música de volta do servidor.
    if (!wanted) apply(false, true);
    return { favorited: wanted, count: null, offline: true };
  }
}

/**
 * Reconcilia estante local e servidor, nos dois sentidos.
 *
 * Silencioso de propósito: é conveniência, não requisito — a estante local já está na tela
 * e o app inteiro funciona sem isso. Qualquer etapa pode falhar sem derrubar as outras.
 *
 * A ordem não é arbitrária:
 *
 *   1. PUXA primeiro, porque as duas etapas seguintes precisam saber o que o servidor tem.
 *   2. RESOLVE as remoções pendentes. A rota é um *toggle*, não um delete: mandá-la para
 *      algo que o servidor já não tem ADICIONARIA a música de volta. Por isso só desliga o
 *      que aparece de fato na lista remota.
 *   3. EMPURRA o que só existe aqui — favoritos feitos sem rede, ou vindos de um backup
 *      importado. Antes da rota em lote isso não tinha como subir e ficava preso no
 *      navegador para sempre.
 *   4. FUNDE, ignorando o que está pendente de remoção, para não ressuscitar na tela o que
 *      o usuário acabou de tirar.
 */
export async function syncFavoritesFromServer(): Promise<FavoritesStore> {
  let remote: FavoritedSong[];
  try {
    remote = await getUserFavorites();
  } catch {
    return getStore();
  }

  const store = getStore();
  const pendentes = new Set(store.pendingRemovals);

  const resolvidas: string[] = [];
  for (const song of remote) {
    const key = favoriteKey(song.artist_slug, song.slug);
    if (!pendentes.has(key)) continue;
    try {
      await favoriteCifra(song.artist_slug, song.slug);
      resolvidas.push(key);
    } catch {
      // Continua pendente; a próxima sincronização tenta de novo.
    }
  }

  const remotas = new Set(remote.map(s => favoriteKey(s.artist_slug, s.slug)));
  const aEnviar = store.entries
    .filter(e => !remotas.has(entryKey(e)))
    .map(e => ({ artist_slug: e.artistSlug, song_slug: e.songSlug }));
  if (aEnviar.length > 0) {
    try {
      await syncFavoritesToServer(aEnviar);
    } catch {
      // Sem rede o empurrão espera a próxima; nada se perde, o local é a fonte da verdade.
    }
  }

  const aplicaveis = remote.filter(s => !pendentes.has(favoriteKey(s.artist_slug, s.slug)));
  return updateStore(st => ({
    ...mergeServerList(st, aplicaveis),
    // Sai da fila o que foi resolvido agora E o que o servidor nem tem — este pull provou
    // que não há nada para remover lá. Sem essa segunda poda, desfavoritar algo que nunca
    // subiu (feito offline, ou vindo de um backup) deixaria uma pendência para sempre.
    pendingRemovals: st.pendingRemovals.filter(k => !resolvidas.includes(k) && remotas.has(k)),
  }));
}

// ---------------------------------------------------------------------------
// Backup em arquivo
// ---------------------------------------------------------------------------

export function exportFavoritesFilename(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `viola-libre-favoritos-${stamp}.json`;
}

/**
 * Dispara o download. `includeIdentity` distingue backup pessoal de lista compartilhável
 * (ver `buildExportFile`). Só toca no DOM — a montagem do arquivo é pura.
 */
export function downloadFavoritesBackup(includeIdentity = true): void {
  const file = buildExportFile(getStore(), includeIdentity ? getUserHash() : null);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFavoritesFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportOutcome {
  ok: boolean;
  error?: string;
  added: number;
  identityRestored: boolean;
}

/** O arquivo traz uma identidade diferente da deste navegador? Quem decide é o usuário. */
export function offersDifferentIdentity(file: FavoritesFile): boolean {
  return isValidUserHash(file.userHash) && file.userHash !== getUserHash();
}

/**
 * Importa um backup. **Nunca troca a identidade sozinho.**
 *
 * Adotar o hash do arquivo é destrutivo e irreversível nos dois sentidos, e por isso é
 * decisão do usuário e não do código:
 *
 *   • Quem importa PERDE o próprio hash. Os favoritos que ele tinha no servidor ficam
 *     órfãos para sempre — não há login nem e-mail para recuperá-los.
 *   • Quem importa VIRA o dono do backup. Passa a poder desfavoritar a lista dele no
 *     servidor, e os votos de acorde deste navegador contam como sendo daquela pessoa.
 *
 * Fundir a lista é seguro e acontece sempre; adotar a identidade só com `adoptIdentity`.
 * A ordem importa: o hash entra ANTES do sync, para que a chamada seguinte pergunte ao
 * servidor pelos favoritos do dono do backup e não pelos de outra identidade.
 */
export async function importFavoritesBackup(
  raw: string,
  options: { adoptIdentity?: boolean; viaLink?: boolean } = {}
): Promise<ImportOutcome> {
  const parsed = parseImportedFile(raw);
  if (!parsed.ok || !parsed.file) {
    return { ok: false, error: parsed.error, added: 0, identityRestored: false };
  }

  const before = getStore().entries.length;
  const identityRestored =
    options.adoptIdentity && offersDifferentIdentity(parsed.file)
      ? setUserHash(parsed.file.userHash!)
      : false;

  updateStore(store => mergeImported(store, parsed.file!, { viaLink: options.viaLink }));
  if (identityRestored) await syncFavoritesFromServer();

  return { ok: true, added: getStore().entries.length - before, identityRestored };
}
