/**
 * Peças comuns do gerador e do verificador de sitemap.
 */
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

export const SITE_URL = 'https://violalibre.com.br';

/**
 * De onde vêm os dados do acervo.
 *
 * O padrão é a API pública, porque é o único endereço que funciona de qualquer lugar
 * — inclusive do runner do GitHub Actions, que não entra na tailnet.
 *
 * Rodando de dentro da tailnet, prefira o acesso direto, que não passa pelo limitador:
 *
 *   SITEMAP_API_BASE=http://100.72.68.118:8000 SITEMAP_DELAY_MS=0 npm run sitemap
 *
 * É bem mais rápido e não gasta a cota da API pública. Só não dá para ser o padrão:
 * fora da tailnet esse endereço não resolve.
 */
export const API_BASE = process.env.SITEMAP_API_BASE || 'https://api.violalibre.com.br';

/**
 * Páginas fixas do site.
 *
 * Fora daqui, de propósito:
 *   /minhascifras — rascunho local, sem versão pública (noindex + robots.txt);
 *   /favoritos    — a estante de quem visita; para o rastreador a página é vazia;
 *   /preferencias — painel de configuração local, sem conteúdo público (noindex);
 *   as rotas de timing, print e grafo — ferramenta e leituras da mesma cifra que já
 *   está indexada em /cifras/artista/musica.
 */
export const STATIC_PATHS = [
  '/',
  '/cifras',
  '/chords',
  '/treinos',
  '/ouvido',
  '/termos',
  '/privacidade',
  '/agradecimentos',
];

/**
 * Teto de URLs do sitemap.
 *
 * Desde que a API expõe o dump do acervo, listar tudo deixou de ser difícil: são
 * 1.021.268 cifras de 133.551 artistas (medido em 21/09/2026 pelo `/api/export/status`)
 * numa requisição só. Então o teto voltou a ser o que ele diz ser — estratégia.
 *
 * As páginas ainda são renderizadas no cliente. Despejar um milhão de URLs gastaria o
 * orçamento de rastreio em páginas que o Google não vai indexar, e as boas se perderiam
 * no meio. 200 mil é cerca de 11x o que ele já indexou (18.203): folga larga para o
 * ritmo voltar a crescer, sem prometer o que a renderização não entrega.
 *
 * Continua variável de ambiente porque o número certo muda quando houver prerender.
 */
export const MAX_URLS = Number(process.env.SITEMAP_MAX_URLS || 200000);

/**
 * URLs por arquivo.
 *
 * O protocolo permite 50 mil por arquivo e 50 MB descomprimidos; 45 mil deixa margem.
 * Passando disso, `sitemap.xml` deixa de ser a lista e passa a ser o ÍNDICE que aponta
 * para `sitemap-1.xml`, `sitemap-2.xml`… A URL anunciada no robots.txt e registrada no
 * Search Console não muda, que é o ponto.
 */
export const URLS_PER_FILE = Number(process.env.SITEMAP_URLS_PER_FILE || 45000);

/**
 * Fatia do teto reservada a páginas de cifra.
 *
 * Cifra é a página que responde à busca de quem procura "cifra de tocando em frente";
 * página de artista é índice. Com 0,7 de 200 mil, a cota de cifras (140 mil) cobre uma
 * cifra de cada um dos 133.551 artistas e ainda sobra para o começo de uma segunda
 * rodada — ver o rodízio em `gen-sitemap.mjs`.
 */
export const SONG_SHARE = Number(process.env.SITEMAP_SONG_SHARE || 0.7);

/**
 * Acima de quantos dias o dump é considerado velho.
 *
 * Só avisa, não reprova: a API regenera o dump a cada 6h, então atraso significa que
 * algo parou do lado de lá — informação útil, mas um sitemap feito com o dump de ontem
 * continua correto.
 */
export const MAX_DUMP_AGE_DAYS = Number(process.env.SITEMAP_MAX_DUMP_AGE_DAYS || 3);

/**
 * Fração mínima do acervo que o dump precisa entregar para valer a substituição.
 *
 * O `/api/export/status` diz quantas cifras o dump deveria ter. Se o arquivo baixado
 * trouxer muito menos, ele foi truncado no meio — e publicar isso diria ao Google que
 * as cifras ausentes saíram do ar. Mesma lógica da trava antiga de taxa de falha, só
 * que agora há um número esperado para comparar, em vez de uma estimativa.
 */
export const MIN_DUMP_COMPLETENESS = Number(process.env.SITEMAP_MIN_DUMP_COMPLETENESS || 0.95);

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Monta um arquivo de URLs.
 *
 * Sem `<priority>` e sem `<changefreq>`: o Google declarou publicamente que ignora
 * os dois. O sitemap antigo trazia priority em todas as URLs, o que dava a impressão
 * de controlar algo que nunca esteve sob controle.
 *
 * `lastmod` só entra quando a data é real. Hoje o `updated_at` vem `null` em 100% das
 * linhas do dump — a coluna nasceu vazia de propósito, sem data inventada, e vai sendo
 * preenchida conforme o scraper regrava cada cifra. Então quase nenhuma cifra tem data,
 * e é assim que tem de ser: carimbar a data do build em toda URL é dizer que o acervo
 * inteiro mudou hoje, e o Google trata `lastmod` inconsistente como ruído, passando a
 * desconsiderá-lo inclusive onde ele seria verdadeiro.
 */
