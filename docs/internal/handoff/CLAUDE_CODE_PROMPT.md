# Prompt for Claude Code: Pickup Engine lane (Anish, Person A)

> How to use: `cd ~/pickup`, run `claude`, and paste everything below the line. The handoff PDF is at `handoff/Pickup_Engine_Handoff.pdf`.

---

You're working with me, Anish (Person A, "Engine"), on **Pickup**, a Manifest V3 Chrome extension for the Triple H 2026 hackathon (theme: "a more efficient way to live"). Pickup saves a student's place when they get interrupted and hands it back when they return: leave → drift → return card → Resume → measured re-entry. We are a 3-person team with a hard clock:

- **Gate:** Fri Nov 20, 2:00 PM ET. The core loop works end to end on all three laptops, and the schema freezes.
- **Build lock:** Fri 10:00 PM ET. Only bug fixes after this.
- **Submit:** Sat Nov 21, 3:00 PM ET (hard deadline 6:00 PM ET).

## Before you do anything

1. Invoke these skills and follow them:
   - `superpowers:using-superpowers`
   - `modern-web-guidance:chrome-extensions`: the MV3 rules. Check every change against its Output Checklist.
   - `superpowers:test-driven-development` for every engine change: write or extend a failing check in `test/engine.test.mjs`, then fix.
   - `superpowers:systematic-debugging` whenever something behaves differently in real Chrome than in the fake.
   - `superpowers:verification-before-completion` before you tell me anything is done.
2. Read, in this order: `src/sw/README.md`, `manifest.json`, `src/shared/*.js`, `src/sw/*.js`, `test/*.mjs`, and `handoff/Pickup_Engine_Handoff.pdf` (the contract I gave Sidd and Abhinav).
3. Run `npm test`. It should print `16 checks passed`. If it doesn't, stop and tell me.
4. Make a task list for the phases below and keep it updated.

## Ownership (hard rule)

| Person | Owns | Your access |
|---|---|---|
| **Anish (A), Engine** (me) | `manifest.json`, `src/shared/` (except `stats.js`), `src/sw/`, `test/` | Read and write |
| Sidd (B), Surface | `src/content/` (content script, return card in Shadow DOM, Alt+P overlay, Docs handling) | Read only |
| Abhinav (C), Setup/Evidence/Story | `src/pages/` (setup, dashboard, popup, sample data), `src/shared/stats.js`, `docs/`, README | Read only |

**Never edit** Sidd's or Abhinav's files. If their code breaks the contract, write the exact problem and a suggested fix in `NOTES_FOR_TEAM.md` for me to forward.

## Architecture you're inheriting (don't redesign it)

- Plain JavaScript, **no build step, no framework, no runtime npm dependencies**. Judges load the folder unpacked. `package.json` exists only for `npm test`.
- The service worker is an ES module (`"type": "module"`). All listeners are registered synchronously at the top level of `background.js`. Every handler runs through `store.serial()` so storage writes never race. **Nothing important lives in a global**, because the MV3 worker can be stopped after about 30 s idle.
- Storage (`chrome.storage.local`) keys: `settings`, `threads`, `breadcrumbs`, `openBreak`, `events`. Engine-internal state is in `chrome.storage.session`.
- Signals: `tab` (work tab → distraction site), `focus` (Chrome lost focus for more than 1 s), `idle` (3 min, or locked), `park` (Alt+P). A break under the threshold (2 min; 10 s in debug) is discarded. Over it, the engine creates an event and assigns it by `Math.random() < 0.5` to `pickup` (card shown) or `control`. `armTimer` goes out on every return, `showCard` only for pickup.
- Messages are flat `{ type, ...fields }`. Names are in `src/shared/messages.js`. The content script must always reply to `snapshot`, and the engine uses that reply as a ping.
- Seven contract decisions are listed in Section 1 of the handoff PDF. Treat them as **provisional** until I tell you the kickoff result.

## Phase 1: Harden the engine (start now; tell me when it's done)

Review every file in my lane against the chrome-extensions checklist, then investigate these known risks. For each one: reproduce it in the fake (extend `test/fake-chrome.mjs` if needed), fix it, and add a check.

1. **allFrames double replies.** With `allFrames: true`, every Docs frame receives `snapshot`. Make sure the engine tolerates a reply from a child frame, for example a `url` that differs from the tab's URL or a `scrollY` of 0. Consider sending `snapshot` with `{ frameId: 0 }` via `chrome.tabs.sendMessage(tabId, msg, { frameId: 0 })`. That is the right fix if it holds up, so test it in the fake.
2. **`resume()` waits up to 8 s inside the serial queue.** When it has to recreate a closed tab, every other handler waits too. Move the wait out of the queue or shorten it, without breaking the order of events.
3. **The 1 s focus-blip `setTimeout`.** This is fine because the worker is alive while handling the event. Confirm the break still opens correctly if the worker restarts between the blur and the check. If it can't, fall back to treating it as a focus break on the next event.
4. **Clicking the extension popup on macOS** may fire `windows.onFocusChanged(WINDOW_ID_NONE)`. Make sure opening the popup never produces a `focus` event. Under-threshold breaks are already dropped, so check longer cases too.
5. **Group ids change after a Chrome restart.** `relinkGroups()` matches groups by title. Add a check for it.
6. **Next-step carry-over** (decision 7). If the team decides a next step should clear after one return, put that behind one constant.
7. **A thread tab in another window.** Check that Resume and Tidy work across windows (`chrome.tabs.group` with `createProperties.windowId`).
8. **Event growth.** `events` is an array that is rewritten on every update. That's fine for about 200 events, but leave a note.

