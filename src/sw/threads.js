// Task threads = named work tasks shown as Chrome tab groups. Owner: Anish (Engine).
//
// Thread shape (contract + additive fields agreed at kickoff):
// { id, name, tabUrls[], groupId, source: 'suggested'|'manual', createdAt,
//   taskType, suggestedTabIds[], suggestedUrls[], excludedUrls[], auto? }
//
// Rules: the user stays in control. Pickup only groups a tab when the user starts
// a task on it. Tabs Chrome itself puts in the group because they were opened from
// a thread tab are marked "suggested"; the user keeps or removes them in the popup.
// Tabs the user adds by hand are manual and never touched.

import * as store from '../shared/store.js';
import { DEFAULT_TASK_TYPE, TASK_TYPES } from '../shared/constants.js';
import { isWorkUrl, isDistractionUrl } from '../shared/sites.js';
import { newId, getTab, tabUrl, sameDoc, log } from './util.js';

const GROUP_COLOR = 'cyan';
const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

function blankThread(name, source) {
  return {
    id: newId('th'),
    name,
    tabUrls: [],
    groupId: null,
    source,
    createdAt: Date.now(),
    taskType: DEFAULT_TASK_TYPE,
    suggestedTabIds: [],
    suggestedUrls: [],
    excludedUrls: [],
  };
}

export function threadForTabSync(tab, threads) {
  if (!tab) return null;
  const list = Object.values(threads);
  if (tab.groupId != null && tab.groupId !== NO_GROUP) {
    const byGroup = list.find((t) => t.groupId === tab.groupId);
    if (byGroup) return byGroup;
  }
  const url = tabUrl(tab);
  // Ungrouped threads (auto threads, or a group the user dissolved) match by URL.
  return list.find((t) => t.groupId == null && t.tabUrls.includes(url) && !t.excludedUrls.includes(url)) || null;
}

export async function threadForTab(tab) {
  return threadForTabSync(tab, await store.getThreads());
}

export function tabInThread(tab, thread, crumb) {
  if (!tab || !thread) return false;
  if (thread.groupId != null && tab.groupId === thread.groupId) return true;
  if (crumb && crumb.tabId === tab.id) return true;
  return thread.groupId == null && thread.tabUrls.includes(tabUrl(tab));
}

// Can this page be (part of) a task? Not a browser page and not a distraction site.
export function canHoldTask(tab, settings) {
  const url = tabUrl(tab);
  return /^https?:\/\//i.test(url) && !isDistractionUrl(url, settings);
}

// A work tab that is not in any task still needs a thread so its break has a
// threadId. Make a quiet one named after the page; no tab group, nothing moves.
// Returns null for pages that cannot hold a task (new-tab page, YouTube).
export async function ensureThreadForTab(tab, settings) {
  if (!canHoldTask(tab, settings)) return null;
  const existing = await threadForTab(tab);
  if (existing) return existing;
  const host = new URL(tabUrl(tab)).hostname;
  const title = tab.title && !/^https?:\/\//i.test(tab.title) ? tab.title : '';
  const name = (title || host || 'Untitled task').slice(0, 60);
  const t = blankThread(name, 'suggested');
  t.auto = true;
  t.tabUrls = [tabUrl(tab)];
  await store.putThread(t);
  log('auto thread', t.name);
  return t;
}

async function groupTitleUpdate(groupId, name) {
  try { await chrome.tabGroups.update(groupId, { title: name, color: GROUP_COLOR }); } catch (e) { log('group update failed', e); }
}

export async function refreshTabUrls(thread) {
  if (thread.groupId == null) return thread;
  try {
    const tabs = await chrome.tabs.query({ groupId: thread.groupId });
    thread.tabUrls = tabs.map(tabUrl).filter(Boolean);
    const live = new Set(tabs.map((t) => t.id));
    thread.suggestedTabIds = thread.suggestedTabIds.filter((id) => live.has(id));
  } catch { /* group gone */ }
  return thread;
}

