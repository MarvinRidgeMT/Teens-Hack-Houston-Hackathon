// DEV ONLY. Real screenshots for the download site (site/assets/), taken from the
// real extension in Chrome for Testing: Sidd's card and overlay (origin/sid/content),
// the Pickup panel (feature/panel) and the engine (main). Nothing is mocked: every
// image is the product running against a local essay page.
//
//   node test/dev/site-shots.mjs
//
// Builds a throwaway test copy = this checkout + `src/` from feature/panel +
// src/content and src/vendor from origin/sid/content. It never edits the shipped files.
// Serves test/dev/essay.html on 127.0.0.1 (the work site) and a plain page on
// localhost (the distraction site). 1280x800 at device scale 2; the panel at 360x800.
// Owner: Anish (Engine). Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { buildTestCopy, launch, sleep, activatePid, frontmost, CFT_BUNDLE } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-site-shots');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const RAW = path.join(SCRATCH, 'raw');
const PANEL_REF = process.env.PANEL_REF || 'feature/panel';
const CONTENT_REF = process.env.CONTENT_REF || 'origin/sid/content';

let cdp, proc, extId, ctlSid, swSid;
const log = (...a) => console.log(...a);
const swLog = [];
function check(cond, msg) { if (!cond) throw new Error(`${msg} [front: ${frontmost().name}; SW: ${swLog.slice(-6).join(' | ')}]`); }
async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
const ctl = (body) => evalIn(ctlSid, `(async () => { ${body} })()`);
const sendSW = (msg) => ctl(`return await chrome.runtime.sendMessage(${JSON.stringify(msg)});`);
const local = () => ctl(`return await chrome.storage.local.get(null);`);
async function waitFor(fn, ms = 10000, every = 250) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { last = await fn(); } catch { last = null; } if (last) return last; await sleep(every); }
  return last;
}
const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;
async function attachTo(match) {
  for (let i = 0; i < 80; i++) {
    const t = (await targets()).find(match);
    if (t) {
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      if (t.type === 'page') await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      return sessionId;
    }
    await sleep(200);
  }
  throw new Error('target not found');
}
async function shot(sid, name) {
  fs.mkdirSync(RAW, { recursive: true });
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const f = path.join(RAW, `${name}.png`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  log('  shot', name);
  return f;
}
async function key(sid, k, code, keyCode, text) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode, text }, sid);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode }, sid);
}

