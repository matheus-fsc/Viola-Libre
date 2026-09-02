import { describe, expect, it } from 'vitest';
import {
  addEntry,
  buildExportFile,
  countByCategory,
  createCategory,
  deleteCategory,
  emptyStore,
  entryKey,
  favoriteKey,
  isFavorited,
  mergeImported,
  mergeServerList,
  setEntryTom,
  setCategoryOrder,
  sortByOrder,
  subsetStore,
  deleteImportedList,
  isImportedList,
  moveKey,
  planoDeDescarteDaLista,
  normalizeCategoryName,
  parseImportedFile,
  prettifySlug,
  removeEntry,
  toggleEntryCategory,
  uncategorizedCount,
  MAX_CATEGORIES,
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  favoritesStoreSchema,
  type FavoriteEntry,
  type FavoritesStore,
} from './cifraFavorites';
import type { FavoritedSong } from './api';
import { comCategoriaDeEntrada } from './favoritesShare';

const entry = (artistSlug: string, songSlug: string, over: Partial<FavoriteEntry> = {}): FavoriteEntry => ({
  artistSlug,
  songSlug,
  title: songSlug,
  artistName: null,
  versionName: null,
  categoryIds: [],
  addedAt: '2026-01-01T00:00:00.000Z',
  transpose: 0,
  originalKey: null,
  ...over,
});

const song = (over: Partial<FavoritedSong> = {}): FavoritedSong => ({
  id: 1,
  title: 'O Bêbado e a Equilibrista',
  slug: 'o-bebado-a-equilibrista',
  artist_name: 'João Bosco',
  artist_slug: 'joao-bosco',
  ...over,
});

// A rota da cifra entrega o slug da música com barra à frente em alguns caminhos (ver
// `getCifra`). Se a chave não normalizasse, favoritar de um caminho e desfavoritar do
// outro criaria duas entradas para a mesma música e o coração nunca apagaria.
describe('favoriteKey', () => {
  it('ignora a barra à frente do slug da música', () => {
    expect(favoriteKey('joao-bosco', '/o-bebado')).toBe('joao-bosco/o-bebado');
    expect(favoriteKey('joao-bosco', 'o-bebado')).toBe('joao-bosco/o-bebado');
  });
});

