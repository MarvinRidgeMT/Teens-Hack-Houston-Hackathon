// Engine-side walk through the Gate test (steps 1-10) against a fake Chrome.
// Run: node test/engine.test.mjs

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

await import('../src/sw/background.js');
const store = await import('../src/shared/store.js');
const flush = async () => { for (let i = 0; i < 6; i++) { await store.serial(() => null); await sleep(3); } };

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; quiet ? quiet(`  ok  ${name}`) : console.log(`  ok  ${name}`); }
  catch (e) { (quiet || console.log)(`  FAIL ${name}\n`, e); process.exitCode = 1; }
}
const events = async () => (await chrome.storage.local.get('events')).events || [];
const ob = async () => (await chrome.storage.local.get('openBreak')).openBreak || null;
const lastEvent = async () => (await events()).at(-1);

// Setup (Abhinav's setup page writes this)
await chrome.storage.local.set({ settings: {
  participant: 'anish', workSites: ['docs.google.com', 'wikipedia.org'], distractionSites: ['youtube.com'],
  awayThresholdMs: 120000, nudgeDelayMin: 5, debug: false, forceCard: false,
} });
sim.setContentSites(['docs.google.com', 'wikipedia.org']);

const DOC = 'https://docs.google.com/document/d/essay/edit';
const WIKI_A = 'https://en.wikipedia.org/wiki/Drought';
const WIKI_B = 'https://en.wikipedia.org/wiki/Rainfall';
const YT = 'https://www.youtube.com/watch?v=x';

let doc, wikiA, wikiB, yt, thread;

await step('1. Start task "Climate Essay" creates a named tab group', async () => {
  doc = sim.openTab(DOC); await flush();
  const r = await sim.send({ type: 'startTask', tabId: doc, name: 'Climate Essay' });
  await flush();
  assert.equal(r.ok, true);
  thread = r.thread;
  const g = sim.groups.get(thread.groupId);
  assert.equal(g.title, 'Climate Essay');
  assert.equal(sim.tabs.get(doc).groupId, thread.groupId);
});

await step('2. Links opened from the Doc are suggested; a removed one stays out', async () => {
  wikiA = sim.openTab(WIKI_A, { openerTabId: doc, active: false });
  wikiB = sim.openTab(WIKI_B, { openerTabId: doc, active: false });
  await flush();
  let info = await sim.send({ type: 'getTabInfo', tabId: doc });
  assert.deepEqual(info.suggested.map((s) => s.tabId).sort(), [wikiA, wikiB].sort());
  await sim.send({ type: 'removeFromThread', threadId: thread.id, tabId: wikiB });
  await flush();
  info = await sim.send({ type: 'getTabInfo', tabId: doc });
  assert.deepEqual(info.suggested.map((s) => s.tabId), [wikiA]);
  assert.equal(sim.tabs.get(wikiB).groupId, -1);
  assert.ok(info.thread.excludedUrls.includes(WIKI_B));
});

await step('3-4. Highlight + scroll on Wikipedia, Alt+P with a note parks (break waits for you to leave)', async () => {
  sim.activate(wikiA); await flush();
  sim.setPage(wikiA, 1200, 'rainfall below average since 2023');
  sim.command('park-task'); await flush();
  const overlay = sim.sentOfType('openOverlay').at(-1);
  assert.ok(overlay, 'overlay was opened');
  assert.equal(overlay.askTaskName, false, 'tab is already in a task');
  await sim.send({ type: 'parkNote', nextStep: 'Find a source for the drought statistic' }, wikiA);
  await flush();
  const b = await ob();
  assert.equal(b.signal, 'park');
  assert.equal(b.departed, false);
  const crumb = (await chrome.storage.local.get('breadcrumbs')).breadcrumbs[thread.id];
  assert.equal(crumb.nextStep, 'Find a source for the drought statistic');
  assert.equal(crumb.scrollY, 1200);
  assert.equal(crumb.highlight, 'rainfall below average since 2023');
});

