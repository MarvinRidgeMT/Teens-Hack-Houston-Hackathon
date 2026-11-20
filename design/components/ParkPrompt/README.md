# ParkPrompt

The prompt that opens when you park a task (Alt+P). It asks for an optional next step, and a task name if the tab is not in a task yet.

- One labelled input, "Your next step (optional)", with an example placeholder in the student's voice. Task name field only when needed.
- Park (primary, Enter) and Cancel (ghost, Esc). Focus the first input on open.
- Same surface, radius, shadow and position as ReturnCard.

Motion: springs in like ReturnCard. On Park, the form collapses (height and opacity, `ease-in`) and a "Parked" chip with a drawn check springs into its place, then the whole prompt fades after 1.2s; the toolbar badge flashes ✓ at the same time. Skipped under reduced motion.
