// Wrap up for the day -> "Start here" the next morning (Feature 2). Owner: Anish (Engine).
// Wrapping up is not an interruption: it saves where you stopped, closes any open
// break without logging it, and the next day's first activity shows one notification.

import * as store from '../shared/store.js';
import { MSG } from '../shared/messages.js';
import { START_HERE_DEBUG_MS, START_HERE_PREFIX, DAY_STARTS_AT_HOUR } from '../shared/constants.js';
import { ensureThreadForTab } from './threads.js';
import { snapshot, writeBreadcrumb, resume } from './events.js';
import { cancelNudge } from './nudge.js';
import { sendToTab, log } from './util.js';

// Local date of (t - 4 h), so working past midnight still counts as "tonight".
export function dayKey(t) {
  const d = new Date(t - DAY_STARTS_AT_HOUR * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function wrapUp(tab, nextStep, settings) {
  if (!tab) return { ok: false, error: 'no tab' };
  const thread = await ensureThreadForTab(tab, settings);
  if (!thread) return { ok: false, error: 'this page cannot hold a task' };
  const now = Date.now();
  const step = String(nextStep || '').trim();
  const snap = await snapshot(tab, settings);
  const crumb = await writeBreadcrumb({ thread, tab, snap, signal: 'wrap', leftAt: now, nextStep: step || undefined });
  const ob = await store.getOpenBreak();
  if (ob) {
    // Not an interruption: the break goes away unlogged, with its nudge.
    await store.setOpenBreak(null);
    await cancelNudge(ob.eventId);
    try { await chrome.notifications.clear(ob.eventId); } catch { /* none */ }
    log('wrap-up closed an open break (not logged)');
  }
  const wu = {
    threadId: thread.id, tabId: tab.id, url: crumb.url, scrollY: crumb.scrollY, highlight: crumb.highlight,
    at: now, dayKey: dayKey(now), shown: false,
  };
  if (crumb.nextStep) { wu.nextStep = crumb.nextStep; wu.nextStepSource = crumb.nextStepSource; }
  await store.setWrapUp(wu);
  log('wrapped up', thread.name, 'for', wu.dayKey);
  return { ok: true, wrapUp: wu };
}

// Called on user activity (tab activated or created, window focused, back from idle).
// Debug: 60 s after the wrap-up instead of the next day, for the demo video.
export async function checkStartHere() {
  const wu = await store.getWrapUp();
  if (!wu || wu.shown) return;
  const settings = await store.getSettings();
  const now = Date.now();
  const due = settings.debug ? now - wu.at >= START_HERE_DEBUG_MS : dayKey(now) > wu.dayKey;
  if (!due) return;
  await store.setWrapUp({ ...wu, shown: true, shownAt: now }); // first, so it can never show twice
  const thread = await store.getThread(wu.threadId);
  if (!thread) return;
  await chrome.notifications.create(START_HERE_PREFIX + wu.threadId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon128.png'),
    title: `Start here: ${thread.name}`,
    message: wu.nextStep ? `Next: ${wu.nextStep}` : 'Pick up where you stopped yesterday',
    priority: 0,
  });
  log('start here shown', thread.name);
}

// Start-here notification clicked. Not an experiment event: no break was open.
export async function onStartHereClicked(threadId) {
  const wu = await store.getWrapUp();
  const thread = await store.getThread(threadId);
  if (!thread) return { ok: false, error: 'task gone' };
  const r = await resume(threadId);
  if (!r.ok || !r.tabId) return r;
  // Optional message: a content script without a handler just ignores it.
  const crumb = await store.getBreadcrumb(threadId);
  const msg = { type: MSG.startHere, threadName: thread.name, wrappedAt: wu && wu.threadId === threadId ? wu.at : null };
  if (crumb && crumb.nextStep) { msg.nextStep = crumb.nextStep; msg.nextStepSource = crumb.nextStepSource || 'typed'; }
  await sendToTab(r.tabId, msg);
  return r;
}
