/**
 * Gera o sitemap a partir do acervo real.
 *
 * Por que gerar em vez de manter à mão: o arquivo versionado listava 4 URLs, não
 * incluía a home e tinha `lastmod` congelado. Uma lista escrita à mão envelhece no
 * dia seguinte ao commit.
 *
 * ——— O que mudou em 21/09/2026 ———————————————————————————————————————————————
 *
 * A versão anterior montava a seleção a partir dos artistas em destaque de cada
 * GÊNERO, porque era a única lista de artistas relevantes que a API oferecia. Medido
 * contra a API: só 7,8% dos artistas têm gênero, e as listas de destaque alcançam
 * 6.358 artistas — 4,76% do acervo. O teto de 6.000 URLs não era escolha de
 * estratégia, era o tamanho do balde de onde se tirava.
 *
 * Agora a fonte é o dump (`/api/export/musicas.ndjson.gz`): o acervo inteiro, 1.021.268
 * cifras de 133.551 artistas, numa requisição de 4 segundos. Gênero saiu de cena.
 *
 * ——— Como a seleção é feita ——————————————————————————————————————————————————
 *
 * 1. Páginas fixas.
 * 2. Cifras dos rankings (mais vistas e mais curtidas) — demanda comprovada, entram
 *    primeiro.
 * 3. Cifras por RODÍZIO entre artistas: a 1ª cifra de cada artista, depois a 2ª de
 *    cada, e assim por diante. Este é o coração da mudança. Percorrer o dump na ordem
 *    gastaria a cota inteira nos primeiros milhares de artistas — um artista com 500
 *    cifras levaria 500 vagas enquanto outros não teriam nenhuma. Com o rodízio, a
 *    cota de 140 mil cobre UMA cifra de cada um dos 133.551 artistas antes de dar uma
 *    segunda a qualquer um.
 * 4. Páginas de artista com o que sobrar, das que têm mais cifras para as que têm
 *    menos: são índices, e o Google as descobre pelos links de qualquer jeito.
 *
 * Uso:
 *   npm run sitemap            # atualiza public/ (para revisar e commitar)
 *   node scripts/gen-sitemap.mjs --dist    # escreve direto em dist/
 *
 * DELIBERADAMENTE fora do `npm run build`: o sitemap muda quando o ACERVO muda, não
 * quando o CSS muda. Amarrá-lo ao build o regeneraria em deploys que não mexeram em
 * conteúdo nenhum. Por isso os arquivos são artefatos versionados: ficam revisáveis no
 * diff, e um deploy com a API fora do ar continua publicando o último sitemap bom.
 *
 * Se a API não responder, o script NÃO escreve um sitemap vazio nem trunca o que já
 * existe. Um sitemap desatualizado é muito melhor que um truncado, que faria o Google
 * concluir que as URLs ausentes saíram do ar.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_DUMP_AGE_DAYS,
  MAX_URLS,
  MIN_DUMP_COMPLETENESS,
  SHARD_PATTERN,
  SONG_SHARE,
  STATIC_PATHS,
  URLS_PER_FILE,
  buildSitemapIndexXml,
  buildSitemapXml,
  fetchDumpBuffer,
  fetchJson,
  forEachDumpRow,
  shardName,
  stats,
} from './sitemap-shared.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// public/ é o padrão porque o sitemap é artefato versionado (ver cabeçalho).
const toDist = process.argv.includes('--dist');
const OUT_DIR = toDist ? 'dist' : 'public';
const OUT_PATH = join(ROOT, OUT_DIR);

/**
 * Data do último commit, no formato do sitemap.
 *
 * As páginas fixas são construídas a partir do repositório, então a data do commit
 * é literalmente quando elas mudaram pela última vez — ao contrário das cifras, cuja
 * `updated_at` ainda vem nula para o acervo inteiro.
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

/** `updated_at` só vira `lastmod` quando é data de verdade. Ver buildSitemapXml. */
function lastmodDe(updatedAt) {
  if (typeof updatedAt !== 'string') return undefined;
  return /^\d{4}-\d{2}-\d{2}/.test(updatedAt) ? updatedAt.slice(0, 10) : undefined;
}

