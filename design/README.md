# Plover brand design

The starting brand direction is **quiet company**: sage and cream, a calm side-peeking bird, lowercase **plover** in **Nunito 700**, and **Lexend** for all other text.

## Start here

- [Interactive design-system review](system/review.html): current priority; compare light/dark components and proposed choices before further build-out. [Preview instructions](system/README.md).

- [Wordmark lockup preview](logo-concepts/wordmark-draft/preview.png) — horizontal and stacked lockups, everyday sizes, website and app header examples. Accepted as a starting point on 2026-10-04.
- [HTML preview](logo-concepts/wordmark-draft/index.html) — open locally in a browser.
- [Edge-motif study](brand/renders/edge-motif-study.png): landing-page, app and message-card layouts, pending review.
- [Design handoff](HANDOFF.md) — locked decisions and remaining work.
- [Dark-mode comparison](brand/renders/dark-mode-compare.png): option A accepted as the starting treatment: deep-ink pages with ink cards.
- [Brand direction board](brand/renders/brand-direction.png) — palette, light/dark treatments, voice and motifs.

## Vector assets

- [Horizontal lockup](logo-concepts/wordmark-draft/plover-horizontal.svg)
- [Stacked lockup](logo-concepts/wordmark-draft/plover-stacked.svg)
- [Wordmark only](logo-concepts/wordmark-draft/plover-wordmark.svg)
- [Symbol only](logo-concepts/wordmark-draft/plover-symbol.svg)

The wordmark contains outlined paths and needs no installed fonts. The SVGs preserve the approved symbol artwork. The proportions are an initial baseline and can be refined.

## Rebuild the wordmark

From the repository root:

```sh
npm ci --prefix design/wordmark-tools
node design/wordmark-tools/build.cjs
```

This uses the local Nunito WOFF2, converts it to a TrueType font in memory, instantiates weight 700, applies kerning and pair spacing, and regenerates the SVGs and HTML preview. It does not regenerate the PNG screenshot.

Local variable fonts and their Open Font License notices live in `brand/fonts/`. Earlier mascot, logo and desktop-buddy explorations are retained in their respective directories. Some historical generators rely on the original designer's local tools; see the handoff for those paths.

These are design artifacts. The Electron app's existing branding has not been changed.
