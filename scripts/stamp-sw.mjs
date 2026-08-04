/**
 * Carimba a versão do cache no service worker publicado.
 *
 * Roda DEPOIS do `vite build`, em cima de dist/sw.js — nunca no arquivo de
 * origem em public/, que continua com o placeholder.
 *
 * A versão é `<versão do package.json>-<hash do conteúdo de dist>`. O hash
 * entra porque a versão do package.json é fácil de esquecer de subir: se
 * qualquer byte publicado mudou, o nome do cache muda junto e o worker novo
 * apaga o antigo no activate. Sem isso, um deploy com a mesma versão deixaria
 * o navegador servindo JavaScript velho para sempre.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = process.cwd();
const dist = resolve(raiz, 'dist');
const swPath = join(dist, 'sw.js');

function falhar(mensagem) {
  console.error(`\n✗ stamp-sw: ${mensagem}\n`);
  process.exit(1);
}

/** Lista todos os arquivos de dist, menos o próprio sw.js, em ordem estável. */
function listarArquivos(dir, acc = []) {
  for (const nome of readdirSync(dir).sort()) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) listarArquivos(caminho, acc);
    else if (caminho !== swPath) acc.push(caminho);
  }
  return acc;
}

let sw;
try {
  sw = readFileSync(swPath, 'utf8');
} catch {
  falhar('dist/sw.js não existe. Rode o vite build antes.');
}

if (!sw.includes('__ARCA_VERSION__')) {
  falhar('o placeholder __ARCA_VERSION__ sumiu do sw.js — o cache ficaria com nome fixo.');
}

const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8'));

const hash = createHash('sha256');
for (const arquivo of listarArquivos(dist)) {
  hash.update(arquivo.slice(dist.length).replace(/\\/g, '/'));
  hash.update(readFileSync(arquivo));
}
const carimbo = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;

writeFileSync(swPath, sw.replaceAll('__ARCA_VERSION__', carimbo), 'utf8');
console.log(`✓ Service worker carimbado: arca-${carimbo}`);
