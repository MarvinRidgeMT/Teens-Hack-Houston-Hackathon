#!/bin/sh
# Run the engine suite with its fake clock started at every hour of a day (plus the
# US DST change days), in parallel. Every line should say "passed" with no FAIL.
# Usage: sh test/dev/time-of-day-sweep.sh [test file]   (default test/engine.test.mjs)
cd "$(dirname "$0")/../.." || exit 1
FILE="${1:-test/engine.test.mjs}"
{
  for h in 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23; do
    echo "2026-11-21T$h:40"
  done
  echo "2026-03-07T21:40"; echo "2026-03-08T01:40"; echo "2026-10-31T21:40"; echo "2026-11-01T00:40"
} | xargs -P 8 -I{} sh -c '
  out=$(PICKUP_TEST_START="{}" node "'"$FILE"'" 2>&1)
  fails=$(printf "%s\n" "$out" | grep "FAIL" | cut -c1-90 | tr "\n" ";")
  printf "%s  %s  %s\n" "{}" "$(printf "%s\n" "$out" | tail -1)" "$fails"
' | sort
