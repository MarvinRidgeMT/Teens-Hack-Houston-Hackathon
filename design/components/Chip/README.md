# Chip

Small pills that state a fact, after Driftbar's status chips: "2 tasks parked", "Voice on", "Started 9:40".

- `pk-chip`, with an optional `pk-dot` (saved green by default, `pk-dot--away`, `pk-dot--parked`) or a 11px stroke icon.
- `surface` fill, `border` hairline, `chip` type. Not interactive; for actions use Button.

Motion: chips enter in a row with `stagger` (40ms), rising 6px with `ease-out`. The live dot pulses its ring once when the value changes. Skipped under reduced motion.
