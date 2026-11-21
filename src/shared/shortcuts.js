// Keyboard shortcut labels. Owner: Anish (Engine).
// The one place outside manifest.json that names Pickup's keys. Everything else asks
// for them: extension pages call shortcuts() below, the service worker answers
// `getShortcuts` from chrome.commands.getAll(), so a key the user rebinds at
// chrome://extensions/shortcuts shows up everywhere.
//
// manifest.json suggests (fresh installs only; Chrome keeps existing bindings):
//   mac:        MacCtrl+Shift+P / R / V  (Chrome shows ⌃⇧P / ⌃⇧R / ⌃⇧V)
//   everywhere: Alt+P / Alt+R / Alt+V
// `wrap-up` has no suggested key (Chrome allows four; it can be set by hand).

export const SHORTCUTS_PAGE = 'chrome://extensions/shortcuts';
export const NOT_SET = `Not set: ${SHORTCUTS_PAGE}`;
export const NOT_SET_SHORT = 'Not set';

// manifest command name -> field in the getShortcuts reply
export const COMMAND_FIELDS = Object.freeze({
  'park-task': 'park',
  'resume-task': 'resume',
  'toggle-voice': 'panel',
  'wrap-up': 'wrapUp',
});

// Used only when Chrome can't list the commands (or a page can't reach the engine).
export const FALLBACK = Object.freeze({
  mac: Object.freeze({ park: '⌃⇧P', resume: '⌃⇧R', panel: '⌃⇧V', wrapUp: '' }),
  other: Object.freeze({ park: 'Alt+P', resume: 'Alt+R', panel: 'Alt+V', wrapUp: '' }),
});

export function fallbackFor(platform) {
  return { ok: true, platform, ...(platform === 'mac' ? FALLBACK.mac : FALLBACK.other) };
}

// commands: chrome.commands.getAll() output. Chrome formats `shortcut` for the OS
// and leaves it '' when the command has no key (e.g. another extension took it).
export function fromCommands(commands, platform) {
  const out = { ok: true, platform, park: '', resume: '', panel: '', wrapUp: '' };
  for (const c of commands || []) {
    const field = COMMAND_FIELDS[c && c.name];
    if (field) out[field] = typeof c.shortcut === 'string' ? c.shortcut : '';
  }
  return out;
}

// A key for prose ("Not set: chrome://extensions/shortcuts" when missing) or for a
// small key chip ("Not set"; the full text goes in its title).
export const keyText = (key) => key || NOT_SET;
export const chipText = (key) => key || NOT_SET_SHORT;

// " · ⌃⇧R takes you back", or nothing when the key is not set (a sentence with no key reads wrong).
export const backHint = (key) => (key ? ` · ${key} takes you back` : '');

function guessPlatform() {
  const nav = globalThis.navigator;
  const p = (nav && ((nav.userAgentData && nav.userAgentData.platform) || nav.platform)) || '';
  return /mac/i.test(p) ? 'mac' : 'win';
}

// ---- extension pages (popup, setup, dashboard, panel) ----
let cached = null;
export function shortcuts() {
  if (!cached) cached = load();
  return cached;
}
async function load() {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'getShortcuts' });
    if (r && r.ok) return r;
  } catch { /* no engine (a dev harness page): use the table */ }
  return fallbackFor(guessPlatform());
}

// Fills every [data-shortcut="park|resume|panel|wrapUp"] under root. A .pk-kbd chip
// gets the short text; anything else gets the full text.
export async function fillShortcuts(root = document) {
  const s = await shortcuts();
  for (const el of root.querySelectorAll('[data-shortcut]')) {
    const key = s[el.dataset.shortcut] || '';
    el.textContent = el.classList.contains('pk-kbd') ? chipText(key) : keyText(key);
    if (key) el.removeAttribute('title'); else el.title = NOT_SET;
  }
  return s;
}
