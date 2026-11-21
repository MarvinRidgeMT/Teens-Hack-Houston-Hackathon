# Real-Chrome log: engine lane (Anish)

Engine only, driven by the **dev stub** (`test/dev/stub-content.js`), not Sidd's content script.
Debug on: 10 s threshold, 30 s nudge. Force card on.

## Automated run, 2026-11-19 (Thu evening)

| | |
|---|---|
| Browser | Chrome for Testing **157.0.8103.78**, fresh profile. Branded Google Chrome (157.0.8103.79 here) can't load an unpacked extension from the command line, so the run uses Chrome for Testing |
| OS | macOS (Darwin 25.5.0), Apple silicon |
| Driver | `node test/dev/real-chrome-gate.mjs` (DevTools protocol, no npm deps). `ONLY=Xa` runs just one check plus setup |
| Raw evidence | `results.json` in the driver's scratch dir: per-step notes, `[Pickup]` worker log, a window-focus timeline that names the frontmost app at every focus loss, and a storage dump |
| Engine `npm test` | 39 checks passed (final run, run 7) |
| Final result | **17 pass, 0 fail, 1 not run (Docs: needs a Google login)**. Roblox was quit before runs 6 and 7 so no other app took focus |

**Test build, not the shipped folder.** The driver copies the extension and changes two things in the copy only:
1. `host_permissions` lists the work sites up front, because a script can't click the site-access prompt. The `permissions.request` path in dev setup still runs; it returns at once.
2. Placeholder `src/pages/popup.html` and `setup.html`, because Abhinav's pages don't exist yet.

**Workarounds (not real user actions):**
- Tab switches use `chrome.tabs.update` from an extension page. That fires the same `tabs.onActivated` as a click.
- Alt+P uses the popup's `park` message, which takes the same `requestPark` path. DevTools can't press browser shortcuts.
- Text selection is a DOM `Range` in the page. It fires the real `selectionchange`.
- The worker is stopped with the DevTools `ServiceWorker.stopAllWorkers`, the same thing as Stop in `chrome://serviceworker-internals`.
- The popup is opened with `chrome.action.openPopup()` and closed with `Target.closeTarget`.
- Focus loss is real: `osascript` activates Finder.

**Real user input:**
- Cmd-clicks on links, mouse-wheel scrolls, and the Enter and T keys are trusted input events.
- The stub's `prompt()` is answered through the DevTools dialog API.
- Chrome restart is a real quit followed by `--restore-last-session`.

### Results (run 7, final full run on the current engine)

| # | Check | Result | Notes |
|---|---|---|---|
| S2 | Dev setup Apply (real click): settings, register + inject stub | **PASS** | Settings saved (`anish-dev`, debug, force card). Stub registered with `allFrames` + `matchOriginAsFallback`. No matching tabs were open yet, so "Injected into 0 tabs": the `executeScript` path wasn't exercised |
| 1 | Start task makes a named tab group | **PASS** | Group "Drought Essay" (cyan) on `en.wikipedia.org/wiki/Drought`, the essay stand-in |
| 2 | Cmd-clicked links join the group as suggestions; a removed one leaves | **PASS** | Chrome put both new tabs in the group. Engine logged "suggested tab" ×2; `removeFromThread` ungrouped one and added it to `excludedUrls` |
| 3 | Scroll + highlight reach the engine (`state`, debounced) | **PASS** | `tabState`: scrollY 1200, highlight saved |
| 4 | Park with a next step: overlay prompt, break waits for you to leave | **PASS** | Prompt answered. Break `departed:false`; breadcrumb has the next step, scrollY 1200 and the highlight |
| 5 | Switch to YouTube: break starts; one nudge ~30 s later | **PASS** | Nudge alarm set; notification shown once ("nudge shown Drought Essay"); `nudged:true` |
| 6 | Return: event + card with task, next step, highlight | **PASS** | `park` event, pickup, 32 s, bucket 2-5. Card drawn with the task and next step. Notification cleared |
| 7 | Scroll away, press Enter (Resume) | **PASS** | Scrolled 0 → 1197 (saved 1200); group expanded; card closed |
| 8 | First work interaction recorded | **PASS** | 0.3 s after return (the step 7 wheel scroll) |
| 9 | Leave 12 s, return, press T | **PASS** | `tab` event, 2-5. YouTube tab still open, in a grey collapsed "Later" group |
| 10 | Chrome loses focus to Finder 15 s | **PASS** | `focus` event, 15.1 s away |
| Xa | Pickup popup open 15 s: no break, no event | **PASS** | No window focus change while open; popup seen by `getContexts` from page and worker (1/1) at 1, 5, 10 and 15 s; no break; Chrome for Testing frontmost throughout. Runs 4–5 were inconclusive because Roblox took focus |
| Xb | Worker stopped mid-break, then return | **PASS** | Worker restarted on the return; the event was logged |
| Xc | Focus lost and worker stopped before the 1 s check | **PASS** | The 1 s timer was lost with the worker. Engine logged "focus loss recovered after a worker restart" and a `focus` event (15.5 s) on return |
| Xe | Switch from the work tab to a window showing YouTube, stay 3 s | **PASS** | No break during the 1 s confirm; then a `tab` break dated 41 ms after the switch; the return logged a `tab` event |
| Xf | Pass through the YouTube window onto a neutral tab within 0.3 s | **PASS** | No break, no event |
| Xd | Chrome restart with a break open | **PASS** | Group id changed (437408862 → 984187892) and the thread re-linked by title. Break tab id changed (2021072037 → 2021072131) and was re-pointed by URL. The return after the restart logged the event |
| Docs | Steps 6–8 on a Google Doc (frames) | **NOT RUN** | Needs a Google login in the test profile. Do it by hand with the checklist below |

