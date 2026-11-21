// Pickup dashboard: sample data (made up, labelled). Owner: Abhinav (pages).
// Only shown in memory behind a "Sample data" banner; never written to storage and
// never mixed with real events. Both conditions get the SAME made-up times, so the
// sample shows the layout without suggesting any result.

import { awayBucket } from '../shared/constants.js';

const THREADS = Object.freeze({
  'sample-t1': 'Sample: essay draft',
  'sample-t2': 'Sample: biology reading',
  'sample-t3': 'Sample: chem problem set',
});
export const sampleThreadNames = () => ({ ...THREADS });

// Small seeded generator (mulberry32), so the same `now` gives the same sample.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

export function sampleEvents(now = Date.now(), count = 44) {
  const r = rng(20261120);
  const out = [];
  const threadIds = Object.keys(THREADS);
  const pairs = [];
  for (let k = 0; k < Math.ceil(count / 2); k++) pairs.push({ secs: 3 + Math.pow(r(), 1.6) * 37, missing: k % 7 === 3 });
  for (let i = 0; i < count; i++) {
    const returnedAt = Math.round(now - (count - i) * 95 * 60000 - r() * 30 * 60000);
    const awayMs = Math.round((2 + Math.pow(r(), 2) * 70) * 60000);
    const signal = pick(r, ['tab', 'tab', 'tab', 'focus', 'idle', 'park']);
    // Conditions alternate, and each pickup/control pair shares one made-up time
    // (roughly 3-40 s, a few missing), so the two medians come out equal.
    const condition = i % 2 === 0 ? 'pickup' : 'control';
    const { secs, missing } = pairs[Math.floor(i / 2)];
    const planned = signal === 'park' && r() < 0.6 ? pick(r, [5, 10, 15]) : null;
    const returnVia = planned ? pick(r, ['timer', 'tab']) : pick(r, ['tab', 'tab', 'tab', 'resumeKey', 'notification', 'panel', 'idle']);
    const host = signal === 'tab' || signal === 'park' ? pick(r, ['youtube.com', 'instagram.com', 'reddit.com']) : null;
    out.push({
      id: `sample-${String(i + 1).padStart(2, '0')}`,
      participant: 'sample',
      threadId: pick(r, threadIds),
      signal,
      leftAt: returnedAt - awayMs,
      returnedAt,
      firstInteractionAt: missing ? null : returnedAt + Math.round(secs * 1000),
      condition,
      awayBucket: awayBucket(awayMs),
      taskType: pick(r, ['writing', 'reading', 'problems']),
      nextActionDoneAt: null,
      debug: i >= count - 2, // the last pair are testing events, to show how they are marked
      cardShown: condition === 'pickup',
      awayMs,
      distractionHost: host,
      distractionHosts: host ? [host] : [],
      returnVia: signal === 'idle' && returnVia === 'tab' ? 'idle' : returnVia,
      plannedBreakMin: planned,
    });
  }
  return out;
}
