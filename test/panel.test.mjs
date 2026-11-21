// Pickup panel checks: break timer (startBreak / cancelBreak / break-over alarm),
// task list (listThreads), setNextStep, returnVia 'panel' and 'timer', badge countdown.
// Run: node test/panel.test.mjs  (npm test runs it after the voice checks)

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
const flush = async () => { for (let i = 0; i < 6; i++) { await store.serial(() => null); await sleep(3); } };
const events = async () => (await chrome.storage.local.get('events')).events || [];
const lastEvent = async () => (await events()).at(-1);
const crumbs = async () => (await chrome.storage.local.get('breadcrumbs')).breadcrumbs || {};
const ob = () => store.getOpenBreak();
const send = (msg) => sim.send(msg); // from the panel (no tab); use sim.send(msg, tabId) for a page
const badgeNow = async () => { await flush(); await sleep(5); await flush(); return { ...sim.badge }; };
const breakNotes = () => sim.notifications.filter((n) => n.id.startsWith('breakend:'));
const SETTINGS = {
  participant: 'anish', workSites: ['docs.google.com', 'wikipedia.org'], distractionSites: ['youtube.com'],
  awayThresholdMs: 120000, nudgeDelayMin: 5, debug: false, forceCard: false,
};
const setDebug = async (on) => { await chrome.storage.local.set({ settings: { ...SETTINGS, debug: on } }); await flush(); };

await chrome.storage.local.set({ settings: SETTINGS });
sim.setContentSites(['docs.google.com', 'wikipedia.org']);
const DOC = 'https://docs.google.com/document/d/drought/edit';
const YT = 'https://www.youtube.com/watch?v=x';
const doc = sim.openTab(DOC); await flush();
const thread = (await send({ type: 'startTask', tabId: doc, name: 'Drought Essay' })).thread;
sim.setPage(doc, 900, 'rainfall below average since 2023');
const yt = sim.openTab(YT, { active: false }); await flush();
sim.activate(doc); await flush();

// Back on the task with nothing open, alarms and notifications cleared.
async function settle() {
  const b = await ob();
  if (b) { sim.activate(yt); await flush(); advance(10); sim.activate(doc); await flush(); }
  if (await ob()) { await chrome.storage.local.set({ openBreak: null }); await flush(); }
  sim.activate(doc); await flush();
  sim.notifications.length = 0;
}

await step('Ask "where was I" right after starting a task (no breadcrumb yet) names the task', async () => {
  const r = await send({ type: 'voiceCommand', intent: 'whereWasI', args: {}, via: 'panel' });
  assert.equal(r.say, 'You were on Drought Essay.');
});

// ---------------- break timer ----------------
await step('startBreak on the work tab parks the task with a plan, an alarm and no drift nudge', async () => {
  const before = Date.now();
  const r = await send({ type: 'startBreak', minutes: 10, nextStep: 'Find a source for the drought statistic', tabId: doc });
  await flush();
  assert.equal(r.ok, true);
  assert.equal(r.threadId, thread.id);
  assert.ok(Math.abs(r.endsAt - (before + 10 * 60000)) < 2000, 'ends in 10 min');
  const b = await ob();
  assert.equal(b.signal, 'park');
  assert.equal(b.departed, false);
  assert.equal(b.plannedMin, 10);
  assert.equal(b.endsAt, r.endsAt);
  assert.ok(sim.alarms.has('breakend:' + b.eventId), 'break-over alarm');
  const c = (await crumbs())[thread.id];
  assert.equal(c.nextStep, 'Find a source for the drought statistic');
  assert.equal(c.nextStepSource, 'typed');
});

await step('badge shows the minutes left, with the end time in the tooltip', async () => {
  const b = await badgeNow();
  assert.equal(b.text, '10m');
  assert.match(b.title, /^Pickup: back to Drought Essay at \d{1,2}:\d{2}/);
  advance(4 * 60000 + 10000);
  await chrome.storage.local.set({ openBreak: await ob() }); // any write redraws (the tick alarm does it in Chrome)
  assert.equal((await badgeNow()).text, '6m');
});

await step('leaving during a planned break schedules no drift nudge (one notification per break)', async () => {
  sim.activate(yt); await flush();
  const b = await ob();
  assert.equal(b.departed, true);
  assert.equal(b.plannedMin, 10, 'plan survives leaving');
  assert.ok(!sim.alarms.has('nudge:' + b.eventId), 'no nudge alarm');
});

