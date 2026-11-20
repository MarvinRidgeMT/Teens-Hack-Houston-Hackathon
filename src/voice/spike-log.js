// Phase 0 voice spike: shared on-page log. Each page context (side panel, tab,
// enable tab) writes its own list to chrome.storage.session, so the side panel's
// log survives the panel closing and can be read from a tab. Session storage is
// in memory only and is cleared when Chrome quits. Owner: Anish. Spike only.

const PREFIX = 'voiceSpikeLog:';
const CAP = 1500;
let ctx = 'page';
let lines = [];
let pending = null;
let render = null;

export const stamp = (t = Date.now()) => {
  const d = new Date(t);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

export async function initLog(context, el) {
  ctx = context;
  const key = PREFIX + ctx;
  try {
    const got = await chrome.storage.session.get(key);
    lines = got[key] || [];
  } catch { lines = []; }
  if (el) {
    render = async () => {
      let all = [];
      try {
        const every = await chrome.storage.session.get(null);
        for (const [k, v] of Object.entries(every)) if (k.startsWith(PREFIX) && Array.isArray(v)) all.push(...v);
      } catch { all = lines.slice(); }
      all.sort((a, b) => a.t - b.t);
      el.textContent = all.map((l) => `${stamp(l.t)} [${l.ctx}] ${l.msg}`).join('\n');
      el.scrollTop = el.scrollHeight;
    };
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && Object.keys(changes).some((k) => k.startsWith(PREFIX))) render();
    });
    render();
  }
}

export function log(...parts) {
  const msg = parts.map((p) => (typeof p === 'string' ? p : safeJson(p))).join(' ');
  const entry = { t: Date.now(), ctx, msg };
  lines.push(entry);
  if (lines.length > CAP) lines = lines.slice(-CAP);
  console.log('[voice-spike]', ctx, msg);
  if (!pending) {
    pending = Promise.resolve().then(async () => {
      pending = null;
      try { await chrome.storage.session.set({ [PREFIX + ctx]: lines }); } catch (e) { console.warn('log save failed', e); }
      if (render) render();
    });
  }
}

export function errText(e) {
  if (!e) return String(e);
  return `${e.name || 'Error'}: ${e.message || e.error || e}`;
}

export async function clearLogs() {
  const every = await chrome.storage.session.get(null);
  await chrome.storage.session.remove(Object.keys(every).filter((k) => k.startsWith(PREFIX)));
  lines = [];
  if (render) render();
}

export async function allLogText(el) {
  return el ? el.textContent : lines.map((l) => `${stamp(l.t)} [${l.ctx}] ${l.msg}`).join('\n');
}

function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}
