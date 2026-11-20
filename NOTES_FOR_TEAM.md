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

## New tonight (Thu Nov 19, evening): all optional

Everything below is **additive**. Code that ignores it keeps working. **The new event fields only ship if all three of us agree at the 11:30 PM sync** (the plan says schema changes need all three); if we say no, I remove them before the Gate.

### For Sidd

**Must do: nothing.** Your current content script keeps working. **Worth 10 min:** the "(you picked this)" label. **Ignore if busy:** `startHere`.

- **`showCard` has a new optional field `nextStepSource`** (Feature 3): `'typed'` or `'selected'`. When it's `'selected'`, label the line **"Your next step (you picked this)"** instead of "(you wrote this)". Missing means typed. The card must stay honest about where the line came from.

- **Optional new message `startHere { threadName, nextStep?, nextStepSource?, wrappedAt }`** (Feature 2, stretch). Sent to the tab after the user clicks the morning "Start here" notification. If you have time: a card variant "Start here: <task> · Next: … · stopped yesterday at <time>" with one Resume button (Resume can just close it; the engine already resumed). Ignore it and nothing breaks; `check-integration` only WARNs.

### For Abhinav

**Must do: nothing.** **Worth doing:** the four CSV columns (if we keep the fields), and "Back to task" / "Wrap up for today" popup buttons. **Ignore if busy:** the badge (automatic), `nextStepSource`.

- **Four new event fields** (Feature 5). New columns for the CSV export. CSV import must accept older rows without them (treat missing as empty).
  - `awayMs`: exact milliseconds away (`returnedAt - leftAt`).
  - `distractionHost`: the first distraction site seen in the break, e.g. `youtube.com` (no `www.`). `null` for focus and idle breaks that never touched one.
  - `distractionHosts`: every distraction host seen in the break, in order, once each. Hostnames only, never paths or titles.
  - `returnVia`: how the user came back: `tab` (normal), `resumeKey` (Alt+R), `notification` (clicked the nudge or Start here), `idle` (back at the keyboard) or `voice` ("Hey Pickup, I'm back"). Pickup did the navigating for `resumeKey` and `notification`, so stats can keep those returns apart.
- **`resumeTask { threadId? }` → `{ ok, threadId }`** (Feature 1). Same as the new **Alt+R** key: jumps back to the task (focus window, tab, group, scroll). Without `threadId` the engine picks the task. A popup "Back to task" button can send it and then `window.close()`. `ok: false` means there's no task yet.
- **Badge** (Feature 4): the toolbar icon now shows `P` (parked), `•` (task waiting), `☾` (saved for tomorrow) with a tooltip. Nothing to do; just don't set the badge from the popup.
- **`wrapUp { tabId, nextStep? }` now works** → `{ ok, wrapUp }` (Feature 2). A popup "Wrap up for today" button with an optional next-step box. It closes any open break without logging it (not an interruption), and the next morning the user gets one "Start here" notification. There's also a `wrap-up` command with no default key.
- With **debug** on, Start here fires 60 s after wrap-up, for filming the demo ("Next morning" title card).
- If you show a breadcrumb's next step, `nextStepSource: 'selected'` means picked from the page (right-click), `'typed'` or missing means typed.

## Voice (new tonight, merged into main; optional)

"Hey Pickup, where was I?" in a side panel. Audio is recognised on the device only (`processLocally = true`); Pickup keeps no audio and no transcripts. Default off. Details: `src/sw/README.md` → Voice, results: `test/VOICE_SPIKE.md`.

**Abhinav (popup, setup, stats)**
1. Popup: add a "Talk to Pickup" button that calls `chrome.sidePanel.open({ windowId })` straight from the click (no `await` before it). Alt+V does the same.
2. Setup page: two toggles, `voiceEnabled` and `wakeWord` (default off). Write them with `{ type: 'setVoiceSettings', voiceEnabled, wakeWord }`; the reply has the stored values.
3. First-time voice setup is `src/voice/enable.html` (mic prompt + on-device model download). Link to it from the setup page. A side panel can't show the mic prompt itself.
4. Stats and CSV: events can have `returnVia: 'voice'`; breadcrumbs can have `nextStepSource: 'spoken'`. Show both as columns.
5. Video idea: a 15 s voice moment ("Hey Pickup, I'm back" → the essay comes back).

