// A small fake of the Chrome extension APIs the engine uses, so the service
// worker can be exercised in Node: `node test/engine.test.mjs`. Not shipped.

function evt() {
  const ls = [];
  return {
    addListener: (f) => ls.push(f),
    removeListener: (f) => { const i = ls.indexOf(f); if (i >= 0) ls.splice(i, 1); },
    fire: (...a) => ls.slice().forEach((f) => f(...a)),
    get count() { return ls.length; },
  };
}
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// `onChanged` is chrome.storage.onChanged; it fires after every write, like Chrome.
function area(name, onChanged) {
  let data = {};
  const fire = (changes) => { if (onChanged && Object.keys(changes).length) setTimeout(() => onChanged.fire(changes, name), 0); };
  return {
    async get(k) {
      if (k == null) return clone(data);
      const keys = Array.isArray(k) ? k : [k];
      const o = {};
      for (const key of keys) if (key in data) o[key] = clone(data[key]);
      return o;
    },
    async set(o) {
      const changes = {};
      for (const [k, v] of Object.entries(o)) { changes[k] = { oldValue: clone(data[k]), newValue: clone(v) }; data[k] = clone(v); }
      fire(changes);
    },
    async clear() {
      const changes = {};
      for (const k of Object.keys(data)) changes[k] = { oldValue: clone(data[k]) };
      data = {}; fire(changes);
    },
    _raw: () => data,
  };
}

