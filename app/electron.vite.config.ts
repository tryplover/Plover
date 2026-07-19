import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve('.'), '');

  return {
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
        'import.meta.env.PLOVER_BACKEND_URL': JSON.stringify(
          env.PLOVER_BACKEND_URL || 'http://localhost:3000',
        ),
        'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
        'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
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
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer'),
          '@shared': resolve('src/shared'),
        },
      },
      plugins: [react()],
    },
  };
});
