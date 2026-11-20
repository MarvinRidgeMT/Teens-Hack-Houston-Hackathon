# Voice Phase 0 spike: results

Branch `voice`. Thu Nov 19 2026, about 19:30 to 19:52.
Measured with Chrome for Testing 157.0.8103.78 (the same version as Anish's Chrome), macOS on Apple silicon, by `test/dev/voice-spike-probe.mjs` (throwaway profile, fake microphone, permission granted over DevTools).
Real-browser testing was then paused at Anish's request, so a few runs were not finished. They are marked below.

## Provisional verdict: PARTIAL (push-to-talk is built; the wake word is built but not verified)

What a script could check passed: the on-device API exists with `processLocally`, the side panel opens from a click, and there are local English voices.
Nothing mic-dependent was verified: no one has spoken to it yet, and on-device recognition never reached `available` in my runs (it stayed `downloading`).

## The five questions

| # | Question | Answer |
|---|---|---|
| 1 | `available()` / `install()` in a side panel | **Partly measured.** `SpeechRecognition` exists, with static `available` and `install` and a `processLocally` property. In both a tab and the side panel, `available({langs:['en-US'], processLocally:true})` returned `"downloading"` in under 10 ms in a fresh profile. My `install()` run was stopped before it finished (a clash with the main session's Chrome run), so **whether install completes is still a question for Anish**. Anish's own Chrome profile has no `SODA` folder yet, so he will need to install the model. |
| 2 | Mic permission in the side panel | **Measured: the panel can't ask.** In the panel, `permissions.query` returned `prompt`, and `getUserMedia({audio:true})` failed in 9 ms with `NotAllowedError: Permission dismissed`, without showing any prompt. So `src/voice/enable.html` exists (button → `getUserMedia` + `install()`, then the tab closes). After the mic was granted to the extension origin, the panel's `permissions.query` returned `granted`, which confirms the panel and the tab share the same origin. **Not confirmed:** whether `getUserMedia` then works in the panel. With the fake device it hung for more than 30 s, and I couldn't tell whether that was the fake device or a real problem. **Needs Anish.** |
| 3 | Picks up "hey pickup" from about 1 m: speed, `onend`, restarts | **Needs Anish, by hand.** I started a fake-mic run (a `say` recording of "Hey Pickup, ...") but stopped it before it reached recognition. |
| 4 | Keeps listening when Chrome isn't the frontmost app | **Needs Anish, by hand.** |
| 5 | A local English `chrome.tts` voice; does recognition hear Pickup | **Measured: yes, there is one.** `chrome.tts.getVoices()` listed 40 English voices with `remote: false` (the first en-US is "Samantha"; also Daniel en-GB, Karen en-AU, Moira, Rishi, Tessa). The voice list was empty right after page load and filled in within a few seconds. `chrome.tts.speak` at volume 0 went through to `end`. **Whether recognition hears Pickup's own voice needs Anish.** The panel pauses recognition while speaking anyway. |

Also measured: `chrome.sidePanel.open({windowId})` from an extension page is rejected without a user gesture ("may only be called in response to a user gesture") and resolves in 19 ms with one. Then `chrome.runtime.getContexts` lists `SIDE_PANEL .../src/voice/...`. The Alt+V command path was checked only against the fake Chrome in `test/voice.test.mjs`, not in real Chrome: the listener calls `sidePanel.open` first, with nothing awaited before it.

## What would change the verdict

- **GO** (keep the wake word): install reaches `available` on Anish's Chrome; after `enable.html` the panel can use the mic; "Hey Pickup" is caught at least 8 of 10 times from 1 m; restarts don't drop more than a word or two.
- **Stays PARTIAL** (push-to-talk only, hide the wake switch): recognition works, but it misses the wake word often, or it only listens while Chrome is in front.
- **NO-GO** (drop voice, revert the branch): `available()` never reaches `available` (install fails, or `unavailable`), or the panel can't use the mic even after `enable.html`.

## Manual script for Anish (his own Chrome, about 15 min)

1. Go to `chrome://extensions` and turn on Developer mode. Turn off the other Pickup copy if one is loaded. Click **Load unpacked** and pick `/Users/anishmeruva/pickup/.claude/worktrees/agent-af0fd96522c7e5090`.
2. Open the diagnostics page: `chrome-extension://<Pickup ID>/src/voice/spike.html` (the ID is on the extension's card).
3. **Q1:** click **available()** and note the result. Click **install()**. Wait until the log says `install() resolved` and `available(...) -> "available"`. You can also watch `chrome://components` → "Speech On-Device API".
4. **Q2a:** click **Open as side panel**. In the panel, click **Mic permission state**, then **Ask for mic here**. I expect `Permission dismissed`.
5. **Q2b:** in the tab, click **Open "Enable voice" tab** → **Enable voice** → **Allow**. Back in the panel, click **Mic permission state** (should be `granted`), then **Ask for mic here** (should be `getUserMedia OK`).
6. **Q3:** in the panel, click **Start listening**. From about 1 m away, say "Hey Pickup, where was I?" 10 times, a few seconds apart. Count the `WAKE` lines and note "ms after onspeechstart". Then stay quiet for 3 min and count the `rec.onend` and `restart #` lines.
7. **Q4:** while it's still listening, switch to another app (Cmd+Tab), or pick up your phone. Say "Hey Pickup" 5 times. Come back and look for `WAKE` lines with `hasFocus=false`. Try once more with the Chrome window minimised.
8. **Q5:** keep listening on. Untick **Pause listening while speaking** and click **Speak test sentence** (it says "Hey Pickup test..."). Does a `WAKE` line appear? Tick the box again and repeat: there should be none.
9. Click **Copy log** and paste the log back to me. I'll fill in this file and set the verdict.

## Then the feature itself (Phase 2 script)

1. Press Alt+V on any tab: the "Talk to Pickup" panel opens. If it says setup is needed, click **Set up voice** and finish the Enable tab.
2. On a work tab, start a task (popup) and highlight a sentence. Hold the mic button (or Space) and say "where was I?".
3. Say "park it, next step find a source for the drought statistic".
4. Go to YouTube for more than 2 min. Hold to talk and say "I'm back": the task tab comes back, and the event in storage has `returnVia: 'voice'`.
5. Say "how long was I away", then "wrap up". Wrap up is a stub until main's `wrapUp` is merged.
6. Optional: turn on **Listen for "Hey Pickup"** and repeat steps 2 to 5 without holding the button.