await step('5. Switch to YouTube: break starts, nudge scheduled; nudge fires once with the next step', async () => {
  advance(30000); // kept working 30 s after parking: not counted as away
  const before = Date.now();
  yt = sim.openTab(YT); await flush();
  const b = await ob();
  assert.equal(b.departed, true);
  assert.ok(b.leftAt >= before, 'leftAt is when you actually left');
  const alarm = sim.alarms.get('nudge:' + b.eventId);
  assert.ok(alarm, 'nudge alarm exists');
  advance(5 * 60000);
  sim.fireAlarm('nudge:' + b.eventId); await flush();
  assert.equal(sim.notifications.length, 1);
  assert.equal(sim.notifications[0].title, 'Climate Essay is waiting.');
  assert.equal(sim.notifications[0].message, 'Next: Find a source for the drought statistic');
});

await step('6. Return to Wikipedia: event created; pickup shows card with facts', async () => {
  const realRandom = Math.random; Math.random = () => 0.1; // pickup
  sim.sent.length = 0;
  sim.activate(wikiA); await flush();
  Math.random = realRandom;
  const ev = await lastEvent();
  assert.equal(ev.condition, 'pickup');
  assert.equal(ev.awayBucket, '5-15');
  assert.equal(ev.signal, 'park');
  assert.equal(ev.participant, 'anish');
  assert.equal(ev.cardShown, true);
  assert.equal(await ob(), null);
  const card = sim.sentOfType('showCard')[0];
  assert.equal(card.threadName, 'Climate Essay');
  assert.equal(card.nextStep, 'Find a source for the drought statistic');
  assert.equal(card.where.highlight, 'rainfall below average since 2023');
  assert.equal(card.tabCount, 2); // doc + wikiA (wikiB was removed)
  assert.equal(sim.sentOfType('armTimer')[0].eventId, ev.id);
});

await step('7. Resume: tab focused, group expanded, scroll restored', async () => {
  const ev = await lastEvent();
  sim.groups.get(thread.groupId).collapsed = true;
  sim.setPage(wikiA, 0, '');
  sim.activate(doc); await flush(); // wander off inside the thread
  await sim.send({ type: 'cardAction', eventId: ev.id, action: 'resume' }, wikiA);
  await flush();
  assert.equal(sim.tabs.get(wikiA).active, true);
  assert.equal(sim.groups.get(thread.groupId).collapsed, false);
  assert.equal(sim.page.get(wikiA).scrollY, 1200);
});

await step('8. First keystroke records seconds to first work interaction', async () => {
  const ev = await lastEvent();
  await sim.send({ type: 'firstInteraction', eventId: ev.id, at: ev.returnedAt + 22000 }, wikiA);
  await flush();
  const after = await lastEvent();
  assert.equal(after.firstInteractionAt - after.returnedAt, 22000);
  await sim.send({ type: 'firstInteraction', eventId: ev.id, at: ev.returnedAt + 99000 }, wikiA);
  assert.equal((await lastEvent()).firstInteractionAt - after.returnedAt, 22000, 'only the first one counts');
});

await step('9. Leave again, return, Tidy: YouTube goes into a collapsed "Later" group, not closed', async () => {
  const realRandom = Math.random; Math.random = () => 0.1;
  sim.activate(yt); await flush();
  assert.equal((await ob()).signal, 'tab');
  advance(3 * 60000);
  sim.activate(wikiA); await flush();
  Math.random = realRandom;
  const ev = await lastEvent();
  assert.equal(ev.signal, 'tab');
  assert.equal(ev.awayBucket, '2-5');
  await sim.send({ type: 'cardAction', eventId: ev.id, action: 'tidy' }, wikiA);
  await flush();
  const t = sim.tabs.get(yt);
  assert.ok(t, 'tab still exists');
  const g = sim.groups.get(t.groupId);
  assert.equal(g.title, 'Later');
  assert.equal(g.collapsed, true);
});