describe('addEntry / removeEntry', () => {
  it('põe a entrada nova no topo', () => {
    let store = addEntry(emptyStore(), entry('a', 'um'));
    store = addEntry(store, entry('b', 'dois'));
    expect(store.entries.map(e => e.songSlug)).toEqual(['dois', 'um']);
  });

  it('reconhece o favorito mesmo quando o slug chega com barra', () => {
    const store = addEntry(emptyStore(), entry('joao-bosco', 'o-bebado'));
    expect(isFavorited(store, 'joao-bosco', '/o-bebado')).toBe(true);
    expect(removeEntry(store, 'joao-bosco', '/o-bebado').entries).toHaveLength(0);
  });

  // Desfavoritar sem querer e clicar de novo não pode custar a organização: a categoria
  // e a data originais sobrevivem ao refavoritar.
  it('preserva categorias e data ao refavoritar', () => {
    const store = addEntry(emptyStore(), entry('a', 'um', { categoryIds: ['c1'], addedAt: '2020-01-01T00:00:00.000Z' }));
    const again = addEntry(store, entry('a', 'um', { categoryIds: [], addedAt: '2026-06-06T00:00:00.000Z' }));
    expect(again.entries[0].categoryIds).toEqual(['c1']);
    expect(again.entries[0].addedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('não duplica a mesma cifra', () => {
    const store = addEntry(addEntry(emptyStore(), entry('a', 'um')), entry('a', 'um'));
    expect(store.entries).toHaveLength(1);
  });
});

describe('categorias', () => {
  it('trata acento e caixa como a mesma gaveta', () => {
    expect(normalizeCategoryName('  Roda de Violão ')).toBe(normalizeCategoryName('roda de violao'));
  });

  it('reaproveita a categoria existente em vez de criar uma irmã', () => {
    const first = createCategory(emptyStore(), 'Estudar');
    const second = createCategory(first.store, 'estudar');
    expect(second.store.categories).toHaveLength(1);
    expect(second.category.id).toBe(first.category.id);
  });

  // Apagar gaveta é organização, não descarte. Se levasse as músicas junto, um clique
  // errado destruiria favoritos acumulados por meses.
  it('apagar categoria solta as cifras em vez de excluí-las', () => {
    const { store: withCat, category } = createCategory(emptyStore(), 'Estudar');
    const store = toggleEntryCategory(addEntry(withCat, entry('a', 'um')), 'a/um', category.id);
    expect(store.entries[0].categoryIds).toEqual([category.id]);

    const after = deleteCategory(store, category.id);
    expect(after.categories).toHaveLength(0);
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0].categoryIds).toEqual([]);
  });

  it('conta por gaveta e conta as soltas', () => {
    const { store: s1, category: a } = createCategory(emptyStore(), 'A');
    const { store: s2, category: b } = createCategory(s1, 'B');
    let store = addEntry(s2, entry('x', 'um'));
    store = addEntry(store, entry('x', 'dois'));
    store = addEntry(store, entry('x', 'tres'));
    store = toggleEntryCategory(store, 'x/um', a.id);
    store = toggleEntryCategory(store, 'x/um', b.id);
    store = toggleEntryCategory(store, 'x/dois', a.id);

    expect(countByCategory(store)).toEqual({ [a.id]: 2, [b.id]: 1 });
    expect(uncategorizedCount(store)).toBe(1);
  });
});

describe('mergeServerList', () => {
  // Uma resposta do servidor não pode apagar o que foi favoritado offline e ainda não subiu.
  it('soma o que o servidor tem sem remover o que é só local', () => {
    const local = addEntry(emptyStore(), entry('so-local', 'musica'));
    const merged = mergeServerList(local, [song()]);
    expect(merged.entries.map(e => e.artistSlug).sort()).toEqual(['joao-bosco', 'so-local']);
  });

  // A rota da cifra só tem o slug do artista; a de favoritos tem o nome real. Fundir é
  // a chance de trocar "Joao Bosco" pelo "João Bosco" de verdade.
  it('completa o nome do artista sem mexer nas categorias', () => {
    const local = addEntry(emptyStore(), entry('joao-bosco', 'o-bebado-a-equilibrista', {
      artistName: 'Joao Bosco',
      categoryIds: ['c1'],
    }));
    const merged = mergeServerList(local, [song()]);
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].artistName).toBe('João Bosco');
    expect(merged.entries[0].categoryIds).toEqual(['c1']);
  });

  it('ignora linha do servidor sem slug', () => {
    const merged = mergeServerList(emptyStore(), [song({ artist_slug: '', slug: '' })]);
    expect(merged.entries).toHaveLength(0);
  });

  // Carimbar `now()` amontoava tudo que veio do servidor no topo da ordem cronológica,
  // como se tivesse sido favoritado no instante em que a página abriu.
  it('usa a data do servidor como data de adição', () => {
    const merged = mergeServerList(emptyStore(), [song({ favorited_at: '2025-03-04T10:00:00Z' })]);
    expect(merged.entries[0].addedAt).toBe('2025-03-04T10:00:00Z');
  });

  it('cai para agora quando a linha antiga não tem data', () => {
    const merged = mergeServerList(emptyStore(), [song({ favorited_at: null })]);
    expect(Date.parse(merged.entries[0].addedAt)).toBeGreaterThan(0);
  });
});

describe('parseImportedFile', () => {
  const valid = (over: Record<string, unknown> = {}) => JSON.stringify({
    app: 'viola-libre',
    kind: 'favoritos',
    version: 1,
    exportedAt: '2026-07-31T00:00:00.000Z',
    userHash: 'a'.repeat(32),
    categories: [],
    entries: [],
    ...over,
  });

  it('aceita um backup íntegro', () => {
    const out = parseImportedFile(valid());
    expect(out.ok).toBe(true);
    expect(out.file?.userHash).toBe('a'.repeat(32));
  });

  it('recusa JSON quebrado', () => {
    expect(parseImportedFile('{ isso não é json').ok).toBe(false);
  });

  // "Arquivo errado" e "arquivo nosso corrompido" pedem mensagens diferentes — o usuário
  // resolve um arrastando outro arquivo e o outro não resolve arrastando nada.
  it('distingue arquivo de outro app de backup corrompido', () => {
    const alheio = parseImportedFile(JSON.stringify({ app: 'outro-app', entries: [] }));
    expect(alheio.ok).toBe(false);
    expect(alheio.error).toMatch(/não é um backup/i);

    const corrompido = parseImportedFile(valid({ version: 99 }));
    expect(corrompido.ok).toBe(false);
    expect(corrompido.error).toMatch(/corrompido|incompat/i);
  });

  it('descarta entrada com slug inválido sem derrubar o resto do arquivo', () => {
    const out = parseImportedFile(valid({
      entries: [
        { artistSlug: 'ok', songSlug: 'musica', title: 'Boa', artistName: null, versionName: null, categoryIds: [], addedAt: 'x' },
        { artistSlug: '../etc/passwd', songSlug: 'x', title: 'Ruim', artistName: null, versionName: null, categoryIds: [], addedAt: 'x' },
      ],
    }));
    expect(out.ok).toBe(true);
    expect(out.file?.entries.map(e => e.title)).toEqual(['Boa']);
  });
});

