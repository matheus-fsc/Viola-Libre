/*
 * Compartilhar a estante por LINK.
 *
 * Até aqui a única forma de passar favoritos adiante era baixar o .json e mandar o arquivo
 * — que funciona, mas ninguém manda anexo no WhatsApp para dizer "toca essas dez". Um link
 * é o gesto natural, e é o que este módulo produz.
 *
 * Três decisões moldam o formato:
 *
 * 1. A LISTA VIAJA NO FRAGMENTO (`/favoritos#lista=…`), nunca no caminho ou na query.
 *    O que vem depois do `#` não é enviado ao servidor: não entra em log de acesso, não
 *    vaza pelo cabeçalho Referer para terceiros e não vira URL indexável. O site não tem
 *    login, mas a lista de músicas de alguém ainda é dado dessa pessoa.
 *
 * 2. NÃO EXISTE LINK CURTO, porque não existe servidor para guardá-lo. A estante é do
 *    navegador (ver `cifraFavorites.ts`) e o backend só espelha a lista simples de uma
 *    identidade — não há onde depositar "a lista que fulano montou para ciclano". O link
 *    carrega a lista inteira comprimida, e o preço é o comprimento.
 *
 * 3. A IDENTIDADE NUNCA VAI JUNTO. O `userHash` transforma um backup em algo tão sensível
 *    quanto uma senha (quem importa VIRA o usuário), e um link é a coisa mais reencaminhada
 *    do mundo. Aqui ele não é omitido por descuido possível: é removido na saída E na
 *    entrada, para que nem um link forjado à mão consiga oferecer identidade a quem clica.
 *
 * 4. O QUE VIAJA NÃO É O ARQUIVO DE BACKUP. O formato do link é próprio, em colunas, e
 *    existe porque o comprimento é o único recurso escasso aqui — ver `serializar`.
 */

import {
  buildExportFile,
  favoritesFileSchema,
  subsetStore,
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  type FavoriteEntry,
  type FavoritesFile,
  type FavoritesStore,
} from './cifraFavorites';

/** Chave do fragmento: `#lista=<token>`. */
export const SHARE_HASH_KEY = 'lista';

/**
 * Acima disto o link ainda abre, mas começa a passar mal no caminho: mensageiro que corta
 * a pré-visualização, e-mail que quebra a linha no meio, campo de bio que trunca. Vira
 * aviso, não impedimento — quem quiser mandar assim, manda.
 */
export const AVISO_LINK_CHARS = 2000;

/**
 * Teto duro. Um link maior que isto não é mais um link, é um arquivo com aparência de
 * link — e para arquivo já existe o botão de exportar, que não tem limite nenhum.
 */
export const MAX_LINK_CHARS = 8000;

/**
 * Marcador de um caractere na frente do token, dizendo como ele foi codificado.
 *
 * `CompressionStream` só chegou ao Safari no 16.4, e parte do público abre o site em
 * iPhone velho. Sem o marcador, o único jeito de saber se os bytes estão comprimidos seria
 * tentar descomprimir e ver se explode — o que confunde "navegador antigo" com "link
 * corrompido" na hora de escrever a mensagem de erro.
 */
const FLAG_DEFLATE = '1';
const FLAG_PLANO = '0';

const ALGORITMO = 'deflate-raw';

// ---------------------------------------------------------------------------
// Base64 seguro para URL
// ---------------------------------------------------------------------------

// Em blocos porque `String.fromCharCode(...bytes)` estoura a pilha de argumentos por volta
// de 100 mil itens — e uma lista grande, antes de comprimir, passa disso com folga.
const BLOCO = 0x8000;

function toBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(texto: string): Uint8Array | null {
  // Alfabeto fechado: qualquer outro caractere significa link truncado ou colado com
  // sujeira em volta, e é melhor dizer isso do que decodificar lixo pela metade.
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Compressão
// ---------------------------------------------------------------------------

const temCompressao = (): boolean => typeof CompressionStream !== 'undefined';
const temDescompressao = (): boolean => typeof DecompressionStream !== 'undefined';

async function lerTudo(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      // Corta DURANTE a leitura, não depois. Um token de 8 KB de zeros comprimidos
      // descomprime para centenas de MB — esperar o fim para conferir o tamanho já seria
      // ter travado a aba de quem clicou no link.
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      pedacos.push(value);
    }
  } catch {
    return null; // bytes que não são deflate válido
  }

  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of pedacos) { saida.set(p, pos); pos += p.length; }
  return saida;
}

