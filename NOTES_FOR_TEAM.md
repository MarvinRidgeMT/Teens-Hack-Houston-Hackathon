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

## Redesign + research features (Fri night, branch `redesign/engine-panel`)

Design system imported into `design/` (source and version in `design/SOURCE.md`). Every Pickup UI loads `src/shared/tokens.css` (Paper / Blue hour, follows `prefers-color-scheme`, bundled Inter) and `src/shared/pk.css` (Button, Chip, Badge, Card, Toast, Field). No font comes from the network; `check-integration` now FAILs any `fonts.googleapis.com` / `fonts.gstatic.com` reference.

**Engine changes (all additive; the event schema is unchanged):**
- `BADGE` uses the Paper state colours (parked `#4347b8`, away `#b45309`, wrapped `#6d28d9`, saved `#15803d`, neutral `#57534e`). Glyphs unchanged.
- Notification copy names the key and drops "is waiting": nudge "Your next step for <task>" / "Next: … · Alt+R takes you back"; break-over and Start here messages end in "· Alt+R takes you back". This reaches **both** conditions equally.
- `settings.features` flags, read with `featuresOf(settings)`: `readyNote`, `youWereHere`, `videoReplay`, `adaptiveCard`, `receipt` default on, `readableCard` off.
- `parkNote` takes optional `stoppedAt`, `stuckOn` (stored on the breadcrumb, 120 chars, only together with a next step). `showCard` and `startHere` pass them, plus `features`.
- `restoreScroll` is now `{ scrollY, highlight?, video? }`. `snapshot` / `state` replies may include `video: { currentTime, duration, src }`.
- `manifest.json`: `assets/fonts/InterVariable.woff2` is web-accessible (`use_dynamic_url`), so a Shadow DOM can load it with `chrome.runtime.getURL`.

### For Sidd (`src/content/`): change list. Not done, because you haven't signed off on me editing your folder

Copy two pure files as they are into your scripts. Both are tested in `test/features.test.mjs`.
- `src/shared/card-logic.js`: `cardVariant`, `compactLine`, `checklistItems`, `stoppedAtDefault`, `replayFrom`, `clockText`, `videoChipText`.
- `src/shared/find-text.js`: `locateHighlight`, `rawIndexToNode`, `canSearchText`.

1. **Theme (D1).**
   - Swap `TOKENS` in `card.js` for the token values in `src/shared/tokens.css`: Paper by default, and Blue hour under `@media (prefers-color-scheme: dark)` on `:host`.
   - Load Inter at **document level**, not inside the shadow root: Chrome ignores `@font-face` in shadow trees. Use `const f = new FontFace('Pickup Inter', `url(${chrome.runtime.getURL('assets/fonts/InterVariable.woff2')})`); document.fonts.add(f); f.load()`. The unique family name means a page's own "Inter" can't collide. Fall back to `system-ui`. Check in Chrome that the `getURL` URL loads (the manifest entry uses `use_dynamic_url`).
   - Put the tokens on an inner wrapper inside the shadow root, or prefix them `--pk-`. Names like `--border` set on `:host` lose to page rules that match the host element.
   - Restyle the three surfaces: return card → ReturnCard (`design/components/ReturnCard/`); overlay → ParkPrompt; parked pill → Toast with the drawn check.
   - Keep the same keys (Enter, T, Esc), the same messages, your `TOP` guards and `isOwnEvent` (card clicks never count as work interaction).
   - Motion: keep your vendored `src/vendor/motion.js` as the only copy. The design system's copy is v11.18.2 and a different build; check that `animate`, `stagger` and the spring options it uses exist in yours. Only animate opacity and transforms.
2. **F1, ParkPrompt plan.**
   - Add three fields: **Stopped at…**, prefilled with `stoppedAtDefault(document.title, <nearest h1–h3 above the viewport>)` and editable; **Next I'll…**, placeholder "When I'm back, I'll first ___"; **Stuck on…**, optional.
   - Fast path: typing and pressing Enter saves at once with the next step only. Tab reveals the other two fields. Esc cancels.
   - Send `{ type: 'parkNote', nextStep, stoppedAt, stuckOn, taskName? }`. The plan belongs to its next step: the engine drops it when a different next step is written later, and never sends it without one. Skip the extra fields when `features.readyNote` is false (read `settings.features` from storage when the overlay opens).
3. **F4, adaptive card.**
   - Choose the variant with `cardVariant(msg.awayMs, { adaptive: msg.features.adaptiveCard })`.
   - `compact` is one line, `compactLine(msg)`, with the same keys.
   - `full` is the ReturnCard with this order: Stopped at → Next (in `mist`, "you wrote this") → Stuck on, omitting empty lines. Below it, the `checklistItems(msg)` list as tickable checkboxes. Ticking sends nothing.
   - Start here (the `startHere` message) uses the Start here variant and also shows `stoppedAt` / `stuckOn`.
