// DEV ONLY. Drives the real voice side panel in Chrome for Testing with a fake mic
// that plays AUDIO (a WAV, e.g. made with `say -o x.aiff ...; afconvert -f WAVE -d LEI16@16000 x.aiff x.wav`).
//
//   AUDIO=/path/hey.wav PICKUP_SCRATCH=/tmp/x node test/dev/voice-panel-probe.mjs
//
// Needs the on-device model in that profile (run voice-spike-probe.mjs with INSTALL=1 first,
// same PICKUP_SCRATCH). Mic permission is granted with Browser.grantPermissions.
// Push-to-talk is triggered through the same session flag Alt+V sets (CDP can't press
// browser shortcuts). Never focuses Chrome by bundle id. Owner: Anish. Never shipped.

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
const out = [];
const say = (...a) => { const l = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); out.push(l); console.log(l); };
let cdp, proc;

const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;
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
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
    const t = (await targets()).find(match);
    if (t) return t;
  }
  return null;
}
const ui = (sid) => ev(sid, `({ status: document.getElementById('status').textContent, heard: document.getElementById('heard').textContent, reply: document.getElementById('reply').textContent, setup: document.getElementById('setup').hidden ? '' : document.getElementById('setupText').textContent, mic: document.getElementById('mic').disabled ? 'disabled' : 'enabled', wake: document.getElementById('wake').checked })`);

async function watch(sid, label, ms) {
  let last = '';
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
    const u = JSON.stringify(await ui(sid));
    if (u !== last) { say(`${new Date().toISOString().slice(11, 23)} ${label}`, u); last = u; }
  }
}

async function main() {
  buildTestCopy(REPO, EXT);
  const extraArgs = ['--use-fake-device-for-media-stream'];
  if (AUDIO) extraArgs.push(`--use-file-for-fake-audio-capture=${AUDIO}`);
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT, extraArgs }));
  const sw = await waitTarget((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'));
  const origin = new URL(sw.url).origin;
  await cdp.send('Browser.grantPermissions', { origin, permissions: ['audioCapture'] });
  const { targetId } = await cdp.send('Target.createTarget', { url: `${origin}/src/voice/spike.html` });
  const tab = await attach(targetId);
  await sleep(1200);
  say('on-device status:', await ev(tab, `SpeechRecognition.available({ langs: ['en-US'], processLocally: true })`));
  say('voice settings before:', await ev(tab, `chrome.runtime.sendMessage({ type: 'setVoiceSettings' })`));
  say('open panel:', await ev(tab, `__spike.openPanel()`, { gesture: true }));
  const pt = await waitTarget((t) => t.url === `${origin}/src/voice/panel.html`);
  if (!pt) throw new Error('panel target not found');
  const panel = await attach(pt.targetId);
  await sleep(1500);
  say('panel, voice off:', await ui(panel));
  say('turn voice on:', await ev(tab, `chrome.runtime.sendMessage({ type: 'setVoiceSettings', voiceEnabled: true })`));
  await sleep(1500);
  say('panel, voice on:', await ui(panel));

  if (AUDIO) {
    // Push-to-talk through the Alt+V path (same storage flag the command handler writes).
    say('--- push-to-talk (Alt+V path) ---');
    await ev(tab, `chrome.storage.session.set({ voiceShortcutAt: Date.now() })`);
    await watch(panel, 'ptt', 14000);
    say('--- wake word on ---');
    say('wake on:', await ev(tab, `chrome.runtime.sendMessage({ type: 'setVoiceSettings', wakeWord: true })`));
    await watch(panel, 'wake', Number(process.env.WAKE_MS || 45000));
    say('wake off:', await ev(tab, `chrome.runtime.sendMessage({ type: 'setVoiceSettings', wakeWord: false })`));
    await sleep(1000);
    say('panel end:', await ui(panel));
  }
}

main().catch((e) => say('PROBE ERROR', e.stack || e.message)).finally(async () => {
  try { await cdp.send('Browser.close'); } catch { /* closed */ }
  await sleep(500);
  try { proc && proc.kill(); } catch { /* gone */ }
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, 'panel-probe-output.txt'), out.join('\n') + '\n');
  process.exit(0);
});
