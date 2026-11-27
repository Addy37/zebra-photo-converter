import { defineConfig } from 'vite';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Phase 1: keep the existing classic-script order and public asset paths.
// Later, migrate individual feature files to typed ES modules.
const root = import.meta.dirname;
const staticAssets = [
  'app', 'icons', 'manifest.webmanifest', 'beta.webmanifest',
  'addy-buy-catalog-v2.csv.gz', 'scanner.js', 'scanner-beta23.js',
] as const;

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        stable: resolve(root, 'index.html'),
        beta: resolve(root, 'beta.html'),
      },
    },
  },
  plugins: [{
    name: 'preserve-warehouse-static-assets',
    apply: 'build',
    writeBundle(options) {
      const output = resolve(root, options.dir ?? 'dist');
      mkdirSync(output, { recursive: true });
      for (const asset of staticAssets) {
        cpSync(resolve(root, asset), resolve(output, asset), { recursive: true });
      }
    },
  }],
});