async function collectEntries() {
  const commitDate = lastCommitDate();

  // ——— O acervo ————————————————————————————————————————————————————————————
  const status = await fetchJson('/api/export/status');
  const esperadas = Number(status?.total_musicas) || 0;

  if (status?.generated_at) {
    const idadeDias = (Date.now() - Date.parse(status.generated_at)) / 86400000;
    if (Number.isFinite(idadeDias) && idadeDias > MAX_DUMP_AGE_DAYS) {
      console.warn(
        `sitemap: o dump foi gerado há ${idadeDias.toFixed(1)} dias (${status.generated_at}). ` +
          'A API o regenera a cada 6h — vale conferir se a exportação continua de pé.',
      );
    }
  }

  const dump = await fetchDumpBuffer();
  if (!dump) return { dump: false };

  // Passada 1: quantas cifras cada artista tem. Só a contagem, para saber quantas
  // rodadas do rodízio cabem na cota antes de decidir o que guardar na passada 2.
  const contagem = new Map();
  const lidas = await forEachDumpRow(dump, (row) => {
    if (!row.artist_slug || !row.song_slug) return;
    contagem.set(row.artist_slug, (contagem.get(row.artist_slug) ?? 0) + 1);
  });

  const artistas = contagem.size;
  const cotaDeCifras = Math.max(0, Math.floor((MAX_URLS - STATIC_PATHS.length) * SONG_SHARE));
  // Quantas cifras por artista precisam ser guardadas para o rodízio dar conta da cota.
  // Sem este limite a passada 2 guardaria o milhão de linhas na memória para usar 140 mil.
  const porArtista = artistas > 0 ? Math.max(1, Math.ceil(cotaDeCifras / artistas)) : 1;

  // Passada 2: guarda as primeiras `porArtista` cifras de cada um.
  const cifrasPorArtista = new Map();
  await forEachDumpRow(dump, (row) => {
    if (!row.artist_slug || !row.song_slug) return;
    let lista = cifrasPorArtista.get(row.artist_slug);
    if (!lista) {
      lista = [];
      cifrasPorArtista.set(row.artist_slug, lista);
    }
    if (lista.length < porArtista) {
      lista.push({
        path: songPath(row.artist_slug, row.song_slug),
        lastmod: lastmodDe(row.updated_at),
      });
    }
  });

  // ——— Rankings ————————————————————————————————————————————————————————————
  // Em série, e não com Promise.all: são duas requisições, e o `fetchJson` só respeita
  // a pausa entre chamadas se elas não partirem juntas.
  const topMusicas = await fetchJson('/api/rankings/top-musicas');
  const topLikes = await fetchJson('/api/rankings/top-likes');

  const musicasDeRanking = [];
  for (const lista of [topMusicas, topLikes]) {
    if (!Array.isArray(lista)) continue;
    for (const m of lista) {
      if (m?.artist_slug && m?.slug) musicasDeRanking.push(songPath(m.artist_slug, m.slug));
    }
  }

  // ——— Montagem sob o teto —————————————————————————————————————————————————
  const seen = new Set();
  const entries = [];
  const add = (path, lastmod) => {
    if (seen.has(path)) return false;
    seen.add(path);
    entries.push({ path, lastmod });
    return true;
  };

  for (const path of STATIC_PATHS) add(path, commitDate);

  let cifrasIncluidas = 0;
  for (const path of musicasDeRanking) {
    if (cifrasIncluidas >= cotaDeCifras) break;
    if (add(path)) cifrasIncluidas++;
  }

  // O rodízio: a rodada `i` pega a cifra de índice `i` de cada artista.
  const slugsOrdenados = [...cifrasPorArtista.keys()].sort();
  for (let i = 0; i < porArtista && cifrasIncluidas < cotaDeCifras; i++) {
    for (const slug of slugsOrdenados) {
      if (cifrasIncluidas >= cotaDeCifras) break;
      const cifra = cifrasPorArtista.get(slug)[i];
      if (cifra && add(cifra.path, cifra.lastmod)) cifrasIncluidas++;
    }
  }

  // Páginas de artista com o que restar, das mais cheias para as mais vazias.
  const porTamanho = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [slug] of porTamanho) {
    if (entries.length >= MAX_URLS) break;
    add(`/cifras/${slug}`);
  }

  return { dump: true, entries, lidas, esperadas, artistas, porArtista, commitDate };
}

const resultado = await collectEntries();

if (!resultado.dump) {
  console.warn('sitemap: a API não entregou o dump do acervo — mantendo os arquivos existentes.');
  console.warn('sitemap: nada foi sobrescrito. Rode de novo com a API no ar para atualizar.');
  // Sai com 0 de propósito: build quebrado por API fora do ar seria pior que um
  // sitemap defasado, ainda mais num deploy que só mudou CSS.
  process.exit(0);
}

