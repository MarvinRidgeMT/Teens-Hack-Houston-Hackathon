# Prompt for Claude Code: "Hey Pickup" voice

> When to run: **after** tonight's five features are committed (`CLAUDE_CODE_PROMPT_FEATURES.md`). Or start it now in a **separate git worktree** so it can't collide with that session (the prompt below sets this up). Voice is the **first thing cut** if anything threatens the Gate (Fri 2:00 PM ET). In `~/pickup`, run `claude` and paste everything below the line.

---

You're working with me, Anish (Person A, "Engine"), on **Pickup**, an MV3 Chrome extension (Triple H 2026 hackathon) that saves a student's place when they get interrupted and hands it back when they return. The core loop and engine are done and tested (`npm test`, `test/REAL_CHROME_LOG.md`). Now add **voice**: say **"Hey Pickup, where was I?"** and Pickup answers out loud, and you can ask it to take you back, park, or wrap up.

## Before you start

1. Invoke and follow these skills:
   - `superpowers:using-superpowers`
   - `superpowers:using-git-worktrees`: do this work in a new worktree on branch `voice` (for example `../pickup-voice`). Another Claude Code session may be editing `main` tonight. Merge into `main` only when I say so.
   - `modern-web-guidance:chrome-extensions`: read its references for side panels, permissions, service worker and message passing. Mandatory rule 2 (a side panel needs an explicit open trigger) and rule 15 (real icon files) apply.
   - `modern-web-guidance:modern-web-guidance`: search it for Web Speech API / `SpeechRecognition` / `processLocally` / `speechSynthesis` before writing recognition code.
   - `superpowers:test-driven-development` for the intent parser and the engine message handlers.
   - `superpowers:systematic-debugging` when real Chrome misbehaves.
   - `superpowers:verification-before-completion` before telling me anything works.
2. Read `src/sw/README.md`, `NOTES_FOR_TEAM.md`, `handoff/Pickup_Engine_Handoff.pdf`, and the engine code. Use existing engine functions (`resume`, `park`, `wrapUp`, `tidy`, breadcrumbs, events). **Don't duplicate logic.**
3. Run `npm test`. It must be green before you start.

## Non-negotiable rules for voice

- **Audio never leaves the device.** Use `SpeechRecognition` **only** with `processLocally = true`. Check `SpeechRecognition.available({ langs: ['en-US'], processLocally: true })` first. If it isn't `'available'`, offer `SpeechRecognition.install({ langs: ['en-US'], processLocally: true })` from a **button click** (it needs a user gesture). If on-device recognition can't be made available, **voice stays off** with a clear message: "On-device speech isn't available in this Chrome, so voice is off. Pickup never sends your voice to a server." **Never** fall back to server recognition (the default `processLocally = false` sends audio to Google). Add a check in `test/check-integration.mjs` that FAILs if any `SpeechRecognition` is started without `processLocally = true`.
- **Listening is visible and opt-in.** The mic only runs while the Pickup side panel is open **and** the user turned on "Listen for 'Hey Pickup'". The panel shows a clear "Listening" state, and the user can stop with one click or "Hey Pickup, stop listening". Default: off. Push-to-talk (hold the button, or the shortcut) always works without the wake word.
- **Nothing written by AI.** Pickup speaks **fixed templates** filled only with recorded facts (task name, time away, highlight, counts) and the user's own words (their next step). Intent matching is **rule-based** (keywords and regex), not a model.
- **Keep no audio and no transcripts**, except a spoken next step the user explicitly dictates. That is stored like a typed one, with `nextStepSource: 'spoken'`.
- **Keep the experiment clean.** A voice "take me back" goes through the normal `resume()` path, so return detection and the coin flip still happen. Mark it with `returnVia: 'voice'` (the field from tonight's Feature 5; if it doesn't exist yet, add it the same way). Voice never creates or edits events directly.
- **Ownership:** create a new folder **`src/voice/`** (mine). Edit only my lane: `manifest.json`, `src/shared/`, `src/sw/`, `src/voice/`, `test/`, `NOTES_FOR_TEAM.md`. Don't touch `src/content/` (Sidd) or `src/pages/` (Abhinav).
- Plain JS, no build step, no npm runtime dependencies, no network requests. CSP-safe: no inline scripts or handlers.

## Phase 0: go/no-go spike (time-box 30 min; report before building anything else)

Build the smallest possible test in `src/voice/` and answer these in real Chrome on my Mac (macOS, Apple silicon):

1. In a **side panel** page: does `SpeechRecognition.available({langs:['en-US'], processLocally:true})` return, and does `install()` complete (watch `chrome://components` → "Speech On-Device API" / SODA)?
2. Does the side panel get **microphone permission**? If the panel can't show the prompt, add a one-time `src/voice/enable.html` tab page ("Enable voice" button → `getUserMedia({audio:true})` + `install()`, then close the tab), and confirm the panel can use the mic afterwards (same extension origin).
3. With `continuous = true`, `interimResults = true` and `processLocally = true`: does recognition pick up "hey pickup" reliably from about 1 m away, how fast, and does it stop on its own (`onend`)? How often must it be restarted?
4. Does it keep listening while Chrome isn't the frontmost app (for example, me on my phone)? Record the honest answer either way.
5. `chrome.tts.getVoices()`: is there a local (`remote: false`) English voice? Speak a test sentence. Does recognition hear Pickup's own voice? If so, pause recognition while speaking.