export function makeChrome({ now }) {
  const tabs = new Map();
  const groups = new Map();
  const windows = new Map([[1, { id: 1, focused: true, type: 'normal' }]]);
  let lastFocusedId = 1;
  let nextTab = 1, nextGroup = 100;
  // Child frames per tab (Docs runs the content script in every frame with allFrames).
  const children = new Map(); // tabId -> [{ frameId, url, answersSnapshot }]
  let popupOpen = false;      // the extension's own popup is showing
  let holdLoads = false;      // tabs.create pages stay 'loading' until sim.finishLoad
  const pendingLoads = new Set();
  const sent = [];          // messages delivered to content scripts
  const notifications = [];
  const alarms = new Map();
  // Fake content script page state per tab
  const page = new Map();   // tabId -> { scrollY, highlight }
  let contentSites = [];    // host substrings where the content script runs

  const blockedContent = new Set(); // url substrings whose content script is not ready yet
  const hasContent = (t) => t && contentSites.some((s) => (t.url || '').includes(s))
    && ![...blockedContent].some((s) => (t.url || '').includes(s));

  const storageChanged = evt();
  const badge = { text: '', color: null, title: 'Pickup' };
  const menus = new Map(); // id -> createProperties (contextMenus)
  const c = {
    storage: { local: area('local', storageChanged), session: area('session', storageChanged), onChanged: storageChanged },
    action: {
      async setBadgeText({ text }) { badge.text = text; },
      async setBadgeBackgroundColor({ color }) { badge.color = color; },
      async setTitle({ title }) { badge.title = title; },
      async getBadgeText() { return badge.text; },
      async getTitle() { return badge.title; },
    },
    runtime: {
      onInstalled: evt(), onStartup: evt(), onMessage: evt(),
      async openOptionsPage() {}, getURL: (p) => `chrome-extension://x/${p}`,
      async getContexts({ contextTypes = [] } = {}) {
        return popupOpen && contextTypes.includes('POPUP') ? [{ contextType: 'POPUP' }] : [];
      },
    },
    tabs: {
      onActivated: evt(), onUpdated: evt(), onCreated: evt(), onRemoved: evt(),
      async get(id) { const t = tabs.get(id); if (!t) throw new Error('No tab ' + id); return clone(t); },
      async query(q = {}) {
        let out = [...tabs.values()];
        if (q.active !== undefined) out = out.filter((t) => t.active === q.active);
        if (q.windowId !== undefined) out = out.filter((t) => t.windowId === q.windowId);
        if (q.groupId !== undefined) out = out.filter((t) => t.groupId === q.groupId);
        if (q.lastFocusedWindow) out = out.filter((t) => t.windowId === lastFocusedId);
        return clone(out);
      },
      async update(id, p) {
        const t = tabs.get(id);
        if (p.active) { for (const o of tabs.values()) if (o.windowId === t.windowId) o.active = false; t.active = true; c.tabs.onActivated.fire({ tabId: id, windowId: t.windowId }); }
        return clone(t);
      },
      async create({ url, active = true, windowId = lastFocusedId, openerTabId }) {
        const t = { id: nextTab++, windowId, url, title: url, active: false, groupId: -1, openerTabId, pinned: false, status: 'loading' };
        tabs.set(t.id, t);
        c.tabs.onCreated.fire(clone(t));
        if (active) await c.tabs.update(t.id, { active: true });
        if (holdLoads) pendingLoads.add(t.id);
        else setTimeout(() => sim.finishLoad(t.id), 5);
        return clone(t);
      },
      async group({ tabIds, groupId, createProperties }) {
        let gid = groupId;
        const firstWin = tabs.get(tabIds[0]).windowId;
        if (gid == null) { gid = nextGroup++; groups.set(gid, { id: gid, title: '', collapsed: false, color: 'grey', windowId: (createProperties && createProperties.windowId) || firstWin }); }
        const gwin = groups.get(gid).windowId;
        for (const id of tabIds) {
          const t = tabs.get(id);
          if (t.windowId !== gwin) { sim.moved.push({ tabId: id, from: t.windowId, to: gwin }); t.windowId = gwin; }
          t.groupId = gid; c.tabs.onUpdated.fire(id, { groupId: gid }, clone(t));
        }
        return gid;
      },
      async ungroup(id) { const t = tabs.get(id); t.groupId = -1; c.tabs.onUpdated.fire(id, { groupId: -1 }, clone(t)); },
      // Without options.frameId every frame gets the message and the first reply wins.
      // A child frame that (wrongly) answers snapshot answers first here.
      async sendMessage(id, msg, options = {}) {
        const t = tabs.get(id);
        if (!hasContent(t)) throw new Error('Could not establish connection. Receiving end does not exist.');
        const only = options.frameId;
        const kids = only === undefined ? (children.get(id) || []) : (children.get(id) || []).filter((f) => f.frameId === only);
        for (const f of kids) {
          sent.push({ tabId: id, frameId: f.frameId, ...clone(msg) });
        }
        const childReply = kids.find((f) => f.answersSnapshot && msg.type === 'snapshot');
        if (only !== undefined && only !== 0) return childReply ? { url: childReply.url, scrollY: 0, highlight: '' } : undefined;
        sent.push({ tabId: id, frameId: 0, ...clone(msg) });
        if (childReply) return { url: childReply.url, scrollY: 0, highlight: '' };
        const p = page.get(id) || { scrollY: 0, highlight: '' };
        if (msg.type === 'snapshot') return { url: t.url, scrollY: p.scrollY, highlight: p.highlight };
        if (msg.type === 'restoreScroll') { p.scrollY = msg.scrollY; page.set(id, p); }
        return undefined;
      },
    },
    tabGroups: {
      onCreated: evt(), onUpdated: evt(), onRemoved: evt(),
      async query(q = {}) { return clone([...groups.values()].filter((g) => (q.windowId === undefined || g.windowId === q.windowId) && (q.title === undefined || g.title === q.title))); },
      async update(id, p) { const g = groups.get(id); if (!g) throw new Error('No group'); Object.assign(g, p); return clone(g); },
      async get(id) { const g = groups.get(id); if (!g) throw new Error('No group'); return clone(g); },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: evt(),
      async get(id) { const w = windows.get(id); if (!w) throw new Error('No window ' + id); return clone(w); },
      async getLastFocused() { return clone(windows.get(lastFocusedId)); },
      async update(id, p) { if (p.focused) focusChrome(id); return clone(windows.get(id)); },
    },
    idle: { onStateChanged: evt(), setDetectionInterval() {} },
    alarms: {
      onAlarm: evt(),
      async create(name, o) { alarms.set(name, { name, at: now() + o.delayInMinutes * 60000 }); },
      async clear(name) { return alarms.delete(name); },
    },
    notifications: {
      onClicked: evt(),
      async create(id, o) { notifications.push({ id, ...o }); return id; },
      async clear() { return true; },
    },
    commands: { onCommand: evt() },
  };

  function focusChrome(id = 1) {
    const w = windows.get(id);
    if (w.focused) return;
    for (const o of windows.values()) o.focused = false;
    w.focused = true;
    lastFocusedId = id;
    c.windows.onFocusChanged.fire(id);
  }

  // ---- user simulation ----
  const sim = {
    sent, notifications, alarms, tabs, groups, page, windows, moved: [], badge, menus,
    setContentSites(s) { contentSites = s; },
    addWindow(id) { windows.set(id, { id, focused: false, type: 'normal' }); },
    addChildFrame(tabId, { url, answersSnapshot = false }) {
      const list = children.get(tabId) || [];
      list.push({ frameId: list.length + 1, url, answersSnapshot });
      children.set(tabId, list);
    },
    closeTab(id) { const t = tabs.get(id); tabs.delete(id); children.delete(id); c.tabs.onRemoved.fire(id, { windowId: t.windowId }); },
    setPopupOpen(v) { popupOpen = v; },
    // Content script not injected yet in pages whose URL contains `s` (late injection).
    blockContent(s, on) { if (on) blockedContent.add(s); else blockedContent.delete(s); },
    setHoldLoads(v) { holdLoads = v; },
    finishLoad(id) {
      pendingLoads.delete(id);
      const t = tabs.get(id); if (!t) return;
      t.status = 'complete';
      c.tabs.onUpdated.fire(id, { status: 'complete' }, clone(t));
    },
    // Chrome restart: every group gets a new id per `remap` (old -> new), session storage
    // is wiped, Chrome re-announces the restored groups, then onStartup fires.
    // Tab ids are only unique within one browser session: `tabRemap` (old -> new) reassigns them.
    restartChrome(remap, tabRemap = {}) {
      const old = [...groups.values()];
      groups.clear();
      for (const g of old) groups.set(remap[g.id] ?? g.id, { ...g, id: remap[g.id] ?? g.id });
      for (const t of tabs.values()) if (t.groupId !== -1) t.groupId = remap[t.groupId] ?? t.groupId;
      const oldTabs = [...tabs.values()];
      const oldPage = new Map(page), oldKids = new Map(children);
      tabs.clear(); page.clear(); children.clear();
      for (const t of oldTabs) {
        const id = tabRemap[t.id] ?? t.id;
        tabs.set(id, { ...t, id, openerTabId: undefined });
        if (oldPage.has(t.id)) page.set(id, oldPage.get(t.id));
        if (oldKids.has(t.id)) children.set(id, oldKids.get(t.id));
      }
      c.storage.session.clear();
      for (const g of groups.values()) c.tabGroups.onUpdated.fire(clone(g));
      c.runtime.onStartup.fire();
    },
    openTab(url, { openerTabId, active = true, windowId = 1 } = {}) {
      const opener = openerTabId ? tabs.get(openerTabId) : null;
      const t = { id: nextTab++, windowId, url, title: url, active: false, groupId: opener ? opener.groupId : -1, openerTabId, pinned: false, status: 'complete' };
      tabs.set(t.id, t);
      c.tabs.onCreated.fire(clone(t));
      if (active) sim.activate(t.id);
      return t.id;
    },
    activate(id) {
      const t = tabs.get(id);
      for (const o of tabs.values()) if (o.windowId === t.windowId) o.active = false;
      t.active = true;
      c.tabs.onActivated.fire({ tabId: id, windowId: t.windowId });
    },
    navigate(id, url) { const t = tabs.get(id); t.url = url; c.tabs.onUpdated.fire(id, { url }, clone(t)); },
    blurChrome() { for (const w of windows.values()) w.focused = false; c.windows.onFocusChanged.fire(-1); },
    focusChrome,
    setPage(id, scrollY, highlight) { page.set(id, { scrollY, highlight }); },
    idle(state) { c.idle.onStateChanged.fire(state); },
    command(name) { const t = [...tabs.values()].find((x) => x.active); c.commands.onCommand.fire(name, clone(t)); },
    fireAlarm(name) { const a = alarms.get(name); if (a) { alarms.delete(name); c.alarms.onAlarm.fire({ name }); } },
    // message from content script / popup to the SW; resolves with the reply
    send(msg, tabId, frameId = 0) {
      return new Promise((resolve) => {
        const sender = tabId ? { tab: clone(tabs.get(tabId)), frameId } : {};
        c.runtime.onMessage.fire(msg, sender, resolve);
      });
    },
    sentOfType(type) { return sent.filter((m) => m.type === type); },
  };
  return { chrome: c, sim };
}
