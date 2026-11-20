# Button

Buttons carry one action each and show its keyboard shortcut.

- **Primary** (`pk-btn pk-btn--primary`): one per view, the action Enter triggers. `accent` with `on-accent`: black on paper, paper-white at blue hour.
- **Quiet** (`pk-btn`): other actions. `ink` label, `border-strong` outline (3:1+).
- **Ghost** (`pk-btn pk-btn--ghost`): low-stakes actions like Not now. `ink-body` label.
- **Key hint** (`pk-kbd`) after the label.

Motion: hover lifts 1px (`duration-fast`), press springs to 0.96 scale and back (`ease-spring`). Skipped under reduced motion. The consumer provides label, key and handler.
