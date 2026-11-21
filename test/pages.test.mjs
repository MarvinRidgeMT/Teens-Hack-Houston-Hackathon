// Pickup pages checks: stats.js (debug left out, median, IQR, away buckets, this
// week, longest break), the comeback receipt text, CSV export, sample data and the
// setup page's pure helpers. No Chrome needed.
// Run: node test/pages.test.mjs

import assert from 'node:assert/strict';

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.log(`  FAIL ${name}\n`, e); process.exitCode = 1; }
}

const stats = await import('../src/shared/stats.js');
const csv = await import('../src/pages/csv.js');
const sample = await import('../src/pages/sample-data.js');
const setup = await import('../src/pages/setup-logic.js');
const fmt = await import('../src/pages/format.js');

// A Friday afternoon in local time, so week maths is time-zone independent.
const NOW = new Date(2026, 10, 20, 15, 0, 0).getTime(); // Fri Nov 20 2026, 3 PM local
const MIN = 60000;
let seq = 0;
function ev(over = {}) {
  seq++;
  const returnedAt = over.returnedAt ?? NOW - seq * 10 * MIN;
  const awayMs = over.awayMs ?? 3 * MIN;
  const firstSec = over.firstSec === undefined ? 5 : over.firstSec;
  const out = {
    id: `e${seq}`, participant: 'p', threadId: 't1', signal: 'tab',
    leftAt: returnedAt - awayMs, returnedAt,
    firstInteractionAt: firstSec === null ? null : returnedAt + firstSec * 1000,
    condition: 'pickup', awayBucket: '2-5', taskType: 'writing', nextActionDoneAt: null,
    debug: false, cardShown: true, awayMs, distractionHost: 'youtube.com', distractionHosts: ['youtube.com'],
    returnVia: 'tab', plannedBreakMin: null,
    ...over,
  };
  delete out.firstSec;
  return out;
}

// ---------------- stats.js ----------------
await step('stats.js: debug events are left out of every statistic', () => {
  const evs = [ev({ firstSec: 4 }), ev({ firstSec: 100, debug: true }), ev({ firstSec: 6 })];
  assert.equal(stats.counted(evs).length, 2);
  const s = stats.summarize(evs);
  assert.equal(s.pickup.n, 2);
  assert.equal(s.pickup.median, 5);
  assert.equal(s.debugLeftOut, 1);
});

await step('stats.js: seconds to first interaction (null when missing or negative)', () => {
  assert.equal(stats.secondsToFirst(ev({ firstSec: 7.5 })), 7.5);
  assert.equal(stats.secondsToFirst(ev({ firstSec: null })), null);
  assert.equal(stats.secondsToFirst({ returnedAt: 10, firstInteractionAt: 5 }), null);
  assert.equal(stats.secondsToFirst({}), null);
});

await step('stats.js: median of odd, even, empty lists', () => {
  assert.equal(stats.median([3, 1, 2]), 2);
  assert.equal(stats.median([4, 1, 3, 2]), 2.5);
  assert.equal(stats.median([]), null);
});

