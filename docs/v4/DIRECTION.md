# PickUp V4 — "Soft Liquid Future"

**Soft. Fluid. Luminous. Playful. Precise.** A pale lavender studio, lit by mint and blush. A premium silver laptop shows the real extension. A few pastel glass objects stand for real things: a task, a next step, a tab group, a break. They feel physical when you touch them, and they don't move all the time. Website: expressive. Extension: calm. Same material, same type, same tokens (`web/src/styles/tokens.css`, `src/shared/tokens.css`, `design/tokens.json` key `v4`).

## Contract
- **THESIS:** Pickup hands your place back when an interruption ends. The site should feel like that: soft, luminous, physical when touched, and calm.
- **OWN-WORLD:** "Soft Liquid Future". Pale lavender/pearl studio, mint and blush light, believable pastel liquid glass, a premium silver laptop showing the real extension.
- **STORY:** Working → Interrupted → Park → Return → Resume, told once, on the laptop, in a pinned scroll stage; every other section demonstrates one real capability.
- **FIRST VIEWPORT:** headline left ("Undo the interruption, not the mistake."), the Blender laptop at a three-quarter pose right, three context capsules (task, next step, time away) lit like the scene, two CTAs.
- **FORM:** `seed: none (pinned)`. The brief pins the world and the first surface. From `handoff/CLAUDE_CODE_PROMPT_V4_LIQUID_GLASS.md` (§1, §4): "Don't keep the v3 laptop or the saturated purple hero." and "Picture frosted lavender glass, mint-green gel, blush-pink translucent bubbles, pearlescent white … A premium silver laptop sits among a few translucent pastel UI objects that **mean something**."
- **FINISH:** award-level craft at 320–1920, reduced motion complete, contrast measured over the worst background behind glass.

## This, not that
| Area | This | Not that |
|---|---|---|
| Colour | Pearl/lavender canvas (60%), mint & lilac surfaces (30%), blush/green/soft-violet accents (10%) | Saturated violet walls · neon lime blocks · pastel text on pastel |
| | Plum `#302545` text everywhere; pastels only as fills under it | Pure black, light grey on glass |
| | Light volumes placed on purpose (key top-left, mint bottom-left, blush right) | Random blob confetti |
| Glass | Layered: backdrop blur + tinted fill + gradient rim + pointer-tracked specular + inner shade + contact shadow | `opacity: .5` cards · one white stripe on everything |
| | Pearl (nav, panels) · Gel (controls, demos, bubbles) · Crystal (hero objects, Return demo, final CTA, sparingly) | Crystal everywhere · glass on glass on glass (max 2 stacked) |
| | `--glass-fill-strong` under every text block | Text over refracted or moving backgrounds |
| Type | Plus Jakarta Sans 700–800 display, tight tracking; Geist for UI and body, 17px body | Bricolage + lime highlighter rectangles · 12px body |
| | Emphasis = weight + plum-2 colour, or a soft gel underlay with round ends | Italic serif decoration |
| | `text-wrap: balance` headings, tabular numbers | Shrinking everything to fit |
| Motion | GSAP: intro, ScrollTrigger story, camera. Motion: springs, layout, presence. Lenis: scroll. CSS: simple states | Two libraries on one property · fade-in on every section |
| | Springs for touch (stiffness ~520, damping ~28); `power3.out`/`expo.out` for cinematic | Same easing everywhere · perpetual bouncing |
| | Everything interruptible; reduced motion = complete static version | Scroll hijack, snapping |
| 3D | Blender-built aluminium laptop, PBR, studio Lightformers (white key, lavender fill, white rim, mint bounce, blush accent), soft lavender contact shadow | Procedural box laptop · harsh black shadows · bloom |
| | Real extension screenshots on the screen, sharp at every pose | Invented UI · blurry mipmaps |
| | At most 3 transmission objects, hero only, quality-tiered | Shader glass on every card |

## 60/30/10 per section
Hero: canvas + lilac/mint light · lavender/mint glass objects · green CTA, blush capsule. Interrupted: canvas-2 · blush light grows (the distraction) · one blush chip. Story: pearl stage · mint "saved" capsule · green Resume. Return demo: lilac light · crystal card · green Resume. Features: canvas/ivory alternating · mint and lilac gel panels · blush/green accents per demo. Privacy: sage/mint wash · pearl panels · no accent but focus. Install: canvas · lilac steps · green CTA. Evidence: pearl · lavender table · none. Final CTA: lilac + mint + blush light, crystal surface, green CTA.

## Radius
10 (chips, keycaps) · 14 (buttons, inputs) · 20 (cards) · 30 (large panels) · 40 (signature crystal panels; one corner may differ from the other three, a deliberate asymmetry) · pill only for nav, CTA, capsules.

## Motion vocabulary
Pointer 100–160 ms · hover 150–240 · press 100–180 · tooltip 150–250 · card 300–500 · nav 250–450 · modal 300–450 · hero key content within 1.2–1.8 s, inputs never blocked.

## 3D art direction
Three-quarter hero pose (yaw about −28°, slight pitch), laptop never overlaps the headline. Floating DOM glass objects share the scene's light direction (rim top-left, shadow bottom-right). The camera dollies (never spins): hero → step back (Interrupted) → push to the screen (Return) → settle (Resume) → hand off to features.

## Components
`LiquidGlass` (base) → `GlassPanel`, `GlassCard`, `GlassButton`, `GlassNavbar`, `GlassBubble`, `GlassDialog`; product pieces `TaskCard`, `ReturnCard`, `ShortcutHint`, `TabGroupDemo`, `BrowserFrame`; 3D `LaptopModel`, `LaptopScene`; story `ScrollStory`.

## Decisions recorded
- UI UX Pro Max `--design-system` matched style "Liquid Glass" (kept: lensing/refraction, contrast-4.5, keyboard, visible focus, reduced motion). Rejected: its navy/gold palette (the brief pins pastel), its "Hero + Testimonials" pattern (we have no testimonials and won't fake any), and Varela Round/Nunito Sans (too childish for "never childish").
- Fonts: Plus Jakarta Sans + Geist, both OFL, self-hosted via `@fontsource-variable`.
