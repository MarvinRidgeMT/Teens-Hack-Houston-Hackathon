# Internal team notes

Working notes from the 48-hour build. They're kept for the team and aren't part of the product docs, so plans and paths in them may be out of date.

| Path | What it is | Old location |
|---|---|---|
| `NOTES_FOR_TEAM.md` | Lane-by-lane notes, open questions and the pilot's treatment change log | `/NOTES_FOR_TEAM.md` |
| `testing/REAL_CHROME_LOG.md` | Real-Chrome gate runs, release smoke tests and the treatment log | `/test/REAL_CHROME_LOG.md` |
| `testing/GATE_CHECKLIST.md` | The 11-step gate checklist (Fri Nov 20) | `/test/GATE_CHECKLIST.md` |
| `testing/VOICE_SPIKE.md` | Voice phase 0 spike results | `/test/VOICE_SPIKE.md` |
| `handoff/` | The engine handoff PDF and the Claude Code prompts used for each lane | `/handoff/` |
| `impeccable/` | Config for the Impeccable design linter | `/.impeccable/` |

The handoff prompts are kept as written, so they still use the old paths in the "Old location" column.

**Impeccable:** the CLI looks for `.impeccable/` at the repo root. To run it again, copy the folder back first: `cp -r docs/internal/impeccable .impeccable`.

**Screenshots:** the scripts in `test/dev/` still write to `docs/v4/after/` and `docs-shots/palette/`. Those folders are now gitignored, so the output stays local. Earlier sets are in git history.
