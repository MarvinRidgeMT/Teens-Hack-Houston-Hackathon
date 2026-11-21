# Prompt for Claude Code: five engine features (Thu night)

> How to use: in `~/pickup`, run `claude` (a new session is fine) and paste everything below the line.

---

You're continuing work with me, Anish (Person A, "Engine"), on **Pickup**, an MV3 Chrome extension for the Triple H 2026 hackathon. The core loop is done: 39 checks pass in `npm test`, the real-Chrome run is 17/18, and it's pushed to `origin/main`. The Gate (Fri 2:00 PM ET) freezes the event schema. Tonight I'm using my head start to add **five features, all in my lane**. Team sync is at **11:30 PM ET**, so aim to be finished by **11:00 PM**.

## Before you start

1. Invoke and follow these skills:
   - `superpowers:using-superpowers`
   - `modern-web-guidance:chrome-extensions`: MV3 rules. Check every manifest or API change against its Output Checklist. Rules 9 (confirm context-menu actions to the user) and 11 (`chrome.action` needs `"action"` in the manifest) matter tonight.
   - `superpowers:test-driven-development`: each feature starts with failing checks in `test/engine.test.mjs`. Extend `test/fake-chrome.mjs` with `contextMenus`, `action.setBadgeText/setBadgeBackgroundColor/setTitle` and the `resume-task` command as needed.
   - `superpowers:systematic-debugging` when real Chrome disagrees with the fake.
   - `superpowers:verification-before-completion` before you tell me anything is done.
2. Read: `src/sw/README.md`, `NOTES_FOR_TEAM.md`, `test/REAL_CHROME_LOG.md`, `test/GATE_CHECKLIST.md`, `handoff/Pickup_Engine_Handoff.pdf`, then the engine code.
3. Run `npm test` and `node test/check-integration.mjs`. If either is red before you start, stop and tell me.
4. Make a task list with the five features in the **build order** below.

## Hard rules (unchanged)

- **Only edit my lane:** `manifest.json`, `src/shared/` (except `stats.js`), `src/sw/`, `test/`, `NOTES_FOR_TEAM.md`. Never edit `src/content/` (Sidd) or `src/pages/` (Abhinav). Anything they need goes in `NOTES_FOR_TEAM.md`.
- Plain JS, no build step, no runtime dependencies. All SW listeners are registered synchronously at top level, every handler goes through `store.serial()`, and nothing important lives in a global.
- **Don't break existing behaviour:** all 39 current checks stay green, and no existing message name or event field changes meaning. New things are **additive and optional**. A content script or popup that ignores them must still work.
- **Product rules:** no server, network, accounts or analytics. No AI-written text. Nothing is closed, moved or hidden without a user click. Every card line is a recorded fact or the user's own choice, labelled honestly. At most one notification per break. Keyboard access for everything.
- **Time-box:** if a feature isn't working by its time-box, put it behind a constant that's **off by default**, commit what works, note it in `test/REAL_CHROME_LOG.md`, and move on.
- Commit each feature separately with a clear message. **Ask me before pushing.**

## Build order and specs

### Feature 5: New event fields (first, because the schema freezes at the Gate) · time-box 30 min

Add to every event created in `closeBreakOnReturn` (additive, never removed):
- `awayMs`: exact `returnedAt - leftAt` in ms.
- `distractionHost`: hostname, without `www.`, of the **first** distraction tab seen during the break (from the session `breakTabs` list). `null` for `focus` and `idle` breaks with no distraction tab.
- `distractionHosts`: unique hostnames of all distraction tabs seen during the break, in order. Hostnames only, never paths or titles.
- `returnVia`: how the user came back: `'tab'` (a normal tab or window activation), `'resumeKey'` (Feature 1), `'notification'` (clicking the nudge or Start-here notification), `'idle'` (back at the keyboard while Chrome was on the task). Set a short-lived session marker before the engine activates the tab, so the return handler can read it. Default `'tab'`.

Checks: each field for tab, focus, idle and park breaks, plus a break that visited two distraction sites. Update the event table in `src/sw/README.md`. In `NOTES_FOR_TEAM.md`, tell **Abhinav**: four new columns for the CSV export and import (import must accept older rows without them); `returnVia` lets stats separate returns where Pickup did the navigating; and these fields only exist if the team agrees at the 11:30 sync, since the plan says schema changes need all three.

