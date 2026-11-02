#!/usr/bin/env bash
set -euo pipefail
# Dependency/build artifacts stay outside the repository. System Chromium required.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(realpath -m "${1:?Usage: render.sh /absolute/external/workspace}")
case "$WORK/" in "$ROOT/"*) echo 'Refusing workspace inside repository' >&2; exit 2;; esac
case "$ROOT/" in "$WORK/"*) echo 'Refusing repository ancestor as workspace' >&2; exit 2;; esac
mkdir -p "$WORK/template/src/shots" "$WORK/template/src/common" "$WORK/examples/character-action-contract" "$WORK/out"
cp -R "$ROOT/template/src/shots/character-action" "$WORK/template/src/shots/"
cp -R "$ROOT/template/src/common/riso" "$WORK/template/src/common/"
cp "$ROOT/examples/character-action-contract/"*.json "$WORK/examples/character-action-contract/"
cp "$ROOT/examples/character-action-contract/render-entry.tsx" "$WORK/examples/character-action-contract/"
cd "$WORK"
if [[ ! -f package.json ]]; then
  printf '%s\n' '{"private":true,"dependencies":{"@remotion/cli":"4.0.507","remotion":"4.0.507","react":"19.2.8","react-dom":"19.2.8","typescript":"5.9.3","@types/react":"19.2.14"}}' > package.json
fi
if [[ ! -d node_modules/remotion ]]; then npm install --cache "$WORK/npm-cache" --ignore-scripts --no-audit --no-fund; fi
for ID in CharacterAction CharacterActionLateContact; do
 ./node_modules/.bin/remotion render examples/character-action-contract/render-entry.tsx "$ID" "out/$ID.mp4" --browser-executable=/usr/bin/chromium --concurrency=2 --codec=h264 --crf=18
 done
