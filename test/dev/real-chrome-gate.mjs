// DEV ONLY. Real-Chrome smoke test of the engine with the dev stub content script.
//
//   node test/dev/real-chrome-gate.mjs
//
// Needs: macOS, Node 22+, Chrome for Testing (set CFT=/path/to/binary, default is the
// Puppeteer cache copy of 157.0.8103.78), network access to wikipedia.org and youtube.com.
// Branded Google Chrome can't load an unpacked extension from the command line, so
// this uses Chrome for Testing with a throwaway profile. The test Chrome window takes
// the screen focus for about 4 minutes and Finder is activated twice (focus checks).
//
// Workarounds (not real user actions), see REAL_CHROME_LOG.md:
//  - tab switches via chrome.tabs.update from an extension page (same tabs.onActivated)
//  - Alt+P via the popup's `park` message (same requestPark path; CDP can't press browser shortcuts)
//  - text selection via a DOM Range in the page (fires the real selectionchange)
//  - service worker stop via the DevTools ServiceWorker domain (= chrome://serviceworker-internals Stop)
// Owner: Anish (Engine). Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildTestCopy, launch, activateApp, sleep, CFT_BUNDLE } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-real-chrome');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');

const ESSAY = 'https://en.wikipedia.org/wiki/Drought';
const YT = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const TASK = 'Drought Essay';
const NEXT = 'Find a source for the drought statistic';

// ONLY=Xa,Xb runs just those steps (plus setup S2 and step 1, which they need).
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const wanted = (id) => !ONLY || ONLY.has(id) || id === 'S2' || id === '1';
const results = [];
const swLog = [];
const timeline = []; // [iso time, what] for driver actions and window focus changes
const mark = (what) => timeline.push(`${new Date().toISOString().slice(11, 23)} ${what}`);
let cdp, proc, extId, ctlSid;
const sessions = new Map(); // targetId -> sessionId
const popupProbes = [];
const promptAnswers = [];
const dialogsSeen = [];

function frontmostApp() {
  try { return execFileSync('osascript', ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true'], { encoding: 'utf8' }).trim(); } catch { return '?'; }
}
// Window focus losses the driver did not cause (another app took the screen).
function stolenSince(idx) {
  let finderAt = -Infinity;
  const out = [];
  for (const l of timeline.slice(idx)) {
    const ms = Date.parse('1970-01-01T' + l.slice(0, 12) + 'Z');
    if (l.includes('osascript: activate Finder')) finderAt = ms;
    // NONE while the test Chrome itself is frontmost is Chrome's own popup, not another app.
    if (l.includes('FOCUS window NONE') && ms - finderAt > 1500 && !l.includes('frontmost app: Google Chrome for Testing')) out.push(l);
  }
  return out;
}

function record(id, name, pass, notes) {
  results.push({ id, name, pass, notes });
  console.log(`${pass === true ? 'PASS' : pass === false ? 'FAIL' : 'SKIP'}  ${id} ${name}${notes ? ' — ' + notes : ''}`);
}
// A step that depends on window focus is retried (up to 3 tries) when another app
// took focus during it; if that keeps happening it is reported as inconclusive.
async function step(id, name, fn, { retries = 2 } = {}) {
  if (!wanted(id)) return;
  for (let attempt = 0; ; attempt++) {
    mark(`--- step ${id}${attempt ? ` (retry ${attempt})` : ''}`);
    const idx = timeline.length;
    try {
      const notes = await fn();
      record(id, name, true, (notes || '') + (attempt ? ` (passed on retry ${attempt})` : ''));
      return;
    } catch (e) {
      await sleep(400); // let the focus poller catch up
      const stolen = stolenSince(idx);
      if (stolen.length && attempt < retries) continue;
      const tail = swLog.slice(-8).join(' | ');
      if (stolen.length) record(id, name, null, `INCONCLUSIVE: another app took focus (${stolen[0]}); last error: ${e.message}`);
      else record(id, name, false, `${e.message}${tail ? ` [SW log tail: ${tail}]` : ''}`);
      return;
    }
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
const ctl = (body) => evalIn(ctlSid, `(async () => { ${body} })()`);

async function targets() { return (await cdp.send('Target.getTargets')).targetInfos; }
async function attach(targetId, { page = false } = {}) {
  if (sessions.has(targetId)) return sessions.get(targetId);
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  sessions.set(targetId, sessionId);
  if (page) await cdp.send('Page.enable', {}, sessionId);
  return sessionId;
}
async function pageSession(match) {
  for (let i = 0; i < 50; i++) {
    const t = (await targets()).find((x) => x.type === 'page' && match(x.url));
    if (t) return attach(t.targetId, { page: true });
    await sleep(200);
  }
  throw new Error('no page target');
}
async function swTarget() {
  return (await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'));
}
async function attachSW() {
  const t = await swTarget();
  if (!t || sessions.has(t.targetId)) return;
  const sid = await attach(t.targetId);
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
}

function wireEvents() {
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => (a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description || '')).join(' ');
    if (text.startsWith('[Pickup]')) { swLog.push(`${new Date().toISOString().slice(11, 19)} ${text}`); mark('SW ' + text.slice(9)); }
  });
  cdp.on('Page.javascriptDialogOpening', (p, sid) => {
    const text = promptAnswers.length ? promptAnswers.shift() : '';
    dialogsSeen.push({ type: p.type, message: p.message, answered: text });
    cdp.send('Page.handleJavaScriptDialog', { accept: true, promptText: text }, sid).catch(() => {});
  });
  cdp.on('Target.targetCreated', ({ targetInfo }) => {
    if (targetInfo.type === 'service_worker' && targetInfo.url.endsWith('/src/sw/background.js')) attachSW().catch(() => {});
  });
  cdp.on('Target.detachedFromTarget', ({ sessionId }) => {
    for (const [k, v] of sessions) if (v === sessionId) sessions.delete(k);
  });
}

async function startBrowser(restore) {
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT, restore }));
  wireEvents();
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  for (let i = 0; i < 100 && !(await swTarget()); i++) await sleep(100);
  const sw = await swTarget();
  check(sw, 'service worker never started');
  extId = new URL(sw.url).host;
  await attachSW();
}

