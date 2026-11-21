// DEV ONLY. Before/after screenshots for the v1.0.1 declutter, in real Chrome for Testing:
//   node test/dev/declutter-shots.mjs
// Setup at 1280x800 and 400x800, More settings closed and open; side panel at 360x800 with
// no task, one parked task, and a break running. Light theme. Test data only (a made-up
// "Drought Essay" task on Wikipedia). Writes docs/v4/after/declutter/after-*.png. Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestCopy, launch, sleep } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = path.join(os.tmpdir(), 'pickup-declutter-shots');
const OUT = path.join(REPO, 'docs/v4/after/declutter');
let cdp, proc;

async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function openPage(url, width, height) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false }, sessionId);
  for (let i = 0; i < 50; i++) { if (await evalIn(sessionId, `return document.readyState === 'complete';`).catch(() => false)) break; await sleep(200); }
  await sleep(900);
  return sessionId;
}
async function shot(sid, name, full = true) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }, sid);
  const f = path.join(OUT, `after-${name}.png`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  console.log(path.relative(REPO, f));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  buildTestCopy(REPO, path.join(SCRATCH, 'ext'));
  ({ proc, cdp } = await launch({ profile: path.join(SCRATCH, 'profile'), ext: path.join(SCRATCH, 'ext') }));
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  let sw;
  for (let i = 0; i < 75 && !sw; i++) { sw = (await cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')); if (!sw) await sleep(200); }
  const base = `chrome-extension://${new URL(sw.url).host}`;
  const ctl = await openPage(`${base}/test/dev/inspect.html`, 800, 600);
  const send = (msg) => evalIn(ctl, `return await chrome.runtime.sendMessage(${JSON.stringify(msg)});`);
  await evalIn(ctl, `await chrome.storage.local.set({ settings: { participant: 'shots', workSites: ['wikipedia.org'], distractionSites: ['youtube.com'], awayThresholdMs: 120000, nudgeDelayMin: 5 } }); return true;`);

  for (const [w, h] of [[1280, 800], [400, 800]]) {
    const sid = await openPage(`${base}/src/pages/setup.html`, w, h);
    await shot(sid, `setup-${w}-closed`);
    await evalIn(sid, `document.querySelectorAll('details').forEach((d) => { d.open = true; }); return true;`);
    await sleep(300);
    await shot(sid, `setup-${w}-open`);
  }

  let panel = await openPage(`${base}/src/voice/panel.html`, 360, 800);
  await shot(panel, 'panel-360-no-task', false);

  const tab = await evalIn(ctl, `return (await chrome.tabs.create({ url: 'https://en.wikipedia.org/wiki/Drought', active: true })).id;`);
  for (let i = 0; i < 100; i++) { if (await evalIn(ctl, `return (await chrome.tabs.get(${tab})).status === 'complete';`)) break; await sleep(200); }
  await send({ type: 'startTask', tabId: tab, name: 'Drought Essay' });
  await send({ type: 'voiceCommand', intent: 'park', args: { nextStep: 'find a source for the rainfall numbers' }, via: 'panel' });
  panel = await openPage(`${base}/src/voice/panel.html`, 360, 800);
  await shot(panel, 'panel-360-parked', false);

  await send({ type: 'cancelBreak' });
  await evalIn(ctl, `await chrome.tabs.update(${tab}, { active: true }); return true;`);
  await sleep(400);
  const r = await send({ type: 'startBreak', minutes: 10, nextStep: 'find a source for the rainfall numbers' });
  if (!r || !r.ok) console.log('startBreak:', JSON.stringify(r));
  panel = await openPage(`${base}/src/voice/panel.html`, 360, 800);
  await sleep(1200);
  await shot(panel, 'panel-360-break', false);
  proc.kill();
}

main().catch((e) => { console.error(e); try { proc && proc.kill(); } catch { /* gone */ } process.exitCode = 1; });
