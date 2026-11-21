#!/usr/bin/env bash
# Builds Pickup's own voice (Kokoro-82M, voice af_heart, en-us) into the extension.
# Run once on a dev machine; the output is committed. Nothing runs at install time and
# the extension never downloads anything: model, voice and runtime all ship in the zip.
#
#   scripts/build-voice.sh            # needs npm + curl + network (dev machine only)
#
# What it does
#  1. npm pack kokoro-js@1.2.1 (Apache-2.0; its dist/kokoro.web.js is a prebuilt browser ESM
#     bundle of transformers.js 3.5.1 (Apache-2.0), onnxruntime-web 1.21.0 (MIT) and the
#     phonemizer package, which compiles espeak-ng (GPL-3.0) to wasm). No bundler needed.
#  2. Rewrites the bundle's remote URLs to extension-local paths:
#       voices      https://huggingface.co/.../voices/${e}.bin -> ../model/voices/${e}.bin
#       wasm        https://cdn.jsdelivr.net/...                -> ./ (this folder)
#       models      allowRemoteModels true -> false, allowLocalModels -> true,
#                   localModelPath -> ../ (so model id "model" = src/voice/model/)
#       caches      useBrowserCache -> false (the Cache API refuses chrome-extension:// URLs)
#     and blanks the remaining huggingface.co mentions (doc links inside error strings), so
#     test/check-integration.mjs can FAIL on any remote model URL in src/.
#  3. Copies the ONNX Runtime jsep wasm/mjs next to it, and the q8 model + af_heart style vector
#     into src/voice/model/. Records SHA-256 in src/voice/model/SOURCE.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
VENDOR="$ROOT/src/voice/vendor"
MODEL="$ROOT/src/voice/model"
HF="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
VOICE="af_heart"

mkdir -p "$VENDOR" "$MODEL/onnx" "$MODEL/voices"
(cd "$WORK" && npm pack kokoro-js@1.2.1 @huggingface/transformers@3.5.1 --silent >/dev/null)
mkdir -p "$WORK/k" "$WORK/t"
tar -xzf "$WORK"/kokoro-js-1.2.1.tgz -C "$WORK/k"
tar -xzf "$WORK"/huggingface-transformers-3.5.1.tgz -C "$WORK/t"

node - "$WORK/k/package/dist/kokoro.web.js" "$VENDOR/kokoro.web.js" <<'JS'
const fs = require('fs');
const [src, out] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');
const swap = (from, to) => {
  if (!s.includes(from)) throw new Error(`build-voice: pattern not found: ${from}`);
  s = s.split(from).join(to);
};
swap('`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${e}.bin`', '`${new URL("../model/voices/",import.meta.url).href}${e}.bin`');
swap('`https://cdn.jsdelivr.net/npm/@huggingface/transformers@${n.env.version}/dist/`', 'new URL("./",import.meta.url).href');
swap('allowRemoteModels:!0,remoteHost:"https://huggingface.co/"', 'allowRemoteModels:!1,remoteHost:""');
swap('allowLocalModels:!(s||i),localModelPath:h?n.join(m,b):b,useFS:d,useBrowserCache:o', 'allowLocalModels:!0,localModelPath:new URL("../",import.meta.url).href,useFS:d,useBrowserCache:!1');
swap('["huggingface.co","hf.co"]', '["hf.invalid"]'); // Node-only token header; never sent from the extension
s = s.replace(/https?:\/\/huggingface\.co\/?/g, 'hf-docs/');
fs.writeFileSync(out, '// Vendored by scripts/build-voice.sh from kokoro-js@1.2.1 dist/kokoro.web.js (Apache-2.0; includes transformers.js Apache-2.0, onnxruntime-web MIT, espeak-ng GPL-3.0). Remote URLs rewritten to extension-local paths.\n' + s);
JS
cp "$WORK/t/package/dist/ort-wasm-simd-threaded.jsep.wasm" "$WORK/t/package/dist/ort-wasm-simd-threaded.jsep.mjs" "$VENDOR/"
cp "$WORK/k/package/LICENSE" "$VENDOR/KOKORO-JS-LICENSE.txt"
cp "$WORK/t/package/LICENSE" "$VENDOR/TRANSFORMERS-JS-LICENSE.txt"
# NOTICE.txt (component list, incl. the GPL-3.0 espeak-ng inside phonemizer) is hand-written and committed.

for f in config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx "voices/$VOICE.bin"; do
  curl -fsSL -o "$MODEL/$f" "$HF/$f"
done

{
  echo "# Pickup's voice: sources"
  echo
  echo "Kokoro-82M v1.0 (Apache-2.0, hexgrad), ONNX export by onnx-community, int8 (q8) weights. Voice: \`$VOICE\`, lang en-us, the only voice shipped (its 510x256 style vector)."
  echo "Fetched at build time by \`scripts/build-voice.sh\` from \`$HF/\`; the extension never fetches anything."
  echo
  echo "| File | SHA-256 |"
  echo "|---|---|"
  (cd "$MODEL" && for f in config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx "voices/$VOICE.bin"; do echo "| \`$f\` | \`$(shasum -a 256 "$f" | cut -d' ' -f1)\` |"; done)
  (cd "$VENDOR" && for f in kokoro.web.js ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.jsep.mjs; do echo "| \`../vendor/$f\` | \`$(shasum -a 256 "$f" | cut -d' ' -f1)\` |"; done)
} > "$MODEL/SOURCE.md"
echo "build-voice: done. $(du -sh "$ROOT/src/voice/model" "$VENDOR" | tr '\n' ' ')"