### Feature 4: Toolbar badge · time-box 30 min

- One `updateBadge()` in a new `src/sw/badge.js`, called from a top-level `chrome.storage.onChanged` listener on `openBreak` and `wrapUp`, and on install and startup. This catches every write without touching every call site.
- States:
  - **parked** (`departed: false`): text `P`, teal `#0D9488`, title "Pickup: <task> parked: leave when you're ready".
  - **break open** (`departed: true`): text `•`, amber `#D97706`, title "Pickup: <task> is waiting".
  - **wrapped up for the day** (Feature 2): text `☾`, or `Z` if the glyph renders badly, with title "Pickup: <task> saved for tomorrow".
  - **none**: empty text, title "Pickup".
- Meaning must not rely on colour alone: the text and tooltip carry it.
- `flashBadge(text, ms)` for confirmations (Feature 3): shows the text for about 2 s, then returns to the real state. Use `chrome.alarms` only if the time exceeds 30 s. A `setTimeout` of 2 s is fine while the worker is busy, and if the worker dies the next `onChanged` restores the badge.

### Feature 1: Resume from anywhere (Alt+R) · time-box 45 min

- Manifest: add command `"resume-task"` with suggested key `Alt+R` and description "Jump back to your task". On macOS that's Option+R. Confirm it shows and works in `chrome://extensions/shortcuts`. If it clashes, say so and propose `Alt+Shift+R`. Keep `park-task` as is.
- Target thread, in order:
  1. the open break's thread, whether parked or departed;
  2. otherwise the breadcrumb with the latest `leftAt`;
  3. otherwise the last work tab's thread.
  If none exists, `flashBadge('?')` and do nothing else.
- Action: set the `returnVia: 'resumeKey'` session marker, then call the existing `resume(threadId)` (focus window, activate tab, expand group, restore scroll). Normal return detection then closes the break and logs the event as usual, card or control by coin flip. Don't bypass the experiment.
- If the target thread's tab is the active, focused tab and no break is open: just `restoreScroll`. No event.
- Also add popup message `resumeTask { threadId? }` → `{ ok, threadId }` (no `threadId` = same target logic) so Abhinav's popup and the test driver can use it. Add it to `MSG` and `TO_ENGINE`, and document it in `src/sw/README.md`.
- Checks: Alt+R from YouTube during a departed break → event with `returnVia: 'resumeKey'`; Alt+R while parked; Alt+R with no history; Alt+R when already on the task.

### Feature 3: Right-click → "Make this my next step" · time-box 45 min

- Manifest: add the `contextMenus` permission.
- On `runtime.onInstalled`: `chrome.contextMenus.removeAll()`, then create `{ id: 'pickup-next-step', title: 'Make this my next step', contexts: ['selection'] }` with `documentUrlPatterns` built from `settings.workSites`. Use `*://*.<host>/*` and `*://<host>/*`, plus the path when the site entry has one. When `settings` changes (storage `onChanged`), call `contextMenus.update` with new patterns. With no work sites, set `visible: false`.
- `contextMenus.onClicked` (through `serial`): text = `info.selectionText` trimmed, whitespace collapsed, capped at 200 chars. Skip if empty. That happens in Google Docs, where selection text usually isn't exposed; then `flashBadge('!')` and write a clear console line.
  - Thread = `ensureThreadForTab(tab)`. Write the breadcrumb's `nextStep` and keep every other breadcrumb field. If there's no breadcrumb yet, build one from `snapshot()` with `signal: 'note'` and **do not open a break**.
  - Add `nextStepSource: 'selected'` to the breadcrumb. Alt+P and popup paths set `nextStepSource: 'typed'`.
  - Include `nextStepSource` in the `showCard` message (additive). In `NOTES_FOR_TEAM.md`, tell **Sidd**: when it's `'selected'`, label the line "Your next step (you picked this)" instead of "(you wrote this)". The card must stay honest, and a missing value means "typed".
  - Confirm with `flashBadge('✓')` (MV3 rule 9: no silent actions). No notification, which keeps notifications for the nudge.
