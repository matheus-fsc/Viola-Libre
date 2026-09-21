/**
 * Confere o sitemap contra o robots.txt e contra os limites do protocolo.
 *
 * Existe por causa de um bug real: o `robots.txt` trazia `Disallow: /cifras`, que
 * bloqueava o acervo inteiro — as únicas páginas pelas quais alguém chega ao site
 * pela busca. Nada no processo apontava a contradição, e ela sobreviveu a vários
 * deploys.
 *
 * A checagem central é essa: TODA URL anunciada no sitemap tem de ser rastreável
 * segundo o próprio robots.txt. Anunciar uma URL e proibir seu rastreio é dar
 * instruções contraditórias ao Google, e o Search Console reporta cada uma delas
 * como erro.
 *
 * Uso: npm run sitemap:verify
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_URL } from './sitemap-shared.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const problems = [];

const robots = readFileSync(join(PUBLIC, 'robots.txt'), 'utf8');

/** Extrai as `<loc>` de um XML, já desescapadas. */
const locsDe = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"'),
  );

// ——— Sitemap ————————————————————————————————————————————————————————————————
//
// `public/sitemap.xml` é o ÍNDICE: ele lista arquivos, não páginas. As URLs de verdade
// estão nos pedaços, e é cada pedaço que precisa respeitar o limite de 50 mil — o
// índice tem limite próprio, também de 50 mil, mas de arquivos.
const indice = readFileSync(join(PUBLIC, 'sitemap.xml'), 'utf8');
const ehIndice = /<sitemapindex[\s>]/.test(indice);

/** Cada arquivo que compõe o sitemap: o próprio, ou os pedaços que o índice aponta. */
const arquivos = [];

if (ehIndice) {
  const apontados = locsDe(indice);
  if (apontados.length === 0) problems.push('o índice não aponta para nenhum arquivo.');
  if (apontados.length > 50000) problems.push(`o índice aponta para ${apontados.length} arquivos, acima do limite de 50.000.`);

  for (const loc of apontados) {
    if (!loc.startsWith(`${SITE_URL}/`)) {
      problems.push(`o índice aponta para fora do domínio declarado: ${loc}`);
      continue;
    }
    const nome = loc.slice(`${SITE_URL}/`.length);
    const caminho = join(PUBLIC, nome);
    if (!existsSync(caminho)) {
      // Erro fácil de cometer e caro de descobrir: o índice fica válido, o Google baixa
      // e leva 404 em cada pedaço ausente.
      problems.push(`o índice aponta para ${nome}, que não existe em public/.`);
      continue;
    }
    arquivos.push({ nome, xml: readFileSync(caminho, 'utf8') });
  }
} else {
  arquivos.push({ nome: 'sitemap.xml', xml: indice });
}

const locs = [];
let bytes = Buffer.byteLength(indice, 'utf8');

for (const arquivo of arquivos) {
  const desteArquivo = locsDe(arquivo.xml);
  if (desteArquivo.length === 0) problems.push(`${arquivo.nome} não tem nenhuma <loc>.`);
  if (desteArquivo.length > 50000) {
    problems.push(`${arquivo.nome} tem ${desteArquivo.length} URLs, acima do limite de 50.000 por arquivo.`);
  }
  const b = Buffer.byteLength(arquivo.xml, 'utf8');
  if (b > 50 * 1024 * 1024) {
    problems.push(`${arquivo.nome} tem ${(b / 1024 / 1024).toFixed(1)} MB, acima do limite de 50 MB.`);
  }
  if (arquivo.nome !== 'sitemap.xml') bytes += b;
  locs.push(...desteArquivo);
}

/** Todos os pedaços juntos, para as checagens que varrem o texto cru (ver `lastmod`). */
const xml = arquivos.map((a) => a.xml).join('\n');

if (locs.length === 0) problems.push('o sitemap não tem nenhuma <loc>.');

const duplicates = locs.filter((loc, i) => locs.indexOf(loc) !== i);
if (duplicates.length) problems.push(`${new Set(duplicates).size} URL(s) duplicada(s), começando por ${[...new Set(duplicates)][0]}.`);

// A home precisa estar lá. Faltava no sitemap antigo, que listava só 4 páginas internas.
if (!locs.includes(`${SITE_URL}/`)) problems.push(`a home (${SITE_URL}/) não está no sitemap.`);

for (const loc of locs) {
  if (!loc.startsWith(`${SITE_URL}/`)) {
    problems.push(`URL fora do domínio declarado: ${loc}`);
    break;
  }
}

for (const [, mod] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  if (!/^\d{4}-\d{2}-\d{2}(T|$)/.test(mod)) {
    problems.push(`lastmod fora do formato W3C: ${mod}`);
    break;
  }
}

// ——— robots.txt —————————————————————————————————————————————————————————————
/**
 * Só as regras que valem para `User-agent: *`.
 *
 * O robots.txt servido em produção traz também os blocos que a Cloudflare injeta
 * para robôs de IA; o arquivo do repositório é o que este script controla, e é dele
 * que sai a contradição a procurar.
 */
function disallowRules(text) {
  const rules = [];
  let dentroDoGrupoCoringa = false;

  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') dentroDoGrupoCoringa = value === '*';
    else if (key === 'disallow' && dentroDoGrupoCoringa && value) rules.push(value);
  }
  return rules;
}

/** Casamento de prefixo com `*` e `$`, como especificado para o robots.txt. */
function isBlocked(pathname, rule) {
  const pattern = rule
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\\\$$/, '$');
  return new RegExp(`^${pattern}`).test(pathname);
}

const rules = disallowRules(robots);

if (!/^\s*Sitemap:\s*\S+/im.test(robots)) {
  problems.push('o robots.txt não aponta para o sitemap (linha `Sitemap:`).');
}

const blocked = [];
for (const loc of locs) {
  const { pathname, search } = new URL(loc);
  const alvo = pathname + search;
  const regra = rules.find((r) => isBlocked(alvo, r));
  if (regra) blocked.push({ loc, regra });
}

if (blocked.length) {
  problems.push(
    `${blocked.length} URL(s) do sitemap são proibidas pelo robots.txt — anunciar e bloquear ao mesmo tempo vira erro no Search Console. ` +
      `Exemplo: ${blocked[0].loc} casa com "Disallow: ${blocked[0].regra}".`,
  );
}

// ——— Resultado ——————————————————————————————————————————————————————————————
if (problems.length) {
  console.error('sitemap: reprovado\n');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

const cifras = locs.filter((l) => l.replace(`${SITE_URL}/`, '').split('/').length > 2).length;
const br = (n) => n.toLocaleString('pt-BR');
const onde = ehIndice ? `${arquivos.length} arquivo(s) + índice` : 'arquivo único';
console.log(
  `sitemap: OK — ${br(locs.length)} URLs (${br(cifras)} cifras) em ${onde}, ` +
    `nenhuma bloqueada pelo robots.txt, ${br(Math.round(bytes / 1024))} KB no total.`,
);
