#!/usr/bin/env bash
set -euo pipefail

# Plover setup script for Jules (and other CI-like environments).
# Assumes Node 22 is already available (see .nvmrc).

corepack enable
corepack prepare pnpm@10.26.0 --activate

pnpm install --frozen-lockfile

echo "Plover setup complete."
