# Engine (service worker) — notes for Sidd and Abhinav

Owner: Anish. Files: `manifest.json`, `src/shared/{constants,messages,store,sites}.js`, `src/sw/*`.

## What the engine needs from the content script (Sidd)
- Message shape is flat: `{ type, ...fields }`. Copy the type strings from `src/shared/messages.js`.
- **`snapshot` must always reply** `{ url, scrollY, highlight }` (sendResponse). The engine also uses it as a ping to check that the content script is in the tab before it opens the Alt+P overlay or counts a card as shown.
- `showCard`, `armTimer`, `restoreScroll`, `openOverlay`: no reply needed.
- Send `state` (debounced 2 s), `firstInteraction {eventId, at}`, `cardAction {eventId, action}`, `parkNote {nextStep, taskName?}`.

## Messages the popup can send (Abhinav), via `chrome.runtime.sendMessage`
| type | payload | reply |
|---|---|---|
| `getTabInfo` | `{ tabId }` | `{ ok, isWork, isDistraction, thread, suggested:[{tabId,url,title}], breadcrumb, openBreak }` |
| `startTask` | `{ tabId, name, taskType? }` | `{ ok, thread }` |
| `removeFromThread` | `{ threadId, tabId }` | `{ ok }` |
| `keepInThread` | `{ threadId, tabId }` | `{ ok }` |
| `setTaskType` | `{ threadId, taskType }` | `{ ok }` |
| `park` | `{ tabId }` | `{ ok }`: opens the overlay in the page, so call `window.close()` on the popup afterwards |
| `wrapUp` | `{ tabId, nextStep? }` | `{ ok, wrapUp }`: save this task for tomorrow (see below). `ok: false` on a page that can't hold a task |
| `resumeTask` | `{ threadId? }` | `{ ok, threadId }`: same as Alt+R. Without `threadId` the engine picks the open break's task, else the most recent breadcrumb, else the last work tab's task. `ok: false` when there is none (the badge flashes `?`) |

## Keyboard commands (manifest)
| command | suggested key | what it does |
|---|---|---|
| `park-task` | Alt+P | open the park overlay |
| `wrap-up` | none (bind it in `chrome://extensions/shortcuts`) | wrap up the active tab's task |
| `resume-task` | Alt+R (Option+R on a Mac) | jump back to the task (`resumeTask` above). If you're already on it with nothing open, it only restores the scroll. A return made this way is a normal event (coin flip, card or not) with `returnVia: 'resumeKey'` |

## Settings the engine reads (setup page writes them)
`participant, workSites[], distractionSites[], awayThresholdMs (120000), nudgeDelayMin (5), debug, forceCard`.
`forceCard` only works when `debug` is on. Debug sets a 10 s threshold and a 30 s nudge, and tags events `debug: true`.

