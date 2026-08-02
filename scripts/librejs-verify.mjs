// Verifica se o build publicado satisfaz o GNU LibreJS. Sai com código 1 na
// primeira falha, para travar o CI antes de um deploy que quebraria o site para
// quem usa a extensão.
//
// A razão de existir: o nome dos arquivos muda a cada build e o rótulo é gerado
// por script. Se alguém trocar o pipeline de build, acrescentar um <script>
// inline no index.html ou puxar uma biblioteca de CDN, a conformidade cai em
// silêncio — a página simplesmente para de funcionar para o usuário do LibreJS,
// e nada no build acusa. Este verificador é esse alarme.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST_DIR, LABELS_PATH, LICENSE, LICENSE_CLOSE, escapeHtml, hasLicenseTags, listDistScripts } from './librejs-shared.mjs';

const problems = [];
const fail = (msg) => problems.push(msg);

function checkDist() {
  if (existsSync(DIST_DIR)) return true;
  fail('dist/ não existe — rode `npm run build` antes de verificar.');
  return false;
}

/** Todo .js servido precisa carregar o par @license / @license-end. */
function checkStamps(scripts) {
  for (const file of scripts) {
    if (!hasLicenseTags(join(DIST_DIR, file))) {
      fail(`${file} não tem o par @license/@license-end — o script de rótulos não rodou sobre ele.`);
    }
  }
}

/**
 * O link rel="jslicense" precisa estar no HTML SERVIDO, não no rodapé em React.
 *
 * O LibreJS decide se libera o bundle antes de qualquer JavaScript rodar; um
 * link que só existe depois que o React monta chega tarde demais e o site fica
 * em branco. Por isso a checagem é no HTML cru do dist.
 */
function checkLabelsLink(html) {
  const hasLink = new RegExp(`<a[^>]+href=["']${LABELS_PATH}["'][^>]*rel=["']jslicense["']`, 'i').test(html)
    || new RegExp(`<a[^>]+rel=["']jslicense["'][^>]*href=["']${LABELS_PATH}["']`, 'i').test(html);
  if (!hasLink) {
    fail(`index.html não tem <a href="${LABELS_PATH}" rel="jslicense"> fora de #root — o LibreJS não vai achar os rótulos.`);
  }
}

/** Script inline sem licença e script de CDN condenam a página inteira. */
function checkPageScripts(html) {
  const tags = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const [, attrs, body] of tags) {
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) {
      if (/^https?:\/\//i.test(src)) {
        fail(`index.html carrega script externo (${src}) — JS de terceiro sem rótulo bloqueia a página no LibreJS.`);
      }
      continue;
    }
    if (!body.trim()) continue;
    if (!body.includes(LICENSE.magnet) || !body.includes(LICENSE_CLOSE)) {
      fail('index.html tem <script> inline sem @license/@license-end.');
    }
  }
}

/** A página de Web Labels precisa listar exatamente os arquivos servidos. */
function checkLabelsPage(scripts) {
  const labelsFile = join(DIST_DIR, LABELS_PATH.replace(/^\//, ''));
  if (!existsSync(labelsFile)) {
    fail(`${LABELS_PATH} não foi gerado.`);
    return;
  }
  const labels = readFileSync(labelsFile, 'utf8');

  if (!/id=["']jslicense-labels1["']/.test(labels)) {
    fail('a tabela de rótulos não tem id="jslicense-labels1" — o LibreJS localiza a tabela por esse id.');
  }
  // No HTML o magnet sai escapado (`&` vira `&amp;`); o navegador desescapa ao ler
  // o href, então é a forma escapada que precisa estar no arquivo.
  if (!labels.includes(escapeHtml(LICENSE.magnet))) {
    fail('a página de rótulos não traz o magnet da licença reconhecido pelo LibreJS.');
  }
  for (const file of scripts) {
    if (!labels.includes(`/${file}`)) {
      fail(`${file} está no dist mas não aparece na tabela de ${LABELS_PATH} — provavelmente um chunk novo.`);
    }
  }

  // A terceira coluna precisa apontar para um fonte que existe de verdade.
  const localSource = labels.match(/href="(\/source\/[^"]+)"/)?.[1];
  if (localSource && !existsSync(join(DIST_DIR, localSource.replace(/^\//, '')))) {
    fail(`a tabela aponta para ${localSource}, que não existe no dist.`);
  }
}

function main() {
  if (!checkDist()) {
    report();
    return;
  }

  const scripts = listDistScripts();
  if (scripts.length === 0) fail('nenhum .js no dist — build incompleto?');

  const indexPath = join(DIST_DIR, 'index.html');
  if (!existsSync(indexPath)) {
    fail('dist/index.html não existe.');
  } else {
    const html = readFileSync(indexPath, 'utf8');
    checkLabelsLink(html);
    checkPageScripts(html);
  }

  checkStamps(scripts);
  checkLabelsPage(scripts);
  report(scripts.length);
}

function report(scriptCount = 0) {
  if (problems.length === 0) {
    console.log(`[librejs] conformidade OK — ${scriptCount} script(s) rotulado(s) e listado(s) em ${LABELS_PATH}.`);
    return;
  }
  console.error('[librejs] build NÃO está em conformidade com o LibreJS:');
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error('\nRode `npm run build` (que já chama o gerador de rótulos) e verifique de novo.');
  process.exit(1);
}

main();