await step('10. Chrome loses focus to another app past the threshold: breadcrumb + event', async () => {
  const n = (await events()).length;
  sim.blurChrome(); await flush();
  await sleep(1100); await flush(); // past the 1 s blip filter
  const b = await ob();
  assert.equal(b && b.signal, 'focus');
  advance(16 * 60000);
  sim.focusChrome(1); await flush();
  const evs = await events();
  assert.equal(evs.length, n + 1);
  assert.equal(evs.at(-1).signal, 'focus');
  assert.equal(evs.at(-1).awayBucket, '15+');
});

await step('Extra: a focus blip under 1 s opens nothing', async () => {
  sim.blurChrome(); await flush();
  await sleep(200);
  sim.focusChrome(1); await flush();
  await sleep(1000); await flush();
  assert.equal(await ob(), null);
});

await step('Extra: short absence under the threshold is discarded silently', async () => {
  const n = (await events()).length;
  sim.activate(yt); await flush();
  advance(60000);
  sim.activate(wikiA); await flush();
  assert.equal((await events()).length, n);
  assert.equal(await ob(), null);
});

await step('Extra: control condition gets armTimer but no card', async () => {
  const realRandom = Math.random; Math.random = () => 0.9;
  sim.sent.length = 0;
  sim.activate(yt); await flush();
  advance(3 * 60000);
  sim.activate(wikiA); await flush();
  Math.random = realRandom;
  const ev = await lastEvent();
  assert.equal(ev.condition, 'control');
  assert.equal(sim.sentOfType('showCard').length, 0);
  assert.equal(sim.sentOfType('armTimer').length, 1);
});

await step('Extra: idle 3 min then active is a break with leftAt at start of idle', async () => {
  const before = Date.now();
  sim.idle('idle'); await flush();
  const b = await ob();
  assert.equal(b.signal, 'idle');
  assert.ok(Math.abs(b.leftAt - (before - 180000)) < 1000);
  advance(2 * 60000);
  sim.idle('active'); await flush();
  const ev = await lastEvent();
  assert.equal(ev.signal, 'idle');
  assert.equal(ev.awayBucket, '5-15');
});

await step('Extra: new tab typed to YouTube from a work tab still opens a break', async () => {
  const nt = sim.openTab('chrome://newtab/'); await flush();
  assert.equal(await ob(), null);
  sim.navigate(nt, 'https://youtube.com/shorts/1'); await flush();
  const b = await ob();
  assert.equal(b && b.signal, 'tab');
  assert.equal(b.tabId, wikiA);
  advance(3 * 60000);
  sim.activate(wikiA); await flush();
});

await step('Extra: debug + force card always shows the card and tags debug', async () => {
  const s = (await chrome.storage.local.get('settings')).settings;
  await chrome.storage.local.set({ settings: { ...s, debug: true, forceCard: true } });
  const realRandom = Math.random; Math.random = () => 0.99;
  sim.activate(yt); await flush();
  advance(11000);
  sim.activate(wikiA); await flush();
  Math.random = realRandom;
  const ev = await lastEvent();
  assert.equal(ev.condition, 'pickup');
  assert.equal(ev.debug, true);
  await chrome.storage.local.set({ settings: s });
});

await step('Extra: Alt+P on an untitled work tab asks for a task name and creates the group', async () => {
  const doc2 = sim.openTab('https://docs.google.com/document/d/lab/edit'); await flush();
  sim.command('park-task'); await flush();
  assert.equal(sim.sentOfType('openOverlay').at(-1).askTaskName, true);
  await sim.send({ type: 'parkNote', nextStep: 'Write the conclusion', taskName: 'Lab Report' }, doc2);
  await flush();
  const g = sim.groups.get(sim.tabs.get(doc2).groupId);
  assert.equal(g.title, 'Lab Report');
  assert.equal((await ob()).departed, false);
});