Write the results in `test/VOICE_SPIKE.md` as **GO / PARTIAL / NO-GO**, then stop and show me. If it's NO-GO, we drop voice and you revert the branch.
- **PARTIAL** (for example, only works with Chrome in front): build push-to-talk only, no wake word.

## Phase 1: build (only after I say go) · time-box about 3 h

**Manifest:**
- add permissions `sidePanel` and `tts`;
- `"side_panel": { "default_path": "src/voice/panel.html" }`;
- command `"toggle-voice"` with suggested key `Alt+V` ("Talk to Pickup"). There's a popup, so `action.onClicked` won't fire. The command handler calls `chrome.sidePanel.open({ windowId })`, which counts as a user gesture. Keep the total of commands with suggested keys at 4 or fewer.

**`src/voice/panel.html` + `panel.js` + `panel.css`:**
- Big mic button (press-and-hold = push-to-talk; click = toggle listening) and a "Listen for 'Hey Pickup'" switch.
- Live caption of what it heard, and Pickup's reply as text too, since replies must also be readable (accessibility and video captions).
- Status line: "Listening (on this device)" / "Off" / "On-device speech not available".
- Keyboard: Space = push-to-talk while the panel has focus, Esc = stop; visible focus ring; `aria-live="polite"` on the reply; no colour-only states.
- Wake-word loop: continuous on-device recognition. On a final or interim result containing "hey pickup" (also accept "hey pick up" and "pick up"), take the rest of that utterance as the command. If it's empty, play a short chime and listen for about 6 s more. Restart on `onend` with backoff. Pause while Pickup is speaking.

**`src/voice/intents.js`** (pure function, unit-tested in `test/voice.test.mjs`): `parse(text) → { intent, args }`

| Say | intent | Spoken reply (template; brackets are recorded data) |
|---|---|---|
| "where was I", "what was I doing", "what's next" | `whereWasI` | "You were on [task]. Your next step: [next step]. Last thing you highlighted: [highlight]." Omit any part with no data. With no task: "I don't have a task saved yet." |
| "take me back", "I'm back", "resume", "let's go" | `resume` | "Taking you back to [task]." Then `resume()` with `returnVia: 'voice'`. |
| "park this", "park it, next step [words]", "I'm taking a break" | `park` | "Parked [task]. Next step saved." `[words]` is stored as the next step, `nextStepSource: 'spoken'`. |
| "my next step is [words]", "next step [words]" | `setNextStep` | "Got it. Next step: [words]." Read it back so the user hears exactly what was saved. |
| "wrap up", "I'm done for today" | `wrapUp` | "Saved [task] for tomorrow." |
| "tidy up", "tidy" | `tidy` | "Moved [n] distraction tabs into Later." Only after a return; otherwise "Nothing to tidy." |
| "how long was I away" | `awayTime` | "You were away [n] minutes." (Last event, or the open break so far.) |
| "how am I doing", "today" | `today` | "Today: [n] breaks. Median [s] seconds back to work." Debug events excluded. Facts only; no praise or judgement. |
| "stop listening", "never mind" | `stop` | "Okay." |
| anything else | `unknown` | "I can tell you where you were, take you back, park, or wrap up." |

**Engine (`src/sw/`):**
- New message `voiceCommand { intent, args }` → `{ ok, say, data }`. The **engine builds the sentence** from storage, so all wording rules live in one tested place: `src/sw/voice.js` with `buildReply(intent, state)`.
- Speaking: the panel speaks with `chrome.tts.speak(say, { voiceName: <first local en voice>, rate: 1.05 })`. Fall back to `speechSynthesis` in the panel if `chrome.tts` has no local voice. Never use a remote voice.
- Add `voiceCommand` to `MSG` / `TO_ENGINE` and document it in `src/sw/README.md`.

**Settings (engine reads, defaults off):** `voiceEnabled: false`, `wakeWord: false`. Until Abhinav adds them to the setup page, the panel stores them itself through an engine message, `setVoiceSettings`.

## Phase 2: test and document

1. `npm test` (intent parser and `buildReply` checks, including "no data" cases and debug exclusion) and `node test/check-integration.mjs` (the processLocally check).
2. Real Chrome: the spike page plus a manual script for me:
   - enable voice;
   - "Hey Pickup, where was I?";
   - "park it, next step find a source for the drought statistic";
   - go to YouTube;
   - "Hey Pickup, I'm back" (returns to the task, event logged with `returnVia: 'voice'`);
   - "how long was I away";
   - "wrap up".
   Log the results in `test/REAL_CHROME_LOG.md`, with honest limits (accuracy, background listening).
3. `superpowers:requesting-code-review` on the branch diff. Fix anything real.
4. `NOTES_FOR_TEAM.md`, "Voice (new)":
   - **Abhinav:** add a "Talk to Pickup" button to the popup (`chrome.sidePanel.open`) and the two voice toggles to the setup page. Handle `returnVia: 'voice'` and `nextStepSource: 'spoken'` in stats and CSV. Video idea: a 15 s voice moment in the demo.
   - **Sidd:** label `nextStepSource: 'spoken'` as "Your next step (you said this)".
5. Give me a ≤8-line summary and a 3-line team-chat message, then ask before merging `voice` into `main` or pushing.

## If time runs short

Cut in this order: the wake word (keep push-to-talk) → the `today` and `tidy` intents → the whole feature. Voice must never delay the Gate or the 10 PM build lock. If it isn't solid by **Fri 7:00 PM**, leave it unmerged and mention it as roadmap in Devpost.
