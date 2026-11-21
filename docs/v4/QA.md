# V4 QA log

One entry per review round: what was looked at, the three biggest weaknesses, what changed.

## Round 1 — first full render (about 10:20 AM), `/tmp` shots, then `docs/v4/after/`
Looked at: hero, Interrupted, story (Park), Return demo, features at 1440; hero at 375.
1. Hero headline clipped its comma: the display size (7.2vw, 104 px max) was wider than the copy column. → display token now `clamp(44px, 6.1vw, 96px)`, title max 11ch, mask has right padding.
2. Features: a tall gap beside the Pickup-panel screenshot (grid centred on a 1600-tall image). → support grid `0.34fr / 1fr`, aligned to the top.
3. The laptop is the temporary stand-in until the Blender model lands (lane L). Not judged yet.

## Round 2 — material playground (`web/playground.html`, dev only)
Shots: `docs/v4/after/playground-1440.png`, `playground-375.png`.
1. Glass read as soft opaque cards, not glass: fills too strong (0.46/0.78 white) and the light volumes too faint for anything to show through. → glass fill 0.30, strong fill 0.60, tints ~0.46; light volumes deeper (lilac 190,162,255 at .95; mint, blush, peach similar), blur 48 px.
2. Contrast after thinning the glass was unproven over the new, deeper lights. → `web/scripts/contrast.mjs` now also measures text on glass over light-lilac and light-blush: plum ≥ 10.8:1, plum-2 ≥ 6.36:1. All pass.
3. Playground bug: its light volumes were forced to `position: relative`, so nothing sat behind the glass. → fixed. After: the crystal tile visibly carries the mint light through it; the nav picks up lilac.