// ---------------- Phase 1 hardening: known risks ----------------
const signals = await import('../src/sw/signals.js');
const eventsMod = await import('../src/sw/events.js');
const constants = await import('../src/shared/constants.js');
const withRandom = async (v, fn) => { const r = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = r; } };
const crumbOf = async (threadId) => (await chrome.storage.local.get('breadcrumbs')).breadcrumbs[threadId];
const threadsNow = async () => (await chrome.storage.local.get('threads')).threads;
const setSettings = async (patch) => {
  const s = (await chrome.storage.local.get('settings')).settings;
  await chrome.storage.local.set({ settings: { ...s, ...patch } });
};

await step('Risk 1: a child frame answering snapshot cannot overwrite the breadcrumb; armTimer still reaches every frame', async () => {
  sim.addChildFrame(doc, { url: 'about:blank', answersSnapshot: true });
  sim.activate(doc); await flush();
  sim.setPage(doc, 900, 'the top frame highlight');
  await sim.send({ type: 'parkNote', nextStep: 'Fix the intro' }, doc); await flush();
  let crumb = await crumbOf(thread.id);
  assert.equal(crumb.url, DOC);
  assert.equal(crumb.scrollY, 900);
  sim.activate(yt); await flush(); // leave: markDeparted snapshots again
  crumb = await crumbOf(thread.id);
  assert.equal(crumb.url, DOC);
  assert.equal(crumb.highlight, 'the top frame highlight');
  advance(3 * 60000);
  sim.sent.length = 0;
  await withRandom(0.1, async () => { sim.activate(doc); await flush(); });
  const toDoc = sim.sent.filter((m) => m.tabId === doc);
  assert.ok(toDoc.filter((m) => m.type === 'showCard').length === 1, 'one card');
  for (const m of toDoc) if (m.type !== 'armTimer') assert.equal(m.frameId, 0, `${m.type} went to frame ${m.frameId}`);
  assert.deepEqual(toDoc.filter((m) => m.type === 'armTimer').map((m) => m.frameId).sort(), [0, 1], 'armTimer in every frame');
  assert.equal(sim.sentOfType('showCard')[0].where.scrollY, 900);
});

let docAgain;
await step('Risk 2: Resume of a closed tab replies at once, does not hold other handlers, and restores scroll after load', async () => {
  const ev = await lastEvent();
  assert.equal(ev.threadId, thread.id);
  sim.closeTab(doc); await flush();
  sim.setHoldLoads(true);
  sim.sent.length = 0;
  const reply = sim.send({ type: 'cardAction', eventId: ev.id, action: 'resume' });
  await sleep(50);
  const info = await Promise.race([sim.send({ type: 'getTabInfo', tabId: wikiA }), sleep(500).then(() => 'timeout')]);
  assert.notEqual(info, 'timeout', 'getTabInfo was stuck behind Resume');
  assert.notEqual(await Promise.race([reply, sleep(500).then(() => 'timeout')]), 'timeout', 'Resume reply waited for the page load');
  docAgain = [...sim.tabs.values()].find((t) => t.url === DOC);
  assert.ok(docAgain, 'tab recreated');
  assert.equal(sim.tabs.get(docAgain.id).groupId, thread.groupId, 'recreated tab goes back into its task group');
  assert.equal(sim.sentOfType('restoreScroll').length, 0, 'no scroll before the page loads');
  sim.finishLoad(docAgain.id); await sleep(400); await flush();
  const rs = sim.sentOfType('restoreScroll').at(-1);
  assert.equal(rs && rs.tabId, docAgain.id);
  assert.equal(rs.scrollY, 900);
  sim.setHoldLoads(false);
});

