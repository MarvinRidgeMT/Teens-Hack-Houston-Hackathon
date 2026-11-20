// Breaks, breadcrumbs and the event log (the experiment). Owner: Anish (Engine).
//
// A break opens on a possible interruption signal and closes when a tab of the
// same thread is active and focused again. Under the threshold it is discarded
// silently; over it, an event is created and randomly assigned to pickup
// (card shown) or control (no card). Breadcrumbs are saved in both conditions.

import * as store from '../shared/store.js';
import { MSG } from '../shared/messages.js';
import {
  CONDITIONS, DEBUG_THRESHOLD_MS, HIGHLIGHT_MAX, LATER_GROUP_TITLE, awayBucket, DEFAULT_TASK_TYPE,
  NEXT_STEP_CLEARS_ON_RETURN, RETURN_VIA, RETURN_VIA_TTL_MS,
} from '../shared/constants.js';
import { isWorkUrl, isDistractionUrl } from '../shared/sites.js';
import { ensureThreadForTab, tabInThread, threadForTab } from './threads.js';
import { flashBadge } from './badge.js';
import { scheduleNudge, cancelNudge } from './nudge.js';
import { newId, getTab, sendToTab, tabUrl, sameDoc, log } from './util.js';

const cap = (s, n) => String(s || '').slice(0, n);

export function thresholdMs(settings) {
  return settings.debug ? DEBUG_THRESHOLD_MS : Number(settings.awayThresholdMs) || 120000;
}

// Ask the page where the user is. Falls back to the last debounced `state`
// the content script sent, then to just the URL.
export async function snapshot(tab, settings) {
  const url = tabUrl(tab);
  const live = await sendToTab(tab.id, { type: MSG.snapshot }, 1000);
  if (live && live.url) {
    return { url: live.url, scrollY: Number(live.scrollY) || 0, highlight: cap(live.highlight, HIGHLIGHT_MAX), live: true };
  }
  const st = await store.getTabState(tab.id);
  if (st && (st.url === url || !isWorkUrl(url, settings))) {
    return { url: st.url, scrollY: Number(st.scrollY) || 0, highlight: cap(st.highlight, HIGHLIGHT_MAX), live: false };
  }
  return { url, scrollY: 0, highlight: '', live: false };
}

async function writeBreadcrumb({ thread, tab, snap, signal, leftAt, nextStep }) {
  const prev = await store.getBreadcrumb(thread.id);
  const crumb = {
    threadId: thread.id,
    tabId: tab.id,
    url: snap.url,
    scrollY: snap.scrollY,
    // Keep the last highlight if the page has none right now.
    highlight: snap.highlight || (prev && prev.url === snap.url ? prev.highlight : '') || '',
    leftAt,
    signal,
  };
  // The next step is the user's own words: keep it until they write a new one.
  const step = nextStep !== undefined ? nextStep : prev && prev.nextStep;
  if (step) crumb.nextStep = cap(step, HIGHLIGHT_MAX);
  await store.putBreadcrumb(crumb);
  return crumb;
}

// Decision 7: what the breadcrumb looks like after a logged return.
export function crumbAfterReturn(crumb, clearNextStep) {
  if (!clearNextStep || !crumb || !crumb.nextStep) return crumb;
  const { nextStep, ...rest } = crumb;
  return rest;
}

// Open a break for `workTab`. Returns the openBreak record, or null if one is already open.
export async function openBreakFor(workTab, signal, leftAt, settings, { departed = true, nextStep, windowId } = {}) {
  if (await store.getOpenBreak()) return null;
  const thread = await ensureThreadForTab(workTab, settings);
  if (!thread) return null;
  const snap = await snapshot(workTab, settings);
  const crumb = await writeBreadcrumb({ thread, tab: workTab, snap, signal, leftAt, nextStep });
  const ob = {
    eventId: newId('ev'),
    threadId: thread.id,
    tabId: workTab.id,
    leftAt,
    signal,
    departed,
    windowId: windowId ?? workTab.windowId,
  };
  await store.setOpenBreak(ob);
  if (departed) await scheduleNudge(ob, crumb, settings);
  log('break opened', signal, thread.name, departed ? '' : '(waiting for you to leave)');
  return ob;
}

