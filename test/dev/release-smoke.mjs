// DEV ONLY. Smoke test of the release zip, unzipped, in a fresh Chrome for Testing profile,
// with the REAL content scripts (Sidd's card and overlay) registered by the REAL setup page.
//
//   scripts/make-release.sh && node test/dev/release-smoke.mjs [path/to/pickup-v1.0.0.zip]
//
// Flow: setup page (real Save click) -> start task -> park with a next step (overlay) ->
// leave to a distraction page -> return -> card -> Enter (Resume) -> scroll restored.
// Also: the shortcut labels on the popup and setup page, getShortcuts, console errors from
// every extension context and the work page, and a screenshot of chrome://extensions/shortcuts.
//
// The only change to the unzipped copy: manifest host_permissions for the two test hosts,
// because CDP can't click Chrome's site-access prompt. *.test hosts map to 127.0.0.1.
// Owner: Anish (Engine). Never shipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { launch, sleep, activatePid, CFT_BUNDLE } from './cdp-driver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ZIP = path.resolve(process.argv[2] || path.join(REPO, 'pickup-v1.0.0.zip'));
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-release-smoke');
const UNZIP = path.join(SCRATCH, 'unzipped');
const PROFILE = path.join(SCRATCH, 'profile');
const OUT = path.join(SCRATCH, 'out');
const NEXT = 'Find a source for the 2023 rainfall number';

let cdp, proc, extId, ctlSid;
const errors = [];
const results = [];
const log = (...a) => console.log(...a);
function check(cond, msg) { if (!cond) throw new Error(msg); }
async function step(name, fn) {
  try { const note = await fn(); results.push(['ok  ', name, note || '']); log(`ok    ${name}${note ? ' — ' + note : ''}`); }
  catch (e) { results.push(['FAIL', name, e.message]); log(`FAIL  ${name} — ${e.message}`); throw e; }
}
async function evalIn(sid, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
  return r.result.value;
}
const ctl = (body) => evalIn(ctlSid, `(async () => { ${body} })()`);
const sendSW = (msg) => ctl(`return await chrome.runtime.sendMessage(${JSON.stringify(msg)});`);
const local = () => ctl('return await chrome.storage.local.get(null);');
async function waitFor(fn, ms = 10000, every = 250) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { last = await fn(); } catch { last = null; } if (last) return last; await sleep(every); }
  return last;
}
const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;
async function attachTo(match, label) {
  for (let i = 0; i < 80; i++) {
    const t = (await targets()).find(match);
    if (t) {
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      if (t.type === 'page') await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Log.enable', {}, sessionId).catch(() => {});
      return sessionId;
    }
    await sleep(200);
  }
  throw new Error('target not found: ' + label);
}
async function shot(sid, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const f = path.join(OUT, `${name}.png`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  return f;
}
async function key(sid, k, code, keyCode, text) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode, text }, sid);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode }, sid);
}
async function click(sid, selector) {
  const pos = await evalIn(sid, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, sid);
}

function unzip() {
  check(fs.existsSync(ZIP), `no zip at ${ZIP} (run scripts/make-release.sh)`);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(UNZIP, { recursive: true });
  execFileSync('unzip', ['-q', ZIP, '-d', UNZIP]);
  const [dir] = fs.readdirSync(UNZIP);
  const ext = path.join(UNZIP, dir);
  // The zip as shipped must pass the static checks before the test edits its manifest.
  const r = spawnSync(process.execPath, [path.join(REPO, 'test/check-integration.mjs'), '--root', ext], { encoding: 'utf8' });
  const summary = r.stdout.trim().split('\n').at(-1);
  check(r.status === 0, `check-integration on the unzipped release: ${summary}\n${r.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join('\n')}`);
  results.push(['ok  ', 'check-integration --root <unzipped zip>', summary]);
  log(`ok    check-integration --root <unzipped zip> — ${summary}`);
  const mfPath = path.join(ext, 'manifest.json');
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  mf.host_permissions = ['http://essay.test/*', 'http://*.essay.test/*', 'http://video.test/*'];
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));
  return ext;
}