- Checks: menu patterns follow settings; click on a work tab sets the next step and source; click with empty selection; click when a break is open (the open break's breadcrumb is updated, not replaced).

### Feature 2: Wrap up → "Start here" next morning · time-box 75 min

- Implement `wrapUp { tabId, nextStep? }` (currently a stub) → `{ ok, wrapUp }`:
  - thread = `ensureThreadForTab`;
  - snapshot and write the breadcrumb with `signal: 'wrap'` (keep `nextStep` unless a new one is given; `nextStepSource: 'typed'` if given);
  - **close any open break without logging an event** (wrapping up is not an interruption) and cancel its nudge;
  - store the new key `wrapUp = { threadId, tabId, url, scrollY, highlight, nextStep?, at, dayKey, shown: false }`.
  - Also add command `"wrap-up"` with **no suggested key** (user-bindable), so it works before the popup exists.
- `dayKey` = local date of `now − 4 h` (`YYYY-MM-DD`), so working past midnight still counts as "tonight".
- **Start here trigger:** on the first user activity (tab activated, tab created, window focus, idle → active) where `dayKey(now) > wrapUp.dayKey` and `!wrapUp.shown`:
  - show **one** notification, id `starthere:<threadId>`: title "Start here: <task>", message "Next: <nextStep>" or "Pick up where you stopped yesterday".
  - set `shown: true`.
  - Clicking it sets `returnVia: 'notification'` and calls `resume(threadId)`.
  - After the resume, send the resumed tab an **optional** new message `startHere { threadName, nextStep?, nextStepSource?, wrappedAt }`. Add it to `MSG` with a comment marking it optional. In `test/check-integration.mjs`, make a missing handler for it a **WARN, not FAIL**. In `NOTES_FOR_TEAM.md`, tell Sidd it's a stretch card variant: "Start here: <task> · Next: … · stopped yesterday at <time>", with one Resume button.
  - The Start-here return is **not** an experiment event: no break was open. Don't create one.
- **Demo/debug path:** with `settings.debug` on, the trigger fires on the first activity **60 s** after wrap-up instead of on the next day, so we can film it with a "Next morning" label.
- Badge: shows the wrapped state (Feature 4) until Start-here is shown.
- Dev tooling (my files only): add **Wrap up** and **Pretend it's tomorrow** buttons to `test/dev/inspect.html`. "Pretend it's tomorrow" rewrites `wrapUp.dayKey` to yesterday. Teach `test/dev/stub-content.js` to draw a plain `startHere` card and the `(you picked this)` label.
- Checks: wrap-up closes a break with no event; Start-here fires once on the next day and never twice; debug 60 s path; clicking the notification resumes; a new wrap-up replaces the old one.

## After all five

1. `npm test` (all green, with the new check count) and `node test/check-integration.mjs`.
2. **Real Chrome:** extend `test/dev/real-chrome-gate.mjs` with checks for:
   - Alt+R via the `resumeTask` message (DevTools can't press browser shortcuts);
   - badge state, read via `chrome.action.getBadgeText` from an extension page;
   - wrap-up → "pretend tomorrow" → activity → notification → click → resume.

   The context menu can't be clicked by the driver, so give me a 4-line manual check for it and for the real Alt+R key. Re-run the **whole** suite, not just the new checks, and update `test/REAL_CHROME_LOG.md`.
3. Invoke `superpowers:requesting-code-review` (and `codex-review:code` if installed) on tonight's diff. Fix anything real.
4. Update `src/sw/README.md` (messages, commands, event fields, badge states) and `test/GATE_CHECKLIST.md` (add an "Engine extras" line per feature; **not** new Gate steps, since the 11 steps don't change).
5. Update `NOTES_FOR_TEAM.md` with a clear **"New tonight"** section, split into Sidd / Abhinav, listing exactly what each may optionally adopt and what they can ignore.
6. Give me a ≤10-line summary for the 11:30 PM sync, plus a ready-to-paste 4-line message for the team chat. Then ask me before pushing.

## If you run short on time

Cut in this order, last first: Feature 2's `startHere` page message (the notification alone is enough) → Feature 3 → Feature 2 entirely. **Feature 5 must ship tonight**, because the schema freezes at the Gate, and Features 4 and 1 are small and high-value for the demo.
