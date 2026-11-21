# SetupTemplate

The setup page (`src/pages/setup.html`, the extension's options page). A page template adapted from the MotionSites **macOS widget** design (the Driftbar meadow footer): paper top with a brand block and three columns, a blue-hour meadow across the lower half fading into the paper, and a giant frosted-glass "Pickup" wordmark sinking into lavender mist.

- **Brand block:** logo tile, "The calm way back to your work", one paragraph, the primary "Save and start" button, status chips.
- **Columns:** Work sites, Distraction sites (from `DEFAULT_SETTINGS`), Shortcuts.
- **Meadow:** drawn with SVG hills and token gradients instead of the original video, so it themes with Paper and Blue hour and needs no network. Decorative, `aria-hidden`.
- A haze gradient keeps every line of copy on near-solid `paper`, so text contrast stays 6:1+.

Motion: the brand block and columns rise in with `stagger`; the wordmark rises 24px out of the fog with `duration-slow`; fireflies drift and blink in slow loops (Motion `repeat: Infinity`, randomised). Under reduced motion all of it stays still.
