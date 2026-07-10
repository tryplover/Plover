# Diagrams

Architecture and sequence diagrams for the Plover project. Mermaid source
(`.mmd`) is the source of truth; SVGs are regenerated from it and committed
alongside so GitHub renders them directly.

## Files

- `core-architecture.mmd` / `core-architecture.svg` — Topology after the
  server extraction: Electron client, Cloud Run `plover-server`, Firestore,
  Secret Manager, Artifact Registry, and the external Google OAuth /
  Gemini / Calendar-Docs APIs. Shows both the per-request path
  (`X-Plover-Auth-Token` → Cloud Run → Gemini) and the browser-mediated
  signup path (`shell.openExternal` → `/signup` → OAuth → `plover://` deep
  link).
- `seq-diagram.mmd` / `seq-diagram.svg` — Two sequences in one file:
  1. First-launch signup with the `state` nonce round-trip.
  2. Normal `/api/decompose` call through `authMiddleware` + Firestore
     rate limiter to Gemini, with `alt` branches for 401 and 429.

## Regenerating the SVGs

After editing any `.mmd` file, regenerate its SVG and commit both:

```sh
cd docs/diagrams
npx --package=@mermaid-js/mermaid-cli mmdc -i core-architecture.mmd -o core-architecture.svg
npx --package=@mermaid-js/mermaid-cli mmdc -i seq-diagram.mmd -o seq-diagram.svg
```

The first run downloads a headless Chromium via Puppeteer (~150 MB) — one-off
cost. Subsequent runs are fast.

## Design source

See [`docs/superpowers/specs/2026-07-10-server-cloud-run-extraction-design.md`](../superpowers/specs/2026-07-10-server-cloud-run-extraction-design.md)
for the authoritative topology, request-flow, and signup-flow descriptions
these diagrams visualize.