// Alt+P with the overlay answered (or popup Park). The break starts when the
// user actually leaves, so time spent working after parking is not "away".
export async function park(tab, nextStep, settings) {
  const thread = await ensureThreadForTab(tab, settings);
  if (!thread) return null;
  const snap = await snapshot(tab, settings);
  const now = Date.now();
  const step = String(nextStep || '').trim();
  await writeBreadcrumb({ thread, tab, snap, signal: 'park', leftAt: now, nextStep: step || undefined });
  const prev = await store.getOpenBreak();
  if (prev) await cancelNudge(prev.eventId);
  const ob = { eventId: newId('ev'), threadId: thread.id, tabId: tab.id, leftAt: now, signal: 'park', departed: false, windowId: tab.windowId, parkedAt: now };
  await store.setOpenBreak(ob);
  log('parked', thread.name, step ? `next: ${step}` : '(no note)');
  return ob;
}

// A parked break becomes real when the user leaves the thread.
export async function markDeparted(leftAt, settings) {
  const ob = await store.getOpenBreak();
  if (!ob || ob.departed) return;
  const tab = await getTab(ob.tabId);
  let crumb = await store.getBreadcrumb(ob.threadId);
  if (tab) {
    const snap = await snapshot(tab, settings);
    const thread = await store.getThread(ob.threadId);
    if (thread) crumb = await writeBreadcrumb({ thread, tab, snap, signal: 'park', leftAt });
  }
  const next = { ...ob, departed: true, leftAt };
  await store.setOpenBreak(next);
  await scheduleNudge(next, crumb, settings);
  log('left parked task');
}

// The user is back on a tab of the break's thread. `via` is how the caller saw the
// return ('tab' or 'idle'); a fresh marker from Pickup's own navigation wins.
export async function closeBreakOnReturn(tab, settings, { via = RETURN_VIA.tab } = {}) {
  const ob = await store.getOpenBreak();
  if (!ob || !ob.departed) return null;
  const now = Date.now();
  const awayMs = now - ob.leftAt;
  const returnVia = (await store.takeReturnVia(RETURN_VIA_TTL_MS)) || via;
  await store.setOpenBreak(null);
  await cancelNudge(ob.eventId);
  try { await chrome.notifications.clear(ob.eventId); } catch { /* none */ }

  if (awayMs < thresholdMs(settings)) {
    log('short absence discarded', Math.round(awayMs / 1000), 's');
    return null;
  }

  const thread = await store.getThread(ob.threadId);
  const crumb = await store.getBreadcrumb(ob.threadId);
  const distractionHosts = await store.getBreakHosts(ob.eventId);
  const forced = settings.debug && settings.forceCard;
  const condition = forced ? CONDITIONS.pickup : (Math.random() < 0.5 ? CONDITIONS.pickup : CONDITIONS.control);

  const ev = {
    id: ob.eventId,
    participant: settings.participant || '',
    threadId: ob.threadId,
    signal: ob.signal,
    leftAt: ob.leftAt,
    returnedAt: now,
    firstInteractionAt: null,
    condition,
    awayBucket: awayBucket(awayMs),
    taskType: (thread && thread.taskType) || DEFAULT_TASK_TYPE,
    nextActionDoneAt: null,
    debug: !!settings.debug,
    cardShown: false, // additive: was a card actually drawn (pickup but no content script => false)
    // Additive (Thu night, pending team OK at the 11:30 sync):
    awayMs,                                        // exact returnedAt - leftAt
    distractionHost: distractionHosts[0] || null,  // first distraction site seen in the break
    distractionHosts,                              // every distraction host seen, in order, once each
    returnVia,                                     // 'tab' | 'resumeKey' | 'notification' | 'idle'
  };
  await store.addEvent(ev);

  // Is Sidd's content script in the tab we came back to? (snapshot always replies)
  const alive = await sendToTab(tab.id, { type: MSG.snapshot }, 800);
  await sendToTab(tab.id, { type: MSG.armTimer, eventId: ev.id }, 1500, { allFrames: true });

  if (condition === CONDITIONS.pickup && alive) {
    let tabCount = 1;
    if (thread && thread.groupId != null) {
      try { tabCount = (await chrome.tabs.query({ groupId: thread.groupId })).length; } catch { /* keep 1 */ }
    } else if (thread) tabCount = Math.max(1, thread.tabUrls.length);
    const card = {
      type: MSG.showCard,
      eventId: ev.id,
      threadName: thread ? thread.name : 'your task',
      awayMs,
      where: { scrollY: crumb ? crumb.scrollY : 0, highlight: crumb ? crumb.highlight : '' },
      tabCount,
    };
    if (crumb && crumb.nextStep) card.nextStep = crumb.nextStep;
    await sendToTab(tab.id, card);
    await store.updateEvent(ev.id, { cardShown: true });
  }
  const after = crumbAfterReturn(crumb, NEXT_STEP_CLEARS_ON_RETURN);
  if (after !== crumb) await store.putBreadcrumb(after);
  log('return', ev.condition, ev.awayBucket, Math.round(awayMs / 1000), 's away', ev.debug ? '[debug]' : '');
  return ev;
}

