# Prompt for Claude Code: Pickup panel + download website

> In `~/pickup`, run `claude` and paste everything below the line. This runs in **two separate branches**, so it can't collide with the Gate fixes on `main`.

---

You're working with me, Anish (Person A, "Engine"), on **Pickup**, an MV3 Chrome extension for the Triple H 2026 hackathon (theme: "a more efficient way to live"). Pickup saves a student's place when they get interrupted and hands it back when they return. The engine, Sidd's return card and overlay (branch `origin/sid/content`) and the voice side panel (`src/voice/`) all work in real Chrome.

**Deadlines (ET):** Gate Fri 2:00 PM (schema freeze) · build lock Fri 10:00 PM · submit Sat 3:00 PM.

You will build two things:
- **Part A:** turn the voice side panel into the full **Pickup panel** (type or talk to ask, break timer, task list, today's facts).
- **Part B:** a one-page **download website** for judges.

## Before you start

1. Invoke and follow these skills:
   - `superpowers:using-superpowers`
   - `superpowers:using-git-worktrees`: Part A on branch `feature/panel`, Part B on branch `feature/site`, each in its own worktree. Never commit to `main` directly. Others are fixing Gate blockers there this morning.
   - `modern-web-guidance:chrome-extensions` for Part A: side panel, alarms, notifications, storage, message passing.
   - `modern-web-guidance:modern-web-guidance` for both parts. Search it before writing layout, form, dialog or animation code.
   - `frontend-design` (or `anthropic-skills:frontend-design`) for the panel's look and the website.
   - `superpowers:test-driven-development` for every engine and parser change (`test/engine.test.mjs`, `test/voice.test.mjs`).
   - `superpowers:verification-before-completion` before you tell me anything is done.
   - If the **MotionSites** MCP is connected, use `find_designs` → `build_page_plan` → `get_prompt` for the website's layout. Adapt it to Pickup's house style below; don't copy someone's branding.
2. Read:
   - `src/sw/README.md`, `NOTES_FOR_TEAM.md`, `test/REAL_CHROME_LOG.md`;
   - `src/voice/*`, `src/sw/voice.js` (`buildReply`, `todayFacts`, `handleVoiceCommand`), `src/shared/messages.js`, `src/sw/nudge.js`, `src/sw/events.js`;
   - Sidd's card: `git show origin/sid/content:src/content/card.js`. Copy its design tokens; don't import his file.
3. Run `npm test` and `node test/voice.test.mjs`. **Note:** one check, `Review F1` (wrap-up, "next morning"), fails depending on the local time of day. That's a known bug, being fixed separately on `main`. Ignore only that one check. Everything else must stay green.

## Rules (all non-negotiable)

- **Ownership.** You may edit `manifest.json`, `src/shared/` (except `stats.js`), `src/sw/`, `src/voice/`, `test/`, a new `site/` folder, `NOTES_FOR_TEAM.md`, and a GitHub workflow for the site. **Never** edit `src/content/` (Sidd) or `src/pages/` (Abhinav). What they need goes in `NOTES_FOR_TEAM.md`.
- **Extension privacy:** no server, network requests, accounts or analytics. Everything stays in `chrome.storage.local`.
- **No AI-written text.** "Ask" is the **same rule-based parser** voice uses (`src/voice/intents.js`). Every reply is a fixed template filled with recorded facts or the user's own words. Unknown questions get the help line; never a guess.
- **Experiment stays clean.** Every return still goes through normal return detection and the coin flip. New ways of returning get a `returnVia` value; nothing creates or edits events directly.
- **At most one notification per break.** A break timer's notification replaces the drift nudge for that break; it never adds to it.
- **Schema freeze at 2:00 PM.** Any new **event** field or enum value must be committed and on `main` before 2 PM, or it doesn't ship (see Step 0). After 2 PM, new data goes only in `openBreak`, threads or settings, never in events.
- Plain JS, no build step, no npm runtime dependencies in the extension. CSP-safe: no inline scripts or handlers. Keyboard access and visible focus for everything; colour is never the only signal; respect `prefers-reduced-motion`.
- **Time-boxes and cut order are below.** If something isn't working by its time-box, leave it out (behind a constant that's off by default), commit what works, and move on.
- Ask me before: merging into `main`, pushing, changing repo settings, enabling GitHub Pages, or making anything public.

## Step 0: schema additions (do this first; must reach `main` before 2:00 PM)

