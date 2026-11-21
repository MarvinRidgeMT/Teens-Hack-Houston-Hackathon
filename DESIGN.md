---
name: Pickup
description: Energy outside, calm inside. A loud violet-and-highlighter website around a calm, midnight-and-paper browser extension that saves your place.
colors:
  violet: "#6038ff"
  violet-deep: "#4a22e6"
  violet-light: "#a58cff"
  lavender: "#ece7ff"
  on-violet-soft: "#e4ddff"
  lime: "#c9ff38"
  lime-hover: "#dbff75"
  cyan: "#42ddf4"
  pink: "#ff5cb8"
  yellow: "#ffe15a"
  midnight: "#121126"
  midnight-2: "#1c1b38"
  midnight-3: "#272550"
  card-ground: "#15142b"
  off-white: "#f7f6fb"
  surface: "#ffffff"
  ink-2: "#4d4b66"
  lavender-text: "#c8c2f0"
  border-strong: "#8a87a3"
  teal-deep: "#0b7285"
  danger: "#c21f3a"
  blue-hour-ink: "#f1effc"
  blue-hour-body: "#b9b4da"
  blue-hour-border-strong: "#77739b"
  blue-hour-accent-tint: "#2d2860"
  blue-hour-saved: "#5fd6e3"
  blue-hour-danger: "#ff6b81"
  calm-accent: "#5a4fb0"
  calm-resume: "#4f468f"
  calm-spark: "#dcef9e"
  calm-accent-dark: "#b3a9e6"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 1.4rem + 5.2vw, 6rem)"
    fontWeight: 720
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 94"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.3rem + 3.6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 92"
  title:
    fontFamily: "Bricolage Grotesque Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 0.9vw, 2rem)"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  lede:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  ext-task:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 680
    lineHeight: "24px"
    letterSpacing: "-0.025em"
  ext-heading:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.03em"
  ext-body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.012em"
  ext-caption:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.01em"
  keycap:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  keycap: "7px"
  sm: "8px"
  md: "12px"
  button: "16px"
  lg: "20px"
  xl: "32px"
  pill: "999px"
  ext-sm: "6px"
  ext-md: "8px"
  ext-button: "10px"
  ext-lg: "16px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "72px"
  "9": "112px"
  "10": "160px"
components:
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  button-primary-on-dark:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  button-primary-on-dark-hover:
    backgroundColor: "{colors.lime-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  button-on-violet:
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  nav-cta:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.midnight}"
    rounded: "13px"
    padding: "0 18px"
    height: "44px"
  feature-tile-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.xl}"
    padding: "clamp(24px, 3vw, 40px)"
  feature-tile-cyan:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.xl}"
    padding: "clamp(24px, 3vw, 40px)"
  feature-tile-pink:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.xl}"
    padding: "clamp(24px, 3vw, 40px)"
  feature-tile-yellow:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.xl}"
    padding: "clamp(24px, 3vw, 40px)"
  return-card:
    backgroundColor: "{colors.card-ground}"
    textColor: "{colors.blue-hour-ink}"
    rounded: "{rounded.lg}"
    padding: "18px 20px 16px"
    width: "min(440px, calc(100vw - 40px))"
  return-card-resume:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  ext-button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.surface}"
    rounded: "{rounded.ext-button}"
    padding: "0 14px"
    height: "36px"
  ext-button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  ext-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  ext-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.ext-lg}"
    padding: "16px"
  ext-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.ext-md}"
    padding: "0 12px"
    height: "38px"
---

# Design System: Pickup

## Overview

**Creative North Star: "Energy Outside, Calm Inside"**

Pickup is one brand in two renditions. The website is the loud one: the noisy, colourful world of interruptions, rendered as an electric violet field, midnight bands, poster-scale Bricolage Grotesque and a set of highlighter fills. The extension is the calm one: paper and white surfaces by day, midnight "Blue hour" by night, Inter doing almost all the work, one violet primary per view. The single object that crosses between them is the product itself, the return card, a midnight panel with the task name on a lime highlighter stroke. On the website it appears on the screen of a procedural 3D laptop; in the browser it appears for real.

