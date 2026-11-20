# Notes for the team (from Anish, Engine)

Engine hardening on Thu Nov 19. **No message names or event fields changed.** A few behaviours did, and the list below is what your code should expect. Engine checks: `npm test`.

## For Sidd (content script)

1. **Only the top frame gets most messages.** The engine now sends `snapshot`, `showCard`, `restoreScroll` and `openOverlay` with `frameId: 0`. Only `armTimer` goes to every frame (Docs types into an iframe). Keep your `if (!TOP) return` guards anyway.
   The handoff PDF (p.3) still says "every frame gets it and the first reply wins". That is now true only for `armTimer`.
2. **Send `state` from the top frame only.** `state` from a child frame (`sender.frameId > 0`) is ignored.
3. **`restoreScroll` can arrive after a page load.** If the user closed the tab and clicks Resume, the engine reopens it and sends `restoreScroll` once the page finishes loading. Your listener must be up by then (`document_idle` is fine).
4. **No overlay on pages that can't hold a task.** Alt+P on a new-tab page or a distraction site (YouTube) does nothing. If a `parkNote` comes from such a page, it is answered `{ ok: false }`.
5. Card keys (Enter, T, Esc) and clicks on the card must not count as first interaction. The dev stub in `test/dev/stub-content.js` shows one way to do this (`stopImmediatePropagation` on the card key handler).

## For Abhinav (setup, popup, stats)

1. **`park` can now reply `{ ok: false, error: 'this page cannot hold a task' }`** on a new-tab page or YouTube. Show that in the popup instead of closing it silently.
2. **`getTabInfo.isWork` is `false` on distraction sites**, even when Chrome put a YouTube tab inside the task group (links opened from the Doc join the group).
3. **The service worker no longer replies to message types it doesn't handle.** The popup messages are unchanged. If you use `chrome.runtime.sendMessage` between your own pages, the engine won't answer first anymore.
4. **The dev stub.** `test/dev/dev-setup.html` registers a dev stub content script with id `pickup-dev-stub`. Don't reuse that id. On a laptop that ran the dev setup, click "Unregister stub" before testing Sidd's real script, or both scripts will answer.
5. Stats: the event schema is unchanged. Two more cases can no longer produce false events: a Chrome restart with a break open, and Pickup's own popup taking focus.

## Open questions for the team (engine defaults chosen; one line each)

- **Decision 7:** the next step stays until the next Alt+P. Changing it is one constant, `NEXT_STEP_CLEARS_ON_RETURN` in `src/shared/constants.js`.
- **Tidy skips each window's visible tab** (collapsing it would change what that window shows). Default: keep it that way.
- **Parking task B while a break for task A is open** replaces A's break, so A's break is not logged. Default: keep it that way (rare). Say so if stats needs it counted.

## Voice (new, branch `voice`, not merged yet)

"Hey Pickup, where was I?" in a side panel. Audio is recognised on the device only (`processLocally = true`); Pickup keeps no audio and no transcripts. Default off. Details: `src/sw/README.md` → Voice, results: `test/VOICE_SPIKE.md`.

**Abhinav (popup, setup, stats)**
1. Popup: add a "Talk to Pickup" button that calls `chrome.sidePanel.open({ windowId })` straight from the click (no `await` before it). Alt+V does the same.
2. Setup page: two toggles, `voiceEnabled` and `wakeWord` (default off). Write them with `{ type: 'setVoiceSettings', voiceEnabled, wakeWord }`; the reply has the stored values.
3. First-time voice setup is `src/voice/enable.html` (mic prompt + on-device model download). Link to it from the setup page. A side panel can't show the mic prompt itself.
4. Stats and CSV: events can have `returnVia: 'voice'`; breadcrumbs can have `nextStepSource: 'spoken'`. Show both as columns.
5. Video idea: a 15 s voice moment ("Hey Pickup, I'm back" → the essay comes back).

**Sidd (content script)**
1. Card: `showCard` can now carry `nextStepSource: 'spoken'`. When it does, label the next step "Your next step (you said this)". Otherwise nothing changes.
