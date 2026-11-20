// Static integration check: reads Sidd's src/content/ and Abhinav's src/pages/
// against the engine contract, plus repo-wide product rules. Owner: Anish. Not shipped.
//
//   node test/check-integration.mjs                       # the real tree
//   node test/check-integration.mjs --content test/dev    # point at another folder
//   node test/check-integration.mjs --pages test/dev
//
// FAIL = breaks the contract or a product rule (exit code 1). WARN = worth a look.
// It reads source text, so it can miss things a real run would show: it never replaces the Gate test.

import fs from 'node:fs';
import path from 'node:path';
import { MSG, TO_ENGINE, TO_CONTENT, OPTIONAL_TO_CONTENT, CARD_ACTIONS } from '../src/shared/messages.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const CONTENT_DIR = path.resolve(ROOT, arg('--content', 'src/content'));
const PAGES_DIR = path.resolve(ROOT, arg('--pages', 'src/pages'));

const results = [];
const fail = (area, msg) => results.push(['FAIL', area, msg]);
const warn = (area, msg) => results.push(['WARN', area, msg]);
const pass = (area, msg) => results.push(['ok  ', area, msg]);
const rel = (p) => path.relative(ROOT, p);

function walk(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const read = (p) => fs.readFileSync(p, 'utf8');
// Line number of the first match, for file:line reports.
function where(file, re) {
  const lines = read(file).split('\n');
  const i = lines.findIndex((l) => re.test(l));
  return i < 0 ? rel(file) : `${rel(file)}:${i + 1}`;
}

// ---------------- manifest ----------------
const manifest = JSON.parse(read(path.join(ROOT, 'manifest.json')));
{
  const refs = [
    manifest.background && manifest.background.service_worker,
    manifest.action && manifest.action.default_popup,
    manifest.options_page,
    ...Object.values(manifest.icons || {}),
    ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  ].filter(Boolean);
  for (const r of new Set(refs)) {
    if (fs.existsSync(path.join(ROOT, r))) pass('manifest', `${r} exists`);
    else fail('manifest', `${r} is referenced in manifest.json but missing (not landed yet?)`);
  }
  const expected = ['tabs', 'tabGroups', 'idle', 'alarms', 'notifications', 'storage', 'scripting', 'contextMenus'];
  const extra = (manifest.permissions || []).filter((p) => !expected.includes(p));
  if (extra.length) warn('manifest', `permissions beyond the plan: ${extra.join(', ')}`);
  if (manifest.host_permissions && manifest.host_permissions.length) fail('manifest', 'host_permissions present: work sites must be optional and requested on the setup page');
  if (manifest.manifest_version !== 3) fail('manifest', 'manifest_version is not 3');
}

// ---------------- repo-wide product rules (src/) ----------------
const srcJs = walk(path.join(ROOT, 'src'), ['.js', '.mjs']);
const srcHtml = walk(path.join(ROOT, 'src'), ['.html']);
const srcCss = walk(path.join(ROOT, 'src'), ['.css']);
{
  const network = /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|new\s+EventSource/;
  const evalish = /\beval\s*\(|new\s+Function\s*\(/;
  let clean = true;
  for (const f of srcJs) {
    const s = read(f);
    if (network.test(s)) { fail('rules', `network call in ${where(f, network)} (Never: any network request)`); clean = false; }
    if (evalish.test(s)) { fail('rules', `eval/new Function in ${where(f, evalish)} (blocked by extension CSP)`); clean = false; }
    if (/pickup-dev-stub/.test(s)) { fail('rules', `${where(f, /pickup-dev-stub/)} uses the dev stub id`); clean = false; }
  }
  const remote = /<(script|link|img|iframe)\b[^>]*\b(src|href)\s*=\s*["']https?:/i;
  for (const f of srcHtml) {
    const s = read(f);
    if (/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(s)) { fail('rules', `inline <script> in ${rel(f)} (blocked by extension CSP)`); clean = false; }
    if (/\son[a-z]+\s*=\s*["']/i.test(s)) { fail('rules', `inline event handler in ${where(f, /\son[a-z]+\s*=\s*["']/i)} (blocked by extension CSP)`); clean = false; }
    if (remote.test(s)) { fail('rules', `remote resource in ${where(f, remote)} (network request; bundle it instead)`); clean = false; }
  }
  for (const f of srcCss) {
    if (/url\(\s*["']?https?:|@import\s+["']?https?:|@import\s+url\(\s*["']?https?:/i.test(read(f))) { fail('rules', `remote font/image in ${rel(f)} (network request)`); clean = false; }
  }
  if (clean) pass('rules', `no network calls, eval or inline scripts in ${srcJs.length} JS / ${srcHtml.length} HTML files`);
}

// ---------------- Sidd: content script ----------------
const contentJs = walk(CONTENT_DIR, ['.js']);
if (!contentJs.length) {
  fail('content', `no .js files in ${rel(CONTENT_DIR)} (not landed yet?)`);
} else {
  const all = contentJs.map(read).join('\n');
  const hasStr = (v) => new RegExp(`['"\`]${v}['"\`]`).test(all);
  for (const t of [...TO_CONTENT, MSG.state, MSG.firstInteraction, MSG.cardAction, MSG.parkNote]) {
    if (hasStr(t)) pass('content', `uses message type '${t}'`);
    else fail('content', `message type '${t}' not found as a string (copy it from messages.js)`);
  }
  for (const t of OPTIONAL_TO_CONTENT) {
    if (!hasStr(t)) warn('content', `optional message '${t}' not handled (fine: it's a stretch card variant)`);
  }
  if (!hasStr('selected')) warn('content', "showCard.nextStepSource 'selected' not handled: label it \"(you picked this)\"");
  for (const a of Object.values(CARD_ACTIONS)) {
    if (!hasStr(a)) fail('content', `card action '${a}' not found`);
  }
  for (const f of contentJs) {
    if (/^\s*(import|export)\s/m.test(read(f))) fail('content', `${where(f, /^\s*(import|export)\s/)}: content scripts are classic scripts; no import/export`);
  }
  if (!/sendResponse\s*\(/.test(all)) fail('content', 'no sendResponse(...) call: snapshot must always reply { url, scrollY, highlight }');
  if (!/window\.top/.test(all)) warn('content', 'no window.top check: only the top frame should answer snapshot and draw the card');
  if (!/attachShadow/.test(all)) warn('content', 'no attachShadow: the plan puts the card in a Shadow DOM');
  if (!/\b200\b/.test(all)) warn('content', 'no 200 found: highlight must be capped at 200 characters');
  if (!/prefers-reduced-motion/.test(all)) warn('content', 'no prefers-reduced-motion check for restoreScroll / card motion');
  if (!/scrollTop/.test(all)) warn('content', 'no scrollTop: in Docs the editor container scrolls, not the window');
  const sent = [...all.matchAll(/type\s*:\s*['"`](\w+)['"`]/g)].map((m) => m[1]);
  for (const t of new Set(sent)) {
    if (!Object.values(MSG).includes(t)) fail('content', `sends/handles unknown message type '${t}'`);
  }
}

// ---------------- Abhinav: pages ----------------
const pageJs = walk(PAGES_DIR, ['.js']);
if (!pageJs.length) {
  fail('pages', `no .js files in ${rel(PAGES_DIR)} (not landed yet?)`);
} else {
  const all = pageJs.map(read).join('\n');
  // Message types the pages send to the engine.
  const sent = [...all.matchAll(/type\s*:\s*['"`](\w+)['"`]/g)].map((m) => m[1]);
  const viaConst = [...all.matchAll(/type\s*:\s*MSG\.(\w+)/g)].map((m) => MSG[m[1]] || `MSG.${m[1]}`);
  for (const t of new Set([...sent, ...viaConst])) {
    if (TO_ENGINE.includes(t)) pass('pages', `sends '${t}' (engine answers it)`);
    else fail('pages', `sends '${t}', which the engine does not answer`);
  }
  if (!/permissions\.request\s*\(/.test(all)) fail('pages', 'no chrome.permissions.request: work sites need host access');
  else {
    // The request must be the first await in its click handler.
    for (const f of pageJs) {
      const s = read(f);
      const i = s.indexOf('permissions.request');
      if (i < 0) continue;
      const before = s.slice(Math.max(0, s.lastIndexOf('addEventListener', i)), i);
      if (/\bawait\b/.test(before)) fail('pages', `${where(f, /permissions\.request/)}: an await comes before permissions.request in the handler (user gesture lost)`);
      else pass('pages', `${where(f, /permissions\.request/)}: permissions.request has no await before it`);
    }
  }
  if (!/registerContentScripts\s*\(/.test(all)) fail('pages', 'no chrome.scripting.registerContentScripts');
  if (!/allFrames\s*:\s*true/.test(all)) fail('pages', 'content script not registered with allFrames: true (Docs types into an iframe)');
  if (!/matchOriginAsFallback\s*:\s*true/.test(all)) warn('pages', 'no matchOriginAsFallback: true (Docs about:blank frames)');
  if (!/executeScript\s*\(/.test(all)) warn('pages', 'no scripting.executeScript: tabs open before Save get no script until reloaded');
  // Registered script files must exist.
  for (const m of all.matchAll(/js\s*:\s*\[([^\]]*)\]/g)) {
    for (const f of [...m[1].matchAll(/['"`]([^'"`]+\.js)['"`]/g)].map((x) => x[1])) {
      if (fs.existsSync(path.join(ROOT, f))) pass('pages', `registered script ${f} exists`);
      else fail('pages', `registered script ${f} does not exist`);
    }
  }
  for (const k of ['participant', 'workSites', 'distractionSites', 'awayThresholdMs', 'nudgeDelayMin', 'debug', 'forceCard']) {
    if (!new RegExp(`\\b${k}\\b`).test(all)) warn('pages', `settings key '${k}' not written anywhere in pages`);
  }
}
const stats = path.join(ROOT, 'src/shared/stats.js');
if (fs.existsSync(stats)) {
  if (!/debug/.test(read(stats))) fail('stats', 'stats.js never mentions debug: debug events must be left out of every statistic');
  else pass('stats', 'stats.js handles debug');
} else warn('stats', 'src/shared/stats.js not landed yet');

// ---------------- report ----------------
const order = { FAIL: 0, WARN: 1, 'ok  ': 2 };
results.sort((a, b) => order[a[0]] - order[b[0]]);
for (const [lvl, area, msg] of results) console.log(`${lvl}  [${area}] ${msg}`);
const n = (l) => results.filter((r) => r[0] === l).length;
console.log(`\n${n('FAIL')} fail, ${n('WARN')} warn, ${n('ok  ')} ok`);
process.exit(n('FAIL') ? 1 : 0);