await step('Risk 3: worker restarts between blur and the 1 s check: the return still logs a focus event', async () => {
  assert.equal(await ob(), null);
  const n = (await events()).length;
  for (const w of sim.windows.values()) w.focused = false;
  // The listener ran, then the worker stopped before its 1 s timer fired.
  const lostAt = await store.serial(() => signals.handleFocusChanged(chrome.windows.WINDOW_ID_NONE));
  advance(5 * 60000);
  sim.focusChrome(1); await flush();
  const evs = await events();
  assert.equal(evs.length, n + 1);
  assert.equal(evs.at(-1).signal, 'focus');
  assert.equal(evs.at(-1).leftAt, lostAt);
  assert.equal(evs.at(-1).threadId, thread.id);
  assert.equal(await ob(), null);
});

await step('Risk 4: the Pickup popup open past the threshold opens no focus break and logs no event', async () => {
  await setSettings({ debug: true });
  const n = (await events()).length;
  sim.setPopupOpen(true); sim.blurChrome(); await flush();
  await sleep(1100); await flush();
  assert.equal(await ob(), null, 'no break while the popup is open');
  advance(30000);
  await sleep(1100); await flush();
  assert.equal(await ob(), null);
  sim.setPopupOpen(false); sim.focusChrome(1); await flush();
  await sleep(1100); await flush();
  assert.equal((await events()).length, n);
  assert.equal(await ob(), null);
});

await step('Risk 4: leaving Chrome from the popup still counts as a focus break', async () => {
  const n = (await events()).length;
  sim.setPopupOpen(true); sim.blurChrome(); await flush();
  await sleep(1100); await flush();
  sim.setPopupOpen(false); // popup closed itself, Chrome is still in the background
  await sleep(1100); await flush();
  assert.equal((await ob())?.signal, 'focus');
  advance(60000);
  sim.focusChrome(1); await flush();
  assert.equal((await events()).length, n + 1);
  assert.equal((await lastEvent()).signal, 'focus');
  await setSettings({ debug: false });
});

await step('Risk 6: next step carries over by default (decision 7); one constant can make it clear after a return', async () => {
  assert.equal(constants.NEXT_STEP_CLEARS_ON_RETURN, false);
  assert.equal((await crumbOf(thread.id)).nextStep, 'Fix the intro', 'still there after two more returns');
  assert.deepEqual(eventsMod.crumbAfterReturn({ url: 'u', nextStep: 'x' }, false), { url: 'u', nextStep: 'x' });
  assert.deepEqual(eventsMod.crumbAfterReturn({ url: 'u', nextStep: 'x' }, true), { url: 'u' });
});

const WIKI_C = 'https://en.wikipedia.org/wiki/Photosynthesis';
let w2, bio, yt2;
await step('Risk 7: drift-nudge click resumes a thread tab that lives in another window', async () => {
  sim.addWindow(2);
  w2 = sim.openTab(WIKI_C, { windowId: 2 }); await flush();
  sim.focusChrome(2); await flush();
  bio = (await sim.send({ type: 'startTask', tabId: w2, name: 'Bio Notes' })).thread; await flush();
  assert.equal(sim.groups.get(bio.groupId).windowId, 2);
  await sim.send({ type: 'parkNote', nextStep: 'Read section 3' }, w2); await flush();
  sim.focusChrome(1); await flush(); // back to the essay in window 1: Bio Notes is left
  const b = await ob();
  assert.equal(b.departed, true);
  advance(3 * 60000);
  const n = (await events()).length;
  chrome.notifications.onClicked.fire(b.eventId); await flush();
  assert.equal(sim.windows.get(2).focused, true);
  assert.equal(sim.tabs.get(w2).active, true);
  assert.equal((await events()).length, n + 1);
  assert.equal((await lastEvent()).threadId, bio.id);
  assert.equal(await ob(), null);
});

await step('Risk 7: switching windows from a work tab to a distraction opens a tab break', async () => {
  sim.focusChrome(1); await flush();
  yt2 = sim.openTab('https://www.youtube.com/watch?v=y', { windowId: 2 }); await flush(); // background window
  sim.focusChrome(2); await flush();
  await sleep(1100); await flush(); // a window switch is confirmed after 1 s
  const b = await ob();
  assert.equal(b && b.signal, 'tab');
  assert.equal(b.tabId, docAgain.id);
});

