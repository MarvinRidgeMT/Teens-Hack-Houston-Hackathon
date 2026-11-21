# Pickup v1.0.0

Pickup is a Chrome extension that saves your place when you leave your work and hands it back when you return.

## What's in it

- **Park before you go.** One key saves your place and, if you like, one line: your next step. Esc skips it; your place is saved either way.
- **The return card.** Come back to the task and a small card shows the task, how long you were away, your next step and the sentence you highlighted. Enter resumes at the same tab and scroll position.
- **Resume from anywhere.** One key takes you back to your task from any tab.
- **Task tab groups.** Each task is a named Chrome tab group; links you open from it are suggested for the group.
- **Tidy, never close.** T on the card folds break tabs into a collapsed "Later" group. Nothing is closed.
- **Drift nudge.** At most one quiet notification per break, and only if you wrote a next step.
- **Your next step, three ways.** Type it when you park, right-click a sentence and choose "Make this my next step", or say it in the panel with voice on.
- **Wrap up, then Start here.** Save your place at night and get one "Start here" reminder the next morning.
- **The Pickup panel.** Ask "where was I?", set a break timer ("back in 10"), see your tasks. Optional push-to-talk voice, recognised on your device.
- **Lecture video.** On resume, a top-level video jumps back 10 seconds and waits, paused.
- **Dashboard.** Your comebacks, the pilot event log, CSV export, Load sample data, and Delete all.

## Install

1. Download `pickup-v1.0.0.zip` below and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped `pickup-v1.0.0` folder (the one that contains `manifest.json`).

The setup page opens: add your work sites and distraction sites, then **Save and start**. Chrome 123 or newer, on Windows, Mac, Linux or ChromeOS (also Edge). Not on phones: mobile browsers don't support extensions.

## Shortcuts

<!-- shortcuts-table:start (check-integration allows key names inside this table) -->
| What it does | Mac | Windows, Linux, ChromeOS | Without the keyboard |
|---|---|---|---|
| Park before you go | ⌃⇧P | Alt+P | Park in the toolbar popup |
| Back to your task from any tab | ⌃⇧R | Alt+R | Resume in the popup |
| Open the Pickup panel | ⌃⇧V | Alt+V | Open Pickup panel in the popup |
| Wrap up for today | not set | not set | Wrap up in the popup |
| Resume, on the return card | Enter | Enter | Click Resume |
<!-- shortcuts-table:end -->

Change them at `chrome://extensions/shortcuts`; Pickup's pages always show the keys you actually have. If you had an earlier Pickup build installed, Chrome keeps its old keys: remove Pickup and load v1.0.0, or set them there.

## Privacy

Everything stays in `chrome.storage.local`. No account, no servers, no analytics, no network requests. At most 200 characters of a highlight; never the page's text. Voice is off by default and recognised on-device. Delete all removes everything.

## Limits

- Pickup can't see your phone; it only knows what happens in Chrome.
- It can't read Google Docs text, so in Docs it saves your place without a highlight.
- "Time to first interaction" is a stand-in for getting back into work, not a measure of focus.
- Our pilot is the 3 people who built it, over about a day: a starting point, not proof.

## Checksum

`pickup-v1.0.0.zip` is 807,878 bytes. SHA-256:

```
6423bc585b802b5ed1f32516ddbee4e6b5383ed9e7aab259faca2e1d880ca62f
```

Check it with `shasum -a 256 pickup-v1.0.0.zip` (Mac, Linux) or `Get-FileHash pickup-v1.0.0.zip` (Windows PowerShell).