export function buildSitemapXml(entries) {
  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = `    <loc>${escapeXml(SITE_URL + path)}</loc>`;
      const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
      return `  <url>\n${loc}${mod}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Monta o índice que aponta para os pedaços.
 *
 * Aqui o `lastmod` é legítimo e quer dizer outra coisa: quando o ARQUIVO foi gerado,
 * não quando o conteúdo mudou. É o campo que diz ao Google se vale a pena rebaixar um
 * pedaço que ele já conhece.
 */
export function buildSitemapIndexXml(fileNames, lastmod) {
  const items = fileNames
    .map((name) => {
      const loc = `    <loc>${escapeXml(`${SITE_URL}/${name}`)}</loc>`;
      const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
      return `  <sitemap>\n${loc}${mod}\n  </sitemap>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/** Nome do pedaço número `i` (a contagem começa em 1). */
export const shardName = (i) => `sitemap-${i}.xml`;

/** Reconhece um pedaço pelo nome, para poder apagar os que sobraram de uma rodada maior. */
export const SHARD_PATTERN = /^sitemap-\d+\.xml$/;

/**
 * Ritmo das requisições avulsas.
 *
 * Desde o dump sobraram três requisições (status, e os dois rankings), mas a pausa
 * continua valendo: o limitador conta pedidos, não intenções.
 *
 * Medido em 21/09/2026: 88 chamadas seguidas a `/api/generos/top` com 250ms de pausa
 * começaram a levar 429 por volta da 60ª, e a rodada seguinte já veio bloqueada. Com
 * 1,5s passaram todas. O limite ficou mais apertado do que era quando o valor de 250ms
 * foi medido — não baixe isto sem medir de novo.
 */
export const REQUEST_DELAY_MS = Number(process.env.SITEMAP_DELAY_MS || 1500);

/** Contabiliza o que falhou, para o script poder avisar em vez de gerar um sitemap curto em silêncio. */
export const stats = { ok: 0, failed: 0 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * User-Agent próprio.
 *
 * Sem ele a Cloudflare devolve 403 para cliente sem identificação — e um 403 aqui
 * viraria "a API não respondeu", ou seja, sitemap parado sem motivo aparente.
 */
const USER_AGENT = 'viola-libre-sitemap/2.0 (+https://violalibre.com.br)';

/**
 * GET com timeout, pausa e recuo progressivo.
 *
 * Devolve `null` em vez de lançar: um ranking ausente não pode derrubar o processo
 * inteiro. Mas cada `null` é contado, e quem chama reporta o total — falha silenciosa
 * aqui viraria URL faltando no sitemap sem ninguém perceber.
 */
export async function fetchJson(path, { timeoutMs = 30000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt); // recuo: 2s, 4s
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        stats.ok++;
        await sleep(REQUEST_DELAY_MS);
        return data;
      }
    } catch {
      /* rede: cai no recuo acima */
    } finally {
      clearTimeout(timer);
    }
  }
  stats.failed++;
  return null;
}

/**
 * Baixa o dump do acervo inteiro.
 *
 * Substitui as 133.551 requisições da versão anterior — uma por artista, 12 horas no
 * ritmo que não dispara o limitador — por UMA. Medido em 21/09/2026: 19,4 MB
 * comprimidos em 4,4 segundos.
 *
 * Devolve o buffer ainda comprimido, e não as linhas já lidas, porque o gerador
 * percorre o dump duas vezes (primeiro para contar, depois para escolher) e 19 MB na
 * memória custam muito menos que o milhão e meio de strings de uma leitura inteira.
 */
export async function fetchDumpBuffer({ timeoutMs = 180000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/export/musicas.ndjson.gz`, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      stats.failed++;
      return null;
    }
    stats.ok++;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    stats.failed++;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Percorre o dump linha a linha, sem materializar o arquivo descomprimido.
 *
 * Linha malformada é pulada em silêncio de propósito: uma cifra com caractere estranho
 * não deve custar o sitemap inteiro. Quem chama compara o total lido com o que o
 * `/api/export/status` prometeu, que é a checagem que importa.
 *
 * Devolve quantas linhas foram lidas de verdade.
 */
export async function forEachDumpRow(buffer, onRow) {
  const linhas = createInterface({
    input: Readable.from(buffer).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let lidas = 0;
  for await (const linha of linhas) {
    if (!linha) continue;
    let row;
    try {
      row = JSON.parse(linha);
    } catch {
      continue;
    }
    lidas++;
    onRow(row);
  }
  return lidas;
}
