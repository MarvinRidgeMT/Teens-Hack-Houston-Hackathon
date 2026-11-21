// Redesign features, engine side: F1 ready-to-resume note, F2 "you were here",
// F3 lecture-video replay, F4 adaptive card chooser, feature flags, Paper badge.
// Pure helpers the content script copies (find-text.js, card-logic.js) are tested here too.
// Run: node test/features.test.mjs  (npm test runs it)

import assert from 'node:assert/strict';
import { makeChrome } from './fake-chrome.mjs';

const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;
const advance = (ms) => { offset += ms; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { chrome, sim } = makeChrome({ now: () => Date.now() });
globalThis.chrome = chrome;
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;
const quiet = process.argv.includes('--verbose') ? null : console.log;
if (quiet) console.log = (...a) => { if (a[0] !== '[Pickup]') quiet(...a); };
const out = quiet || console.log;

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; out(`  ok  ${name}`); } catch (e) { out(`  FAIL ${name}\n`, e); process.exitCode = 1; }
}

await import('../src/sw/background.js');
const store = await import('../src/shared/store.js');
const C = await import('../src/shared/constants.js');
const F = await import('../src/shared/find-text.js');
const L = await import('../src/shared/card-logic.js');
const flush = async () => { for (let i = 0; i < 6; i++) { await store.serial(() => null); await sleep(3); } };
const crumbOf = async (id) => ((await chrome.storage.local.get('breadcrumbs')).breadcrumbs || {})[id];
const SETTINGS = {
  participant: 'anish', workSites: ['docs.google.com', 'wikipedia.org', 'lectures.example.edu'], distractionSites: ['youtube.com'],
  awayThresholdMs: 120000, nudgeDelayMin: 5, debug: true, forceCard: true,
};
const setSettings = async (patch = {}) => { await chrome.storage.local.set({ settings: { ...SETTINGS, ...patch } }); await flush(); };

await setSettings();
sim.setContentSites(['docs.google.com', 'wikipedia.org', 'lectures.example.edu']);
const WIKI = 'https://en.wikipedia.org/wiki/Drought';
const LECT = 'https://lectures.example.edu/week3';
const YT = 'https://www.youtube.com/watch?v=x';
const wiki = sim.openTab(WIKI); await flush();
const thread = (await sim.send({ type: 'startTask', tabId: wiki, name: 'Drought Essay' })).thread;
sim.setPage(wiki, 900, 'rainfall below average since 2023');
const yt = sim.openTab(YT, { active: false }); await flush();
sim.activate(wiki); await flush();

// Leave the task for longer than the debug threshold and come back.
async function leaveAndReturn(tab, ms = 11000) {
  sim.activate(yt); await flush();
  advance(ms);
  sim.activate(tab); await flush(); await sleep(5); await flush();
}
const lastOfType = (t) => sim.sentOfType(t).at(-1);

// ---------- F1 ----------
await step('F1: parkNote stores stoppedAt and stuckOn on the breadcrumb, capped at 120 characters', async () => {
  const long = 'x'.repeat(150);
  const r = await sim.send({ type: 'parkNote', nextStep: 'write the second paragraph', stoppedAt: long, stuckOn: 'which source for 1936' }, wiki); await flush();
  assert.equal(r.ok, true);
  const c = await crumbOf(thread.id);
  assert.equal(c.nextStep, 'write the second paragraph');
  assert.equal(c.nextStepSource, 'typed');
  assert.equal(c.stoppedAt.length, 120);
  assert.equal(c.stuckOn, 'which source for 1936');
});

await step('F1: the card carries stopped at, next step and stuck on, plus the feature flags', async () => {
  await leaveAndReturn(wiki);
  const card = lastOfType('showCard');
  assert.ok(card, 'card sent');
  assert.equal(card.nextStep, 'write the second paragraph');
  assert.equal(card.stoppedAt.length, 120);
  assert.equal(card.stuckOn, 'which source for 1936');
  assert.equal(card.features.readyNote, true);
  assert.equal(card.features.readableCard, false);
});

