---
name: Pickup
description: Soft Liquid Future. A pale lavender studio lit by mint and blush; an expressive glass website around a calm, near-opaque pearl browser extension that saves your place.
colors:
  canvas: "#f8f5ff"
  canvas-2: "#f3edff"
  pearl: "#fdfbff"
  ivory: "#fffbfe"
  surface-elevated: "#ffffff"
  lavender: "#e7daff"
  lavender-2: "#d8c6ff"
  mint: "#ddfbea"
  mint-2: "#bff2d4"
  sage: "#effcf4"
  blush: "#ffd8e8"
  bubblegum: "#ffbfd8"
  green: "#c4f4ab"
  green-2: "#a6ea88"
  violet-soft: "#bb9bfa"
  peach: "#ffe2cf"
  plum: "#302545"
  plum-2: "#554868"
  plum-3: "#6f6382"
  accent-ink: "#5a3cc4"
  focus-ring: "#6a4be0"
  danger: "#a8213f"
  line: "rgba(48, 37, 69, 0.12)"
  line-strong: "rgba(48, 37, 69, 0.32)"
  glass-fill: "rgba(255, 255, 255, 0.3)"
  glass-fill-strong: "rgba(255, 255, 255, 0.6)"
  glass-border: "rgba(255, 255, 255, 0.72)"
  ext-border-strong: "#8a7f9c"
  ext-state-saved: "#2c6b4c"
  ext-cta-edge: "#5a8f45"
  ext-resume-tint: "#efe7ff"
  ext-dark-paper: "#1b1530"
  ext-dark-surface: "#261e3d"
  ext-dark-ink: "#f4efff"
  ext-dark-ink-body: "#cbbfe0"
  ext-dark-accent: "#bb9bfa"
  ext-dark-resume: "#c9b0ff"
typography:
  display:
    fontFamily: "Plus Jakarta Sans Variable, Geist Variable, system-ui, sans-serif"
    fontSize: "clamp(44px, 6.1vw, 96px)"
    fontWeight: 780
    lineHeight: 0.98
    letterSpacing: "-0.042em"
  headline:
    fontFamily: "Plus Jakarta Sans Variable, Geist Variable, system-ui, sans-serif"
    fontSize: "clamp(32px, 4.4vw, 60px)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Plus Jakarta Sans Variable, Geist Variable, system-ui, sans-serif"
    fontSize: "clamp(22px, 1.9vw, 28px)"
    fontWeight: 720
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(18px, 1.45vw, 21px)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 600
  ext-title:
    fontFamily: "Plus Jakarta Sans, Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 760
    lineHeight: "24px"
    letterSpacing: "-0.022em"
  ext-body:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.006em"
rounded:
  xs: "10px"
  sm: "14px"
  md: "20px"
  lg: "30px"
  xl: "40px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  "9": "96px"
  "10": "136px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.plum}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  button-primary-hover:
    backgroundColor: "{colors.green-2}"
    textColor: "{colors.plum}"
  button-primary-lg:
    backgroundColor: "{colors.green}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 28px"
  button-blush:
    backgroundColor: "{colors.blush}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  button-pearl:
    backgroundColor: "{colors.glass-fill-strong}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  nav-bar:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.plum}"
    rounded: "24px"
    height: "64px"
    padding: "0 8px 0 18px"
  nav-bar-scrolled:
    backgroundColor: "{colors.glass-fill-strong}"
  nav-link:
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 14px"
  chip:
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
  keycap:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.plum}"
    rounded: "8px"
    height: "26px"
    padding: "0 7px"
  browser-frame:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.plum}"
    rounded: "{rounded.md}"
  ext-card:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.plum}"
    rounded: "{rounded.md}"
    padding: "16px"
  ext-button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.plum}"
    typography: "{typography.label}"
    rounded: "12px"
    height: "36px"
    padding: "0 14px"
  ext-button-primary-hover:
    backgroundColor: "{colors.green-2}"
  ext-input:
    backgroundColor: "{colors.pearl}"
    textColor: "{colors.plum}"
    typography: "{typography.ext-body}"
    rounded: "12px"
    height: "38px"
    padding: "0 12px"