The highlighter is the signature. A flat band of lime (or cyan, pink, yellow) sits behind display words, drawn left to right when it becomes relevant. It always means something: lime is your place, cyan is tabs, pink is interruptions, yellow is notes. Text on a highlighter is midnight; text on violet is white. Depth is restrained: hairline borders, neutral shadows, one soft lift for floating things, a 3D model only where the product needs a stage.

Density follows the rendition. The site breathes (sections 112 to 160px apart, a 1240px wrap, 5/7 split grids); the extension is compact and tool-like (14px body, 4px to 40px spacing, 360px popup). Both share the brand primitives in `design/tokens.json` `brand`, the same keycap drawing, the same brand tile, and the same accessibility floors.

**Key Characteristics:**
- Violet owns the first viewport and the close; midnight owns the walkthrough, privacy and the product surfaces.
- Four highlighter colours, each tied to one function, used as fills under midnight text, never as text on light grounds.
- Bricolage Grotesque for display and task names, Inter for everything read, mono only inside keycaps and code.
- Keycaps drawn as real keys (heavier bottom border) wherever a shortcut is named.
- Neutral shadows only; no tinted halos.
- Every motion has a still rendition; the 3D never gates first paint.

## Colors

A saturated violet and four highlighters against midnight and a cool off-white; the extension tones the same primitives down to one accent.

### Primary
- **Electric Violet** (violet): the website's hero field, the install close and the primary button on light pages; the extension's one primary action, the brand tile and the parked state. White text only (6.0:1).
- **Deep Violet** (violet-deep): hover for violet buttons, numbered install-step tiles on the violet close, the extension's resume colour and accent-tint ink, link colour on light pages.
- **Light Violet** (violet-light): the dark-theme accent and links on midnight, where midnight text sits on it.

### Secondary: the highlighters
- **Lime** (lime): your place and resume. The highlighter stroke under the live idea, the primary button on dark and violet regions, the nav Download pill, Resume on the return card, focus rings on dark and violet regions, text selection, the extension's spark fill.
- **Cyan** (cyan): tabs, groups, "for later" pills.
- **Pink** (pink): interruptions and drift; the distracting tab in the demo browser.
- **Yellow** (yellow): next steps and notes.

### Neutral
- **Midnight** (midnight): primary text on light, text on every highlighter, the walkthrough and privacy bands, the footer, the park prompt, the dark-theme paper.
- **Midnight 2 / 3** (midnight-2, midnight-3): raised surfaces and inputs inside midnight regions; the dark surface in the extension.
- **Card Ground** (card-ground): the return card and park overlay in the page's shadow root.
- **Off-white** (off-white) and **White** (surface): the light page and the extension's Paper theme; cards and fields sit white on off-white.
- **Lavender** (lavender): sunken surfaces, the extension's resume tint behind next-step rows, the lede on violet body copy in the walkthrough (4.97:1).
- **Ink 2** (ink-2): secondary text on light. **Lavender Text** (lavender-text): secondary text on midnight. **Soft Lavender** (on-violet-soft): secondary text on violet.
- **Border Strong** (border-strong): control borders (3:1). Hairlines are `rgba(18, 17, 38, 0.12)` on light and `rgba(241, 239, 252, 0.14)` on dark.
- **Deep Teal** (teal-deep / blue-hour-saved): the "saved" state. **Danger** (danger / blue-hour-danger): the only red, reserved for Delete all.

### Extension themes and Calm mode
Paper (light) and Blue hour (dark) follow `prefers-color-scheme`; `data-theme` forces one. Blue hour swaps ink to blue-hour-ink, body to blue-hour-body, accent to violet-light with midnight on it. Calm colours (`data-calm`) lower saturation: accent calm-accent / calm-accent-dark, resume calm-resume / calm-accent-dark, spark calm-spark. The Readable setting raises the type scale (body 18/27, +0.03em tracking) and sets body copy to full ink.

### Named Rules
**The White-on-Violet Rule.** Text on violet is white (or soft lavender for secondary copy). Lime, cyan, pink and yellow are fills under midnight text; they are never text on light grounds. Midnight on violet is 3.1:1 and is not used.

