# Story scroll frame timing (measured 2026-11-21)

Method: `scratchpad/fps.mjs` (headless Chrome for Testing 157, isolated profile, 1440×900, DPR 1). It scrolls from 200 px before `#story` to 200 px after its pinned range in 360 rAF-driven steps and records the rAF deltas in the page. Both canvases (hero, story) were mounted.

| Renderer | CPU throttle | Avg fps | p50 | p95 | Frames > 50 ms |
|---|---|---|---|---|---|
| ANGLE Metal, Apple M5 Pro (GPU) | 1× | 58.1 | 16.7 ms | 16.8 ms | 2 of 359 |
| ANGLE Metal, Apple M5 Pro (GPU) | 4× | 59.5 | 16.7 ms | 16.8 ms | 1 of 359 |
| SwiftShader (software GL, no GPU) | 1× | 24.3 | 33.3 ms | 50.1 ms | 25 of 359 |

Reading: smooth on a GPU even with the CPU slowed 4×. Software rendering (no GPU, as in headless Lighthouse) is far slower; that is also why Lighthouse's TBT is high in headless runs. This is one machine; no phone was measured (phones get the stacked story with no WebGL).
