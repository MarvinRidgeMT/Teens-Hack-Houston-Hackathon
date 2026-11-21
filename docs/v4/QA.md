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

## Round 3 — real laptop + story (≈10:33–10:36)
1. Aluminium rendered dark grey: metal reflects only the environment and the studio was too dim. → brighter Lightformers (overhead, back softbox, front card, floor bounce), lighter base colour, exposure 1.2.
2. Return scene card too small to read with the whole-laptop fit. → `close: true` pose skips the fit (base may crop) and the canvas fades at the bottom.
3. Site copy said "drought statistic" while the real captured card says "the 2023 rainfall number". → copy matches the capture everywhere.

## Round 4 — QA tooling (≈10:37–10:43)
- axe 0 violations (motion and reduced). Overflow: none at 320/375/430/768/1024/1440/1920 after fixing the device base (−7% margin) and feature-panel min-width.
- Lighthouse (gzip server, CfT headless, SwiftShader): mobile FCP 2.1 s, LCP 4.0 s, CLS 0, TBT ≈2.2–2.6 s (one 3.3 s "unattributable" task that starts before any script — software raster); desktop FCP 0.5 s, LCP 1.4 s, CLS 0. A11y/Best practices/SEO 100. Changes that got here: build-time prerender + hydration, hero text never hidden by the intro, mobile poster `srcset` + `fetchpriority`.
- Story frame timing on a GPU: 58–60 fps, p95 16.8 ms (fps.md).

## Round 5 — finish review "fix-then-ship" (≈10:55–11:04), all applied
1. Phones showed the v3 card on the laptop poster → poster re-rendered in Blender with the V4 screen.
2. Park scene: the fading task chip crossed the screen → it exits left before the camera turns.
3. Laptop finish → darker keys (env 0.35), second rim light, lavender-plum contact shadow at 0.34.
4. Return demo "crystal" on white had nothing to refract → tinted page + lilac light behind the card.
5. Honesty → "How to install" / "Install" CTAs while the download isn't live; GitHub links hidden while the repo is private (`LINKS.repoPublic`); one tab count (3 in the group).
6. DIRECTION.md gained THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM (`seed: none (pinned)`) / FINISH.
7. Install's four equal shortcut cards → one keyboard legend table.
8. Type → keycap tracking 0, display −0.04 em, two-tone headline only in hero and final CTA, story pills on one row ≥1280.
Also from the detector: keycaps use an inset edge, no purple gradients, tab group as a tint, placeholder contrast, no stragglers; from the documenter: no eyebrows, icon not glyph, caret stops after 4 blinks.
- Bugs found by our own anchor test: deep link `#return-card` landed inside the story (fixed: re-scroll after the pin exists); anchors landed 184 px low (one offset now); step pill led the caption (now both read the timeline).

## Round 6 — code review (react-reviewer agent, ≈11:05–11:15), all fixed and re-verified
Bugs: malformed `#…` hash blanked the page (safe decode); "How it works" never highlighted on desktop (stable `#story` wrapper across the stacked→pinned swap); stale story state after remount (reset on cleanup); Return card keys died after Tidy and focus fell to `<body>` on close (`aria-disabled`, focus moves to "Show the card again" and back to Resume); token check let single-quoted hex through (regex fixed, verified). Risks: WebGL probe leaked contexts (probe once, `loseContext`); story laptop replayed the lid opening (hero only); 5 screen textures per canvas (hero draws 1); reduced-motion toggle could leave the lid shut; magnetic buttons' hover lift fought the magnet (lift now uses CSS `translate`); "Esc skip" and "T" hints did nothing (handlers added); reload mid-page landed in the wrong place after the layout swap (position saved and restored).
Verified in Chrome for Testing (Metal): malformed hash renders; `#story` deep link top −0.5 px; nav `aria-current="#story"` while in the story; Tidy via Enter keeps card keys alive; Esc → focus "Show the card again"; Enter → card back, focus Resume; no console errors. axe 0, no overflow 320–1920.
