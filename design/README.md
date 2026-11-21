# Pickup

Pickup is a Chrome extension that helps students get back into a task after a distraction. You **park** a task with an optional next step (Alt+P), and when you come back, Pickup shows a small card that puts you right where you were (Alt+R). At the end of the day you **wrap up**, and tomorrow Pickup tells you where to start.

**Where this comes from.** Product behaviour, states and copy come from `MarvinRidgeMT/Teens-Hack-Houston-Hackathon` (commit 4e7b1f1). The look comes from the MotionSites design **macOS widget** (the Driftbar meadow footer): warm paper, near-black ink, lavender mist, a blue-hour sky, Inter, a black brand tile and hairline pill chips. Animation uses [Motion](https://motion.dev) throughout.

## Content fundamentals

Pickup talks like a friend who kept your place in the book. Short, plain, second person.

- **Say what happens next, not what the system did.** "Jump back to your task", not "Restore session".
- **Use the student's own words back to them.** The next step is shown as they wrote, picked or said it, and labelled: "Your next step (you wrote this)".
- **No guilt.** Being away is normal. "Away 7 min" is a fact, never a warning.
- **Name the key.** Every action with a shortcut shows it: Resume (Enter), Tidy (T), Not now (Esc).
- **Sentence case**, no exclamation marks.

| Do | Don't |
| --- | --- |
| Park this task with an optional next step | Save session state |
| Wrap up for today | End session |
| Start here | Recommended task |
| Nothing saved yet | Error: no data |

## Visual foundations

Two themes: **Paper** (light) and **Blue hour** (dark). Every text pair passes 4.5:1 and every control, icon and focus pair passes 3:1 in both.

- **Ground and surfaces.** `paper` for pages, `surface` for anything floating, `mist` for the one thing in a card the eye should land on (the next step). Cards add a `border` hairline and `shadow-card`, which carries a faint periwinkle tint in Paper.
- **One primary per view.** `accent` is black on Paper and paper-white at Blue hour, with `on-accent` text (17:1+). There is no coloured button; colour is saved for meaning.
- **Brand hue.** `periwinkle`, the blue-hour sky: links, the active task, the meadow. 7:1+ on every surface.
- **State colours** come from the toolbar badge and are tuned to the same dusk family: parked periwinkle, away firefly amber, wrapped violet, saved green, neutral stone. Deep in Paper with a white glyph, bright at Blue hour with an ink glyph (`on-state`, 5:1+ everywhere). The repo's original amber (#D97706) and teal (#0D9488) failed with white text and are replaced; update `BADGE` in `src/shared/constants.js` to the Paper values, since the toolbar badge has one colour only.
- **Type.** Inter (Google Fonts, opsz 14–32, 400–700) with tight tracking on headings (−0.045em), as in Driftbar. `title` for task names, `body` in `ink-body` for paragraphs, `caption` for meta, `chip` for chips, `kbd` (mono) for keys.
- **Shape.** `radius-lg` (16px) cards and popup, `radius-md` (8px) buttons, inputs and the brand tile, `radius-pill` chips and badges.
- **Brand tile.** A 30px `accent` square with a white pill near its bottom edge (`pk-mark`): Pickup's logo until a real one exists.
- **Focus.** 2px `focus-ring`, offset 2px, on every control. Cards focus their primary button on open.

## Motion

Pickup animates with **Motion** (motion.dev, v11.18.2), carried as `components/lib/motion.js` and available as `window.Motion` in every preview and template. Motion is how Pickup feels calm: things arrive softly, confirm clearly and never jump.

| Moment | Motion |
| --- | --- |
| Card or prompt opens | spring from 10px above, `bounce: 0.25`, `duration: 0.45` |
| Rows inside it | rise 6px, `stagger(0.04)`, `ease-out`, `duration-base` |
| The next step | one periwinkle ring glow, `duration-slow` × 2 |
| Saved | the check path draws itself (`strokeDashoffset 1→0`), badge pops with `bounce: 0.45` |
| Button | hover lifts 1px; press 0.96 then springs back (`bounce: 0.5`) |
| Task type switch | the pill slides with a spring |
| Away dot | breathes 1 → 0.55 opacity on a 2.4s loop |
| Leaving | fade and lift 6px, `ease-in`, `duration-fast` |
| Setup page | wordmark rises out of the fog; fireflies drift and blink on random slow loops |

```js
const M = window.Motion;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const go = (el, k, o) => (!reduce ? M.animate(el, k, o) : Promise.resolve());

go(card, { opacity: [0, 1], y: [-10, 0] }, { type: 'spring', bounce: 0.25, duration: 0.45 });
go(card.querySelectorAll('[data-row]'), { opacity: [0, 1], y: [6, 0] },
   { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: M.stagger(0.04) });
```

Rules: Motion takes seconds (`duration-base` 220ms → `0.22`) and easings as 4-number arrays. **Always check reduced motion** and show the end state instead. Animate only `opacity` and transforms on things injected into other websites, so the host page never reflows.

## Iconography

The toolbar badge uses glyphs, not icons: **P** parked, **•** away, **☾** wrapped up (fall back to **Z**), **✓** saved, **!** nothing saved, **?** no task yet. Use the same glyphs inside the UI. Where an icon is needed (the mic on the voice chip), use an 11–14px stroke icon, `stroke: currentColor`, width 2, round caps and joins, as Driftbar's chips do.

The extension icons (`assets/icon16.png`–`icon128.png` in the repo) are not here yet; the repo is private and they could not be copied.

## Components and templates

- **Button**: primary, quiet, ghost, with key hints.
- **StatusBadge**: the five toolbar states.
- **Chip**: status pills with a live dot or icon.
- **Toast**: the "Saved" confirmation.
- **ReturnCard**: the welcome-back card, and its Start here variant.
- **ParkPrompt**: Alt+P, asks for a next step.
- **PopupTemplate**: the toolbar popup, 360px.
- **SetupTemplate**: the options page, adapted from the MotionSites Driftbar footer (brand block, columns, blue-hour meadow, frosted wordmark).
