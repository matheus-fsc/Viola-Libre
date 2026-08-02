// Gera os rótulos de licença LibreJS do build. Roda DEPOIS do `vite build`
// (veja o script "build" no package.json), porque só aí existem os nomes com
// hash dos arquivos emitidos.
//
// O que este script faz, em ordem:
//   1. carimba `@license` / `@license-end` em cada .js do dist;
//   2. gera o tarball do fonte correspondente ao commit que produziu o build;
//   3. escreve dist/jslicense.html com a tabela de Web Labels.
//
// É idempotente: rodar duas vezes sobre o mesmo dist não duplica carimbo.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIST_DIR, LABELS_PATH, LICENSE, LICENSE_CLOSE, LICENSE_OPEN, REPO_ROOT,
  SOURCE_DIR_NAME, escapeHtml, listDistScripts,
} from './librejs-shared.mjs';

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/** Slug owner/repo do remote, para o link de fallback do fonte. */
function repoSlug() {
  try {
    const url = git(['config', '--get', 'remote.origin.url']);
    const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Carimba o par de licença dentro do arquivo.
 *
 * O `@license` vai na PRIMEIRA linha e o `@license-end` na última: o LibreJS
 * considera licenciado tudo que estiver entre os dois, então o par precisa
 * envolver o arquivo inteiro. Não mexe em quem já tem o carimbo (idempotência)
 * nem reordena nada — o minificador já rodou, isto é só concatenação de texto.
 */
function stampLicense(relPath) {
  const abs = join(DIST_DIR, relPath);
  const code = readFileSync(abs, 'utf8');
  if (code.includes(LICENSE.magnet) && code.includes(LICENSE_CLOSE)) return false;
  writeFileSync(abs, `${LICENSE_OPEN}\n${code}\n${LICENSE_CLOSE}\n`, 'utf8');
  return true;
}

/**
 * Empacota o fonte correspondente ao build dentro do próprio dist.
 *
 * A terceira coluna dos Web Labels precisa apontar para o código-fonte daquele
 * arquivo. Como o .js servido é um bundle minificado, o fonte correspondente é
 * a árvore do repositório no commit que gerou o build — `git archive` garante
 * essa correspondência sem depender de rede.
 *
 * Devolve `{ href, label }` para a célula da tabela. Se não houver git (build a
 * partir de um zip, por exemplo), cai no arquivo do GitHub no mesmo commit.
 */
function buildSourceArchive() {
  let sha;
  try {
    sha = git(['rev-parse', 'HEAD']);
  } catch {
    console.warn('[librejs] sem repositório git — a coluna de fonte vai apontar para o branch principal');
    const slug = repoSlug() ?? 'matheus-fsc/Viola-Libre';
    return { href: `https://github.com/${slug}/archive/refs/heads/main.tar.gz`, label: 'main.tar.gz' };
  }

  const short = sha.slice(0, 12);
  const name = `viola-libre-${short}.tar.gz`;

  // Um build com a árvore suja produz um bundle que NENHUM fonte reproduz. Não é
  // motivo para falhar (é o caso normal de um build local de teste), mas quem
  // publicar assim precisa saber que o rótulo estará mentindo.
  try {
    if (git(['status', '--porcelain'])) {
      console.warn('[librejs] árvore de trabalho suja: o tarball do fonte não corresponde exatamente a este bundle');
    }
  } catch { /* ignora: o aviso é opcional */ }

  const outDir = join(DIST_DIR, SOURCE_DIR_NAME);
  mkdirSync(outDir, { recursive: true });
  try {
    git(['archive', '--format=tar.gz', `--prefix=viola-libre-${short}/`, '-o', join(outDir, name), sha]);
    return { href: `/${SOURCE_DIR_NAME}/${name}`, label: name };
  } catch (err) {
    console.warn(`[librejs] git archive falhou (${err.message}) — usando o arquivo do GitHub no commit ${short}`);
    const slug = repoSlug() ?? 'matheus-fsc/Viola-Libre';
    return { href: `https://github.com/${slug}/archive/${sha}.tar.gz`, label: `${short}.tar.gz` };
  }
}

/** Lê nome, versão e licença de cada dependência de runtime instalada. */
function bundledDependencies() {
  return Object.keys(pkg.dependencies ?? {}).sort().map(name => {
    const manifest = join(REPO_ROOT, 'node_modules', name, 'package.json');
    if (!existsSync(manifest)) return { name, version: pkg.dependencies[name], license: 'não instalada' };
    const dep = JSON.parse(readFileSync(manifest, 'utf8'));
    const license = typeof dep.license === 'string' ? dep.license : dep.license?.type ?? 'ver o pacote';
    return { name, version: dep.version, license };
  });
}

function renderLabelsPage(scripts, source, deps) {
  const rows = scripts.map(file => `      <tr>
        <td><a href="/${escapeHtml(file)}">${escapeHtml(file)}</a></td>
        <td><a href="${escapeHtml(LICENSE.magnet)}">${escapeHtml(LICENSE.id)}</a></td>
        <td><a href="${escapeHtml(source.href)}">${escapeHtml(source.label)}</a></td>
      </tr>`).join('\n');

  const depItems = deps.map(dep =>
    `      <li><code>${escapeHtml(dep.name)}</code> ${escapeHtml(dep.version)} — ${escapeHtml(dep.license)}</li>`
  ).join('\n');

  // Página deliberadamente sem JavaScript e sem recurso externo: ela precisa ser
  // legível justamente por quem está com todo o JS bloqueado.
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Licenças do JavaScript — Viola Libre</title>
    <meta name="robots" content="noindex" />
    <style>
      body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 0 auto; padding: 2rem 1rem; line-height: 1.6; color: #1a1a1a; background: #fff; }
      h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin-top: 2rem; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { border: 1px solid #bbb; padding: .4rem .6rem; text-align: left; font-size: .9rem; word-break: break-all; }
      code { background: #f0f0f0; padding: 0 .2rem; }
      ul { padding-left: 1.2rem; }
      @media (prefers-color-scheme: dark) {
        body { color: #e8e8e8; background: #17181a; }
        a { color: #7fb2ff; } th, td { border-color: #444; } code { background: #26282b; }
      }
    </style>
  </head>
  <body>
    <h1>Licenças do JavaScript do Viola Libre</h1>

    <p>
      Esta é a página de <em>JavaScript License Web Labels</em> do site, no formato que o
      <a href="https://www.gnu.org/software/librejs/">GNU LibreJS</a> lê para confirmar que
      todo o JavaScript executado aqui é software livre. A tabela é gerada automaticamente a
      cada build, porque os nomes dos arquivos mudam junto com o conteúdo.
    </p>

    <h2>Arquivos servidos por este site</h2>
    <table id="jslicense-labels1">
${rows}
    </table>

    <p>
      O bundle reúne o código do Viola Libre com bibliotecas de terceiros. Todas as licenças
      envolvidas são compatíveis com a AGPL, então a obra combinada é distribuída sob a
      <a href="${escapeHtml(LICENSE.humanUrl)}">GNU AGPL versão 3</a>; os termos originais de cada
      biblioteca continuam valendo para ela isoladamente. O tarball da terceira coluna é a árvore
      do repositório no commit exato que gerou este build — <code>npm ci &amp;&amp; npm run build</code>
      reconstrói o arquivo minificado a partir dele.
    </p>

    <h2>Bibliotecas incluídas no bundle</h2>
    <ul>
${depItems}
    </ul>

    <h2>JavaScript de terceiros que este site NÃO executa por conta própria</h2>
    <p>
      O player de vídeo do YouTube (<code>https://www.youtube.com/iframe_api</code>) é JavaScript
      não-livre e por isso <strong>nunca</strong> é carregado automaticamente: ele só entra em cena
      depois de um clique explícito, num botão que avisa disso. Todo o resto do site — cifras,
      dicionário de acordes, transposição, auto-rolagem e o editor de timing — funciona sem ele.
    </p>
    <p>
      Os timbres de instrumento vêm de
      <a href="https://github.com/gleitz/midi-js-soundfonts">midi-js-soundfonts</a> (MIT). Apesar da
      extensão <code>.js</code>, esses arquivos são baixados como texto e interpretados como dados de
      áudio; nada neles é executado como programa.
    </p>

    <h2>Código-fonte completo</h2>
    <p>
      O projeto inteiro, incluindo o backend, está em
      <a href="https://github.com/matheus-fsc/Viola-Libre">github.com/matheus-fsc/Viola-Libre</a>
      sob AGPL-3.0-only.
    </p>

    <p><a href="/">← Voltar para o Viola Libre</a></p>
  </body>
</html>
`;
}

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error('[librejs] dist/ não existe — rode o build antes deste script.');
    process.exit(1);
  }

  const scripts = listDistScripts();
  if (scripts.length === 0) {
    console.error('[librejs] nenhum .js encontrado no dist — build incompleto?');
    process.exit(1);
  }

  const stamped = scripts.filter(stampLicense).length;
  const source = buildSourceArchive();
  const deps = bundledDependencies();

  writeFileSync(join(DIST_DIR, 'jslicense.html'), renderLabelsPage(scripts, source, deps), 'utf8');

  console.log(`[librejs] ${scripts.length} script(s) rotulado(s) (${stamped} carimbado(s) agora), fonte em ${source.href}`);
  console.log(`[librejs] página de rótulos: dist${LABELS_PATH}`);
}

main();