function serve() {
  const essay = fs.readFileSync(path.join(REPO, 'test/dev/essay.html'));
  const video = '<!doctype html><meta charset="utf-8"><title>Videos</title><body>A video site (stand-in)</body>';
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end((req.headers.host || '').startsWith('video.test') ? video : essay);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function main() {
  const ext = unzip();
  const srv = await serve();
  const port = srv.address().port;
  const ESSAY = `http://essay.test:${port}/essay`;
  const VIDEO = `http://video.test:${port}/watch`;
  ({ proc, cdp } = await launch({ profile: PROFILE, ext, extraArgs: ['--window-size=1280,900', `--host-resolver-rules=MAP *.test 127.0.0.1`] }));
  cdp.on('Runtime.exceptionThrown', (p, sid) => errors.push(`exception: ${p.exceptionDetails.exception?.description?.split('\n')[0] || p.exceptionDetails.text}`));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type !== 'error') return;
    errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  cdp.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push(`log: ${p.entry.text} ${p.entry.url || ''}`); });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
  const swSid = await attachTo((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js'), 'service worker');
  extId = new URL((await targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/src/sw/background.js')).url).host;
  log('ext', extId, 'from', ext);

  // The install opens the setup page (onInstalled -> openOptionsPage).
  let setupSid;
  await step('setup page opens on install', async () => {
    setupSid = await attachTo((t) => t.type === 'page' && t.url.includes(`${extId}/src/pages/setup.html`), 'setup page');
    await waitFor(() => evalIn(setupSid, `document.readyState === 'complete'`));
    ctlSid = setupSid;
    return 'src/pages/setup.html';
  });

  await step('getShortcuts answers with this OS\'s keys', async () => {
    const s = await sendSW({ type: 'getShortcuts' });
    check(s && s.ok, JSON.stringify(s));
    check(s.park && s.resume && s.panel, 'a key is not set: ' + JSON.stringify(s));
    return `${s.platform}: park ${s.park}, resume ${s.resume}, panel ${s.panel}, wrap-up ${s.wrapUp || '(none)'}`;
  });

  await step('setup page shows the same keys', async () => {
    const s = await sendSW({ type: 'getShortcuts' });
    const shown = await waitFor(() => evalIn(setupSid, `(() => { const t = [...document.querySelectorAll('.st-keys [data-shortcut]')].map((e) => e.textContent); return t.every(Boolean) ? t : null; })()`));
    check(JSON.stringify(shown) === JSON.stringify([s.park, s.resume, s.panel]), `setup shows ${JSON.stringify(shown)}`);
    return shown.join(' / ');
  });

  await step('setup: real Save click (work essay.test, distraction video.test, debug + force card)', async () => {
    await evalIn(setupSid, `(() => {
      const add = (kind, v) => { document.getElementById(kind + '-add-input').value = v; document.getElementById(kind + '-add').click(); };
      add('work', 'essay.test'); add('distraction', 'video.test');
      document.getElementById('participant').value = 'release-smoke';
      for (const id of ['debug', 'force-card']) { const c = document.getElementById(id); if (!c.checked) c.click(); }
      return true; })()`);
    await click(setupSid, '#save');
    const st = await waitFor(async () => { const s = (await local()).settings; return s && s.workSites && s.workSites.includes('essay.test') ? s : null; }, 8000);
    check(st, 'settings not saved; status: ' + await evalIn(setupSid, `document.body.innerText.match(/(Saved|Nothing saved)[^\\n]*/)?.[0] || ''`));
    const reg = await ctl(`return (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id + ':' + s.js.length);`);
    check(reg.length === 1, 'registered: ' + JSON.stringify(reg));
    return `settings saved; content script ${reg[0]} files`;
  });

  activatePid(proc.pid, CFT_BUNDLE);
  await sleep(400);
  const essay = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(ESSAY)}, active: true })).id;`);
  const essaySid = await attachTo((t) => t.type === 'page' && t.url.startsWith(ESSAY), 'essay');
  await waitFor(() => evalIn(essaySid, `document.readyState === 'complete'`));

  await step('the real content script answers in the work tab', async () => {
    const snap = await waitFor(() => ctl(`try { return await chrome.tabs.sendMessage(${essay}, { type: 'snapshot' }, { frameId: 0 }); } catch { return null; }`), 10000);
    check(snap && snap.url, 'no snapshot reply');
    return `snapshot url ${snap.url}`;
  });

  await step('start task', async () => {
    const r = await sendSW({ type: 'startTask', tabId: essay, name: 'Climate Essay' });
    check(r && r.ok, JSON.stringify(r));
    return `thread "${r.thread.name}"`;
  });

  let savedY = 0;
  await step('park with a next step (overlay, real typing, Enter)', async () => {
    savedY = await evalIn(essaySid, `(() => {
      const p = [...document.querySelectorAll('p')].find((x) => x.textContent.startsWith('Rainfall has been below average'));
      p.scrollIntoView({ block: 'center' });
      const r = document.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, 'Rainfall has been below average since 2023'.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); return Math.round(scrollY); })()`);
    await sleep(2600); // state is debounced 2 s
    await sendSW({ type: 'park', tabId: essay });
    await sleep(900);
    check(await evalIn(essaySid, `!!document.querySelector('pickup-ui')`), 'no overlay host in the page');
    await cdp.send('Input.insertText', { text: NEXT }, essaySid);
    await sleep(300);
    await shot(essaySid, '1-overlay');
    await key(essaySid, 'Enter', 'Enter', 13, '\r');
    const ob = await waitFor(async () => (await local()).openBreak, 5000);
    check(ob && !ob.departed, 'no parked break: ' + JSON.stringify(ob));
    const crumb = (await local()).breadcrumbs?.[ob.threadId] || Object.values((await local()).breadcrumbs || {})[0];
    check(crumb && crumb.nextStep === NEXT, 'next step not saved: ' + JSON.stringify(crumb));
    return `parked at scrollY ${savedY}, next step saved`;
  });

  const video = await ctl(`return (await chrome.tabs.create({ url: ${JSON.stringify(VIDEO)}, active: false })).id;`);
  await step('leave for the distraction site past the 10 s debug threshold', async () => {
    activatePid(proc.pid, CFT_BUNDLE);
    await ctl(`await chrome.tabs.update(${video}, { active: true }); return true;`);
    await sleep(12000);
    const ob = (await local()).openBreak;
    check(ob && ob.departed, 'break not departed: ' + JSON.stringify(ob));
    return 'break departed';
  });

  await step('return: the real card is drawn', async () => {
    activatePid(proc.pid, CFT_BUNDLE);
    await ctl(`await chrome.tabs.update(${essay}, { active: true }); return true;`);
    const ev = await waitFor(async () => { const e = (await local()).events?.at(-1); return e && e.cardShown ? e : null; }, 8000);
    check(ev, 'no event with cardShown: ' + JSON.stringify((await local()).events?.at(-1)));
    const text = await evalIn(essaySid, `[...document.querySelectorAll('pickup-ui')].map((h) => h.shadowRoot && h.shadowRoot.textContent).join(' ')`);
    check(text.includes('Climate Essay') && text.includes(NEXT), 'card text: ' + text.slice(0, 160));
    await shot(essaySid, '2-card');
    return `event ${ev.condition}, card shows task and next step`;
  });

  await step('Resume (Enter on the card) restores the scroll', async () => {
    const crumb = Object.values((await local()).breadcrumbs || {}).find((c) => c.tabId === essay);
    check(crumb && crumb.scrollY > 50, 'breadcrumb scroll ' + JSON.stringify(crumb && crumb.scrollY));
    await evalIn(essaySid, 'scrollTo(0, 0), true'); // scroll away under the card, like gate step 7
    await sleep(300);
    await key(essaySid, 'Enter', 'Enter', 13, '\r');
    const y = await waitFor(async () => { const v = await evalIn(essaySid, 'Math.round(scrollY)'); return Math.abs(v - crumb.scrollY) < 60 ? v || 1 : null; }, 6000);
    check(y, `scroll ${await evalIn(essaySid, 'Math.round(scrollY)')} vs saved ${crumb.scrollY}`);
    const ev = (await local()).events.at(-1);
    await shot(essaySid, '3-resumed');
    return `scrolled 0 → ${y} (saved ${crumb.scrollY}); event ${ev.condition}/${ev.returnVia}`;
  });

  await step('popup shows the same keys', async () => {
    const s = await sendSW({ type: 'getShortcuts' });
    const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/src/pages/popup.html` });
    const pSid = await attachTo((t) => t.targetId === targetId, 'popup');
    const shown = await waitFor(() => evalIn(pSid, `(() => { const t = ['resume', 'park', 'panel'].map((k) => document.querySelector('[data-shortcut="' + k + '"]')?.textContent || ''); return t.every(Boolean) ? t : null; })()`));
    check(JSON.stringify(shown) === JSON.stringify([s.resume, s.park, s.panel]), `popup shows ${JSON.stringify(shown)}`);
    await shot(pSid, '4-popup');
    return shown.join(' / ');
  });

  await step('chrome://extensions/shortcuts screenshot', async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'chrome://extensions/shortcuts' });
    const sid = await attachTo((t) => t.targetId === targetId, 'shortcuts page');
    await sleep(1500);
    return await shot(sid, '5-extensions-shortcuts');
  });

  await step('no console errors from the extension or the work page', async () => {
    const real = errors.filter((e) => !/favicon\.ico/.test(e));
    check(!real.length, real.slice(0, 8).join(' | '));
    return `${errors.length} total, 0 after ignoring favicon 404s`;
  });

  srv.close();
  void swSid;
}

main()
  .catch((e) => { log('\nstopped:', e.message); process.exitCode = 1; })
  .finally(() => {
    log(`\n${results.filter((r) => r[0] === 'ok  ').length} ok, ${results.filter((r) => r[0] === 'FAIL').length} fail. Shots in ${OUT}`);
    try { proc && proc.kill(); } catch {}
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  });
