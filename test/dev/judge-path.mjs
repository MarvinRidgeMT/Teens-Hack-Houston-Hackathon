// DEV ONLY. The judge's path, end to end, against the LIVE site and the LIVE GitHub release:
// a brand-new Chrome for Testing profile opens the site, clicks Download, checks the zip's SHA-256,
// unzips it, loads it (Developer mode on), completes setup, loads sample data on the dashboard,
// then park -> leave -> return -> card -> Resume with the real content scripts.
//
//   node test/dev/judge-path.mjs          (screenshots go to docs/v4/after/judge-path-*.png)
//
// Built on release-smoke.mjs (same steps 5 and 7, same test hosts and manifest host_permissions edit,
// because CDP can't click Chrome's site-access prompt or drive the Load unpacked folder picker;
// the extension is loaded with --load-extension, which is what Load unpacked does).
// Owner: Anish (Engine). Never shipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { launch, sleep, activatePid, CFT_BUNDLE } from './cdp-driver.mjs';
import { keyLabel } from '../../src/shared/shortcuts.js'; // keys are shown in words since v1.0.1 ("Control Shift P")
import { spawn } from 'node:child_process';
import { CFT } from './cdp-driver.mjs';
import crypto from 'node:crypto';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://marvinridgemt.github.io/Teens-Hack-Houston-Hackathon/';
const SHA = '1116fbe7a1a5c04e7a046cfbe39c41dd7a3d6b18b116caa996805a21f4f1e590'; // pickup-v1.0.1.zip (release notes)
const DOCS = path.join(REPO, 'docs/v4/after');
const SCRATCH = process.env.PICKUP_SCRATCH || path.join(os.tmpdir(), 'pickup-judge-path');
const DL = path.join(SCRATCH + '-dl');
const ZIP = path.join(DL, 'pickup-v1.0.1.zip');
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
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const f = path.join(DOCS, `judge-path-${name}.png`);
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