await step('Risk 7: Tidy groups break tabs in their own window and never moves them between windows', async () => {
  sim.activate(w2); await flush(); // yt2 is no longer the active tab in window 2
  advance(3 * 60000);
  await withRandom(0.1, async () => { sim.focusChrome(1); await flush(); });
  const ev = await lastEvent();
  assert.equal(ev.threadId, thread.id);
  const r = await sim.send({ type: 'cardAction', eventId: ev.id, action: 'tidy' }, docAgain.id); await flush();
  assert.equal(r.moved, 1);
  const t = sim.tabs.get(yt2);
  assert.equal(t.windowId, 2, 'stayed in its window');
  assert.deepEqual(sim.moved, []);
  const g = sim.groups.get(t.groupId);
  assert.equal(g.title, 'Later');
  assert.equal(g.windowId, 2);
  assert.equal(g.collapsed, true);
});

await step('Risk 5: after a Chrome restart with reshuffled group ids, threads re-link by title and keep their names', async () => {
  const byTitle = (title) => [...sim.groups.values()].filter((g) => g.title === title).map((g) => g.id);
  const [climateOld] = byTitle('Climate Essay');
  const [labOld] = byTitle('Lab Report');
  const remap = {};
  for (const g of sim.groups.values()) remap[g.id] = g.id + 1000;
  remap[climateOld] = labOld; remap[labOld] = climateOld; // new ids collide with each other's stale ids
  sim.restartChrome(remap); await flush();
  const ths = Object.values(await threadsNow());
  const climate = ths.find((t) => t.id === thread.id);
  const lab = ths.find((t) => t.name === 'Lab Report' || t.groupId === remap[labOld]);
  assert.equal(climate.name, 'Climate Essay');
  assert.equal(climate.groupId, remap[climateOld]);
  assert.equal(lab.name, 'Lab Report');
  assert.equal(lab.groupId, remap[labOld]);
  assert.equal(ths.find((t) => t.id === bio.id).groupId, remap[bio.groupId]);
  const info = await sim.send({ type: 'getTabInfo', tabId: wikiA });
  assert.equal(info.thread.name, 'Climate Essay');
});

await step('Risk 5: a restored group that gets its title after the relink is linked when the title arrives', async () => {
  const all = await threadsNow();
  const gid = all[bio.id].groupId;
  all[bio.id].groupId = null; // relink ran while the group was still untitled
  await chrome.storage.local.set({ threads: all });
  chrome.tabGroups.onUpdated.fire({ ...sim.groups.get(gid) }); await flush();
  assert.equal((await threadsNow())[bio.id].groupId, gid);
  assert.equal((await threadsNow())[bio.id].name, 'Bio Notes');
});

// ---------------- Code review findings ----------------
await step('Review 1: a YouTube tab inside the task group (opened from a thread tab) is not a return', async () => {
  sim.activate(wikiA); await flush();
  const n = (await events()).length;
  const ytG = sim.openTab('https://www.youtube.com/watch?v=grp', { openerTabId: wikiA }); await flush();
  assert.equal(sim.tabs.get(ytG).groupId, (await threadsNow())[thread.id].groupId, 'Chrome put it in the group');
  assert.equal((await ob())?.signal, 'tab');
  advance(3 * 60000);
  sim.blurChrome(); await flush(); await sleep(200);
  sim.focusChrome(1); await flush(); // back in Chrome, still on YouTube
  assert.equal((await events()).length, n, 'no false return');
  assert.ok(await ob(), 'break still open');
  sim.activate(wikiA); await flush();
  assert.equal((await events()).length, n + 1);
  sim.closeTab(ytG); await flush();
});