await step('F1: a plan needs a next step: stoppedAt/stuckOn without one are not stored', async () => {
  const { nextStep, nextStepSource, stoppedAt, stuckOn, ...bare } = await crumbOf(thread.id);
  await store.putBreadcrumb(bare); // no plan yet (an empty Alt+P keeps an existing plan, like the next step)
  await sim.send({ type: 'parkNote', nextStep: '', stoppedAt: 'Causes section', stuckOn: 'nothing' }, wiki); await flush();
  const c = await crumbOf(thread.id);
  assert.equal(c.stoppedAt, undefined);
  assert.equal(c.stuckOn, undefined);
  await leaveAndReturn(wiki);
});

await step('F1: old breadcrumbs (next step only) give a card with no stoppedAt/stuckOn keys', async () => {
  const c = await crumbOf(thread.id);
  const { stoppedAt, stuckOn, ...old } = c;
  await store.putBreadcrumb({ ...old, nextStep: 'old step', nextStepSource: 'typed' });
  await leaveAndReturn(wiki);
  const card = lastOfType('showCard');
  assert.equal(card.nextStep, 'old step');
  assert.ok(!('stoppedAt' in card) && !('stuckOn' in card));
});

await step('F1: the plan belongs to its next step: a different typed step drops it, the same step keeps it', async () => {
  await sim.send({ type: 'parkNote', nextStep: 'first', stoppedAt: 'Causes', stuckOn: 'a date' }, wiki); await flush();
  await sim.send({ type: 'setNextStep', threadId: thread.id, nextStep: 'first' }); await flush();
  let c = await crumbOf(thread.id);
  assert.equal(c.stoppedAt, 'Causes', 'same step: plan kept');
  await sim.send({ type: 'setNextStep', threadId: thread.id, nextStep: 'second' }); await flush();
  c = await crumbOf(thread.id);
  assert.equal(c.nextStep, 'second');
  assert.equal(c.stoppedAt, undefined);
  assert.equal(c.stuckOn, undefined);
  await leaveAndReturn(wiki);
});

await step('F1: clearing the next step clears the plan; retyping does not bring it back', async () => {
  await sim.send({ type: 'parkNote', nextStep: 'A', stoppedAt: 'para 2', stuckOn: 'the 1936 source' }, wiki); await flush();
  await sim.send({ type: 'setNextStep', threadId: thread.id, nextStep: '' }); await flush();
  let c = await crumbOf(thread.id);
  assert.ok(!('stoppedAt' in c) && !('stuckOn' in c) && !('nextStep' in c));
  await sim.send({ type: 'setNextStep', threadId: thread.id, nextStep: 'brand new step' }); await flush();
  await leaveAndReturn(wiki);
  const card = lastOfType('showCard');
  assert.equal(card.nextStep, 'brand new step');
  assert.ok(!('stoppedAt' in card) && !('stuckOn' in card));
});

await step('F1: a stray plan on a breadcrumb with no next step is never sent', async () => {
  const { nextStep, nextStepSource, ...rest } = await crumbOf(thread.id);
  await store.putBreadcrumb({ ...rest, stoppedAt: 'stray', stuckOn: 'stray' });
  await leaveAndReturn(wiki);
  const card = lastOfType('showCard');
  assert.ok(!('stoppedAt' in card) && !('stuckOn' in card));
});

// ---------- F2 ----------
await step('F2: Resume sends restoreScroll with the saved highlight (and scrollY)', async () => {
  sim.setPage(wiki, 1200, 'the 1930s Dust Bowl');
  sim.activate(yt); await flush(); advance(11000);
  await sim.send({ type: 'resumeTask', threadId: thread.id }); await flush(); await sleep(5); await flush();
  const m = lastOfType('restoreScroll');
  assert.equal(m.scrollY, 1200);
  assert.equal(m.highlight, 'the 1930s Dust Bowl');
});

await step('F2: with youWereHere off, restoreScroll carries only scrollY', async () => {
  await setSettings({ features: { youWereHere: false } });
  sim.activate(yt); await flush(); advance(11000);
  await sim.send({ type: 'resumeTask', threadId: thread.id }); await flush(); await sleep(5); await flush();
  const m = lastOfType('restoreScroll');
  assert.equal(m.scrollY, 1200);
  assert.ok(!('highlight' in m));
  await setSettings();
});

