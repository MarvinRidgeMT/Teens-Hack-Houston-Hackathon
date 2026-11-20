// Small helpers over chrome.storage. Owner: Anish (Engine).
// Rule: an MV3 service worker can stop after ~30 s idle, so every handler reads
// state from here first and nothing important lives in a global variable.

import { KEYS, SESSION_KEYS, DEFAULT_SETTINGS } from './constants.js';
import { hostOf } from './sites.js';

const local = () => chrome.storage.local;
const session = () => chrome.storage.session;

async function getLocal(key, fallback) {
  const out = await local().get(key);
  return out[key] === undefined ? fallback : out[key];
}
async function setLocal(key, value) {
  await local().set({ [key]: value });
}
async function getSession(key, fallback) {
  const out = await session().get(key);
  return out[key] === undefined ? fallback : out[key];
}
async function setSession(key, value) {
  await session().set({ [key]: value });
}

// ---- settings (written by Abhinav's setup page) ----
export async function getSettings() {
  const s = await getLocal(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...s };
}
export async function setSettings(patch) {
  const s = await getSettings();
  await setLocal(KEYS.settings, { ...s, ...patch });
}

// ---- threads: { [id]: Thread } ----
export const getThreads = () => getLocal(KEYS.threads, {});
export const setThreads = (t) => setLocal(KEYS.threads, t);
export async function getThread(id) {
  if (!id) return null;
  return (await getThreads())[id] || null;
}
export async function putThread(thread) {
  const all = await getThreads();
  all[thread.id] = thread;
  await setThreads(all);
  return thread;
}

// ---- breadcrumbs: { [threadId]: Breadcrumb } ----
export const getBreadcrumbs = () => getLocal(KEYS.breadcrumbs, {});
export async function getBreadcrumb(threadId) {
  return (await getBreadcrumbs())[threadId] || null;
}
export const setBreadcrumbs = (all) => setLocal(KEYS.breadcrumbs, all);
export async function putBreadcrumb(crumb) {
  const all = await getBreadcrumbs();
  all[crumb.threadId] = crumb;
  await setLocal(KEYS.breadcrumbs, all);
  return crumb;
}

// ---- openBreak: OpenBreak | null ----
export const getOpenBreak = () => getLocal(KEYS.openBreak, null);
export const setOpenBreak = (b) => setLocal(KEYS.openBreak, b);

// ---- wrapUp: WrapUp | null (Feature 2) ----
export const getWrapUp = () => getLocal(KEYS.wrapUp, null);
export const setWrapUp = (w) => setLocal(KEYS.wrapUp, w);

// ---- events: Event[] ----
// Note: the whole array is rewritten on every add/update. Fine for a pilot (~200
// events, a few KB each write). If it ever grows to thousands, split it into
// per-day keys (events:2026-11-20) so a write only touches one day.
export const getEvents = () => getLocal(KEYS.events, []);
export async function addEvent(ev) {
  const all = await getEvents();
  all.push(ev);
  await setLocal(KEYS.events, all);
  return ev;
}
export async function updateEvent(id, patch) {
  const all = await getEvents();
  const i = all.findIndex((e) => e.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  await setLocal(KEYS.events, all);
  return all[i];
}

// ---- session (engine-internal) ----
async function getMap(key) { return getSession(key, {}); }
async function patchMap(key, k, v) {
  const m = await getMap(key);
  if (v === undefined) delete m[k]; else m[k] = v;
  await setSession(key, m);
}

export const getLastActive = async (windowId) => (await getMap(SESSION_KEYS.lastActiveByWindow))[windowId] || null;
export const setLastActive = (windowId, v) => patchMap(SESSION_KEYS.lastActiveByWindow, windowId, v);
export const getLastWork = async (windowId) => (await getMap(SESSION_KEYS.lastWorkByWindow))[windowId] || null;
export const setLastWork = (windowId, v) => patchMap(SESSION_KEYS.lastWorkByWindow, windowId, v);
export async function getAnyLastWork() {
  const m = await getMap(SESSION_KEYS.lastWorkByWindow);
  const all = Object.values(m);
  all.sort((a, b) => (b.at || 0) - (a.at || 0));
  return all[0] || null;
}

export const getTabState = async (tabId) => (await getMap(SESSION_KEYS.tabState))[tabId] || null;
export const setTabState = (tabId, v) => patchMap(SESSION_KEYS.tabState, tabId, v);

export const getBreakTabs = async (eventId) => (await getMap(SESSION_KEYS.breakTabs))[eventId] || [];
export const getBreakHosts = async (eventId) => (await getMap(SESSION_KEYS.breakHosts))[eventId] || [];
// `url` is the distraction page the tab showed when it was seen; only its hostname is kept.
export async function addBreakTab(eventId, tabId, url) {
  const list = await getBreakTabs(eventId);
  if (!list.includes(tabId)) list.push(tabId);
  await patchMap(SESSION_KEYS.breakTabs, eventId, list);
  const host = url ? hostOf(url) : '';
  if (host) {
    const hosts = await getBreakHosts(eventId);
    if (!hosts.includes(host)) { hosts.push(host); await patchMap(SESSION_KEYS.breakHosts, eventId, hosts); }
  }
}

// returnVia marker: set right before Pickup activates the task tab itself, read
// (and cleared) by the return that closes the break.
export const setReturnVia = (via) => setSession(SESSION_KEYS.returnVia, { via, at: Date.now() });
export async function takeReturnVia(ttlMs) {
  const m = await getSession(SESSION_KEYS.returnVia, null);
  if (!m) return null;
  await setSession(SESSION_KEYS.returnVia, null);
  return Date.now() - m.at <= ttlMs ? m.via : null;
}

export const getLastFocused = () => getSession(SESSION_KEYS.lastFocused, null);
export const setLastFocused = (v) => setSession(SESSION_KEYS.lastFocused, v);

export const getPendingSwitch = () => getSession(SESSION_KEYS.pendingSwitch, null);
export const setPendingSwitch = (v) => setSession(SESSION_KEYS.pendingSwitch, v);

export const getFocusPopupSeen = () => getSession(SESSION_KEYS.focusPopupSeen, false);
export const setFocusPopupSeen = (v) => setSession(SESSION_KEYS.focusPopupSeen, v);

export const getGroupsLinked = () => getSession(SESSION_KEYS.groupsLinked, false);
export const setGroupsLinked = (v) => setSession(SESSION_KEYS.groupsLinked, v);

export const getFocusLostAt = () => getSession(SESSION_KEYS.focusLostAt, null);
export const setFocusLostAt = (v) => setSession(SESSION_KEYS.focusLostAt, v);

// Wipe everything Pickup stores (dashboard "Delete all" can call this or clear storage directly).
export async function deleteAll() {
  await local().clear();
  await session().clear();
}

// ---- serial queue: run SW handlers one at a time so read-modify-write on storage never races ----
let chain = Promise.resolve();
export function serial(fn) {
  const run = chain.then(() => fn(), () => fn()); // never pass the previous result on
  chain = run.catch(() => {});
  return run;
}