describe('mergeImported', () => {
  // Os ids de categoria são gerados por navegador. Casando só por id, importar de outro
  // aparelho criaria uma segunda "Estudar" ao lado da que já existe.
  it('funde categorias de mesmo nome remapeando os ids do arquivo', () => {
    const { store: local, category } = createCategory(emptyStore(), 'Estudar');
    const file = {
      app: 'viola-libre' as const,
      kind: 'favoritos' as const,
      version: 1 as const,
      exportedAt: '2026-07-31T00:00:00.000Z',
      categories: [{ id: 'outro-id', name: 'estudar', createdAt: '2026-01-01T00:00:00.000Z' }],
      entries: [entry('joao-bosco', 'o-bebado', { categoryIds: ['outro-id'] })],
    };

    const merged = mergeImported(local, file);
    expect(merged.categories).toHaveLength(1);
    expect(merged.entries[0].categoryIds).toEqual([category.id]);
  });

  it('soma acervos em vez de substituir', () => {
    const local = addEntry(emptyStore(), entry('local', 'so-aqui'));
    const merged = mergeImported(local, {
      app: 'viola-libre', kind: 'favoritos', version: 1,
      exportedAt: '2026-07-31T00:00:00.000Z',
      categories: [],
      entries: [entry('backup', 'so-la')],
    });
    expect(merged.entries.map(e => e.songSlug).sort()).toEqual(['so-aqui', 'so-la']);
  });
});

// O hash é a única chave que liga o usuário ao que está no servidor, e não há e-mail
// para reenviá-lo. Se o export não o levasse, o download seria cópia de lista, não backup.
describe('buildExportFile', () => {
  it('leva a identidade junto e sobrevive a um round-trip', () => {
    const hash = 'b'.repeat(32);
    const store: FavoritesStore = addEntry(emptyStore(), entry('joao-bosco', 'o-bebado'));
    const file = buildExportFile(store, hash);

    const out = parseImportedFile(JSON.stringify(file));
    expect(out.ok).toBe(true);
    expect(out.file?.userHash).toBe(hash);
    expect(out.file?.entries).toHaveLength(1);
  });
});

