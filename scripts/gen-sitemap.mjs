/**
 * Gera o sitemap.xml a partir do acervo real.
 *
 * Por que gerar em vez de manter à mão: o arquivo versionado listava 4 URLs, não
 * incluía a home e tinha `lastmod` congelado. Uma lista escrita à mão envelhece no
 * dia seguinte ao commit.
 *
 * A seleção é CURADA, não exaustiva. O acervo tem ~133 mil artistas e ~490 mil
 * cifras; o critério aqui é "o que tem chance real de ser indexado e rankear":
 * as páginas fixas, os artistas em destaque de cada gênero e as músicas mais
 * vistas e mais curtidas. O resto o Google descobre seguindo os links das páginas
 * de artista, que é o caminho normal de descoberta.
 *
 * Uso:
 *   npm run sitemap            # atualiza public/sitemap.xml (para revisar e commitar)
 *   node scripts/gen-sitemap.mjs --dist    # escreve direto em dist/
 *
 * DELIBERADAMENTE fora do `npm run build`. Duas razões:
 *
 *   1. A API fica atrás de nginx + fail2ban e derruba rajadas — rodar isso a cada
 *      deploy seria o próprio projeto batendo na própria API, e o Cloudflare Pages
 *      ainda faria isso de um IP que a proteção não conhece.
 *   2. O sitemap muda quando o ACERVO muda, não quando o CSS muda. Amarrá-lo ao
 *      build o regeneraria em deploys que não mexeram em conteúdo nenhum.
 *
 * Por isso o `public/sitemap.xml` é um artefato versionado: fica revisável no diff,
 * e um deploy sem a API no ar continua publicando o último sitemap bom.
 *
 * Se a API não responder, o script NÃO escreve um sitemap vazio nem trunca o que já
 * existe. Um sitemap desatualizado é muito melhor que um truncado, que faria o Google
 * concluir que as URLs ausentes saíram do ar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARTIST_SONG_EXPANSION,
  MAX_FAILURE_RATE,
  MAX_URLS,
  REQUEST_CONCURRENCY,
  SONG_SHARE,
  STATIC_PATHS,
  buildSitemapXml,
  fetchJson,
  mapLimit,
  stats,
} from './sitemap-shared.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// public/ é o padrão porque o sitemap é artefato versionado (ver cabeçalho).
const toDist = process.argv.includes('--dist');
const OUT_DIR = toDist ? 'dist' : 'public';
const OUT_PATH = join(ROOT, OUT_DIR, 'sitemap.xml');

/**
 * Data do último commit, no formato do sitemap.
 *
 * As páginas fixas são construídas a partir do repositório, então a data do commit
 * é literalmente quando elas mudaram pela última vez — ao contrário das cifras, cuja
 * data de alteração a API não expõe e que por isso saem sem `lastmod`.
 */
