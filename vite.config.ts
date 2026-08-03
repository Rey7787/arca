import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

// base: precisa ser o nome do repositório no GitHub Pages.
// Ex.: https://usuario.github.io/arca/  ->  base: '/arca/'
export default defineConfig({
  base: '/arca/',
  plugins: [preact()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: { target: 'es2022', sourcemap: false },
});