async function comprimir(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (!temCompressao()) return null;
  const stream = new Response(bytes as BufferSource).body;
  if (!stream) return null;
  return lerTudo(stream.pipeThrough(new CompressionStream(ALGORITMO)), MAX_FILE_BYTES);
}

async function descomprimir(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array | null> {
  if (!temDescompressao()) return null;
  const stream = new Response(bytes as BufferSource).body;
  if (!stream) return null;
  return lerTudo(stream.pipeThrough(new DecompressionStream(ALGORITMO)), maxBytes);
}

// ---------------------------------------------------------------------------
// O formato de fio
// ---------------------------------------------------------------------------
//
// O link não tem servidor por trás, então a lista inteira viaja dentro dele e o
// COMPRIMENTO é o único recurso escasso do recurso. Mandar o mesmo JSON do backup era o
// caminho óbvio — e era caro: chaves repetidas em cada entrada, ids de categoria de 14
// caracteres gerados por navegador, e uma data que ninguém lê na lista de outra pessoa.
//
// Três mudanças, medidas com repertório real (títulos acentuados, artistas repetidos),
// contando quantas músicas cabem nos 2.000 caracteres em que os mensageiros começam a
// cortar:
//
//   JSON do backup ......................  43 músicas
//   + tirar `addedAt`, categoria por índice
//     e delimitador em vez de JSON .......  96
//   + agrupar por COLUNA .................. 144
//
// A última é a que surpreende, e é a razão de o formato ser em colunas. O deflate acha
// repetição dentro de uma janela deslizante: com uma entrada por linha, dois "Tião
// Carreiro e Pardinho" ficam a centenas de bytes de distância e cada um paga o preço
// inteiro; empilhados na mesma tira, o segundo vira uma referência curta ao primeiro.
//
// O que NÃO foi adotado, e por quê: dá para chegar a 384 músicas mandando só
// `artista/musica` e deduzindo o título do slug. Mas aí a tela que mostra a lista antes de
// importar — a que torna seguro clicar num link de origem desconhecida — precisaria de uma
// ida ao servidor por música só para escrever os nomes, e o pouco que ela conseguiria
// offline seria "O Bebado E A Equilibrista", sem acento e com preposição maiúscula. O
// título é a coisa que a pessoa lê para decidir; ele fica.
//
// Acima do que cabe num link, a saída continua sendo o arquivo — ver a mensagem de erro
// em `encodeLista` e o botão "Exportar" na dashboard.

/** Separa as tiras (uma por campo). Caractere de controle: não ocorre em texto de verdade. */
const RS = '\u001e';
/** Separa os valores dentro de uma tira. */
const US = '\u001f';
/** Separa os índices de categoria de uma mesma cifra. */
const SUB = ',';

/** Marca a versão do formato de fio. O `1` implícito é o JSON antigo (ver `desserializar`). */
const FORMATO = '2';

/**
 * Texto que pode entrar numa tira sem quebrá-la.
 *
 * Os separadores são caracteres de controle e nenhum título de música os contém — mas o
 * dado vem do servidor, e um deles escapando aqui deslocaria uma coluna inteira na volta,
 * grudando o tom de uma música no título de outra.
 */
const limpar = (v: string | null | undefined): string =>
  (v ?? '').split(RS).join(' ').split(US).join(' ');

/**
 * O arquivo vira texto, em colunas.
 *
 * A ordem das tiras é a do tipo, e a contagem de entradas sai da primeira: todas as tiras
 * precisam ter o mesmo comprimento, e a volta recusa o token se não tiverem.
 */
function serializar(file: FavoritesFile): string {
  const cats = file.categories;
  const idParaIndice = new Map(cats.map((c, i) => [c.id, i]));
  const es = file.entries;
  const tira = (fn: (e: FavoriteEntry) => string) => es.map(fn).join(US);

  return [
    FORMATO + US + limpar(file.listName),
    cats.map(c => limpar(c.name)).join(US),
    tira(e => e.artistSlug),
    tira(e => e.songSlug),
    tira(e => limpar(e.title)),
    tira(e => limpar(e.artistName)),
    tira(e => limpar(e.versionName)),
    tira(e => String(e.transpose)),
    tira(e => limpar(e.originalKey)),
    // Índices, não ids: um id de categoria tem 14 caracteres gerados por navegador, é
    // ruído puro para o deflate, e do outro lado ele é remapeado por NOME de qualquer jeito.
    tira(e => e.categoryIds.map(id => idParaIndice.get(id)).filter(i => i !== undefined).join(SUB)),
  ].join(RS);
}

/**
 * Reconstrói o arquivo a partir do texto — ou `null` se ele não for um.
 *
 * Devolve a forma CRUA, sem confiar em nada: quem valida é o `favoritesFileSchema` no
 * `decodeLista`, o mesmo do import por arquivo. Aqui só se confere o que o schema não tem
 * como ver, que é a coerência entre as tiras.
 */
function desserializar(texto: string, maxEntradas: number): unknown | null {
  const linhas = texto.split(RS);
  const [marca, nome] = (linhas[0] ?? '').split(US);
  if (marca !== FORMATO) return null;

  // Quantas cifras há sai da tira de artistas, e só dela. `''.split(US)` devolve `['']`,
  // então uma tira vazia é ambígua: pode ser lista sem nada ou uma cifra de valor vazio.
  // Aqui o slug nunca é vazio (o schema o recusaria), então tira vazia é lista vazia.
  const artistas = linhas[2] ? linhas[2].split(US) : [];
  if (artistas.length === 0 || artistas.length > maxEntradas) return null;

  // As demais tiras já sabem quantos valores esperar, e aí a tira vazia tem o significado
  // oposto: são N campos em branco, não zero campos. Ler `versionName` (quase sempre nulo
  // em todas as cifras) pela regra da tira de artistas dava coluna de tamanho 0 e
  // derrubava a lista inteira.
  const coluna = (i: number): string[] => (linhas[i] ?? '').split(US);

  const colunas = [3, 4, 5, 6, 7, 8, 9].map(coluna);
  // Tira curta significa token truncado no caminho (ou forjado). Sem esta conferência, o
  // tom de uma música apareceria no lugar do título de outra.
  if (colunas.some(c => c.length !== artistas.length)) return null;
  const [slugs, titulos, nomesArtista, versoes, tons, tonsOriginais, cats] = colunas;

  const categorias = (linhas[1] ? linhas[1].split(US) : []).map((n, i) => ({
    id: `l${i}`,
    name: n,
    createdAt: new Date().toISOString(),
  }));

  return {
    app: 'viola-libre',
    kind: 'favoritos',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...(nome ? { listName: nome } : {}),
    categories: categorias,
    entries: artistas.map((artistSlug, i) => ({
      artistSlug,
      songSlug: slugs[i],
      title: titulos[i],
      artistName: nomesArtista[i] || null,
      versionName: versoes[i] || null,
      // `addedAt` não viaja: a data em que OUTRA pessoa favoritou a música não diz nada na
      // minha estante, e ordenar por "mais recentes" com a data dela seria mentira. O
      // schema carimba a de agora, que é quando a cifra de fato entrou aqui.
      transpose: Number(tons[i]),
      originalKey: tonsOriginais[i] || null,
      categoryIds: cats[i] ? cats[i].split(SUB).map(n => `l${n}`) : [],
    })),
  };
}

/**
 * Monta o arquivo que vai no link: as entradas escolhidas, só as categorias que elas usam,
 * o nome que quem compartilha deu à lista, e **sem identidade** (ver o cabeçalho).
 */
export function buildSharedFile(
  store: FavoritesStore,
  entries: FavoriteEntry[],
  listName?: string | null
): FavoritesFile {
  return buildExportFile(subsetStore(store, entries), null, listName);
}

/**
 * Enfia todas as músicas do arquivo numa gaveta com este nome.
 *
 * É o que dá sentido ao nome da lista do lado de quem recebe: sem isso, doze cifras de um
 * link cairiam soltas no meio de uma estante que já tem duzentas, e o rótulo "Roda de
 * terça" morreria na tela de confirmação.
 *
 * A gaveta entra como uma categoria a mais do arquivo; `mergeImported` casa categorias por
 * NOME, então quem já tem uma com esse nome não ganha uma segunda.
 */
export function comCategoriaDeEntrada(file: FavoritesFile, nome: string): FavoritesFile {
  const limpo = nome.trim().slice(0, 60);
  if (!limpo) return file;
  const id = `link_${Date.now().toString(36)}`;
  return {
    ...file,
    categories: [...file.categories, { id, name: limpo, createdAt: new Date().toISOString() }],
    entries: file.entries.map(e => ({ ...e, categoryIds: [...e.categoryIds, id] })),
  };
}

/** Serializa em colunas (ver `serializar`) e comprime. */
export async function encodeLista(file: FavoritesFile): Promise<string> {
  const bytes = new TextEncoder().encode(serializar(file));
  const comprimido = await comprimir(bytes);
  // O deflate quase sempre ganha, mas numa lista de uma música só o cabeçalho do próprio
  // formato pode custar mais do que ele economiza.
  return comprimido && comprimido.length < bytes.length
    ? FLAG_DEFLATE + toBase64Url(comprimido)
    : FLAG_PLANO + toBase64Url(bytes);
}

export type DecodeResult =
  | { ok: true; file: FavoritesFile }
  | { ok: false; error: string };

/**
 * Lê um token de link com a mesma desconfiança de um arquivo importado — porque é a mesma
 * coisa, só que ainda mais fácil de forjar: basta editar a barra de endereços.
 *
 * A validação de conteúdo é a do `favoritesFileSchema`, a mesma do import por arquivo, e
 * `userHash` é descartado antes dela. Assim o fluxo de link nem chega a ter uma pergunta
 * sobre identidade para o usuário responder errado.
 */
export async function decodeLista(token: string): Promise<DecodeResult> {
  if (!token) return { ok: false, error: 'O link não traz nenhuma lista.' };
  if (token.length > MAX_LINK_CHARS) {
    return { ok: false, error: 'O link é grande demais para ser uma lista de favoritos.' };
  }

  const flag = token[0];
  const corpo = fromBase64Url(token.slice(1));
  if (!corpo || (flag !== FLAG_DEFLATE && flag !== FLAG_PLANO)) {
    return { ok: false, error: 'O link parece incompleto ou foi cortado no caminho.' };
  }

  let bytes: Uint8Array | null = corpo;
  if (flag === FLAG_DEFLATE) {
    if (!temDescompressao()) {
      return { ok: false, error: 'Este navegador é antigo demais para abrir listas por link. Peça o arquivo .json.' };
    }
    bytes = await descomprimir(corpo, MAX_FILE_BYTES);
    if (!bytes) return { ok: false, error: 'O link parece incompleto ou foi cortado no caminho.' };
  }

  const texto = new TextDecoder().decode(bytes);

  // Colunas primeiro; JSON é o formato anterior, mantido em leitura porque um link já
  // compartilhado não deve parar de abrir só porque o formato melhorou depois.
  let json = desserializar(texto, MAX_ENTRIES);
  if (json === null) {
    try {
      json = JSON.parse(texto);
    } catch {
      return { ok: false, error: 'O link parece incompleto ou foi cortado no caminho.' };
    }
  }

  // A identidade cai aqui, antes de qualquer validação. Um link forjado com `userHash`
  // dentro não deve nem chegar à tela que pergunta se o usuário quer adotá-la.
  const semIdentidade = json && typeof json === 'object'
    ? { ...(json as Record<string, unknown>), userHash: undefined }
    : json;

  const parsed = favoritesFileSchema.safeParse(semIdentidade);
  if (!parsed.success) {
    return { ok: false, error: 'Este link não é uma lista de favoritos do Viola Libre.' };
  }
  if (parsed.data.entries.length === 0) {
    return { ok: false, error: 'A lista compartilhada está vazia.' };
  }
  return { ok: true, file: parsed.data };
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export function buildShareUrl(token: string, origin: string): string {
  return `${origin}/favoritos#${SHARE_HASH_KEY}=${token}`;
}

/**
 * Extrai o token de um fragmento de URL, ou `null` quando não há nenhum.
 *
 * `URLSearchParams` dá o parsing de graça e é seguro aqui porque o alfabeto base64url não
 * inclui `+` (que ele decodificaria como espaço) nem `&`.
 */
export function readShareToken(hash: string): string | null {
  const bruto = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!bruto) return null;
  const token = new URLSearchParams(bruto).get(SHARE_HASH_KEY);
  return token || null;
}
