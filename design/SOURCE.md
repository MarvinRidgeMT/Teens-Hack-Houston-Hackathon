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