---

# Design System: Pickup

## Overview

**Creative North Star: "Soft Liquid Future"**

A pale lavender product-photography studio, lit on purpose: a lilac key top-left, a mint bounce bottom-left, a blush accent on the right. A silver Blender-built laptop shows the real extension. A few pastel glass objects stand in for real things (a task, a next step, a tab group, a break). They feel physical when touched and stay still otherwise. The words are soft, fluid, luminous, playful, precise; never childish.

One token set, two renditions. The **website** (`web/`) is expressive: layered liquid glass, placed light volumes, a live R3F laptop on a GSAP scroll story. The **extension** (`src/`) is calm: the same primitives and fonts mapped onto its existing token names, flat pearl surfaces with a lavender rim, a near-opaque content-script card, and a "Plum midnight" dark rendition. v3 (violet / lime / midnight, Bricolage Grotesque) is retired; nothing from it carries forward.

Ground truth is the code. Website tokens live only in `web/src/styles/tokens.css` (enforced by `web/scripts/check-tokens.mjs`); extension tokens in `src/shared/tokens.css`, generated from `design/tokens.json` key `v4`. Art direction is `docs/v4/DIRECTION.md`.

**Key Characteristics:**
- 60/30/10: pearl/lavender canvas, mint/lilac surfaces, blush/green/soft-violet accents.
- Plum `#302545` is the text colour everywhere; pastels are fills under it, never text.
- Seven-layer liquid glass in three variants (pearl, gel, crystal); strong fill under any text.
- Plus Jakarta Sans 700–800 display with tight tracking; Geist for UI and 17px body.
- Springs for touch, `power3.out` / `expo.out` for cinema; one library per property.
- Reduced motion, reduced transparency, no backdrop-filter and forced colours each get a complete, designed fallback.

## Colors

A pastel studio: lavender air, mint and blush light, plum ink.

