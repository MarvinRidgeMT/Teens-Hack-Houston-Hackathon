// DEV ONLY. Screenshots of the website (web/, served by `npm --prefix web run dev` or
// `npm --prefix web run preview`) in headless Chrome for Testing, after the motion settles.
//
//   node test/dev/web-shots.mjs <url> <outDir> [shot ...]
//   shot = name:WIDTHxHEIGHT[:scrollSelector][:dark][:reduce][:wait=ms][:full]
//   e.g. node test/dev/web-shots.mjs http://localhost:5173/ .impeccable/review hero:1440x900 how:1440x900:#step-return
//
// No npm dependencies: Node's global WebSocket talks the DevTools protocol directly.
// Owner: Anish (Engine). Never shipped.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CFT, sleep } from './cdp-driver.mjs';

const [url, outDir, ...specs] = process.argv.slice(2);
if (!url || !outDir || !specs.length) {
  console.error('usage: node test/dev/web-shots.mjs <url> <outDir> name:WxH[:selector][:dark][:reduce][:wait=ms][:full] ...');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pickup-web-shots-'));
const chrome = spawn(CFT, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome for Testing did not start');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});

for (const spec of specs) {
  const [name, size, ...opts] = spec.split(':');
  const [w, h] = size.split('x').map(Number);
  const selector = opts.find((o) => /^[#.]/.test(o));
  const dark = opts.includes('dark');
  const reduce = opts.includes('reduce');
  const full = opts.includes('full');
  const wait = Number((opts.find((o) => o.startsWith('wait=')) || 'wait=2600').slice(5));
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
  ] });
  await send('Page.navigate', { url });
  await sleep(1200);
  if (selector) {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.scrollIntoView({ block: 'center' }); } })()`);
  }
  await sleep(wait);
  const metrics = await evaluate(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight })`);
  let clip;
  // Full page: capture beyond the viewport without resizing it, so 100svh sections keep their real height.
  if (full) clip = { x: 0, y: 0, width: w, height: Math.min(metrics.sh, 16000), scale: 1 };
  const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: full });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(`${file}  ${w}x${h}${dark ? ' dark' : ''}${reduce ? ' reduce' : ''}  overflowX=${metrics.sw > metrics.iw}`);
}
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '));
ws.close();
chrome.kill();
await sleep(500);
try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome still closing */ }
