# ReturnCard

The card Pickup shows at the top-right of the page when you come back to a parked task.

Top to bottom: a chip row (away time, tab count), the eyebrow "Welcome back", the task name (`title`), the next step in a `mist` box labelled with its source (you wrote / picked / said this), then Resume (primary), Tidy (quiet) and Not now (ghost).

- `role="dialog"` with an `aria-label`. Focus Resume on open: Enter resumes, T tidies, Esc dismisses.
- Fixed, `space-3` from top and right, `z-overlay`, max 360px wide.
- **Start here** variant after Wrap up: eyebrow "Start here", task, next step, "Stopped yesterday at 4:30 PM", one Resume button.

Motion:
1. The card springs in from 10px above (bounce 0.25, 0.45s).
2. Its rows follow with `stagger` 40ms, rising 6px.
3. The next-step box glows once (mist to periwinkle ring and back, `duration-slow`) so the eye lands on it.
4. Resume: the card scales to 0.98 and fades with `ease-in` in `duration-fast`.

All of it is skipped under reduced motion. The consumer provides task name, away time, tab count, next step and its source.