// Popup "Start task" (and Alt+P with a task name). Puts the tab in a named group.
export async function startTask(tabId, name, taskType) {
  const tab = await getTab(tabId);
  if (!tab) return { ok: false, error: 'tab not found' };
  const clean = String(name || '').trim().slice(0, 60) || 'Untitled task';
  let thread = await threadForTab(tab);
  if (thread && !thread.auto && thread.groupId != null) {
    thread.name = clean; // rename existing task
  } else {
    if (!thread) thread = blankThread(clean, 'manual');
    thread.name = clean;
    thread.source = 'manual';
    delete thread.auto;
    let groupId = tab.groupId != null && tab.groupId !== NO_GROUP ? tab.groupId : null;
    if (groupId == null) groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    thread.groupId = groupId;
  }
  if (taskType && TASK_TYPES.includes(taskType)) thread.taskType = taskType;
  await groupTitleUpdate(thread.groupId, thread.name);
  await refreshTabUrls(thread);
  if (!thread.tabUrls.length) thread.tabUrls = [tabUrl(tab)];
  await store.putThread(thread);
  log('task started', thread.name, 'group', thread.groupId);
  return { ok: true, thread };
}

// A tab joined or left a group (Chrome event, user drag, or our own grouping).
export async function onTabGroupChanged(tab) {
  const threads = await store.getThreads();
  let changed = false;
  for (const t of Object.values(threads)) {
    // Left this thread's group: drop it from suggestions.
    if (t.suggestedTabIds.includes(tab.id) && tab.groupId !== t.groupId) {
      t.suggestedTabIds = t.suggestedTabIds.filter((id) => id !== tab.id);
      changed = true;
    }
    if (t.groupId != null && t.groupId === tab.groupId) {
      const opener = await getTab(tab.openerTabId);
      const fromThread = opener && opener.id !== tab.id && opener.groupId === t.groupId;
      const url = tabUrl(tab);
      if (fromThread && !t.suggestedTabIds.includes(tab.id) && !t.excludedUrls.includes(url)) {
        t.suggestedTabIds.push(tab.id);
        if (url && !t.suggestedUrls.includes(url)) t.suggestedUrls.push(url);
        log('suggested tab for', t.name, url);
      }
      await refreshTabUrls(t);
      changed = true;
    } else if (t.groupId != null) {
      await refreshTabUrls(t);
    }
  }
  if (changed) await store.setThreads(threads);
}

export async function onTabUrlChanged(tab) {
  if (tab.groupId == null || tab.groupId === NO_GROUP) return;
  const threads = await store.getThreads();
  const t = Object.values(threads).find((x) => x.groupId === tab.groupId);
  if (!t) return;
  await refreshTabUrls(t);
  await store.setThreads(threads);
}

// Popup: user removes a suggested tab. It leaves the group and stays out.
export async function removeFromThread(threadId, tabId) {
  const t = await store.getThread(threadId);
  const tab = await getTab(tabId);
  if (!t || !tab) return { ok: false, error: 'not found' };
  const url = tabUrl(tab);
  if (url && !t.excludedUrls.includes(url)) t.excludedUrls.push(url);
  t.suggestedTabIds = t.suggestedTabIds.filter((id) => id !== tabId);
  t.suggestedUrls = t.suggestedUrls.filter((u) => u !== url);
  if (t.groupId != null && tab.groupId === t.groupId) {
    try { await chrome.tabs.ungroup(tabId); } catch (e) { log('ungroup failed', e); }
  }
  t.tabUrls = t.tabUrls.filter((u) => u !== url);
  await refreshTabUrls(t);
  await store.putThread(t);
  return { ok: true };
}

// Popup: user keeps a suggested tab. It becomes a manual member.
export async function keepInThread(threadId, tabId) {
  const t = await store.getThread(threadId);
  if (!t) return { ok: false, error: 'not found' };
  t.suggestedTabIds = t.suggestedTabIds.filter((id) => id !== tabId);
  await store.putThread(t);
  return { ok: true };
}

export async function setTaskType(threadId, taskType) {
  const t = await store.getThread(threadId);
  if (!t || !TASK_TYPES.includes(taskType)) return { ok: false };
  t.taskType = taskType;
  await store.putThread(t);
  return { ok: true };
}