function lastCommitDate() {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

/** Remove barras extras e monta o caminho da cifra. */
const songPath = (artistSlug, songSlug) => `/cifras/${artistSlug}/${String(songSlug).replace(/^\/+/, '')}`;

async function collectEntries() {
  const commitDate = lastCommitDate();

  // 1. Artistas em destaque de cada gênero. É a melhor lista de artistas relevantes
  //    que a API oferece — 133 mil artistas em ordem alfabética não seriam curadoria.
  const generos = (await fetchJson('/api/generos')) ?? [];
  const artistSlugs = [];

  const porGenero = await mapLimit(generos, REQUEST_CONCURRENCY, (genero) =>
    fetchJson(`/api/generos/${encodeURIComponent(genero)}/top`),
  );

  const generosSemArtistas = [];
  porGenero.forEach((artistas, i) => {
    // Gêneros com barra no nome ("Gospel/Religioso", "Hip Hop/Rap") não têm como ser
    // consultados: a rota lê a barra como separador de caminho, e nem codificada nem
    // duplamente codificada ela casa com o nome guardado. É limitação da API, não do
    // gerador — registra-se a ausência e segue, porque são gêneros grandes e vale
    // aparecer no log.
    if (!Array.isArray(artistas) || artistas.length === 0) {
      generosSemArtistas.push(generos[i]);
      return;
    }
    for (const artista of artistas) {
      if (artista?.slug) artistSlugs.push(artista.slug);
    }
  });

  // 2. Rankings: as músicas que o público de fato abre e curte.
  const [topMusicas, topLikes] = await Promise.all([
    fetchJson('/api/rankings/top-musicas'),
    fetchJson('/api/rankings/top-likes'),
  ]);

  const musicasDeRanking = [];
  for (const lista of [topMusicas, topLikes]) {
    if (!Array.isArray(lista)) continue;
    for (const m of lista) {
      if (m?.artist_slug && m?.slug) musicasDeRanking.push(songPath(m.artist_slug, m.slug));
    }
  }

  // 3. Músicas dos artistas em destaque. É o que põe cifra de verdade no sitemap.
  const artistasUnicos = [...new Set(artistSlugs)];
  const paraExpandir = artistasUnicos.slice(0, ARTIST_SONG_EXPANSION);
  const musicasPorArtista = await mapLimit(paraExpandir, REQUEST_CONCURRENCY, (slug) =>
    fetchJson(`/api/artistas/${encodeURIComponent(slug)}/musicas`),
  );

  const musicasDeArtista = [];
  musicasPorArtista.forEach((musicas, i) => {
    if (!Array.isArray(musicas)) return;
    for (const m of musicas) {
      if (m?.slug) musicasDeArtista.push(songPath(paraExpandir[i], m.slug));
    }
  });

  // ——— Montagem sob o teto ————————————————————————————————————————————————
  // A ordem de inserção decide quem fica de fora, e a primeira versão inseria os
  // ~4.800 artistas antes das músicas: o teto era gasto quase todo em páginas de
  // artista, que são índices, e sobrava pouca cifra — justamente a página que
  // responde à busca ("cifra de tocando em frente") e que traz alguém pra cá.
  //
  // Agora as cifras têm cota garantida. Páginas de artista entram depois, com o que
  // restar: elas continuam sendo descobertas pelos links internos, e uma página de
  // índice ausente do sitemap custa muito menos que uma cifra ausente.
  const seen = new Set();
  const entries = [];
  const add = (path, lastmod) => {
    if (seen.has(path)) return false;
    seen.add(path);
    entries.push({ path, lastmod });
    return true;
  };

  for (const path of STATIC_PATHS) add(path, commitDate);

  const cotaDeCifras = Math.floor((MAX_URLS - entries.length) * SONG_SHARE);
  let cifrasIncluidas = 0;
  for (const path of [...musicasDeRanking, ...musicasDeArtista]) {
    if (cifrasIncluidas >= cotaDeCifras) break;
    if (add(path)) cifrasIncluidas++;
  }

  for (const slug of artistasUnicos) {
    if (entries.length >= MAX_URLS) break;
    add(`/cifras/${slug}`);
  }

  return {
    entries,
    generosSemArtistas,
    apiRespondeu: generos.length > 0,
    totalArtistasConhecidos: artistasUnicos.length,
  };
}

const { entries, generosSemArtistas, apiRespondeu, totalArtistasConhecidos } = await collectEntries();

if (!apiRespondeu) {
  console.warn('sitemap: a API não respondeu — mantendo o sitemap.xml existente.');
  console.warn('sitemap: nada foi sobrescrito. Rode de novo com a API no ar para atualizar.');
  // Sai com 0 de propósito: build quebrado por API fora do ar seria pior que um
  // sitemap defasado, ainda mais num deploy que só mudou CSS.
  process.exit(0);
}

if (toDist && !existsSync(join(ROOT, 'dist'))) {
  console.error('sitemap: dist/ não existe. Rode o build antes, ou omita --dist.');
  process.exit(1);
}

// Trava contra publicar um sitemap degradado.
//
// Falha de rede aqui não estoura: `fetchJson` devolve null e a URL simplesmente não
// entra. O resultado é um arquivo curto e de aparência saudável — já aconteceu, com
// 4.976 URLs das quais só 153 eram cifras. Substituir um sitemap bom por esse diria ao
// Google que as cifras que sumiram saíram do ar.
const totalReqs = stats.ok + stats.failed;
const failureRate = totalReqs ? stats.failed / totalReqs : 0;

if (failureRate > MAX_FAILURE_RATE) {
  console.error(
    `sitemap: ${stats.failed}/${totalReqs} requisições falharam (${(failureRate * 100).toFixed(1)}%), ` +
      `acima do limite de ${(MAX_FAILURE_RATE * 100).toFixed(0)}%.`,
  );
  console.error('sitemap: o arquivo existente foi PRESERVADO — um sitemap truncado é pior que um desatualizado.');
  console.error('sitemap: provável bloqueio por rajada. Espere alguns minutos e suba SITEMAP_DELAY_MS.');
  process.exit(1);
}

writeFileSync(OUT_PATH, buildSitemapXml(entries), 'utf8');

const cifras = entries.filter((e) => e.path.split('/').length > 3).length;
const artistas = entries.filter((e) => e.path.split('/').length === 3).length;

console.log(
  `sitemap: ${entries.length} URLs (${STATIC_PATHS.length} fixas, ${artistas} artistas, ${cifras} cifras) → ${OUT_DIR}/sitemap.xml`,
);

// Abaixo do limite da trava, mas ainda assim vale dizer: cada falha é uma URL que
// deixou de entrar.
if (stats.failed > 0) {
  console.warn(
    `sitemap: ${stats.failed}/${totalReqs} requisições falharam (${(failureRate * 100).toFixed(1)}%) — ` +
      'algumas URLs ficaram de fora.',
  );
}

if (entries.length >= MAX_URLS) {
  console.log(
    `sitemap: teto de ${MAX_URLS} atingido (${totalArtistasConhecidos} artistas em destaque conhecidos) — ` +
      'ajuste SITEMAP_MAX_URLS para ampliar conforme o site ganha autoridade.',
  );
}
if (generosSemArtistas.length) {
  console.warn(
    `sitemap: ${generosSemArtistas.length} gênero(s) sem artistas pela API (nome com barra não é consultável): ` +
      generosSemArtistas.join(', '),
  );
}
