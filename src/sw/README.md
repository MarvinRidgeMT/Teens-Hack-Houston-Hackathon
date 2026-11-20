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
| `wrapUp` | `{ tabId }` | not built yet (stretch) |
| `voiceCommand` | `{ intent, args }` | `{ ok, say, data }`: sent by the voice side panel (`src/voice/panel.js`). `say` is the exact sentence to show and speak |
| `setVoiceSettings` | `{ voiceEnabled?, wakeWord? }` | `{ ok, voiceEnabled, wakeWord }`; only these two booleans are written. Send `{}` to read them |

## Settings the engine reads (setup page writes them)
`participant, workSites[], distractionSites[], awayThresholdMs (120000), nudgeDelayMin (5), debug, forceCard`.
Voice (default off): `voiceEnabled, wakeWord`. Until the setup page has toggles, the voice panel writes them with `setVoiceSettings`.
`forceCard` only works when `debug` is on. Debug sets a 10 s threshold and a 30 s nudge, and tags events `debug: true`.

## Additive fields (beyond the kickoff contract)
- Thread: `taskType, suggestedTabIds[], suggestedUrls[], excludedUrls[], auto?` (auto = quiet thread made for a work tab that isn't in a task; no tab group).
- openBreak: `departed, windowId, parkedAt?, nudged?`. A parked break starts counting when you leave the tab.
- Event: `cardShown`. It's false when the condition was pickup but the tab you came back to had no content script. Stats can ignore it.

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
- `resume` goes through `events.resume()`, so return detection and the coin flip are unchanged; the event gets `returnVia: 'voice'`.
- A dictated next step is stored like a typed one, with `nextStepSource: 'spoken'` on the breadcrumb.
- Speech recognition runs only with `processLocally = true` (on-device). `test/check-integration.mjs` FAILs any recogniser that skips it.
- Alt+V (`toggle-voice`) opens the side panel (`chrome.sidePanel.open`, called first in the listener so the gesture counts) and starts push-to-talk via `chrome.storage.session.voiceShortcutAt`.