const PAGE = 'Drought is a long dry period. In the 1930s the Dust Bowl hit the Plains. Later, in the 1950s, '
  + 'another drought came. The Dust Bowl was the worst. Farmers left.';
const yAt = (i) => i * 10; // fake layout: 10 px per character
await step('F2 find: exact text is found', () => {
  const m = F.locateHighlight(PAGE, 'the Dust Bowl hit the Plains', { yAt, savedY: 0 });
  assert.equal(PAGE.slice(m.start, m.end), 'the Dust Bowl hit the Plains');
  assert.equal(m.kind, 'full');
});
await step('F2 find: whitespace and case differences still match the full text', () => {
  const m = F.locateHighlight('In the 1930s the\n  Dust   Bowl hit', 'the dust bowl HIT', { yAt, savedY: 0 });
  assert.equal(m.kind, 'full');
  assert.equal('In the 1930s the\n  Dust   Bowl hit'.slice(m.start, m.end), 'the\n  Dust   Bowl hit');
});
await step('F2 find: changed text falls back to a ~60-character prefix match', () => {
  const saved = 'In the 1930s the Dust Bowl hit the Plains and stayed for ten long years, said the old report';
  const page = 'Intro. In the 1930s the Dust Bowl hit the Plains and stayed for a decade. End.';
  const m = F.locateHighlight(page, saved, { yAt, savedY: 0 });
  assert.equal(m.kind, 'prefix');
  assert.ok(page.slice(m.start).startsWith('In the 1930s the Dust Bowl'));
});
await step('F2 find: duplicate text picks the occurrence nearest the saved scrollY', () => {
  const first = PAGE.indexOf('The Dust Bowl');
  const a = F.locateHighlight(PAGE, 'Dust Bowl', { yAt, savedY: yAt(PAGE.lastIndexOf('Dust Bowl')) });
  assert.equal(a.start, PAGE.lastIndexOf('Dust Bowl'));
  const b = F.locateHighlight(PAGE, 'Dust Bowl', { yAt, savedY: 0 });
  assert.equal(b.start, PAGE.indexOf('Dust Bowl'));
  assert.ok(first > 0);
});
await step('F2 find: text not on the page gives null (the caller restores scrollY only)', () => {
  assert.equal(F.locateHighlight(PAGE, 'photosynthesis in leaves', { yAt, savedY: 0 }), null);
  assert.equal(F.locateHighlight(PAGE, '', { yAt, savedY: 0 }), null);
  assert.equal(F.locateHighlight(PAGE, 'a', { yAt, savedY: 0 }), null, 'too short to be a real highlight');
});
await step('F2 find: a highlight across two paragraphs matches text joined without a separator', () => {
  const m = F.locateHighlight('the end.Start of next part', 'end.\n\nStart of', { yAt, savedY: 0 });
  assert.ok(m, 'found');
  assert.equal('the end.Start of next part'.slice(m.start, m.end), 'end.Start of');
});
await step('F2 find: rawIndexToNode with no nodes gives null', () => {
  assert.equal(F.rawIndexToNode([], 3), null);
});
await step('F2 find: Google Docs (canvas) skips the text search', () => {
  assert.equal(F.canSearchText('https://docs.google.com/document/d/abc/edit'), false);
  assert.equal(F.canSearchText('https://en.wikipedia.org/wiki/Drought'), true);
});
await step('F2 find: rawIndexToNode maps a page index to a text node and offset', () => {
  const starts = [0, 5, 12, 30];
  assert.deepEqual(F.rawIndexToNode(starts, 0), { node: 0, offset: 0 });
  assert.deepEqual(F.rawIndexToNode(starts, 7), { node: 1, offset: 2 });
  assert.deepEqual(F.rawIndexToNode(starts, 30), { node: 3, offset: 0 });
  assert.deepEqual(F.rawIndexToNode(starts, 45), { node: 3, offset: 15 });
});