await step('Review 2: after a restart reuses tab ids, an unrelated tab cannot close a break left open', async () => {
  sim.activate(wikiA); await flush();
  sim.activate(yt); await flush();
  assert.equal((await ob()).tabId, wikiA);
  const n = (await events()).length;
  const tabRemap = {};
  for (const id of sim.tabs.keys()) tabRemap[id] = id + 500;
  tabRemap[yt] = wikiA; tabRemap[wikiA] = yt; // YouTube comes back with the essay tab's old id
  sim.restartChrome({}, tabRemap); await flush();
  const re = (id) => tabRemap[id] ?? id;
  [wikiA, wikiB, yt, w2, yt2] = [wikiA, wikiB, yt, w2, yt2].map(re);
  docAgain = { ...docAgain, id: re(docAgain.id) };
  sim.focusChrome(1);
  advance(3 * 60000);
  sim.activate(yt); await flush();
  assert.equal((await events()).length, n, 'YouTube with the old id is not a return');
  assert.equal((await ob()).tabId, wikiA, 'break re-pointed at the essay tab');
  sim.activate(wikiA); await flush();
  assert.equal((await events()).length, n + 1);
  assert.equal((await lastEvent()).threadId, thread.id);
});

await step('Review 3: Alt+P on a new-tab page or on YouTube makes no thread and no break', async () => {
  const before = Object.keys(await threadsNow()).length;
  const nt = sim.openTab('chrome://newtab/'); await flush();
  sim.command('park-task'); await flush();
  sim.activate(yt); await flush();
  sim.command('park-task'); await flush();
  assert.equal(Object.keys(await threadsNow()).length, before);
  assert.equal(await ob(), null);
  sim.closeTab(nt); await flush();
});

await step('Review 3: a work tab that navigates itself to YouTube keeps its own URL in the break thread', async () => {
  const WIKI_D = 'https://en.wikipedia.org/wiki/Monsoon';
  const wd = sim.openTab(WIKI_D); await flush();
  sim.navigate(wd, 'https://www.youtube.com/watch?v=self'); await flush();
  const b = await ob();
  assert.equal(b && b.signal, 'tab');
  assert.equal(b.tabId, wd);
  assert.deepEqual((await threadsNow())[b.threadId].tabUrls, [WIKI_D]);
  advance(3 * 60000);
  sim.navigate(wd, WIKI_D); await flush(); // Back button
  assert.equal((await lastEvent()).threadId, b.threadId);
  assert.equal(await ob(), null);
});

await step('Review 5: if the popup re-check stops (worker stopped), closing the popup later logs nothing', async () => {
  await setSettings({ debug: true });
  sim.activate(wikiA); await flush();
  const n = (await events()).length;
  for (const w of sim.windows.values()) w.focused = false;
  const lostAt = await store.serial(() => signals.handleFocusChanged(chrome.windows.WINDOW_ID_NONE));
  sim.setPopupOpen(true);
  await store.serial(() => signals.confirmFocusLost(lostAt)); // one popup check ran, then the worker stopped
  advance(60000);
  sim.setPopupOpen(false); sim.focusChrome(1); await flush();
  assert.equal((await events()).length, n);
  assert.equal(await ob(), null);
  await setSettings({ debug: false });
});

await step('Review 6: state from a child frame is ignored', async () => {
  await sim.send({ type: 'state', url: 'about:blank', scrollY: 0, highlight: '' }, wikiA, 1);
  const st = ((await chrome.storage.session.get('tabState')).tabState || {})[wikiA];
  assert.ok(!st || st.url !== 'about:blank');
});

await step('Review 7: the worker does not answer message types it does not own', async () => {
  const r = await Promise.race([sim.send({ type: 'popupOnlyThing' }), sleep(200).then(() => 'no reply')]);
  assert.equal(r, 'no reply');
});