These are tiny, additive event values the panel needs. Do them on a short branch `feature/panel-schema` and show me the diff. **I'll merge it before the Gate.** If it's past 1:30 PM when you get here, skip it: the features still work, they just aren't separable in stats.
- `returnVia` gains `'panel'` (Resume from the task list or the Ask box) and `'timer'` (clicking the break-over notification).
- New optional event field `plannedBreakMin` (number or null): set when the break was started with the break timer, so stats can separate planned breaks from interruptions.
- Update the event table in `src/sw/README.md` and checks in `test/engine.test.mjs`. In `NOTES_FOR_TEAM.md`, tell Abhinav: one new CSV column, two new `returnVia` values.

## Part A: the Pickup panel (branch `feature/panel`) · time-box about 3.5 h total

The side panel (`src/voice/panel.html`, opened with Alt+V) becomes the **Pickup panel**. Voice stays exactly as it works today; everything new must also work with voice off.

### A1. Ask: type or talk · 45 min
- A one-line command box at the top, in the Manus-style pattern of Sidd's overlay: input, round teal send button, a hint row with `↵ ask` and `Esc clear`. Placeholder: `Ask Pickup… "where was I?"`.
- Quick chips under it: **Where was I?** · **Take me back** · **How long was I away?** · **Today**.
- Typed text goes through the same `parse()` → `voiceCommand` → `buildReply` path as speech. Show the reply as text in the same `aria-live` region. Speak it only if voice is on **and** a new "Read replies aloud" toggle is on (default on when voice is on).
- Resume through Ask sets `returnVia: 'panel'`. Through the mic it stays `'voice'`.
- The mic button sits inside the ask box as a small secondary button. Voice setup stays where it is, collapsed when it's done.

### A2. Break timer: "Back in 10" · 75 min
- **Intent** (add to `intents.js`, with tests): `breakTimer` with `args.minutes` (1–120). It matches:
  - "back in 10", "break for 15 minutes", "take a 10 minute break", "set a break for 20 min", "give me 5 minutes".
  - Number words one to sixty, plus "half an hour" = 30 and "an hour" = 60.
  - The existing `park` rule must not swallow these: test both ways, e.g. "park it" vs "take a 10 minute break".
  - Also `cancelBreak`: "cancel the break", "I'm back early" → treated like `resume`, but only when a timed break is running.