## Additive fields (beyond the kickoff contract)
- Thread: `taskType, suggestedTabIds[], suggestedUrls[], excludedUrls[], auto?` (auto = quiet thread made for a work tab that isn't in a task; no tab group).
- openBreak: `departed, windowId, parkedAt?, nudged?`. A parked break starts counting when you leave the tab.
- Event: `cardShown`. It's false when the condition was pickup but the tab you came back to had no content script. Stats can ignore it.
- Event (Thu night, pending the 11:30 sync):

  | field | meaning |
  |---|---|
  | `awayMs` | exact `returnedAt - leftAt` in ms |
  | `distractionHost` | hostname (no `www.`) of the first distraction tab seen in the break; `null` if none (focus/idle breaks) |
  | `distractionHosts` | unique distraction hostnames seen in the break, in order; never paths or titles |
  | `returnVia` | `tab` (a normal tab/window activation), `resumeKey` (Alt+R or `resumeTask`), `notification` (clicked the nudge or Start-here notification), `idle` (back at the keyboard while Chrome showed the task). Pickup sets a short session marker (10 s) just before it activates the tab itself; the return reads and clears it |

## Wrap up → "Start here" (Feature 2)
- `wrapUp` saves a breadcrumb with `signal: 'wrap'` (keeps the next step unless a new one is given) and stores `wrapUp = { threadId, tabId, url, scrollY, highlight, nextStep?, nextStepSource?, at, dayKey, shown }` in `chrome.storage.local`. A new wrap-up replaces the old one.
- **Any open break is closed without an event** and its nudge is cancelled: wrapping up is not an interruption.
- `dayKey` is the local date of `now − 4 h`, so 1 AM still counts as the night before.
- On the first activity (tab activated or created, window focused, back from idle) on a later `dayKey`, **one** notification `starthere:<threadId>`: "Start here: <task>" / "Next: <step>" (or "Pick up where you stopped yesterday"). Then `shown: true`, never again.
- **Debug:** it fires on the first activity 60 s after the wrap-up instead (for filming).
- Clicking it runs `resume()` and sends the tab the **optional** message `startHere { threadName, nextStep?, nextStepSource?, wrappedAt }`. No event is created: no break was open.
- The badge shows `☾` until Start here is shown.

## Right-click "Make this my next step" (Feature 3)
- A context-menu item on **text selections, on work sites only** (match patterns built from `settings.workSites`: host and subdomains, plus the path when the entry has one). It follows settings changes; with no work sites it is hidden.
- Clicking it makes the selection (whitespace collapsed, max 200 chars) the task's next step. The thread comes from the tab (made if needed). An existing breadcrumb, including an open break's, keeps every other field; with none, one is made with `signal: 'note'` and **no break opens**.
- Breadcrumb field `nextStepSource`: `'selected'` (picked from the page) or `'typed'` (Alt+P, popup, wrap-up). Missing = typed. `showCard` carries it (additive).
- The badge flashes `✓`. In Google Docs Chrome usually gets no selection text: nothing is saved, the badge flashes `!` and the console says why.

## Toolbar badge (Feature 4)
Drawn by `src/sw/badge.js` from storage on every `openBreak` / `wrapUp` / `threads` write, on install and on startup.

| state | text | colour | tooltip |
|---|---|---|---|
| parked (`departed: false`) | `P` | teal `#0D9488` | "Pickup: <task> parked: leave when you're ready" |
| break open (`departed: true`) | `•` | amber `#D97706` | "Pickup: <task> is waiting" |
| wrapped up for the day | `☾` | indigo `#4F46E5` | "Pickup: <task> saved for tomorrow" |
| none | (empty) | | "Pickup" |

Confirmations flash for 2 s, then the real state returns: `✓` saved, `!` nothing saved, `?` no task to go back to.

## Engine behaviour worth knowing (Phase 1 hardening)
- **Frames:** `snapshot`, `showCard`, `restoreScroll` and `openOverlay` go to the top frame only (`frameId: 0`). `armTimer` goes to every frame, because Docs types into an iframe. Keep the `if (!TOP) return` guards anyway.
- **Resume of a closed tab:** the engine reopens it in its task group's window, puts it back in the group, replies at once, and sends `restoreScroll` when the page finishes loading (up to 8 s), after the content script answers a `snapshot` ping (3 tries, 500 ms apart). Other handlers are not held while it waits.
- **Focus:** a focus loss counts after 1 s. If the worker stopped before that check, the loss is counted on return. While Pickup's own popup is open, nothing counts. If the user leaves Chrome from the popup, it counts from when the popup closed.
- **Windows:** switching from a work tab to a window that shows YouTube is a `tab` break, confirmed after 1 s (dated at the switch), so passing through a YouTube window on the way to another tab is not. Tidy makes a "Later" group in each window that has break tabs. It never moves a tab between windows, and it leaves each window's active tab alone.
- **Chrome restart:** group ids change. Before any handler runs, threads are re-linked to the group with their title. A group whose title arrives later is linked when it does.
- **Decision 7:** `NEXT_STEP_CLEARS_ON_RETURN` in `constants.js` (default `false`).
- **Events:** one array, rewritten on every update. Fine for the pilot (~200). Split by day if it ever reaches thousands.

## Test without Chrome
`node test/engine.test.mjs` walks Gate steps 1–10 against a fake Chrome (`--verbose` shows the engine log).
In real Chrome, the log is under chrome://extensions → Pickup → "service worker". Every line starts with `[Pickup]`.
To check that nothing breaks when the worker stops, stop it mid-break from chrome://serviceworker-internals; all state is in storage.