### Popup evidence (Xa, run 5, `ONLY=Xa`)

- **The popup blurs the window on macOS.** About 0.1 s after `openPopup()`, Chrome fired `windows.onFocusChanged(WINDOW_ID_NONE)` while Chrome for Testing itself was the frontmost app. This is the Risk 4 case, and it does happen.
- **Under 1 s later, RobloxPlayer took OS focus** (on both attempts).
- **Probes at 1, 5, 10 and 15 s:**
  - the popup target existed;
  - `chrome.runtime.getContexts({contextTypes:['POPUP']})` returned **1 from the control page and 1 from the service worker**;
  - no break was open;
  - `focusLostAt` moved forward on every poll.

  So the engine saw the popup and held off the whole time.
- **The placeholder popup stays open** even when another app takes focus (15 s of probes).
- **After the driver closed the popup** with Chrome still in the background (Roblox frontmost), the next poll opened a `focus` break. Its `leftAt` was the last poll that saw the popup (21:05:37.325; break at 21:05:38.333). This is the designed "left Chrome from the popup" path, not a break while the popup was open.
- **Verified in runs 6 and 7** (Roblox quit): popup open 15 s with Chrome frontmost, no focus change, no break, no event.

### Driver problems found and fixed during the runs (not engine bugs)
- Wikipedia links are absolute (`https://en.wikipedia.org/wiki/…`), so the selector was changed.
- A regex inside a template literal lost its escapes, so the check is now a plain string check.
- One edit dropped the "switch to YouTube" action in step 9; it's restored.
- After a restart the driver used a stale tab id. Restart steps no longer retry, and they find tabs by URL.
- Run 6: a fast restart brought the driver back 9.8 s after leaving, under the 10 s debug threshold, so the engine (correctly) discarded the break. The restart check now stays away past the threshold.
- Added Xe and Xf (window switches) for review item 4.
- Other apps taking focus (RobloxPlayer, once Claude) made focus-dependent steps flaky. Each step now starts with Chrome in front and no open break, records the frontmost app at every focus loss, and retries. A step is marked inconclusive only when another app took focus.

## Runs 8–12, 2026-11-19/20 (night): tonight's features, then the voice merge