await step('the break-over alarm shows one notification; clicking it returns with returnVia timer', async () => {
  const b = await ob();
  advance(6 * 60000);
  sim.fireAlarm('breakend:' + b.eventId); await flush();
  const notes = breakNotes();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 'breakend:' + b.eventId);
  assert.equal(notes[0].title, "Break's over: Drought Essay");
  assert.equal(notes[0].message, 'Next: Find a source for the drought statistic · Alt+R takes you back');
  sim.fireAlarm('breakend:' + b.eventId); await flush();
  assert.equal(breakNotes().length, 1, 'never twice');
  chrome.notifications.onClicked.fire('breakend:' + b.eventId); await flush();
  const ev = await lastEvent();
  assert.equal(ev.id, b.eventId);
  assert.equal(ev.returnVia, 'timer');
  assert.equal(ev.plannedBreakMin, 10);
  assert.equal(sim.tabs.get(doc).active, true);
  assert.equal(await ob(), null);
});

await step('coming back early: event keeps plannedBreakMin, and the alarm shows nothing later', async () => {
  await settle();
  await send({ type: 'startBreak', minutes: 15, tabId: doc }); await flush();
  const b = await ob();
  sim.activate(yt); await flush();
  advance(5 * 60000);
  sim.activate(doc); await flush();
  const ev = await lastEvent();
  assert.equal(ev.id, b.eventId);
  assert.equal(ev.plannedBreakMin, 15);
  assert.equal(ev.returnVia, 'tab');
  assert.ok(!sim.alarms.has('breakend:' + b.eventId), 'alarm cleared on return');
  sim.notifications.length = 0;
  chrome.alarms.onAlarm.fire({ name: 'breakend:' + b.eventId }); await flush();
  assert.equal(breakNotes().length, 0);
});

await step('cancelBreak clears the plan and the alarm; the break stays open', async () => {
  await settle();
  await send({ type: 'startBreak', minutes: 10, tabId: doc }); await flush();
  sim.activate(yt); await flush();
  const b = await ob();
  const r = await send({ type: 'cancelBreak' }); await flush();
  assert.equal(r.ok, true);
  const after = await ob();
  assert.ok(after, 'break still open');
  assert.equal(after.eventId, b.eventId);
  assert.equal(after.plannedMin, undefined);
  assert.equal(after.endsAt, undefined);
  assert.ok(!sim.alarms.has('breakend:' + b.eventId));
  assert.equal((await send({ type: 'cancelBreak' })).ok, false, 'nothing to cancel');
  advance(3 * 60000);
  sim.activate(doc); await flush();
  assert.equal((await lastEvent()).plannedBreakMin, null, 'a cancelled plan is not a planned break');
});

await step('startBreak from YouTube during a break plans that break (keeps when you left)', async () => {
  await settle();
  sim.activate(yt); await flush();
  const b = await ob();
  advance(60000);
  const r = await send({ type: 'startBreak', minutes: 5 }); await flush();
  assert.equal(r.ok, true);
  const after = await ob();
  assert.equal(after.eventId, b.eventId);
  assert.equal(after.leftAt, b.leftAt);
  assert.equal(after.plannedMin, 5);
  assert.ok(!sim.alarms.has('nudge:' + b.eventId));
});

await step('startBreak rejects minutes outside 1-120; debug counts a minute as 10 s', async () => {
  await settle();
  assert.equal((await send({ type: 'startBreak', minutes: 0, tabId: doc })).ok, false);
  assert.equal((await send({ type: 'startBreak', minutes: 121, tabId: doc })).ok, false);
  assert.equal(await ob(), null);
  await setDebug(true);
  const before = Date.now();
  const r = await send({ type: 'startBreak', minutes: 10, tabId: doc }); await flush();
  assert.ok(Math.abs(r.endsAt - (before + 100000)) < 2000, '10 "min" = 100 s in debug');
  assert.equal((await ob()).plannedMin, 10);
  await send({ type: 'cancelBreak' });
  await setDebug(false);
});

// Review fixes: one notification per break, whatever the order
await step('review: nudge already shown, then a timer: no second notification', async () => {
  await settle();
  await sim.send({ type: 'parkNote', nextStep: 'Check the rainfall table' }, doc); await flush();
  sim.activate(yt); await flush();
  const b = await ob();
  advance(6 * 60000);
  sim.fireAlarm('nudge:' + b.eventId); await flush();
  assert.equal(sim.notifications.filter((n) => n.id === b.eventId).length, 1, 'nudge shown');
  const r = await send({ type: 'startBreak', minutes: 5 }); await flush();
  assert.equal(r.ok, true);
  assert.equal(r.notify, false, 'already reminded this break');
  advance(6 * 60000);
  chrome.alarms.onAlarm.fire({ name: 'breakend:' + b.eventId }); await flush();
  assert.equal(breakNotes().length, 0);
});

