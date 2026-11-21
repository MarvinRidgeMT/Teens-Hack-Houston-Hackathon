#!/usr/bin/env bash
# Builds pickup-v<version>.zip from only what the extension needs:
# manifest.json, src/ and assets/. Everything else in the repo (test/, web/, site/, docs/,
# design/, handoff/, node_modules/, package*.json, dotfiles, ...) is left out because it is
# never copied in. Inside src/, developer notes (*.md other than the vendor licences) are dropped.
#
#   scripts/make-release.sh            # writes ./pickup-v1.0.0.zip and ./build/pickup-v1.0.0/
#
# Note: src/voice/spike.{html,js,css} and spike-log.js stay in: the Pickup panel's
# Diagnostics button opens spike.html, and the voice enable page loads spike.css and spike-log.js.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Ship only committed files: a local edit or scratch file in src/ or assets/ must not slip in.
if [ -n "$(git status --porcelain -- manifest.json src assets)" ] && [ "${ALLOW_DIRTY:-}" != 1 ]; then
  echo "manifest.json, src/ or assets/ has uncommitted changes; commit them first (or ALLOW_DIRTY=1):" >&2
  git status --short -- manifest.json src assets >&2
  exit 1
fi

VERSION="$(node -p "require('./manifest.json').version")"
NAME="pickup-v${VERSION}"
STAGE="build/${NAME}"
ZIP="${NAME}.zip"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"

cp manifest.json "$STAGE/"
cp -R assets "$STAGE/assets"
cp -R src "$STAGE/src"

# Developer-only files inside the shipped folders.
find "$STAGE" -name '.*' -prune -exec rm -rf {} +           # dotfiles (.DS_Store, ...)
find "$STAGE/src" -name '*.md' ! -path '*/src/vendor/*' -delete  # src/sw/README.md etc.

# Every file the manifest names must be in the zip.
node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1], m = require(path.resolve(dir, "manifest.json"));
const refs = [m.background.service_worker, m.action.default_popup, m.options_page, m.side_panel.default_path,
  ...Object.values(m.icons), ...Object.values(m.action.default_icon),
  ...m.web_accessible_resources.flatMap((w) => w.resources)];
const missing = refs.filter((r) => !fs.existsSync(path.join(dir, r)));
if (missing.length) { console.error("missing from the zip: " + missing.join(", ")); process.exit(1); }
' "$STAGE"

(cd build && zip -qrX "../$ZIP" "$NAME")

echo "wrote $ZIP ($(du -h "$ZIP" | cut -f1), $(unzip -Z1 "$ZIP" | grep -vc '/$') files)"