| Run | Build | Result | What happened |
|---|---|---|---|
| 8 | Features 1–5 | 6 pass, 17 fail | Invalid: the voice agent's Chrome for Testing was open too, and activating "Chrome for Testing" by bundle id focused that one. Driver now focuses its own browser by pid |
| 9 | Features 1–5 | **22 pass, 1 fail**, 1 not run (Docs) | Every Gate step and every older extra passed, plus N1 (Alt+R, `returnVia: resumeKey`, `chrome://extensions/shortcuts` shows ⌥P / ⌥R), N3 (menu item exists), N4 (badge P → • → empty), N5 (event fields), N2d (debug Start here at 60 s). **N2 failed: a real engine bug.** In debug mode "Pretend it's tomorrow" did nothing, because debug ignored `dayKey`. Fixed in `checkStartHere` with a failing check first |
| 10 | review fixes | stopped | Stopped at Anish's request |
| 11, 12 | **voice merged** (785c4cd) | 12 and 13 pass; every focus-needing step from 10 on failed | Steps 1–9, N3 and N5 passed. After the Finder step, Chrome came back on its own (10 s into a 15 s pause), then the driver could never get a focused Chrome window again, though Chrome for Testing was the frontmost app. The Mac had user input 1 s before I checked, so I think someone was using it during the run. **Inconclusive, not counted.** Run on its own, Xa passed. Needs one clean full run with hands off the Mac |
| **13** | **voice merged + review fixes** (7f701d7) | **23 pass, 0 fail**, 1 not run (Docs) | Clean run with nobody using the Mac. All 11 Gate steps, Xa–Xf, N1–N5, N2d and the restart check Xd pass. **N2 now passes on the fixed engine:** one Start-here notification, the click resumes the task (scroll 641), the start-here card is drawn, no event, badge empty afterwards. `chrome://extensions/shortcuts`: park ⌥P, resume ⌥R, voice ⌥V, wrap-up unbound, with no clashes |

Driver fixes tonight (not engine bugs): focus by pid (run 8); the frontmost-app probe had an AppleScript syntax error and always said `?` (fixed after run 11); on a focus failure the driver now logs every window's type/state/focused and saves a screenshot in its scratch dir.

**Still to verify in real Chrome:** the voice panel with a real microphone (`test/VOICE_SPIKE.md`, 9 manual steps), the manual rows below (Docs, right-click, the real ⌥R key), and Sidd's and Abhinav's code once it lands.

## Pickup panel, 2026-11-20 (Fri, branch `feature/panel`)

`node test/dev/panel-check.mjs`: Chrome for Testing 157.0.8103.78, fresh profile, debug on (a "10 min" break = 100 s). The panel opens in its own small, unfocused popup window at 360x800, so it doesn't count as leaving the task. Screenshots are in `docs-shots/panel-*.png`.

**Final run (run 6, after the review fixes): 6 pass, 0 fail.**