// Steps 1-2: a brand-new Chrome for Testing profile with nothing installed opens the live site and clicks Download.
async function downloadFromSite() {
  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pickup-judge-site-'));
  const port = 9600 + Math.floor(Math.random() * 90);
  const p = spawn(CFT, [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let wsu; for (let i = 0; i < 80 && !wsu; i++) { try { wsu = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} if (!wsu) await sleep(150); }
  const { CDP } = await import('./cdp-driver.mjs');
  const b = await CDP.connect(wsu);
  await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  const { targetId } = await b.send('Target.createTarget', { url: SITE });
  const { sessionId: sid } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  await b.send('Page.enable', {}, sid); await b.send('Runtime.enable', {}, sid);
  const siteErrors = [];
  b.on('Runtime.exceptionThrown', (q) => siteErrors.push(q.exceptionDetails.text));
  await sleep(6000);
  const ev = async (x) => (await b.send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }, sid)).result.value;
  await step('1. open the live site', async () => {
    const t = await ev('document.title'); check(/Pickup/.test(t), 'title ' + t);
    const { data } = await b.send('Page.captureScreenshot', { format: 'png' }, sid); fs.writeFileSync(path.join(DOCS, 'judge-path-1-site.png'), Buffer.from(data, 'base64'));
    return t;
  });
  await step('2. click Download (the hero button), the zip arrives and matches the SHA-256', async () => {
    const pos = await ev(`(() => { const a = [...document.querySelectorAll('.hero__ctas a')].find((x) => /Download/.test(x.textContent)); const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: a.href }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 }, sid);
    const ok = await waitFor(() => fs.existsSync(ZIP) && !fs.readdirSync(DL).some((f) => f.endsWith('.crdownload')), 30000, 300);
    check(ok, 'no zip in ' + DL + ': ' + fs.readdirSync(DL).join(','));
    const buf = fs.readFileSync(ZIP); const h = crypto.createHash('sha256').update(buf).digest('hex');
    check(h === SHA, 'sha ' + h);
    const { targetId: dt } = await b.send('Target.createTarget', { url: 'chrome://downloads' });
    const { sessionId: ds } = await b.send('Target.attachToTarget', { targetId: dt, flatten: true });
    await sleep(1200);
    const { data } = await b.send('Page.captureScreenshot', { format: 'png' }, ds); fs.writeFileSync(path.join(DOCS, 'judge-path-2-download.png'), Buffer.from(data, 'base64'));
    return `${pos.href} -> ${buf.length} bytes, sha256 ${h.slice(0, 12)}…; site exceptions: ${siteErrors.length}`;
  });
  b.close(); p.kill();
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
  await downloadFromSite();
  const ext = unzip();
  results.push(['ok  ', '3. unzip', ext]); log('ok    3. unzip — ' + ext);
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
  await step('4. chrome://extensions, Developer mode on, Pickup loaded unpacked', async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'chrome://extensions' });
    const sid = await attachTo((t) => t.targetId === targetId, 'extensions page');
    await sleep(1500);
    const on = await evalIn(sid, `(async () => { const m = document.querySelector('extensions-manager'); const tb = m.shadowRoot.querySelector('extensions-toolbar'); const t = tb.shadowRoot.querySelector('#devMode'); if (!t.checked) t.click(); await new Promise((r) => setTimeout(r, 800)); const items = m.shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelectorAll('extensions-item'); return { dev: t.checked, names: [...items].map((i) => i.shadowRoot.querySelector('#name').textContent.trim()) }; })()`);
    check(on.dev && on.names.some((n) => /Pickup/.test(n)), JSON.stringify(on));
    await shot(sid, '4-extensions');
    await cdp.send('Target.closeTarget', { targetId });
    return `developer mode ${on.dev}; loaded: ${on.names.join(', ')} (via --load-extension, the same as Load unpacked: CDP can't drive the folder picker)`;
  });

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
    const shown = await waitFor(() => evalIn(setupSid, `(() => { const t = [...document.querySelectorAll('.st-keys [data-shortcut]')].map((e) => e.getAttribute('aria-label') || e.textContent); return t.every(Boolean) ? t : null; })()`));
    check(JSON.stringify(shown) === JSON.stringify([s.park, s.resume, s.panel].map(keyLabel)), `setup shows ${JSON.stringify(shown)}`);
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
    await shot(setupSid, '5-setup');
    return `settings saved; content script ${reg[0]} files`;
  });

  await step('6. dashboard: Load sample data fills it, with the sample banner', async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/src/pages/dashboard.html` });
    const dSid = await attachTo((t) => t.targetId === targetId, 'dashboard');
    await waitFor(() => evalIn(dSid, `document.readyState === 'complete' && !!document.getElementById('load-sample')`));
    await sleep(600);
    await click(dSid, '#load-sample');
    const r = await waitFor(() => evalIn(dSid, `(() => { const b = document.getElementById('sample-banner'); return b && !b.hidden ? { banner: b.innerText.slice(0, 40), rows: document.querySelectorAll('tbody tr, .db-row, li').length } : null; })()`), 6000);
    check(r, 'sample banner not shown');
    await evalIn(dSid, 'scrollTo(0, 0), true'); await sleep(400);
    await shot(dSid, '6-sample-data');
    await cdp.send('Target.closeTarget', { targetId });
    return `banner "${r.banner}…", ${r.rows} rows/items drawn`;
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
    await sleep(800);
    await shot(essaySid, '7a-park');
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
    await sleep(1500);
    await shot(essaySid, '7b-return-card');
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
    await shot(essaySid, '7c-resumed');
    return `scrolled 0 → ${y} (saved ${crumb.scrollY}); event ${ev.condition}/${ev.returnVia}`;
  });

  await step('popup shows the same keys', async () => {
    const s = await sendSW({ type: 'getShortcuts' });
    const { targetId } = await cdp.send('Target.createTarget', { url: `chrome-extension://${extId}/src/pages/popup.html` });
    const pSid = await attachTo((t) => t.targetId === targetId, 'popup');
    const shown = await waitFor(() => evalIn(pSid, `(() => { const t = ['resume', 'park', 'panel'].map((k) => (((e) => e && (e.getAttribute('aria-label') || e.textContent))(document.querySelector('[data-shortcut="' + k + '"]')) || '')); return t.every(Boolean) ? t : null; })()`));
    check(JSON.stringify(shown) === JSON.stringify([s.resume, s.park, s.panel].map(keyLabel)), `popup shows ${JSON.stringify(shown)}`);
    await shot(pSid, '8-popup');
    return shown.join(' / ');
  });

  await step('chrome://extensions/shortcuts screenshot', async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'chrome://extensions/shortcuts' });
    const sid = await attachTo((t) => t.targetId === targetId, 'shortcuts page');
    await sleep(1500);
    return await shot(sid, '9-extensions-shortcuts');
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