**The One Highlighter Per Idea Rule.** Lime = your place / resume, cyan = tabs, pink = interruptions, yellow = notes. A colour that appears for decoration, unrelated to its function, is wrong.

**The Calm-Surface Exception.** On Paper and Blue hour extension pages (popup, panel, dashboard, setup) the Resume button is the violet primary, because lime fails as a fill-under-white on light grounds and each calm view keeps one violet primary. Lime marks your place there as the thin stroke under the task name. On midnight grounds (the return card, the website's dark regions) Resume is the lime pill.

**The One Primary Per View Rule.** The extension shows one violet primary button per view; everything else is quiet or ghost. On the site, the lime primary appears once per dark or violet region.

## Typography

**Display Font:** Bricolage Grotesque Variable (self-hosted, fallback Inter, system-ui)
**Body Font:** Inter Variable (bundled, fallback system-ui)
**Mono:** ui-monospace system stack, only in keycaps and code

**Character:** A slightly condensed, warm grotesque at poster scale against a neutral, hard-working text face. Bricolage is pulled tight (negative tracking, 90 to 94% width) so headlines read as one solid shape.

### Hierarchy
- **Display** (720, clamp 44 to 96px, 0.95): the hero statement only, white on violet, each line rising from a mask.
- **Headline** (700, clamp 36 to 72px, 1.0): section heads; walkthrough step titles use the same face at clamp 40 to 68px.
- **Title** (650, clamp 22 to 32px, 1.1): feature tile and card titles; Bricolage 650 to 680 at 20 to 22px also sets feature rows, privacy items and the footer.
- **Lede** (400, clamp 17 to 21px, 1.5, max 36 to 46ch): one sentence under a headline.
- **Body** (400, 17px, 1.6): site copy, max about 40ch in tiles and 58ch in prose.
- **Label** (500, 13px): captions, fine print, figure captions, in the text face.
- **Extension scale**: task name in Bricolage 680 20/24 on a lime stroke; heading Inter 600 16/20; body 14/20; caption 12/16; chip 11/14. Page titles (dashboard, setup) in Bricolage 700 at 30 to 34px.
- **V4 extension rendition ("Soft Liquid Future", on branch, see docs/v4/DIRECTION.md and design/tokens.json "v4")**: Plus Jakarta Sans Variable (display: task names 760, page titles 780) and Geist Variable (UI and body), both OFL and bundled in assets/fonts/. The task name sits on a soft round-ended mint underlay instead of the lime stroke. The content-script card and overlay keep a system stack (the fonts are not web-accessible resources).

### Named Rules
**The Mono Is for Keys Rule.** Monospace appears inside keycaps, code and the numbered step discs only. Labels, metadata and facts lines use Inter.

**The Text-Face Label Rule.** Small labels are sentence case Inter at 12 to 13px. Nothing sits above a heading to announce it; the facts line goes under the heading.

## Layout

The site centres content in a `min(1240px, 100% - 40px)` wrap with safe-area gutters. Large sections pair copy and stage on a 5/7 split (hero, walkthrough, feature hero, footer), 8/4 (try-it browser and controls), 7/5 (install) or 6/6 (privacy), collapsing to one column under 900 to 1000px. Sections are separated by 112 to 160px (space 9 and 10), with more space above a heading than below it (section heads take 72px below).

The story is one sticky stage: on screens 900px and wider the 3D laptop is pinned at `100svh` in the right seven columns while hero and four walkthrough steps (each 72vh) scroll on the left; a sticky row of step pills sits at the top. Below 900px the stage is replaced by inline flat laptop images per step and the story band paints violet for the first viewport, then midnight.

Feature tiles run in pairs (two columns from 900px); secondary features list in 1, 2, 3 columns at 760 and 1100px, each row topped by a 2px midnight rule. The extension is narrow and stacked: popup 360px, panel up to 520px, dashboard 1120px, setup a 400px sticky brand column beside setting columns.

## Elevation & Depth

Mostly flat with tonal layering: white on off-white, midnight-2 on midnight, lavender wells. Borders are hairlines. Shadows are neutral black or midnight, used for things that float over content (the browser demo, the park prompt, the return card, popovers). The 3D laptop is grounded by a neutral contact shadow, lit by a white key plus a violet rim and lime kicker light inside the scene only.

### Shadow Vocabulary
- **Hairline** (`0 1px 2px rgba(18, 17, 38, 0.08)`): resting lift for small items.
- **Floating** (`0 2px 6px rgba(18, 17, 38, 0.08), 0 20px 48px rgba(18, 17, 38, 0.14)`; dark `0 2px 6px rgba(0,0,0,.4), 0 20px 48px rgba(0,0,0,.5)`): the demo browser and feature screenshots.
- **Overlay** (`0 30px 80px rgba(0, 0, 0, 0.32)`): the park prompt and return card mock in the try-it demo.
- **Return card** (`inset 0 0 0 1px` hairline, `0 30px 60px -20px rgba(0,0,0,.55), 0 10px 24px -8px rgba(0,0,0,.35)`): the real card and overlay over any page.

### Named Rules
**The Neutral Shadow Rule.** Shadows are black or midnight at low alpha. Coloured halos, tinted glows and blurred colour blooms are not part of the system.

## Shapes

Soft, continuous corners (`corner-shape: squircle` where supported) on buttons, tiles, cards and the nav bar. Radii scale with size: keycaps 7px, small controls 8 to 12px, buttons 16px, cards and the nav 20px, feature tiles and video 32px, pills and chips fully round. The extension runs one step tighter (6, 8, 10, 16px). The brand tile is a 28%-radius square with a pill near its bottom edge. Rules are 1px hairlines, with 2px midnight rules to head list rows and method rows.

## Components

### Buttons
- **Shape:** gently squircled rectangle (16px on the site, 10px in the extension); 52px tall on the site (44 to 46px in demos), 36px in the extension (28px small).
- **Primary:** violet with white text on light pages; lime with midnight text inside the story, install close and nav. Hover darkens (violet-deep, lime-hover).
- **Secondary:** white with a strong border; hover darkens the border to ink. **On violet:** transparent with a 55% white border. **Ghost:** transparent, hover fills with a sunken tint.
- **Press:** a Motion spring to 0.97 scale (stiffness 520, damping 30) on the site; CSS scale 0.96 with a spring easing in the extension. Key hints sit after the label as small keycaps.

### Keycaps
Drawn as keys: mono 600 at 0.78rem, 1px border with a 2px bottom border, 7px radius (5px in the extension). White with midnight on violet and on tiles; midnight-3 with white inside midnight surfaces. Combos are caps joined by a small plus and carry one `aria-label`.

### Brand tile
A rounded square (28%) with a horizontal pill near the bottom. Violet with a white pill in the extension; lime with a midnight pill in the site nav and sheet; midnight variant available.

### Chips and status
Extension chips state facts and are not interactive: white, hairline border, pill, 11px Inter 500, a 6px state dot ringed in the border colour (saved teal, parked violet, away body grey breathing, wrapped ink). Badges are filled pills with `on-state` text, always paired with text or a label. On the site, step pills in the walkthrough are midnight-translucent pills that turn lime with a midnight number disc when live.

### Cards / Containers
- **Extension card:** white, hairline border, 16px radius, 16px padding, 12px gap.
- **Feature tile:** a highlighter fill (lime, cyan, pink, yellow) at 32px radius, midnight text, demos sitting directly on the tile below a midnight hairline (no card inside the card).
- **Privacy flow nodes:** midnight-2 rows with a hairline; the Pickup node bordered lime.

### Return card (signature)
Midnight card-ground panel, 20px radius, fixed top right, max 440px. Heading "Welcome back to" with the task name on a lime highlighter band, a facts line under it (lime dot, source, time away), a lavender-tinted next-step well, a two-column facts list (highlight, spot, thread), a full-width lime Resume pill with a keycap, and two quiet outlined pills. It lives in a shadow root with its own variables so host pages cannot restyle it. The website shows it as real screenshots on the laptop screen and as a midnight-2 mock in the try-it demo.

### Park prompt
A midnight bar that appears when you leave: a short label row, a single large input with a lime caret, a round lime go button, and keycap hints. Focus shows a lime inset ring. After saving it collapses to a midnight pill with a lime check.

### Navigation
A floating pill bar 12px from the top, max 1180px, translucent midnight (38%) with backdrop blur and a white 14% hairline, going to 95% midnight after 24px of scroll. Brand tile and wordmark left, 15px links in white at 86% with a soft white hover fill, lime Download pill right. Under 900px links collapse into a 44px menu button that opens a right-side midnight sheet (`<dialog>`, focus trapped, Esc closes, focus returns to the opener) with large Bricolage links and a lime Download.

### Demos
Interactive demos replace icon lists: a drawn browser with tabs (a pink interrupting tab, a cyan "later" pill, a violet group underline), a park-and-return walkthrough driven by numbered steps (violet when current, lime when done), a mini park prompt on the lime tile, tab-strip tidy demos on cyan, and a "drift" notification on pink. Each runs from buttons or keyboard and states its outcome in text.

### 3D stage
A procedural laptop built from primitives (aluminium unibody, keyboard well with a real key grid, one-piece palm rest, inset trackpad, glass bezel); no downloaded model. Its screen is a canvas texture framing real extension screenshots, advancing Leave, Drift, Return card, Resume with the walkthrough. Studio light from light-formers (no HDR download), ACES tone mapping, neutral contact shadow. The scene is a lazy chunk; a CSS flat laptop is the first paint, the Suspense fallback, the mobile rendition and the fallback when WebGL is missing, Save-Data is on or the context is lost. It renders only while on screen and pauses pointer tilt for coarse pointers and reduced motion. A live region describes each screen for screen readers.

### Motion grammar
- **Opening:** one GSAP timeline (expo.out): headline lines rise from masks with 90ms stagger, the lime stroke draws, then lede, buttons and facts settle. The laptop's lid-open and yaw run on wall-clock time over 1.6s so a slow GPU cannot stretch them.
- **Story:** ScrollTrigger scrubs the band from violet to midnight as the walkthrough starts and sets the live step, which drives the screen, the camera pose and the stroke under the step title (700ms, ease-out).
- **Scroll:** Lenis smooths wheel input on GSAP's ticker so Lenis and ScrollTrigger share one frame loop; keyboard, anchors and find-in-page keep working.
- **UI:** Motion springs for presses; CSS transitions on transform, opacity and colour (160ms micro, 280ms UI, 700ms story; ease-out `cubic-bezier(0.16, 1, 0.3, 1)`). The extension uses 120/220/420ms and the same idea with its own easings.
- **Still renditions:** under reduced motion the opening is skipped (end state shown), Lenis is off, the 3D holds its pose, and all CSS animation stops. In the extension, Calm mode also stops decorative motion (the glow pulse and the breathing away dot).

## Do's and Don'ts

### Do:
- **Do** put white text on violet and midnight text on lime, cyan, pink and yellow.
- **Do** tie each highlighter colour to its function: lime place/resume, cyan tabs, pink interruptions, yellow notes.
- **Do** draw the highlighter as a flat band behind display words (`0 62% / 100% 84%`), drawn in when the idea becomes live.
- **Do** show shortcuts as drawn keycaps with one accessible label for the combo.
- **Do** keep text at 4.5:1 and controls and borders at 3:1; use a violet focus ring on light surfaces and a lime ring on dark and violet regions (2px, 2 to 3px offset).
- **Do** give every interactive target at least 44px on the site and keep every demo operable by keyboard.
- **Do** give every motion a still rendition and keep the page complete without the 3D.
- **Do** use real screenshots of the extension wherever the product is shown.

### Don't:
- **Don't** put a kicker or eyebrow above a heading; facts go under it in the text face.
- **Don't** use gradient text.
- **Don't** mark state with a coloured side stripe on cards, rows or callouts.
- **Don't** use coloured glows or tinted shadows; shadows are neutral.
- **Don't** use mono for labels or metadata; it belongs to keycaps and code.
- **Don't** set lime, cyan, pink or yellow as text on a light ground, or midnight text on violet.
- **Don't** add a second primary button to an extension view, or use red for anything but Delete all.
- **Don't** let the 3D block first paint or keep rendering off screen.