**Sidd (content script)**
1. Card: `nextStepSource` can also be `'spoken'`. Label it "Your next step (you said this)". So: `typed`/missing → "(you wrote this)", `selected` → "(you picked this)", `spoken` → "(you said this)". Must do: nothing.

## Panel schema (Fri morning, before the Gate): 1 new event field, 2 new `returnVia` values

For the Pickup panel (break timer, task list). Additive: older code that ignores them keeps working.

**Abhinav (stats, CSV):**
- **New column `plannedBreakMin`**: minutes the user planned with the break timer, or empty for an unplanned break. CSV import must accept older rows without it (treat missing as empty). Stats can keep planned breaks apart from interruptions.
- **Two new `returnVia` values:** `panel` (Resume from the Pickup panel) and `timer` (clicked "Break's over"). Like `resumeKey`, Pickup did the navigating for both.

**Sidd:** nothing to do.

## Pickup panel (new, Fri, on main): all optional

Alt+V now opens the **Pickup panel** (it was the voice panel): type or talk to ask ("where was I?"), a **break timer** ("back in 10"), **your tasks** with Resume and Edit next step, and a **Today** line. Voice still works the same and stays off by default.

**Abhinav:**
- **Worth doing:** a popup button **"Open Pickup panel"** that calls `chrome.sidePanel.open({ windowId })` directly in the click handler (no `await` before it).
- **Stats/CSV:** `plannedBreakMin` and the `returnVia` values `panel` / `timer` (see "Panel schema" above). A break with `plannedBreakMin` set was planned, not an interruption.
- **Settings:** `readAloud` (default true) joins `voiceEnabled` and `wakeWord`; the panel writes it with `setVoiceSettings`.