await step('Review 10: a restored group announced by tabGroups.onCreated with its title is linked', async () => {
  const all = await threadsNow();
  const gid = all[bio.id].groupId;
  all[bio.id].groupId = null;
  await chrome.storage.local.set({ threads: all });
  chrome.tabGroups.onCreated.fire({ ...sim.groups.get(gid) }); await flush();
  assert.equal((await threadsNow())[bio.id].groupId, gid);
});

// ---------------- Code review items 4 and 8 ----------------
await step('Review 4: a window switch that lands on YouTube for under 1 s opens no break', async () => {
  sim.focusChrome(1); sim.activate(wikiA); await flush();
  assert.equal(await ob(), null);
  const neutral = sim.openTab('https://example.com/', { windowId: 2, active: false });
  sim.activate(yt2); await flush(); // window 2 shows YouTube, in the background
  sim.focusChrome(2); await flush(); // click into window 2 ...
  await sleep(150);
  sim.activate(neutral); await flush(); // ... on a neutral tab, so Chrome activates it right after
  await sleep(1100); await flush();
  assert.equal(await ob(), null, 'no break for a switch that passed YouTube');
  sim.closeTab(neutral); await flush();
});

await step('Review 4: staying on a YouTube window past 1 s opens a tab break dated at the switch', async () => {
  sim.focusChrome(1); sim.activate(wikiA); await flush();
  sim.activate(yt2); await flush();
  const before = Date.now();
  sim.focusChrome(2); await flush();
  assert.equal(await ob(), null, 'not decided yet');
  await sleep(1100); await flush();
  const b = await ob();
  assert.equal(b && b.signal, 'tab');
  assert.equal(b.tabId, wikiA);
  assert.ok(b.leftAt >= before && b.leftAt < before + 500, `leftAt ${b.leftAt - before} ms after the switch`);
  sim.focusChrome(1); await flush(); // back within the threshold: discarded
  assert.equal(await ob(), null);
});

await step('Review 8: Resume of a closed tab restores scroll even when the content script is late', async () => {
  const crumb = await crumbOf(thread.id);
  assert.equal(crumb.url, WIKI_A);
  sim.closeTab(wikiA); await flush();
  sim.setHoldLoads(true);
  sim.blockContent(WIKI_A, true);
  sim.sent.length = 0;
  await store.serial(() => eventsMod.resume(thread.id));
  const re = [...sim.tabs.values()].find((t) => t.url === WIKI_A);
  assert.ok(re, 'tab recreated');
  wikiA = re.id;
  sim.finishLoad(re.id);
  await sleep(400);                 // first try finds no content script
  sim.blockContent(WIKI_A, false);  // content script arrives late
  await sleep(1200); await flush();
  const rs = sim.sentOfType('restoreScroll').filter((m) => m.tabId === re.id);
  assert.equal(rs.length, 1, 'scroll restored once the script answered');
  assert.equal(rs[0].scrollY, crumb.scrollY);
  sim.setHoldLoads(false);
});

await step('Review 4: passing through a YouTube window onto another YouTube tab within 1 s still opens a break', async () => {
  sim.focusChrome(1); sim.activate(wikiA); await flush();
  assert.equal(await ob(), null);
  sim.addWindow(3);
  const ytA = sim.openTab('https://www.youtube.com/watch?v=a', { windowId: 3 });
  const ytB = sim.openTab('https://www.youtube.com/watch?v=b', { windowId: 3, active: false });
  sim.activate(ytA); await flush(); // background window: just remembered
  sim.focusChrome(3); await flush();
  await sleep(200);
  sim.activate(ytB); await flush();
  const b = await ob();
  assert.equal(b && b.signal, 'tab');
  assert.equal(b.tabId, wikiA);
  advance(3 * 60000);
  sim.focusChrome(1); await flush();
  assert.equal(await ob(), null);
});

const total = (await events()).length;
(quiet || console.log)(`\n${passed} checks passed, ${total} events logged${process.exitCode ? ' — SOME FAILED' : ''}`);
process.exit(process.exitCode || 0);