export async function recordFirstInteraction(eventId, at) {
  const all = await store.getEvents();
  const ev = all.find((e) => e.id === eventId);
  if (!ev || ev.firstInteractionAt) return;
  const t = Number(at) || Date.now();
  await store.updateEvent(eventId, { firstInteractionAt: t });
  log('first work interaction after', Math.round((t - ev.returnedAt) / 1000), 's');
}

// ---- Resume: focus window, activate tab, expand group, restore scroll ----
export async function resume(threadId) {
  const crumb = await store.getBreadcrumb(threadId);
  const thread = await store.getThread(threadId);
  if (!crumb) return { ok: false, error: 'no breadcrumb' };
  let tab = await getTab(crumb.tabId);
  if (!tab || tabUrl(tab) !== crumb.url) {
    const all = await chrome.tabs.query({});
    // Fall back to the saved tab only if it still shows the same page.
    tab = all.find((t) => tabUrl(t) === crumb.url) || (tab && sameDoc(tabUrl(tab), crumb.url) ? tab : null);
  }
  let created = false;
  if (!tab) {
    // The tab was closed. Reopen it in its task group's window and put it back in
    // the group (the user clicked Resume), so later breaks still find the thread.
    const group = thread && thread.groupId != null ? await getGroup(thread.groupId) : null;
    tab = await chrome.tabs.create({ url: crumb.url, active: true, ...(group ? { windowId: group.windowId } : {}) });
    created = true;
    if (group) {
      try { await chrome.tabs.group({ groupId: group.id, tabIds: [tab.id] }); } catch (e) { log('regroup failed', e); }
    }
  }
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  if (thread && thread.groupId != null) {
    try { await chrome.tabGroups.update(thread.groupId, { collapsed: false }); } catch { /* group gone */ }
  }
  const msg = { type: MSG.restoreScroll, scrollY: crumb.scrollY || 0 };
  // A recreated tab has to load before it can scroll. Wait for that outside the
  // serial queue (not awaited), so other handlers are not held for up to 8 s.
  if (created) restoreAfterLoad(tab.id, msg);
  else await sendToTab(tab.id, msg);
  return { ok: true, tabId: tab.id };
}

// ---- Resume from anywhere (Alt+R / popup resumeTask) ----
// Target: the open break's thread (parked or away), else the breadcrumb left most
// recently, else the thread of the last work tab. Returns a thread id or null.
export async function pickResumeTarget() {
  const ob = await store.getOpenBreak();
  if (ob) return ob.threadId;
  const threads = await store.getThreads();
  const crumbs = Object.values(await store.getBreadcrumbs()).filter((c) => threads[c.threadId]);
  crumbs.sort((a, b) => (b.leftAt || 0) - (a.leftAt || 0));
  if (crumbs[0]) return crumbs[0].threadId;
  const lw = await store.getAnyLastWork();
  const tab = lw && (await getTab(lw.tabId));
  const thread = tab && (await threadForTab(tab));
  return thread ? thread.id : null;
}

