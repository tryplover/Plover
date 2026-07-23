import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Load env vars at build time so they are baked into define
const appEnv = resolve('app/.env');
const rootEnv = resolve('.env');
if (existsSync(appEnv)) {
  process.loadEnvFile(appEnv);
} else if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const pkgVersion = (
  JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }
).version;

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
        external: [
          'electron',
          'better-sqlite3',
          'chokidar',
          'get-windows',
          'keytar',
          'google-auth-library',
          'googleapis',
          '@google/generative-ai',
          '@supabase/supabase-js',
        ],
      },
    },
    define: {
      // Bake an empty string when the env var is unset at build time so
      // `if (fromVite)` in the main-process consumers falls through to
      // `process.env.PLOVER_BACKEND_URL` at runtime (populated from
      // `app/.env` via `load-env.ts`). Otherwise a build-time default here
      // silently shadows whatever the user set in `app/.env`.
      'import.meta.env.PLOVER_BACKEND_URL': JSON.stringify(process.env.PLOVER_BACKEND_URL ?? ''),
      'import.meta.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL ?? ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID ?? ''),
      'import.meta.env.GOOGLE_CLIENT_SECRET': JSON.stringify(
        process.env.GOOGLE_CLIENT_SECRET ?? '',
      ),
    },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          companion: resolve('src/renderer/companion/index.html'),
        },
      },
    },
    define: {
      'import.meta.env.PLOVER_VERSION': JSON.stringify(pkgVersion),
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
});