await step('stats.js: quartiles by linear interpolation (Excel QUARTILE.INC, R type 7)', () => {
  const q = stats.quartiles([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(q, { q1: 3, median: 5, q3: 7, iqr: 4 });
  const q2 = stats.quartiles([1, 2, 3, 4]);
  assert.deepEqual(q2, { q1: 1.75, median: 2.5, q3: 3.25, iqr: 1.5 });
  assert.deepEqual(stats.quartiles([5]), { q1: 5, median: 5, q3: 5, iqr: 0 });
  assert.equal(stats.quartiles([]), null);
});

await step('stats.js: group by condition with n, measured, missing, median and IQR', () => {
  const evs = [
    ev({ condition: 'pickup', firstSec: 2 }), ev({ condition: 'pickup', firstSec: 4 }), ev({ condition: 'pickup', firstSec: null }),
    ev({ condition: 'control', firstSec: 10 }), ev({ condition: 'control', firstSec: 20 }), ev({ condition: 'control', firstSec: 30 }),
  ];
  const s = stats.summarize(evs);
  assert.equal(s.pickup.n, 3);
  assert.equal(s.pickup.measured, 2);
  assert.equal(s.pickup.missing, 1);
  assert.equal(s.pickup.median, 3);
  assert.equal(s.control.median, 20);
  assert.equal(s.control.q1, 15);
  assert.equal(s.control.q3, 25);
  assert.equal(s.control.iqr, 10);
  const grouped = stats.byCondition(evs);
  assert.equal(grouped.pickup.length, 3);
  assert.equal(grouped.control.length, 3);
});

await step('stats.js: away buckets count non-debug events, falling back to awayMs', () => {
  const evs = [
    ev({ awayBucket: '2-5' }), ev({ awayBucket: '5-15', awayMs: 7 * MIN }), ev({ awayBucket: undefined, awayMs: 20 * MIN }),
    ev({ awayBucket: '15+', debug: true }),
  ];
  assert.deepEqual(stats.awayBuckets(evs), { '2-5': 1, '5-15': 1, '15+': 1 });
});

await step('stats.js: this week starts Monday 00:00 local; comebacks this week', () => {
  const monday = new Date(2026, 10, 16, 0, 0, 0).getTime();
  assert.equal(stats.weekStart(NOW), monday);
  // A Sunday belongs to the week that started the Monday before.
  assert.equal(stats.weekStart(new Date(2026, 10, 22, 23, 0).getTime()), monday);
  const evs = [
    ev({ returnedAt: monday + MIN }), ev({ returnedAt: monday - MIN }), ev({ returnedAt: NOW - MIN, debug: true }), ev({ returnedAt: NOW - 2 * MIN }),
  ];
  assert.equal(stats.comebacksThisWeek(evs, NOW).length, 2);
});

await step('stats.js: longest break uses awayMs, else returnedAt - leftAt; debug left out', () => {
  const evs = [ev({ awayMs: 5 * MIN }), ev({ awayMs: 65 * MIN }), ev({ awayMs: 300 * MIN, debug: true })];
  assert.equal(stats.longestBreakMs(evs), 65 * MIN);
  const old = { leftAt: 0, returnedAt: 9 * MIN, condition: 'control', debug: false };
  assert.equal(stats.awayMsOf(old), 9 * MIN);
  assert.equal(stats.longestBreakMs([]), null);
});

await step('stats.js: formatters for seconds and h m', () => {
  assert.equal(stats.formatSeconds(8), '8 s');
  assert.equal(stats.formatSeconds(7.46), '7.5 s');
  assert.equal(stats.formatSeconds(15.4), '15 s');
  assert.equal(stats.formatHM(65 * MIN), '1 h 5 m');
  assert.equal(stats.formatHM(32 * MIN), '32 m');
  assert.equal(stats.formatHM(120 * MIN), '2 h 0 m');
});

// ---------------- comeback receipt text ----------------
function week(nPickup, nControl, { pickupSec = 8, controlSec = 15 } = {}) {
  const out = [];
  for (let i = 0; i < nPickup; i++) out.push(ev({ condition: 'pickup', firstSec: pickupSec, returnedAt: NOW - (i + 1) * MIN }));
  for (let i = 0; i < nControl; i++) out.push(ev({ condition: 'control', firstSec: controlSec, returnedAt: NOW - (i + 100) * MIN }));
  return out;
}

await step('receipt: full comparison when both conditions have n >= 10', () => {
  const evs = [...week(10, 11), ev({ condition: 'control', awayMs: 65 * MIN, firstSec: 15, returnedAt: NOW - 3 * MIN })];
  const r = stats.receiptText(evs, NOW);
  assert.equal(r.enough, true);
  assert.equal(r.headline, 'This week: 22 comebacks · median back to work 8 s with the card vs 15 s without (n = 10 / 12) · longest break 1 h 5 m');
  assert.equal(r.iqr, 'IQR with the card 8–8 s · without 15–15 s');
  assert.equal(r.footer, 'Your data, on your device');
  assert.ok(!/productivity/i.test(JSON.stringify(r)));
});

await step('receipt: "Not enough comebacks yet" when either condition has n < 10', () => {
  const r = stats.receiptText(week(10, 9), NOW);
  assert.equal(r.enough, false);
  assert.equal(r.headline, 'This week: 19 comebacks · longest break 3 m');
  assert.equal(r.comparison, 'Not enough comebacks yet for a comparison.');
  assert.equal(r.iqr, '');
});

await step('receipt: debug events and last week never count', () => {
  const lastWeek = new Date(2026, 10, 13, 12, 0).getTime();
  const evs = [...week(3, 3), ev({ debug: true, returnedAt: NOW - MIN }), ev({ returnedAt: lastWeek, awayMs: 500 * MIN })];
  const r = stats.receiptText(evs, NOW);
  assert.match(r.headline, /^This week: 6 comebacks/);
  assert.match(r.headline, /longest break 3 m$/);
});

await step('receipt: n and the n >= 10 check count only comebacks with a first interaction', () => {
  const evs = [...week(10, 10), ev({ condition: 'control', firstSec: null, returnedAt: NOW - 5 * MIN })];
  assert.equal(stats.receiptText(evs, NOW).enough, true);
  assert.match(stats.receiptText(evs, NOW).headline, /^This week: 21 comebacks · .*\(n = 10 \/ 10\)/);
  const short = [...week(10, 9), ev({ condition: 'control', firstSec: null, returnedAt: NOW - 5 * MIN })];
  assert.equal(stats.receiptText(short, NOW).enough, false, 'a comeback with no first interaction does not reach 10');
});

await step('receipt: one comeback, and none at all', () => {
  assert.equal(stats.receiptText(week(1, 0), NOW).headline, 'This week: 1 comeback · longest break 3 m');
  assert.equal(stats.receiptText([], NOW).headline, 'This week: 0 comebacks');
});

// ---------------- CSV ----------------
await step('csv: header has returnVia, plannedBreakMin, nextStepSource and the seconds column', () => {
  for (const c of ['id', 'condition', 'awayBucket', 'secondsToFirstInteraction', 'returnVia', 'plannedBreakMin', 'nextStepSource', 'debug']) {
    assert.ok(csv.CSV_COLUMNS.includes(c), c);
  }
});

await step('csv: older events without the new fields export empty cells', () => {
  const old = { id: 'o1', participant: 'p', threadId: 't', signal: 'tab', leftAt: 1000, returnedAt: 200000, firstInteractionAt: null, condition: 'control', awayBucket: '2-5', taskType: 'writing', debug: false };
  const text = csv.toCsv([old], { t: 'Essay' });
  const [head, row] = text.replace(/^\ufeff/, '').trim().split('\r\n');
  const cols = head.split(',');
  const cells = row.split(',');
  assert.equal(cells.length, cols.length);
  assert.equal(cells[cols.indexOf('returnVia')], '');
  assert.equal(cells[cols.indexOf('plannedBreakMin')], '');
  assert.equal(cells[cols.indexOf('nextStepSource')], '');
  assert.equal(cells[cols.indexOf('task')], 'Essay');
  assert.equal(cells[cols.indexOf('awayMs')], '199000');
  assert.ok(text.startsWith('\ufeff'), 'UTF-8 BOM so Excel reads non-ASCII task names');
});

await step('csv: quotes, commas and formula-looking text are made safe', () => {
  assert.equal(csv.csvCell('a,b'), '"a,b"');
  assert.equal(csv.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csv.csvCell('=1+1'), "'=1+1");
  assert.equal(csv.csvCell('@x'), "'@x");
  assert.equal(csv.csvCell(-3), '-3');
  assert.equal(csv.csvCell(null), '');
  assert.equal(csv.csvCell(['youtube.com', 'reddit.com']), 'youtube.com;reddit.com');
});

// ---------------- sample data ----------------
await step('sample data: deterministic, labelled, both conditions, some debug and some missing', () => {
  const a = sample.sampleEvents(NOW);
  const b = sample.sampleEvents(NOW);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 30);
  assert.ok(a.every((e) => e.participant === 'sample' && e.id.startsWith('sample-')));
  assert.ok(a.some((e) => e.condition === 'pickup') && a.some((e) => e.condition === 'control'));
  assert.ok(a.some((e) => e.debug) && a.some((e) => e.firstInteractionAt === null));
  assert.ok(a.some((e) => e.plannedBreakMin != null) && a.some((e) => e.returnVia === 'resumeKey'));
  const sum = stats.summarize(a);
  assert.equal(sum.pickup.median, sum.control.median, 'sample data must not suggest a result');
  const names = sample.sampleThreadNames();
  assert.ok(a.every((e) => names[e.threadId]));
});

// ---------------- setup helpers ----------------
await step('setup: features default on except readableCard; merge keeps unknown keys', () => {
  assert.deepEqual(setup.featuresOf({}), { readyNote: true, youWereHere: true, videoReplay: true, adaptiveCard: true, readableCard: false, receipt: true });
  const cur = { participant: 'x', voiceEnabled: true, somethingNew: 7, features: { receipt: false, futureFlag: true } };
  const next = setup.mergeSettings(cur, { participant: ' abhi ', workSites: ['https://www.Wikipedia.org/'], distractionSites: ['youtube.com'], awayMin: '3', nudgeMin: '5', debug: false, forceCard: true, features: { readableCard: true } });
  assert.equal(next.participant, 'abhi');
  assert.deepEqual(next.workSites, ['wikipedia.org']);
  assert.equal(next.awayThresholdMs, 180000);
  assert.equal(next.forceCard, false, 'force card needs debug');
  assert.equal(next.voiceEnabled, true);
  assert.equal(next.somethingNew, 7);
  assert.equal(next.features.receipt, false);
  assert.equal(next.features.readableCard, true);
  assert.equal(next.features.futureFlag, true);
  for (const v of Object.values(setup.featuresOf(next))) assert.equal(typeof v, 'boolean');
});

await step('setup: host permissions for https and http (no "*://"); match patterns use "/*" paths', () => {
  assert.deepEqual(setup.originsFor(['docs.google.com/document']), ['https://docs.google.com/*', 'https://*.docs.google.com/*', 'http://docs.google.com/*', 'http://*.docs.google.com/*']);
  assert.deepEqual(setup.matchesFor(['youtube.com/watch']), ['*://youtube.com/*', '*://*.youtube.com/*']);
  assert.equal(setup.cleanSite('not a site'), '');
  assert.equal(setup.cleanSite('HTTPS://www.Example.com/'), 'example.com');
  assert.equal(setup.validate({ workSites: [], distractionSites: [] }), 'Add at least one work site first.');
  assert.equal(setup.validate({ workSites: ['a.com'], distractionSites: ['a.com'] }), 'a.com is in both lists. Keep it in one.');
  assert.equal(setup.validate({ workSites: ['a.com'], distractionSites: ['b.com'] }), '');
});

await step('format: away and ago text are plain facts', () => {
  assert.equal(fmt.awayText(7 * MIN), 'Away 7 min');
  assert.equal(fmt.awayText(65 * MIN), 'Away 1 h 5 min');
  assert.equal(fmt.agoText(NOW - 2 * 3600000, NOW), '2 h ago');
  assert.equal(fmt.stepSourceLabel('selected'), 'Your next step (you picked this)');
  assert.equal(fmt.stepSourceLabel(undefined), 'Your next step (you wrote this)');
});

await step('no page copy uses the word "productivity"', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const files = ['src/shared/stats.js', 'src/shared/pk.css', 'src/shared/tokens.css', ...fs.readdirSync(path.join(root, 'src/pages')).map((f) => `src/pages/${f}`)];
  for (const f of files) assert.ok(!/productivity/i.test(fs.readFileSync(path.join(root, f), 'utf8')), f);
});

console.log(`\n${passed} pages checks passed${process.exitCode ? ' — SOME FAILED' : ''}`);
