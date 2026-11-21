// DEV ONLY. Voice Phase 0 probe: loads a scratch copy of the extension in Chrome for
// Testing and answers what a script can answer without a human at the mic.
//
//   node test/dev/voice-spike-probe.mjs                 # API shape, available(), voices, sidePanel.open
//   INSTALL=1 node test/dev/voice-spike-probe.mjs       # also call install() (downloads the on-device model into the throwaway profile)
//   AUDIO=/path/file.wav INSTALL=1 node ...             # also run recognition on a fake mic that plays the file
//
// The fake mic (--use-fake-device-for-media-stream) means the real microphone is never opened.
// Mic permission is granted with Browser.setPermission (a script can't click Chrome's prompt).
// Owner: Anish (Engine). Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestCopy, launch, sleep } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-voice-probe');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const AUDIO = process.env.AUDIO;
const INSTALL = process.env.INSTALL === '1';
const PAGE = process.env.PAGE || 'src/voice/spike.html';

const out = [];
const say = (...a) => { const l = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); out.push(l); console.log(l); };

let cdp, proc;
async function targets() { return (await cdp.send('Target.getTargets')).targetInfos; }
async function attach(targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  return sessionId;
}
async function ev(sid, expr, { gesture = false, timeout = 30000 } = {}) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: gesture }, sid, timeout);
  if (r.exceptionDetails) return 'EXCEPTION ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0];
  return r.result.value;
}
async function waitTarget(match, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = (await targets()).find(match);
    if (t) return t;
    await sleep(200);
  }
  return null;
}
const pageLog = (sid) => ev(sid, `(async () => { const all = await chrome.storage.session.get(null); return Object.entries(all).filter(([k]) => k.startsWith('voiceSpikeLog:')).flatMap(([, v]) => v).sort((a, b) => a.t - b.t).map((l) => new Date(l.t).toISOString().slice(11, 23) + ' [' + l.ctx + '] ' + l.msg); })()`);

async function main() {
  buildTestCopy(REPO, EXT);
  const extraArgs = ['--use-fake-device-for-media-stream'];
  if (AUDIO) extraArgs.push(`--use-file-for-fake-audio-capture=${AUDIO}`);
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT, extraArgs }));
  const sw = await waitTarget((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'));
  if (!sw) throw new Error('extension service worker not found');
  const extId = new URL(sw.url).host;
  const origin = `chrome-extension://${extId}`;
  say('extension id', extId);
  const ver = await cdp.send('Browser.getVersion');
  say('browser', ver.product);

  // 1. spike page in a tab
  const { targetId } = await cdp.send('Target.createTarget', { url: `${origin}/${PAGE}` });
  const tab = await attach(targetId);
  await sleep(1500);
  say('tab: where =', await ev(tab, `__spike.detectWhere()`));
  say('tab: API shape =', await ev(tab, `__spike.apiShape()`));
  say('tab: available() =', await ev(tab, `__spike.available()`));

  say('tab: sidePanel.open without gesture ->', await ev(tab, `__spike.openPanel()`));
  say('tab: sidePanel.open with gesture ->', await ev(tab, `__spike.openPanel()`, { gesture: true }));
  const panelT = await waitTarget((t) => t.url.startsWith(`${origin}/src/voice/`) && t.targetId !== targetId, 5000);
  say('side panel target:', panelT ? `${panelT.type} ${panelT.url}` : 'NOT FOUND');
  say('contexts:', await ev(tab, `(async () => (await chrome.runtime.getContexts({})).map(c => c.contextType + ' ' + c.documentUrl))()`));
  let panel = null;
  if (panelT) {
    panel = await attach(panelT.targetId);
    await sleep(1000);
    say('panel: where =', await ev(panel, `__spike.detectWhere()`));
    say('panel: available() =', await ev(panel, `__spike.available()`));
    say('panel: mic state before grant =', await ev(panel, `__spike.micState()`));
    // Does the panel get a prompt? A prompt would leave getUserMedia pending; a refusal rejects fast.
    say('panel: getUserMedia before grant (8 s race) =', await ev(panel, `Promise.race([__spike.micHere(), new Promise(r => setTimeout(() => r('STILL PENDING after 8 s (a prompt may be showing)'), 8000))])`, { gesture: true }));
  }

  // grant the mic to the extension origin (stands in for the Enable tab's prompt click)
  try {
    await cdp.send('Browser.grantPermissions', { origin, permissions: ['audioCapture'] });
    say('granted audioCapture to', origin, 'via Browser.grantPermissions');
  } catch (e) { say('Browser.setPermission failed:', e.message); }
  if (panel) {
    say('panel: mic state after grant =', await ev(panel, `__spike.micState()`));
    say('panel: getUserMedia after grant (15 s race) =', await ev(panel, `Promise.race([__spike.micHere(), new Promise(r => setTimeout(() => r('STILL PENDING after 15 s'), 15000))])`, { gesture: true }));
  }
  const ctx = panel || tab;

  // Poll available(): a fresh profile may already be downloading the model.
  for (let i = 0; i < Number(process.env.POLL_S || 0); i += 5) {
    const a = await ev(ctx, `SpeechRecognition.available({ langs: ['en-US'], processLocally: true })`);
    if (i % 30 === 0 || a !== 'downloading') say(`available() at +${i} s =`, a);
    if (a !== 'downloading') break;
    await sleep(5000);
  }

  if (INSTALL) {
    const t0 = Date.now();
    say('install() with gesture ->', await ev(ctx, `__spike.install()`, { gesture: true, timeout: 600000 }), `after ${Math.round((Date.now() - t0) / 1000)} s`);
    say('available() after install =', await ev(ctx, `__spike.available()`));
  }

  if (AUDIO) {
    say('start listening:', await ev(ctx, `(__spike.startListening(), __spike.state.want)`, { gesture: true }));
    await sleep(Number(process.env.LISTEN_MS || 45000));
    await ev(ctx, `__spike.stopListening()`);
    await sleep(1500);
    say('listen state:', await ev(ctx, `({ sessions: __spike.state.session, restarts: __spike.state.restarts, results: __spike.state.results, wakes: [...__spike.state.wakeSeen] })`));
  }

  say('--- page log ---');
  for (const l of (await pageLog(ctx)) || []) say(l);
}

main().catch((e) => say('PROBE ERROR', e.stack || e.message)).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* already closed */ }
  await sleep(500);
  try { proc && proc.kill(); } catch { /* gone */ }
  const f = path.join(SCRATCH, 'probe-output.txt');
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(f, out.join('\n') + '\n');
  console.log('wrote', f);
  process.exit(0);
});
