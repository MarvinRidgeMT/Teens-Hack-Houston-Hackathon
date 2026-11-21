# Prompt for Claude Code: "Warm Desk, Teal Spark" palette + release branch (Fri night)

> Paste at about 8:30 PM. **Build lock is 10:00 PM; recording starts at 10:00.** Put `Student_focus_app_colour_palettes.md` in `~/pickup/design/` first (the prompt reads it). In `~/pickup`, run `claude` and paste everything below the line.
>
> Tick the box only if Sidd said yes:
> - [ ] Sidd agreed that his return card and overlay colours may change tonight (variable values only, on a branch he reviews).

---

You're working with me, Anish (Person A, "Engine"), on **Pickup**, an MV3 Chrome extension (Triple H 2026). **The build locks at 10:00 PM ET tonight**, and demo recording starts right after. Nothing risky goes in. This session has three jobs, in this order:
1. Get one **release branch** with everything that's ready.
2. Swap the colour palette to **"Warm Desk, Teal Spark"** at the **token level only**.
3. Run the Gate test on it.

New features are **not** part of tonight's build; you'll write them up as roadmap ideas instead.

## 0. Before you start (5 min)

1. Invoke and follow these skills:
   - `superpowers:using-superpowers`
   - `superpowers:verification-before-completion`
   - `superpowers:systematic-debugging` if anything breaks
   - `modern-web-guidance:chrome-extensions`
   - `frontend-design` for visual judgement; the palette and the rules below decide the colours.
2. Read:
   - `design/Student_focus_app_colour_palettes.md` (the palette research: the **"Recommended direction" table and its rules are the spec**);
   - `design/README.md`, `design/tokens.json`, `src/shared/tokens.css`, `src/shared/pk.css`;
   - `BADGE` in `src/shared/constants.js`;
   - `NOTES_FOR_TEAM.md` (Treatment change log, Stable element IDs).
3. `git fetch origin`, then check for new pushes from Sidd or Abhinav (`git branch -r`, `git log origin/<branch> -5`). **If Abhinav pushed his own `src/pages/`, stop and ask me** which pages ship: his or `redesign/pages`.

## 1. Release branch (by 8:50 PM)

- Create `release/v1` from `redesign/integration-test`. It already merges `redesign/engine-panel`, `redesign/pages`, `redesign/site` and Sidd's content. Confirm with `git log --graph --oneline -25` that `origin/sid/content`, `feature/panel`, `feature/panel-schema` and `feature/site` are all included; merge any that are missing.
- Remove dev-only harness changes that must not ship, such as the "harness unticks Sidd's real-scripts box" switch. Keep them only under `test/`.
- Green before you touch colours:
  - `npm test`
  - `node test/voice.test.mjs`
  - `node test/check-integration.mjs` (**no FAIL**; `manifest` paths must now resolve)
  - Load the folder unpacked in Chrome for Testing **as it is**, with no placeholder pages. It must load without errors.
- Report to me in 3 lines. **Don't merge into `main` yet.**

## 2. Palette swap (by 9:25 PM) · tokens only

Change **values** in `design/tokens.json`, `src/shared/tokens.css`, `src/shared/pk.css` (only if it holds raw colours) and `BADGE`. **Don't** rename the existing token names that components use: add new tokens and point old names at them, so no component CSS has to change. Don't change layout, type, spacing, motion, copy or element IDs.

