import { describe, expect, it } from 'vitest';
import {
  buildSharedFile,
  buildShareUrl,
  decodeLista,
  encodeLista,
  readShareToken,
  comCategoriaDeEntrada,
  MAX_LINK_CHARS,
} from './favoritesShare';
import {
  addEntry,
  buildExportFile,
  createCategory,
  emptyStore,
  type FavoriteEntry,
  type FavoritesStore,
} from './cifraFavorites';

const entry = (songSlug: string, over: Partial<FavoriteEntry> = {}): FavoriteEntry => ({
  artistSlug: 'joao-bosco',
  songSlug,
  title: songSlug,
  artistName: 'João Bosco',
  versionName: null,
  categoryIds: [],
  addedAt: '2026-01-01T00:00:00.000Z',
  transpose: 0,
  originalKey: 'Am',
  ...over,
});

const estanteCom = (n: number): FavoritesStore => {
  let store = emptyStore();
  for (let i = 0; i < n; i++) {
    store = addEntry(store, entry(`musica-numero-${i}`, { title: `Música Número ${i}` }));
  }
  return store;
};

describe('encodeLista / decodeLista', () => {
  it('devolve a mesma lista do outro lado', async () => {
    const store = estanteCom(3);
    const token = await encodeLista(buildSharedFile(store, store.entries));
    const result = await decodeLista(token);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.entries.map(e => e.songSlug)).toEqual(store.entries.map(e => e.songSlug));
  });

  it('leva o tom escolhido junto', async () => {
    const store = addEntry(emptyStore(), entry('incelenca', { transpose: 3, originalKey: 'G' }));
    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.entries[0]).toMatchObject({ transpose: 3, originalKey: 'G' });
  });

  // O ponto sensível do módulo: um link é reencaminhado sem pensar, e o `userHash` é o que
  // faz de um backup uma senha. Ele não pode sair no link nem entrar por ele.
  describe('identidade', () => {
    it('não sai no token', async () => {
      const store = estanteCom(1);
      const token = await encodeLista(buildSharedFile(store, store.entries));
      const result = await decodeLista(token);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.userHash).toBeUndefined();
    });

    it('é descartada mesmo quando o link foi forjado com ela dentro', async () => {
      const store = estanteCom(1);
      const forjado = { ...buildExportFile(store, 'hash-de-outra-pessoa') };
      const result = await decodeLista(await encodeLista(forjado));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.userHash).toBeUndefined();
      expect(result.file.entries).toHaveLength(1);
    });
  });

  it('só leva as categorias que as músicas compartilhadas usam', async () => {
    const comRoda = createCategory(emptyStore(), 'Roda de viola');
    const comEstudo = createCategory(comRoda.store, 'Estudar');
    const store = addEntry(comEstudo.store, entry('incelenca', { categoryIds: [comRoda.category.id] }));

    const file = buildSharedFile(store, store.entries);

    expect(file.categories.map(c => c.name)).toEqual(['Roda de viola']);
  });
});

describe('decodeLista com entrada hostil', () => {
  it('recusa token com caractere fora do alfabeto', async () => {
    expect(await decodeLista('1não-é-base64')).toMatchObject({ ok: false });
  });

  it('recusa token sem marcador de codificação', async () => {
    expect(await decodeLista('QQ')).toMatchObject({ ok: false });
  });

  it('recusa token acima do teto sem tentar decodificar', async () => {
    const gigante = '1' + 'A'.repeat(MAX_LINK_CHARS);
    expect(await decodeLista(gigante)).toMatchObject({ ok: false });
  });

  it('recusa um JSON válido que não é lista de favoritos', async () => {
    const token = await encodeLista(JSON.parse('{"app":"outro-app","kind":"favoritos","version":1,"exportedAt":"x","categories":[],"entries":[]}'));
    expect(await decodeLista(token)).toMatchObject({ ok: false });
  });

  it('recusa lista vazia — não há o que adicionar', async () => {
    const token = await encodeLista(buildSharedFile(emptyStore(), []));
    expect(await decodeLista(token)).toMatchObject({ ok: false });
  });

  /**
   * Zip bomb: 4 MB de zeros comprimem para poucos KB. Sem o corte durante a leitura, o
   * clique num link assim alocaria o balão inteiro antes de qualquer validação.
   */
  it('não descomprime além do teto de tamanho', async () => {
    const zeros = new Uint8Array(5 * 1024 * 1024);
    const comprimido = await new Response(
      new Response(zeros as BufferSource).body!.pipeThrough(new CompressionStream('deflate-raw'))
    ).arrayBuffer();
    const bytes = new Uint8Array(comprimido);
    let binario = '';
    for (const b of bytes) binario += String.fromCharCode(b);
    const token = '1' + btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    expect(token.length).toBeLessThan(MAX_LINK_CHARS);
    expect(await decodeLista(token)).toMatchObject({ ok: false });
  });
});

