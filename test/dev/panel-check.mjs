// DEV ONLY. Real-Chrome check of the Pickup panel (Ask, break timer, task list,
// Today strip) plus 360x800 screenshots into docs-shots/.
//
//   node test/dev/panel-check.mjs
//
// Chrome for Testing with a throwaway profile and a test copy of the extension
// (same as real-chrome-gate.mjs). Debug mode is on, so a "10 min" break is 100 s.
// The panel opens in its own small unfocused window (not as a tab, which would
// count as leaving the task). Driving it:
//  - Ask: sets the input and submits the form (same submit handler as Enter).
//  - Buttons: element.click() in the panel page (same click handlers).
//  - The break-over notification click: chrome.notifications.onClicked.dispatch in
//    the worker (same listener as a click; DevTools can't click OS notifications).
// Owner: Anish (Engine). Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestCopy, launch, sleep } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-panel-check');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const SHOTS = path.join(REPO, 'docs-shots');
const ESSAY = 'https://en.wikipedia.org/wiki/Drought';
const YT = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

const results = [];
let cdp, proc, extId, ctlSid, swSid, panelSid;
const swLog = [];

function check(cond, msg) { if (!cond) throw new Error(msg); }
async function step(id, name, fn) {
  try { const notes = await fn(); results.push({ id, name, pass: true, notes }); console.log(`PASS  ${id} ${name}${notes ? ' — ' + notes : ''}`); }
  catch (e) { results.push({ id, name, pass: false, notes: e.message }); console.log(`FAIL  ${id} ${name} — ${e.message} [SW: ${swLog.slice(-4).join(' | ')}]`); }
}
async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
const ctl = (body) => evalIn(ctlSid, `(async () => { ${body} })()`);
const inPanel = (body) => evalIn(panelSid, `(async () => { const $ = (id) => document.getElementById(id); ${body} })()`);
const sendSW = (msg) => ctl(`return await chrome.runtime.sendMessage(${JSON.stringify(msg)});`);
const local = () => ctl(`return await chrome.storage.local.get(null);`);
async function waitFor(fn, ms = 10000, every = 250) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { last = await fn(); if (last) return last; await sleep(every); }
  return last;
}
const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;
async function attachTo(match, { page = true } = {}) {
  for (let i = 0; i < 60; i++) {
    const t = (await targets()).find(match);
    if (t) {
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      if (page) await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      return sessionId;
    }
    await sleep(200);
  }
  throw new Error('target not found');
}
async function shot(name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  // Both design-system themes: Paper (light) and Blue hour (dark).
  const out = [];
  for (const scheme of ['light', 'dark']) {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, panelSid);
    await sleep(150);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, panelSid);
    const f = path.join(SHOTS, `panel-${name}${scheme === 'dark' ? '-dark' : ''}.png`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    out.push(path.relative(REPO, f));
  }
  await cdp.send('Emulation.setEmulatedMedia', { features: [] }, panelSid);
  return out.join(', ');
}
async function ask(text) {
  await inPanel(`$('askInput').value = ${JSON.stringify(text)}; $('askForm').requestSubmit(); return true;`);
  await sleep(400);
  return waitFor(() => inPanel(`return $('reply').textContent;`), 3000);
}
const activate = (tabId) => ctl(`await chrome.tabs.update(${tabId}, { active: true }); return true;`);
const lastEvent = async () => ((await local()).events || []).at(-1);

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  buildTestCopy(REPO, EXT);
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT }));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => (typeof a.value === 'string' ? a.value : a.value !== undefined ? JSON.stringify(a.value) : a.description || '')).join(' ');
    if (text.startsWith('[Pickup]')) swLog.push(text.slice(9));
  });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  swSid = await attachTo((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'), { page: false });
  extId = new URL((await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')).url).host;
  const version = await cdp.send('Browser.getVersion');
  console.log('Browser', version.product, '| ext', extId);
  const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/test/dev/inspect.html` });
  ctlSid = await attachTo((t) => t.targetId === targetId);
  await waitFor(() => evalIn(ctlSid, `location.protocol === 'chrome-extension:' && document.readyState === 'complete' && !!(globalThis.chrome && chrome.storage)`).catch(() => false), 10000);

  let essay, yt, threadId, panelWin;

  await step('P0', 'Setup: debug settings, essay task, panel window at 360x800', async () => {
    await ctl(`await chrome.storage.local.set({ settings: { participant: 'panel-check', workSites: ['wikipedia.org'], distractionSites: ['youtube.com'],
      awayThresholdMs: 120000, nudgeDelayMin: 5, debug: true, forceCard: false, voiceEnabled: false, wakeWord: false } }); return true;`);
    essay = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(ESSAY)}, active: true })).id;`);
    await waitFor(() => ctl(`return (await chrome.tabs.get(${essay})).status === 'complete';`), 20000);
    const r = await sendSW({ type: 'startTask', tabId: essay, name: 'Drought Essay' });
    check(r && r.ok, 'startTask ' + JSON.stringify(r));
    threadId = r.thread.id;
    yt = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(YT)}, active: false })).id;`);
    await activate(essay);
    panelWin = await ctl(`return (await chrome.windows.create({ url: chrome.runtime.getURL('src/voice/panel.html'), type: 'popup', width: 360, height: 800, focused: false })).id;`);
    panelSid = await attachTo((t) => t.type === 'page' && t.url.endsWith('/src/voice/panel.html'));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: false }, panelSid);
    await waitFor(() => inPanel(`return location.protocol === 'chrome-extension:' && document.readyState === 'complete' && !!$('tasks');`).catch(() => false), 10000);
    await sleep(800);
    const ob = (await local()).openBreak;
    check(!ob, 'opening the panel window opened a break: ' + JSON.stringify(ob));
    return `panel window ${panelWin}; no break opened by the panel`;
  });

  await step('P1', 'Ask "where was I" (typed) answers from the engine; empty-state task list renders', async () => {
    const reply = await ask('where was I');
    check(/^(You were on Drought Essay|I don't have a task saved yet)/.test(reply), 'reply ' + reply);
    const names = await inPanel(`return [...document.querySelectorAll('.task-name')].map((e) => e.textContent);`);
    check(names.includes('Drought Essay'), 'tasks ' + JSON.stringify(names));
    return `"${reply}"; tasks: ${names.join(', ')}; ${await shot('ask')}`;
  });

  let ev1;
  await step('P2', 'Ask "back in 10" (debug: 100 s) parks the essay with a timer; countdown shows', async () => {
    const reply = await ask('back in 10, next step check the 2023 rainfall table');
    check(/^Break started\. Back to Drought Essay at /.test(reply), 'reply ' + reply);
    const ob = (await local()).openBreak;
    check(ob && ob.plannedMin === 10 && ob.endsAt - Date.now() > 80000 && ob.endsAt - Date.now() <= 100500, 'openBreak ' + JSON.stringify(ob));
    ev1 = ob.eventId;
    const alarms = await ctl(`return (await chrome.alarms.getAll()).map((a) => a.name);`);
    check(alarms.includes('breakend:' + ob.eventId), 'alarms ' + alarms);
    check(!alarms.some((a) => a.startsWith('nudge:')), 'nudge alarm present: ' + alarms);
    await sleep(1200);
    const ui = await inPanel(`return { run: !$('timerRun').hidden, clock: $('timerClock').textContent, ends: $('timerEnds').textContent, debug: !$('timerDebug').hidden };`);
    check(ui.run && /^1:[0-4]\d$/.test(ui.clock), 'timer UI ' + JSON.stringify(ui));
    await sleep(2100);
    const later = await inPanel(`return $('timerClock').textContent;`);
    const secs = (c) => Number(c.split(':')[0]) * 60 + Number(c.split(':')[1]);
    check(secs(ui.clock) - secs(later) >= 1, `clock not counting down: ${ui.clock} -> ${later}`);
    const badge = await ctl(`return { text: await chrome.action.getBadgeText({}), title: await chrome.action.getTitle({}) };`);
    check(badge.text === '2m' || badge.text === '1m', 'badge ' + JSON.stringify(badge));
    return `clock ${ui.clock}; "${ui.ends}"; badge ${badge.text} "${badge.title}"; ${await shot('timer')}`;
  });

  await step('P3', 'Leave for YouTube; at the end one "Break\'s over" notification; click returns with returnVia timer', async () => {
    await activate(yt);
    await waitFor(async () => ((await local()).openBreak || {}).departed, 5000);
    const ob = (await local()).openBreak;
    check(ob.plannedMin === 10, 'plan kept on leaving');
    const wait = ob.endsAt - Date.now() + 3000;
    const ids = await waitFor(async () => {
      const n = await ctl(`return Object.keys(await chrome.notifications.getAll());`);
      return n.includes('breakend:' + ev1) && n;
    }, wait + 15000, 1000);
    check(ids && ids.includes('breakend:' + ev1), 'no break-over notification: ' + JSON.stringify(ids));
    check(ids.length === 1, 'more than one notification: ' + ids);
    await evalIn(swSid, `chrome.notifications.onClicked.dispatch(${JSON.stringify('breakend:' + ev1)}); true`);
    const ev = await waitFor(async () => { const e = await lastEvent(); return e && e.id === ev1 && e; }, 8000);
    check(ev, 'no event logged');
    check(ev.returnVia === 'timer' && ev.plannedBreakMin === 10, `returnVia ${ev.returnVia}, plannedBreakMin ${ev.plannedBreakMin}`);
    const active = await ctl(`return (await chrome.tabs.get(${essay})).active;`);
    check(active, 'essay not active');
    return `notification ${ids[0]} once; event returnVia ${ev.returnVia}, plannedBreakMin ${ev.plannedBreakMin}, away ${Math.round(ev.awayMs / 1000)} s`;
  });

  await step('P4', 'Task list: Resume from the list after leaving logs returnVia panel', async () => {
    await activate(yt);
    await sleep(11500); // past the 10 s debug threshold
    await waitFor(() => inPanel(`return [...document.querySelectorAll('.status-chip')].some((c) => /^Away/.test(c.textContent));`), 35000, 500);
    const chip = await inPanel(`return [...document.querySelectorAll('.status-chip')].map((c) => c.textContent).join(', ');`);
    const s = await shot('tasks-away');
    await inPanel(`document.querySelector('button[aria-label="Resume Drought Essay"]').click(); return true;`);
    const ev = await waitFor(async () => { const e = await lastEvent(); return e && e.id !== ev1 && e; }, 8000);
    check(ev && ev.returnVia === 'panel', 'event ' + JSON.stringify(ev && { returnVia: ev.returnVia }));
    return `chip "${chip}"; event returnVia ${ev.returnVia}, plannedBreakMin ${ev.plannedBreakMin}; ${s}`;
  });

  await step('P5', 'Edit next step in the list saves typed words; Today strip shows facts', async () => {
    await inPanel(`[...document.querySelectorAll('.task button')].find((b) => /next step/.test(b.textContent)).click(); return true;`);
    await waitFor(() => inPanel(`return !!document.querySelector('.task form.edit input');`), 3000);
    await inPanel(`const i = document.querySelector('.task form.edit input'); i.value = 'Outline paragraph two'; i.form.requestSubmit(); return true;`);
    const crumb = await waitFor(async () => { const c = ((await local()).breadcrumbs || {})[threadId]; return c && c.nextStep === 'Outline paragraph two' && c; }, 5000);
    check(crumb && crumb.nextStepSource === 'typed', 'crumb ' + JSON.stringify(crumb && { s: crumb.nextStep, src: crumb.nextStepSource }));
    await sleep(600);
    const today = await inPanel(`return $('today').textContent;`);
    const step = await inPanel(`return document.querySelector('.task-step').textContent;`);
    return `"${step}"; today: "${today}"; ${await shot('full')}`;
  });

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ version: (await cdp.send('Browser.getVersion')).product, results, swLog }, null, 2));
  console.log(`\n${results.filter((r) => r.pass).length} pass, ${results.filter((r) => !r.pass).length} fail. Details: ${path.join(SCRATCH, 'results.json')}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* gone */ }
  try { proc.kill(); } catch { /* gone */ }
  setTimeout(() => process.exit(), 500);
});
