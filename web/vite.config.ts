/**
 * Vite build of the browser application (adr-002), served by the local server from `web/dist`.
 * `--mode keys` builds the key-rendering variant into `web/dist-keys` (spec-008 §6): the catalogue
 * `src/i18n/en.json` is replaced by its key catalogue at load time.
 */
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { CATALOGUE_FILE, keyCatalogue } from './scripts/catalogue.mjs';

const WEB = path.dirname(fileURLToPath(import.meta.url));

/** Serves the key catalogue in place of `en.json` (still JSON, so Vite's JSON plugin handles it). */
function keyRendering(): Plugin {
  return {
    name: 'wfui-key-catalogue',
    enforce: 'pre',
    async load(id) {
      if (path.resolve(id.split('?')[0] ?? '') !== CATALOGUE_FILE) return null;
      const catalogue = JSON.parse(await readFile(CATALOGUE_FILE, 'utf8')) as Record<string, string>;
      return JSON.stringify(keyCatalogue(catalogue));
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: WEB,
  base: '/',
  plugins: [react(), ...(mode === 'keys' ? [keyRendering()] : [])],
  build: {
    outDir: path.join(WEB, mode === 'keys' ? 'dist-keys' : 'dist'),
    emptyOutDir: true,
    // Build files under `assets/`: the only path prefix the server answers 404 for (task-002).
    assetsDir: 'assets',
    // No source maps in the shipped build (web/dist is served as is by the console).
    sourcemap: false,
    // One chunk for a locally served application (adr-002 accepts React's size; REQ-PERF-04 is
    // measured in task-021).
    chunkSizeWarningLimit: 1024,
  },
}));