### Primary (10%: accents, fills only)
- **Studio Green** (`--green` #c4f4ab, `--green-2` #a6ea88): the call to action. Gel buttons (`.gbtn--mint`), the Resume button, step numbers, the active story tick dot, `--state-task`. Always with plum text.
- **Blush** (`--blush` #ffd8e8, `--bubblegum` #ffbfd8): the distraction and the break. Secondary gel buttons, "away" capsules, the `.gel-mark--blush` underlay, `--state-away`.
- **Soft Violet** (`--violet-soft` #bb9bfa): `--accent`; brand-mark gradient end, the simulation dot. Fill only.

### Secondary (30%: supporting surfaces)
- **Lavender** (`--lavender` #e7daff, `--lavender-2` #d8c6ff): lilac glass tint, steps, selection, focus halo on inputs, `--state-parked`.
- **Mint** (`--mint` #ddfbea, `--mint-2` #bff2d4): next-step wells, the nav droplet, saved states, `.gel-mark` underlay, `--state-saved`.
- **Sage** (`--sage` #effcf4) and **Peach** (`--peach` #ffe2cf): privacy wash; peach exists only as a light volume.

### Neutral (60%: canvas and ink)
- **Canvas** (#f8f5ff), **Canvas 2** (#f3edff), **Pearl** (#fdfbff), **Ivory** (#fffbfe), **White** (`--surface-elevated` #ffffff): section grounds alternate canvas / canvas-2 / ivory; pearl is `--surface`.
- **Plum** (#302545): all primary text, CTA labels. **Plum 2** (#554868): secondary text and soft emphasis. **Plum 3** (#6f6382): tertiary small labels on light grounds only.
- **Accent Ink** (#5a3cc4): links. **Focus Ring** (#6a4be0). **Danger** (#a8213f).
- **Line** `rgba(48,37,69,.12)`, **Line Strong** `rgba(48,37,69,.32)`.

### Light volumes (atmosphere)
`--light-lilac` rgba(190,162,255,.95), `--light-mint` rgba(150,236,190,.9), `--light-blush` rgba(255,170,208,.85), `--light-peach` rgba(255,210,180,.8). Rendered as `.atmo__light--*` radial gradients blurred 48px, two or three per section, placed (key top-left, mint bottom-left, blush right). A fixed `.grain` noise layer sits over everything at 3.5% multiply.

### Extension mapping (`src/shared/tokens.css`)
Light "Pearl": `--paper` canvas, `--surface` pearl, `--ink` plum, `--ink-body` plum-2, `--accent` / `--resume` / `--state-parked` accent-ink, `--cta` green with `--cta-edge` #5a8f45 (gives the control 3:1 on pearl), `--selected` mint with `--selected-edge` #2c6b4c, `--spark` mint-2, `--reward` blush, `--resume-tint` #efe7ff, `--border-strong` #8a7f9c (3.65:1). Dark "Plum midnight": paper #1b1530, surface #261e3d, ink #f4efff, ink-body #cbbfe0, accent #bb9bfa, resume #c9b0ff. `data-calm` lowers saturation of accent, resume, spark and CTA (`v4.calm`) and stops decorative motion. Toolbar badge colours (`src/shared/constants.js` `BADGE`): parked #5a3cc4, away #554868, wrapped #302545, saved flash #2c6b4c, all with white text ≥6.3:1.

### Named Rules
**The Plum Ink Rule.** Only plum, plum-2, plum-3, accent-ink and danger are ever text. Lavender, mint, sage, blush, bubblegum, green, violet-soft and peach are fills under plum text. No pure black, no light grey on glass.

**The 60/30/10 Rule.** Per section: canvas/pearl/ivory ground about 60%, mint or lilac surfaces about 30%, one blush/green/violet accent about 10%. DIRECTION.md lists the split for each section.

**The Placed Light Rule.** Light volumes are placed where the studio's lights would be, two or three per section. No random blob confetti.

## Typography

**Display Font:** Plus Jakarta Sans Variable (fallback Geist Variable, system-ui)
**UI / Body Font:** Geist Variable (fallback system-ui, -apple-system, Segoe UI)
**Mono:** ui-monospace, SF Mono, Menlo

Both OFL, self-hosted: the site imports `@fontsource-variable/plus-jakarta-sans` and `@fontsource-variable/geist`; the extension bundles `assets/fonts/PlusJakartaSansVariable-latin.woff2` and `GeistVariable-latin.woff2` (licences beside them). Nothing touches the network. The content-script card and overlay name the families but fall back to the system stack, because loading fonts there would require web-accessible resources in the manifest.

**Character:** a geometric display face with tight negative tracking for warmth and weight, over a neutral, precise grotesque for everything you read or press.

### Hierarchy (website)
- **Display** (780, `clamp(44px, 6.1vw, 96px)`, 0.98, -0.042em): hero H1 only; mobile override `clamp(42px, 11.5vw, 60px)`. Final CTA title `clamp(42px, 6vw, 88px)`.
- **Headline / H2** (760, `clamp(32px, 4.4vw, 60px)`, 1.02, -0.035em): section titles. Second clause in `.soft` (plum-2, 620).
- **Title / H3** (720, `clamp(22px, 1.9vw, 28px)`, 1.15, -0.02em): panel and step titles.
- **Lede** (400, `clamp(18px, 1.45vw, 21px)`, 1.55, plum-2, max 58ch).
- **Body** (400, 17px, 1.6, Geist).
- **Small** (15px): fine print, facts, captions.
- **Label** (600, 13px, 1.2, +0.02em, plum-2, sentence case).
- Headings use `text-wrap: balance`, paragraphs `pretty`; changing numbers use `.tnum`.

### Hierarchy (extension, `--fs-*`; Readable setting raises each)
Title 20/24 (→24/32), heading 16/20 (→19/28), body 14/20 (→18/27, +0.03em), label 13/18 (→16/24), caption 12/16 (→15/22), chip 11/14 (→14/20), kbd 11 (→13). Task names (`.pk-task`) are display 760 with a round-ended mint-2 underlay.

### Named Rules
**The Gel Emphasis Rule.** Emphasis is weight plus plum-2, or a soft gel underlay with round ends (`.gel-mark`, mint-2 or bubblegum band at 58–92% of the line). Never a highlighter rectangle, never italic serif decoration.

**The 17px Floor Rule.** Website body is 17px; nothing readable is shrunk to fit.

## Layout

- **Container:** `--wrap: min(1240px, calc(100vw - 40px))`, centred. Nav bar `min(1180px, 100%)`, `--nav-h` 64px, fixed 14px from top.
- **Section rhythm:** `.section` padding-block `clamp(80px, 10vw, 136px)`. `.stack` children separated by `--stack` (default 24px).
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96, 136 (`--space-1`…`--space-10`). Extension: 4, 8, 12, 16, 24, 40.
- **Grids:** two-column asymmetric splits (`0.92fr / 1.08fr` hero, `0.85/1.15` Interrupted, `0.8/1.2` story, `0.9/1.1` privacy); features on a 12-column gallery (7 + 5, then full-width tidy panel), gap 20px. All tracks `minmax(0, …)` so nothing overflows.
- **Anchors:** `scroll-padding-top: calc(var(--nav-h) + 32px)`; Lenis anchor offset -88.

### Responsive spec (320–1920)
- **≥1081px:** two-column hero with the 3D stage.
- **≤1080px:** hero stacks; stage `aspect-ratio: 1.3`, max 760px.
- **≤960px:** nav links and nav CTA hide, the menu button opens a `<dialog>` sheet; feature, privacy, evidence and install grids go single-column; shortcuts 2-up.
- **<900px:** no WebGL. `useCan3D` requires `(min-width: 900px)`, a WebGL context and no Save-Data; otherwise the 2D `DeviceFrame` renders. The story becomes stacked panels (`.story-stack`: copy + device frame + a pearl nudge per step) instead of the pinned scroll scene. Reduced motion also gets the stacked story.
- **≤640px:** hero CTAs, install and final CTAs go full-width; Return demo hides the page body and puts the card in flow; lists single-column.
- **≤380px:** feature panels pad 20/16.
- No horizontal overflow from 320 to 430: `body { overflow-x: clip }`, device frame `padding-inline: 6%` holds the 7%-wider base, `.fpanel` children `min-width: 0`, long titles `overflow-wrap: anywhere`.

## Elevation & Depth

Depth is material, not stacking: translucent glass with an inner shade and a soft lavender contact shadow, over placed light volumes. Shadows are always plum- or violet-tinted, long and soft; never black, never hard-offset.

### Shadow Vocabulary
- **Glass** (`--glass-shadow`: `0 30px 60px -30px rgba(76,52,140,.32), 0 8px 18px -10px rgba(76,52,140,.16)`): resting glass, browser frame, Return demo shell.
- **Glass lift** (`--glass-shadow-lift`: `0 40px 70px -30px rgba(76,52,140,.38), 0 12px 24px -12px rgba(76,52,140,.2)`): crystal and hovered interactive glass.
- **Contact** (`--contact-shadow` rgba(84,58,150,.22)): `.lg-contact` blurred ellipse under floating objects; also the gel button and droplet drop shadows. In 3D, `ContactShadows` in plum at 0.42 opacity, blur 2.6.
- **Inner shade** (`--glass-inner` rgba(124,92,196,.07)) and **highlight** (`--glass-highlight` rgba(255,255,255,.92)): inset top highlight and bottom shade that give glass thickness.
- **Extension card** (`--shadow-card`: `0 1px 2px rgba(76,52,140,.08), 0 18px 40px -16px rgba(76,52,140,.26)`) plus a 1px lavender `--rim`.

### Glass materials (website, `web/src/styles/glass.css`, `LiquidGlass.tsx`)
Seven layers, bottom to top:
1. **Backdrop**: `backdrop-filter: blur(--lg-blur) saturate(--lg-sat)` with `-webkit-` prefix.
2. **Tinted fill**: `--lg-fill`.
3. **Rim**: a gradient border drawn on `::before` via mask-composite (bright top-left to lavender bottom-right).
4. **Specular**: `::after` radial highlight at `--mx/--my`, moved toward the pointer by `useSpecular` (one rAF per frame, no React state), settling to a rest position on leave. Fine pointers only, off under reduced motion.
5. **Thickness**: inset highlight + inset shade + outer glass shadow; `.lg-contact` for floating objects.
6. **Refraction** (crystal only): `.lg__lens` with `backdrop-filter: url(#pk-lens) blur(2px)`, masked to the edges.
7. **Content**: `> * { z-index: 2 }`, crisp, never inside the refracted layer.

| Variant | Blur / saturate | Fill | Use |
|---|---|---|---|
| **Pearl** | 18px / 140% | `--glass-fill` .30 white | nav bar, mobile sheet, panels, story nudges |
| **Gel** | 14px / 165% | `--glass-tint-lilac` (or mint/blush) | controls, demos, hero/story capsules, feature panels |
| **Crystal** | 10px / 120% | .24 white, 1.5px iridescent rim, lift shadow | hero next-step capsule, Return card, final CTA panel only |

Tints: `--glass-tint-mint/blush/lilac` (.46–.48). `text` prop (`.lg--text`) switches to `--glass-fill-strong` (.6 white) or, when tinted, `color-mix` 82–84% of the solid pastel.

### Named Rules
**The Strong Fill Rule.** Any glass that carries body text uses `--glass-fill-strong` (`text` prop). `web/scripts/contrast.mjs` measures text against the worst case behind it: strong fill over lavender-2, bubblegum, and the lilac and blush light volumes.

**The Still Blur Rule.** Blur values are never animated. Glass moves by transform and opacity only.

**The Eight Layers Rule.** At most 8 backdrop-filtered layers visible per viewport (glass surfaces, gel buttons and the crystal lens each count), and at most 2 glass surfaces stacked.

**The Lens Is a Bonus Rule.** The crystal lens is Chromium-only progressive enhancement: `GlassDefs` sets `data-lens="on"` only when the UA is Chromium, `CSS.supports('backdrop-filter','url(#pk-lens)')` passes and reduced transparency is off. Elsewhere crystal keeps its CSS rim and highlight.

### Fallbacks
- **No backdrop-filter** (`@supports not`) and **`prefers-reduced-transparency: reduce`**: glass fills become solid (pearl, white, mint, blush, lavender).
- **`forced-colors: active`**: `.lg` becomes `Canvas` with a 1px `CanvasText` border, no backdrop, no shadow; rim, specular, lens, atmosphere and grain are removed.
- **Extension**: no layered glass. Surfaces are pearl with a lavender rim; the content-script card and overlay use `rgba(253,251,255,.97)` (dark `rgba(38,30,61,.97)`) with `blur(16px) saturate(140%)`, opaque enough (≥94%) to read on any website.

## Shapes

Radius scale: **10** (`--r-xs`: chips, keycaps, focus outline, tab pills) · **14** (`--r-sm`: buttons, inputs, list rows, skip link) · **20** (`--r-md`: cards, browser frame, default glass) · **30** (`--r-lg`: large panels, evidence slot) · **40** (`--r-xl`: signature panels, Return demo shell) · **pill** 999px.

**The Pill Is Earned Rule.** Pills only for the nav droplet and links, CTAs, and capsules (hero/story context bubbles, chips, story ticks). Cards and panels never go pill.

**The Odd Corner Rule.** Signature panels may break symmetry with one corner differing from the other three (feature park panel `40 40 40 24`, Return card `36 36 36 22`, final CTA `48 48 48 28`).

Other recurring forms: the brand mark is a 30% rounded lavender-to-violet gel square with a plum pill near its bottom edge; dots are 7–8px circles; the device frame lid is `18 18 6 6`, base `4 4 24 24 / 4 4 60 60`. Extension: `--radius-sm` 10, `--radius-md` 14, `--radius-lg` 20, pill.

## Components

### Buttons: GlassButton (`.gbtn`)
- **Character:** a tactile gel lozenge.
- **Shape:** pill; 48px high, 0 22px padding, Geist 650 16px (lg: 56px, 0 28px, 17px).
- **Tones:** `mint` (green → green-2 gradient, primary CTA), `blush` (blush → bubblegum), `pearl` (strong glass fill → pearl), `quiet` (transparent, 1px line-strong inset, no backdrop).
- **Material:** gel backdrop (14px / 165%), inset top highlight, inset bottom shade, 1px rim, contact shadow; `.gbtn__shine` radial follows the pointer.
- **States:** hover lifts 2px and brightens the shine; press scales to 0.96 (`SPRING_PRESS`); focus 3px focus-ring outline, 3px offset, pill-shaped; disabled .55 opacity; `magnetic` (primary CTAs only) pulls ≤6px within 80px on fine pointers.

### Glass surfaces: LiquidGlass
The base for every glass object: `variant` (pearl/gel/crystal), `tint` (mint/blush/lilac), `radius`, `interactive` (specular + 3px hover lift + lift shadow), `text` (strong fill), `rest` (specular rest point). Panels, cards, bubbles and the mobile sheet are LiquidGlass with presets and a class; there are no separate GlassPanel/GlassCard/GlassBubble/GlassDialog components.

### Navigation: GlassNavbar
- Pearl glass bar, 24px radius, 64px high, fixed; switches to the strong fill after 24px of scroll.
- Links: Geist 560 15px, 40px pill targets. A mint **droplet** (`layoutId="droplet"`, `SPRING_DROPLET`) sits under the hovered or focused link, else under the section in view (IntersectionObserver), with `aria-current="location"`.
- ≤960px: a 48px menu button opens a `<dialog>` sheet (pearl glass, 28px radius, 52px display-font links, full-width green CTA). Focus trap, Esc, and return focus come from `<dialog>`.

### Chips and capsules
`.chip` (34px pill, Geist 600 14px, 8px dot at .55). Context capsules `.ctx` in gel/crystal glass: task capsule with a 38px green icon tile and display-font title; next-step capsule with a mint-2 "Next" tag; away/saved/timer capsules.

### Browser and device frames
- **BrowserFrame (`.bf`):** white, 20px radius, 44px canvas-2 chrome, lavender dots, 30px tab pills (active white; tab group underlined green-2; "later" dimmed), green group label.
- **DeviceFrame:** 2D laptop for first paint, fallback, mobile and reduced motion; plum lid, lavender-to-pearl base; `poster` mode uses the rendered `laptop-poster.webp`.
- **LaptopStage / LaptopScene:** lazy R3F canvas with the Blender GLB (`LaptopModel`, lid open 112°), studio Lightformers (white key top-left, white top and back fills, white strip rim, lavender fill, mint bounce, blush accent; no HDR download), AgX tone mapping at 1.2 exposure, plum contact shadow, `PerformanceMonitor` + `AdaptiveDpr` (dpr 1.75 → 1.1), frameloop paused off-screen, context loss falls back to 2D. Poses in `rig.ts`: hero yaw -0.52 rad (about -30°); story dollies working → step back → park → close-up on the screen (Return) → settle. `fitCamera` only ever moves the camera back so the laptop never clips.

### Return card (signature)
Crystal glass, `36 36 36 22` radius, interactive. Meta row with a green-2 dot, display-800 26px task title, mint next-step well (16px radius), dt/dd context grid, a full-width 52px green Resume button (16px radius, press 0.97) and quiet pearl secondary buttons with keycaps.

### Keycaps: ShortcutHint
26px keys, white → canvas-2 gradient, 1px line border with 2px bottom, 8px radius, Geist 600 12.5px; one `role="img"` label for the combination.

### Inputs
Website `.park__row input`: 48px, 12px radius, 1.5px lavender-2 border on canvas; focus swaps the border to focus-ring and adds a 4px lavender halo. Extension `.pk-input`: 38px, 12px radius, 1px border-strong, 2px focus-ring outline.

### Extension components (`src/shared/pk.css`)
`.pk-card` (pearl, lavender rim, 20px, card shadow, 16px padding), `.pk-btn` (36px, 12px radius; `--primary` green with cta-edge and inset highlight, one per view; quiet; ghost; hover -1px, press 0.96), `.pk-chip` (26px pill), `.pk-dot` and `.pk-badge` state colours, `.pk-step` (resume-tint well, 14px radius), `.pk-toast` (pill), `.pk-kbd`, `.pk-mark`. Content-script card (`src/content/card.js`) and park overlay (`overlay.js`) carry their own shadow-DOM `--pk-*` tokens with the same values (`design/tokens.json` `v4.card`).

## Do's and Don'ts

### Do:
- **Do** put plum (#302545) text on every pastel; use pastels only as fills.
- **Do** use `LiquidGlass` with `text` (`--glass-fill-strong`) for any glass carrying body text.
- **Do** keep crystal for the hero next-step capsule, the Return card and the final CTA.
- **Do** move glass with transform and opacity; keep blur static.
- **Do** keep ≤8 backdrop-filtered layers per viewport and ≤2 glass surfaces stacked.
- **Do** use the radius scale 10/14/20/30/40 and pills only for nav, CTAs and capsules.
- **Do** emphasise with weight + plum-2 or a round-ended `.gel-mark` underlay.
- **Do** read every colour from `tokens.css`; `npm run check` in `web/` (token and contrast checks; `build` runs both and fails on either).
- **Do** ship the 2D device frame and stacked story below 900px, without WebGL, under Save-Data and under reduced motion.

### Don't:
- **Don't** set pastel text, pure black, or light grey on glass.
- **Don't** use `opacity: .5` cards or one white stripe as "glass".
- **Don't** animate `backdrop-filter` blur or saturate.
- **Don't** put text inside or over the refracted lens layer, or over moving backgrounds without the strong fill.
- **Don't** animate one property on one element from two libraries.
- **Don't** add perpetual bouncing, scroll hijack, snapping, or a fade-in on every section.
- **Don't** use harsh black shadows, bloom, or a procedural box laptop.
- **Don't** reintroduce v3: saturated violet walls, neon lime blocks, highlighter rectangles, Bricolage Grotesque.
- **Don't** add raw hex outside `web/src/styles/tokens.css` (LaptopModel PBR material colours are the one exception).

## Motion

Vocabulary (`web/src/styles/motion.ts`, mirrored as CSS `--dur-*` / `--ease-*`):

| Token | Value | Use |
|---|---|---|
| pointer | 140ms | pointer feedback |
| hover | 200ms | specular and shine opacity |
| press | 140ms | press transforms |
| tooltip | 200ms | tooltips |
| card | 400ms | card/row state, interactive glass lift |
| nav / modal | 360ms | nav fill, dialogs |
| `--ease-out` | cubic-bezier(.22,1,.36,1) | default |
| `--ease-in-out` | cubic-bezier(.65,0,.35,1) | symmetric moves |
| `--ease-soft` | cubic-bezier(.33,1,.68,1) | gentle settles |
| `SPRING_PRESS` | stiffness 520, damping 28, mass .9 | buttons, gel press |
| `SPRING_CARD` | stiffness 300, damping 30 | cards and panels |
| `SPRING_DROPLET` | stiffness 420, damping 34, mass .8 | nav droplet |
| `EASE.enter / hero / drift` | power3.out / expo.out / sine.inOut | GSAP cinematic |

Extension: `--duration-fast` 120ms, `--duration-base` 220ms, `--duration-slow` 420ms, `--stagger` 40ms, `--ease-spring` cubic-bezier(.34,1.56,.64,1); CSS-only, opacity and transform only.

**The One Owner Rule.** GSAP owns timelines, ScrollTrigger, the camera and text reveals. Motion owns UI springs, layout (`layoutId`), presence and gestures. Lenis owns wheel scrolling, driven from GSAP's ticker so Lenis and ScrollTrigger share a frame (lerp .12; off under reduced motion). R3F owns rendering. CSS owns simple state transitions. Never two of them on one property of one element.

Hero key content lands within 1.2–1.8s and never blocks input; everything is interruptible. Reduced motion is a complete static version: CSS durations collapse to 0.01ms, Lenis is off, specular and magnet are off, the story is stacked.

### Interaction states
- **Hover** (fine pointer only): gel buttons lift 2px and brighten; interactive glass lifts 3px with the lift shadow and spec .95; links thicken their underline.
- **Press:** scale .96 (buttons, `.pk-btn`), .97 (Resume).
- **Focus:** `:focus-visible` 3px `--focus-ring` outline, 3px offset (extension 2px/2px); inputs add a lavender halo.
- **Active / current:** droplet under the nav link; story ticks get the strong fill and a green number disc; `.int__beats li.is-on` gets strong glass.
- **Disabled:** .55 opacity (extension .45), `not-allowed`.
- **Selected (extension):** mint fill with the deep mint edge carrying the 3:1.

## Accessibility

- Text pairs ≥4.5:1 (large ≥3:1), focus and UI ≥3:1, checked by `web/scripts/contrast.mjs` against canvas, every pastel, and the strong/weak glass composites over lavender-2, bubblegum and the lilac/blush light volumes. Plum-3 only on canvas, pearl, white and canvas-2.
- Visible focus everywhere; skip link; mobile nav in a native `<dialog>`; `aria-current="location"` on the in-view section.
- Decorative 3D and story bubbles are `aria-hidden`; device images carry real alt text from `SCREEN_ALT`; keycap groups have one label.
- Touch targets ≥44px (nav links 40px inside a 64px bar; footer links and inline buttons 44px; menu 48px).
- Toolbar badge states are always paired with text or an `aria-label`; "away" is plum-2, never amber or red.
- Reduced motion, reduced transparency, missing backdrop-filter and forced colours each have a designed fallback (see Elevation & Depth).

## Where Everything Lives

- **Website tokens:** `web/src/styles/tokens.css` (only raw colours on the site). Motion constants: `web/src/styles/motion.ts`.
- **Website styles:** `base.css` (reset, type, layout, atmosphere, keycaps, brand mark), `glass.css` (material), `components.css` (gel button, navbar, chips, browser frame), `hero.css`, `story.css`, `sections.css`.
- **Website components:** `web/src/components/glass/{LiquidGlass,GlassButton,GlassNavbar}.tsx`, `BrowserFrame.tsx`, `Stage.tsx` (DeviceFrame, LaptopStage), `ui.tsx` (BrandMark, ShortcutHint, SectionHead). Sections: `web/src/sections/{Hero,Interrupted,ScrollStory,ReturnDemo,Features,Trust,Close}.tsx`. 3D: `web/src/three/{LaptopModel,LaptopScene,rig,story,screens}.ts(x)`. Hooks: `web/src/hooks/{motion,useSmoothScroll}.ts`.
- **Checks:** `web/scripts/check-tokens.mjs`, `web/scripts/contrast.mjs`, extension `test/contrast.test.mjs`.
- **Extension:** `src/shared/tokens.css` (from `design/tokens.json` `v4`), `src/shared/pk.css`, `src/content/card.js`, `src/content/overlay.js`, `src/shared/constants.js` (`BADGE`), `src/pages/*.css`, `src/voice/panel.css`, fonts in `assets/fonts/`.
- **Direction and evidence:** `docs/v4/DIRECTION.md`, `docs/v4/after/playground-{1440,375}.png`, `docs-shots/palette/*.png`.
