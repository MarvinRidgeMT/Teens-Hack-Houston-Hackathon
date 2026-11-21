# Prompt for Claude Code: Mac/Windows shortcuts + release prep (Sat, before the 3 PM submission)

> In `~/pickup`, run `claude` and paste everything below the line. Have the **pooled pilot numbers** from Abhinav ready (medians, IQR, n per condition): the prompt asks for them in Part C.

---

You're working with me, Anish (Engine), on **Pickup**, an MV3 Chrome extension and its website (`web/`, which builds into `site/`). `main` includes the V4 merge (PR #4), and real-Chrome gate run 18 on `main` gave 23 pass, 0 fail, Docs skipped. **Submission is 3:00 PM ET.** Work on branch `release/v1.0` from `origin/main`. **Ask me before merging, pushing, tagging, creating a GitHub release, enabling Pages, or changing repo visibility.**

Invoke and follow these skills:
- `superpowers:using-superpowers`
- `modern-web-guidance:chrome-extensions` (the `commands` API, `suggested_key` per platform, the 4-shortcut cap)
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`
- `superpowers:requesting-code-review` at the end

**Rules:**
- No behaviour changes beyond what's written here; no storage changes.
- The UI design stays as it is ("the UI is good for now"). Change only shortcut **text**.
- `src/content/` is Sidd's and `src/pages/` is Abhinav's. These edits are text-only shortcut labels, and they need to see the diff before merge.
- Keep the gate green.

## Part A: platform-specific shortcuts (time-box 45 min)

**Problem:** `manifest.json` gives only `"default": "Alt+P" / "Alt+R" / "Alt+V"`. On Mac these become Option shortcuts, which don't work reliably for our team. About 57 places in the code also hard-code "Alt+P" or "⌥P", so the UI can show the wrong keys.

1. **Manifest.** Give each command an explicit per-platform `suggested_key`. Keep it to 3 commands with keys; `wrap-up` stays without one (Chrome allows at most 4).

   | Command | `default` / `windows` / `linux` / `chromeos` | `mac` |
   |---|---|---|
   | `park-task` | `Alt+P` | `MacCtrl+Shift+P` (shown ⌃⇧P) |
   | `resume-task` | `Alt+R` | `MacCtrl+Shift+R` (⌃⇧R) |
   | `toggle-voice` | `Alt+V` | `MacCtrl+Shift+V` (⌃⇧V) |

   Why Control+Shift on Mac: Command+Shift+R (hard reload) and Command+Shift+V (paste and match style) are taken in Chrome, and Option+letter is unreliable. Before committing, check the Chrome docs for the exact `MacCtrl` syntax and confirm these don't clash with Chrome or macOS shortcuts. If one does, pick the nearest free combo and tell me. Set `windows` / `linux` / `chromeos` explicitly too, not only `default`. Bump `"version"` to `"1.0.0"`.

2. **One source of truth for the labels.**
   - Add a service-worker message `getShortcuts {}` → `{ ok, platform, park, resume, panel, wrapUp }`. It reads **the user's actual bindings** from `chrome.commands.getAll()` (Chrome formats them per OS, and this respects rebinding in `chrome://extensions/shortcuts`), plus `chrome.runtime.getPlatformInfo()`.
   - An unassigned command (Chrome skips a suggested key if another extension already took it) returns `''`, and the UI shows "Not set: chrome://extensions/shortcuts".
   - Add it to `MSG` / `TO_ENGINE`, and document it in `src/sw/README.md`.
   - Add a shared helper for extension pages (`src/shared/shortcuts.js`) that requests and caches it, with a platform fallback table (mac ⌃⇧P/⌃⇧R/⌃⇧V; others Alt+P/Alt+R/Alt+V).