Then invoke `superpowers:requesting-code-review` (and `codex-review:code` if it's installed) on the diff. Fix anything real.

## Phase 2: Real-Chrome smoke test without Sidd and Abhinav

My lane must be testable in real Chrome before their pieces land.

1. Create **dev-only** files under `test/dev/` (never in `src/content/` or `src/pages/`):
   - `test/dev/dev-setup.html` + `dev-setup.js`. This is an extension page at `chrome-extension://<id>/test/dev/dev-setup.html`. It writes test `settings` (`docs.google.com`, `wikipedia.org` as work sites, `youtube.com` as a distraction, `participant: 'anish-dev'`, debug on, force card toggle). It requests host permissions **inside the click handler with no await before it**, and registers `test/dev/stub-content.js` with `chrome.scripting.registerContentScripts` (`allFrames: true`, `matchOriginAsFallback: true`). Then it injects into already-open matching tabs with `chrome.scripting.executeScript`. No inline scripts or handlers (CSP).
   - `test/dev/stub-content.js`. A classic script that follows the contract exactly. It replies to `snapshot` (top frame only), answers `armTimer` with a one-shot `firstInteraction`, and draws a plain unstyled `<div>` "card" for `showCard` with Resume / Tidy / Not now buttons that send `cardAction`. On `openOverlay` it uses `prompt()` for the next step and sends `parkNote`. It also handles `restoreScroll` and sends debounced `state`. It is just enough to drive the engine and is clearly labelled `DEV STUB, NOT SIDD'S CODE`.
   - `test/dev/inspect.html` + `inspect.js`. A tiny live viewer of `chrome.storage.local` (openBreak, the last 10 events with seconds to first interaction, breadcrumbs) with a "clear all" button.
2. Give me exact manual steps: load unpacked on a **fresh Chrome profile**, open the dev setup, then run Gate steps 1–10 from the handoff PDF with debug on (10 s threshold).
3. If the Claude in Chrome tools (`mcp__claude-in-chrome__*`) are connected, after I load the extension: drive the tab switches yourself (open the Doc, open the Wikipedia links, switch to YouTube, wait past the threshold, switch back), and read results from `inspect.html`. You can't load unpacked extensions or open `chrome://` pages, so ask me for those steps. If the browser tools aren't connected, give me a checklist and I'll report back.
4. Do the service-worker kill test: open a break, stop the worker from `chrome://serviceworker-internals`, then return. The event must still be logged.
5. Record the results in `test/REAL_CHROME_LOG.md`: date, Chrome version, OS, pass or fail per step, and the fixes you made.

## Phase 3: Apply the kickoff decisions (when I paste them)

When I give you the team's answers on the 7 decisions:

- Update `src/shared/messages.js`, `constants.js`, the engine, the checks, `src/sw/README.md`, and the handoff PDF source if needed. Regenerate the PDF only if I ask.
- List anything Sidd or Abhinav must change, in `NOTES_FOR_TEAM.md`.

## Phase 4: Integration (Thu 11:30 PM sync → Fri 2 PM Gate)

As Sidd's `src/content/` and Abhinav's `src/pages/` land in the repo:

- Read their code against the contract. Write mismatches in `NOTES_FOR_TEAM.md` with file:line and the exact fix. Don't edit their files.
- Check that the manifest paths point to their real files (`src/pages/popup.html`, `src/pages/setup.html`). The current manifest already references both.
- Help me run the **11-step Gate test**: once with debug on, once with the real 2-minute threshold, on a fresh profile.
- After the Gate: **no schema changes**. Debug and force card are off for the pilot. Only bug fixes in my lane.

## Phase 5: Friday afternoon (only if the Gate passed)

- **Drift nudge polish:** one notification per break, only when a next step exists. Clicking it runs Resume. Already built; verify it in real Chrome.
- **Tomorrow start (stretch, first in the cut order):** only if the nudge is solid by 7 PM. `wrapUp {tabId}` saves a breadcrumb under a `wrapUp` key. The first new tab of the next calendar day gets a "Start here" message to Sidd's script. Agree the message with Sidd first. If anything is behind, **skip it**.
- Cut order if a sync runs more than 2 h behind: Tomorrow start → scripted trials → drift nudge → Tidy → automatic thread suggestions.

## Phase 6: Release (Sat morning)

- Invoke `engineering:deploy-checklist` if it's available.
- Build the release zip **without** `test/`, `.git/`, `node_modules/`, `package.json` or any notes files. Load that zip's contents unpacked on a fresh profile and smoke test it.
- Draft a ~150-word "How it works" section for Devpost: architecture, privacy, and the "possible signals, never causes" rule. No implementation jargon a judge wouldn't follow.
- Prepare (but don't run without my OK) `git tag v1.0` and `gh release create v1.0 pickup-v1.0.zip`.

## Git rules

- No repo exists yet. **Ask me before** running `git init`, `gh repo create`, pushing, or tagging. When I approve: one `main` branch; small commits per fix with clear messages; pull before every push.
- Never commit secrets, `.env`, or a Chrome profile directory.

## Always / Never (product rules, non-negotiable)

- **Always:** data stays in `chrome.storage.local`; every card line is a recorded fact or the user's own words; at most one nudge per break; keyboard access for every action; every pilot event counted, including bad ones.
- **Never:** a server, accounts, analytics or **any network request**; AI-written next steps; closing, moving or hiding a tab without a user click (Tidy only regroups, after a click); site blocking; storing page text beyond a 200-character highlight; claiming Pickup "increases productivity".

## How to report to me

- Keep updates short: what you changed, which checks you added, and the `npm test` result.
- Before saying any phase is done, show the evidence: test output, or the real-Chrome log for that step.
- If you need a decision from me or the team, ask one question at a time and suggest a default.
- If something would cost more than 1 hour, or threatens the Gate, tell me immediately and suggest what to cut, following the cut order.

Start with Phase 1 now.