async function openControl() {
  const url = `chrome-extension://${extId}/test/dev/dev-setup.html`;
  let t = (await targets()).find((x) => x.type === 'page' && x.url.startsWith(url));
  if (!t) {
    const { targetId } = await cdp.send('Target.createTarget', { url });
    t = { targetId };
  }
  ctlSid = await attach(t.targetId, { page: true });
  for (let i = 0; i < 50; i++) { try { if (await evalIn(ctlSid, 'document.readyState') === 'complete') break; } catch { /* loading */ } await sleep(100); }
  await evalIn(ctlSid, `window.__focusLog = []; chrome.windows.onFocusChanged.addListener((id) => window.__focusLog.push([Date.now(), id])); true`);
  // Mirror window focus changes into the timeline.
  if (!openControl.polling) {
    openControl.polling = true;
    (async () => {
      while (!cdp.closed) {
        try {
          const log = await evalIn(ctlSid, `window.__focusLog.splice(0)`);
          for (const [t, id] of log) {
            let front = '';
            if (id === -1) front = ` (frontmost app: ${frontmostApp()})`;
            timeline.push(`${new Date(t).toISOString().slice(11, 23)} FOCUS window ${id === -1 ? 'NONE' : id}${front}`);
          }
        } catch { /* control page reloading */ }
        await sleep(250);
      }
      openControl.polling = false;
    })();
  }
}

// ---- helpers over the control page ----
const tabsAll = () => ctl(`return (await chrome.tabs.query({})).map(t => ({ id: t.id, url: t.url || t.pendingUrl, active: t.active, groupId: t.groupId, windowId: t.windowId, status: t.status }));`);
const activate = (tabId) => { mark(`activate tab ${tabId}`); return ctl(`await chrome.tabs.update(${tabId}, { active: true }); return true;`); };
const local = () => ctl(`return await chrome.storage.local.get(null);`);
const session = () => ctl(`return await chrome.storage.session.get(null);`);
const sendSW = (msg) => ctl(`return await chrome.runtime.sendMessage(${JSON.stringify(msg)});`);
const openBreak = async () => (await local()).openBreak || null;
const eventsNow = async () => (await local()).events || [];
async function waitFor(fn, ms = 10000, every = 250) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) { last = await fn(); if (last) return last; await sleep(every); }
  return last;
}
async function waitLoaded(tabId) {
  return waitFor(async () => (await tabsAll()).find((t) => t.id === tabId && t.status === 'complete'), 30000, 300);
}
async function stubAlive(tabId) {
  return waitFor(() => ctl(`try { return !!(await chrome.tabs.sendMessage(${tabId}, { type: 'snapshot' }, { frameId: 0 })); } catch { return false; }`), 15000, 400);
}
async function focusedWindow() { return ctl(`const w = await chrome.windows.getLastFocused(); return { id: w.id, focused: w.focused };`); }
async function bringFront() { mark('osascript: activate Chrome for Testing'); activateApp(CFT_BUNDLE); return waitFor(async () => (await focusedWindow()).focused, 5000, 200); }
function toFinder() { mark('osascript: activate Finder'); activateApp('com.apple.finder'); }
// Start a step from a known state: test Chrome in front, no break open (return to the work tab if one is).
async function clean(workTab) {
  check(await bringFront(), 'could not focus the test Chrome window');
  if (await openBreak()) {
    await activate(workTab);
    await waitFor(async () => !(await openBreak()), 5000);
    check(!(await openBreak()), 'a break from an earlier step is still open: ' + JSON.stringify(await openBreak()));
  }
}

