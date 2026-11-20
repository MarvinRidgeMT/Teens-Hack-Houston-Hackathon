// DEV ONLY. A tiny Chrome DevTools Protocol client used by real-chrome-gate.mjs.
// No npm dependencies: Node 22+ global WebSocket. Owner: Anish (Engine). Never shipped.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CFT = process.env.CFT
  || `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-157.0.8103.78/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
export const CFT_BUNDLE = 'com.google.chrome.for.testing';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Copy the extension for testing. Only the copy differs from the repo:
//  - work sites are granted up front (a script can't click the site-access prompt)
//  - placeholder popup/setup pages until Abhinav's src/pages/ lands
export function buildTestCopy(repo, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(repo, dest, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  const mfPath = path.join(dest, 'manifest.json');
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  mf.host_permissions = ['*://docs.google.com/*', '*://wikipedia.org/*', '*://*.wikipedia.org/*'];
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));
  const pages = path.join(dest, 'src/pages');
  fs.mkdirSync(pages, { recursive: true });
  for (const name of ['popup', 'setup']) {
    const f = path.join(pages, `${name}.html`);
    if (!fs.existsSync(f)) {
      fs.writeFileSync(f, `<!doctype html><meta charset="utf-8"><title>DEV placeholder ${name}</title><body style="min-width:200px;min-height:80px">DEV placeholder ${name} page (test build only)</body>`);
    }
  }
}

export class CDP {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const c = new CDP(ws);
      ws.onopen = () => resolve(c);
      ws.onerror = (e) => reject(new Error('CDP connect failed: ' + (e.message || e.type)));
    });
  }
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id) {
        const p = this.pending.get(d.id);
        if (!p) return;
        this.pending.delete(d.id);
        clearTimeout(p.timer);
        if (d.error) p.reject(new Error(`${p.method}: ${d.error.message}`));
        else p.resolve(d.result);
      } else {
        for (const fn of this.handlers.get(d.method) || []) {
          try { fn(d.params, d.sessionId); } catch (e) { console.error('handler error', d.method, e); }
        }
      }
    };
    ws.onclose = () => {
      this.closed = true;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')); }
      this.pending.clear();
    };
  }
  send(method, params = {}, sessionId, timeoutMs = 30000) {
    if (this.closed) return Promise.reject(new Error('CDP closed'));
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify(msg));
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

export async function launch({ profile, ext, restore = false, extraArgs = [] }) {
  fs.mkdirSync(profile, { recursive: true });
  const portFile = path.join(profile, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  const args = [
    `--user-data-dir=${profile}`,
    `--load-extension=${ext}`,
    `--disable-extensions-except=${ext}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
  ];
  args.push(...extraArgs);
  if (restore) args.push('--restore-last-session');
  else args.push('about:blank');
  const proc = spawn(CFT, args, { stdio: 'ignore' });
  for (let i = 0; i < 300; i++) {
    if (fs.existsSync(portFile)) {
      const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (port && wsPath) {
        const cdp = await CDP.connect(`ws://127.0.0.1:${port}${wsPath}`);
        return { proc, cdp };
      }
    }
    await sleep(100);
  }
  proc.kill();
  throw new Error('Chrome for Testing did not open a DevTools port');
}

export function activateApp(bundleId) {
  execFileSync('osascript', ['-e', `tell application id "${bundleId}" to activate`]);
}
