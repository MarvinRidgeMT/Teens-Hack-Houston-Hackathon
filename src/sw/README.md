# Engine (service worker) — notes for Sidd and Abhinav

Owner: Anish. Files: `manifest.json`, `src/shared/{constants,messages,store,sites}.js`, `src/sw/*`.

## What the engine needs from the content script (Sidd)
- Message shape is flat: `{ type, ...fields }`. Copy the type strings from `src/shared/messages.js`.
- **`snapshot` must always reply** `{ url, scrollY, highlight }` (sendResponse). The engine also uses it as a ping to check that the content script is in the tab before it opens the park overlay (`park-task` key) or counts a card as shown.
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
| `resumeTask` | `{ threadId? }` | `{ ok, threadId }`: same as the `resume-task` key. Without `threadId` the engine picks the open break's task, else the most recent breadcrumb, else the last work tab's task. `ok: false` when there is none (the badge flashes `?`) |
| `voiceCommand` | `{ intent, args }` | `{ ok, say, data }`: sent by the voice side panel (`src/voice/panel.js`). `say` is the exact sentence to show and speak |
| `setVoiceSettings` | `{ voiceEnabled?, wakeWord?, readAloud? }` | `{ ok, voiceEnabled, wakeWord, readAloud }`; only these booleans are written. Send `{}` to read them |
| `startBreak` | `{ minutes (1–120), nextStep?, tabId? }` | `{ ok, endsAt, threadId }`: break timer. Parks the active work tab like the `park-task` key (or plans the break already open, or parks the most recent task's tab). `nextStep` is stored as typed |
| `cancelBreak` | `{}` | `{ ok }`: clears the timer; the break stays open (the drift nudge applies again if nothing was shown) |
| `listThreads` | `{}` | `[{ threadId, name, taskType, nextStep?, nextStepSource?, leftAt?, url, tabCount, isOpenBreak, isParked, isWrapped, awaySince?, endsAt?, sortAt }]`, newest first. Auto threads only with a breadcrumb, named "Untitled (from host)" |
| `setNextStep` | `{ threadId, nextStep }` | `{ ok }`: typed in the panel's task list (`nextStepSource: 'typed'`). Empty clears it |
| `getShortcuts` | `{}` | `{ ok, platform, park, resume, panel, wrapUp }`: the user's real keys from `chrome.commands.getAll()`, formatted by Chrome for the OS (Mac gets glyphs, other systems get `Alt+…` text) and following any rebinding in `chrome://extensions/shortcuts`. `platform` is `chrome.runtime.getPlatformInfo().os` (`mac`, `win`, `linux`, `cros`). A command with no key (another extension took it, or `wrap-up`, which has none) is `''`; pages show "Not set: chrome://extensions/shortcuts". If Chrome can't list commands, the platform table in `src/shared/shortcuts.js` answers. Pages use `shortcuts()` / `fillShortcuts()` from that file; the SW uses `src/sw/shortcuts.js` for notification and badge text, and drops the "takes you back" hint when the resume key is not set |
| `resumeTask` `via` | `{ threadId?, via: 'panel' }` | the Pickup panel's Resume; the event gets `returnVia: 'panel'`. Any other `via` is ignored (`resumeKey`) |

## Keyboard commands (manifest)
<!-- shortcuts-table:start (check-integration allows key names inside this table) -->
| command | suggested key | what it does |
|---|---|---|
| `park-task` | Alt+P; ⌃⇧P on a Mac (`MacCtrl+Shift+P`) | open the park overlay |
| `wrap-up` | none (bind it in `chrome://extensions/shortcuts`) | wrap up the active tab's task |
| `resume-task` | Alt+R; ⌃⇧R on a Mac (`MacCtrl+Shift+R`) | jump back to the task (`resumeTask` above). If you're already on it with nothing open, it only restores the scroll. A return made this way is a normal event (coin flip, card or not) with `returnVia: 'resumeKey'` |
| `toggle-voice` | Alt+V; ⌃⇧V on a Mac (`MacCtrl+Shift+V`) | open the Pickup panel (and start push-to-talk when voice is on) |
<!-- shortcuts-table:end -->

Each command sets `default`, `windows`, `linux`, `chromeos` and `mac` explicitly. Mac uses Control+Shift because Command+Shift+R (hard reload) and Command+Shift+V (paste and match style) are Chrome's, and Option+letter types characters on a Mac. A changed `suggested_key` only applies to a fresh install: existing installs keep their bindings until the user changes them or reinstalls. Labels everywhere come from `getShortcuts`; `test/check-integration.mjs` FAILs a hard-coded key name anywhere else.

## Settings the engine reads (setup page writes them)
`participant, workSites[], distractionSites[], awayThresholdMs (120000), nudgeDelayMin (5), debug, forceCard`.
Voice (default off): `voiceEnabled, wakeWord`. Until the setup page has toggles, the voice panel writes them with `setVoiceSettings`.
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
  | `plannedBreakMin` | minutes the user planned with the break timer (Pickup panel), else `null`. Separates planned breaks from interruptions |
  | `returnVia` | `tab` (a normal tab/window activation), `resumeKey` (the `resume-task` key or `resumeTask`), `notification` (clicked the nudge or Start-here notification), `idle` (back at the keyboard while Chrome showed the task), `voice` ("Hey Pickup, I'm back"), `panel` (Resume from the Pickup panel: task list or typed Ask), `timer` (clicked the "Break's over" notification). Pickup sets a short session marker (10 s) just before it activates the tab itself; the return reads and clears it |

## Wrap up → "Start here" (Feature 2)
- `wrapUp` saves a breadcrumb with `signal: 'wrap'` (keeps the next step unless a new one is given) and stores `wrapUp = { threadId, tabId, url, scrollY, highlight, nextStep?, nextStepSource?, at, dayKey, shown }` in `chrome.storage.local`. A new wrap-up replaces the old one.
- **Any open break is closed without an event** and its nudge is cancelled: wrapping up is not an interruption.
- **After a wrap-up, leaving for the night opens no nudge**, and a break still open when Start here becomes due (the night) is dropped unlogged. A break that opened and closed the same evening after a wrap-up is still logged.
- `dayKey` is the local date of `now − 4 h`, so 1 AM still counts as the night before.
- On the first activity (tab activated or created, window focused, back from idle) on a later `dayKey`, **one** notification `starthere:<threadId>`: "Start here: <task>" / "Next: <step>" (or "Pick up where you stopped yesterday"). Then `shown: true`, never again.
- **Debug:** it also fires on the first activity 60 s after the wrap-up (for filming). A changed `dayKey` ("Pretend it's tomorrow") always counts.
- Clicking it runs `resume()` and sends the tab the **optional** message `startHere { threadName, nextStep?, nextStepSource?, wrappedAt }`. No event is created: no break was open.
- The badge shows `☾` until Start here is shown.

## Right-click "Make this my next step" (Feature 3)
- A context-menu item on **text selections, on work sites only** (match patterns built from `settings.workSites`: host and subdomains, plus the path when the entry has one). It follows settings changes; with no work sites it is hidden.
- Clicking it makes the selection (whitespace collapsed, max 200 chars) the task's next step. The thread comes from the tab (made if needed). An existing breadcrumb, including an open break's, keeps every other field; with none, one is made with `signal: 'note'` and **no break opens**.
- Breadcrumb field `nextStepSource`: `'selected'` (picked from the page) or `'typed'` (park key, popup, wrap-up). Missing = typed. `showCard` carries it (additive).
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

## Voice ("Hey Pickup")
- Files: `src/voice/` (panel, intents, recognizer, enable tab, Phase 0 spike) and `src/sw/voice.js`.
- Intents (`src/voice/intents.js`, rule-based): `whereWasI, resume, park, setNextStep, wrapUp, tidy, awayTime, today, stop, unknown`.
- The engine builds every reply in `buildReply(intent, state)`: fixed templates, only recorded facts and the user's own words.
- `resume` goes through `resumeTask()` (same as the `resume-task` key), so return detection and the coin flip are unchanged; the event gets `returnVia: 'voice'`. Already on the task: "You're already on <task>.", no event.
- `wrapUp` calls the real `wrapUp()` on the task's tab (works from YouTube too). "Wrap up, next step …" saves the step with `nextStepSource: 'spoken'`.
- A dictated next step is stored like a typed one, with `nextStepSource: 'spoken'` on the breadcrumb.
- Speech recognition runs only with `processLocally = true` (on-device). `test/check-integration.mjs` FAILs any recogniser that skips it.
- The `toggle-voice` key opens the side panel (`chrome.sidePanel.open`, called first in the listener so the gesture counts) and starts push-to-talk via `chrome.storage.session.voiceShortcutAt`.

## Pickup panel (side panel, `toggle-voice` key)
Files: `src/voice/panel.html` (+ `panel.js` voice, `pickup.js` the rest, `panel.css`) and `src/sw/breaks.js`. Works with voice off.
- **Ask**: typed text uses the same `parse()` → `voiceCommand` → `buildReply()` path as speech, sent with `via: 'panel'`, so a typed "take me back" logs `returnVia: 'panel'` (spoken stays `'voice'`). Replies are spoken only if voice and "Read replies aloud" (`settings.readAloud`, default on) are on.
- **Break timer**: intents `breakTimer { minutes, nextStep? }` ("back in 10", "take a 15 minute break", "give me 5 minutes", number words, "half an hour" = 30, "an hour" = 60) and `cancelBreak` ("cancel the break", "I'm back early": a return, only while a timer runs). `startBreak` stores `plannedMin` and `endsAt` on `openBreak`, creates alarm `breakend:<eventId>` and a 30 s `breaktick` for the badge, and cancels the drift nudge. When the alarm fires and the break is still open: one notification `breakend:<eventId>` ("Break's over: <task>"); click → `returnVia: 'timer'` → `resume()`. Came back early: no notification. The return's event gets `plannedBreakMin`. Debug: a minute is 10 s.
- **Badge**: while a timer runs, the minutes left (`9m`) with "Pickup: back to <task> at 3:40 PM".
- **Task list**: `listThreads`; Resume → `resumeTask { threadId, via: 'panel' }`; Edit next step → `setNextStep`. Refreshes on `storage.onChanged`.
- **Today strip**: `todayFacts` (debug events left out) + most time away by `distractionHost`. Facts only.