// ---- page input ----
async function key(sid, k) {
  const map = { Enter: { code: 'Enter', vk: 13, text: '\r' }, t: { code: 'KeyT', vk: 84, text: 't' }, a: { code: 'KeyA', vk: 65, text: 'a' } }[k];
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: map.code, windowsVirtualKeyCode: map.vk, text: map.text }, sid);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: map.code, windowsVirtualKeyCode: map.vk }, sid);
}
async function wheel(sid, dy) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 500, y: 400, deltaX: 0, deltaY: dy }, sid);
}
async function click(sid, x, y, modifiers = 0) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers }, sid);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers }, sid);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers }, sid);
}
async function stopWorker() {
  mark('stop service worker');
  await cdp.send('ServiceWorker.enable', {}, ctlSid);
  await cdp.send('ServiceWorker.stopAllWorkers', {}, ctlSid);
  return waitFor(async () => !(await swTarget()), 5000, 100);
}
const cardText = (sid) => evalIn(sid, `(document.querySelector('[aria-label="Pickup dev stub card"]') || {}).textContent || ''`);

// =====================================================================
async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  buildTestCopy(REPO, EXT);
  await startBrowser(false);
  const version = await cdp.send('Browser.getVersion');
  console.log('Browser', version.product, '| ext', extId);
  await openControl();

  let essay, wikiA, wikiB, yt, groupId, essaySid, wikiASid;
  const ids = {};

  await step('S2', 'Dev setup Apply (real click): settings, register + inject stub', async () => {
    await cdp.send('Target.activateTarget', { targetId: [...sessions.entries()].find(([, v]) => v === ctlSid)[0] });
    await bringFront();
    const pos = await evalIn(ctlSid, `(() => { document.getElementById('forceCard').checked = true; const r = document.getElementById('apply').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await click(ctlSid, pos.x, pos.y);
    const out = await waitFor(() => evalIn(ctlSid, `document.getElementById('out').textContent.includes('Done.') && document.getElementById('out').textContent`), 10000);
    check(out, 'Apply did not finish: ' + (await evalIn(ctlSid, `document.getElementById('out').textContent`)));
    const s = (await local()).settings;
    check(s.debug === true && s.forceCard === true && s.participant === 'anish-dev', 'settings wrong ' + JSON.stringify(s));
    const reg = await ctl(`return (await chrome.scripting.getRegisteredContentScripts()).map(r => r.id + ':' + r.allFrames + ':' + r.matchOriginAsFallback);`);
    check(reg.includes('pickup-dev-stub:true:true'), 'stub not registered: ' + reg);
    return out.split('\n').filter(Boolean).slice(1, 4).join(' / ');
  });

  await step('1', `Start task "${TASK}" makes a named tab group`, async () => {
    essay = (await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(ESSAY)}, active: true })).id;`));
    ids.essay = essay;
    await waitLoaded(essay);
    check(await stubAlive(essay), 'stub not answering snapshot in the essay tab');
    const r = await sendSW({ type: 'startTask', tabId: essay, name: TASK });
    check(r && r.ok, 'startTask failed ' + JSON.stringify(r));
    groupId = r.thread.groupId;
    const g = await ctl(`return await chrome.tabGroups.get(${groupId});`);
    check(g.title === TASK, 'group title ' + g.title);
    return `group ${groupId} "${g.title}" (${g.color})`;
  });

  await step('2', 'Cmd-clicked links join the group as suggestions; a removed one leaves', async () => {
    essaySid = await pageSession((u) => u.startsWith(ESSAY));
    const links = await evalIn(essaySid, `(() => {
      const W = 'https://en.wikipedia.org/wiki/'; const as = [...document.querySelectorAll('#mw-content-text p a')].filter(a => a.href.startsWith(W) && !a.href.slice(W.length).includes(':') && !a.href.includes('#'));
      const seen = new Set(); const out = [];
      for (const a of as) { const h = a.href.split('#')[0]; if (seen.has(h) || h.startsWith(location.href.split('#')[0])) continue; seen.add(h); out.push(a); if (out.length === 2) break; }
      out[0].scrollIntoView({ block: 'center' });
      return out.map(a => a.href.split('#')[0]);
    })()`);
    const before = new Set((await tabsAll()).map((t) => t.id));
    for (const href of links) {
      const pos = await evalIn(essaySid, `(() => { const a = [...document.querySelectorAll('#mw-content-text p a')].find(x => x.href.split('#')[0] === ${JSON.stringify(href)}); a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return { x: r.x + Math.min(r.width / 2, 20), y: r.y + r.height / 2 }; })()`);
      await sleep(300);
      await click(essaySid, pos.x, pos.y, 4); // Meta = Cmd-click: new background tab
      await sleep(700);
    }
    const fresh = await waitFor(async () => { const n = (await tabsAll()).filter((t) => !before.has(t.id)); return n.length >= 2 && n; }, 8000);
    check(fresh && fresh.length >= 2, 'Cmd-click opened ' + (fresh ? fresh.length : 0) + ' tabs');
    [wikiA, wikiB] = [fresh[0].id, fresh[1].id];
    ids.wikiA = wikiA; ids.wikiB = wikiB;
    await waitLoaded(wikiA); await waitLoaded(wikiB);
    await sleep(800);
    const tabs = await tabsAll();
    check(tabs.find((t) => t.id === wikiA).groupId === groupId && tabs.find((t) => t.id === wikiB).groupId === groupId, 'new tabs not in the group: ' + JSON.stringify(fresh.map((t) => t.groupId)));
    let info = await sendSW({ type: 'getTabInfo', tabId: essay });
    const sug = info.suggested.map((s) => s.tabId).sort();
    check(sug.length === 2 && sug.includes(wikiA) && sug.includes(wikiB), 'suggested ' + JSON.stringify(info.suggested));
    await sendSW({ type: 'removeFromThread', threadId: info.thread.id, tabId: wikiB });
    await sleep(600);
    info = await sendSW({ type: 'getTabInfo', tabId: essay });
    const gB = (await tabsAll()).find((t) => t.id === wikiB).groupId;
    check(info.suggested.length === 1 && info.suggested[0].tabId === wikiA && gB === -1, `after remove: suggested ${JSON.stringify(info.suggested)}, wikiB group ${gB}`);
    check(info.thread.excludedUrls.length === 1, 'excludedUrls ' + JSON.stringify(info.thread.excludedUrls));
    return `suggested 2 (${fresh.map((t) => t.url.split('/wiki/')[1]).join(', ')}); removed one is ungrouped and excluded`;
  });

  await step('3', 'Scroll + highlight on Wikipedia reach the engine via debounced state', async () => {
    await activate(wikiA);
    check(await stubAlive(wikiA), 'stub not answering in wikiA');
    const url = (await tabsAll()).find((t) => t.id === wikiA).url;
    wikiASid = await pageSession((u) => u === url);
    await wheel(wikiASid, 1200);
    await sleep(800);
    await evalIn(wikiASid, `(() => {
      const ps = [...document.querySelectorAll('#mw-content-text p')].filter(p => p.textContent.trim().length > 120);
      const p = ps.find(p => { const r = p.getBoundingClientRect(); return r.top > 0 && r.top < innerHeight; }) || ps[0];
      const tn = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.trim().length > 40) || p.firstChild;
      const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, Math.min(60, tn.textContent.length));
      getSelection().removeAllRanges(); getSelection().addRange(r); return true;
    })()`);
    const st = await waitFor(async () => { const s = (await session()).tabState || {}; const x = s[wikiA]; return x && x.scrollY > 0 && x.highlight && x; }, 6000);
    check(st, 'tabState ' + JSON.stringify(((await session()).tabState || {})[wikiA]));
    return `scrollY ${st.scrollY}, highlight "${st.highlight.slice(0, 40)}…"`;
  });

  await step('4', 'Park with a next step (popup park → stub prompt) waits for you to leave', async () => {
    promptAnswers.push(NEXT);
    const r = await sendSW({ type: 'park', tabId: wikiA });
    check(r && r.ok, 'park reply ' + JSON.stringify(r));
    const ob = await waitFor(async () => { const o = await openBreak(); return o && o.signal === 'park' && o; }, 6000);
    check(ob && ob.departed === false, 'openBreak ' + JSON.stringify(ob));
    const crumb = (await local()).breadcrumbs[ob.threadId];
    check(crumb.nextStep === NEXT, 'nextStep ' + crumb.nextStep);
    check(crumb.scrollY > 0 && crumb.highlight, 'crumb ' + JSON.stringify(crumb));
    return `prompt answered (${dialogsSeen.length} dialog); crumb scrollY ${crumb.scrollY}, highlight kept`;
  });

  await step('5', 'Switch to YouTube: break starts; one nudge after ~30 s', async () => {
    yt = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(YT)}, active: true })).id;`);
    ids.yt = yt;
    const ob = await waitFor(async () => { const o = await openBreak(); return o && o.departed && o; }, 5000);
    check(ob, 'break did not start: ' + JSON.stringify(await openBreak()));
    const alarm = await ctl(`return (await chrome.alarms.getAll()).map(a => a.name);`);
    check(alarm.includes('nudge:' + ob.eventId), 'no nudge alarm: ' + alarm);
    const shown = await waitFor(async () => { const n = await ctl(`return Object.keys(await chrome.notifications.getAll());`); return n.includes(ob.eventId) && n; }, 50000, 1000);
    check(shown, 'no notification after 50 s');
    await sleep(1000);
    const after = await openBreak();
    check(after && after.nudged === true, 'nudged flag ' + JSON.stringify(after));
    const line = swLog.find((l) => l.includes('nudge shown'));
    return `notification ${ob.eventId}; ${line ? line.slice(9) : ''}`;
  });

  await step('6', 'Return to Wikipedia: event (park) + card with task, next step, highlight', async () => {
    check(await bringFront(), 'could not focus the test Chrome window');
    const n = (await eventsNow()).length;
    await activate(wikiA);
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 6000);
    check(ev, 'no event');
    check(ev.signal === 'park' && ev.condition === 'pickup' && ev.debug === true, 'event ' + JSON.stringify(ev));
    const text = await waitFor(() => cardText(wikiASid), 4000);
    check(text && text.includes(TASK) && text.includes(NEXT), 'card text: ' + text);
    const ev2 = (await eventsNow()).at(-1);
    check(ev2.cardShown === true, 'cardShown ' + ev2.cardShown);
    const notes = Object.keys(await ctl(`return await chrome.notifications.getAll();`));
    return `away ${((ev.returnedAt - ev.leftAt) / 1000).toFixed(0)} s, bucket ${ev.awayBucket}; card drawn; notification cleared: ${!notes.includes(ev.id)}`;
  });

  await step('7', 'Scroll away, press Enter (Resume): scroll restored, group expanded', async () => {
    const crumb = Object.values((await local()).breadcrumbs).find((c) => c.tabId === wikiA);
    await ctl(`await chrome.tabGroups.update(${groupId}, { collapsed: false }); return true;`);
    await wheel(wikiASid, -5000);
    await sleep(800);
    let note = '';
    if ((await evalIn(wikiASid, 'scrollY')) > 100) { await evalIn(wikiASid, 'scrollTo(0, 0)'); await sleep(300); note = ' (wheel did not move it; scrollTo(0,0) used)'; }
    const top = await evalIn(wikiASid, 'scrollY');
    await key(wikiASid, 'Enter');
    const y = await waitFor(async () => { const v = await evalIn(wikiASid, 'Math.round(scrollY)'); return Math.abs(v - crumb.scrollY) < 60 && v; }, 5000);
    const g = await ctl(`return await chrome.tabGroups.get(${groupId});`);
    check(y, `scrollY after Resume ${await evalIn(wikiASid, 'scrollY')} vs saved ${crumb.scrollY}`);
    check(g.collapsed === false, 'group collapsed');
    check(!(await cardText(wikiASid)), 'card still showing');
    return `scrolled ${Math.round(top)} → ${y} (saved ${crumb.scrollY}); card closed${note}`;
  });

  await step('8', 'First work interaction is recorded', async () => {
    const ev = (await eventsNow()).at(-1);
    check(ev.firstInteractionAt, 'firstInteractionAt null');
    return `${((ev.firstInteractionAt - ev.returnedAt) / 1000).toFixed(1)} s after return (the wheel scroll in step 7)`;
  });

  await step('9', 'Leave 12 s, return, press T: YouTube goes into a collapsed "Later" group', async () => {
    await clean(wikiA);
    await activate(wikiA);
    await sleep(500);
    await activate(yt);
    await sleep(500);
    check((await openBreak())?.signal === 'tab', 'no tab break after switching to YouTube: ' + JSON.stringify(await openBreak()));
    await sleep(12000);
    check(await bringFront(), 'could not focus the test Chrome window');
    const n = (await eventsNow()).length;
    await activate(wikiA);
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 6000);
    check(ev && ev.signal === 'tab', 'event ' + JSON.stringify(ev));
    check(await waitFor(() => cardText(wikiASid), 4000), 'no card');
    await key(wikiASid, 't');
    const t = await waitFor(async () => { const x = (await tabsAll()).find((tt) => tt.id === yt); return x && x.groupId !== -1 && x; }, 5000);
    check(t, 'YouTube tab not grouped (exists: ' + !!(await tabsAll()).find((tt) => tt.id === yt) + ')');
    const g = await ctl(`return await chrome.tabGroups.get(${t.groupId});`);
    check(g.title === 'Later' && g.collapsed === true, 'group ' + JSON.stringify(g));
    return `event tab/${ev.awayBucket}; YouTube tab still open in "Later" (${g.color}, collapsed)`;
  });

  await step('10', 'Chrome loses focus to Finder for 15 s: focus event', async () => {
    await clean(wikiA);
    await activate(wikiA);
    await sleep(1000);
    const n = (await eventsNow()).length;
    toFinder();
    await sleep(2500);
    const ob = await openBreak();
    check(ob && ob.signal === 'focus', 'no focus break after 2.5 s: ' + JSON.stringify(ob));
    await sleep(12500);
    await bringFront();
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 6000);
    check(ev && ev.signal === 'focus', 'event ' + JSON.stringify(ev));
    return `away ${((ev.returnedAt - ev.leftAt) / 1000).toFixed(1)} s`;
  });

  await step('Xa', 'Pickup popup open 15 s: no break, no event', async () => {
    const work = wikiA ?? essay;
    await clean(work);
    await activate(work);
    await sleep(1000);
    const n = (await eventsNow()).length;
    const t0 = timeline.length;
    check(await bringFront(), 'could not focus the test Chrome window');
    const opened = Date.now();
    mark('chrome.action.openPopup()');
    try { await ctl(`await chrome.action.openPopup(); return true;`); } catch (e) { throw new Error('openPopup: ' + e.message); }
    const isPopup = (t) => t.url.endsWith('/src/pages/popup.html');
    // Evidence: is the popup still there, and does getContexts see it from the page and from the worker?
    const probes = [];
    for (const at of [1000, 5000, 10000, 15000]) {
      await sleep(Math.max(0, opened + at - Date.now()));
      const sw = await swTarget();
      const swSid = sw && sessions.get(sw.targetId);
      let ctxSW = 'worker not attached';
      if (swSid) { try { ctxSW = await evalIn(swSid, `(async () => (await chrome.runtime.getContexts({ contextTypes: ['POPUP'] })).length)()`); } catch (e) { ctxSW = 'err ' + e.message; } }
      const p = {
        t: at / 1000,
        popupTarget: !!(await targets()).find(isPopup),
        ctxPage: await ctl(`return (await chrome.runtime.getContexts({ contextTypes: ['POPUP'] })).length;`),
        ctxSW,
        openBreak: (await openBreak())?.signal || null,
        focusLostAt: (await session()).focusLostAt ?? null,
        front: frontmostApp(),
      };
      probes.push(p);
      mark('probe ' + JSON.stringify(p));
    }
    popupProbes.push(probes);
    const ob = await openBreak();
    const pop = (await targets()).find(isPopup);
    if (pop) await cdp.send('Target.closeTarget', { targetId: pop.targetId });
    await sleep(2500);
    const ob2 = await openBreak();
    const n2 = (await eventsNow()).length;
    const focusLog = timeline.slice(t0).filter((l) => l.includes('FOCUS')).map((l) => l.split('FOCUS window ')[1]);
    const summary = probes.map((p) => `${p.t}s popup=${p.popupTarget} ctx(page/sw)=${p.ctxPage}/${p.ctxSW} break=${p.openBreak} front=${p.front}`).join('; ');
    check(!ob && !ob2 && n2 === n, `break ${JSON.stringify(ob || ob2)}, events ${n} -> ${n2}. Probes: ${summary}`);
    return `window focus changes while open: [${focusLog.join(', ')}]. Probes: ${summary}`;
  }, { retries: 1 });

  await step('Xb', 'Worker stopped mid-break: return still logs the event', async () => {
    await clean(wikiA);
    await activate(wikiA);
    await sleep(500);
    await activate(yt);
    const ob = await waitFor(async () => { const o = await openBreak(); return o && o.departed && o; }, 4000);
    check(ob, 'no break');
    const n = (await eventsNow()).length;
    check(await stopWorker(), 'worker still running');
    await sleep(12000);
    const restarted0 = !!(await swTarget());
    check(await bringFront(), 'could not focus the test Chrome window');
    await activate(wikiA);
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 8000);
    check(ev && ev.id === ob.eventId, 'event ' + JSON.stringify(ev));
    check(await swTarget(), 'worker did not restart');
    return `worker stopped (running before return: ${restarted0}); event ${ev.signal}/${ev.awayBucket} logged after restart`;
  });

  await step('Xc', 'Focus lost, worker stopped before the 1 s check: focus event on return', async () => {
    await clean(wikiA);
    await activate(wikiA);
    await sleep(1500);
    check(!(await openBreak()), 'a break is already open');
    const n = (await eventsNow()).length;
    toFinder();
    await sleep(150);
    const stopped = await stopWorker();
    check(stopped, 'worker still running');
    await sleep(15000);
    const obWhileAway = await openBreak();
    await bringFront();
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 8000);
    check(ev && ev.signal === 'focus', `event ${JSON.stringify(ev)}; break while away ${JSON.stringify(obWhileAway)}`);
    const recovered = swLog.some((l) => l.includes('focus loss recovered'));
    return `break while away: ${obWhileAway ? 'open (timer ran before stop)' : 'none (timer lost)'}; recovered on return: ${recovered}; away ${((ev.returnedAt - ev.leftAt) / 1000).toFixed(1)} s`;
  });

  // ---- window switches (review item 4: 1 s confirm before a window switch counts) ----
  let win1, win2, yt2, neutral2;
  const focusWin = (id) => { mark(`focus window ${id}`); return ctl(`await chrome.windows.update(${id}, { focused: true }); return true;`); };
  async function setupWindows() {
    win1 = (await tabsAll()).find((t) => t.id === wikiA).windowId;
    if (win2 && (await tabsAll()).some((t) => t.windowId === win2)) return;
    const w = await ctl(`const w = await chrome.windows.create({ url: ['about:blank', ${JSON.stringify(YT + '&w=2')}], focused: false }); return { id: w.id, tabs: w.tabs.map(t => t.id) };`);
    win2 = w.id; [neutral2, yt2] = w.tabs;
    await activate(yt2); // YouTube is what window 2 shows
    await waitLoaded(yt2);
  }

  await step('Xe', 'Switch from the work tab to a window showing YouTube, stay 3 s: tab break dated at the switch', async () => {
    await clean(wikiA);
    await setupWindows();
    await activate(yt2);
    await focusWin(win1); await activate(wikiA); await sleep(1500);
    check(!(await openBreak()), 'a break is already open');
    const n = (await eventsNow()).length;
    const t0 = Date.now();
    await focusWin(win2);
    await sleep(300);
    check(!(await openBreak()), 'break opened before the 1 s confirm');
    const ob = await waitFor(async () => { const o = await openBreak(); return o && o.departed && o; }, 4000);
    check(ob && ob.signal === 'tab', 'no tab break: ' + JSON.stringify(ob));
    check(ob.tabId === wikiA, `break is for tab ${ob.tabId}, expected the work tab ${wikiA}`);
    check(Math.abs(ob.leftAt - t0) < 1000, `leftAt ${ob.leftAt - t0} ms from the switch`);
    await sleep(11000); // past the debug threshold
    await focusWin(win1);
    const ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 8000);
    check(ev && ev.id === ob.eventId && ev.signal === 'tab', 'event ' + JSON.stringify(ev));
    return `break waited for the confirm, leftAt ${ob.leftAt - t0} ms after the switch; event tab/${ev.awayBucket}`;
  });

  await step('Xf', 'Pass through the YouTube window onto a neutral tab within 0.3 s: no break', async () => {
    await clean(wikiA);
    await setupWindows();
    await activate(yt2);
    await focusWin(win1); await activate(wikiA); await sleep(1500);
    check(!(await openBreak()), 'a break is already open');
    const n = (await eventsNow()).length;
    await focusWin(win2);
    await sleep(150);
    await activate(neutral2);
    await sleep(2500);
    const ob = await openBreak();
    check(!ob, 'break opened: ' + JSON.stringify(ob));
    await focusWin(win1);
    await sleep(800);
    check((await eventsNow()).length === n, 'an event was logged');
    await ctl(`await chrome.windows.remove(${win2}); return true;`);
    win2 = null;
    return 'no break, no event';
  });

  // ---- restart ----
  let restartNotes = '';
  await step('Xd', 'Chrome restart with a break open: group re-linked by title, break tab re-pointed', async () => {
    await clean(wikiA);
    await activate(wikiA);
    await sleep(800);
    await activate(yt);
    const ob = await waitFor(async () => { const o = await openBreak(); return o && o.departed && o; }, 4000);
    check(ob, 'no break before restart');
    const before = await local();
    const threadId = ob.threadId;
    const wikiAUrl = before.breadcrumbs[threadId].url;
    await sleep(1500); // let session state flush
    await cdp.send('Browser.close').catch(() => {});
    await new Promise((r) => { if (proc.exitCode !== null) r(); else proc.once('exit', r); });
    cdp.close(); sessions.clear();
    await sleep(1000);
    await startBrowser(true);
    await openControl();
    await bringFront();
    await sleep(4000);
    const after = await local();
    const th = after.threads[threadId];
    const groups = await ctl(`return await chrome.tabGroups.query({});`);
    const g = groups.find((x) => x.title === TASK);
    check(g, 'task group not restored: ' + JSON.stringify(groups.map((x) => x.title)));
    check(th.groupId === g.id, `thread groupId ${th.groupId} vs restored group ${g.id} (was ${before.threads[threadId].groupId})`);
    const ob2 = after.openBreak;
    const tabs = await tabsAll();
    const obTab = ob2 && tabs.find((t) => t.id === ob2.tabId);
    check(ob2 && obTab && obTab.url === wikiAUrl, `openBreak.tabId ${ob2 && ob2.tabId} -> ${obTab && obTab.url} (want ${wikiAUrl})`);
    const n = (after.events || []).length;
    // A fast restart can bring us back before the debug threshold (10 s), and the
    // engine then rightly discards the break as a short absence. Stay away past it.
    const wait = ob.leftAt + 12000 - Date.now();
    if (wait > 0) { mark(`wait ${wait} ms so the break passes the threshold`); await sleep(wait); }
    let ev;
    for (let i = 0; i < 3 && !ev; i++) {
      check(await bringFront(), 'could not focus the test Chrome window');
      await activate(obTab.id);
      ev = await waitFor(async () => { const e = await eventsNow(); return e.length > n && e.at(-1); }, 6000);
    }
    check(ev && ev.id === ob.eventId, 'return after restart: ' + JSON.stringify(ev));
    restartNotes = `group ${before.threads[threadId].groupId} → ${g.id}; break tab ${ob.tabId} → ${ob2.tabId}`;
    return `${restartNotes}; return logged (${ev.awayBucket})`;
  }, { retries: 0 }); // a restart can't be repeated from the same state

  record('Docs', 'Steps 6–8 on a Google Doc (frames)', null, 'not run: needs a Google login in the test profile');

  const dump = await local().catch(() => null);
  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ version, extId, results, popupProbes, swLog, timeline, dialogsSeen, dump }, null, 2));
  await cdp.send('Browser.close').catch(() => {});
  console.log(`\n${results.filter((r) => r.pass === true).length} pass, ${results.filter((r) => r.pass === false).length} fail, ${results.filter((r) => r.pass === null).length} skipped/inconclusive. Details: ${path.join(SCRATCH, 'results.json')}`);
}

main().catch(async (e) => {
  console.error('DRIVER ERROR', e);
  try { fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ results, swLog, timeline, error: String(e.stack || e) }, null, 2)); } catch { /* ignore */ }
  try { await cdp.send('Browser.close'); } catch { /* ignore */ }
  try { proc.kill(); } catch { /* ignore */ }
  process.exitCode = 1;
}).finally(() => setTimeout(() => process.exit(process.exitCode || 0), 500));