function serve() {
  const essay = fs.readFileSync(path.join(REPO, 'test/dev/essay.html'));
  const video = '<!doctype html><meta charset="utf-8"><title>Videos</title><body style="margin:0;background:#0f0f0f;color:#fff;font:20px system-ui;display:grid;place-items:center;height:100vh">A video site (stand-in)</body>';
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.headers.host.startsWith('localhost') ? video : essay);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function buildCopy() {
  for (const ref of [PANEL_REF, CONTENT_REF]) check(/^[\w./-]+$/.test(ref), `not a plain git ref: ${ref}`); // they go into a shell command
  buildTestCopy(REPO, EXT);
  // Overlay the panel and Sidd's real content scripts (read from git; nothing in the repo changes).
  execSync(`git -C "${REPO}" archive ${PANEL_REF} src manifest.json | tar -x -C "${EXT}"`);
  execSync(`git -C "${REPO}" archive ${CONTENT_REF} src/content src/vendor | tar -x -C "${EXT}"`);
  const mfPath = path.join(EXT, 'manifest.json');
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  mf.host_permissions = ['http://127.0.0.1/*', 'http://localhost/*'];
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.rmSync(RAW, { recursive: true, force: true });
  buildCopy();
  const srv = await serve();
  const port = srv.address().port;
  const ESSAY = `http://127.0.0.1:${port}/essay`;
  const VIDEO = `http://localhost:${port}/watch`;
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT, extraArgs: ['--window-size=1280,900', '--hide-scrollbars'] }));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const t = p.args.map((a) => (typeof a.value === 'string' ? a.value : a.value !== undefined ? JSON.stringify(a.value) : a.description || '')).join(' ');
    if (t.startsWith('[Pickup]')) swLog.push(t.slice(9));
  });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  swSid = await attachTo((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'));
  extId = new URL((await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')).url).host;
  const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/test/dev/inspect.html` });
  ctlSid = await attachTo((t) => t.targetId === targetId);
  await waitFor(() => evalIn(ctlSid, `location.protocol === 'chrome-extension:' && !!(globalThis.chrome && chrome.storage)`), 10000);
  log('ext', extId, 'essay', ESSAY);

  await ctl(`await chrome.storage.local.set({ settings: { participant: 'site-shots', workSites: ['127.0.0.1'], distractionSites: ['localhost'],
    awayThresholdMs: 120000, nudgeDelayMin: 5, debug: true, forceCard: true } }); return true;`);
  await ctl(`try { await chrome.scripting.unregisterContentScripts({ ids: ['pickup-shots'] }); } catch {}
    await chrome.scripting.registerContentScripts([{ id: 'pickup-shots', matches: ['http://127.0.0.1/*'],
      js: ['src/vendor/motion.js', 'src/vendor/anime.umd.min.js', 'src/content/card.js', 'src/content/overlay.js', 'src/content/docs.js', 'src/content/content.js'],
      allFrames: true, runAt: 'document_idle' }]); return true;`);

  activatePid(proc.pid, CFT_BUNDLE); // tab switches only count in the focused window
  await sleep(500);
  const essay = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(ESSAY)}, active: true })).id;`);
  const essaySid = await attachTo((t) => t.type === 'page' && t.url.startsWith(ESSAY));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, essaySid);
  await waitFor(() => evalIn(essaySid, `document.readyState === 'complete'`), 10000);
  await sleep(1500);
  const start = await sendSW({ type: 'startTask', tabId: essay, name: 'Climate Essay' });
  check(start && start.ok, 'startTask ' + JSON.stringify(start));
  const video = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(VIDEO)}, active: false })).id;`);

  // Scroll to the numbers paragraph and highlight a sentence (a real selection).
  await evalIn(essaySid, `(() => {
    const p = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Rainfall has been below average'));
    p.scrollIntoView({ block: 'center' });
    const r = document.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, 'Rainfall has been below average since 2023'.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await sleep(2600); // the content script's state message is debounced 2 s

  // 1. Leave: the park overlay (Alt+P path: popup park message -> openOverlay).
  await sendSW({ type: 'park', tabId: essay });
  await sleep(900);
  await shot(essaySid, 'leave-overlay-empty');
  await cdp.send('Input.insertText', { text: 'Find a source for the 2023 rainfall number' }, essaySid);
  await sleep(300);
  await shot(essaySid, 'leave-overlay');
  await key(essaySid, 'Enter', 'Enter', 13, '\r');
  await sleep(450);
  await shot(essaySid, 'parked-pill');
  await sleep(1500);

  // Keep the spot: Pickup saves where you are when you leave, and Resume brings you back to it.

  // 2. Drift: leave for the video page; the panel shows the task as away.
  activatePid(proc.pid, CFT_BUNDLE);
  await sleep(300);
  await ctl(`await chrome.tabs.update(${video}, { active: true }); return true;`);
  await sleep(12000); // past the 10 s debug threshold
  const ob = (await local()).openBreak;
  check(ob && ob.departed, 'no break: ' + JSON.stringify(ob));
  const panelWin = await ctl(`return (await chrome.windows.create({ url: chrome.runtime.getURL('src/voice/panel.html'), type: 'popup', width: 360, height: 800, focused: false })).id;`);
  const panelSid = await attachTo((t) => t.type === 'page' && t.url.endsWith('/src/voice/panel.html'));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: false }, panelSid);
  await waitFor(() => evalIn(panelSid, `!!document.querySelector('.task')`), 10000);
  // The site shows the panel as a user sees it: debug off just for this shot (on again before the return).
  await ctl(`const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, debug: false } }); return true;`);
  await sleep(600);
  await evalIn(panelSid, `(async () => { document.getElementById('askInput').value = 'where was I?'; document.getElementById('askForm').requestSubmit(); return true; })()`);
  await sleep(1200);
  await shot(panelSid, 'panel');

  await ctl(`const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, debug: true } }); return true;`);
  await sleep(400);
  // 3. Return: back to the essay; forceCard draws Sidd's card.
  await ctl(`await chrome.tabs.update(${essay}, { active: true }); return true;`);
  await sleep(1600);
  await shot(essaySid, 'card');

  // 4. Resume: Enter on the card restores the scroll.
  await key(essaySid, 'Enter', 'Enter', 13, '\r');
  await sleep(1800);
  await shot(essaySid, 'resume');
  const ev = (await local()).events.at(-1);
  log('  event', ev && ev.condition, ev && ev.returnVia, 'scroll now', await evalIn(essaySid, 'Math.round(scrollY)'));

  // Install poster: chrome://extensions with Developer mode on.
  const ext = await cdp.send('Target.createTarget', { url: 'chrome://extensions' });
  const extSid = await attachTo((t) => t.targetId === ext.targetId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, extSid);
  await sleep(1500);
  await evalIn(extSid, `(async () => { try { await chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }); } catch (e) { return String(e); } return true; })()`);
  await sleep(1200);
  await shot(extSid, 'install-poster');

  await ctl(`await chrome.windows.remove(${panelWin}); return true;`).catch(() => {});
  srv.close();
  log('raw shots in', RAW);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* gone */ }
  try { proc.kill(); } catch { /* gone */ }
  setTimeout(() => process.exit(), 500);
});