const { entries, lidas, esperadas, artistas, porArtista, commitDate } = resultado;

if (toDist && !existsSync(join(ROOT, 'dist'))) {
  console.error('sitemap: dist/ não existe. Rode o build antes, ou omita --dist.');
  process.exit(1);
}

// Trava contra publicar um sitemap degradado.
//
// Sem ela, um dump truncado gera um sitemap curto de aparência perfeitamente saudável
// — já aconteceu na versão por artista: 4.976 URLs das quais só 153 eram cifras,
// porque as requisições de música falharam em silêncio. Substituir um sitemap bom por
// esse diria ao Google que as cifras que sumiram saíram do ar.
//
// Agora há um número esperado para comparar, em vez de uma estimativa: o
// `/api/export/status` diz quantas cifras o dump deveria ter.
if (esperadas > 0 && lidas < esperadas * MIN_DUMP_COMPLETENESS) {
  console.error(
    `sitemap: o dump trouxe ${lidas.toLocaleString('pt-BR')} cifras, mas o status anuncia ` +
      `${esperadas.toLocaleString('pt-BR')} (${((lidas / esperadas) * 100).toFixed(1)}%).`,
  );
  console.error('sitemap: os arquivos existentes foram PRESERVADOS — um sitemap truncado é pior que um desatualizado.');
  process.exit(1);
}

// ——— Escrita ——————————————————————————————————————————————————————————————
const pedacos = [];
for (let i = 0; i < entries.length; i += URLS_PER_FILE) {
  pedacos.push(entries.slice(i, i + URLS_PER_FILE));
}

const nomes = pedacos.map((_, i) => shardName(i + 1));
nomes.forEach((nome, i) => writeFileSync(join(OUT_PATH, nome), buildSitemapXml(pedacos[i]), 'utf8'));
writeFileSync(join(OUT_PATH, 'sitemap.xml'), buildSitemapIndexXml(nomes, commitDate), 'utf8');

// Apaga pedaço que sobrou de uma rodada maior. Sem isto, um acervo que encolhe deixa
// `sitemap-6.xml` no diretório: ele não está mais no índice, mas continua sendo
// publicado e servido, anunciando URLs de uma geração que não existe mais.
const vivos = new Set(nomes);
for (const arquivo of readdirSync(OUT_PATH)) {
  if (SHARD_PATTERN.test(arquivo) && !vivos.has(arquivo)) {
    rmSync(join(OUT_PATH, arquivo));
    console.log(`sitemap: ${arquivo} removido (sobrou de uma geração anterior).`);
  }
}

const cifras = entries.filter((e) => e.path.split('/').length > 3).length;
const paginasDeArtista = entries.filter((e) => e.path.split('/').length === 3).length;
const comLastmod = entries.filter((e) => e.lastmod).length;
const br = (n) => n.toLocaleString('pt-BR');

console.log(
  `sitemap: ${br(entries.length)} URLs em ${nomes.length} arquivo(s) + índice ` +
    `(${STATIC_PATHS.length} fixas, ${br(paginasDeArtista)} artistas, ${br(cifras)} cifras) → ${OUT_DIR}/sitemap.xml`,
);
console.log(
  `sitemap: acervo com ${br(lidas)} cifras de ${br(artistas)} artistas; ` +
    `rodízio de até ${porArtista} cifra(s) por artista.`,
);

// `lastmod` ausente não é defeito — é a coluna `updated_at` ainda vazia no acervo. Mas
// vale dizer em voz alta: no dia em que o scraper começar a preencher, este número
// subindo é o sinal de que passou a funcionar.
if (comLastmod === 0) {
  console.log('sitemap: nenhuma cifra com `lastmod` — a API ainda devolve `updated_at` nulo para todo o acervo.');
} else {
  console.log(`sitemap: ${br(comLastmod)} cifra(s) com \`lastmod\` real.`);
}

if (stats.failed > 0) {
  console.warn(`sitemap: ${stats.failed} requisição(ões) avulsa(s) falharam — os rankings podem ter ficado de fora.`);
}

if (entries.length >= MAX_URLS) {
  console.log(
    `sitemap: teto de ${br(MAX_URLS)} atingido — ajuste SITEMAP_MAX_URLS conforme o site ganha ` +
      'autoridade e a renderização deixar de ser o gargalo.',
  );
}
