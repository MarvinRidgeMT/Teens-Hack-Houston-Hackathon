// Voice checks: the intent parser, the reply wording, and the engine's
// voiceCommand / setVoiceSettings handlers against the fake Chrome.
// Run: node test/voice.test.mjs  (npm test runs it after engine.test.mjs)

import assert from 'node:assert/strict';
import { makeChrome } from './fake-chrome.mjs';
import { parse, splitWake, tidyWords, wakeCommand } from '../src/voice/intents.js';

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

// ---------------- parser (pure) ----------------
const CASES = [
  ['where was I', 'whereWasI'], ['Where was I?', 'whereWasI'], ['what was I doing', 'whereWasI'], ["what's next", 'whereWasI'],
  ['take me back', 'resume'], ["I'm back", 'resume'], ['resume', 'resume'], ["let's go", 'resume'],
  ['park this', 'park'], ["I'm taking a break", 'park'],
  ['wrap up', 'wrapUp'], ["I'm done for today", 'wrapUp'],
  ['tidy up', 'tidy'], ['tidy', 'tidy'],
  ['how long was I away', 'awayTime'], ['How long have I been away?', 'awayTime'],
  ['how am I doing', 'today'], ['today', 'today'],
  ['stop listening', 'stop'], ['never mind', 'stop'], ['stop', 'stop'],
  ['what is the weather', 'unknown'], ['', 'unknown'], ['   ', 'unknown'],
];
await step(`parse: ${CASES.length} phrases map to the right intent`, async () => {
  for (const [text, intent] of CASES) assert.equal(parse(text).intent, intent, `"${text}"`);
});
await step('parse: "park it, next step ..." keeps the user\'s words as the next step', async () => {
  const r = parse('park it, next step find a source for the drought statistic');
  assert.deepEqual(r, { intent: 'park', args: { nextStep: 'find a source for the drought statistic' } });
  assert.deepEqual(parse('park this').args, {});
  assert.deepEqual(parse('wrap up, next step start the conclusion'), { intent: 'wrapUp', args: { nextStep: 'start the conclusion' } });
  assert.deepEqual(parse('wrap up').args, {});
});
await step('parse: "my next step is ..." / "next step ..." is setNextStep with the words', async () => {
  assert.deepEqual(parse('my next step is outline paragraph two.'), { intent: 'setNextStep', args: { nextStep: 'outline paragraph two' } });
  assert.deepEqual(parse('Next step: check the citation'), { intent: 'setNextStep', args: { nextStep: 'check the citation' } });
  assert.deepEqual(parse('next step'), { intent: 'setNextStep', args: {} });
});
// Pickup panel: break timer and cancel-break intents
const BREAKS = [
  ['back in 10', 10], ['Back in 10 minutes.', 10], ['break for 15 minutes', 15], ['take a 10 minute break', 10],
  ['take a 10-minute break', 10], ['set a break for 20 min', 20], ['give me 5 minutes', 5], ['back in ten', 10],
  ['back in twenty five minutes', 25], ['back in twenty-five', 25], ['break for sixty minutes', 60],
  ['back in half an hour', 30], ['break for an hour', 60], ['back in 2 hours', 120], ['back in one minute', 1],
];
await step(`parse: ${BREAKS.length} break-timer phrases give breakTimer with the minutes`, async () => {
  for (const [text, minutes] of BREAKS) assert.deepEqual(parse(text), { intent: 'breakTimer', args: { minutes } }, `"${text}"`);
});
await step('parse: break timer vs park (both ways), out-of-range minutes, and a next step', async () => {
  assert.equal(parse('park it').intent, 'park');
  assert.equal(parse("I'm taking a break").intent, 'park');
  assert.equal(parse('take a break').intent, 'park');
  assert.equal(parse('take a 10 minute break').intent, 'breakTimer');
  assert.deepEqual(parse('back in 500'), { intent: 'breakTimer', args: {} });
  assert.deepEqual(parse('back in 0 minutes'), { intent: 'breakTimer', args: {} });
  assert.deepEqual(parse('break for 10 minutes, next step reread the intro'), { intent: 'breakTimer', args: { minutes: 10, nextStep: 'reread the intro' } });
});
await step('parse: cancel the break / back early vs cancel / I am back', async () => {
  assert.equal(parse('cancel the break').intent, 'cancelBreak');
  assert.equal(parse('cancel my break').intent, 'cancelBreak');
  assert.equal(parse("I'm back early").intent, 'cancelBreak');
  assert.equal(parse('cancel').intent, 'stop');
  assert.equal(parse("I'm back").intent, 'resume');
});