4. **F2, "You were here".**
   - On `restoreScroll` with `highlight` (and `canSearchText(location.href)`):
     - TreeWalker over the visible text nodes; join their text; record each node's start index.
     - Call `locateHighlight(joined, msg.highlight, { yAt, savedY: msg.scrollY })`, where `yAt` maps an index to its text node's `getBoundingClientRect().top + scrollY`.
     - Turn the result into a `Range` with `rawIndexToNode` (for the end, map `end - 1` and add 1 to the offset), scroll it to the centre, and mark it with `CSS.highlights.set('pickup-here', new Highlight(range))`.
     - Inject `::highlight(pickup-here) { background: rgba(67,71,184,.22); }` in the page (`<style>` with an id, removed on clear); don't wrap DOM nodes.
     - Show a one-time ring glow of about 2 s in a fixed shadow-DOM box over the range rect (a static outline under reduced motion).
     - Clear the mark on the next scroll or keypress.
   - `null`, or no `CSS.highlights`: restore `scrollY` exactly as today, silently. In Google Docs keep the scroll restore only.
5. **F3, video.**
   - On `snapshot` and `state`: if the top frame has a `<video>` with `currentTime > 5`, add `video: { currentTime, duration, src: location.href }`.
   - On `restoreScroll` with `video`: re-query the `<video>` at that moment (YouTube is a single-page app). Apply it only when there is exactly one candidate video, then set `currentTime = replayFrom(video.currentTime)`. The engine sends `video` only when the tab's URL is exactly the saved one, query included, and never on an Alt+R while you're already on the task.
   - Leave it paused (never call `play()`, never unmute).
   - Show a Chip near the player with `videoChipText(video.currentTime)` ("Replaying from 12:40 · you left at 12:50 · Space to play").
   - Panopto, Kaltura and Canvas iframes are roadmap (they need extra host permissions).
6. **F5, accessibility.**
   - Card and ParkPrompt: `role="dialog"` with `aria-labelledby` / `aria-describedby` (the card already has them). Focus Resume on open and keep focus inside the card (Tab wraps). Esc means Not now.
   - Announce the next step with `aria-live="polite"`.
   - **Readable card** (`features.readableCard`): set `data-readable` on the shadow host. `tokens.css` has the `:host([data-readable])` sizes: larger text, 1.5× line height, extra letter spacing, body copy in full ink.
7. **Pilot fairness.**
   - Don't touch the coin flip, `armTimer` / `firstInteraction` timing, or the "card clicks don't count" rule.
   - The moment the new card ships, add **"card v2 from <time>"** to `test/REAL_CHROME_LOG.md` and here. The compact variant can be worked out later from `awayMs` (< 300000), so no new event field is needed.

**For Abhinav:**
- F4 variant for stats: `awayMs < 300000` is compact (pickup condition only); no schema change.
- `stats.js`, popup, setup and dashboard are on `redesign/pages` for your review.

**Treatment change log:**
- The card itself is **unchanged tonight** (no "card v2" yet).
- Notification copy v2 and badge colours: merged into main **Fri 8:23 PM ET**, both conditions (see `test/REAL_CHROME_LOG.md`). Each pilot laptop's reload time goes there too.

## Pages (redesign/pages)

Built by Claude Code on `redesign/pages` from the design-system templates, for Abhinav to review before merge. Files: `src/pages/` (popup, setup, dashboard, plus `ui.js`, `format.js`, `setup-logic.js`, `csv.js`, `sample-data.js`, `receipt.js`), `src/shared/stats.js`, `test/pages.test.mjs` (`node test/pages.test.mjs`). Every page loads `../shared/tokens.css` then `../shared/pk.css`. No network, no inline scripts, events are only read.

**Stable element IDs** (Gate steps and the site rely on them):
- Popup: `#task-card`, `#task-name`, `#resume`, `#park`, `#wrapup`, `#task-type-current`, `#start-form`, `#start-name`, `#start-btn`, `#task-type`, `#suggested` (Keep / Remove per row), `#threads`, `#notice`, `#open-panel`, `#open-dashboard`, `#open-setup`.
- Setup: `#participant`, `#work-list`, `#work-add-input`, `#work-add`, `#distraction-list`, `#distraction-add-input`, `#distraction-add`, `#away-min`, `#nudge-min`, `#voice-enabled`, `#wake-word`, `#read-aloud`, `#feat-readyNote` … `#feat-receipt`, `#debug`, `#force-card`, `#save`, `#status`, `#youtube-note`.
- Dashboard: `#load-sample`, `#sample-banner`, `#show-mine`, `#export-csv`, `#receipt`, `#delete-all`, `#delete-confirm`, `#delete-yes`, `#delete-cancel`, `#summary`, `#buckets`, `#events`, `#events-body`, `#events-empty`, `#status`.