// O arquivo importado é conteúdo hostil: chega de fora e o jeito mais provável de chegar
// é alguém mandando "toma minha lista". Não dá para executar código a partir dele, mas dá
// para travar a aba — antes destes tetos, 10.000 entradas levavam 3,2s de merge e o custo
// era quadrático.
describe('tetos do arquivo importado', () => {
  const arquivo = (over: Record<string, unknown>) => JSON.stringify({
    app: 'viola-libre', kind: 'favoritos', version: 1, exportedAt: '2026-07-31T00:00:00.000Z',
    categories: [], entries: [], ...over,
  });

  const muitasEntradas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      artistSlug: 'a' + i, songSlug: 's' + i, title: 't' + i,
      artistName: null, versionName: null, categoryIds: [], addedAt: 'x',
      transpose: 0, originalKey: null,
    }));

  it('recusa arquivo acima do limite de bytes sem nem chamar o parser', () => {
    const out = parseImportedFile('x'.repeat(MAX_FILE_BYTES + 1));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/grande demais/i);
  });

  it('recusa lista com músicas demais', () => {
    const out = parseImportedFile(arquivo({ entries: muitasEntradas(MAX_ENTRIES + 1) }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/músicas demais/i);
  });

  it('recusa lista com categorias demais', () => {
    const cats = Array.from({ length: MAX_CATEGORIES + 1 }, (_, i) => ({ id: 'c' + i, name: 'n' + i, createdAt: 'x' }));
    const out = parseImportedFile(arquivo({ categories: cats }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/categorias demais/i);
  });

  it('o merge não passa do teto mesmo com a estante já cheia', () => {
    const cheia: FavoritesStore = { ...emptyStore(), entries: muitasEntradas(MAX_ENTRIES) };
    const merged = mergeImported(cheia, {
      app: 'viola-libre', kind: 'favoritos', version: 1, exportedAt: 'x',
      categories: [],
      entries: [entry('novo', 'musica')],
    });
    expect(merged.entries).toHaveLength(MAX_ENTRIES);
  });

  // Num `{}` comum, `counts['constructor'] ?? 0` acha a função herdada em vez de undefined
  // e a contagem vira uma string absurda na barra lateral.
  it('a contagem por categoria ignora chaves herdadas do protótipo', () => {
    const store = addEntry(emptyStore(), entry('a', 'um', { categoryIds: ['constructor', '__proto__'] }));
    const counts = countByCategory(store);
    expect(counts['constructor']).toBe(1);
    expect(Object.getPrototypeOf(counts)).toBeNull();
  });

  it('descarta categoryIds que não existem depois do remapeamento', () => {
    const merged = mergeImported(emptyStore(), {
      app: 'viola-libre', kind: 'favoritos', version: 1, exportedAt: 'x',
      categories: [],
      entries: [entry('a', 'um', { categoryIds: ['gaveta-fantasma'] })],
    });
    expect(merged.entries[0].categoryIds).toEqual([]);
  });
});

// Adotar o hash do arquivo é irreversível nos dois sentidos: quem importa perde o próprio
// (favoritos órfãos no servidor, sem login para recuperar) e passa a poder mexer nos da
// outra pessoa. Não pode ser efeito colateral de arrastar um arquivo.
describe('identidade no export/import', () => {
  it('exporta sem identidade quando o arquivo é para compartilhar', () => {
    const file = buildExportFile(emptyStore(), null);
    expect(file.userHash).toBeUndefined();
    expect(parseImportedFile(JSON.stringify(file)).ok).toBe(true);
  });

  it('exporta com identidade quando é backup pessoal', () => {
    expect(buildExportFile(emptyStore(), 'c'.repeat(32)).userHash).toBe('c'.repeat(32));
  });
});

// A rota de favorito é um TOGGLE, não um delete. Uma remoção que ficou só local precisa
// ser lembrada, senão o pull seguinte traz a música de volta e o usuário vê a cifra
// ressuscitar sozinha.
describe('remoções pendentes', () => {
  it('a estante nasce sem nenhuma pendência', () => {
    expect(emptyStore().pendingRemovals).toEqual([]);
  });

  it('aceita estante antiga, gravada antes do campo existir', () => {
    const antiga = JSON.stringify({ version: 1, categories: [], entries: [] });
    const parsed = favoritesStoreSchema.safeParse(JSON.parse(antiga));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.pendingRemovals).toEqual([]);
  });

  it('descarta pendências que não são lista de string', () => {
    const parsed = favoritesStoreSchema.safeParse({ version: 1, categories: [], entries: [], pendingRemovals: 'nao' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.pendingRemovals).toEqual([]);
  });
});

describe('prettifySlug', () => {
  it('vira nome legível', () => {
    expect(prettifySlug('joao-bosco')).toBe('Joao Bosco');
    expect(prettifySlug('almir-sater')).toBe('Almir Sater');
  });
});

// ── Tom guardado ───────────────────────────────────────────────────────────
//
// O tom é escolha da PESSOA e não da cifra: o mesmo arquivo serve a quem canta em Sol e a
// quem canta em Si. Por isso ele mora na estante local, e não no servidor.
describe('setEntryTom', () => {
  it('grava o tom e o tom original da entrada', () => {
    const store = addEntry(emptyStore(), entry('joao-bosco', 'incelenca'));
    const next = setEntryTom(store, 'joao-bosco/incelenca', 3, 'Am');
    expect(next.entries[0]).toMatchObject({ transpose: 3, originalKey: 'Am' });
  });

  it('não apaga um tom original já conhecido quando a cifra não o detecta', () => {
    const store = addEntry(emptyStore(), entry('joao-bosco', 'incelenca', { originalKey: 'Am' }));
    const next = setEntryTom(store, 'joao-bosco/incelenca', 2, null);
    expect(next.entries[0].originalKey).toBe('Am');
  });

  it('não mexe nas outras entradas', () => {
    let store = addEntry(emptyStore(), entry('a', 'um'));
    store = addEntry(store, entry('b', 'dois'));
    const next = setEntryTom(store, 'a/um', 5, 'G');
    expect(next.entries.find(e => e.artistSlug === 'b')?.transpose).toBe(0);
  });
});

