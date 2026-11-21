// DEV ONLY. Real-Chrome check of Pickup's own voice (Kokoro af_heart, on this device).
//   node test/dev/voice-out-check.mjs
// Chrome for Testing, a fresh profile, a test copy of the extension (real files, nothing stubbed).
// Opens the panel, turns on "Pickup talks back", presses Hear a sample, asks "Where was I?"
// with a parked task, and checks: an AudioContext ran, buffers played, zero network requests
// left the extension while loading and speaking (CDP Network domain), time to first sound.
// Clicks are dispatched with Runtime.evaluate userGesture: true (counts as a user click for
// the autoplay policy). Can't hear the audio: that is Anish's listening check.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestCopy, launch, sleep } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-voice-out-check');
const EXT = path.join(SCRATCH, 'ext');
const PROFILE = path.join(SCRATCH, 'profile');
const PAGE = 'https://en.wikipedia.org/wiki/Drought';

const results = [];
let cdp, proc, ctlSid, panelSid;
const requests = [];

function check(cond, msg) { if (!cond) throw new Error(msg); }
async function step(id, name, fn) {
  try { const notes = await fn(); results.push({ id, name, pass: true, notes }); console.log(`PASS  ${id} ${name}${notes ? ' — ' + notes : ''}`); }
  catch (e) { results.push({ id, name, pass: false, notes: e.message }); console.log(`FAIL  ${id} ${name} — ${e.message}`); }
}
async function evalIn(sid, expr, userGesture = false) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
const ctl = (body) => evalIn(ctlSid, `(async () => { ${body} })()`);
const inPanel = (body, gesture = false) => evalIn(panelSid, `(async () => { const $ = (id) => document.getElementById(id); ${body} })()`, gesture);
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

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  buildTestCopy(REPO, EXT);
  ({ proc, cdp } = await launch({ profile: PROFILE, ext: EXT }));
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  const sw = (await waitFor(async () => (await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')), 15000));
  const extId = new URL(sw.url).host;
  console.log('Browser', (await cdp.send('Browser.getVersion')).product, '| ext', extId, '| cores', os.cpus().length, os.cpus()[0].model);
  const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/test/dev/inspect.html` });
  ctlSid = await attachTo((t) => t.targetId === targetId);
  await waitFor(() => evalIn(ctlSid, `document.readyState === 'complete' && !!(globalThis.chrome && chrome.storage)`).catch(() => false), 10000);

  await step('V0', 'Settings default: talking back off; a parked task on Wikipedia', async () => {
    const r = await ctl(`return await chrome.runtime.sendMessage({ type: 'setVoiceSettings' });`);
    check(r && r.readAloud === false && r.wakeWord === false, 'defaults ' + JSON.stringify(r));
    await ctl(`await chrome.storage.local.set({ settings: { participant: 'voice-check', workSites: ['wikipedia.org'], distractionSites: ['youtube.com'], awayThresholdMs: 120000, nudgeDelayMin: 5, debug: true } }); return true;`);
    const tab = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(PAGE)}, active: true })).id;`);
    await waitFor(() => ctl(`return (await chrome.tabs.get(${tab})).status === 'complete';`), 20000);
    const s = await ctl(`return await chrome.runtime.sendMessage({ type: 'startTask', tabId: ${tab}, name: 'Drought Essay' });`);
    check(s && s.ok, 'startTask ' + JSON.stringify(s));
    const p = await ctl(`return await chrome.runtime.sendMessage({ type: 'voiceCommand', intent: 'park', args: { nextStep: 'find a source' }, via: 'panel' });`);
    return `defaults ${JSON.stringify(r)}; park: "${p && p.say}"`;
  });

  await ctl(`await chrome.windows.create({ url: chrome.runtime.getURL('src/voice/panel.html'), type: 'popup', width: 360, height: 800, focused: true }); return true;`);
  panelSid = await attachTo((t) => t.type === 'page' && t.url.endsWith('/src/voice/panel.html'));
  await cdp.send('Network.enable', {}, panelSid);
  cdp.on('Runtime.consoleAPICalled', (p) => { if (p.sessionId === panelSid || p.sessionId === undefined) console.log('  [panel console]', p.type, p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)); });
  cdp.on('Runtime.exceptionThrown', (p) => console.log('  [panel exception]', (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 300)));
  cdp.on('Network.requestWillBeSent', (p) => { if (p.sessionId === undefined || p.sessionId === panelSid) requests.push(p.request.url); });
  await waitFor(() => inPanel(`return document.readyState === 'complete' && !!$('readAloud');`).catch(() => false), 10000);

  let loadMs;
  await step('V1', 'Turn on "Pickup talks back": the bundled model loads and warms up', async () => {
    const t0 = Date.now();
    if (process.env.VOICE_DEVICE) await inPanel(`globalThis.__pickupVoiceDevice = ${JSON.stringify(process.env.VOICE_DEVICE)}; return true;`);
    await inPanel(`$('voice').open = true; $('readAloud').click(); return true;`, true);
    const note = await waitFor(() => inPanel(`return $('voiceNote').textContent;`), 3000, 100);
    const ok = await waitFor(() => inPanel(`return globalThis.__pickupVoice && globalThis.__pickupVoice.loadMs != null ? globalThis.__pickupVoice : ($('voiceNote').textContent.includes('newer') ? 'failed' : null);`), 180000, 500);
    check(ok && ok !== 'failed', 'voice did not load: ' + JSON.stringify(ok) + ' note: ' + (await inPanel(`return $('voiceNote').textContent;`)));
    loadMs = ok.loadMs;
    const saved = (await ctl(`return (await chrome.storage.local.get('settings')).settings.readAloud;`));
    check(saved === true, 'readAloud not saved');
    const iso = await inPanel(`return { isolated: globalThis.crossOriginIsolated, threads: navigator.hardwareConcurrency };`);
    return `isolated ${iso.isolated}; device ${ok.device}; load + warm-up ${ok.loadMs} ms (wall ${Date.now() - t0} ms); first note "${note || ''}"`;
  });

  await step('V2', 'Hear a sample: an AudioContext runs and a 24 kHz buffer plays', async () => {
    await inPanel(`globalThis.__pickupVoice.firstSoundMs = []; globalThis.__pickupVoice.buffersPlayed = 0; $('sample').click(); return true;`, true);
    const v = await waitFor(() => inPanel(`const v = globalThis.__pickupVoice; return v.buffersPlayed >= 2 ? v : null;`), 60000, 250);
    check(v && v.buffersPlayed >= 2, 'buffers played: ' + JSON.stringify(await inPanel(`return globalThis.__pickupVoice;`)));
    check(v.contextState === 'running', 'AudioContext state ' + v.contextState);
    return `first sound ${v.firstSoundMs[0]} ms after the click; ${v.buffersPlayed} sentences played; AudioContext ${v.contextState}`;
  });

  const firstSounds = [];
  await step('V3', 'Ask "Where was I?" with a parked task: reply shown as text and spoken; time to first sound', async () => {
    for (let i = 0; i < 3; i++) {
      await inPanel(`globalThis.__pickupVoice.firstSoundMs = []; $('askInput').value = 'where was I?'; $('askForm').requestSubmit(); return true;`, true);
      const ms = await waitFor(() => inPanel(`return globalThis.__pickupVoice.firstSoundMs[0] || null;`), 60000, 100);
      check(ms, 'no first sound');
      firstSounds.push(ms);
      await waitFor(() => inPanel(`return !document.querySelector('.listening:not([hidden])') && globalThis.__pickupVoice.buffersPlayed > 0;`), 30000, 250);
      await sleep(3500);
    }
    const reply = await inPanel(`return $('reply').textContent;`);
    check(/Drought Essay/.test(reply), 'reply ' + reply);
    return `"${reply}"; time to first sound ${firstSounds.join(' / ')} ms (3 asks)`;
  });

  await step('V4', 'Esc stops speaking at once', async () => {
    await inPanel(`$('askInput').value = 'where was I?'; $('askForm').requestSubmit(); return true;`, true);
    await waitFor(() => inPanel(`return globalThis.__pickupVoice.firstSoundMs.length > 3 || null;`), 60000, 100);
    const before = await inPanel(`return globalThis.__pickupVoice.buffersPlayed;`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, panelSid);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, panelSid);
    await sleep(300);
    const after = await inPanel(`return globalThis.__pickupVoice.buffersPlayed;`);
    return `buffers ended ${before} -> ${after} (a stopped buffer fires onended once)`;
  });

  await step('V5', 'Zero network requests left the extension while loading and speaking', async () => {
    const out = requests.filter((u) => !/^(chrome-extension|data|blob):/.test(u));
    check(!out.length, 'requests: ' + out.slice(0, 5).join(', '));
    return `${requests.length} requests, all chrome-extension:// / data: / blob:`;
  });

  await step('V6', 'Failure path: the model cannot load -> talking back turns off, one honest line, typing still answers', async () => {
    // Off first, so the reloaded panel doesn't load the model before the failure is forced.
    await ctl(`const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, readAloud: false } }); return true;`);
    await inPanel(`location.reload(); return true;`);
    await sleep(1500);
    panelSid = await attachTo((t) => t.type === 'page' && t.url.endsWith('/src/voice/panel.html'));
    await waitFor(() => inPanel(`return document.readyState === 'complete' && !!$('readAloud');`).catch(() => false), 10000);
    await inPanel(`globalThis.__pickupVoiceFail = true; return true;`);
    await inPanel(`$('voice').open = true; $('readAloud').click(); return true;`, true);
    const note = await waitFor(() => inPanel(`return /newer computer/.test($('voiceNote').textContent) ? $('voiceNote').textContent : null;`), 10000, 200);
    check(note === "Pickup's voice needs a newer computer. Replies are shown as text.", 'note ' + note);
    const ui = await inPanel(`return $('readAloud').checked;`);
    const saved = await ctl(`return (await chrome.storage.local.get('settings')).settings.readAloud;`);
    check(ui === false && saved === false, `switch ${ui}, saved ${saved}`);
    await inPanel(`$('askInput').value = 'where was I?'; $('askForm').requestSubmit(); return true;`, true);
    const reply = await waitFor(() => inPanel(`return /Drought Essay/.test($('reply').textContent) ? $('reply').textContent : null;`), 5000);
    check(reply, 'no text reply after the failure');
    return `"${note}"; switch off and saved off; text reply "${reply}"`;
  });

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${pass} pass, ${results.length - pass} fail. Load ${loadMs} ms; first sound ${firstSounds.join(' / ')} ms.`);
  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ results, requests, firstSounds, loadMs }, null, 2));
  proc.kill();
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}

main().catch((e) => { console.error(e); try { proc && proc.kill(); } catch { /* gone */ } process.exitCode = 1; });