**What to know**
- Popup on open sends only `getTabInfo` and `listThreads`. Start task → `startTask { tabId, name, taskType }`; suggested tabs → `keepInThread` / `removeFromThread`; Resume → `resumeTask { threadId }`; Park → `park` (shows the engine's "cannot hold a task" reply); Wrap up → `wrapUp { tabId }`; "Open Pickup panel" calls `chrome.sidePanel.open` straight from the click.
- Setup "Save and start": `chrome.permissions.request` is the first call in the click handler (https and http origins for each work site and its subdomains), then settings are merged (unknown keys kept), voice goes through `setVoiceSettings`, the content script is registered as id `pickup-content` (`allFrames`, `matchOriginAsFallback`, Sidd's file order from `origin/sid/content`'s dev setup; a later save updates it in place), and open work tabs get `executeScript` unless `window.__pickupContentLoaded` is already set there. If registering fails, setup says the settings were saved but Pickup could not attach. Removing a work site does not take back its site access.
- `settings.features = { readyNote, youWereHere, videoReplay, adaptiveCard, readableCard, receipt }`, booleans, `readableCard` off by default, the rest on. A missing flag means its default (`featuresOf()` in `src/pages/setup-logic.js`). The dashboard hides the receipt button when `receipt` is false; the other flags are for the engine and content lanes to read.
- Stats: debug events are left out of every number (`counted()` in `stats.js`) and marked "Testing (left out)" in the table. Quartiles use linear interpolation (Excel QUARTILE.INC). "With the card" = `condition: 'pickup'` (as assigned, including `cardShown: false`). The receipt's n is comebacks with a measured first interaction; under 10 in either condition it says "Not enough comebacks yet for a comparison." "This week" starts Monday 00:00 local.
- Sample data is never written to storage: it shows in memory under the "Sample data" banner, and both conditions share the same made-up times, so it never looks like a result. The receipt is disabled while sample data shows.
- Delete all (after a confirm step) removes every `chrome.storage.local` key except `settings` (settings are never cleared, even for a moment) and clears `chrome.storage.session`. The registered content script and granted site access stay. An engine handler writing inside `store.serial` at that moment could still write a key back; an engine `deleteAll` message run inside `serial` would close that gap.

**For Anish (engine), no change made here**
1. Events have no `nextStepSource` field, so the dashboard and CSV column `nextStepSource` shows "–" (it reads the field if it ever exists). If the team wants it, the engine could copy the breadcrumb's `nextStepSource` onto the event at return (additive; the schema is frozen, so it needs the team's OK).
2. A work entry such as `youtube.com/watch` still counts as a distraction while `youtube.com` is on the distraction list (`isWorkTab`: distraction wins). Setup now says so after Save. For F3 lecture-video resume, either let a work entry with a path win over a host-only distraction entry, or keep telling people to remove `youtube.com` from distractions.
3. After Delete all, a pending `nudge:` or `breakend:` alarm can still fire with no `openBreak`. Worth one check that it does nothing.

**For Sidd**: nothing to change. Setup registers your six files in your dev-setup order. Before testing, click "Unregister stub" on the dev setup page (setup cannot name the dev stub id: check-integration FAILs any `src/` file that does).

**check-integration on this branch**: 7 FAILs, all expected until `sid/content` is merged: `[content] no .js files in src/content`, and `[pages] registered script … does not exist` for `src/vendor/motion.js`, `src/vendor/anime.umd.min.js`, `src/content/card.js`, `overlay.js`, `docs.js`, `content.js`.

## Site restyle (redesign/site)

`site/` now uses the design system: Paper (light) and Blue hour (dark) follow the visitor's system setting, Inter is self-hosted in `site/assets/fonts/` (OFL), the brand tile is `pk-mark`, and the footer is the Driftbar meadow (SVG hills, frosted "Pickup" wordmark, fog). Fireflies and fog only move when reduced motion is off. The CSS is copied into `site/styles.css`, so `site/` still works on its own with no third-party requests. Same content, anchors and placeholders as before.
- **Screenshots** are still the old teal look. `<!-- SHOTS: replace with redesign screenshots -->` marks the four places to swap (social preview image in `<head>`, hero, How it works, demo poster). Keep `site/` under 1.5 MB (it's about 1.3 MB now).
- **Favicons** (`site/assets/icon*.png`) are still the old teal icon. Swap them when a real logo exists.
