// DEV ONLY. Real-Chrome screenshots of the redesigned pages in both themes:
// popup (360 wide), setup and dashboard (1280x800 @2x), and the comeback receipt PNG.
//
//   node test/dev/pages-shots.mjs
//
// Test data only: a throwaway profile with made-up events (so the receipt has 10+
// per condition). The screenshots say so in their captions; never use them as results.
// Workaround (not a real user action): the popup is opened as a page, so its
// "active tab in the current window" query is pointed at the essay tab by a test hook
// injected with CDP. Owner: Anish. Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestCopy, launch, sleep } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-pages-shots');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const SHOTS = path.join(REPO, 'docs-shots');
const ESSAY = 'https://en.wikipedia.org/wiki/Drought';

let cdp, proc, extId;
const log = [];
const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;
async function attach(targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  return sessionId;
}
async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms; let v;
  while (Date.now() < end) { v = await fn().catch(() => false); if (v) return v; await sleep(250); }
  return v;
}
async function openPage(url, { width, height, hook } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const sid = await attach(targetId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false }, sid);
  if (hook) await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: hook }, sid);
  await cdp.send('Page.navigate', { url }, sid);
  await waitFor(() => evalIn(sid, `location.protocol === 'chrome-extension:' && document.readyState === 'complete'`));
  await evalIn(sid, `document.fonts.ready.then(() => true)`);
  await sleep(900); // entrance motion settles
  return sid;
}
async function shoot(sid, name, { full = false } = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const out = [];
  for (const scheme of ['light', 'dark']) {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, sid);
    await sleep(300);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }, sid);
    const f = path.join(SHOTS, `${name}${scheme === 'dark' ? '-dark' : ''}.png`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    out.push(path.relative(REPO, f));
  }
  await cdp.send('Emulation.setEmulatedMedia', { features: [] }, sid);
  return out;
}
const fontCheck = (sid) => evalIn(sid, `[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(',') + ' | net: ' +
  performance.getEntriesByType('resource').map((r) => r.name).filter((u) => !u.startsWith('chrome-extension:')).join(',')`);

// Made-up events for the receipt (12 per condition, this week, not debug).
function fakeEvents(threadId) {
  const now = Date.now();
  const evs = [];
  for (let i = 0; i < 24; i++) {
    const condition = i % 2 ? 'control' : 'pickup';
    const leftAt = now - (i + 1) * 3600e3;
    const awayMs = (3 + (i % 5) * 4) * 60000;
    const returnedAt = leftAt + awayMs;
    const sec = condition === 'pickup' ? 6 + (i % 4) * 3 : 14 + (i % 5) * 4;
    evs.push({ id: `ev_test_${i}`, participant: 'screenshots', threadId, signal: 'tab', leftAt, returnedAt, firstInteractionAt: returnedAt + sec * 1000,
      condition, awayBucket: awayMs < 300000 ? '2-5' : awayMs < 900000 ? '5-15' : '15+', taskType: 'writing', nextActionDoneAt: null, debug: false,
      cardShown: condition === 'pickup', awayMs, distractionHost: 'youtube.com', distractionHosts: ['youtube.com'], returnVia: 'tab', plannedBreakMin: null });
  }
  return evs;
}

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  buildTestCopy(REPO, EXT);
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT }));
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  const sw = await waitFor(async () => (await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')), 15000);
  extId = new URL(sw.url).host;
  const base = `chrome-extension://${extId}/`;
  console.log('Browser', (await cdp.send('Browser.getVersion')).product, '| ext', extId);

  // Control page: settings, a task with a next step, made-up events.
  const ctl = await openPage(base + 'test/dev/inspect.html', { width: 800, height: 600 });
  await evalIn(ctl, `chrome.storage.local.set({ settings: { participant: 'screenshots', workSites: ['wikipedia.org'], distractionSites: ['youtube.com'],
    awayThresholdMs: 120000, nudgeDelayMin: 5, debug: false, forceCard: false, voiceEnabled: false, wakeWord: false } }).then(() => true)`);
  const essay = await evalIn(ctl, `chrome.tabs.create({ url: ${JSON.stringify(ESSAY)}, active: true }).then((t) => t.id)`);
  await waitFor(() => evalIn(ctl, `chrome.tabs.get(${essay}).then((t) => t.status === 'complete')`), 20000);
  const st = await evalIn(ctl, `chrome.runtime.sendMessage({ type: 'startTask', tabId: ${essay}, name: 'Drought Essay' })`);
  await evalIn(ctl, `chrome.runtime.sendMessage({ type: 'setNextStep', threadId: ${JSON.stringify(st.thread.id)}, nextStep: 'Find a source for the 2023 rainfall number' })`);
  await evalIn(ctl, `chrome.storage.local.set({ events: ${JSON.stringify(fakeEvents(st.thread.id))} }).then(() => true)`);

  // Popup, pointed at the essay tab.
  const hook = `if (globalThis.chrome && chrome.tabs) { const q = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (o) => (o && o.active && o.currentWindow) ? chrome.tabs.get(${essay}).then((t) => [t]) : q(o); }`;
  const popup = await openPage(base + 'src/pages/popup.html', { width: 360, height: 640, hook });
  await waitFor(() => evalIn(popup, `!!document.getElementById('task-name') && /Drought/.test(document.body.textContent)`), 5000);
  log.push('popup sees settings: ' + JSON.stringify(await evalIn(popup, `chrome.storage.local.get('settings').then((r) => r.settings && r.settings.workSites)`))
    + ' setup-needed hidden: ' + (await evalIn(popup, `document.getElementById('setup-needed').hidden`)));
  log.push('popup: ' + (await shoot(popup, 'popup', { full: true })).join(', ') + ' | fonts ' + (await fontCheck(popup)));

  const setup = await openPage(base + 'src/pages/setup.html', { width: 1280, height: 800 });
  log.push('setup: ' + (await shoot(setup, 'setup')).join(', ') + ' | fonts ' + (await fontCheck(setup)));

  const dash = await openPage(base + 'src/pages/dashboard.html', { width: 1280, height: 800 });
  log.push('dashboard: ' + (await shoot(dash, 'dashboard')).join(', ') + ' | fonts ' + (await fontCheck(dash)));
  await evalIn(dash, `document.getElementById('load-sample').click(); true`);
  await sleep(600);
  log.push('dashboard sample: ' + (await shoot(dash, 'dashboard-sample')).join(', '));

  // The receipt PNG, drawn by the page's own code from the stored (made-up) events.
  const png = await evalIn(dash, `(async () => {
    const { drawReceipt } = await import('./receipt.js');
    const { events = [] } = await chrome.storage.local.get('events');
    const { canvas, text } = await drawReceipt(events);
    return { url: canvas.toDataURL('image/png'), text };
  })()`);
  fs.writeFileSync(path.join(SHOTS, 'receipt.png'), Buffer.from(png.url.split(',')[1], 'base64'));
  log.push('receipt: docs-shots/receipt.png | ' + JSON.stringify(png.text));

  console.log(log.join('\n'));
}

main().catch((e) => { console.error('FAILED', e); process.exitCode = 1; }).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* gone */ }
  try { proc.kill(); } catch { /* gone */ }
});