3. **Replace every hard-coded label.** Use `grep -rnE "⌥|Alt\+[PRV]|Option\+[PRV]"` across `src/`, `web/src/`, `README.md` and the notification/badge copy in `src/sw/`.
   - **SW strings** (notifications, badge titles, voice replies): use `getShortcuts` data.
   - **Popup, setup, dashboard, panel:** use `src/shared/shortcuts.js`.
   - **Content script** (card and overlay hints, which can't use `chrome.commands`): ask the SW once per page with `getShortcuts` and cache the result. Card keys (Enter / T / Esc) are the same everywhere, so leave them.
   - **Website** (`web/src/content/site.ts` + components): detect the platform (`navigator.userAgentData?.platform ?? navigator.platform`). Show Mac keys to Mac visitors and Windows/Linux/ChromeOS keys to everyone else, with a small "Mac / Windows" toggle, so judges can see both. In the install section, list **both** sets in a table.
   - Add a `check-integration.mjs` rule that **FAILs** on any hard-coded `Alt+P/R/V` or `⌥P/R/V` outside `manifest.json`, `src/shared/shortcuts.js` and the website's shortcut table.

4. **"All devices," stated honestly:**
   - Extensions run on **desktop Chrome** (Windows, macOS, Linux, ChromeOS) and Chromium browsers such as Edge and Brave; they don't run in Chrome on Android or iOS.
   - On every platform there's a non-keyboard way to do the same things: the popup's Park / Resume / Open panel buttons, the right-click menu, the panel's Ask box and voice. Check that each exists and works.
   - **The website** must work on phones and tablets (it already should, after V4). Re-check it at 375 and 768.
   - Add a short "Works on" line to the site and the README: "Chrome or Edge on Windows, Mac, Linux and ChromeOS. Not on phones: mobile browsers don't support extensions."

5. **Tests:**
   - `test/engine.test.mjs`: `getShortcuts` with fake `commands.getAll` for mac, win and an unassigned binding.
   - `npm test` and `node test/check-integration.mjs` green.
   - Real-Chrome gate (`test/dev/real-chrome-gate.mjs`, isolated Chrome for Testing profile, **real** content scripts): full run.
   - Screenshot `chrome://extensions/shortcuts` from the test profile.
   - The container is Linux/Windows-like, so **give me a 6-line manual Mac check**:
     1. remove Pickup;
     2. load the new unpacked build;
     3. open `chrome://extensions/shortcuts` and confirm ⌃⇧P / ⌃⇧R / ⌃⇧V;
     4. press each on a work page;
     5. check that the card and overlay hints show ⌃⇧ keys;
     6. check that the popup shows ⌃⇧ keys.
   - **Note:** existing installs keep their old bindings. A changed `suggested_key` only applies on a fresh install. Say so in the README.

## Part B: README, version, release zip (30 min)

1. **`README.md`** (it's currently just the title). Write it for judges, plain and accurate:
   - what Pickup is (2 sentences);
   - a screenshot of the return card (`web/public/assets/shot-card.jpg` or a V4 capture);
   - **Install in 4 steps:** download the zip from Releases → unzip → `chrome://extensions` → Developer mode → Load unpacked;
   - first-run setup (work and distraction sites);
   - **Try it without your own data:** dashboard → Load sample data;
   - **Shortcuts:** a table with Mac and Windows/Linux/ChromeOS columns, plus "change them at `chrome://extensions/shortcuts`" and the fresh-install note;
   - **Works on** (Part A step 4);
   - **Privacy** (from the code: `chrome.storage.local`, no accounts, servers or analytics, no network requests, a ≤ 200-character highlight, on-device voice, delete all);
   - **Honest limits** (it can't see your phone, it can't read Google Docs text, time-to-first-interaction is a proxy, the pilot is 3 builders over about a day);
   - **How it's built** (MV3 plain JS; `web/` is React + Vite + R3F building into `site/`);
   - **Running tests**;
   - **Team** (Anish: Engine; Sidd: Surface; Abhinav: Setup, Evidence & Story);
   - **Credits and licences** (fonts OFL, Motion and Anime.js MIT, three MIT, GSAP's licence as stated in `node_modules/gsap`, any model attribution from `docs/v4/LAPTOP.md`);
   - **Roadmap** (link `docs/ROADMAP_IDEAS.md`).

   No invented numbers. Only shortcuts that match the manifest.
2. **Release zip:** a script `scripts/make-release.sh` builds `pickup-v1.0.0.zip` from **only** what the extension needs: `manifest.json`, `src/` (but not `src/voice/spike*` and other dev-only files), `assets/`. It **excludes** `test/`, `web/`, `site/`, `docs/`, `design/`, `handoff/`, `Claude outputs/`, `docs-shots/`, `.impeccable/`, `node_modules/`, dotfiles and `package*.json`.
   - Unzip it into a temp folder, load it unpacked in a fresh Chrome for Testing profile, and run a smoke test (setup → start task → park → leave → return → card → Resume). No console errors; `check-integration` passes against the unzipped folder.
3. **Prepare, but don't run without my yes:** `git tag v1.0.0`, and `gh release create v1.0.0 pickup-v1.0.0.zip --title "Pickup v1.0.0" --notes-file docs/RELEASE_NOTES.md`. Write the release notes: features, install, the shortcuts table, limits.
4. **Website Download button:** it points to `…/releases/latest`. Confirm the site handles the "no release yet" state honestly (as before). After I publish the release, rebuild `site/` and check that the link resolves.

## Part C: pilot results on the site (15 min, needs the data from me)

Ask me for the pooled numbers in this exact shape:
- condition: pickup / control;
- n events;
- median seconds to first work interaction, with IQR;
- the same broken down by away bucket, if available;
- the date range;
- participants: 3.

Then fill `PILOT_RESULTS` in `web/src/content/site.ts` **with the real numbers only**, keeping the "3 people who built it, about 1 day, randomised per event: a starting point, not proof" framing and `PILOT_METHOD`. Also add:
- the card-version note: the card changed at 9:38 AM (v2) and 11:19 AM (v3) during the pilot, per the treatment log;
- **whichever way the numbers point**.

If I don't have the numbers by 1:30 PM, leave it null (the site already shows an honest placeholder) and tell me.

Rebuild `web/` → `site/`, then run `tsc` and the build. Screenshot the evidence section at 1440 and 375.

## Part D: finish (by 2:15 PM)

1. `npm test`, `check-integration`, the web build and the real-Chrome gate all green. Log run 19 in `test/REAL_CHROME_LOG.md`.
2. Code review on the `release/v1.0` diff vs `main`, then fix what's real.
3. Prune leftover worktrees (`git worktree prune`). Don't delete branches without asking.
4. Report to me in ≤ 15 lines:
   - the final shortcuts per OS;
   - test results;
   - the zip path and size;
   - the README summary;
   - what still needs me: merge, tag, release, Pages, repo visibility, the Mac manual check.
5. **Ask** before merging `release/v1.0` into `main`, pushing, tagging or releasing.