- **Panel UI:** chips **5 · 10 · 15 · 25 min** plus a custom number, and an optional "Next step when I'm back" field (the user's own words). While running, show a large countdown, the task name, "ends at 3:40 PM", and **Back now** / **Cancel** buttons. The countdown is computed from stored `endsAt` on every tick, so it survives the panel closing and reopening.
- **Engine:** new message `startBreak { minutes, nextStep?, tabId? }` → `{ ok, endsAt, threadId }`.
  - It parks the task of the active work tab (or the most recent task) exactly like `park`: breadcrumb, `nextStepSource: 'typed'` if given.
  - It stores `plannedMin` and `endsAt` on `openBreak` (additive; `openBreak` isn't frozen).
  - It creates alarm `breakend:<eventId>` and **cancels the drift nudge for that break**.
  - `cancelBreak {}` clears the alarm and the plan. The break itself stays open: they may still be away.
- **When the alarm fires and the break is still open:** one notification, id `breakend:<eventId>`: title "Break's over: <task>", message "Next: <next step>" or "Pick up where you left off". Click → set `returnVia: 'timer'` → `resume(threadId)`.
  - If the user already came back early, there's no notification.
  - The badge (`badge.js`) shows the remaining minutes as text, e.g. `9m`, with the tooltip "Pickup: back to <task> at 3:40 PM".
- **On return,** the event gets `plannedBreakMin` (if Step 0 shipped). The card is unchanged; Sidd's card already shows time away.
- **Debug mode:** minutes count as **seconds × 10** (a "10 min" break ends in 100 s), so it can be filmed. Label this clearly in the panel when debug is on.

### A3. Task list · 60 min
- **Engine:** new message `listThreads {}` → `[{ threadId, name, taskType, nextStep?, nextStepSource?, leftAt?, url, tabCount, isOpenBreak, isParked, isWrapped }]`.
  - Sort by the most recent `leftAt` or `createdAt`.
  - Leave out auto threads with no breadcrumb.
  - Mark auto threads "Untitled (from <hostname>)".
- **Panel:** a "Your tasks" list. Each row shows the name, a status chip (**Parked** · **Away 12 min** · **Saved for tomorrow** · nothing), the next step in a line labelled with its source ("you wrote this" / "you picked this" / "you said this"), and "last here 25 min ago".
  - Buttons: **Resume** (→ `resumeTask {threadId}` with `returnVia: 'panel'`) and **Edit next step** (inline field → new message `setNextStep { threadId, nextStep }` → stored with `nextStepSource: 'typed'`).
  - It refreshes live on `chrome.storage.onChanged`.
  - Empty state: "No tasks yet. Start one from the Pickup popup, or press Alt+P on a work page."

### A4. Today strip · 20 min
A single line at the bottom: "Today: **4** breaks · **22 s** median back to work · most time away: **youtube.com (31 min)**".
- Built from `todayFacts` and `distractionHost`/`awayMs`. Debug events excluded.
- Facts only: no praise, streaks or judgement. If there's no data: "No breaks logged today."

### A5. Look and feel · within the time-boxes above
- Rename the panel to "Pickup". Command `toggle-voice` description → "Open the Pickup panel" (key Alt+V unchanged). Keep the file paths to avoid churn.
- Use Sidd's house style, from `card.js`:
  - surface `#0e0f11`, hairline `rgba(255,255,255,.11)`, radius 20px;
  - accent `#2dd4bf`, text on teal `#042f2e`;
  - ink `#f4f4f5`, muted `#a1a1aa`;
  - font stack `"Geist","Inter",system-ui,…`;
  - mono UPPERCASE micro-labels at 11.5–12px; body 15–17px;
  - pill buttons with kbd chips;
  - spring-feel CSS transitions (transform and opacity only), off under reduced motion.
- **Don't** load Sidd's vendored libraries into the panel. CSS is enough.
- **Order top to bottom:** status line → Ask box + chips → reply → break timer → Your tasks → Today strip → voice settings (collapsed).
- **Readable at 125% zoom** in a 360px-wide panel.

### A6. Test and document
1. All engine and voice tests green (except the known `Review F1`), with new checks for:
   - each intent, including the park/breakTimer collisions;
   - `startBreak` / `cancelBreak` / the alarm firing / early return / one notification only;
   - `listThreads` order and filtering;
   - `setNextStep`;
   - `returnVia: 'panel'` and `'timer'`;
   - the badge countdown.
2. Real Chrome: extend `test/dev/real-chrome-gate.mjs` (or a new `test/dev/panel-check.mjs`) to open the panel page as a tab and drive it:
   - type "where was I", "back in 10" (debug = 100 s), wait, click the notification path through the message, check the event;
   - list tasks, Resume from the list.

   Screenshot the panel at 360×800 into `docs-shots/panel-*.png` (my folder). Update `test/REAL_CHROME_LOG.md`.
3. `superpowers:requesting-code-review` on the branch diff. Fix anything real.
4. `NOTES_FOR_TEAM.md` → "Pickup panel (new)":
   - **Abhinav:** add a popup button "Open Pickup panel" (`chrome.sidePanel.open({ windowId })` in the click handler). The new `returnVia` values and `plannedBreakMin` go in stats and CSV.
   - **Sidd:** nothing required. Optional: the card could say "Planned break: 10 min" when `plannedBreakMin` is set (only if he wants; it's a recorded fact).

**Part A cut order:** Today strip → task-list "Edit next step" → break-timer badge countdown → task list → break timer. The Ask box ships first and must not be cut.

## Part B: download website (branch `feature/site`) · time-box about 2.5 h

A single static page in `site/` (`index.html`, `styles.css`, `site.js` only if truly needed, `assets/`). It's the one link judges get. No build step, no frameworks, no trackers or analytics, no third-party scripts. Self-host fonts or use the system stack.

**First, a blocker check:** run `gh repo view MarvinRidgeMT/Teens-Hack-Houston-Hackathon --json visibility`. If the repo is **private**, judges can't download releases or see GitHub Pages (Pages on private repos needs a paid plan). **Stop and tell me** before deploying anything. Build the page anyway; hosting waits for my answer.

### Sections, in order
1. **Hero:**
   - Pickup logo (`assets/icon128.png`), headline "Undo the interruption, not the mistake.";
   - sub-line: "A Chrome extension that saves your place when you get pulled away and hands it back when you return.";
   - primary button **Download for Chrome**, linked to the latest GitHub release zip, with a small caption under it: "Free · Load unpacked · No account · Nothing leaves your computer";
   - secondary button **Watch the 6-min demo** (anchors to the video).
   - Visual: the real return-card screenshot.
2. **The problem, in 3 short lines** with one carefully worded research note, as in the product brief:
   - Gloria Mark's field studies found interrupted work typically resumed about 23 minutes later, often after two other tasks.
   - Present it as context, **not** a promise.
   - Link the source: news.gallup.com/businessjournal/23146/too-many-interruptions-work.aspx.
3. **How it works, in four steps with real screenshots:** Leave (automatic save) → Drift (optional nudge) → Return (the card) → Resume (one key). Use real captures only (step 7 below). No mockups dressed up as product.
4. **Features grid** (only what ships in v1.0; verify each against `main` before listing it): return card + Resume, Alt+P park with your next step, task tab groups, Tidy, drift nudge, Alt+R resume from anywhere, right-click "make this my next step", wrap up → "Start here", Pickup panel (ask, break timer, task list), "Hey Pickup" voice (on-device).
5. **Privacy:**
   - everything stays in Chrome's local storage;
   - no accounts, servers or analytics;
   - only a highlight of up to 200 characters is stored, never page text;
   - voice is recognised on-device and no audio is kept;
   - one button deletes everything.
   Link the honest-limits list: Pickup can't see your phone, can't read Google Docs text, and time to first interaction is a proxy for getting back into work.
6. **Evidence:** a clearly marked slot `<!-- PILOT RESULTS: filled Sat 10 AM -->` showing "Results from our 3-person pilot are posted Saturday." **Never invent numbers.** Make it one HTML block that's easy to edit.
7. **Install in 4 steps:** download and unzip → open `chrome://extensions` → turn on Developer mode → **Load unpacked** and pick the folder. Leave a slot for Sidd's 30-second install GIF (`site/assets/install.gif`, placeholder frame until it exists). Then: "Try it without your own data: open the dashboard and click **Load sample data**."
8. **Demo video:** a responsive YouTube embed slot (`<!-- VIDEO: unlisted YouTube id goes here -->`) with a poster image. It must not autoplay.
9. **Roadmap** (from the brief): classmate pilot, Edge port, on-device suggestions marked as suggestions, desktop companion.
10. **Team and footer:** Anish (Engine), Sidd (Surface), Abhinav (Setup, Evidence & Story). "Built in 48 hours for Triple H 2026." Links: GitHub repo, Devpost (slot), MIT licence notices for Motion and Anime.js.

### Rules for the page
- **Don't** imitate the Chrome Web Store: no "Add to Chrome" wording, no store badge, no Chrome logo, no fake ratings, review counts or user numbers, no testimonials.
- **Copy:** specific, plain and honest. No "boost productivity by X%" claims. Pickup never claims to "increase productivity".
- **Style:** Pickup house style, dark surfaces with the teal accent, matching the card, so the site and the product look like one thing. Responsive from 360px to 1440px, at least 4.5:1 contrast, visible focus, semantic landmarks, alt text on every screenshot, reduced-motion safe.
- **Weight:** under 1.5 MB without the GIF and video. Compress PNGs. Use `loading="lazy"` below the fold.
- **Meta:** `<title>`, description, Open Graph and Twitter card tags with the return-card image, and a favicon from the icon.
- **Real screenshots** (step 3): load the extension from a test copy in Chrome for Testing, like the existing harness, against a local essay page. Use `origin/sid/content`'s real card and overlay, and the panel from Part A if it's ready, else the current voice panel. Capture at 1280×800, device scale 2: overlay, parked pill, return card, resumed page, panel. Write them to `site/assets/`. Don't touch the shipped extension files to get them.

### Hosting (ask me first)
- Preferred: GitHub Pages from `site/` with a minimal `.github/workflows/pages.yml` (official `actions/upload-pages-artifact` + `actions/deploy-pages`). Show me the workflow before committing it, and **ask before** enabling Pages.
- Custom domain: the hackathon gives a free `.xyz` domain. Write `site/CNAME.example` and a 5-line instruction for me (register, add the DNS records GitHub Pages documents, rename to `CNAME`). Don't buy or register anything.
- Release link: make the Download button point to `https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest`. Note in `NOTES_FOR_TEAM.md` that the v1.0 release zip (Saturday) must exist for the button to work.

**Part B cut order:** roadmap → features grid trimmed to the four core features → install GIF slot (keep the text steps) → hosting (ship as a zip of `site/` that we can host later). The hero, install steps, privacy and evidence slot must ship.

## Finish

1. For each branch: tests green (except the known `Review F1`), real-Chrome screenshots, code review done.
2. Send me the panel screenshots and a desktop + mobile screenshot of the website.
3. A ≤10-line summary covering:
   - what shipped;
   - what got cut;
   - whether Step 0 needs merging before 2 PM;
   - the exact merge order: `feature/panel-schema` → (after the Gate) `feature/panel` → `feature/site`.
4. A 4-line team-chat message for Sidd and Abhinav.
5. Ask before any merge, push, or Pages change.