await step('review: a second timer on the same break never shows a second "Break\'s over"', async () => {
  await settle();
  await send({ type: 'startBreak', minutes: 5, tabId: doc }); await flush();
  sim.activate(yt); await flush();
  const b = await ob();
  advance(6 * 60000);
  sim.fireAlarm('breakend:' + b.eventId); await flush();
  assert.equal(breakNotes().length, 1);
  const r = await send({ type: 'startBreak', minutes: 5 }); await flush();
  assert.equal(r.notify, false);
  assert.equal((await ob()).breakOverShown, true, 'flag kept');
  advance(6 * 60000);
  chrome.alarms.onAlarm.fire({ name: 'breakend:' + b.eventId }); await flush();
  assert.equal(breakNotes().length, 1);
});

await step('review: "cancel the break" before leaving cancels the timer (no notification later)', async () => {
  await settle();
  await send({ type: 'startBreak', minutes: 10, tabId: doc }); await flush();
  const b = await ob();
  assert.equal(b.departed, false);
  const r = await send({ type: 'voiceCommand', intent: 'cancelBreak', args: {}, via: 'panel' }); await flush();
  assert.equal(r.say, 'Break timer cancelled.');
  assert.equal((await ob()).plannedMin, undefined);
  assert.ok(!sim.alarms.has('breakend:' + b.eventId));
});

await step('review: "I\'m back early" with no timer is an ordinary "I\'m back"', async () => {
  await settle();
  sim.activate(yt); await flush();
  advance(3 * 60000);
  const r = await send({ type: 'voiceCommand', intent: 'cancelBreak', args: { early: true }, via: 'panel' }); await flush();
  assert.equal(r.say, 'Taking you back to Drought Essay.');
  assert.equal((await lastEvent()).returnVia, 'panel');
});

await step('review: a nudge alarm that fires after a timer started shows nothing', async () => {
  await settle();
  await sim.send({ type: 'parkNote', nextStep: 'Check the rainfall table' }, doc); await flush();
  sim.activate(yt); await flush();
  const b = await ob();
  await send({ type: 'startBreak', minutes: 10 }); await flush();
  chrome.alarms.onAlarm.fire({ name: 'nudge:' + b.eventId }); await flush(); // already in flight
  assert.equal(sim.notifications.filter((n) => n.id === b.eventId).length, 0);
});

await step('review: browser restart re-creates the break-over alarm from endsAt', async () => {
  await settle();
  await send({ type: 'startBreak', minutes: 10, tabId: doc }); await flush();
  const b = await ob();
  sim.alarms.clear();
  chrome.runtime.onStartup.fire(); await flush();
  assert.ok(sim.alarms.has('breakend:' + b.eventId), 'alarm restored');
  await send({ type: 'cancelBreak' }); await flush();
});

// ---------------- task list ----------------
await step('listThreads: newest first, auto threads only with a breadcrumb, named "Untitled (from host)"', async () => {
  await settle();
  const wiki = sim.openTab('https://en.wikipedia.org/wiki/Drought'); await flush();
  await send({ type: 'startTask', tabId: wiki, name: 'Bio Lab' }); await flush();
  const gard = sim.openTab('https://en.wikipedia.org/wiki/Gardening'); await flush();
  await sim.send({ type: 'parkNote', nextStep: 'Read the soil section' }, gard); await flush(); // auto thread with a breadcrumb
  const list = await send({ type: 'listThreads' });
  assert.ok(Array.isArray(list));
  const names = list.map((t) => t.name);
  assert.ok(names.includes('Drought Essay'));
  assert.ok(names.includes('Untitled (from en.wikipedia.org)'), names.join(', '));
  const auto = list.find((t) => t.name.startsWith('Untitled'));
  assert.equal(auto.nextStep, 'Read the soil section');
  assert.equal(auto.isParked, true, 'parked, not left yet');
  for (let i = 1; i < list.length; i++) assert.ok((list[i - 1].sortAt || 0) >= (list[i].sortAt || 0), 'sorted newest first');
  const essay = list.find((t) => t.name === 'Drought Essay');
  for (const k of ['threadId', 'name', 'taskType', 'url', 'tabCount', 'isOpenBreak', 'isParked', 'isWrapped']) assert.ok(k in essay, k);
  assert.equal(essay.tabCount, 1);
  sim.closeTab(gard); sim.closeTab(wiki); await flush();
  await chrome.storage.local.set({ openBreak: null }); await flush();
});