// ---------- F3 ----------
const lect = sim.openTab(LECT); await flush();
const lthread = (await sim.send({ type: 'startTask', tabId: lect, name: 'Bio lecture' })).thread;
await step('F3: a playing video past 5 s is stored on the breadcrumb and sent on Resume', async () => {
  sim.setPage(lect, 300, '', { video: { currentTime: 770.4, duration: 3000, src: LECT } });
  await leaveAndReturn(lect, 11000); // leaving writes the breadcrumb
  const c = await crumbOf(lthread.id);
  assert.deepEqual(c.video, { currentTime: 770.4, duration: 3000, src: LECT });
  sim.activate(yt); await flush(); advance(11000);
  await sim.send({ type: 'resumeTask', threadId: lthread.id }); await flush(); await sleep(5); await flush();
  const m = lastOfType('restoreScroll');
  assert.deepEqual(m.video, { currentTime: 770.4, duration: 3000, src: LECT });
  await leaveAndReturn(lect);
});
await step('F3: a video under 5 s, a bad value, or videoReplay off is not stored', async () => {
  sim.setPage(lect, 300, '', { video: { currentTime: 3, duration: 3000, src: LECT } });
  await leaveAndReturn(lect);
  assert.equal((await crumbOf(lthread.id)).video, undefined);
  sim.setPage(lect, 300, '', { video: { currentTime: 'abc', duration: 3000, src: LECT } });
  await leaveAndReturn(lect);
  assert.equal((await crumbOf(lthread.id)).video, undefined);
  await setSettings({ features: { videoReplay: false } });
  sim.setPage(lect, 300, '', { video: { currentTime: 900, duration: 3000, src: LECT } });
  await leaveAndReturn(lect);
  assert.equal((await crumbOf(lthread.id)).video, undefined);
  await setSettings();
});
await step('F3: cleanVideo rejects a non-string src, a time past the duration, and absurd times', async () => {
  const E = await import('../src/sw/events.js');
  const S = { features: {} };
  assert.equal(E.cleanVideo({ currentTime: 50, duration: 100, src: { a: 1 } }, S), null);
  assert.equal(E.cleanVideo({ currentTime: 1e12, duration: 30, src: LECT }, S), null);
  assert.equal(E.cleanVideo({ currentTime: 1e9, duration: null, src: LECT }, S), null);
  assert.deepEqual(E.cleanVideo({ currentTime: 50, duration: 100, src: LECT }, S), { currentTime: 50, duration: 100, src: LECT });
});
await step('F3: the video goes only to the exact page it came from (?v= changed: no video)', async () => {
  const E = await import('../src/sw/events.js');
  const crumb = { scrollY: 5, highlight: 'hi there', url: 'https://www.youtube.com/watch?v=A', video: { currentTime: 2050, duration: 3000, src: 'https://www.youtube.com/watch?v=A' } };
  assert.ok(E.restoreMsg(crumb, {}, 'https://www.youtube.com/watch?v=A').video);
  assert.equal(E.restoreMsg(crumb, {}, 'https://www.youtube.com/watch?v=B').video, undefined);
  assert.equal(E.restoreMsg(crumb, {}).video, undefined, 'unknown tab URL: no video');
});

await step('F3 maths: replay 10 s back, never below 0; clock text; chip text', () => {
  assert.equal(C.VIDEO_REPLAY_SEC, 10);
  assert.equal(L.replayFrom(770.4), 760.4);
  assert.equal(L.replayFrom(4), 0);
  assert.equal(L.clockText(760), '12:40');
  assert.equal(L.clockText(3725), '1:02:05');
  assert.equal(L.videoChipText(770), 'Replaying from 12:40 · you left at 12:50 · Space to play');
});