describe('readShareToken', () => {
  it('acha o token no fragmento', () => {
    expect(readShareToken('#lista=1AAA')).toBe('1AAA');
    expect(readShareToken('lista=1AAA')).toBe('1AAA');
  });

  it('devolve null quando não há lista no fragmento', () => {
    expect(readShareToken('')).toBeNull();
    expect(readShareToken('#')).toBeNull();
    expect(readShareToken('#outra-coisa')).toBeNull();
    expect(readShareToken('#lista=')).toBeNull();
  });

  it('sobrevive à ida e volta pela URL montada', () => {
    const url = buildShareUrl('1AbC-_dEf', 'https://www.violalibre.com.br');
    expect(readShareToken(new URL(url).hash)).toBe('1AbC-_dEf');
  });
});

/**
 * O link não tem servidor por trás (ver o cabeçalho de `favoritesShare.ts`), então o
 * tamanho é o limite real do recurso. Este teste existe para que uma mudança de formato
 * que dobre o peso apareça aqui, e não na tela de alguém tentando mandar a lista.
 */
describe('tamanho do link', () => {
  it('cabe no teto com uma estante grande', async () => {
    const store = estanteCom(200);
    const token = await encodeLista(buildSharedFile(store, store.entries));
    expect(token.length).toBeLessThan(MAX_LINK_CHARS);
  });
});

describe('nome da lista', () => {
  it('viaja no link e chega do outro lado', async () => {
    const store = estanteCom(2);
    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries, 'Roda de terça')));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.listName).toBe('Roda de terça');
  });

  it('não vai quando não foi dado', async () => {
    const store = estanteCom(1);
    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries, '   ')));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.listName).toBeUndefined();
  });

  it('um nome absurdo no link não derruba a lista inteira', async () => {
    const store = estanteCom(1);
    const forjado = { ...buildSharedFile(store, store.entries), listName: 'x'.repeat(5000) };
    const result = await decodeLista(await encodeLista(forjado));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.listName).toBeUndefined();
    expect(result.file.entries).toHaveLength(1);
  });
});

/**
 * Sem isto o nome da lista morreria na tela de confirmação: as músicas cairiam soltas no
 * meio de uma estante que já tem centenas, e "Roda de terça" não teria deixado marca.
 */
describe('comCategoriaDeEntrada', () => {
  it('põe todas as músicas na gaveta nova', () => {
    const store = estanteCom(3);
    const file = comCategoriaDeEntrada(buildSharedFile(store, store.entries), 'Roda de terça');

    expect(file.categories.map(c => c.name)).toContain('Roda de terça');
    const id = file.categories.find(c => c.name === 'Roda de terça')!.id;
    expect(file.entries.every(e => e.categoryIds.includes(id))).toBe(true);
  });

  it('não mexe em nada quando o nome é vazio', () => {
    const file = buildSharedFile(estanteCom(1), estanteCom(1).entries);
    expect(comCategoriaDeEntrada(file, '   ')).toBe(file);
  });

  it('mantém as etiquetas que a lista já trazia', () => {
    const comRoda = createCategory(emptyStore(), 'Roda');
    const store = addEntry(comRoda.store, entry('incelenca', { categoryIds: [comRoda.category.id] }));
    const file = comCategoriaDeEntrada(buildSharedFile(store, store.entries), 'Do amigo');

    expect(file.entries[0].categoryIds).toHaveLength(2);
  });
});
