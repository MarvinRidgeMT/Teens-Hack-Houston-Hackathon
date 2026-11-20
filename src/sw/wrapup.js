// Wrap up for the day -> "Start here" the next morning (Feature 2). Owner: Anish (Engine).
// Wrapping up is not an interruption: it saves where you stopped, closes any open
// break without logging it, and the next day's first activity shows one notification.

import * as store from '../shared/store.js';
import { MSG } from '../shared/messages.js';
import { START_HERE_DEBUG_MS, START_HERE_PREFIX, DAY_STARTS_AT_HOUR, featuresOf } from '../shared/constants.js';
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

export async function wrapUp(tab, nextStep, settings, { nextStepSource } = {}) {
  if (!tab) return { ok: false, error: 'no tab' };
  const thread = await ensureThreadForTab(tab, settings);
  if (!thread) return { ok: false, error: 'this page cannot hold a task' };
  const now = Date.now();
  const step = String(nextStep || '').trim();
  const snap = await snapshot(tab, settings);
  const crumb = await writeBreadcrumb({ thread, tab, snap, signal: 'wrap', leftAt: now, nextStep: step || undefined, nextStepSource: step ? nextStepSource : undefined });
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

// The task's current next step (the user may have changed it after wrapping up),
// else the one saved at wrap-up. Notification and card use the same one.
async function nextStepFor(wu) {
  const crumb = await store.getBreadcrumb(wu.threadId);
  if (crumb && crumb.nextStep) return { nextStep: crumb.nextStep, nextStepSource: crumb.nextStepSource };
  return { nextStep: wu.nextStep, nextStepSource: wu.nextStepSource };
}

// Called on user activity (tab activated or created, window focused, back from idle).
// Debug: 60 s after the wrap-up instead of the next day, for the demo video.
export async function checkStartHere() {
  const wu = await store.getWrapUp();
  if (!wu || wu.shown) return;
  const settings = await store.getSettings();
  const now = Date.now();
  // A later day always counts (also "Pretend it's tomorrow" in debug); debug adds the 60 s path.
  const due = dayKey(now) > wu.dayKey || (settings.debug && now - wu.at >= START_HERE_DEBUG_MS);
  if (!due) return;
  await store.setWrapUp({ ...wu, shown: true, shownAt: now }); // first, so it can never show twice
  // A break that began after the wrap-up is the night, not an interruption: drop it unlogged.
  const ob = await store.getOpenBreak();
  if (ob && ob.leftAt >= wu.at) {
    await store.setOpenBreak(null);
    await cancelNudge(ob.eventId);
    try { await chrome.notifications.clear(ob.eventId); } catch { /* none */ }
    log('dropped the break left open after wrap-up (not logged)');
  }
  const thread = await store.getThread(wu.threadId);
  if (!thread) return;
  const step = await nextStepFor(wu);
  await chrome.notifications.create(START_HERE_PREFIX + wu.threadId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon128.png'),
    title: `Start here: ${thread.name}`,
    message: step.nextStep ? `Next: ${step.nextStep} · Alt+R takes you back` : 'Pick up where you stopped yesterday · Alt+R takes you back',
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
  const step = await nextStepFor({ ...(wu && wu.threadId === threadId ? wu : {}), threadId });
  const msg = { type: MSG.startHere, threadName: thread.name, wrappedAt: wu && wu.threadId === threadId ? wu.at : null };
  if (step.nextStep) { msg.nextStep = step.nextStep; msg.nextStepSource = step.nextStepSource || 'typed'; }
  // Additive (F1/F4): the plan from the breadcrumb, and which features the card may use.
  const crumb = await store.getBreadcrumb(threadId);
  if (crumb && crumb.nextStep && crumb.stoppedAt) msg.stoppedAt = crumb.stoppedAt; // only with its next step
  if (crumb && crumb.nextStep && crumb.stuckOn) msg.stuckOn = crumb.stuckOn;
  msg.features = featuresOf(await store.getSettings());
  await sendToTab(r.tabId, msg);
  return r;
}
