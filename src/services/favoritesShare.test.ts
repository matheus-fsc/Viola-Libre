import { describe, expect, it } from 'vitest';
import {
  buildSharedFile,
  buildShareUrl,
  decodeLista,
  encodeLista,
  readShareToken,
  comCategoriaDeEntrada,
  AVISO_LINK_CHARS,
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

// ── Formato de fio ─────────────────────────────────────────────────────────
//
// O link carrega a lista inteira, então o comprimento é o recurso escasso. Estes testes
// guardam as três propriedades que o formato em colunas precisa ter: ele encolhe, ele
// sobrevive à ida e volta com dados reais, e ele não deixa de ler o formato anterior.
describe('formato em colunas', () => {
  const RS = '\u001e';
  const US = '\u001f';

  /** O mesmo empacotamento que a versão anterior fazia, para os testes de compatibilidade. */
  const tokenDe = async (texto: string): Promise<string> => {
    const bytes = new TextEncoder().encode(texto);
    const gz = await new Response(
      new Response(bytes as BufferSource).body!.pipeThrough(new CompressionStream('deflate-raw'))
    ).arrayBuffer();
    let bin = '';
    for (const b of new Uint8Array(gz)) bin += String.fromCharCode(b);
    return '1' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const comRepeticao = (n: number): FavoritesStore => {
    let store = emptyStore();
    for (let i = 0; i < n; i++) {
      store = addEntry(store, entry(`cancao-${i}`, {
        // Artista repetido de propósito: é a repetição entre linhas que a coluna aproxima.
        artistSlug: ['tiao-carreiro-pardinho', 'almir-sater', 'sergio-reis'][i % 3],
        artistName: ['Tião Carreiro e Pardinho', 'Almir Sater', 'Sérgio Reis'][i % 3],
        title: `Canção Número ${i}`,
        transpose: (i % 11) - 5,
      }));
    }
    return store;
  };

  it('preserva tudo que a tela precisa, campo a campo', async () => {
    const store = addEntry(emptyStore(), entry('cio-da-terra', {
      title: 'Cio da Terra',
      artistName: 'Pena Branca e Xavantinho',
      versionName: 'Simplificada',
      transpose: -4,
      originalKey: 'Em',
    }));
    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries, 'Roda')));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.entries[0]).toMatchObject({
      artistSlug: 'joao-bosco',
      songSlug: 'cio-da-terra',
      title: 'Cio da Terra',
      artistName: 'Pena Branca e Xavantinho',
      versionName: 'Simplificada',
      transpose: -4,
      originalKey: 'Em',
    });
  });

  it('mantém cada cifra na sua gaveta', async () => {
    const a = createCategory(emptyStore(), 'Roda de terça');
    const b = createCategory(a.store, 'Estudar');
    let store = addEntry(b.store, entry('uma', { categoryIds: [a.category.id] }));
    store = addEntry(store, entry('outra', { categoryIds: [b.category.id, a.category.id] }));

    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const nomesDe = (e: { categoryIds: string[] }) =>
      e.categoryIds.map(id => result.file.categories.find(c => c.id === id)?.name).sort();
    expect(nomesDe(result.file.entries.find(e => e.songSlug === 'uma')!)).toEqual(['Roda de terça']);
    expect(nomesDe(result.file.entries.find(e => e.songSlug === 'outra')!)).toEqual(['Estudar', 'Roda de terça']);
  });

  // O ganho medido que justificou o formato. Se alguém voltar a mandar o JSON do backup,
  // ou acrescentar um campo caro, é aqui que aparece — não na tela de quem tenta mandar.
  it('cem músicas ainda cabem no limite dos mensageiros', async () => {
    const store = comRepeticao(100);
    const token = await encodeLista(buildSharedFile(store, store.entries, 'Roda de terça'));
    expect(token.length + 45).toBeLessThan(AVISO_LINK_CHARS);
  });

  it('um repertório de show inteiro dá um link curto', async () => {
    const store = comRepeticao(40);
    const token = await encodeLista(buildSharedFile(store, store.entries, 'Show do sítio'));
    expect(token.length + 45).toBeLessThan(1000);
  });

  // Um link já compartilhado não pode parar de abrir porque o formato melhorou depois.
  it('ainda lê o formato JSON anterior', async () => {
    const store = addEntry(emptyStore(), entry('incelenca', { transpose: 2, originalKey: 'G' }));
    const token = await tokenDe(JSON.stringify(buildExportFile(store, null, 'Lista antiga')));

    const result = await decodeLista(token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.entries[0]).toMatchObject({ songSlug: 'incelenca', transpose: 2 });
    expect(result.file.listName).toBe('Lista antiga');
  });

  /**
   * Uma tira mais curta que as outras significa token cortado no caminho — o caso que o
   * WhatsApp provoca. Sem a conferência de comprimento, o tom de uma música apareceria
   * como título de outra e a lista chegaria embaralhada, em silêncio.
   */
  it('recusa um token com coluna truncada em vez de embaralhar', async () => {
    const truncado = [
      '2' + US + 'Roda',
      '',
      ['a', 'b', 'c', 'd'].join(US),
      ['um', 'dois', 'tres', 'quatro'].join(US),
      ['Um', 'Dois', 'Tres'].join(US), // uma a menos
      '',
      '',
      ['0', '0', '0', '0'].join(US),
      ['G', 'G', 'G', 'G'].join(US),
      '',
    ].join(RS);

    expect(await decodeLista(await tokenDe(truncado))).toMatchObject({ ok: false });
  });

  // Os separadores são caracteres de controle e não ocorrem em título de verdade, mas o
  // dado vem do servidor: um deles escapando deslocaria uma coluna inteira na volta.
  it('não deixa um título com caractere de controle deslocar as colunas', async () => {
    const store = addEntry(emptyStore(), entry('suspeita', {
      title: `Titulo${US}com${RS}separador`,
      transpose: 3,
    }));
    const result = await decodeLista(await encodeLista(buildSharedFile(store, store.entries)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.entries).toHaveLength(1);
    expect(result.file.entries[0].transpose).toBe(3);
    expect(result.file.entries[0].title).toBe('Titulo com separador');
  });
});
