// Pickup pages: DOM and chrome.* helpers shared by popup, setup and dashboard.
// Owner: Abhinav (pages). Every chrome.* call is guarded, so a page opened outside
// the extension (a plain file server, for layout checks) still renders.
//
// Note for check-integration: never write a `type:` property with a string literal
// in src/pages/ (it reads those as message types). Use `el.type = ...` or MSG.x.

export const hasChrome = typeof chrome !== 'undefined' && !!(chrome && chrome.runtime && chrome.runtime.id);

export const $ = (id) => document.getElementById(id);

// One message to the engine. Returns the reply, or { ok: false, error } on failure.
export async function send(msg) {
  if (!hasChrome) return { ok: false, error: 'not running as the extension' };
  try {
    const r = await chrome.runtime.sendMessage(msg);
    return r === undefined ? { ok: false, error: 'no reply' } : r;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

export async function getLocal(keys) {
  if (!hasChrome) return {};
  try { return await chrome.storage.local.get(keys); } catch { return {}; }
}

// h('li', { className: 'x', dataset: { id: 1 } }, 'text', childNode)
export function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'attrs') for (const [a, av] of Object.entries(v)) node.setAttribute(a, av);
      else node[k] = v;
    }
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// A button with an optional key hint: button('Resume', { kind: 'primary', key: 'Alt+R' })
export function button(label, { kind = '', key = '', small = false, id } = {}) {
  const b = h('button', { className: ['pk-btn', kind && `pk-btn--${kind}`, small && 'pk-btn--sm'].filter(Boolean).join(' '), id });
  b.type = 'button';
  b.append(label);
  if (key) b.append(h('span', { className: 'pk-kbd' }, key));
  return b;
}

// Toolbar-state badge, always next to its text (the glyph alone is never the signal).
const BADGE = {
  parked: ['P', 'pk-badge--parked'],
  away: ['•', 'pk-badge--away'],
  wrapped: ['☾', 'pk-badge--wrapped'],
  saved: ['✓', 'pk-badge--saved'],
  nothing: ['!', 'pk-badge--neutral'],
  none: ['?', 'pk-badge--neutral'],
};
export function badge(state) {
  const [glyph, cls] = BADGE[state] || BADGE.none;
  return h('span', { className: `pk-badge ${cls}`, attrs: { 'aria-hidden': 'true' } }, glyph);
}

export function openPage(path) {
  if (hasChrome) chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  else window.open(path.replace(/^src\/pages\//, ''), '_blank');
}

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