// The user renamed or removed a group in Chrome's own UI. Callers run
// ensureLinked() first, so group ids here are this browser session's ids.
export async function onGroupUpdated(group) {
  const threads = await store.getThreads();
  const list = Object.values(threads);
  const t = list.find((x) => x.groupId === group.id);
  if (t && group.title && group.title !== t.name) {
    t.name = group.title;
    await store.setThreads(threads);
  } else if (!t && group.title) {
    // A restored group got its title after the relink ran: link it now.
    const lost = list.find((x) => x.groupId == null && !x.auto && x.name === group.title);
    if (lost) { lost.groupId = group.id; await store.setThreads(threads); log('relinked', lost.name); }
  }
}
export async function onGroupRemoved(group) {
  const threads = await store.getThreads();
  const t = Object.values(threads).find((x) => x.groupId === group.id);
  if (t) {
    t.groupId = null; // keep the thread; it now matches by URL
    await store.setThreads(threads);
  }
}

// Group ids change when Chrome restarts, and a stale id can now belong to a
// different group. Re-link every thread to the group with its title.
export async function relinkGroups() {
  const threads = await store.getThreads();
  let groups = [];
  try { groups = await chrome.tabGroups.query({}); } catch { return; }
  const list = Object.values(threads).filter((t) => !(t.groupId == null && t.auto));
  const claimed = new Set();
  // Pass 1: ids that still point at a group with the thread's title are right.
  const ok = new Set();
  for (const t of list) {
    const g = t.groupId != null && groups.find((x) => x.id === t.groupId);
    if (g && g.title === t.name) { ok.add(t.id); claimed.add(g.id); }
  }
  // Pass 2: everything else matches an unclaimed group by title, or loses its group.
  let changed = false;
  for (const t of list) {
    if (ok.has(t.id)) continue;
    const match = groups.find((g) => g.title === t.name && !claimed.has(g.id));
    if (match) claimed.add(match.id);
    const next = match ? match.id : null;
    if (next !== t.groupId) { t.groupId = next; changed = true; }
  }
  // Tab ids are only unique within one browser session, so stored ids may now
  // point at unrelated tabs. Re-find them by URL.
  if (await relinkTabs(threads)) changed = true;
  if (changed) await store.setThreads(threads);
  await store.setGroupsLinked(true);
}

async function relinkTabs(threads) {
  let all = [];
  try { all = await chrome.tabs.query({}); } catch { return false; }
  const byId = new Map(all.map((t) => [t.id, t]));
  const crumbs = await store.getBreadcrumbs();
  let crumbsChanged = false;
  for (const c of Object.values(crumbs)) {
    const cur = byId.get(c.tabId);
    if (cur && sameDoc(tabUrl(cur), c.url)) continue;
    const match = all.find((t) => tabUrl(t) === c.url) || all.find((t) => sameDoc(tabUrl(t), c.url));
    const next = match ? match.id : null;
    if (next !== c.tabId) { c.tabId = next; crumbsChanged = true; }
  }
  if (crumbsChanged) await store.setBreadcrumbs(crumbs);
  const ob = await store.getOpenBreak();
  if (ob && crumbs[ob.threadId] && crumbs[ob.threadId].tabId !== ob.tabId) {
    await store.setOpenBreak({ ...ob, tabId: crumbs[ob.threadId].tabId });
  }
  let threadsChanged = false;
  for (const t of Object.values(threads)) {
    const keep = t.suggestedTabIds.filter((id) => byId.has(id) && t.suggestedUrls.includes(tabUrl(byId.get(id))));
    if (keep.length !== t.suggestedTabIds.length) { t.suggestedTabIds = keep; threadsChanged = true; }
  }
  return threadsChanged;
}

// Run before any handler that reads group ids. Cheap after the first call per
// browser session (one chrome.storage.session read).
export async function ensureLinked() {
  if (!(await store.getGroupsLinked())) await relinkGroups();
}

export async function suggestedTabsFor(thread) {
  const out = [];
  for (const id of thread.suggestedTabIds) {
    const tab = await getTab(id);
    if (tab && tab.groupId === thread.groupId) out.push({ tabId: tab.id, url: tabUrl(tab), title: tab.title || '' });
  }
  return out;
}

// A distraction site is never work, even inside a task group (a YouTube link
// opened from the Doc joins the group).
export function isWorkTab(tab, settings, thread) {
  const url = tabUrl(tab);
  if (isDistractionUrl(url, settings)) return false;
  return !!thread || isWorkUrl(url, settings);
}
