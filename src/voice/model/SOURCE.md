# Pickup's voice: sources

Kokoro-82M v1.0 (Apache-2.0, hexgrad), ONNX export by onnx-community, int8 (q8) weights. Voice: `af_heart`, lang en-us, the only voice shipped (its 510x256 style vector).
Fetched at build time by `scripts/build-voice.sh` from `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/`; the extension never fetches anything.

| File | SHA-256 |
|---|---|
| `config.json` | `df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f` |
| `tokenizer.json` | `77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34` |
| `tokenizer_config.json` | `be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20` |
| `onnx/model_quantized.onnx` | `fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478` |
| `voices/af_heart.bin` | `d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b` |
| `../vendor/kokoro.web.js` | `643d7c0553a254a40f3bbe68955af92edd7f851b192f1e49c743e3cf835a4859` |
| `../vendor/ort-wasm-simd-threaded.jsep.wasm` | `c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39` |
| `../vendor/ort-wasm-simd-threaded.jsep.mjs` | `08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9` |
