# Motion (website, V4)

How the Pickup website moves, who owns each kind of motion, and how to add to it without breaking scroll, reduced motion or cleanup. The extension has no decorative motion: its pages use CSS state transitions only, and lane X removed the always-on loops (fireflies, fog drift, breathing dots).

## Ownership (never two libraries on one property of one element)

| Library | Owns | Where |
|---|---|---|
| **GSAP 3.15** (+ `@gsap/react` `useGSAP`) | The hero opening timeline, the pinned story timeline (ScrollTrigger), pointer parallax via `gsap.quickTo` | `sections/Hero.tsx`, `sections/ScrollStory.tsx` |
| **Motion 14.9** | UI springs: gel button hover/press and magnetic pull, the nav droplet (`layoutId`), tab reorders (`layout`), `AnimatePresence` for the card demo, park prompt, browser sim | `components/glass/*`, `components/BrowserFrame.tsx`, `sections/{Interrupted,ReturnDemo,Features}.tsx` |
| **Lenis 1.3** | Smooth wheel scroll only | `hooks/useSmoothScroll.ts` |
| **React Three Fiber** | Rendering; the camera rig eases toward a pose each frame | `three/LaptopScene.tsx`, `three/rig.ts` |
| **CSS** | Simple state transitions (hover colours, `details` icons, the drawn tick, the caret blink) | `styles/*.css` |

The vocabulary (durations, springs, eases) lives in `web/src/styles/motion.ts` and as `--dur-*` / `--ease-*` in `tokens.css`: pointer 140 ms, hover 200, press 140, card 400, nav 360; `SPRING_PRESS` (stiffness 520, damping 28), `SPRING_CARD` (300/30), `SPRING_DROPLET` (420/34); GSAP `power3.out` (enter), `expo.out` (hero), `sine.inOut` (drift).

## One loop: Lenis + ScrollTrigger + GSAP

```ts
const lenis = new Lenis({ autoRaf: false, anchors: { offset: -88 }, lerp: 0.12 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```
Lenis is off under `prefers-reduced-motion`. Keyboard scrolling, anchors, find-in-page and history stay native (Lenis only smooths wheel/touchpad). No `preventDefault` on wheel anywhere, no snapping.

## The hero opening (`Hero.tsx`)
One `gsap.timeline` scoped with `useGSAP`: light volumes fade/scale in (0 s) → headline lines rise from their masks (0.1 s, stagger 0.07) → lede, CTAs, facts (0.45 s) → context bubbles settle (0.7 s). Key content is in place by ~1.5 s. Nothing waits on it: links and buttons work from the first frame. The laptop's lid opens on wall-clock time in the R3F loop (1.4 s), so a slow GPU can't stretch it.

Pointer (fine pointer, motion allowed): bubbles parallax ≤ 12 px via `gsap.quickTo`; the laptop eases ±0.06 rad yaw / ±0.035 rad pitch through `story.pointerX/Y`. Both reset on unmount.

## The story (`ScrollStory.tsx`)
- One section, one pin (`.story__pin`, 100svh), one timeline with `scrub: 0.7` and `end: +=380%`. Labels `working` 0 · `interrupted` 1 · `park` 2 · `return` 3 · `resume` 4.
- `onUpdate` writes `story.progress` (0–1) and `story.setScene()`; R3F reads `story.progress` in `useFrame` (no React state per frame) and blends the two neighbouring poses from `rig.ts` with `smootherstep`. Only the scene index (5 values) touches React, to swap the screen texture and the screen-reader caption.
- Captions cross-fade (`autoAlpha` + `y`); context bubbles move with the story (task drifts back and dims → distraction chip → next-step capsule → task gathers into the "Saved" capsule → timer chip → "Back at your spot" + "Later"). Light volumes shift colour per scene.
- Step buttons jump to `start + (end − start) × i/4` (smooth unless reduced).
- Reverse scrolling replays the same timeline backwards; every tween is `fromTo` or relative to a known start, so it lands in the same state both ways.

## Reduced motion and small screens
`ScrollStory` renders `Stacked` instead of `Pinned` when `prefers-reduced-motion: reduce` or the 3D stage isn't affordable (`useCan3D`: < 900 px, no WebGL, or Save-Data). Stacked = five static panels with the real screenshots, no pin, no timeline. Motion's `MotionConfig reducedMotion="user"` turns springs into instant changes; every demo also passes `{ duration: 0 }` when reduced. CSS has a global reduced-motion clamp.

## Cleanup
- All GSAP work is inside `useGSAP({ scope })`, which reverts tweens and kills ScrollTriggers on unmount or dependency change.
- `useSmoothScroll` removes its ticker callback and destroys Lenis.
- Pointer listeners are removed on unmount; `story.pointerX/Y` reset to 0.
- R3F canvases pause (`frameloop="never"`) when off screen (IntersectionObserver); textures and cloned materials are disposed on unmount; a lost WebGL context swaps in the 2D device frame.

## Interruptibility
Motion springs retarget mid-flight (open then immediately close the Return card; press Tidy then Undo; spam the browser sim). ScrollTrigger scrub retargets on direction change. The card demo's keys (Enter/T/Esc) only act while focus is inside it.

## Adding a scene
1. Add the copy to `STORY` in `content/site.ts` and a `Screen` id in `three/story.ts` (+ `SCREENS`, `SHOTS`, `TABS`, `SCREEN_ALT` in `three/screens.ts`).
2. Add a pose to `STORY_POSES` in `three/rig.ts` (`close: true` skips the whole-laptop fit for a close-up).
3. In `Pinned`, add a label and any bubble tweens at the new index; `end` grows with `STORY.length`.
4. Check forwards and backwards, at 1440 and 1024, and the stacked version with `:reduce` in `test/dev/web-shots.mjs`.
