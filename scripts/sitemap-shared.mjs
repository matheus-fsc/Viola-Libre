/**
 * Peças comuns do gerador e do verificador de sitemap.
 */

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
 *   as rotas de timing — ferramenta de edição, mesma cifra que já está indexada.
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
 * O limite do protocolo é 50 mil por arquivo, mas o teto real aqui é de estratégia,
 * não de formato: o acervo tem ~490 mil cifras e o site é renderizado no cliente.
 * Despejar tudo de uma vez num domínio ainda sem autoridade gasta o orçamento de
 * rastreio em páginas que o Google não vai indexar, e as boas se perdem no meio.
 *
 * A lista começa curada e cresce conforme o site ganha autoridade — daí ser variável
 * de ambiente, e não constante no código.
 */
export const MAX_URLS = Number(process.env.SITEMAP_MAX_URLS || 6000);

/** Quantos artistas em destaque têm as músicas expandidas no sitemap. */
export const ARTIST_SONG_EXPANSION = Number(process.env.SITEMAP_ARTIST_EXPANSION || 900);

/**
 * Fatia do teto reservada a páginas de cifra.
 *
 * Cifra é a página que responde à busca de quem procura "cifra de tocando em frente";
 * página de artista é índice. Sem essa reserva os ~4.800 artistas em destaque comiam
 * o teto inteiro e sobrava pouca cifra no sitemap.
 */
export const SONG_SHARE = Number(process.env.SITEMAP_SONG_SHARE || 0.7);

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Monta o XML.
 *
 * Sem `<priority>` e sem `<changefreq>`: o Google declarou publicamente que ignora
 * os dois. O sitemap antigo trazia priority em todas as URLs, o que dava a impressão
 * de controlar algo que nunca esteve sob controle.
 *
 * `lastmod` só entra quando a data é real. Carimbar a data do build em toda URL é
 * dizer que meio acervo mudou hoje — o Google trata `lastmod` inconsistente como
 * ruído e passa a desconsiderá-lo, inclusive onde ele seria verdadeiro.
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
 * Ritmo das requisições.
 *
 * A API fica atrás de nginx + fail2ban com proteção contra rajada, e ela funciona:
 * disparar 900 pedidos com concorrência 8 fez 80% deles falharem, e as falhas
 * PIORARAM nas tentativas seguintes — sinal de bloqueio temporário acumulando.
 * Sequencial com uma pausa curta passa 100%.
 *
 * Medido contra a API real: com concorrência 8 a taxa de sucesso foi de 19%; uma
 * requisição por vez com 250ms de pausa (~3/s) deu 100% em várias rodadas. O gargalo
 * é rajada, não volume — por isso a pausa resolve e o paralelismo não.
 *
 * Ou seja: o gerador precisa se comportar como visitante, não como scraper. É mais
 * lento de propósito. Não aumente a concorrência sem verificar a taxa de sucesso —
 * "mais rápido" aqui significa "silenciosamente incompleto".
 */
export const REQUEST_CONCURRENCY = Number(process.env.SITEMAP_CONCURRENCY || 1);
export const REQUEST_DELAY_MS = Number(process.env.SITEMAP_DELAY_MS || 250);

/**
 * Acima desta fração de falhas o sitemap é considerado degradado e NÃO substitui o
 * arquivo existente.
 *
 * Sem essa trava, uma rodada bloqueada gera um sitemap curto de aparência perfeitamente
 * saudável — foi o que aconteceu: 4.976 URLs, das quais só 153 cifras, porque as
 * requisições de música falharam em silêncio. Publicar isso diria ao Google que as
 * cifras ausentes saíram do ar.
 */
export const MAX_FAILURE_RATE = Number(process.env.SITEMAP_MAX_FAILURE_RATE || 0.1);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Contabiliza o que falhou, para o script poder avisar em vez de gerar um sitemap curto em silêncio. */
export const stats = { ok: 0, failed: 0 };

/**
 * GET com timeout, pausa e recuo progressivo.
 *
 * Devolve `null` em vez de lançar: um gênero ausente não pode derrubar o processo
 * inteiro. Mas cada `null` é contado, e quem chama reporta o total — falha silenciosa
 * aqui viraria URL faltando no sitemap sem ninguém perceber.
 */
export async function fetchJson(path, { timeoutMs = 20000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** attempt); // recuo: 1s, 2s
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
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
 * Roda as tarefas com paralelismo limitado (por padrão, uma de cada vez).
 *
 * Ver REQUEST_CONCURRENCY: o limite existe para não disparar a proteção da própria
 * API do projeto durante a geração.
 */
export async function mapLimit(items, limit, worker) {
  const results = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