**Sidd:**
- **Must do: nothing.** Optional: when the card's event was a planned break, it could say "Planned break: 10 min". That needs `plannedBreakMin` in `showCard`; tell me and I'll add it (it's a recorded fact).

## Download site (new, Fri, on main)

One static page in `site/` for judges (preview: `python3 -m http.server -d site 8080`). Real screenshots from the extension (`node test/dev/site-shots.mjs`).
- **The Download button needs two things by Saturday:** a **v1.0 GitHub release with the zip** (it links to `/releases/latest`), and the **repo public** (a private repo's releases and Pages are invisible to judges).
- **Abhinav:** fill the `PILOT RESULTS` block Saturday 10 AM (real numbers only), the `VIDEO` id and the `DEVPOST` link. The page says "open the dashboard and click Load sample data": that button must exist.
- **Sidd:** drop the 30-second install GIF at `site/assets/install.gif` and swap it in for `install-poster.jpg` (comment in `index.html`).

## Pages (redesign/pages)

Built by Claude Code on `redesign/pages` from the design-system templates, for Abhinav to review before merge. Files: `src/pages/` (popup, setup, dashboard, plus `ui.js`, `format.js`, `setup-logic.js`, `csv.js`, `sample-data.js`, `receipt.js`), `src/shared/stats.js`, `test/pages.test.mjs` (`node test/pages.test.mjs`). Every page loads `../shared/tokens.css` then `../shared/pk.css`. No network, no inline scripts, events are only read.

**Stable element IDs** (Gate steps and the site rely on them):
- Popup: `#task-card`, `#task-name`, `#resume`, `#park`, `#wrapup`, `#task-type-current`, `#start-form`, `#start-name`, `#start-btn`, `#task-type`, `#suggested` (Keep / Remove per row), `#threads`, `#notice`, `#open-panel`, `#open-dashboard`, `#open-setup`.
- Setup: `#participant`, `#work-list`, `#work-add-input`, `#work-add`, `#distraction-list`, `#distraction-add-input`, `#distraction-add`, `#away-min`, `#nudge-min`, `#voice-enabled`, `#wake-word`, `#read-aloud`, `#feat-readyNote` … `#feat-receipt`, `#debug`, `#force-card`, `#save`, `#status`, `#youtube-note`.
- Dashboard: `#load-sample`, `#sample-banner`, `#show-mine`, `#export-csv`, `#receipt`, `#delete-all`, `#delete-confirm`, `#delete-yes`, `#delete-cancel`, `#summary`, `#buckets`, `#events`, `#events-body`, `#events-empty`, `#status`.

**What to know**
- Popup on open sends only `getTabInfo` and `listThreads`. Start task → `startTask { tabId, name, taskType }`; suggested tabs → `keepInThread` / `removeFromThread`; Resume → `resumeTask { threadId }`; Park → `park` (shows the engine's "cannot hold a task" reply); Wrap up → `wrapUp { tabId }`; "Open Pickup panel" calls `chrome.sidePanel.open` straight from the click.
- Setup "Save and start": `chrome.permissions.request` is the first call in the click handler (https origins for each work site and its subdomains), then settings are merged (unknown keys kept), voice goes through `setVoiceSettings`, the content script is registered as id `pickup-content` (`allFrames`, `matchOriginAsFallback`, Sidd's file order from `origin/sid/content`'s dev setup), and open work tabs get `executeScript`.
- `settings.features = { readyNote, youWereHere, videoReplay, adaptiveCard, readableCard, receipt }`, booleans, `readableCard` off by default, the rest on. A missing flag means its default (`featuresOf()` in `src/pages/setup-logic.js`). The dashboard hides the receipt button when `receipt` is false; the other flags are for the engine and content lanes to read.
- Stats: debug events are left out of every number (`counted()` in `stats.js`) and marked "Testing (left out)" in the table. Quartiles use linear interpolation (Excel QUARTILE.INC). "With the card" = `condition: 'pickup'` (as assigned, including `cardShown: false`). The receipt's n is comebacks with a measured first interaction; under 10 in either condition it says "Not enough comebacks yet for a comparison." "This week" starts Monday 00:00 local.
- Sample data is never written to storage: it shows in memory under the "Sample data" banner, and both conditions share the same made-up times, so it never looks like a result. The receipt is disabled while sample data shows.
- Delete all (after a confirm step) clears `chrome.storage.local` and `chrome.storage.session` and writes `settings` back. The registered content script and granted site access stay.

**For Anish (engine), no change made here**
1. Events have no `nextStepSource` field, so the dashboard and CSV column `nextStepSource` is empty. If the team wants it, the engine could copy the breadcrumb's `nextStepSource` onto the event at return (additive; the schema is frozen, so it needs the team's OK).
2. A work entry such as `youtube.com/watch` still counts as a distraction while `youtube.com` is on the distraction list (`isWorkTab`: distraction wins). Setup now says so after Save. For F3 lecture-video resume, either let a work entry with a path win over a host-only distraction entry, or keep telling people to remove `youtube.com` from distractions.
3. After Delete all, a pending `nudge:` or `breakend:` alarm can still fire with no `openBreak`. Worth one check that it does nothing.

**For Sidd**: nothing to change. Setup registers your six files in your dev-setup order. Before testing, click "Unregister stub" on the dev setup page (setup cannot name the dev stub id: check-integration FAILs any `src/` file that does).

**check-integration on this branch**: 7 FAILs, all expected until `sid/content` is merged: `[content] no .js files in src/content`, and `[pages] registered script … does not exist` for `src/vendor/motion.js`, `src/vendor/anime.umd.min.js`, `src/content/card.js`, `overlay.js`, `docs.js`, `content.js`.
