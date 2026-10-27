---
name: plover-env-and-backend
description: Use when task breakdown from the extension fails with "Server responded with status 404" against a local plover-server, or the extension talks to the wrong backend port, or when adding/moving WXT_* env var reads in extension/.
---

# Plover env and backend URL wiring

## Overview

The extension reads `WXT_*` vars from `extension/.env` (see `extension/.env.example`); `WXT_PLOVER_BACKEND_URL` is the `plover-server` base URL.

## Quick reference

| Symptom / error                                                                     | Fix                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task breakdown fails with `Server responded with status 404` against a local server | Port 3000 is occupied by another local service; move `plover-server` to another port and set `WXT_PLOVER_BACKEND_URL` to match, then restart `pnpm dev` |

## Details

### Port 3000 collisions break task breakdown

**Symptom:** `POST /api/decompose` fails with `Server responded with status 404`.

**Root cause:** `plover-server` defaults to port `3000`. If another local service (e.g. a Next.js dev server) already occupies it, requests hit the other service and return 404.

**Fix:** Set `PORT=3001` (or another free port) in the `plover-server` checkout's `.env`, set `WXT_PLOVER_BACKEND_URL=http://localhost:3001` in `extension/.env`, and restart both. WXT bakes `WXT_*` vars at build time, so restart `pnpm dev` after editing `extension/.env`.
