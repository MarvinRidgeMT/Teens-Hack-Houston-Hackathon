# PopupTemplate

The toolbar popup (`src/pages/popup.html`), 360px wide. A page template, built on the MotionSites "macOS widget" (Driftbar) look: paper ground, black brand tile, hairline chips.

Sections: header (logo, status chips) · current task card with Resume and Wrap up · "Start a task" field with the task type switch (writing, reading, problems, from `TASK_TYPES`) · parked tasks list · shortcut footer (Alt+P, Alt+R, Alt+V).

Motion: sections rise in with `stagger`; the task-type pill slides between options with a spring; list rows lift 1px on hover; a newly parked task springs into the top of the list.
