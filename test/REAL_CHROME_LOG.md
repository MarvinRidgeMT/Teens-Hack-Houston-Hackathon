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