describe('tom na entrada', () => {
  it('entrada gravada antes do campo existir vale como tom original', () => {
    const antiga = {
      version: 1, categories: [], entries: [
        { artistSlug: 'a', songSlug: 'um', title: 'Um', artistName: null, versionName: null, categoryIds: [], addedAt: 'x' },
      ],
    };
    const parsed = favoritesStoreSchema.safeParse(antiga);
    expect(parsed.data?.entries[0]).toMatchObject({ transpose: 0, originalKey: null });
  });

  // `transposeChordString` soma o deslocamento a +120 antes do módulo 12; um valor absurdo
  // vindo de arquivo forjado sairia do outro lado como nota errada em vez de erro.
  it('descarta deslocamento fora da faixa em vez de propagá-lo', () => {
    const parsed = favoritesStoreSchema.safeParse({
      version: 1, categories: [], entries: [
        { artistSlug: 'a', songSlug: 'um', title: 'Um', artistName: null, versionName: null, categoryIds: [], addedAt: 'x', transpose: -9999 },
      ],
    });
    expect(parsed.data?.entries[0].transpose).toBe(0);
  });

  it('refavoritar guarda o tom de agora, mas preserva categorias e data', () => {
    const store = addEntry(emptyStore(), entry('a', 'um', { transpose: 2, categoryIds: ['c1'], addedAt: '2020-01-01T00:00:00.000Z' }));
    const next = addEntry(store, entry('a', 'um', { transpose: -3, originalKey: 'D', addedAt: '2026-01-01T00:00:00.000Z' }));
    expect(next.entries[0]).toMatchObject({
      transpose: -3, originalKey: 'D', categoryIds: ['c1'], addedAt: '2020-01-01T00:00:00.000Z',
    });
  });

  it('importar não troca o tom de uma música que já estava na estante', () => {
    const store = addEntry(emptyStore(), entry('a', 'um', { transpose: 2, originalKey: 'G' }));
    const file = buildExportFile(addEntry(emptyStore(), entry('a', 'um', { transpose: -4, originalKey: 'G' })), null);
    expect(mergeImported(store, file).entries[0].transpose).toBe(2);
  });

  it('importar traz o tom de uma música nova', () => {
    const file = buildExportFile(addEntry(emptyStore(), entry('a', 'um', { transpose: -4, originalKey: 'G' })), null);
    expect(mergeImported(emptyStore(), file).entries[0].transpose).toBe(-4);
  });
});

// Compartilhar uma gaveta não pode entregar junto a lista completa de gavetas de quem
// compartilhou: a organização de alguém diz mais sobre a pessoa do que o repertório.
describe('subsetStore', () => {
  it('leva só as categorias usadas pelas entradas escolhidas', () => {
    const comRoda = createCategory(emptyStore(), 'Roda');
    const comEstudo = createCategory(comRoda.store, 'Estudar');
    let store = addEntry(comEstudo.store, entry('a', 'um', { categoryIds: [comRoda.category.id] }));
    store = addEntry(store, entry('b', 'dois', { categoryIds: [comEstudo.category.id] }));

    const so = store.entries.filter(e => e.artistSlug === 'a');
    expect(subsetStore(store, so).categories.map(c => c.name)).toEqual(['Roda']);
    expect(subsetStore(store, so).entries).toHaveLength(1);
  });

  it('não leva remoções pendentes de quem compartilha', () => {
    const store = { ...addEntry(emptyStore(), entry('a', 'um')), pendingRemovals: ['x/y'] };
    expect(subsetStore(store, store.entries).pendingRemovals).toEqual([]);
  });
});

describe('nome da lista no arquivo', () => {
  it('só aparece quando existe', () => {
    expect(buildExportFile(emptyStore(), null).listName).toBeUndefined();
    expect(buildExportFile(emptyStore(), null, '  ').listName).toBeUndefined();
    expect(buildExportFile(emptyStore(), null, ' Roda de terça ').listName).toBe('Roda de terça');
  });

  it('corta no mesmo teto de nome de categoria', () => {
    expect(buildExportFile(emptyStore(), null, 'x'.repeat(200)).listName).toHaveLength(60);
  });
});

