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
