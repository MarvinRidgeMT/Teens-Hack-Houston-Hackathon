# V4 tool and skill ledger

One row per use. "unavailable" rows record what could not run and why.

| Time (ET) | Tool / skill | Command or call | Purpose | Output / decision |
|---|---|---|---|---|
| 10:12 | shell | `git fetch`, `git rev-parse origin/main` | Record start SHA | `origin/main` = `46dabed4fa9f8364a524c6ed500c7985f3875a50` |
| 10:12 | shell | `ls design/v4-refs` | Read reference screenshots | Folder empty. Anish chose: proceed from the prompt's written failures and constraints |
| 10:14 | AskUserQuestion | scope, refs, pilot data | Settle open decisions | Website + extension; no ref screenshots; Evidence gets a marked slot (no pilot numbers in repo) |
| 10:16 | git | `checkout -b redesign/v4 46dabed`, `tag pre-v4` (local, not pushed) | Checkpoint | Branch `redesign/v4`, tag `pre-v4` |
| 10:16 | npm / node | `npm test`, `node test/check-integration.mjs`, `npm --prefix web run build` | P0 baseline | All green: 69 contrast, engine, voice, panel, features pass; integration 0 fail 0 warn; web build OK |
| 10:18 | test/dev/web-shots.mjs (Chrome for Testing, headless) | 7 shots of v3 | Before record | `docs/v4/before/*.png` (1440 and 375) |
| 10:18 | Blender | `/Applications/Blender.app/Contents/MacOS/Blender --version` | Check 3D tool | Blender 5.3.0 available (headless CLI) |
| 10:18 | Impeccable CLI | `impeccable --help` | Check real command names | `detect`, `ignores`, `world`, … (critique/audit/polish are skill workflows, not CLI verbs) |
| 10:20 | Superpowers `using-superpowers` | session start hook | Skill discipline | Loaded; plan kept in the app's task list rather than `writing-plans` (time box) |
| 10:20 | Agent (worktree) lane L | Blender headless build | New laptop | `web/three-src/laptop/build_laptop.py`, GLB 80 KB / 17,174 tris / 10 draw calls, 6 Cycles renders, poster; `docs/v4/LAPTOP.md` |
| 10:20 | Agent lane R | headless CfT via `test/dev/web-shots.mjs`, WebFetch | Reference study | `docs/v4/REFERENCES.md`; all 6 sites reachable (Infinity Castle only its gate screen; Domino renders client-side) |
| 10:22 | UI UX Pro Max `search.py` | `--design-system`, `--domain color/typography/ux/gsap`, `--stack react` | Direction research | `docs/v4/research/uupm-raw.txt`. Kept: Liquid Glass style constraints (contrast 4.5, keyboard, focus, reduced motion), GSAP pin/refresh notes. Rejected: navy/gold palette, testimonials pattern, Varela Round/Nunito Sans |
| 10:24 | npm | `@fontsource-variable/plus-jakarta-sans@5.3.0`, `@fontsource-variable/geist@5.3.0` (OFL) | Fonts | Bricolage removed |
| 10:35 | Agent (worktree) lane X | extension restyle | Calm V4 extension | 3 commits by owner area; tests green; Gate A screenshots with real `card.js`/`overlay.js` |
| 10:40 | Impeccable detector hook | ran on every UI file edit | Live anti-pattern scan | No findings on edited files |
| 10:45 | headless CfT | `web/playground.html` (dev only) | Material playground | `docs/v4/after/playground-*.png`; glass retuned after round 1 (QA.md) |
| 10:50 | `web/scripts/contrast.mjs`, `check-tokens.mjs` (new) | in `npm run build` | Contrast over worst background; no raw hex | Pass |
| 11:05 | git merge | lanes X and L into `redesign/v4` | Integrate | One conflict (LaptopModel.tsx): kept lane L's loader |
| 11:08 | `test/dev/site-shots.mjs` | `PANEL_REF=redesign/v4 CONTENT_REF=redesign/v4 PICKUP_HEADLESS=1` | Real product screenshots for the site | `web/public/assets/shot-*.jpg` recaptured from the V4 extension |
| 11:15 | axe-core 4.10.2 (local npm, injected via CDP) | built page, motion + reduced | Accessibility | 0 violations |
| 11:20 | Lighthouse 12.6.1 (npx, CfT headless) | mobile + desktop | Web vitals (lab) | See QA.md: desktop LCP 1.4 s CLS 0; mobile FCP 2.1 s LCP 4.0 s CLS 0; a11y/BP/SEO 100 |
| 11:25 | Impeccable `impeccable-documenter` (agent) | DESIGN.md + `.impeccable/design.json` | Design system doc | Rewritten for V4; contradictions listed and fixed or recorded |
| 11:25 | `MOTION.md` | written by the lead | Motion architecture | Library ownership, timelines, cleanup |
| 11:30 | Impeccable CLI `detect` | `http://127.0.0.1:8765/site/` | Anti-pattern audit | 23 → 3 (nested demo cards, justified in `.impeccable/config.json`) |
| 11:35 | Impeccable `impeccable-finish-reviewer` (agent) | 23 captures at HEAD | After-critique | "fix-then-ship"; 8 material fixes, all applied (QA.md round 5) |
| 11:40 | headless CfT + Metal | `scratchpad/fps.mjs` | Story frame timing | 58–60 fps on GPU (1× and 4× CPU), 24 fps in software GL (`docs/v4/qa/fps.md`) |
| 11:45 | `test/dev/real-chrome-gate.mjs` (visible, user approved) | Gate B | Extension behaviour | 23 pass, 0 fail, 1 skipped (Docs login) |
| 11:50 | `react-reviewer` agent | diff review | Bugs in web/src | see QA.md |
| — | **unavailable / not run** | 21st.dev MCP `search`/`get_component` | Component research | Not run this round (free tier, 2 installs/day; components would be rewritten onto our tokens anyway). Nav sheet, dialog, buttons hand-built on `LiquidGlass` |
| — | **not run** | GSAP official skills (`npx skills add …`), Motion AI Kit | Docs | Not installed (would execute a remote installer); GSAP/Motion used per their documented APIs |
| — | **not run** | `codex-review:code` | Second-opinion review | Not run: it sends this private repo's code to an external model service |
| — | **not used** | 3D transmission objects (`MeshTransmissionMaterial`) | Hero glass objects | Hero capsules are DOM glass instead (cheaper, readable text, no WebGL on phones) |