await step('listThreads marks the task you are away from and the one saved for tomorrow', async () => {
  await settle();
  sim.activate(yt); await flush();
  let essay = (await send({ type: 'listThreads' })).find((t) => t.threadId === thread.id);
  assert.equal(essay.isOpenBreak, true);
  assert.ok(essay.awaySince > 0);
  await settle();
  await send({ type: 'wrapUp', tabId: doc }); await flush();
  essay = (await send({ type: 'listThreads' })).find((t) => t.threadId === thread.id);
  assert.equal(essay.isWrapped, true);
  await chrome.storage.local.set({ wrapUp: null }); await flush();
});

await step('setNextStep stores the typed words on the task, keeping the rest of the breadcrumb', async () => {
  const before = (await crumbs())[thread.id];
  const r = await send({ type: 'setNextStep', threadId: thread.id, nextStep: '  Outline paragraph two  ' }); await flush();
  assert.equal(r.ok, true);
  const c = (await crumbs())[thread.id];
  assert.equal(c.nextStep, 'Outline paragraph two');
  assert.equal(c.nextStepSource, 'typed');
  assert.equal(c.url, before.url);
  assert.equal((await send({ type: 'setNextStep', threadId: 'nope', nextStep: 'x' })).ok, false);
});

// ---------------- returnVia 'panel' ----------------
await step('resumeTask with via panel logs returnVia panel; any other via falls back to resumeKey', async () => {
  await settle();
  sim.activate(yt); await flush();
  advance(3 * 60000);
  await send({ type: 'resumeTask', threadId: thread.id, via: 'panel' }); await flush();
  assert.equal((await lastEvent()).returnVia, 'panel');
  sim.activate(yt); await flush();
  advance(3 * 60000);
  await send({ type: 'resumeTask', threadId: thread.id, via: 'timer' }); await flush();
  assert.equal((await lastEvent()).returnVia, 'resumeKey', 'only panel may be chosen by the caller');
});

await step('typed Ask "take me back" (via panel) logs returnVia panel; spoken stays voice', async () => {
  await settle();
  sim.activate(yt); await flush();
  advance(3 * 60000);
  const r = await send({ type: 'voiceCommand', intent: 'resume', args: {}, via: 'panel' }); await flush();
  assert.equal(r.say, 'Taking you back to Drought Essay.');
  assert.equal((await lastEvent()).returnVia, 'panel');
  sim.activate(yt); await flush();
  advance(3 * 60000);
  await send({ type: 'voiceCommand', intent: 'resume', args: {} }); await flush();
  assert.equal((await lastEvent()).returnVia, 'voice');
});

await step('Ask "back in 10" starts the timer; "cancel the break" then takes you back', async () => {
  await settle();
  const r = await send({ type: 'voiceCommand', intent: 'breakTimer', args: { minutes: 10 }, via: 'panel' }); await flush();
  assert.match(r.say, /^Break started\. Back to Drought Essay at \d{1,2}:\d{2}/);
  assert.equal((await ob()).plannedMin, 10);
  sim.activate(yt); await flush();
  advance(3 * 60000);
  const c = await send({ type: 'voiceCommand', intent: 'cancelBreak', args: {}, via: 'panel' }); await flush();
  assert.equal(c.say, 'Taking you back to Drought Essay.');
  const ev = await lastEvent();
  assert.equal(ev.returnVia, 'panel');
  assert.equal(ev.plannedBreakMin, 10);
  assert.equal((await send({ type: 'voiceCommand', intent: 'cancelBreak', args: {} })).say, "There's no break timer running.");
  assert.equal((await send({ type: 'voiceCommand', intent: 'breakTimer', args: {} })).say, 'Say how many minutes, from 1 to 120.');
  await settle();
});

await step('today facts for the panel strip: breaks, median, most time away by site (debug left out)', async () => {
  const r = await send({ type: 'voiceCommand', intent: 'today', args: {} });
  assert.ok(r.data && r.data.today, 'structured facts for the strip');
  const t = r.data.today;
  assert.ok(t.breaks >= 1);
  assert.equal(t.topHost && t.topHost.host, 'youtube.com');
  assert.ok(t.topHost.awayMs > 0);
});

out(`\n${passed} panel checks passed`);