await step('parse (review): "back in N" inside a next step stays park / next step / wrap up', async () => {
  assert.deepEqual(parse('park it, next step call them back in 10'), { intent: 'park', args: { nextStep: 'call them back in 10' } });
  assert.deepEqual(parse('next step call Bob back in 2 hours'), { intent: 'setNextStep', args: { nextStep: 'call Bob back in 2 hours' } });
  assert.deepEqual(parse('wrap up, next step reply back in 2 days'), { intent: 'wrapUp', args: { nextStep: 'reply back in 2 days' } });
  assert.deepEqual(parse('next step: cancel the break room booking'), { intent: 'setNextStep', args: { nextStep: 'cancel the break room booking' } });
});
await step('parse (review): timer phrases, longer breaks, and back early', async () => {
  assert.equal(parse('cancel the timer').intent, 'cancelBreak');
  assert.equal(parse('stop the timer').intent, 'cancelBreak');
  assert.deepEqual(parse('back in ninety minutes'), { intent: 'breakTimer', args: { minutes: 90 } });
  assert.deepEqual(parse('back in sixty five'), { intent: 'breakTimer', args: { minutes: 65 } });
  assert.deepEqual(parse('back in an hour and a half'), { intent: 'breakTimer', args: { minutes: 90 } });
  assert.deepEqual(parse('back in 1.5 hours'), { intent: 'breakTimer', args: { minutes: 90 } });
  assert.deepEqual(parse("I'm back early"), { intent: 'cancelBreak', args: { early: true } });
  assert.deepEqual(parse('I am back early'), { intent: 'cancelBreak', args: { early: true } });
});

await step('splitWake: hey pickup / hey pick up / pick up, and the rest is the command', async () => {
  assert.deepEqual(splitWake('Hey Pickup, where was I?'), { wake: true, rest: 'where was I' });
  assert.deepEqual(splitWake('hey pick up take me back'), { wake: true, rest: 'take me back' });
  assert.deepEqual(splitWake('pick up'), { wake: true, rest: '' });
  assert.deepEqual(splitWake('so anyway hey pickup how long was I away'), { wake: true, rest: 'how long was I away' });
  assert.equal(splitWake('the pickup truck').wake, true); // known false positive, only while wake listening is on
  assert.equal(splitWake('where was I').wake, false);
  assert.equal(tidyWords('  find a source.  '), 'find a source');
});
await step('wakeCommand: the wake phrase must start what was heard (wake-word mode)', async () => {
  assert.deepEqual(wakeCommand('Hey Pickup, park it'), { wake: true, rest: 'park it' });
  assert.deepEqual(wakeCommand('  pick up.'), { wake: true, rest: '' });
  assert.deepEqual(wakeCommand('can you pick up the kids, park it'), { wake: false, rest: '' });
  assert.deepEqual(wakeCommand("then I'll pick up"), { wake: false, rest: '' });
});
await step('parse: "cancel" / "never mind" inside a next step is not stop', async () => {
  assert.deepEqual(parse('my next step is cancel the meeting'), { intent: 'setNextStep', args: { nextStep: 'cancel the meeting' } });
  assert.deepEqual(parse('park it, next step never mind the intro'), { intent: 'park', args: { nextStep: 'never mind the intro' } });
  assert.equal(parse('never mind').intent, 'stop');
  assert.equal(parse('cancel').intent, 'stop');
});

