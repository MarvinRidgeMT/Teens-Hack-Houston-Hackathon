// Pickup stats: pure functions over the `events` array. Owner: Abhinav (stats).
// No chrome.*, no DOM: the dashboard and the comeback receipt call these, and
// test/pages.test.mjs checks them in Node.
//
// Rules (team plan):
// - Events with debug: true are testing events. They are left out of EVERY statistic
//   here (counted() is the only door in). The dashboard still lists them, marked.
// - The primary metric is seconds from return to first work interaction:
//   (firstInteractionAt - returnedAt) / 1000. Missing values are left out of medians
//   and counted as missing.
// - Nothing else is ever excluded. Events are read, never changed.

import { awayBucket } from './constants.js';

export const CONDITION_KEYS = Object.freeze(['pickup', 'control']);
export const BUCKETS = Object.freeze(['2-5', '5-15', '15+']);
export const MIN_PER_CONDITION = 10; // the receipt compares conditions only from here

const isEvent = (e) => !!e && typeof e === 'object';

// Every statistic starts here: real (non-debug) events only.
export function counted(events) {
  return (Array.isArray(events) ? events : []).filter((e) => isEvent(e) && e.debug !== true);
}

export function secondsToFirst(e) {
  if (!e || !Number.isFinite(e.firstInteractionAt) || !Number.isFinite(e.returnedAt)) return null;
  const s = (e.firstInteractionAt - e.returnedAt) / 1000;
  return s >= 0 ? s : null;
}

export function awayMsOf(e) {
  if (!e) return null;
  if (Number.isFinite(e.awayMs)) return e.awayMs;
  if (Number.isFinite(e.returnedAt) && Number.isFinite(e.leftAt)) return e.returnedAt - e.leftAt;
  return null;
}

const sorted = (xs) => xs.filter(Number.isFinite).slice().sort((a, b) => a - b);

// Linear interpolation between closest ranks (Excel QUARTILE.INC, R type 7, numpy default).
function quantile(s, p) {
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export function median(xs) {
  const s = sorted(xs);
  return s.length ? quantile(s, 0.5) : null;
}

export function quartiles(xs) {
  const s = sorted(xs);
  if (!s.length) return null;
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  return { q1, median: quantile(s, 0.5), q3, iqr: q3 - q1 };
}

// { pickup: Event[], control: Event[] } over non-debug events.
export function byCondition(events) {
  const out = { pickup: [], control: [] };
  for (const e of counted(events)) if (out[e.condition]) out[e.condition].push(e);
  return out;
}

// One condition's numbers: n events, how many have a first interaction, median, IQR.
export function conditionSummary(list) {
  const secs = list.map(secondsToFirst).filter((x) => x !== null);
  const q = quartiles(secs);
  return {
    n: list.length,
    measured: secs.length,
    missing: list.length - secs.length,
    median: q ? q.median : null,
    q1: q ? q.q1 : null,
    q3: q ? q.q3 : null,
    iqr: q ? q.iqr : null,
  };
}

export function summarize(events) {
  const all = Array.isArray(events) ? events.filter(isEvent) : [];
  const groups = byCondition(all);
  return {
    pickup: conditionSummary(groups.pickup),
    control: conditionSummary(groups.control),
    total: counted(all).length,
    debugLeftOut: all.filter((e) => e.debug === true).length,
  };
}

export function bucketOf(e) {
  if (BUCKETS.includes(e.awayBucket)) return e.awayBucket;
  const ms = awayMsOf(e);
  return ms === null ? null : awayBucket(ms);
}

export function awayBuckets(events) {
  const out = { '2-5': 0, '5-15': 0, '15+': 0 };
  for (const e of counted(events)) {
    const b = bucketOf(e);
    if (b) out[b]++;
  }
  return out;
}

// Monday 00:00 local time of the week that holds `now`.
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7; // Sunday 0 -> 6
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

export function comebacksThisWeek(events, now = Date.now()) {
  const from = weekStart(now);
  return counted(events).filter((e) => Number.isFinite(e.returnedAt) && e.returnedAt >= from && e.returnedAt <= now);
}

export function longestBreakMs(events) {
  let best = null;
  for (const e of counted(events)) {
    const ms = awayMsOf(e);
    if (ms !== null && (best === null || ms > best)) best = ms;
  }
  return best;
}

// 7.46 -> "7.5 s", 15.4 -> "15 s"
export function formatSeconds(x) {
  if (!Number.isFinite(x)) return '';
  if (x < 10) return `${Number(x.toFixed(1))} s`;
  return `${Math.round(x)} s`;
}

// 65 min -> "1 h 5 m", 32 min -> "32 m"
export function formatHM(ms) {
  if (!Number.isFinite(ms)) return '';
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${m} m` : `${m} m`;
}

const range = (q) => `${formatSeconds(q.q1).replace(/ s$/, '')}–${formatSeconds(q.q3)}`;

// The comeback receipt's words (F6). Facts only, from this week's non-debug events.
// "With the card" = condition pickup; "without" = control. n = comebacks with a
// measured first interaction in each condition (the ones the median uses).
export function receiptText(events, now = Date.now()) {
  const week = comebacksThisWeek(events, now);
  const p = conditionSummary(week.filter((e) => e.condition === 'pickup'));
  const c = conditionSummary(week.filter((e) => e.condition === 'control'));
  const longest = longestBreakMs(week);
  const enough = p.measured >= MIN_PER_CONDITION && c.measured >= MIN_PER_CONDITION;

  const parts = [`This week: ${week.length} ${week.length === 1 ? 'comeback' : 'comebacks'}`];
  if (enough) {
    parts.push(`median back to work ${formatSeconds(p.median)} with the card vs ${formatSeconds(c.median)} without (n = ${p.measured} / ${c.measured})`);
  }
  if (longest !== null) parts.push(`longest break ${formatHM(longest)}`);

  return {
    enough,
    headline: parts.join(' · '),
    comparison: enough ? '' : 'Not enough comebacks yet for a comparison.',
    iqr: enough ? `IQR with the card ${range(p)} · without ${range(c)}` : '',
    footer: 'Your data, on your device',
    counts: { comebacks: week.length, pickup: p.measured, control: c.measured },
  };
}
