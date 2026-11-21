# Design system source

- **Artifact:** "Pickup" design system, claude.ai artifact `0e61fa6e-37fa-4e16-b05c-509605f1076d`
  (https://claude.ai/artifact/2n1bpLQ2uMCCgeQ9oe8e7v), version `1795200568-445e`.
  Last change by Sid, 2026-11-20 18:49 UTC.
- **Copied:** `README.md`, `tokens.json`, `design-system.json`, every component's
  `README.md` and `preview.html`, and `components/bundle.css`.
- **Changed on copy:** `bundle.css` lost its `@import` of Google Fonts. The extension
  never loads fonts from the network; Inter is bundled in `assets/fonts/`.
- **Not copied:** `components/lib/motion.js` (Motion v11.18.2, sha256 `88f37284…`).
  The repo keeps one copy of Motion: Sidd's `src/vendor/motion.js` on `sid/content`
  (sha256 `521cfef8…`, a different build). Extension pages (panel, popup, setup,
  dashboard) animate with CSS using the tokens' easings, so they need no Motion copy.
- These files are styling data. The working CSS that every Pickup page loads is
  `src/shared/tokens.css` (custom properties, both themes, `@font-face`) and
  `src/shared/pk.css` (the component classes).

## Font

`assets/fonts/InterVariable.woff2`: Inter 4.001 (git 9221beed3), axes `opsz` 14–32
and `wght` 100–900, "Copyright 2016 The Inter Project Authors", SIL OFL 1.1
(`assets/fonts/OFL.txt`). Taken from a local copy already on this machine (the
CE.SDK npm cache), checked by reading the font's own name table.

## Palette: "Warm Desk, Teal Spark" (Fri Nov 20, evening)

Spec: `design/Student_focus_app_colour_palettes.md`, "Recommended direction". Token names are unchanged (components need no edits). New tokens: `accent-tint`, `accent-tint-ink`, `resume`, `resume-tint`, `spark`, `on-spark`, `reward`, `on-reward`, `rest`, `danger`. Old names point at new ones: `mist` → `resume-tint`, `periwinkle` and `focus-ring` → `resume`. Teal (`accent`) replaces black as the one primary per view.

Values I picked where the spec said "pick" (all checked by `test/contrast.test.mjs`):
- `border-strong` dark `#717785`: 3.63:1 on surface `#1c2029`.
- `accent-tint` dark: `#173b38`, with `accent-tint-ink` `#7ee8da` (8.40:1).
- `resume-tint` dark `#2a2750`: `ink` 11.39:1, `resume` 5.91:1, `ink-body` 5.33:1.
- `on-spark` and `on-reward` are `#1e2230` light and `#14171f` dark: text on those fills is always dark, because light ink on a spark or reward fill is 1.3–1.5:1.

## Palette: "Sage & Ink" (Fri Nov 20, late; branch `palette/v2`, not shipped)

Replaces Warm Desk, Teal Spark on the branch only. Same token names, so no component CSS changed; `src/content/` (Sidd's card and overlay) is untouched and still uses its own spark-teal values.

- **Source:** UI UX Pro Max (`nextlevelbuilder/ui-ux-pro-max-skill` 2.15.0) `--design-system` and `--domain color` searches for a calm student focus tool, filtered to Pickup's rules: no pure white or black canvas, red only for Delete all, away never red or amber, Inter stays bundled (the skill suggested Plus Jakarta Sans from Google Fonts; not taken). Anish chose the Sage & Ink direction from three that all passed contrast.
- **Roles:** sage `accent` `#3b6b57` / `#8fcfb2` is the one primary; slate-blue `resume` `#3f57a0` / `#9db1f0` (with `resume-tint` `#e9edf8` / `#242c44`) carries the "pick up here" moment, the focus ring and the parked badge; neutrals are green-tinted (`ink` `#1f2421`, `ink-body` `#5b625d`; dark `paper` `#121614`, `surface` `#1a201d`). `spark` became mint `#7fd1ae` (fill only); `reward` and `danger` are unchanged.
- **Paper:** `#f2f4f1`, a sage-tinted off-white. The first pick, `#f6f5f0`, was flagged by Impeccable 4.10's `detect` (rendered pages) as the reflex cream background, so it moved toward the palette's own hue.
- **Calm:** accent `#4a6a5d` / `#a3c4b5`, resume `#52608c` / `#aeb7d6`, spark `#a9d3c1` / `#9cc4b3`.
- **Checked:** `test/contrast.test.mjs`, 69 pairs in light, dark and Calm. Lowest: `border-strong` (UI, 3:1 floor) and `ink-body` on `resume-tint`.

### Motion that came with it
- **Palette cross-fade** (`src/shared/theme.js`): when the OS switches light/dark or Calm changes, colours ease over `duration-base` with `ease-out`. The technique (a short-lived stylesheet that turns on colour transitions for one change) is from 21st.dev's "Sun Moon Dark Mode Theme Toggle" by dhxwhy. Colour properties only; skipped under reduced motion; never on first paint.
- **Headline blur-in:** React Bits' BlurText ("blur" effect, by words; David Haz, MIT + Commons Clause, notice in `src/vendor/` and `site/assets/vendor/`), ported twice: on the bundled Motion for the setup page (`src/pages/setup-motion.js`, off under Calm), and on GSAP for the website hero. The sentence is the heading's `aria-label`; the word spans are `aria-hidden`.
- **Website only:** GSAP 3.13 + ScrollTrigger and Lenis 1.3.11, local copies in `site/assets/vendor/`. Lenis smooths scrolling and anchors; sections rise 12px as they enter (UI UX Pro Max "Scroll Reveal (Subtle)" preset). All of it is skipped under reduced motion, and the page is complete without the script.
- **MotionSites:** the account is on the free plan (no DESIGN.md files or gradients), so nothing new was taken from it; the setup page's Driftbar meadow still comes from its "macOS widget" design.

### Website palette: "Highlighter" (site only)
Anish asked for the download page to be lively, with vibrant, bright, contrasting colours, so the site now has its own palette on top of the copied tokens (last block of `site/styles.css`); the extension keeps Sage & Ink. A student's highlighter set: violet `#5b2eff` hero band (white text 6.40:1, lavender `#e9e3ff` 5.15:1), lime `#c6f432`, yellow `#ffe03d`, pink `#ff5fa8`, cyan `#2edcff` as fills with ink `#15122e` text (6.44–14.15:1), ink band `#15122e` for privacy, paper `#f7f6ff`. Dark: paper `#0f0d22`, surface `#1b1838`, bands and fills unchanged. Impeccable `detect` on the rendered page: no contrast findings.

## v3: "Energy outside, calm inside" (branch `redesign/v3`, Sat Nov 21 early hours)

Replaces Sage & Ink and the Highlighter site layer on that branch. Product truth lives in `PRODUCT.md`; the website's direction contract in `.impeccable/surfaces/web-index-html.md`; the finished system is documented in `DESIGN.md`.

- **Brand primitives** (new `brand` key in `tokens.json`), from Anish's brief: violet `#6038ff`, lime `#c9ff38`, cyan `#42ddf4`, pink `#ff5cb8`, yellow `#ffe15a`, midnight `#121126`, off-white `#f7f6fb`, lavender `#ece7ff`. Text on violet is white (6.0:1; midnight on violet is only 3.1:1); the four bright colours are fills under midnight text, never text on light grounds.
- **Website** (`web/`, loud rendition): violet hero and close, midnight walkthrough and privacy, one highlighter colour per idea (lime = your place, cyan = tabs, pink = interruptions, yellow = notes). Bricolage Grotesque (OFL) for display, Inter for text, both self-hosted.
- **Extension** (calm rendition, `tokens.css` values only, names unchanged): violet accent, lavender resume tint, lime spark (fill), deep-teal saved `#0b7285`, danger unchanged and still the only red. Calm mode: accent `#5a4fb0`/`#b3a9e6`, resume `#4f468f`/`#b3a9e6`, spark `#dcef9e`/`#c8dc8f`. Bricolage (`assets/fonts/BricolageGrotesqueVariable-latin.woff2`) for task names and page titles only; the task name sits on a thin lime stroke (the brand's highlighter signature).
- **Sidd's card and overlay** (`src/content/`, colour variables only): midnight `#15142b` ground, lime Resume, the task name on a lime highlighter, lavender next-step label. Contrast: ink 16.3:1, muted 9.1:1, faint 6.3:1, lime 15.3:1 on the card ground; midnight on lime 15.7:1.
- **Checked:** `test/contrast.test.mjs` (69 pairs, light, dark and Calm); axe-core 4.10.2 on the site and popup/dashboard/setup/panel: 0 violations; Impeccable `detect` on the rendered site: 0 findings.
