---
name: plover-electron-vite-build
description: Use when an electron-vite build or dev run breaks with "Electron failed to install correctly. Please delete node_modules/electron" or getElectronPath errors, "SyntaxError: Identifier '__dirname' has already been declared", a blank white screen with DevTools console error "Uncaught TypeError: Cannot read properties of undefined (reading 'S')" in react-dom_client.js, the preload script not found at runtime because it built as index.mjs instead of index.js, or a BrowserWindow loading the wrong page (e.g. the main app instead of a secondary window) in pnpm dev vs a packaged build.
---

# Plover electron-vite build footguns

## Overview
Footguns specific to bundling/running this Electron app with `electron-vite` under a pnpm workspace: dependency externalization, `__dirname` shims, React version pinning, preload output format, and dev-vs-prod URL/path parity for non-main-window entries.

## Quick reference
| Symptom / error | Fix |
|---|---|
| `Error: Electron failed to install correctly. Please delete node_modules/electron...` / `getElectronPath` errors on `pnpm dev` | Add `electron`, `better-sqlite3`, `keytar` (and other native/node modules) to `build.rollupOptions.external` under `main` and `preload` in `app/electron.vite.config.ts` |
| `SyntaxError: Identifier '__dirname' has already been declared` | Delete any manual `const __dirname = ...` in source files; use Node's native `import.meta.dirname` directly (Node 20.11+) |
| Blank white screen; `Uncaught TypeError: Cannot read properties of undefined (reading 'S')` at `react-dom_client.js` | Keep `react` and `react-dom` (+ `@types/react-dom`) on the same major version in `app/package.json`, e.g. both pinned `^18.3.1`; re-run `pnpm install` |
| Main process can't find preload script (`../preload/index.js` missing at runtime; built file is `index.mjs`) | In the preload config of `app/electron.vite.config.ts`, force Rollup output `format: 'cjs'` and `entryFileNames: '[name].js'` |
| A secondary `BrowserWindow` (e.g. companion overlay) renders the main app instead of its own page in dev mode | Make the dev `loadURL` path match the prod `loadFile` path's directory structure — see Details below |

## Details

### Dependency externalization under pnpm workspace
**Symptom:** `pnpm dev` fails with `Error: Electron failed to install correctly. Please delete node_modules/electron...` and `getElectronPath` errors.
**Root cause:** Under a pnpm workspace, packages resolve through the symlinked `.pnpm` virtual store, so electron-vite's automatic dependency externalization fails to match dependency/path correctly. This causes the main process to bundle packages like `electron` and native dependencies (`better-sqlite3`, `keytar`) inline. At runtime, the bundled `electron/index.js` wrapper tries to run installer scripts using a relative path that doesn't exist in `out/main/`.
**Fix:** Explicitly configure `build.rollupOptions.external` under `main` and `preload` in `app/electron.vite.config.ts` to keep `electron`, `better-sqlite3`, `keytar`, and other node modules external.

### Duplicate `__dirname` declaration
**Symptom:** `pnpm dev` fails with `SyntaxError: Identifier '__dirname' has already been declared`.
**Root cause:** Vite/Rolldown injects a CommonJS-style global shim block containing `const __dirname = import.meta.dirname;` at the top of the bundle. If `src/main/index.ts` also declares its own `const __dirname = ...` at the top level of the ESM file, they clash in the same module scope.
**Fix:** Replace manual `const __dirname` declarations with direct use of `import.meta.dirname` (fully supported in Node 20.11+).

### React / react-dom version mismatch
**Symptom:** The Electron window opens but renders a completely blank white screen; DevTools console shows `Uncaught TypeError: Cannot read properties of undefined (reading 'S')` at `react-dom_client.js`.
**Root cause:** `react` pinned to `^18.3.1` while `react-dom`/`@types/react-dom` get bumped to 19 (e.g. by Dependabot). React DOM 19's client init code looks for React 19-specific internal dispatcher symbols (like `S`) on the loaded React 18 instance, throwing a TypeError during mount.
**Fix:** Downgrade `react-dom` and `@types/react-dom` back to `^18.3.1` in `app/package.json` to match `react`, then run `pnpm install`. Keep these versions in lockstep going forward.

### Preload output `.mjs` instead of `.js`
**Symptom:** The main process loads `../preload/index.js` but the built preload script is output as `index.mjs`, causing a runtime file-not-found error in Electron.
**Root cause:** With `"type": "module"` set in `package.json`, Vite/Rollup defaults to building outputs as ESM (`.mjs`) even when `entryFileNames: '[name].js'` is specified.
**Fix:** In the preload config's Rollup output options in `electron.vite.config.ts`, force CommonJS format (`format: 'cjs'`) and set `entryFileNames: '[name].js'`.

### Dev `loadURL` vs prod `loadFile` path mismatch for secondary windows
**Symptom:** A secondary `BrowserWindow` (e.g. the companion overlay in `app/src/main/windows/companion.ts`) renders the entire main app window (full Home Dashboard, sidebar nav, title bar) instead of its own small page, at full window size instead of its intended dimensions.
**Root cause:** The window's two load paths didn't agree. The production path (`win.loadFile(join(..., '../renderer/companion/index.html'))`) correctly targets the file at its real location, `src/renderer/companion/index.html`. But the dev path (`win.loadURL(\`${process.env.ELECTRON_RENDERER_URL}/companion.html\`)`) requested a flat `/companion.html`, which doesn't exist under Vite's dev server (root = `src/renderer`, so the file is actually served at `/companion/index.html`). Vite's dev server has no route for the flat path and falls back to serving the root `index.html` (the main app's entry), so `main.tsx`'s `?variant=` branching logic runs with no variant and mounts the default `<App />` shell.
**Fix:** Make the dev URL match the production `loadFile` path's structure: `` `${process.env.ELECTRON_RENDERER_URL}/companion/index.html` ``, not `/companion.html`. General lesson: when a `BrowserWindow` has separate `loadURL` (dev) / `loadFile` (prod) branches for a non-root HTML entry, verify both branches resolve to the *same* file — Vite serves dev files at their real path relative to `root`, which is easy to get wrong by analogy with the production build's flattened-looking `entryFileNames` output naming.