| Role (token) | Paper / light | Blue hour / dark | Rule |
|---|---|---|---|
| `paper` (canvas) | `#FAF8F4` | `#14171F` | Never pure white or black |
| `surface` (cards, popup, panel) | `#FFFFFF` | `#1C2029` | |
| `ink` | `#1E2230` | `#E6E8EE` | |
| `ink-body` (muted text) | `#5C6170` | `#9AA0AE` | |
| `border` | `rgba(30,34,48,.12)` | `rgba(230,232,238,.14)` | Decorative only |
| `border-strong` (inputs, quiet buttons) | `#8A8F9C` | pick a value ≥ 3:1 on `#1C2029` | |
| `accent` (the one primary button) / `on-accent` | `#0D7C72` / `#FFFFFF` | `#3DD6C4` / `#14171F` | **Teal replaces black as the primary.** One per view |
| new `accent-tint` (secondary buttons) | bg `#E3F4F1`, text `#0B6E65` | pick a tint and text ≥ 4.5:1 | |
| new `resume` (the "pick up where you left off" moment) | `#5B4BE0` | `#A99CFF` | Next-step highlight, the active task, "you were here" glow, focus ring |
| new `resume-tint` | `#EEEBFF` | pick a dark violet tint where `ink` ≥ 4.5:1 and `resume` ≥ 3:1 | |
| `mist` → points at `resume-tint` | | | The next step sits in violet: a soft landing, not an alarm |
| `periwinkle`, `focus-ring` → point at `resume` | | | |
| new `spark` | `#2DD4BF` **fill only**, with `#1E2230` text | `#3DD6C4` | **Never text or thin lines on light** (1.75:1) |
| new `reward` | `#FFB547` fill + `#1E2230` text | `#FFC46B` | Fills and icons only. Use only on the comeback receipt's headline number. **No streaks, no "great job"** |
| new `rest` (paused / away, neutral, **never red**) | `#8A8F9C` icons; text in `ink-body` | `#9AA0AE` | |
| new `danger` | `#B42318` | `#F97066` | **Only** the Delete-all action |
| `shadow-card` | keep the shape; tint the light shadow with violet `rgba(91,75,224,.12)` | unchanged | |

**State colours** (toolbar badge and chips). Light values go in `BADGE`, because the toolbar badge has one colour:

| State | Light (white glyph) | Dark (ink glyph) |
|---|---|---|
| parked `P` | `#5B4BE0` resume violet | `#A99CFF` |
| away `•` | `#5C6170` neutral. **Not amber or red**: being away is normal | `#9AA0AE` |
| wrapped `☾` | `#1E2230` | `#E6E8EE` |
| saved `✓` | `#0D7C72` teal | `#3DD6C4` |
| neutral `!` `?` | `#5C6170` | `#9AA0AE` |
| timer (minutes left) | `#5B4BE0` | `#A99CFF` |

Glyphs, not colour, carry the meaning. Keep them.

**Contrast is enforced.** Add `test/contrast.test.mjs`, which computes the WCAG 2 contrast ratio from `design/tokens.json`. It **FAILs** if any of these drop below their minimum:
- text pairs (`ink`, `ink-body`, `on-accent`, `accent-tint` text, `resume` text, `danger` text, on their backgrounds, in both themes): **4.5:1**;
- controls, icons, focus ring, `border-strong` and badge glyphs: **3:1**.

It also FAILs if `spark` or `reward` is used as a text colour anywhere in `src/` or `site/` (simple grep). Where you had to pick a value ("pick …" above), choose the closest value to the palette's spirit that passes, and log it in `design/SOURCE.md`.

