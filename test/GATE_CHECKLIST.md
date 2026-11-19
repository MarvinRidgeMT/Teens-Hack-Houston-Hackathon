# Gate checklist (Fri Nov 20, 2:00 PM ET)

The Gate passes only when all 11 steps pass on **all three laptops**, on a **fresh Chrome profile**. Each laptop runs it twice: once with debug on (Run A), once with the real 2-minute threshold (Run B).
Steps are from the team plan, p.12. "Engine evidence" is what Anish checks in `test/dev/inspect.html` (or the service-worker console). If steps 6–8 fail, nobody starts anything else until they pass.

## 0. Before 12:00 PM (Anish)

- [ ] `node test/check-integration.mjs`: no FAIL lines (manifest paths, contract strings, no network calls).
- [ ] `npm test`: all checks pass.
- [ ] Sidd's `src/content/` and Abhinav's `src/pages/` are in the repo. Mismatches go in `NOTES_FOR_TEAM.md`.
- [ ] On each laptop that ran the dev setup, the dev stub is unregistered (dev setup page → "Unregister stub").

## 1. Setup (every laptop, every run)

- [ ] New Chrome profile → `chrome://extensions` → Developer mode → Load unpacked → `pickup/`. Note any load error.
- [ ] The setup page opens on install. Work sites `docs.google.com`, `wikipedia.org`; distraction `youtube.com`; participant name set.
- [ ] Click Save → the site-access prompt → Allow. Open work tabs get the script without a reload.
- [ ] Run A only: debug on. Force card on for steps 6–9, then off for one extra return (about half show no card).
- [ ] Run B: debug **off**, force card **off**, threshold 2 min, nudge 5 min.

## 2. The 11 steps

| # | Step (team plan) | Owner | Engine evidence | A: Anish | A: Sidd | A: Abhinav | B: Anish | B: Sidd | B: Abhinav |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Open an essay Doc. Popup → Start task "Climate Essay". A tab group with that name appears. | Abhinav (popup), Anish | Threads: "Climate Essay" with a groupId | | | | | | |
| 2 | From the Doc, open two research links. Both join the group and show as suggested in the popup. Remove one; it stays out from then on. | Anish, Abhinav | Thread: `suggestedTabIds` 2 → 1; `excludedUrls` has the removed URL | | | | | | |
| 3 | On the Wikipedia tab, highlight a sentence and scroll halfway down. | Sidd | Session `tabState` for that tab: scrollY > 0, highlight set (within 2 s) | | | | | | |
| 4 | Press Alt+P, type "Find a source for the drought statistic", press Enter. | Sidd (overlay), Anish | Open break: parked (`departed: false`); breadcrumb has nextStep, scrollY, highlight | | | | | | |
| 5 | Switch to YouTube and stay past the threshold. | Anish | Open break `departed: true`; Run B: one notification after 5 min | | | | | | |
| 6 | Return to the Wikipedia tab. Force card on: the card shows thread name, time away, next step, highlight. Off: about half of returns show no card. | Sidd, Anish | New event `signal: park`, `cardShown` matches what you saw, `debug` matches the run | | | | | | |
| 7 | Press Enter (Resume): tab focused, group expanded, scroll restored. | Sidd, Anish | `[Pickup]` log line; no error lines | | | | | | |
| 8 | Type one character. The dashboard shows the event with condition, away bucket and seconds to first work interaction. | Sidd (timer), Abhinav (dashboard) | Event `firstInteractionAt` set; card keys did not set it | | | | | | |
| 9 | Leave again, return, press T (Tidy): the YouTube tab sits in a collapsed "Later" group and is not closed. | Anish, Sidd | Event `signal: tab`; YouTube tab in "Later", collapsed | | | | | | |
| 10 | Switch to another app for longer than the threshold, then come back: a breadcrumb and an event are recorded. | Anish | Event `signal: focus`; breadcrumb `signal: focus` | | | | | | |
| 11 | Dashboard: sample data loads with its banner; CSV export opens in a spreadsheet; delete-all empties everything. | Abhinav | After delete-all, storage has only `settings` | | | | | | |

## 3. Engine extras (Anish's laptop, Run A)

- [ ] Worker kill: open a break, stop the worker in `chrome://serviceworker-internals`, return. The event is logged.
- [ ] Popup: open the Pickup popup for 20 s, close it. No break and no event.
- [ ] Docs: steps 6–8 on the Doc itself. The breadcrumb URL is the Doc (not `about:blank`), the card is drawn once, and typing counts.

## 4. At 2:00 PM, Gate passed

- [ ] Every laptop: debug **off**, force card **off** (setup page). Inspector shows `debug: false, forceCard: false`.
- [ ] Every laptop: delete all test events (dashboard delete-all) so the pilot starts empty.
- [ ] Schema frozen: no changes to `messages.js`, `constants.js` keys or event fields from here on. Engine changes are bug fixes only.
- [ ] Pilot rules (team plan p.13): an eligible event is a 2+ min break with debug off and force card off. Nothing else is ever excluded.

## If a step fails at 2:00 PM

The owner fixes it while the other two start the pilot on the steps that work. Steps 6–8 block everyone.
Engine failures: capture the `[Pickup]` console lines and `await chrome.storage.local.get(null)` from the service-worker console. Anish writes a failing check in `test/engine.test.mjs` first, then fixes it.
