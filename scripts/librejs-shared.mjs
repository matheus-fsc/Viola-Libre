// Constantes e utilitários comuns aos scripts de conformidade com o GNU LibreJS.
//
// O LibreJS bloqueia todo JavaScript não trivial que a página carrega sem uma
// declaração de licença legível por máquina. Como o Vite gera nomes com hash a
// cada build (`index-BvBM4xs7.js`), nenhuma página de rótulos escrita à mão
// sobrevive ao próximo deploy — por isso os rótulos são GERADOS depois do build.
//
// São duas declarações, propositalmente redundantes:
//   1. um par `@license` / `@license-end` carimbado dentro de cada arquivo .js;
//   2. a página de Web Labels (`/jslicense.html`), ligada pelo index.html com
//      rel="jslicense", conforme https://www.gnu.org/licenses/javascript-labels.html
//
// Qualquer uma das duas basta para o LibreJS aceitar o bundle; manter as duas
// significa que uma mudança futura no Vite (inline de um chunk, por exemplo)
// não derruba a conformidade sozinha.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DIST_DIR = join(REPO_ROOT, 'dist');
export const SOURCE_DIR_NAME = 'source';

/**
 * Licença do bundle inteiro.
 *
 * O arquivo emitido mistura o código do Viola Libre (AGPL-3.0) com dependências
 * MIT/ISC/Apache-2.0. Todas são compatíveis com a AGPL, então a obra combinada é
 * distribuída sob a AGPL-3.0 — é essa a licença que o rótulo declara. Os termos
 * originais de cada dependência continuam listados na página, em prosa.
 *
 * O magnet é o identificador canônico que o LibreJS reconhece; sai de
 * common/license_definitions.json do próprio LibreJS. Não invente o hash: um
 * magnet desconhecido faz o script ser tratado como não-livre.
 */
export const LICENSE = {
  id: 'AGPL-3.0',
  magnet: 'magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt',
  humanUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
};

/** Marcadores do par de licença carimbado dentro de cada .js. */
export const LICENSE_OPEN = `// @license ${LICENSE.magnet} ${LICENSE.id}`;
export const LICENSE_CLOSE = '// @license-end';

/** Caminho da página de Web Labels, relativo à raiz do site. */
export const LABELS_PATH = '/jslicense.html';

/** Lista todos os .js emitidos no dist, em caminhos relativos ao dist. */
export function listDistScripts(distDir = DIST_DIR) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // `source/` guarda o tarball do fonte correspondente, não script servido.
        if (relative(distDir, full) === SOURCE_DIR_NAME) continue;
        walk(full);
        continue;
      }
      if (entry.endsWith('.js')) found.push(relative(distDir, full).split('\\').join('/'));
    }
  };
  walk(distDir);
  return found.sort();
}

/** Verifica se um arquivo já carrega o par de licença completo. */
export function hasLicenseTags(absPath) {
  const code = readFileSync(absPath, 'utf8');
  return code.includes(LICENSE.magnet) && code.includes(LICENSE_CLOSE);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