// ── Listas que chegaram por link ───────────────────────────────────────────
//
// A regra que importa: descartar um pacote que veio de fora nunca pode levar junto um
// favorito que a pessoa escolheu sozinha. A marca `fromLink` é o que separa os dois.
describe('lista importada', () => {
  const arquivoCom = (...entradas: FavoriteEntry[]) => {
    let s = emptyStore();
    const cat = createCategory(s, 'Roda de terça');
    s = cat.store;
    for (const e of entradas) s = addEntry(s, { ...e, categoryIds: [cat.category.id] });
    return buildExportFile(s, null, 'Roda de terça');
  };

  it('marca a gaveta e as cifras que ela trouxe', () => {
    const store = mergeImported(emptyStore(), arquivoCom(entry('a', 'um')), { viaLink: true });
    expect(isImportedList(store.categories[0])).toBe(true);
    expect(store.entries[0].fromLink).toBe(true);
  });

  it('importar por ARQUIVO não marca nada — é backup, não pacote de outra pessoa', () => {
    const store = mergeImported(emptyStore(), arquivoCom(entry('a', 'um')));
    expect(isImportedList(store.categories[0])).toBe(false);
    expect(store.entries[0].fromLink).toBeUndefined();
  });

  it('não marca uma gaveta que o usuário já tinha', () => {
    const minha = createCategory(emptyStore(), 'Roda de terça');
    const store = mergeImported(minha.store, arquivoCom(entry('a', 'um')), { viaLink: true });
    expect(store.categories).toHaveLength(1);
    expect(isImportedList(store.categories[0])).toBe(false);
  });

  it('descartar leva as cifras que só vieram no pacote', () => {
    const store = mergeImported(emptyStore(), arquivoCom(entry('a', 'um'), entry('b', 'dois')), { viaLink: true });
    const catId = store.categories[0].id;
    expect(planoDeDescarteDaLista(store, catId)).toEqual({ removidas: 2, mantidas: 0 });

    const depois = deleteImportedList(store, catId);
    expect(depois.entries).toHaveLength(0);
    expect(depois.categories).toHaveLength(0);
  });

  // O caso que o mantenedor pediu para proteger, nas duas formas em que ele aparece.
  it('NÃO desfavorita o que já era do usuário antes do link', () => {
    const minha = addEntry(emptyStore(), entry('a', 'um', { transpose: 4 }));
    const store = mergeImported(minha, arquivoCom(entry('a', 'um'), entry('b', 'dois')), { viaLink: true });
    const catId = store.categories[0].id;
    expect(planoDeDescarteDaLista(store, catId)).toEqual({ removidas: 1, mantidas: 1 });

    const depois = deleteImportedList(store, catId);
    expect(depois.entries.map(e => e.artistSlug)).toEqual(['a']);
    expect(depois.entries[0].categoryIds).toEqual([]);
    expect(depois.entries[0].transpose).toBe(4);
  });

  it('NÃO desfavorita o que o usuário guardou numa categoria dele', () => {
    let store = mergeImported(emptyStore(), arquivoCom(entry('a', 'um')), { viaLink: true });
    const catId = store.categories[0].id;
    const minha = createCategory(store, 'Estudar');
    store = toggleEntryCategory(minha.store, 'a/um', minha.category.id);

    expect(planoDeDescarteDaLista(store, catId)).toEqual({ removidas: 0, mantidas: 1 });
    const depois = deleteImportedList(store, catId);
    expect(depois.entries).toHaveLength(1);
    expect(depois.entries[0].categoryIds).toEqual([minha.category.id]);
  });

  it('registra a pendência do que saiu, para o servidor não trazer de volta', () => {
    const store = mergeImported(emptyStore(), arquivoCom(entry('a', 'um')), { viaLink: true });
    expect(deleteImportedList(store, store.categories[0].id).pendingRemovals).toEqual(['a/um']);
  });
});