// ---------------- wording (pure) ----------------
const { buildReply, todayFacts, median, HELP } = await import('../src/sw/voice.js');
await step('buildReply: whereWasI says only the parts that have data', async () => {
  assert.equal(buildReply('whereWasI', { task: { name: 'Drought Essay' }, nextStep: 'find a source', highlight: 'rainfall below average' }),
    'You were on Drought Essay. Your next step: find a source. Last thing you highlighted: rainfall below average.');
  assert.equal(buildReply('whereWasI', { task: { name: 'Drought Essay' }, nextStep: '', highlight: 'x' }), 'You were on Drought Essay. Last thing you highlighted: x.');
  assert.equal(buildReply('whereWasI', { task: { name: 'Drought Essay' } }), 'You were on Drought Essay.');
  assert.equal(buildReply('whereWasI', { task: null }), "I don't have a task saved yet.");
});
await step('buildReply: every intent has a fixed template, including no-data cases', async () => {
  const T = { name: 'Drought Essay' };
  assert.equal(buildReply('resume', { task: T, ok: true }), 'Taking you back to Drought Essay.');
  assert.equal(buildReply('resume', { task: null }), "I don't have a task saved yet.");
  assert.equal(buildReply('park', { task: T, ok: true, words: 'x' }), 'Parked Drought Essay. Next step saved.');
  assert.equal(buildReply('park', { task: T, ok: true, words: '' }), 'Parked Drought Essay.');
  assert.match(buildReply('park', { ok: false, reason: 'page' }), /can't park this page/);
  assert.equal(buildReply('setNextStep', { task: T, words: 'outline paragraph two' }), 'Got it. Next step: outline paragraph two.');
  assert.equal(buildReply('setNextStep', { task: null, words: 'x' }), "I don't have a task saved yet.");
  assert.equal(buildReply('wrapUp', { task: T }), 'Saved Drought Essay for tomorrow.');
  assert.equal(buildReply('tidy', { moved: 3 }), 'Moved 3 distraction tabs into Later.');
  assert.equal(buildReply('tidy', { moved: 1 }), 'Moved 1 distraction tab into Later.');
  assert.equal(buildReply('tidy', { moved: 0 }), 'Nothing to tidy.');
  assert.equal(buildReply('awayTime', { awayMs: 7 * 60000 }), 'You were away 7 minutes.');
  assert.equal(buildReply('awayTime', { awayMs: 61000 }), 'You were away 1 minute.');
  assert.equal(buildReply('awayTime', { awayMs: 20000, awayOpen: true }), "You've been away less than a minute so far.");
  assert.equal(buildReply('awayTime', {}), "I don't have a break logged yet.");
  assert.equal(buildReply('today', { breaks: 3, medianSec: 12 }), 'Today: 3 breaks. Median 12 seconds back to work.');
  assert.equal(buildReply('today', { breaks: 1, medianSec: null }), 'Today: 1 break.');
  assert.equal(buildReply('today', { breaks: 0 }), 'Today: no breaks logged yet.');
  assert.equal(buildReply('stop', {}), 'Okay.');
  assert.equal(buildReply('unknown', {}), HELP);
  assert.equal(buildReply('somethingElse', {}), HELP);
});
await step('todayFacts: debug events and other days are left out; median of seconds back', async () => {
  const now = new Date(2026, 10, 19, 15, 0, 0).getTime();
  const at = (h, m) => new Date(2026, 10, 19, h, m).getTime();
  const evs = [
    { returnedAt: at(9, 0), leftAt: at(8, 50), firstInteractionAt: at(9, 0) + 10000 },
    { returnedAt: at(10, 0), leftAt: at(9, 50), firstInteractionAt: at(10, 0) + 30000 },
    { returnedAt: at(11, 0), leftAt: at(10, 50), firstInteractionAt: null },
    { returnedAt: at(12, 0), leftAt: at(11, 50), firstInteractionAt: at(12, 0) + 999000, debug: true },
    { returnedAt: new Date(2026, 10, 18, 12).getTime(), leftAt: 0, firstInteractionAt: new Date(2026, 10, 18, 12).getTime() + 5000 },
  ];
  assert.deepEqual(todayFacts(evs, now), { breaks: 3, medianSec: 20, topHost: null });
  const withHosts = [
    { ...evs[0], distractionHost: 'youtube.com', awayMs: 600000 },
    { ...evs[1], distractionHost: 'reddit.com', awayMs: 900000 },
    { ...evs[2], distractionHost: 'youtube.com', awayMs: 600000 },
    { ...evs[3], distractionHost: 'reddit.com', awayMs: 99999999 }, // debug: left out
  ];
  assert.deepEqual(todayFacts(withHosts, now).topHost, { host: 'youtube.com', awayMs: 1200000 });
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
});

// ---------------- check-integration: processLocally rule ----------------
{
  const { spawnSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const check = new URL('./check-integration.mjs', import.meta.url).pathname;
  const run = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickup-voice-fixture-'));
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    const r = spawnSync(process.execPath, [check, '--src', dir], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    return r.stdout.split('\n').filter((l) => l.includes('[voice]')).join('\n');
  };
  await step('check-integration FAILs a recogniser started without processLocally = true', async () => {
    assert.match(run({ 'a.js': 'const SR = globalThis.SpeechRecognition;\nconst rec = new SR();\nrec.lang = "en-US";\nrec.start();\n' }), /FAIL.*without processLocally = true/);
    assert.match(run({ 'b.js': 'const r = new webkitSpeechRecognition();\nr.start();\n' }), /FAIL.*without processLocally = true/);
    assert.match(run({ 'c.js': 'const rec = new SpeechRecognition();\nrec.processLocally = true;\nrec.start();\n' }), /FAIL.*never checked/);
    assert.match(run({ 'd.js': 'const rec = new SpeechRecognition();\nrec.processLocally = false;\nrec.start();\n' }), /FAIL.*processLocally to false/);
    assert.match(run({ 'e.js': 'const SR = window.SpeechRecognition || window.webkitSpeechRecognition;\nconst rec = new SR();\nrec.processLocally = true;\nif (rec.processLocally !== true) throw 0;\nrec.start();\n' }), /ok.*1 SpeechRecognition constructor/);
  });
}

// ---------------- engine handlers (fake Chrome) ----------------
await import('../src/sw/background.js');
const store = await import('../src/shared/store.js');
const flush = async () => { for (let i = 0; i < 6; i++) { await store.serial(() => null); await sleep(3); } };
const events = async () => (await chrome.storage.local.get('events')).events || [];
const crumbs = async () => (await chrome.storage.local.get('breadcrumbs')).breadcrumbs || {};
const voice = (intent, args = {}) => sim.send({ type: 'voiceCommand', intent, args });

await chrome.storage.local.set({ settings: {
  participant: 'anish', workSites: ['docs.google.com', 'wikipedia.org'], distractionSites: ['youtube.com'],
  awayThresholdMs: 120000, nudgeDelayMin: 5, debug: false, forceCard: false,
} });
sim.setContentSites(['docs.google.com', 'wikipedia.org']);
const DOC = 'https://docs.google.com/document/d/drought/edit';
const YT = 'https://www.youtube.com/watch?v=x';
let doc, yt, thread;

await step('voice: with nothing saved, where was I / how long / today say so', async () => {
  assert.equal((await voice('whereWasI')).say, "I don't have a task saved yet.");
  assert.equal((await voice('awayTime')).say, "I don't have a break logged yet.");
  assert.equal((await voice('today')).say, 'Today: no breaks logged yet.');
  assert.equal((await voice('tidy')).say, 'Nothing to tidy.');
  const r = await voice('nonsense');
  assert.equal(r.ok, true);
  assert.equal(r.data.intent, 'unknown');
});

await step('voice: setVoiceSettings defaults off (both switches and talking back), stores booleans, wake word needs voice on', async () => {
  let r = await sim.send({ type: 'setVoiceSettings' });
  assert.deepEqual(r, { ok: true, voiceEnabled: false, wakeWord: false, readAloud: false });
  r = await sim.send({ type: 'setVoiceSettings', voiceEnabled: true, wakeWord: true, participant: 'hacked' });
  assert.deepEqual(r, { ok: true, voiceEnabled: true, wakeWord: true, readAloud: false });
  r = await sim.send({ type: 'setVoiceSettings', readAloud: false });
  assert.equal(r.readAloud, false, 'read replies aloud can be turned off');
  r = await sim.send({ type: 'setVoiceSettings', readAloud: true });
  assert.equal(r.readAloud, true);
  r = await sim.send({ type: 'setVoiceSettings', readAloud: false });
  assert.equal((await store.getSettings()).participant, 'anish', 'only voice keys are written');
  r = await sim.send({ type: 'setVoiceSettings', voiceEnabled: false });
  assert.deepEqual(r, { ok: true, voiceEnabled: false, wakeWord: false, readAloud: false });
});

await step('voice: "park it, next step ..." parks the active task with a spoken next step', async () => {
  doc = sim.openTab(DOC); await flush();
  thread = (await sim.send({ type: 'startTask', tabId: doc, name: 'Drought Essay' })).thread;
  sim.setPage(doc, 900, 'rainfall below average since 2023');
  await flush();
  const r = await voice('park', { nextStep: 'find a source for the drought statistic' });
  await flush();
  assert.equal(r.say, 'Parked Drought Essay. Next step saved.');
  const c = (await crumbs())[thread.id];
  assert.equal(c.nextStep, 'find a source for the drought statistic');
  assert.equal(c.nextStepSource, 'spoken');
  const ob = await store.getOpenBreak();
  assert.equal(ob.signal, 'park');
  assert.equal(ob.departed, false);
});

await step('voice: where was I reads back task, spoken next step and highlight', async () => {
  const r = await voice('whereWasI');
  assert.equal(r.say, 'You were on Drought Essay. Your next step: find a source for the drought statistic. Last thing you highlighted: rainfall below average since 2023.');
});

await step('voice: leaving keeps nextStepSource; away time counts the open break', async () => {
  advance(10000);
  yt = sim.openTab(YT); await flush();
  assert.equal((await store.getOpenBreak()).departed, true);
  assert.equal((await crumbs())[thread.id].nextStepSource, 'spoken', 'survives markDeparted rewrite');
  advance(4 * 60000);
  assert.equal((await voice('awayTime')).say, "You've been away 4 minutes so far.");
});

await step('voice: "I\'m back" goes through resume(); the event is logged with returnVia voice', async () => {
  const realRandom = Math.random; Math.random = () => 0.9; // control
  const before = (await events()).length;
  const r = await voice('resume');
  await flush();
  Math.random = realRandom;
  assert.equal(r.say, 'Taking you back to Drought Essay.');
  assert.equal(sim.tabs.get(doc).active, true);
  const evs = await events();
  assert.equal(evs.length, before + 1, 'one event from the normal return path');
  const ev = evs.at(-1);
  assert.equal(ev.returnVia, 'voice');
  assert.equal(ev.condition, 'control', 'coin flip still happens');
  assert.equal(await store.getOpenBreak(), null);
  assert.equal((await voice('awayTime')).say, 'You were away 4 minutes.');
});

await step('voice: a later ordinary return is not tagged voice', async () => {
  sim.activate(yt); await flush();
  advance(3 * 60000);
  await voice('resume'); // a second voice return
  await flush();
  assert.equal((await events()).at(-1).returnVia, 'voice');
  sim.activate(yt); await flush();
  advance(3 * 60000);
  sim.activate(doc); await flush(); // by hand
  assert.equal((await events()).at(-1).returnVia, 'tab');
});

await step('voice: "I\'m back" while already on the task says so and logs nothing', async () => {
  const before = (await events()).length;
  const r = await voice('resume');
  await flush();
  assert.equal(r.say, "You're already on Drought Essay.");
  assert.equal((await events()).length, before);
  assert.equal(await store.takeReturnVia(10000), null, 'no voice marker left behind');
});

await step('voice: setNextStep replaces the next step with the spoken words', async () => {
  const r = await voice('setNextStep', { nextStep: 'outline paragraph two' });
  assert.equal(r.say, 'Got it. Next step: outline paragraph two.');
  const c = (await crumbs())[thread.id];
  assert.equal(c.nextStep, 'outline paragraph two');
  assert.equal(c.nextStepSource, 'spoken');
  assert.equal((await voice('setNextStep', {})).say, "Say 'next step' and then the step.");
});

await step('voice: tidy after a return moves break tabs; today excludes debug and counts real events', async () => {
  const r = await voice('tidy');
  assert.equal(r.say, 'Moved 1 distraction tab into Later.'); // the YouTube tab from the last break
  const evs = await events();
  await chrome.storage.local.set({ events: [...evs, { ...evs[0], id: 'dbg', debug: true, returnedAt: Date.now() }] });
  const t = await voice('today');
  assert.match(t.say, new RegExp(`^Today: ${evs.length} breaks?\\.`));
});

await step('voice: wrap up saves the task for tomorrow through wrapUp()', async () => {
  assert.equal((await voice('wrapUp')).say, 'Saved Drought Essay for tomorrow.');
  await flush();
  const wu = await store.getWrapUp();
  assert.equal(wu && wu.threadId, thread.id);
  assert.equal(wu.shown, false);
  assert.equal(sim.badge.text, '☾');
});

await step('voice: "wrap up, next step ..." from YouTube saves the task, closes the break unlogged', async () => {
  sim.activate(yt); await flush();
  assert.equal((await store.getOpenBreak()).departed, true);
  const before = (await events()).length;
  advance(3 * 60000);
  const r = await voice('wrapUp', { nextStep: 'start the conclusion' });
  await flush();
  assert.equal(r.say, 'Saved Drought Essay for tomorrow. Next step: start the conclusion.');
  assert.equal(await store.getOpenBreak(), null);
  assert.equal((await events()).length, before, 'wrapping up is not an interruption');
  const wu = await store.getWrapUp();
  assert.equal(wu.threadId, thread.id);
  assert.equal(wu.nextStep, 'start the conclusion');
  assert.equal(wu.nextStepSource, 'spoken');
  sim.activate(doc); await flush();
  assert.equal((await events()).length, before, 'coming back after a wrap-up logs nothing');
  await store.setWrapUp(null);
});

await step('voice: resume of a parked (not yet left) task leaves no voice marker', async () => {
  await voice('park', {}); await flush();
  assert.equal((await store.getOpenBreak()).departed, false);
  await voice('resume'); await flush();
  assert.equal(await store.takeReturnVia(10000), null);
});

await step('voice: park on YouTube says it cannot park this page', async () => {
  sim.activate(yt); await flush();
  const r = await voice('park', {});
  assert.match(r.say, /can't park this page/);
  sim.activate(doc); await flush();
});

await step('voice: a spoken next step reaches the card as nextStepSource spoken', async () => {
  await voice('park', { nextStep: 'reread the intro' }); await flush();
  advance(5000);
  sim.activate(yt); await flush();
  advance(3 * 60000);
  const realRandom = Math.random; Math.random = () => 0.1; // pickup
  sim.sent.length = 0;
  sim.activate(doc); await flush();
  Math.random = realRandom;
  const card = sim.sentOfType('showCard').at(-1);
  assert.equal(card.nextStep, 'reread the intro');
  assert.equal(card.nextStepSource, 'spoken');
  await sim.send({ type: 'parkNote', nextStep: 'typed one' }, doc); await flush();
  assert.equal((await crumbs())[thread.id].nextStepSource, 'typed', 'a typed step replaces the spoken label');
});

await step('voice: wrap up with the task tab closed, from another work page, saves nothing', async () => {
  await store.setWrapUp(null);
  const wiki = sim.openTab('https://en.wikipedia.org/wiki/Gardening'); await flush();
  sim.closeTab(doc); await flush();
  sim.activate(wiki); await flush();
  const r = await voice('wrapUp');
  await flush();
  assert.equal(r.say, "I couldn't save Drought Essay. Go to your work tab first.");
  assert.equal(await store.getWrapUp(), null, 'no wrap-up saved for the wrong page');
});

await step('Alt+V (toggle-voice) opens the side panel in that window', async () => {
  sim.command('toggle-voice'); await flush();
  assert.deepEqual(chrome.sidePanel.opened.at(-1), { windowId: 1 });
  const { voiceShortcutAt } = await chrome.storage.session.get('voiceShortcutAt');
  assert.ok(voiceShortcutAt > 0);
});

out(`\n${passed} voice checks passed`);
