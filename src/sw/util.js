// Small service-worker helpers. Owner: Anish (Engine).

export function log(...args) {
  console.log('[Pickup]', ...args);
}

export function newId(prefix) {
  const rnd = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

export async function getTab(tabId) {
  if (tabId == null || tabId < 0) return null;
  try { return await chrome.tabs.get(tabId); } catch { return null; }
}

export async function getActiveTab(windowId) {
  try {
    const [t] = await chrome.tabs.query({ active: true, windowId });
    return t || null;
  } catch { return null; }
}

export async function isWindowFocused(windowId) {
  try { return (await chrome.windows.get(windowId)).focused; } catch { return false; }
}

// Send a message to a tab's content script. Resolves to the reply, or null if no
// content script is there (site not listed, tab discarded, page still loading).
// Goes to the top frame only (frameId 0): with allFrames every Docs frame has the
// script, and a child frame must never answer snapshot or draw the card. armTimer
// is the one message that needs every frame, because Docs types into an iframe.
export async function sendToTab(tabId, msg, timeoutMs = 1500, { allFrames = false } = {}) {
  if (tabId == null) return null;
  const send = chrome.tabs.sendMessage(tabId, msg, allFrames ? {} : { frameId: 0 }).catch(() => null);
  const timeout = new Promise((r) => setTimeout(() => r(null), timeoutMs));
  try { return (await Promise.race([send, timeout])) ?? null; } catch { return null; }
}

// Same page, ignoring #hash and ?query (Docs changes both while you work).
export function sameDoc(a, b) {
  try {
    const x = new URL(a), y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname;
  } catch { return false; }
}

export const tabUrl = (tab) => (tab && (tab.url || tab.pendingUrl)) || '';
