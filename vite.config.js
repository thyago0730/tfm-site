import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

const root = import.meta.dirname;
// páginas geradas por scripts/build-pages.mjs
const generated = Object.fromEntries(
  ['processos', 'setores'].flatMap((dir) =>
    existsSync(resolve(root, dir))
      ? readdirSync(resolve(root, dir)).filter((f) => f.endsWith('.html')).map((f) => [`${dir}-${f.replace('.html', '')}`, resolve(root, dir, f)])
      : []
  )
);

export default defineConfig({
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        privacidade: resolve(root, 'privacidade.html'),
        notFound: resolve(root, '404.html'),
        ...generated,
      },
    },
  },
});
