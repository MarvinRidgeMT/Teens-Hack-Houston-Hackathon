# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Two surfaces, two stacks (Anish's decision, Nov 21):
- **Extension:** Chrome Manifest V3, plain HTML/CSS/JS with no build step, loaded unpacked. Pages in `src/pages/`, side panel in `src/voice/`, content-script card and park overlay in `src/content/`, service worker in `src/sw/`. Motion (motion.dev) is bundled in `src/vendor/`. No network requests; Inter is bundled.
- **Website:** React + TypeScript + Vite + React Three Fiber in `web/`, built to static files in `site/` (Anish chose this over a no-build Three.js page).

## Users

Students first: high school and college students doing schoolwork in Chrome (an essay in Google Docs, a reading, a problem set, a lecture video) who get pulled away by YouTube, social sites and messages, and lose their place. Also anyone else whose work lives in Chrome tabs; demos lead with school tasks.

The website this weekend is read by **Triple H 2026 judges first** (reviewing the submission: demo, how it works, privacy, how it's tested), then by students who want to try it.

## Product Purpose

Pickup saves a student's place when they get interrupted and hands it back when they return: the task, its tabs, the scroll position, the last highlight and the next step they wrote. Success is getting back into work quickly after a break without the return becoming another chore. Tagline: "Undo the interruption, not the mistake." Supporting line: "The calm way back to your work."

## Positioning

Pickup doesn't block sites, close tabs, run timers or write anything for you. It notices when you leave a work page, keeps your place locally, and puts a small card in front of you when you come back, with your own words as the next step. Not a tab manager, not a Pomodoro app, not an AI assistant.

## Operating Context

- Students in Chrome on a laptop, mid-task, switching to a distraction site or another app and coming back minutes or hours later.
- A hackathon submission: Triple H 2026 (theme "a more efficient way to live"), submitted Sat Nov 21, 3:00 PM ET. A 3-person pilot runs on team members' laptops with random assignment between the Pickup card and a control condition; the event schema is frozen.
- Team: Anish (engine), Sidd (content-script surface: return card, park overlay), Abhinav (setup, evidence and story). Repo: MarvinRidgeMT/Teens-Hack-Houston-Hackathon (private).

## Capabilities and Constraints

Implemented (v1.0, verified in code):
- **Return card + Resume:** task name, time away, the next step the student wrote, the last highlight; Enter resumes (scroll and highlight restore), T tidies, Esc is Not now. Shorter card after a short break.
- **Park (Alt+P):** asks for an optional next step before leaving.
- **Task tab groups:** each task is a named Chrome tab group.
- **Tidy:** tabs opened during a break go into a collapsed "Later" group; nothing is closed.
- **Drift nudge:** one notification per break, only if a next step was written.
- **Alt+R:** jump back to the task from any tab.
- **"Make this my next step":** context-menu action on selected text.
- **Wrap up → Start here:** wrap up at night; one "Start here" reminder the next morning.
- **Pickup panel** (side panel, Alt+V): ask "where was I?", break timer ("back in 10"), task list, today's facts.
- **Voice:** optional, off by default; speech recognition only with `processLocally = true` (on-device); spoken replies only with local voices.
- **Lecture video:** goes back 10 seconds on resume (YouTube-style single video).
- **Comeback receipt** on the dashboard; CSV export of the pilot event log; Load sample data.
- **Delete all:** one button removes everything Pickup stored.

Constraints:
- Everything stays in `chrome.storage.local`; no accounts, no servers, no analytics, no network requests (enforced by `test/check-integration.mjs`). Highlights are capped at 200 characters; page text is never stored.
- Can't read Google Docs text (saves place, not highlight, there). Can't see the phone or apps outside Chrome.
- Pilot fairness: don't touch the coin flip, interaction timing, event schema, message protocol, element IDs or storage keys. Extension UI changes that reach pilot laptops are logged as treatment changes in `NOTES_FOR_TEAM.md` and `test/REAL_CHROME_LOG.md`.
- Red is only for Delete all; away/paused states are neutral, never red. No streaks, no guilt copy, no "great job".
- Keyboard shortcuts are real: Alt+P, Alt+R, Alt+V (Wrap up has no default key).
- Distribution: load unpacked from a zip. No Chrome Web Store listing. The download link (`releases/latest` on the GitHub repo) only works once the repo is public with a v1.0 release; today it is private with no releases.

## Brand Commitments

- Name "Pickup" (the brief also writes "PickUp"; the product uses "Pickup").
- Tagline "Undo the interruption, not the mistake."; "The calm way back to your work."
- Voice: a friend who kept your place in the book. Short, plain, second person, sentence case, no exclamation marks; say what happens next; use the student's own words back to them; name the key for every action.
- Brand idea from Anish: "Energy in the product, calm in the experience": the website can be loud and colourful, the extension stays calm and utilitarian, and both are one brand.
- Brand tile `pk-mark`: a rounded square with a pill near its bottom edge (until a real logo exists).

## Evidence on Hand

- Product screenshots: `site/assets/shot-*.jpg`, `docs-shots/` (popup, setup, dashboard, panel, receipt; light and dark).
- Palette research: `design/Student_focus_app_colour_palettes.md` (no user testing of colours).
- Pilot: 3 people, random assignment, metric "time to first interaction" after return (a stand-in for getting back into work, not a measure of focus). **No results yet**; Abhinav posts them Sat ~10 AM. Never invent numbers, testimonials, user counts or study findings.
- Demo video: not posted yet (unlisted YouTube, Saturday).
- Gloria Mark's interruption research is cited as context, not as a promise.

## Product Principles

1. Hand back the student's own context; never invent it.
2. Being away is normal: no guilt, no alarms, no red for lapses.
3. Nothing leaves the computer.
4. One clear next action at every moment, with its key named.
5. Honest over impressive: every claim on the site matches the code.

## Accessibility & Inclusion

WCAG 2.2 AA for the website and every extension surface: 4.5:1 text, 3:1 controls and focus, visible focus, keyboard paths for everything, `prefers-reduced-motion` respected, a Readable card setting (larger text, 1.5 line height, extra spacing) and a Calm colours setting. ADHD-friendly restraint in the extension: muted large surfaces, few accents, limited motion.
