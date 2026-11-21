# Prompt for Claude Code: PickUp V4, "Soft Liquid Future"

> **For Anish, before pasting** (this section isn't part of the prompt):
> 1. Save the screenshots you mentioned into `~/pickup/design/v4-refs/`: the current-state screenshots and the reference screenshots (editorial site, 60/30/10, AI-generated mistakes, rushed-development mistakes). Name them `current-*.png` and `ref-*.png`. The prompt reads them; without them it will stop and ask.
> 2. Decide the extension question now. Tick at most one box:
>    - [ ] **Website only** (recommended today). The extension stays exactly as submitted.
>    - [ ] **Website + calm extension restyle.** Sidd has agreed that his card and overlay may change, and we'll re-run the real-Chrome gate with his real scripts.
> 3. It's Saturday. Submission is 3:00 PM ET, hard deadline 6:00 PM. The prompt is time-boxed to that. If you want it to run past 3 PM, edit the schedule in section 3.
> 4. In `~/pickup`, run `claude` and paste everything below the line.

---

# PICKUP V4: THE LIQUID GLASS EXPERIENCE
## Creative direction, 3D reconstruction, motion engineering, design system, product redesign and production QA, grounded in this repository

You're working with me, Anish (Engine lead), on **PickUp**, a Manifest V3 Chrome extension plus its marketing website, for the Triple H 2026 hackathon. **Implement the changes; don't just plan them.** Preserve the working extension. **Don't merge, push, deploy or make anything public without my explicit approval.**

---

## 0. Where we are (verify every line before relying on it)

**Repository:** `~/pickup`, branch `main`, `origin` = `MarvinRidgeMT/Teens-Hack-Houston-Hackathon`. Run `git fetch`, then record the exact SHA of `origin/main` at start (it should be at or after `46dabed`, the merge of PR #3).

**The website is a separate project:**
- `web/` holds React 19 + TypeScript 5.9 + Vite 8 + `@react-three/fiber` 9.8 + `@react-three/drei` 10.7 + `three` 0.187 + `gsap` 3.15 (+ `@gsap/react`) + `lenis` 1.3 + `motion` 14.9 + `lucide-react`.
- `npm run build` in `web/` type-checks and writes static files into `../site/`. The committed `site/` is **build output**: never hand-edit it.
- Key files:
  - `web/src/App.tsx`, `web/src/components/{Nav,ui}.tsx`
  - `web/src/sections/{Story,TryIt,Features,Trust,Close}.tsx`
  - `web/src/three/{Laptop,LaptopScene,screens,story}.ts(x)`
  - `web/src/hooks/{motion,useSmoothScroll}.ts`
  - `web/src/styles/{tokens,global}.css`
  - `web/src/content/site.ts` (the copy)
  - `web/public/assets/` (fonts, screenshots)

**The current design is "v3", which you are replacing:**
- violet `#6038ff`, lime highlights, midnight;
- Bricolage Grotesque + Inter;
- a procedural laptop built from primitives in `web/src/three/Laptop.tsx`;
- documented in `DESIGN.md`, `PRODUCT.md`, `.impeccable/`.

The supplied screenshots in `design/v4-refs/current-*.png` show v3's failures:
1. a flat, saturated purple hero;
2. a cheap-looking laptop;
3. a weak hero composition;
4. weak hierarchy;
5. unintentional empty space;
6. tiny UI and type;
7. flat components;
8. disconnected features;
9. little sophistication;
10. a "generated" feel.

**Don't defend v3. Don't just change a few CSS variables. Don't keep the current laptop and add a shadow.**

**The extension (plain JS, no build step, loaded unpacked from the repo root):**

| Path | Owner | Notes |
|---|---|---|
| `manifest.json`, `src/sw/`, `src/shared/` | Anish | `src/shared/tokens.css`, `src/shared/pk.css`; `stats.js` is Abhinav's |
| `src/content/` | Sidd | Return Card, Park overlay, Docs helpers; Shadow DOM |
| `src/vendor/` | Sidd | Motion, Anime.js |
| `src/pages/` | Abhinav | popup, setup, dashboard |
| `src/voice/` | Anish | side panel |

- Tests:
  - `npm test` at the root runs engine, voice, panel, features and contrast;
  - `node test/check-integration.mjs`;
  - real-Chrome harness in `test/dev/real-chrome-gate.mjs`;
  - web screenshots in `test/dev/web-shots*`.
- The extension's rules: no network requests, no accounts, no analytics, data only in `chrome.storage.local`, CSP-safe, every action has a key, colour is never the only signal, no "productivity" claims.
- Shortcuts: ⌥P Park, ⌥R Resume, ⌥V Panel.
- Badge: `P` parked → `•` away → empty. One nudge per break at most. Restart recovery works.
- **Reported baseline:** real-Chrome gate run 16 gave 23 passed, 0 failed, 1 skipped (Google Docs, which needs a login). **It ran with the stand-in content script, not Sidd's real one.** So the live, restyled Return Card and Park overlay were **not** verified in real Chrome. Treat that as a gap to close, not a pass.
- **Pilot:** card v2 shipped 9:38 AM Sat (see the treatment log in `NOTES_FOR_TEAM.md`). The pilot closed at 10:00 AM. **Don't change stored data formats.** The Evidence section must use the real pooled results; if they aren't in the repo, ask me for them.

**Scope today:** check which box Anish ticked at the top of this file. If neither is ticked, or it's unclear, do **website only** and ask before touching any extension file.

---

## 1. Non-negotiable rules

Release blockers, whatever the visual score:

- **Website:**
  - Don't keep the v3 laptop or the saturated purple hero.
  - No dark theme.
  - No random gradients or blob confetti.
  - No fake glass made from opacity alone.
  - No meaningless translucent cards.
  - No generic startup copy (list in §13).
  - No static screenshots standing in for promised interactions.
  - No fake features, statistics, testimonials, user counts, logos, contact details or social links.
  - No broken links.
- **Extension:**
  - No behaviour changes.
  - No storage format changes.
  - No removed shortcuts.
  - No change to badge meaning.
  - No duplicate nudges.
  - No WebGL in the popup or content script.
  - No remote code.
  - No new permissions.
- **Engineering:**
  - No secrets.
  - No unreviewed remote code (read any installer script before running it).
  - No paid services.
  - No redundant animation libraries (GSAP, Motion and Lenis are already the set).
  - No monolithic components (keep files under about 300 lines unless there's a reason).
  - No duplicated logic.
  - No swallowed errors.
- **Process:**
  - Don't claim a skill was used unless it ran.
  - Don't claim a test passed unless it ran.
  - Don't claim a number (fps, LCP, contrast) unless you measured it.
- **Git and Chrome:**
  - Never force-push.
  - Never merge or deploy without my "yes".
  - Never take over my foreground Chrome without asking. Use isolated Chrome for Testing profiles.
- **Reduced motion:** reduced-motion users get a complete, polished static experience.
- **Mobile:** the mobile site is designed, not shrunk.

---

## 2. Toolchain: verify, then use everything (and keep a ledger)

Create `docs/v4/SKILLS_USED.md` at the start. Add one row **every time** you use a tool: time, tool, command or skill, purpose, output file or decision, and "unavailable" with the error when it couldn't run. I'll read this ledger, and the final report must quote it.

### 2.1 Check what's installed first (5 min)
List the skills, plugins and MCP servers this session actually has. Check:
- the skill list;
- `/plugin`;
- `claude mcp list` (if available);
- `ls ~/.claude/skills .claude/skills`;
- `npx --yes impeccable --version` (or the repo's `.impeccable/`);
- `node -v`;
- `which blender`, plus `/Applications/Blender.app/Contents/MacOS/Blender --version`.

Don't install duplicates.

### 2.2 The tools, what each is for, and where it's mandatory

| Tool | How to get it, if missing | Use it for (mandatory points) |
|---|---|---|
| **Superpowers** (`superpowers:*`) | installed | `using-superpowers` first; `brainstorming` for §4 art direction (short: I've given the direction); `writing-plans` for the §3 plan; `using-git-worktrees` (one worktree per lane); `dispatching-parallel-agents` / `subagent-driven-development` (lanes in §3); `systematic-debugging`; `test-driven-development` for any extension or logic change; `requesting-code-review` per lane; `verification-before-completion` before every "done" |
| **Impeccable** (`.impeccable/` exists in the repo) | Claude Code: `/plugin marketplace add pbakaus/impeccable`, or `npx impeccable install` (read the script first) | Run its **actual** command list (check names first). **Critique + audit** of v3 at the start (§3 P0) as the "before" record. During build: `typeset`, `layout`, `colorize`, `animate`, `delight`, `bolder`, `distill`, `clarify`, `adapt`, `optimize`, as they apply. **Polish + audit + critique** again at the end (P9) as the "after". Update `.impeccable/` config, and **remove the v3 ignores that no longer apply** (Inter override, cramped-padding) if the new design doesn't need them. Turn `hooks on` only if they don't block commits for false positives |
| **UI UX Pro Max** (`ui-ux-pro-max`) | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`, then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` | **Run its search script; don't guess** (see the query list below): `--design-system` for liquid glass / soft UI / translucent product / editorial SaaS / pastel productivity; `--domain color` for pastel palettes on light grounds; `--domain typography` for display + UI pairings; `--domain ux` for glass readability, motion, reduced motion and touch targets; `--stack react` and `--domain gsap` presets. Use only its **ui-ux-pro-max** skill. **Don't** run its `design` logo-generation scripts (they call paid APIs) |
| **21st.dev** (`21st:21st-ui` skill, `21st` MCP: `search`, `get_component`, `get_inspiration`) | `npm i -g @21st-dev/cli` / `npx @21st-dev/cli install-skill` only if missing; `21st login` needs me, so ask | Research **and** pull candidates for: glass navbar with a liquid active indicator, gel buttons, interactive tabs, command menu, glass dialog, tooltip, drawer, mobile menu, feature-showcase patterns. For each candidate record the licence, dependencies and why it was picked or rejected. **Rewrite every adopted component onto our tokens and glass primitives.** Nothing ships with its own colours or radii |
| **GSAP official skills** | `npx skills add https://github.com/greensock/gsap-skills` (review first) | ScrollTrigger architecture, `useGSAP` scoping and cleanup, `gsap.matchMedia()` for breakpoints and reduced motion, Flip for layout changes, SplitText for the headline (GSAP plugins are free since 3.13, so check the licence text in `node_modules/gsap`) |
| **Motion AI Kit** | https://motion.dev/docs/ai-kit, using its skill if available | Spring presets, `layoutId` shared-layout nav indicator, press and hover gestures, `AnimatePresence` for dialogs and the Return Card demo, `useReducedMotion` |
| **Lenis** | already a dependency (1.3.27) | Smooth scroll, synced to GSAP (§8.4). Disabled under reduced motion, on touch-first devices where native scroll is better, and on low-power devices |
| **Three.js / R3F / drei** | already dependencies | Laptop, studio lighting, transmission-glass objects, contact shadows, camera rig, adaptive quality (`PerformanceMonitor`, `AdaptiveDpr`), `useGLTF`, `Html` |
| **Blender** | Blender MCP (`execute_blender_code`, `render_viewport_to_path`, …) if this session has it; otherwise headless CLI `blender -b -P script.py`; otherwise say so | Build or refine the new laptop (§7), render the 6 inspection angles, export GLB |
| **gltf-transform** | `npx @gltf-transform/cli` | Optimise the GLB: dedup, weld, `meshopt` compression (decoder ships with three, so no CDN), textures to WebP or KTX2. Budget in §7.6 |
| **Browser** (Chrome for Testing via the existing `test/dev/` CDP harness, or Playwright if installed) | n/a | Reference study (§5); every visual-review loop (§11); real-Chrome extension gates (§12). Isolated profiles only |
| **Lighthouse / axe** | `npx lighthouse`, `npx @axe-core/cli` | Measured Core Web Vitals (lab) and accessibility violations, before and after |
| **frontend-design**, **modern-web-guidance:modern-web-guidance**, **modern-web-guidance:chrome-extensions** | installed | Visual judgement; current CSS (`backdrop-filter`, `mask`, `text-wrap: balance`, View Transitions, `@property`); MV3 rules for any extension change |
| **design-skills:** `design-critique`, `design-elevation`, `interaction-design`, `accessibility-audit`; **ui-consistency:** `finding-patterns`, `verifying` | installed, if present | A second critique voice next to Impeccable; interaction specs for the signature moments (§9); consistency check across site and extension |
| **dataviz** | installed, if present | Only for the Evidence section's chart, if one is warranted |
| **MotionSites MCP** (`find_designs`, `build_page_plan`) | if available | Optional extra inspiration for section pacing. Never copy a template |
| **codex-review:code** | if installed | A second-opinion review on the final diff |

**Example UI UX Pro Max queries.** Run them, keep the useful results in `docs/v4/research/uupm.md`, and say what you adopted:
```
python "<skill>/scripts/search.py" "liquid glass soft ui pastel" --design-system
python "<skill>/scripts/search.py" "pastel lavender mint blush light" --domain color
python "<skill>/scripts/search.py" "premium productivity editorial rounded" --domain typography
python "<skill>/scripts/search.py" "glassmorphism text contrast" --domain ux
python "<skill>/scripts/search.py" "scroll storytelling pinned" --domain gsap
python "<skill>/scripts/search.py" "react three fiber landing" --stack react
```

---

## 3. Plan, lanes and schedule (it's Saturday; submission is 3:00 PM)

Work on branch **`redesign/v4`** (from the recorded `origin/main` SHA). Make a checkpoint first: tag `pre-v4` locally (**don't push tags**) and zip nothing. Use **worktrees per lane** with parallel subagents, all bound by one `web/src/styles/tokens.css` and one `docs/v4/DIRECTION.md`. **One art direction, one token set:** no subagent invents colours, radii, springs or fonts.

| Time (ET) | Phase | Lane | Exit gate (must be true to move on) |
|---|---|---|---|
| 10:30–10:45 | **P0** Audit + checkpoint | lead | SHA recorded; `npm test`, `check-integration` and `web: npm run build` results recorded; Impeccable critique + audit of v3 saved to `docs/v4/before/`; screenshots of v3 at 375 and 1440 saved |
| 10:30–10:55 | **P1** References (§5) | subagent R | `docs/v4/REFERENCES.md` table filled with real observations; Domino AI marked inaccessible if it is |
| 10:45–11:10 | **P2** Direction + tokens (§4, §6, §10) | lead | `docs/v4/DIRECTION.md`; tokens v4 in `web/src/styles/tokens.css` + `design/tokens.json` key `"v4"`; fonts chosen and bundled; contrast script passes |
| 11:10–11:50 | **P3** Material playground (§6) | subagent G | `web/playground.html` (dev-only Vite entry, **not** linked or shipped) renders nav, 3 glass variants, mint + blush buttons, card, bubble, hover, headline. Screenshots reviewed; **if it looks flat or cheap, iterate before P5** |
| 10:45–12:15 | **P4** Laptop (§7) | subagent L (parallel) | 6 inspection renders pass the §7.5 checklist; GLB within budget; loads in the site |
| 11:50–12:35 | **P5** Hero (§8.1–8.3) | lead | Hero at 320 / 375 / 768 / 1440 / 1920 passes the §11 review loop |
| 12:15–13:05 | **P6** Scroll story (§8.4) | subagent S | Work → Interrupted → Park → Return → Resume → features handoff, forward and reverse, reduced-motion version, no jank in the trace |
| 12:35–13:25 | **P7** Remaining sections (§8.5) | lead + subagent G | All sections pass the §11 loop; copy checked against `PRODUCT.md` and the extension |
| 12:35–13:25 | **P8** Extension (§9), **only if ticked** | subagent X | Contrast tests pass; real-Chrome Gate A + B with **real** content scripts |
| 13:25–13:55 | **P9** QA + polish (§11, §12) | all | Impeccable polish/audit/critique "after"; axe clean or justified; Lighthouse recorded; anti-template audit (§13) done |
| 13:55–14:15 | **P10** Regression, build, report (§14) | lead | `npm test` green; `web` build green; `site/` rebuilt; report written; **ask me to approve** the merge and deploy |

**Cut order if behind** (cut the first item first):
1. Extension restyle (P8).
2. The mobile 3D: use the static laptop render instead.
3. Lenis: native scroll is fine.
4. SVG refraction on the crystal variant: CSS crystal only.
5. Scene 2's distraction choreography: simplify it to one transition.

**Never cut:**
- the new laptop (a high-quality static render beats a bad live model; see §7.7);
- the glass material system;
- one working scroll-driven Return → Resume demonstration;
- the reduced-motion version;
- functionality preservation.

**Three things must be validated before the rest of the site is built:** (a) the laptop looks real; (b) the pastel glass material looks real; (c) **one** scroll-controlled product demonstration works end to end. If any of the three fails its gate, stop and show me screenshots before going further.

---

## 4. Creative concept: PickUp, "Soft Liquid Future"

**Soft. Fluid. Luminous. Playful. Precise.**

Picture frosted lavender glass, mint-green gel, blush-pink translucent bubbles, pearlescent white, floating glass capsules, soft studio light, crisp specular highlights, gentle lens-like edge distortion, surfaces that look almost wet, and soft elastic motion. A premium silver laptop sits among a few translucent pastel UI objects that **mean something** (a task, a next step, a tab group, a break).

**Website: expressive and alive. Extension: calm, functional, beautiful. One visual language.**

Things should feel physically convincing **when touched**, not constantly moving.

Write `docs/v4/DIRECTION.md` (one page) covering:
- the concept;
- three "this, not that" pairs per area (colour, glass, type, motion, 3D);
- the 60/30/10 map per section;
- the radius system;
- the motion vocabulary;
- the 3D art direction;
- the component list.

Every lane works from it.

---

## 5. References: study them live, synthesise, don't copy (subagent R, 25 min)

Open each in an **isolated** Chrome for Testing profile. Scroll the whole page, resize to 375 and 1440, and record short notes on motion, materials, navigation, type and structure. Read the DOM only to name techniques (for example "pinned ScrollTrigger", "WebGL canvas", "SVG filter"). Save 2–3 screenshots per site in `docs/v4/research/` (for internal study only; never ship them).

| Ref | URL | Extract | Don't copy |
|---|---|---|---|
| A | https://buckssauce.com/ | personality, confident type, product-led story, playful interaction, graphic rhythm | branding, imagery, layout |
| B | https://dominoai.up.railway.app/ | interaction design, type, transitions, product presentation, materials. **If it's unreachable, write "inaccessible" with the error. Invent nothing** | everything specific |
| C | https://launch.joinautopilot.com/ | storytelling, cinematic transitions, section pacing, large type, choreography | identity, copy |
| D | https://theinfinitycastle.site/ | 3D scene architecture, camera principles, scroll sync, depth, continuity | dark fantasy aesthetic |
| E | https://oussamaaz.dev/ | craft, scroll sequencing, WebGL presentation, timing, clean expressive type | personal identity |
| F | https://getfactura.app/ | credible real product UI, hierarchy, structured demos, interface authenticity | product UI, brand |
| G | `design/v4-refs/ref-*.png` | editorial layout, soft accents, atmospheric light, 60/30/10, glassy nav, floating cards, **the AI-mistake and rushed-code lists as explicit constraints** | n/a |

Deliverable: `docs/v4/REFERENCES.md`, a table of Reference → Technique → How PickUp adapts it → What must not be copied, plus a 5-line synthesis. Then move on; don't over-research.

---

## 6. Colour, materials and the glass system

### 6.1 Colour (60/30/10). **No saturated purple walls.**
These are starting values. Tune them in the browser, and prove contrast with the script.

| Share | Role | Candidates |
|---|---|---|
| 60% | canvas: near-white lavender, pearl, pale lilac, misty white, warm ivory | `#F8F5FF` `#F4EFFF` `#F1EAFE` `#FAF8FF` `#FFFBFE` |
| 30% | supporting surfaces: light mint, soft lavender, translucent pearl, frosted lilac, pastel sage | `#DDFBEA` `#CFF6DF` `#E7DAFF` `#EADFFF` `#EFFCF4` |
| 10% | accents: blush, bubblegum, vibrant soft green, refined violet, warm peach | `#FFD8E8` `#FFBFD8` `#FFCDE6` `#C4F4AB` `#BB9BFA` |
| text | deep plum or charcoal, never pure black everywhere | `#302545` (primary) `#473858` `#655A73` (secondary) |

**Tokens** (in `web/src/styles/tokens.css`, mirrored in `design/tokens.json` `"v4"`): `--canvas`, `--surface`, `--surface-elevated`, `--lavender`, `--mint`, `--blush`, `--accent`, `--accent-ink`, `--text-primary`, `--text-secondary`, `--glass-fill`, `--glass-fill-strong`, `--glass-border`, `--glass-highlight`, `--glass-shadow`, `--focus-ring`, `--danger`, plus semantic aliases (`--cta-fill`, `--cta-ink`, `--state-parked`, `--state-away`, …). **No raw hex in components** (add a grep check to the build script and FAIL on it).

**Readability rules:**
- Pastel accents are **fills under dark text**, never text on light backgrounds.
- Every text pair is ≥ 4.5:1 (large text ≥ 3:1), and every UI component or focus pair is ≥ 3:1. Measure **against the worst-case background behind glass**, sampled at three scroll positions.
- Extend `test/contrast.test.mjs`, or add `web/scripts/contrast.mjs`, to check the v4 tokens. Don't put light grey text on lavender glass.
- Pastel doesn't mean dull. Energy comes from composition, light, reflections, shape, motion and a few confident accents.

### 6.2 The atmosphere (backgrounds that glass can show)
- A pale lavender canvas, a soft mint light volume, a blush colour cloud, organic gradients built from **2–3 large, deliberately placed** soft volumes per viewport (not random blobs), and a very subtle noise layer (SVG `feTurbulence` or a tiny tiled PNG at about 3% opacity) to stop banding.
- Light volumes shift subtly between sections (§8.4, section transitions).
- Each shape has a compositional reason; document it in `DIRECTION.md`.

### 6.3 The glass material system
Build primitives in `web/src/components/glass/`: `LiquidGlass` (the base), `GlassPanel`, `GlassButton`, `GlassNavbar`, `GlassBubble`, `GlassCard`, `GlassDialog`, `GlassDock`, `GlassTooltip`. Each takes `variant: 'pearl' | 'gel' | 'crystal'`, `tint`, `radius` and `interactive`. **Layered construction:**

1. **Backdrop:** `backdrop-filter: blur(var(--blur)) saturate(var(--sat))` with a `-webkit-` prefix. Use moderate values (pearl about 18px/140%, gel about 14px/160%, crystal about 10px/120%), and **never animate the blur value**.
2. **Fill:** a tinted translucent `background` from tokens. A slightly stronger fill **under text** (`--glass-fill-strong`) keeps contrast whatever scrolls behind.
3. **Edge light (rim):** a gradient border drawn with a pseudo-element using `mask-composite: exclude` (with the `-webkit-mask-composite: xor` fallback). It's bright at the top-left and faint at the bottom-right, following the shape's radius.
4. **Specular highlight:** a `::before` radial or elliptical gradient. Its position comes from CSS variables `--mx`/`--my`, which the pointer updates via `rAF` (Motion or a tiny hook). Highlight positions **differ** per variant and per stacked layer. Never use the same white stripe on every card.
5. **Inner illumination and thickness:** `box-shadow: inset 0 1px 0 var(--glass-highlight), inset 0 -8px 16px rgba(…)`, plus a soft outer `--glass-shadow` with a lavender tint and a contact shadow for floating objects.
6. **Refraction:**
   - **Pearl and gel:** none (or a very slight backdrop `brightness`/`contrast` shift).
   - **Crystal only:** a Chromium enhancement using an SVG `feTurbulence` + `feDisplacementMap` filter referenced by `backdrop-filter: url(#pk-lens)`. Feature-detect it (`CSS.supports` plus a canvas sample check in the playground). If it isn't supported (Safari, Firefox), fall back to the CSS crystal (stronger rim and highlight). **Never distort text.** The content layer sits above the refracted layer.
7. **Content:** text and controls stay crisp, unfiltered and untransformed by any distortion.
8. **Interaction:** see §8.6, gel press and magnetic CTA.

**Variants:**
- **Pearl** (nav, general cards, secondary panels): white/lavender fill, moderate blur, thin bright edge, soft shadow, gentle top reflection.
- **Gel** (feature demos, interactive controls, decorative bubbles, selected highlights): tinted mint/blush/lilac, rounder, stronger highlight, subtle internal colour, elastic response.
- **Crystal** (hero objects, the main Return Card demo, the signature CTA). Use it **sparingly**: clearest, strongest rim, refraction where supported, the most depth.

**Fallbacks:** `@supports not (backdrop-filter: blur(1px))` falls back to an opaque pearl surface. Under `prefers-reduced-transparency: reduce` (where supported) and in a "Calm/solid" mode, glass becomes solid. Use high-contrast mode (`forced-colors: active`) with system colours and visible borders.

**Performance:**
- Keep the number of simultaneously visible backdrop-filtered layers per viewport at **8 or fewer**.
- Move glass with `transform`/`opacity` only.
- Use `will-change` only while animating.
- Measure (§12.3).

**3D glass (hero only):** at most 3 objects (a next-step capsule, a task bubble, a tab-group lozenge) using drei `MeshTransmissionMaterial` (tune `thickness`, `roughness`, `ior` about 1.3, `chromaticAberration` about 0.03, `anisotropicBlur`, `backside`). Use the `samples`/`resolution` quality tier from `PerformanceMonitor`; on low tier, fall back to `MeshPhysicalMaterial` with `transmission`, or to CSS gel bubbles. Never put readable text inside transmission; labels sit in DOM next to them, or on an opaque inner face.

**Bubbly geometry:**
- Radii: 12–16px small controls, 18–24px medium cards, 28–36px large surfaces, 32–48px signature panels, pills where appropriate.
- Not everything is a pill. Use a little deliberate asymmetry, such as one larger corner on signature panels.
- Optically align icons and labels.
- For continuous corners, use larger radii with a slight `corner-shape: squircle` where Chromium supports it, else plain `border-radius`, consistently.

**Phase P3 playground.** In `web/playground.html` (a separate Vite input, excluded from the production `site/` build), render:
- the glass nav with its liquid indicator;
- the three variants over the real atmosphere;
- mint and blush buttons with press and hover;
- a glass card;
- a floating bubble;
- a sample headline;
- one crystal panel with and without refraction.

Screenshot it at 1440 and 375 and run the §11 loop on it. **Don't proceed while it looks flat or cheap.** Record what changed between rounds.

---

## 7. Replace the laptop completely (subagent L, starts in P2, runs in parallel)

### 7.1 Choose a source, in this order of preference (record the decision and licence in `docs/v4/LAPTOP.md`)
1. **Build it in Blender** (MCP or headless CLI). Use a parametric Python script committed at `web/three-src/laptop/build_laptop.py`, so it's reproducible and licence-free.
2. **A licensed model:** CC0 (for example Poly Pizza or Poly Haven) or CC-BY with attribution in the footer and `LAPTOP.md`. **No Apple logo or trademark**, no "MacBook" in any copy, no ripped assets, no paid models.
3. **Last resort: a substantially rebuilt procedural R3F model.** Only if 1 and 2 are impossible: a bevelled extruded unibody, `RoundedBoxGeometry` with more segments, an instanced keyboard, proper materials. It must still pass §7.5. Document why 1 and 2 failed.

### 7.2 Geometry (modern MacBook-inspired silhouette, no Apple branding)
- **Proportions** about a 14-inch class:
  - base about 312 × 221 mm, about 15.5 mm thick at the hinge, tapering slightly to the front (or a uniform slab with softly rounded vertical edges, about 2–3 mm radius);
  - lid about 5–6 mm;
  - display 16:10, with a thin, even black bezel of about 4–6 mm (slightly thicker at the bottom chin);
  - opening angle about 110–115°.
- **Hinge:** a proper rounded cylinder spanning the back, with a small visual gap.
- **Keyboard:**
  - real layout, 6 rows: function row at half height, number row through to the spacebar row;
  - correct staggering and key widths (Tab 1.5u, Caps 1.75u, Shift 2.25u/2.75u, spacebar about 5u, arrow cluster as an inverted T);
  - **distinct individual instanced keycaps** in a recessed well, about 0.6 mm recess, with a slight cap bevel;
  - no stretched keyboard.
- **Trackpad:** large (about 130–150 mm wide), flush, with a refined 0.3 mm groove border, centred under the spacebar.
- **Edges:** slightly rounded body edges with no jaggies. Use bevel modifiers in Blender (segments 3–4, harden normals), or enough radial segments in R3F.
- **Underside:** a clean silhouette with four small feet. It's mostly unseen but must not break in side views.
- **Display:** a separate screen plane slightly inset under a glass layer (a thin plane with a low-roughness clearcoat material) for reflections.

### 7.3 Materials (PBR)
- **Aluminium:** `MeshPhysicalMaterial` (or `MeshStandardMaterial`), metalness 1, roughness about 0.32–0.4 (satin), light silver base colour, a subtle anisotropy or brushed normal if cheap, and `clearcoat` 0. Its edges catch the rim light.
- **Bezel:** unlit-looking deep black (roughness about 0.5), so no pose lifts it to grey (a known v3 bug).
- **Screen:** an emissive texture (`toneMapped={false}`) showing the real UI, under a glass plane with `clearcoat` 1, roughness about 0.05, and a faint environment reflection that **never washes out the text**. Test at every camera pose.
- **Keycaps:** dark charcoal (`#1e1e22`-ish), roughness about 0.6, faint sheen. Legends are optional: a tiny baked texture only if crisp; otherwise blank caps look more premium than blurry legends.
- **Trackpad:** slightly smoother than the body (roughness about 0.22).
- **Feet:** dark rubber.
- **Ambient occlusion:** bake AO for the key well, hinge and trackpad groove in Blender (into a small texture), or use a cheap SSAO/N8AO only on the high tier.

### 7.4 Lighting (product-photography studio, no HDR download needed)
- drei `<Environment resolution={256}>` built from `<Lightformer>`s:
  - a large soft **key** (top-left, white);
  - a **fill** (front-right, lavender `#EADFFF`, low);
  - a **rim** strip (back-right, white, narrow) that outlines the lid and base edges;
  - a **mint bounce** card (bottom-left, `#DDFBEA`);
  - a **blush accent** card (right, `#FFD8E8`, low).
- Ground it with drei `ContactShadows` (soft, lavender-tinted, opacity about 0.35, blur 2–3) or `AccumulativeShadows` on the high tier.
- No harsh black shadows. No bloom, or a very slight bloom on the high tier only.
- Tone mapping `AgX` or `ACESFilmic`; output colour space sRGB.
- The laptop should look like it's sitting in a premium studio, even while floating. The contact shadow and the light continuity sell that.

### 7.5 Inspection gate (must pass before P5 finishes)
Render **front, three-quarter, side, keyboard close-up, screen close-up and hinge**:
- with Blender (`render_viewport_to_path` or Eevee/Cycles CLI renders);
- **and** in the site via the R3F canvas at those camera poses (a `?inspect=front|tq|side|keys|screen|hinge` debug query, dev only).

Save them to `docs/v4/laptop/`. Check and fix:
- proportions;
- keyboard alignment and flush edges;
- hinge gap;
- bezel even and black;
- screen sharp at every pose (no mip blur: `anisotropy = renderer.capabilities.getMaxAnisotropy()`; screen texture at least 2048 px wide; `generateMipmaps` with the right filters, or Html, see 7.6);
- no z-fighting;
- no light leaks;
- no jagged silhouettes;
- the shadow never ends in a hard line.

**Show me the six renders** (paths) before declaring P4 done.

### 7.6 Screen content and export budget
- **The screen shows real PickUp:**
  - a browser with research tabs and a named task tab group;
  - the real Park overlay with a typed next step;
  - the real Return Card (task, time away, next step, last highlight, Resume);
  - after Resume, the restored scroll position.
- **Source:** capture the **real** extension UI with the existing harness (`test/dev/` with Sidd's **real** content scripts, not the stub), at 2× density, into `web/public/assets/screens/*.png`.
- Draw these into a `CanvasTexture` (extend `web/src/three/screens.ts`), and swap per story step.
- For the **Return close-up** (Scene 4), where crispness matters most, consider a drei `<Html transform occlude>` overlay of a real DOM rendition of the card aligned to the screen plane. Pick whichever stays sharper in measured screenshots.
- **No invented UI. No features that don't exist.**
- **Budget:**
  - GLB ≤ 1.5 MB after `gltf-transform optimize --compress meshopt --texture-compress webp`;
  - ≤ 150k triangles, or ≤ 300k with the instanced keyboard counted once;
  - ≤ 25 draw calls for the laptop (instancing keycaps);
  - textures ≤ 2048 px.
- Load with `useGLTF` plus meshopt, using the **local** decoder (no CDN).
- Preload after the first paint; show a soft static render (`laptop-poster.webp`) as the LCP image and a fallback.

### 7.7 Fallbacks
- No WebGL, low-power, or `Save-Data`: a high-quality static render from Blender (2560w WebP/AVIF), with the glass objects in DOM.
- Mobile: a smaller static or very light live laptop (`frameloop="demand"`), no transmission.
- Reduced motion: static poses for each story step, cross-faded or switched without camera moves.

---

## 8. The website, section by section

**Typography (P2):**
- Use UI UX Pro Max + Impeccable `typeset` to pick **OFL or free-for-commercial-use** fonts, self-hosted via `@fontsource` or files in `public/assets/fonts` (no Google Fonts CDN). Candidates: Geist, Manrope, Plus Jakarta Sans (OFL); General Sans / Satoshi only if the Fontshare licence allows web self-hosting (check and record).
- Choose one display face and one UI face, or one versatile family with defined roles. Rounded and premium, never childish. No generic italic serif decoration.
- **Scale:**
  - display `clamp(44px, 7.2vw, 104px)`, tracking −0.035 to −0.045em, line-height about 0.95–1.0;
  - h2 `clamp(32px, 4.4vw, 60px)`;
  - body 16–18px on marketing pages (never 12px for anything meaningful), measure 60–72 ch.
- `text-wrap: balance` on headings, `pretty` on paragraphs, `font-variant-numeric: tabular-nums` on counters, timers and the evidence numbers.
- Check line breaks at **320, 375, 768, 1440 and 1920** and fix awkward ones. **Don't** shrink everything.
- Emphasise words with weight and colour or a soft gel-tinted underlay with rounded ends. **No lime rectangle highlights** (the v3 treatment is rejected).

### 8.1 Navigation: `GlassNavbar`
- Floating pearl glass, rounded (about 24px), with refined spacing and type, a subtle rim, and soft elevation. It never dominates.
- **Liquid active indicator:** a Motion `layoutId` gel droplet that glides between items with a spring and a very slight stretch on travel (scaleX ≤ 1.06, settling to 1). Labels never distort.
- It turns more opaque after scrolling, for readability.
- **Real destinations only:** in-page anchors that exist, the real Download link (GitHub release; if the release isn't published yet, the button says so honestly, as v3 did), and the GitHub repo.
- **Mobile:** a glass sheet menu with focus trap, Esc to close, and scroll lock. Built from a 21st.dev pattern, rewritten on our tokens.

### 8.2 Hero: "a liquid-glass product launch"
- Luminous pale lavender environment (§6.2), with no saturated violet.
- **Editorial layout.** The headline **"Undo the interruption, not the mistake."** Experiment with line breaks; for example a break after "interruption," with "not the mistake." in a softer secondary weight and colour.
- **Support line:** "A Chrome extension that remembers where you left off, so coming back feels easy." Edit it only if it stays accurate.
- **CTAs:**
  - primary **Download PickUp**: a crystal or gel signature button in mint or blush, ≥ 52px tall, with an icon optional;
  - secondary **See how it works**: a pearl button, scrolling to the story.
  - Real destinations only.
- **The product visual:**
  - the new 3D laptop, large, at a premium three-quarter angle, never overlapping the headline, never awkwardly cropped, grounded by the contact shadow;
  - **at most 4** meaningful glass objects: a floating task card ("Climate Essay · 4 tabs"), a next-step capsule ("Next: find a source for the drought statistic"), a tab-group label, and a small break-state indicator ("Away 12 min").
  - The text uses the real extension's language. The objects sit **in** the composition (same light direction, a shadow or rim matching the scene).
- **Load sequence** (GSAP timeline, important content within about 1.2–1.8 s, interactive immediately):
  1. the atmosphere fades in;
  2. the reflections drift slightly;
  3. the headline reveals (SplitText lines or words, mask-up, 0.6–0.8 s, stagger about 0.06);
  4. the laptop rises and settles, spring-like (`power3.out`, about 0.9 s);
  5. the screen powers up and becomes readable;
  6. the task context bubbles settle in;
  7. the CTAs settle.
  - Inputs are **never** blocked during the intro.
- **Pointer (desktop, fine pointer only):** the laptop eases ±3–4° yaw and ±2° pitch toward the pointer, floating objects get small parallax (≤ 12px), and highlights follow `--mx/--my`. Everything springs back. All of it is off under reduced motion and on touch.

### 8.3 Section 2: "Life interrupted. Your work remembered."
- An editorial layout, not a grid.
- A small **interactive browser simulation:**
  - a DOM mini-browser (`BrowserFrame`) with an essay tab and research tabs;
  - a "Get distracted" control opens a video tab;
  - "Come back" shows the saved context returning.
  - It's clearly labelled as a **simulation**, never implying it's connected to the visitor's browser.

### 8.4 Section 3: the PickUp journey (the main GSAP story)
**Story:** Working → Interrupted → Park (Saved) → Return → Resume → handoff to the features.

The architecture is **one pinned stage**, about 400–500vh total (not longer), with the R3F canvas and DOM layers, driven by **one** ScrollTrigger timeline with labels per scene.

- **Lenis + GSAP sync** (documented pattern, one RAF driver):
  ```ts
  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ```
  Refactor `useSmoothScroll.ts` accordingly. R3F reads scroll progress from a ref in `useFrame` (no React state per frame); `frameloop="demand"` plus `invalidate()` on progress changes where possible.
- **Scenes:**
  1. **Working:** the screen shows the essay plus research tabs; context bubbles float near the laptop.
  2. **Interrupted:** the workspace eases back (camera dolly out about 8–10%); bubbles drift gently apart; a distraction (a video tab, a phone-style notification glass chip) slides in. The task stays visible, as a slightly dimmed group. **Calm, not chaotic.**
  3. **Park:** the real Park overlay appears on screen; the next step types in; the saved confirmation (the drawn check) plays; the bubbles gather into one "Saved" capsule (Flip-style continuity, shared position, no fade-swap).
  4. **Return:** the camera moves toward the screen; the **Return Card** becomes the readable focus (task, tabs, next step, Resume).
  5. **Resume:** the Resume press plays (gel press); the screen scrolls back to the saved spot; the tab group re-expands; the scene settles calmer and more ordered.
  6. **Handoff:** the laptop scales and translates into the features composition (shared position/colour continuity). **No fade-out-and-reset.**
- **Scroll rules:**
  - pin only this stage;
  - no scroll hijacking (no `preventDefault` on wheel), and no snapping that fights the user;
  - nav anchors and keyboard (Page Down, Space, arrows, Tab) work at any progress;
  - `ScrollTrigger.refresh()` on resize and font load;
  - `gsap.matchMedia()` with separate desktop, tablet and mobile timelines;
  - `useGSAP` with scope; kill everything on unmount;
  - **reverse scrolling looks right** (test it).
- **Reduced motion:** no pin. Show five stacked static panels, each with the real UI screenshot for that step and short captions.
- **Mobile:** a shorter sequence (3 steps: Park → Return → Resume), a lighter laptop or a 2D device frame with the real screens, and no transmission.

### 8.5 Remaining sections
- **Section 4: the interactive Return Card.** A large crystal-glass demonstration of the real card's hierarchy: (1) task, (2) next step, (3) saved context (tabs, last highlight), (4) **Resume**.
  - Visitors can press Resume / Tidy / Not now and see the simulated result (Motion `AnimatePresence`, interruptible).
  - The keyboard works (Enter, T, Esc) **only while the demo has focus**.
  - A strong, opaque-enough surface under the text; comfort and clarity first.
  - It's clearly a demo.
- **Section 5: the feature gallery.** A mixed editorial composition, **not a bento grid** and not eight equal cards.
  - **Large:** Return Card, Park, Resume, Tidy. Each is a side-by-side real UI with a short explanation and one small interaction:
    - Tidy shows tabs **springing into** a collapsed "Later" group (never deleted);
    - Park shows the typed next step and the check.
  - **Supporting:** Task tab groups (an animated `TabGroupDemo`), Drift nudge (one notification, shown honestly), keyboard shortcuts (⌥P / ⌥R / ⌥V keycaps with `ShortcutHint`), Wrap up → "Start here", the next step (typed, picked or said), and the PickUp Panel (Ask, break timer, task list).
  - **Every capability must be confirmed in the repo** (grep for it, or test it). If unsure, leave it out.
- **Section 6: "Your space stays yours."** A calm mint/lavender-white atmosphere with deep plum type. State only what the code does:
  - data in `chrome.storage.local` on your device;
  - no accounts, servers or analytics;
  - no network requests from the extension;
  - only a ≤ 200-character highlight of page text is kept;
  - voice is recognised on-device, with no audio kept;
  - one button deletes everything.
  - Link the honest limits: it can't see your phone; it can't read Google Docs text; time-to-first-interaction is a proxy.
  - **No invented security guarantees.**
- **Section 7: how to use PickUp.** The real install path (download the zip → `chrome://extensions` → Developer mode → Load unpacked → the setup page), the setup basics (work and distraction sites), and the shortcuts with their accessible alternatives (popup buttons, the panel's Ask box, voice). Use the install GIF and poster if present.
- **Section 8: Evidence.** The **real** pooled pilot results from the team's CSVs: medians (IQR), n per condition, away buckets. State the limits ("3 people who built the tool, about 1 day, randomised per event; a starting point, not proof"). **No fabricated numbers or quotes.** If the numbers aren't in the repo, render a clearly marked slot and ask me. Use `dataviz` for one honest chart if it helps (accessible; n shown).
- **Section 9: final CTA, "Come back to what matters."** A large crystal glass surface, pastel light, the primary CTA, real destinations.
- **Section 10: footer.** Minimal: product name, Download, GitHub, licence and credits (fonts OFL, any CC-BY model attribution, Motion / GSAP / Three licences), "Built for Triple H 2026", the correct year (2026). No fake socials, no placeholder contact details.

### 8.6 Signature interactions (do these few exceptionally)
- **A. Liquid nav indicator** (§8.1).
- **B. Gel CTA:**
  - hover: highlight brightens and the button lifts 1–2px (160–220 ms);
  - press: scale 0.96, the highlight shifts, and it springs back (Motion spring with stiffness about 520 and damping about 28);
  - magnetic pull of ≤ 6px within 80px, **primary CTAs only**, fine pointer only;
  - **text never moves relative to the button.**
- **C. Floating task bubbles** reposition along the story. No perpetual random bouncing; at most a very slow 6–8 s idle drift of ≤ 4px, off under reduced motion.
- **D. Glass cards:** hover adds slight elevation, highlight movement and a border response; optional tilt ≤ 3° only on showcase cards.
- **E. Tab-group motion:** tabs spring into a group; never deleted.
- **F. Park and Return:** Park organises the context into a saved capsule with a confirmation check; Resume restores it, with continuity of position and shape.
- **G. Section transitions:** atmosphere light shifts, shared elements carry across, controlled layout transitions, subtle material shifts. **Fade-in-on-scroll is not the answer for every section.**

**Motion vocabulary** (`web/src/styles/motion.ts` + CSS custom properties):

| Interaction | Timing |
|---|---|
| Pointer response | 100–160 ms |
| Hover | 150–240 ms |
| Press | 100–180 ms |
| Tooltip | 150–250 ms |
| Card | 300–500 ms |
| Nav | 250–450 ms |
| Modal | 300–450 ms |
| Hero entrance | 1.2–1.8 s for key content |

- Springs for tactile controls; GSAP eases (`power3.out`, `expo.out`, `sine.inOut`) for cinematic moves. Easing is **not** identical everywhere.
- **Ownership:**
  - GSAP: timelines, ScrollTrigger, camera, SplitText;
  - Motion: UI springs, layout, presence, gestures;
  - Lenis: scroll;
  - Three/R3F: rendering;
  - CSS: simple state transitions.
- **Never** animate the same property on the same element with two libraries.
- **Interruptibility:**
  - open and immediately close a dialog;
  - switch tabs mid-transition;
  - reverse scroll;
  - press Resume while an animation is running.
  - Write small Playwright or CDP checks that do these and assert no stuck states or console errors.

### 8.7 Polished-UX checklist (apply only where relevant)
- Skeletons only for real async work (3D model load).
- Optimistic UI only with rollback (none needed on the site).
- A command menu only if there's a real use; don't add one for show.
- Contextual shortcut hints, using `ShortcutHint` in the demos.
- Undo toasts only for reversible actions (a Tidy demo "Undo" is fine because it's simulated and reversible).
- Image placeholders (blurred poster for the laptop).
- View Transitions for in-page state swaps where supported.
- Gestures with accessible alternatives.
- Interruptible animations.
- Predictable navigation (the back button and anchors work).
- Touch targets ≥ 44px.
- `env(safe-area-inset-*)` on the nav and the bottom CTAs.
- No autofill or OTP inputs (there are no real forms).
- Tabular numbers.
- Balanced headlines.
- Consistent continuous corners.
- Idempotent recovery (re-running the intro or refreshing ScrollTrigger is safe).
- Reliable pointer paths across menus (submenu safe-triangle if any).

### 8.8 Responsive
Design at **320, 375, 430, 768, 1024, 1440, 1920**:
- **Desktop:** editorial layout, live 3D, rich layering, the full story.
- **Laptop widths:** the hero fits, the 3D stays prominent, the nav fits, nothing is cropped.
- **Tablet:** recompose; reduce 3D (no transmission, fewer objects).
- **Mobile:** its own composition: readable type, full-width CTAs, simplified glass (fewer layers, lower blur), a smaller or static laptop, a shorter story, clear feature explanations, and no expensive scroll-driven 3D unless the trace shows it's smooth.
- **Reduced motion:** a complete, polished static alternative.
- **200% zoom and text resize:** no clipped text or overlapping controls.

---

## 9. The extension: calm, restrained glass (P8, **only if ticked**)

Same visual language, more restraint. **No WebGL, no heavy filters in the popup or content scripts, CSP-safe, no remote code.**

- **Tokens:** add the v4 palette to `src/shared/tokens.css` / `design/tokens.json` under the existing token names (aliases, as last night), so component CSS barely changes.
  - Light lavender ground; soft frosted surfaces (popup and panel can use a light `backdrop-filter` on a pearl surface; the content-script card uses a **near-opaque pearl surface, at least 94% opacity**, so text is readable on any website);
  - mint active states, sparing blush highlights, deep plum text;
  - controlled radii (12–20px).
  - `npm test` (including `contrast.test.mjs`) must pass.
- **Return Card:**
  - hierarchy: (1) task, (2) next step, (3) saved context, (4) a strong Resume;
  - no reflections behind text;
  - keys Enter / T / Esc unchanged;
  - focus, `role="dialog"`, `aria-live` unchanged;
  - card clicks still don't count as first interaction.
- **Park overlay:** lightweight, subtle pearl glass, clear input states, readable text, keyboard unchanged.
- **Popup, panel, setup, dashboard:**
  - clear organisation; no decorative badges;
  - tabular numbers for timers and counts; stable layouts as values change; no constantly moving timer animations;
  - confirmations only after the action has actually succeeded.
- **Ownership:**
  - `src/content/` and `src/vendor/` (Sidd) only on branch `v4/content`, with his review;
  - `src/pages/` (Abhinav) on `v4/pages`, with his review;
  - mine (`src/shared`, `src/sw`, `src/voice`) on `v4/extension`.
- **Treatment log:** add "card v3 (V4 visuals) from <time>" in `NOTES_FOR_TEAM.md` (the pilot is closed, but the video and the submitted build must be traceable).

---

## 10. Design system and documentation

- **`DESIGN.md`:** rewrite it for V4, keeping it technical. It covers:
  - foundations; colour, type, spacing and radius tokens;
  - glass materials (how the layers work, the variants, fallbacks, performance limits);
  - elevation; the motion vocabulary; interaction states; layout primitives;
  - the component list with usage;
  - accessibility rules; responsive specs;
  - where everything lives.

  Keep the frontmatter format the repo uses, and update `.impeccable/design.json` / the sidecar via Impeccable's `document` workflow if it exists.
- **`MOTION.md`:** library ownership, timelines and labels, the ScrollTrigger map, Lenis sync, the reduced-motion strategy, cleanup rules, interruptibility tests, and how to add a scene.
- **`docs/v4/`:** `DIRECTION.md`, `REFERENCES.md`, `LAPTOP.md`, `SKILLS_USED.md`, `QA.md` (§12 results), `before/` and `after/` screenshots.
- **Components** (only where they earn their place): `GlassNavbar`, `GlassButton`, `LiquidGlass`, `GlassCard`, `FloatingBubble`, `GlassDialog`, `TaskCard`, `ReturnCard`, `ShortcutHint`, `TabGroupDemo`, `BrowserFrame`, `LaptopScene`, `LaptopScreen`, `SectionTransition`, `ScrollStory`, `FeatureShowcase`.
  - Buttons share a height scale, type, focus, interaction, disabled state, border and elevation.
  - Cards share geometry and spacing rules. Glass variants share one optical language.
- **Content:** keep all copy in `web/src/content/site.ts`. Copy must match `PRODUCT.md` and the real extension behaviour.

---

## 11. Visual review loop (required for every section and the whole page)

For each section, then the whole page:
1. Render it (`npm run dev`, or build + `preview`) in an isolated Chrome for Testing profile.
2. Screenshot it at 1440 and 375 (and the other widths at the end).
3. Inspect it at actual size, comparing against `design/v4-refs/` and `DIRECTION.md`.
4. Write the **three most important weaknesses**.
5. Fix them.
6. Re-screenshot.
7. Verify the interactions.
8. Check performance (no long tasks over 50 ms on interaction; trace if in doubt).
9. Check responsive behaviour.
10. Move on.

Keep `docs/v4/QA.md`: one entry per round, with before/after paths and the three issues.

Judge the **whole composition** too:
- background continuity;
- repeated shapes;
- excessive glass (more than 2 stacked glass layers is suspect);
- type hierarchy;
- surface contrast;
- flow between sections;
- 3D proportions;
- rhythm;
- motion pacing.

**"It compiles" is not done.**

### 11.1 Regression references, fix each explicitly
| Failure | Must become |
|---|---|
| A. Giant purple hero | Soft lavender/pearl canvas, mint and blush light, real glass, clear hierarchy, the new laptop |
| B. Poor laptop | Accurate geometry, PBR, studio light, a sharp real screen, correct composition |
| C. Empty feature sections | Interactive demos, real UI, balance, deliberate type, clear hierarchy, meaningful transitions |
| D. Simplistic mobile | A dedicated mobile layout, polished glass, readable text, clear CTAs, reliable interactions |
| E. Generic generated look | Original direction, distinctive materials, product identity, purposeful motion, refined details |

Put side-by-side before/after screenshots for A–E in `docs/v4/after/`.

---

## 12. Testing: two gates plus web quality (no invented results)

### 12.1 Gate A: visual integration
- **Website:**
  - screenshots at all 7 widths, motion and reduced motion;
  - keyboard-only pass (Tab order, visible focus, Esc closes the menu and dialog);
  - dialog focus trap and return;
  - no console errors;
  - animation cleanup (navigate the anchors repeatedly, resize, toggle reduced motion; no duplicated triggers; ScrollTrigger count stable).
- **Extension** (if P8 ran):
  - render the **real** `src/content/` Return Card and Park overlay (not the stub) on the local essay page in Chrome for Testing;
  - check appearance, focus on Resume, Enter / T / Esc, readability on a white page **and** a busy dark page;
  - no layout shift on the host page.
  - **A stub-based run doesn't count for Gate A.**

### 12.2 Gate B: real Chrome behaviour (isolated profile; never my foreground Chrome)
- Run `test/dev/real-chrome-gate.mjs` with **Sidd's real content scripts enabled** (turn the "real scripts" switch on). Cover:
  - Start task → tab group;
  - Park;
  - leaving for YouTube → break;
  - one nudge;
  - return → card;
  - Resume to the saved spot;
  - Tidy;
  - focus loss;
  - worker interruption;
  - Chrome restart recovery;
  - shortcuts ⌥P / ⌥R / ⌥V (where CDP can't press browser shortcuts, use the equivalent message path and **say so**);
  - badge `P → • → empty`.
- Plus `npm test` and `node test/check-integration.mjs`.
- Record pass/fail/skip with reasons in `test/REAL_CHROME_LOG.md`. The Docs row stays "skipped: needs Google login" unless I log in.
- **If a test would need my screen or foreground Chrome, ask first.**

### 12.3 Web quality (measured, reported as measured)
- **Lighthouse** (mobile and desktop) on the production build served locally: LCP, CLS, TBT (as a lab proxy for INP), Accessibility, Best Practices. Targets: LCP < 2.5 s, CLS < 0.1, TBT < 200 ms.
- **axe** on the built page: 0 serious/critical, or each one justified.
- **Frame rate:** a Chrome performance trace (CDP `Tracing`) while scrolling the story on desktop at 1× DPR and with 4× CPU throttling. Report the measured average fps and long frames. **Don't claim 60 fps without this.**
- **Bundle:**
  - `vite build` stats;
  - JS for the first view ≤ about 250 KB gzipped, with 3D in a lazy chunk;
  - GLB within budget;
  - fonts subset (latin) and `font-display: swap`.
- **Contrast:** the token script plus spot checks of text on glass at three scroll positions.
- **Browsers:** Chrome (full). Safari/WebKit and Firefox if available via Playwright, to check the fallbacks render well. If they're not available, say so.

---

## 13. Anti-template audit (write the results in `docs/v4/QA.md`)

**Design patterns to remove:**
- huge solid purple gradients;
- generic glowing blobs;
- repeated equal feature cards;
- uniform rounding with no hierarchy;
- sparkle icons;
- random badges; fake status dots;
- bland icon grids;
- glass-on-glass soup; unreadable transparent cards;
- arbitrary animated underlines; excessive fade-ins;
- scroll hijacking;
- meaningless floating UI;
- decorative charts unrelated to the product;
- tiny body text;
- generic hover glow;
- identical section layouts;
- artificial emptiness;
- stock imagery;
- fake laptop illustrations;
- inconsistent mobile.

**Banned copy:** "Unlock your potential", "Revolutionize your workflow", "Supercharge your productivity", "Elevate your experience", "Next-generation", "Transform the way you work", "All-in-one platform", "Simple. Fast. Secure.", and the word "productivity" as a claim.

**Credibility check:** no fake testimonials, user counts, logos, statistics, contact details or features; no non-functional buttons; no empty policy pages; no broken install links; the footer is correct.

Run **Impeccable's detector** (and fix or justify each finding) and **UI UX Pro Max's** pre-delivery checklist (`references/pro-rules.md`).

**Engineering checklist:**
- no secrets; no unsafe messaging; no new permissions;
- no 2,000-line components; no duplicated functions; no unused imports or code;
- stable keys; correct TypeScript types (`tsc --noEmit` clean);
- no unnecessary effects or render loops;
- async errors handled and not swallowed;
- dependencies real, current, licensed and justified.

---

## 14. Finish: report, then ask

1. `web/`: `npm run build` green (`tsc` + vite), and `site/` regenerated from it. Root: `npm test` green and `check-integration` clean.
2. `superpowers:requesting-code-review` per lane, plus `codex-review:code` if available. Fix real issues.
3. Run the **rubric** with evidence, not invented scores. Give a 1–2 line justification per dimension, pointing at screenshots and measurements, plus the top 3 remaining weaknesses:

   | Dimension | Weight |
   |---|---|
   | Visual identity | 15 |
   | Liquid-glass realism | 15 |
   | Laptop and 3D composition | 15 |
   | GSAP and interaction motion | 15 |
   | Typography and layout | 10 |
   | Product storytelling | 10 |
   | Extension functionality preservation | 10 |
   | Responsive | 5 |
   | Accessibility and performance | 5 |

   Functionality, accessibility or privacy failures are blockers whatever the score.
4. **Report to me** (≤ 40 lines) with:
   - what shipped;
   - screenshots (paths): hero 1440/375, story scenes, Return demo, features, privacy, mobile, reduced motion, the six laptop renders, the playground;
   - measured Lighthouse, axe, fps and bundle numbers;
   - Gate A/B results with skips and reasons;
   - the skills used (from the ledger) and the skills unavailable;
   - files changed (`git diff --stat`);
   - how to run locally (`cd web && npm i && npm run dev`; build; load the extension unpacked from the repo root);
   - the functionality preserved;
   - limitations;
   - what was cut and why.
5. **Ask me** before:
   - merging `redesign/v4` (and `v4/*`) into `main`;
   - pushing;
   - opening or merging PRs;
   - deploying the site;
   - making the repo public.
   - Never force-push.

## 15. The standard

On landing, a visitor notices:
- the refined pastel environment;
- the glass nav, like a well-made object;
- confident type and tactile buttons;
- joyful pink and green accents that don't overwhelm;
- a laptop that looks genuinely premium;
- fluid, connected scroll transitions;
- glass that looks transparent, reflective, luminous, almost wet;
- demos that explain exactly what PickUp does.

The extension stays calm, fast and reliable. It's one coherent product, with its own personality, and it doesn't look like a generated SaaS template.

**Start now:** §2.1 (tool check) → P0 audit → P1/P2/P4 in parallel → validate the laptop, the material and one scroll demo → build out → QA → report → ask.
