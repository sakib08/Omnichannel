#!/usr/bin/env bash
# Copy runtime assets into the plugin tree before packaging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/node_modules/@tabler/icons-webfont/dist"
DEST="$ROOT/assets/tabler-icons"
FONTS="$DEST/fonts"

mkdir -p "$FONTS"
cp "$SRC/tabler-icons.min.css" "$DEST/"
cp "$ROOT/node_modules/@tabler/icons-webfont/LICENSE" "$DEST/LICENSE"

# Only the font files referenced by tabler-icons.min.css (skip huge SVG variants).
rm -f "$FONTS"/*
cp "$SRC/fonts/tabler-icons.woff2" "$FONTS/"
cp "$SRC/fonts/tabler-icons.woff" "$FONTS/"
cp "$SRC/fonts/tabler-icons.ttf" "$FONTS/"
