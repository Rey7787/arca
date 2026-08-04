import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A versao do app vem do package.json e e injetada no bundle como
// __APP_VERSION__. Numero escrito na mao dentro do codigo vira mentira no
// primeiro release em que alguem esquece de atualizar - foi o que aconteceu
// com o APP_VERSION do backup, que dizia 0.3.0 enquanto o app era 0.1.0.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

// base: precisa ser o nome do repositorio no GitHub Pages.
// Ex.: https://usuario.github.io/arca/  ->  base: '/arca/'
export default defineConfig({
  base: '/arca/',
  plugins: [preact()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: false },
});