// A rota do servidor é um toggle, não um delete: o que sai só do localStorage volta no
// próximo sync. Era o que acontecia ao remover pelo coração da lista de /favoritos.
describe('removeEntry registra a remoção', () => {
  it('deixa a chave na fila de pendências', () => {
    const store = addEntry(emptyStore(), entry('a', 'um'));
    expect(removeEntry(store, 'a', 'um').pendingRemovals).toEqual(['a/um']);
  });

  it('não inventa pendência para o que não estava lá', () => {
    expect(removeEntry(emptyStore(), 'a', 'um').pendingRemovals).toEqual([]);
  });

  it('não duplica ao remover duas vezes', () => {
    let store = addEntry(emptyStore(), entry('a', 'um'));
    store = removeEntry(store, 'a', 'um');
    expect(removeEntry(store, 'a', 'um').pendingRemovals).toEqual(['a/um']);
  });
});

// ── Ordem manual ───────────────────────────────────────────────────────────
describe('ordem manual da gaveta', () => {
  const tres = () => [entry('a', 'um'), entry('b', 'dois'), entry('c', 'tres')];

  it('ordena pelas chaves guardadas', () => {
    expect(sortByOrder(tres(), ['c/tres', 'a/um', 'b/dois']).map(entryKey))
      .toEqual(['c/tres', 'a/um', 'b/dois']);
  });

  it('o que a ordem não menciona vai para o fim, sem embaralhar', () => {
    expect(sortByOrder(tres(), ['c/tres']).map(entryKey)).toEqual(['c/tres', 'a/um', 'b/dois']);
  });

  it('chave de cifra que já saiu é ignorada', () => {
    expect(sortByOrder(tres(), ['x/sumiu', 'b/dois']).map(entryKey))
      .toEqual(['b/dois', 'a/um', 'c/tres']);
  });

  it('sem ordem guardada, devolve a lista como veio', () => {
    const entradas = tres();
    expect(sortByOrder(entradas, undefined)).toBe(entradas);
  });

  it('a ordem é da gaveta, não da estante', () => {
    const cat = createCategory(emptyStore(), 'Show');
    const store = setCategoryOrder(cat.store, cat.category.id, ['b/dois', 'a/um']);
    expect(store.categories[0].order).toEqual(['b/dois', 'a/um']);
    expect(setCategoryOrder(store, 'outra', ['x']).categories[0].order).toEqual(['b/dois', 'a/um']);
  });
});