**Sidd's card and overlay** (`src/content/`, hard-coded `--pk-*` variables in `card.js` / `overlay.js`):
- **If the box at the top is ticked:** on branch `palette/content`, change **only the variable values**:
  - background `#1C2029`, panel tint `rgba(169,156,255,.08)`, line `rgba(230,232,238,.14)`;
  - ink `#E6E8EE`, muted `#9AA0AE`;
  - accent stays spark teal (`#2DD4BF`, it's already a fill behind dark text);
  - the next-step box gets the violet treatment (`resume` `#A99CFF` label, tint background).
  - The card stays dark on every site (it must stand out on white pages).
  - Then add **"card v2 (palette) from <exact time>"** to the Treatment change log in `NOTES_FOR_TEAM.md` and `test/REAL_CHROME_LOG.md`, because the card is the pilot's treatment.
- **If the box isn't ticked:** don't touch `src/content/`. Write the same values as a 10-line change list for Sidd in `NOTES_FOR_TEAM.md`. The card already uses spark teal on dark, so it fits the palette as it is.

**Website** (`site/`): it uses the same tokens, so it follows automatically. Check that the hero and Download button meet the same contrast rules, and that the social image isn't stale. Regenerate it only if it takes under 5 minutes.

## 3. Optional, only if sections 1–2 are green by 9:25 PM: a "Calm" theme · 15 min

- Setting `settings.calm` (default off), with a "Calm colours" toggle on the setup page (`redesign/pages` code is in `release/v1`).
- It sets `data-calm` on extension pages and the side panel. Under it, `accent`, `resume` and `spark` use lower-saturation versions that still pass `test/contrast.test.mjs`. Add them to `tokens.json` under a `calm` key, and extend the test to check them.
- It also turns off the decorative motion: fireflies, fog, glow.
- Not in the content-script card tonight.

If it isn't done by 9:40, drop it.

## 4. Gate and screenshots (9:25–9:55 PM)

1. All tests green: `npm test`, voice tests, `check-integration`, `contrast`.
2. Fresh Chrome profile, load `release/v1` unpacked, then run **Gate Run A** (`test/GATE_CHECKLIST.md`, debug on). **Steps 6–8 must pass.** If anything fails, revert the palette commit, not the release branch. Shipping the old colours is fine; shipping a broken loop is not.
3. Screenshots at 1280×800 @2x into `docs-shots/palette/`, **light and dark**: popup, setup, dashboard (with sample data), side panel, return card, overlay, toolbar badge states (render a strip of the five states), comeback receipt, and the website hero.
4. `superpowers:requesting-code-review` on `release/v1` vs `main`. Fix only real bugs.
5. **Ask me** before you merge `release/v1` into `main`, push, or tag `v1.0-rc`. Don't do any of them without my yes.

## 5. Roadmap ideas, written down rather than built (about 10 min, any time before 10:00)

Write `docs/ROADMAP_IDEAS.md` (a short, honest list for the Devpost "What's next" section and the Future slide). Each idea gets one line saying **why**, with a source where one exists:
- **Test the resume colour:** an A/B test of the violet resume treatment vs a neutral one, measured on time to first work interaction. It's the open question the palette research ends on, and our pilot machinery already does random assignment.
- **Student-chosen accents** (violet-led, lime-led) on top of Calm. Taste in colours shifts fast; the palette research suggests user-selectable accents.
- **Colour-blind check mode:** preview the card under common colour-vision deficiencies in setup. About 1 in 12 men have red-green deficiency.
- **Restrained reward moment:** a skippable, under-3-second apricot "first comeback today" mark. No streaks or guilt; reduced-motion safe.
- From earlier research:
  - PDF reading position;
  - Panopto/Kaltura lecture resume inside Canvas;
  - deadline-aware threads (read from pages you're already on);
  - an opt-in, on-device AI recap clearly labelled as a suggestion;
  - opt-in Google sync (disclosed as Google's servers);
  - a quiet study-with-me mode;
  - a weekly reflection;
  - JSON export and import.
- **What we chose not to build, and why:** Pomodoro timers, site blocking, auto-closing tabs, AI-written next steps, red "you slipped" states.

## Rules (all non-negotiable)

- **No behaviour changes.** No changes to the coin flip, return detection, first-interaction timing, message protocol, event schema, element IDs or keys.
- **Extension privacy:** no network requests from the extension; the bundled Inter stays bundled.
- **Ownership:** `src/content/` only via the ticked box; `src/pages/` comes from `redesign/pages` (Claude-built, Abhinav reviewing). Ask me if Abhinav pushed his own pages.
- Never claim Pickup "increases productivity"; red appears only for delete.
- **At 10:00 PM, stop where you are.** Commit what's green and tell me exactly what's on `release/v1`, what's left, and whether the palette is in or reverted.
