// DEV ONLY. Palette screenshots, light and dark, into docs-shots/palette/: popup (its real
// 360 px width), setup, dashboard with sample data, side panel, return card and overlay
// (Sidd's preview page), the five toolbar badge states, the receipt PNG and the website hero.
// Pages are 1280x800 @2x.
//
//   node test/dev/palette-shots.mjs
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
import { BADGE } from '../../src/shared/constants.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-palette-shots');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const SHOTS = path.join(REPO, 'docs-shots', 'palette');
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
  await waitFor(() => evalIn(sid, `location.protocol !== 'about:' && document.readyState === 'complete'`));
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
  log.push('popup: ' + (await shoot(popup, 'popup', { full: true })).join(', ') + ' | fonts ' + (await fontCheck(popup)));

  const setup = await openPage(base + 'src/pages/setup.html', { width: 1280, height: 800 });
  log.push('setup: ' + (await shoot(setup, 'setup')).join(', ') + ' | fonts ' + (await fontCheck(setup)));

  const dash = await openPage(base + 'src/pages/dashboard.html', { width: 1280, height: 800 });
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
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, 'receipt.png'), Buffer.from(png.url.split(',')[1], 'base64'));
  log.push('receipt: docs-shots/palette/receipt.png | ' + png.text.headline);

  // Side panel (its own page at 1280x800, like the pages).
  const panel = await openPage(base + 'src/voice/panel.html', { width: 1280, height: 800 });
  await waitFor(() => evalIn(panel, `!!document.querySelector('.task-name')`), 5000);
  log.push('panel: ' + (await shoot(panel, 'panel')).join(', '));

  // Return card and overlay: Sidd's preview page over file:// (it has an inline script).
  const prev = await openPage('file://' + path.join(REPO, 'test/dev/card-preview.html'), { width: 1280, height: 800 });
  await evalIn(prev, `document.querySelector('[data-demo="full"]').click(); true`); await sleep(1500);
  log.push('card: ' + (await shoot(prev, 'card')).join(', '));
  await evalIn(prev, `document.querySelector('[data-demo="ov2"]').click(); true`); await sleep(1500);
  log.push('overlay: ' + (await shoot(prev, 'overlay')).join(', '));

  // Toolbar badge states (BADGE has one colour per state; the glyph is white).
  const states = [['P', BADGE.parked.color, 'Parked'], [BADGE.away.text, BADGE.away.color, 'Away'], [BADGE.wrapped.text, BADGE.wrapped.color, 'Wrapped up'],
    ['✓', BADGE.flash['✓'], 'Saved'], ['?', BADGE.flash.default, 'No task yet'], ['9m', BADGE.timer.color, 'Break timer']];
  const strip = path.join(SCRATCH, 'badges.html');
  fs.writeFileSync(strip, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="file://${path.join(REPO, 'src/shared/tokens.css')}">
<style>body{margin:0;background:var(--paper);color:var(--ink);font:500 18px/1.4 var(--font-sans);display:grid;place-items:center;height:100vh}
.s{display:flex;gap:40px}.b{display:grid;justify-items:center;gap:12px}.g{min-width:64px;height:64px;padding:0 14px;border-radius:14px;display:grid;place-items:center;color:#fff;font:700 34px/1 system-ui}</style>
<div class="s">${states.map(([g, c, l]) => `<div class="b"><div class="g" style="background:${c}">${g}</div>${l}<code>${c}</code></div>`).join('')}</div>`);
  const badges = await openPage('file://' + strip, { width: 1280, height: 800 });
  log.push('badges: ' + (await shoot(badges, 'badges')).join(', '));

  // Calm colours: the same pages with settings.calm on.
  await evalIn(ctl, `chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, calm: true } })).then(() => true)`);
  const popupCalm = await openPage(base + 'src/pages/popup.html', { width: 360, height: 640, hook });
  log.push('popup calm: ' + (await shoot(popupCalm, 'popup-calm', { full: true })).join(', ') + ' | data-calm ' + (await evalIn(popupCalm, `document.documentElement.hasAttribute('data-calm')`)));
  const setupCalm = await openPage(base + 'src/pages/setup.html', { width: 1280, height: 800 });
  log.push('setup calm: ' + (await shoot(setupCalm, 'setup-calm')).join(', '));

  // Website hero.
  const site = await openPage('file://' + path.join(REPO, 'site/index.html'), { width: 1280, height: 800 });
  log.push('site hero: ' + (await shoot(site, 'site-hero')).join(', '));

  console.log(log.join('\n'));
}

main().catch((e) => { console.error('FAILED', e); process.exitCode = 1; }).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* gone */ }
  try { proc.kill(); } catch { /* gone */ }
});