// ---------- F4 ----------
await step('F4: the card variant comes only from awayMs (compact under 5 min)', () => {
  assert.equal(C.COMPACT_AWAY_MS, 300000);
  assert.equal(L.cardVariant(299999), 'compact');
  assert.equal(L.cardVariant(300000), 'full');
  assert.equal(L.cardVariant(8 * 3600e3), 'full');
  assert.equal(L.cardVariant(12000, { startHere: true }), 'startHere');
  assert.equal(L.cardVariant(10000, { adaptive: false }), 'full', 'adaptiveCard off: always the full card');
});
await step('F4: the re-entry checklist is made only of the user\'s own text', () => {
  assert.deepEqual(L.checklistItems({ stoppedAt: 'Causes', nextStep: 'write para 2', stuckOn: 'a date' }),
    ['Re-read where I stopped', 'write para 2', 'Look at: a date']);
  assert.deepEqual(L.checklistItems({ nextStep: 'write para 2' }), ['write para 2']);
  assert.deepEqual(L.checklistItems({}), []);
});
await step('F4: compact line uses the task, the next step and the keys', () => {
  assert.equal(L.compactLine({ threadName: 'Drought Essay', nextStep: 'write para 2' }), 'Back to Drought Essay · Next: write para 2 · Resume ↵ · Esc');
  assert.equal(L.compactLine({ threadName: 'Drought Essay' }), 'Back to Drought Essay · Resume ↵ · Esc');
});
await step('F1 helper: the Stopped at default is the page title and nearest heading, capped at 120', () => {
  assert.equal(L.stoppedAtDefault('Drought - Wikipedia', 'Causes'), 'Drought - Wikipedia › Causes');
  assert.equal(L.stoppedAtDefault('Drought - Wikipedia', ''), 'Drought - Wikipedia');
  assert.equal(L.stoppedAtDefault('t'.repeat(200), 'h').length, 120);
});

await step('F1/F4: the Start here message carries the plan and the feature flags', async () => {
  sim.activate(wiki); await flush();
  await sim.send({ type: 'parkNote', nextStep: 'outline part 3', stoppedAt: 'Effects', stuckOn: 'a map' }, wiki); await flush();
  await sim.send({ type: 'wrapUp', tabId: wiki, nextStep: 'outline part 3' }); await flush();
  const W = await import('../src/sw/wrapup.js');
  await W.onStartHereClicked(thread.id); await flush();
  const m = lastOfType('startHere');
  assert.equal(m.nextStep, 'outline part 3');
  assert.equal(m.stoppedAt, 'Effects');
  assert.equal(m.stuckOn, 'a map');
  assert.equal(m.features.adaptiveCard, true);
});

// ---------- flags, badge ----------
await step('Feature flags default on (readable card off); a partial settings.features keeps the rest', async () => {
  assert.deepEqual(C.featuresOf({}), { readyNote: true, youWereHere: true, videoReplay: true, adaptiveCard: true, readableCard: false, receipt: true });
  assert.equal(C.featuresOf({ features: { videoReplay: false } }).youWereHere, true);
  assert.equal(C.featuresOf({ features: { videoReplay: false } }).videoReplay, false);
});
await step('Badge colours are the Warm Desk, Teal Spark light state values; glyphs unchanged', () => {
  assert.equal(C.BADGE.parked.color, '#5b4be0');
  assert.equal(C.BADGE.away.color, '#5c6170');
  assert.equal(C.BADGE.wrapped.color, '#1e2230');
  assert.equal(C.BADGE.timer.color, '#5b4be0');
  assert.equal(C.BADGE.flash['✓'], '#0d7c72');
  assert.equal(C.BADGE.flash.default, '#5c6170');
  assert.deepEqual([C.BADGE.parked.text, C.BADGE.away.text, C.BADGE.wrapped.text], ['P', '•', '☾']);
});

// ---------- fonts ----------
{
  const { spawnSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const check = new URL('./check-integration.mjs', import.meta.url).pathname;
  const run = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickup-font-fixture-'));
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    const r = spawnSync(process.execPath, [check, '--src', dir], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    return r.stdout.split('\n').filter((l) => l.includes('[fonts]')).join('\n');
  };
  await step('check-integration FAILs any Google Fonts reference and passes the bundled Inter', () => {
    assert.match(run({ 'a.html': '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">' }), /FAIL.*fonts\.googleapis\.com/);
    assert.match(run({ 'b.js': 'const u = "//fonts.gstatic.com/s/inter/v1.woff2";' }), /FAIL.*fonts\.gstatic\.com/);
    assert.match(run({ 'c.css': '@font-face { font-family: Inter; src: url("../../assets/fonts/InterVariable.woff2"); }' }), /ok.*no Google Fonts/);
  });
  await step('Inter is bundled with its OFL licence', () => {
    const root = new URL('..', import.meta.url).pathname;
    assert.ok(fs.statSync(path.join(root, 'assets/fonts/InterVariable.woff2')).size > 100000);
    assert.match(fs.readFileSync(path.join(root, 'assets/fonts/OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  });
}

out(`\n${passed} feature checks passed`);
