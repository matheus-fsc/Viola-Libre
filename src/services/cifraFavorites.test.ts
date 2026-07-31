import { describe, expect, it } from 'vitest';
import {
  addEntry,
  buildExportFile,
  countByCategory,
  createCategory,
  deleteCategory,
  emptyStore,
  favoriteKey,
  isFavorited,
  mergeImported,
  mergeServerList,
  normalizeCategoryName,
  parseImportedFile,
  prettifySlug,
  removeEntry,
  toggleEntryCategory,
  uncategorizedCount,
  MAX_CATEGORIES,
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  type FavoriteEntry,
  type FavoritesStore,
} from './cifraFavorites';
import type { GlobalSearchResult } from './api';

const entry = (artistSlug: string, songSlug: string, over: Partial<FavoriteEntry> = {}): FavoriteEntry => ({
  artistSlug,
  songSlug,
  title: songSlug,
  artistName: null,
  versionName: null,
  categoryIds: [],
  addedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const song = (over: Partial<GlobalSearchResult> = {}): GlobalSearchResult => ({
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
    const cheia: FavoritesStore = { version: 1, categories: [], entries: muitasEntradas(MAX_ENTRIES) };
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

describe('prettifySlug', () => {
  it('vira nome legível', () => {
    expect(prettifySlug('joao-bosco')).toBe('Joao Bosco');
    expect(prettifySlug('almir-sater')).toBe('Almir Sater');
  });
});