export async function resumeTask(threadId) {
  const id = threadId || (await pickResumeTarget());
  const thread = id && (await store.getThread(id));
  if (!thread) {
    await flashBadge('?');
    log('resume: no task to go back to');
    return { ok: false, error: 'no task to go back to' };
  }
  const crumb = await store.getBreadcrumb(id);
  const ob = await store.getOpenBreak();
  const settings = await store.getSettings();
  // Already looking at the task with nothing open: just put the scroll back. No event.
  if (!ob) {
    const here = await focusedActiveTab();
    if (here && tabInThread(here, thread, crumb) && !isDistractionUrl(tabUrl(here), settings)) {
      if (crumb) await sendToTab(here.id, { type: MSG.restoreScroll, scrollY: crumb.scrollY || 0 });
      return { ok: true, threadId: id, already: true };
    }
  }
  // The return that closes the break then reads this marker (event.returnVia).
  if (ob && ob.departed && ob.threadId === id) await store.setReturnVia(RETURN_VIA.resumeKey);
  if (crumb) {
    const r = await resume(id);
    return { ...r, threadId: id };
  }
  // No breadcrumb yet (a task that never had a break): go to its last work tab.
  const lw = await store.getAnyLastWork();
  const tab = lw && (await getTab(lw.tabId));
  if (!tab) { await flashBadge('?'); return { ok: false, error: 'no task to go back to' }; }
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  return { ok: true, threadId: id, tabId: tab.id };
}

async function focusedActiveTab() {
  let win;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch { return null; }
  if (!win || !win.focused) return null;
  try { const [t] = await chrome.tabs.query({ active: true, windowId: win.id }); return t || null; } catch { return null; }
}

async function getGroup(groupId) {
  try { return await chrome.tabGroups.get(groupId); } catch { return null; }
}

// The content script can arrive a little after 'complete' (document_idle, or a
// redirect fired an early 'complete'). Ping with snapshot up to 3 times first.
async function restoreAfterLoad(tabId, msg) {
  try {
    await waitForComplete(tabId);
    for (let i = 0; i < 3; i++) {
      if (await sendToTab(tabId, { type: MSG.snapshot }, 800)) break;
      if (i < 2) await new Promise((r) => setTimeout(r, 500));
      else log('no content script answered; sending restoreScroll anyway');
    }
    await sendToTab(tabId, msg);
  } catch (e) { log('restore after load failed', e); }
}

function waitForComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(fn);
      clearTimeout(timer);
      setTimeout(resolve, 300);
    };
    const fn = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(fn);
    // It may have finished loading before the listener was added.
    (async () => { const t = await getTab(tabId); if (t && t.status === 'complete') done(); })();
  });
}

// ---- Tidy: distraction tabs from the break go into a collapsed "Later" group in
// their own window. Never closes a tab and never moves one to another window.
// The active tab of a window is left alone (collapsing it would change that window).
export async function tidy(eventId, settings) {
  const ids = await store.getBreakTabs(eventId);
  const byWindow = new Map();
  for (const id of ids) {
    const t = await getTab(id);
    if (!t || t.active || t.pinned || !isDistractionUrl(tabUrl(t), settings)) continue;
    if (!byWindow.has(t.windowId)) byWindow.set(t.windowId, []);
    byWindow.get(t.windowId).push(t);
  }
  let moved = 0;
  for (const [wid, list] of byWindow) {
    const [existing] = await chrome.tabGroups.query({ windowId: wid, title: LATER_GROUP_TITLE });
    const opts = { tabIds: list.map((t) => t.id) };
    if (existing) opts.groupId = existing.id; else opts.createProperties = { windowId: wid };
    const groupId = await chrome.tabs.group(opts);
    await chrome.tabGroups.update(groupId, { title: LATER_GROUP_TITLE, collapsed: true, color: 'grey' });
    moved += list.length;
  }
  log('tidied', moved, 'tab(s) into Later');
  return { ok: true, moved };
}

export async function threadIdForEvent(eventId) {
  const ev = (await store.getEvents()).find((e) => e.id === eventId);
  return ev ? ev.threadId : null;
}

export { tabInThread };
