# Toast

A short confirmation that floats in after an action: "Parked · next step saved", "Wrapped up. See you tomorrow." It mirrors the toolbar badge flash, for people who don't look at the toolbar.

- `pk-toast` with a `pk-badge` on the left, at the top-right like the cards (`space-3`, `z-overlay`).
- `role="status"` so screen readers announce it. Stays 2.4s, then leaves; hovering keeps it.

Motion: springs in from 12px above (bounce 0.3), the check draws itself, then it fades up and out with `ease-in`. Under reduced motion it just appears and disappears.
