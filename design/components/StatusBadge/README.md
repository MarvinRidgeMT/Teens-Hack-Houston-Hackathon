# StatusBadge

The toolbar badge states, as pills for the popup and cards.

| Class | Glyph | Means | Token |
| --- | --- | --- | --- |
| `pk-badge--parked` | P | A task is parked | `state-parked` |
| `pk-badge--away` | • | You are away | `state-away` |
| `pk-badge--wrapped` | ☾ | Wrapped up for today | `state-wrapped` |
| `pk-badge--saved` | ✓ | Saved (brief flash) | `state-saved` |
| `pk-badge--neutral` | ! or ? | Nothing saved / no task yet | `state-neutral` |

The glyph is always `on-state`. Pair every badge with a text label or `aria-label`.

Motion: a badge that changes state pops in with a spring (scale 0.6→1, bounce 0.45). The away dot breathes slowly (opacity 1→0.55, 2.4s loop) so it reads as "still waiting", never as an alarm. Skipped under reduced motion.

The real Chrome toolbar badge takes one colour with no theme: set `BADGE` in `src/shared/constants.js` to the Paper (light) values.