describe('moveKey', () => {
  const k = ['a', 'b', 'c', 'd'];

  it('move para cima e para baixo', () => {
    expect(moveKey(k, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveKey(k, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('prende o destino nas pontas', () => {
    expect(moveKey(k, 'a', -5)).toEqual(k);
    expect(moveKey(k, 'a', 99)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('devolve a mesma lista quando não há o que fazer', () => {
    expect(moveKey(k, 'a', 0)).toBe(k);
    expect(moveKey(k, 'inexistente', 1)).toBe(k);
  });
});

// A gaveta que veio de um link para MIM não é um link para quem eu mando: quem receber é
// que decide o que ela é do lado de lá.
describe('subsetStore e a marca de origem', () => {
  it('não repassa `source` no que vai ser compartilhado', () => {
    const store = mergeImported(
      emptyStore(),
      buildExportFile(addEntry(createCategory(emptyStore(), 'Roda').store, entry('a', 'um')), null),
      { viaLink: true }
    );
    const comEtiqueta = {
      ...store,
      entries: store.entries.map(e => ({ ...e, categoryIds: [store.categories[0].id] })),
    };
    expect(subsetStore(comEtiqueta, comEtiqueta.entries).categories[0].source).toBeUndefined();
  });
});

// ── Etiqueta repetida ──────────────────────────────────────────────────────
//
// Defeito relatado: uma lista importada mostrava 27 na barra lateral tendo 14 cifras, e a
// etiqueta aparecia duas vezes em cada linha. A conta denuncia a causa — 13 entradas
// contadas em dobro mais 1 contada certo. A que estava certa era a única que já existia na
// estante, e passava pelo ramo `known` do merge, que deduplicava; as novas, não.
//
// A montante, quem criava a duplicata era a gaveta de destino sugerida: o nome sugerido é
// o da própria lista, então `comCategoriaDeEntrada` acrescentava uma SEGUNDA "Ariela" ao
// lado da que a lista já trazia, e as duas convergiam para o mesmo id local.
describe('categoria não se repete numa entrada', () => {
  const arquivoDaLista = (nomeDaGaveta: string, n: number) => {
    let s = emptyStore();
    const cat = createCategory(s, nomeDaGaveta);
    s = cat.store;
    for (let i = 0; i < n; i++) {
      s = addEntry(s, entry(`artista-${i}`, `musica-${i}`, { categoryIds: [cat.category.id] }));
    }
    return buildExportFile(s, null, nomeDaGaveta);
  };

  it('importar com gaveta de destino de mesmo nome não duplica a etiqueta', () => {
    const file = comCategoriaDeEntrada(arquivoDaLista('Ariela', 3), 'Ariela');
    const store = mergeImported(emptyStore(), file, { viaLink: true });

    expect(store.categories).toHaveLength(1);
    for (const e of store.entries) expect(e.categoryIds).toHaveLength(1);
    expect(countByCategory(store)[store.categories[0].id]).toBe(3);
  });

  // O número exato do relato: 14 cifras, uma delas já na estante.
  it('a contagem bate com o número de cifras, não com o dobro', () => {
    const file = comCategoriaDeEntrada(arquivoDaLista('Ariela', 14), 'Ariela');
    const jaTinha = addEntry(emptyStore(), entry('artista-0', 'musica-0'));
    const store = mergeImported(jaTinha, file, { viaLink: true });

    expect(store.entries).toHaveLength(14);
    expect(countByCategory(store)[store.categories[0].id]).toBe(14);
  });

  it('uma gaveta de destino com nome NOVO continua sendo criada', () => {
    const file = comCategoriaDeEntrada(arquivoDaLista('Ariela', 2), 'Show do sítio');
    expect(file.categories.map(c => c.name).sort()).toEqual(['Ariela', 'Show do sítio']);
    const store = mergeImported(emptyStore(), file, { viaLink: true });
    for (const e of store.entries) expect(e.categoryIds).toHaveLength(2);
  });

  it('nome que só difere em acento e caixa conta como a mesma gaveta', () => {
    const file = comCategoriaDeEntrada(arquivoDaLista('Roda de terça', 2), 'RODA DE TERCA');
    expect(file.categories).toHaveLength(1);
  });

  // Duas categorias de mesmo nome dentro do arquivo (possível num arquivo editado à mão)
  // convergem para o mesmo id local; sem deduplicar no merge, a etiqueta entra em dobro.
  it('duas gavetas de mesmo nome no arquivo viram uma etiqueta só', () => {
    const bruto = arquivoDaLista('Ariela', 2);
    const forjado: typeof bruto = {
      ...bruto,
      categories: [...bruto.categories, { id: 'outra', name: 'ariela', createdAt: 'x' }],
      entries: bruto.entries.map(e => ({ ...e, categoryIds: [...e.categoryIds, 'outra'] })),
    };
    const store = mergeImported(emptyStore(), forjado);

    expect(store.categories).toHaveLength(1);
    for (const e of store.entries) expect(e.categoryIds).toHaveLength(1);
  });
});

/**
 * Reparo do que já está gravado.
 *
 * Quem importou antes da correção tem a estante com ids repetidos no localStorage. Como o
 * conserto é na LEITURA do schema, ela se corrige sozinha na próxima abertura da página —
 * sem exigir que a pessoa reimporte ou apague nada.
 */
describe('estante já danificada se conserta na leitura', () => {
  it('descarta o id repetido ao carregar', () => {
    const danificada = {
      version: 1, pendingRemovals: [],
      categories: [{ id: 'c1', name: 'Ariela', createdAt: 'x' }],
      entries: [{
        artistSlug: 'a', songSlug: 'um', title: 'Um', artistName: null, versionName: null,
        categoryIds: ['c1', 'c1'], addedAt: 'x', transpose: 0, originalKey: null,
      }],
    };
    const parsed = favoritesStoreSchema.safeParse(danificada);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.entries[0].categoryIds).toEqual(['c1']);
    expect(countByCategory(parsed.data!)[('c1')]).toBe(1);
  });

  it('não mexe na ordem das etiquetas que estão certas', () => {
    const parsed = favoritesStoreSchema.safeParse({
      version: 1, pendingRemovals: [], categories: [],
      entries: [{
        artistSlug: 'a', songSlug: 'um', title: 'Um', artistName: null, versionName: null,
        categoryIds: ['c2', 'c1', 'c3'], addedAt: 'x', transpose: 0, originalKey: null,
      }],
    });
    expect(parsed.data?.entries[0].categoryIds).toEqual(['c2', 'c1', 'c3']);
  });
});