| # | Check | Result | Notes |
|---|---|---|---|
| P0 | Setup; opening the panel window opens no break | **PASS** | |
| P1 | Typed "where was I" | **PASS** | "You were on Drought Essay." (falls back to the last work tab's task, like Alt+R). Task list shows it |
| P2 | Typed "back in 10, next step …" | **PASS** | Parks the essay with `plannedMin` 10; `breakend:` alarm and no nudge alarm; clock 1:39 and counting down; badge `2m` "Pickup: back to Drought Essay at 12:14 PM" |
| P3 | Leave for YouTube; break ends; click the notification | **PASS** | One notification (`breakend:<id>`), click via `notifications.onClicked.dispatch` in the worker. Event `returnVia: timer`, `plannedBreakMin: 10`, away 97 s |
| P4 | Leave; Resume from the task list | **PASS** | Chip "Away 1 min"; event `returnVia: panel` |
| P5 | Edit next step in the list; Today strip | **PASS** | Saved as typed ("you wrote this"). Today strip: "No breaks logged today.", correct because debug events are left out |

Earlier runs: run 1 never started (the test copy skipped itself, because the `.claude` path filter matched the worktree's own path); runs 2 and 3 found the wrong extension (Chrome for Testing has two built-in extensions with their own workers); run 5 lost P3 and P4 because a second test Chrome, the site screenshots, was running at the same time and took focus. All were driver problems. **Engine bugs found:** none in real Chrome; the code review found the notification-order bugs, fixed with checks first.

## Engine bugs found in real Chrome

None so far. Every focus loss the engine acted on traces to a real `WINDOW_ID_NONE` in the timeline. With another app frontmost, the engine opened a `focus` break after 1 s and discarded short absences (< 10 s), which is correct.

---

## Manual checklist (real Google Chrome, for the Docs rows)

Load unpacked on a fresh profile, open `chrome-extension://<id>/test/dev/dev-setup.html`, click Apply and allow access.
Then open `inspect.html` in its own window, plus the service worker console.

| # | Do | Expected (engine log / inspector) | Result | Notes |
|---|---|---|---|---|
| 1 | Open a Google Doc. On the dev setup page click Refresh list, pick the Doc, click Start task | Doc is in a tab group "Climate Essay" | | |
| 6–8 on the Doc | Park with a note, switch to YouTube 15 s, come back, press Enter, type in the Doc | Breadcrumb URL is the Doc URL (not `about:blank`), card drawn once, typing in the Doc records first interaction | | |
| Popup | Click the Pickup toolbar icon, leave the popup open 20 s, close it by clicking the page | No open break, no new event | | |
| Alt+R key | `chrome://extensions/shortcuts`: Pickup "Jump back to your task" shows ⌥R. On YouTube during a break, press ⌥R | Back on the task tab; event `returnVia: resumeKey` in the inspector | | |
| Right-click | On Wikipedia select a sentence → right-click → "Make this my next step" | Badge flashes ✓; inspector breadcrumb next step = the sentence, source `selected` | | |
| Right-click, not work | On YouTube select text → right-click | No "Make this my next step" item | | |
| Right-click, Docs | In the Google Doc select text → right-click | If the item shows and nothing saves, the badge flashes `!` (Docs hides selection text) | | |
| Load | Load unpacked on the **repo folder** (no test-build changes): note any error about the missing `src/pages/popup.html` / `setup.html` | | | |

## Panel run 7 (Fri 2:16 PM, redesign/engine-panel, Chrome for Testing 157.0.8103.78)

Restyled panel on the design system, screenshots in both themes (`docs-shots/panel-*.png` and `panel-*-dark.png`).
- **P0 FAIL, environmental:** `chrome.idle` reported idle when the panel window opened (signal `idle`): no one had touched the Mac for over 3 minutes. The panel window itself opened no break; P0 passed in run 6.
- **P1 to P5 pass:** typed Ask; "back in 10" timer 1:40 (debug); one "Break's over" with `returnVia: timer`, `plannedBreakMin: 10`; Resume from the list gives `returnVia: panel`; next step edit is saved as typed.
- **Found and fixed:** task rows replayed their rise-in animation on every refresh, so a screenshot caught them half-faded. Only new rows animate now.

## Run 14 + pages shots (Fri afternoon, local test merge: redesign/engine-panel + origin/sid/content + redesign/pages + redesign/site)

Local branch `redesign/integration-test` (never pushed), Chrome for Testing 157.0.8103.78.
- **First Gate run: 15 pass, 8 fail.** Sidd's dev setup now pre-ticks "Use Sid's real content scripts", so the harness's stub prompt never answered Park (step 4), and steps 5–9, N4 and the N2 card text followed from that. Not an engine fault: the harness now unticks it, because it drives the stub.
- **Run 14: 23 pass, 0 fail** (1 inconclusive, as before). Steps 6–8 pass: return, card with task, next step and highlight, Resume restores scroll, first interaction recorded.
- **`test/dev/pages-shots.mjs`:** popup (360 wide) and setup/dashboard (1280×800 @2x) in both themes, plus the receipt PNG. These use made-up events in a throwaway profile; they are not results. No request left `chrome-extension://` on any page.
- **Found and fixed:** `.pk-card { display: flex }` beat the `hidden` attribute, so the popup's "Add your work sites first" card stayed visible. `pk.css` now makes `[hidden]` always win.
- `check-integration` on the merged tree: no FAIL, no WARN.

## Treatment change: notification copy v2 + Paper badge colours (Fri Nov 20, 8:23 PM ET)

`redesign/engine-panel`, `redesign/pages` and `redesign/site` merged into local `main` at **8:23 PM ET**. For **both** conditions, the nudge, break-over and Start here notifications now read "Your next step for <task>" / "Next: … · Alt+R takes you back", and the badge uses the Paper colours. A pilot laptop gets this when it pulls and reloads the extension; note each laptop's reload time here. The return card is unchanged: **no "card v2" yet**.
