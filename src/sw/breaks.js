// Pickup panel, engine side. Owner: Anish (Engine).
// - Break timer ("Back in 10"): parks the task like Alt+P, plans the break on
//   openBreak (plannedMin, endsAt), and replaces that break's drift nudge with one
//   "Break's over" notification. Return detection and the coin flip are unchanged.
// - Task list (listThreads) and typed next steps (setNextStep).
// Nothing here creates or edits events; plannedBreakMin is copied from openBreak by
// closeBreakOnReturn.

import * as store from '../shared/store.js';
import {
  BREAK_ALARM_PREFIX, BREAK_TICK_ALARM, BREAK_MIN, BREAK_MAX, DEBUG_BREAK_MS_PER_MIN,
  RETURN_VIA, NEXT_STEP_SOURCE, HIGHLIGHT_MAX,
} from '../shared/constants.js';
import { isWorkUrl, hostOf } from '../shared/sites.js';
import { park, noteNextStep, resume, pickResumeTarget, taskTab } from './events.js';
import { cancelNudge, scheduleNudge } from './nudge.js';
import { tabInThread } from './threads.js';
import { updateBadge } from './badge.js';
import { getTab, tabUrl, log } from './util.js';

export const breakMs = (minutes, settings) => minutes * (settings && settings.debug ? DEBUG_BREAK_MS_PER_MIN : 60000);
export const clockTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

async function activeTab() {
  try { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return t || null; } catch { return null; }
}

// ---------- break timer ----------
// The break to plan: park the active work tab (like Alt+P); else the break already
// open (you may be on YouTube); else park the most recent task's own tab.
async function breakToPlan(tab, step, source, settings) {
  if (tab && isWorkUrl(tabUrl(tab), settings)) {
    const ob = await park(tab, step || undefined, settings, { nextStepSource: step ? source : undefined });
    if (ob) return ob;
  }
  const open = await store.getOpenBreak();
  if (open) {
    const thread = await store.getThread(open.threadId);
    if (thread && step) await noteNextStep(thread, null, step, source, settings);
    return open;
  }
  const id = await pickResumeTarget();
  const thread = id && (await store.getThread(id));
  if (!thread) return null;
  const t = await taskTab(thread, await store.getBreadcrumb(id), settings);
  return t ? park(t, step || undefined, settings, { nextStepSource: step ? source : undefined }) : null;
}

export async function startBreak({ minutes, nextStep, tabId } = {}, settings, { nextStepSource = NEXT_STEP_SOURCE.typed } = {}) {
  const n = Number(minutes);
  if (!Number.isInteger(n) || n < BREAK_MIN || n > BREAK_MAX) return { ok: false, error: `minutes must be a whole number from ${BREAK_MIN} to ${BREAK_MAX}` };
  const step = String(nextStep || '').trim().slice(0, HIGHLIGHT_MAX);
  const tab = tabId != null ? await getTab(tabId) : await activeTab();
  const ob = await breakToPlan(tab, step, nextStepSource, settings);
  if (!ob) return { ok: false, error: 'no task to take a break from' };
  const endsAt = Date.now() + breakMs(n, settings);
  await cancelNudge(ob.eventId); // the timer's notification replaces the drift nudge (and any older timer)
  const { breakOverShown, ...rest } = ob;
  await store.setOpenBreak({ ...rest, plannedMin: n, endsAt });
  await chrome.alarms.create(BREAK_ALARM_PREFIX + ob.eventId, { when: endsAt });
  await chrome.alarms.create(BREAK_TICK_ALARM, { periodInMinutes: 0.5 });
  log('break timer', n, 'min', settings.debug ? '(debug: 10 s per minute)' : '', 'ends', clockTime(endsAt));
  return { ok: true, endsAt, threadId: ob.threadId };
}

// Clears the plan. The break itself stays open: they may still be away.
export async function cancelBreak(settings) {
  const ob = await store.getOpenBreak();
  if (!ob || !ob.plannedMin) return { ok: false, error: 'no break timer running' };
  await chrome.alarms.clear(BREAK_ALARM_PREFIX + ob.eventId);
  const { plannedMin, endsAt, ...rest } = ob;
  await store.setOpenBreak(rest);
  // Still away and nothing shown yet: the ordinary drift nudge applies again.
  if (rest.departed && !rest.breakOverShown && !rest.nudged) await scheduleNudge(rest, await store.getBreadcrumb(rest.threadId), settings);
  log('break timer cancelled');
  return { ok: true };
}

export async function onAlarm(alarm) {
  if (alarm.name === BREAK_TICK_ALARM) {
    const ob = await store.getOpenBreak();
    if (!ob || !ob.endsAt || ob.endsAt <= Date.now()) await chrome.alarms.clear(BREAK_TICK_ALARM);
    await updateBadge();
    return;
  }
  if (!alarm.name.startsWith(BREAK_ALARM_PREFIX)) return;
  const eventId = alarm.name.slice(BREAK_ALARM_PREFIX.length);
  const ob = await store.getOpenBreak();
  // Came back early (break closed), cancelled, or already shown: nothing.
  if (!ob || ob.eventId !== eventId || !ob.plannedMin || ob.breakOverShown) return;
  const thread = await store.getThread(ob.threadId);
  const crumb = await store.getBreadcrumb(ob.threadId);
  await chrome.notifications.create(BREAK_ALARM_PREFIX + eventId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon128.png'),
    title: `Break's over: ${thread ? thread.name : 'your task'}`,
    message: crumb && crumb.nextStep ? `Next: ${crumb.nextStep}` : 'Pick up where you left off',
    priority: 1,
  });
  await store.setOpenBreak({ ...ob, breakOverShown: true });
  await chrome.alarms.clear(BREAK_TICK_ALARM);
  log('break over', thread && thread.name);
}

export async function onNotificationClicked(id) {
  const eventId = id.slice(BREAK_ALARM_PREFIX.length);
  const ob = await store.getOpenBreak();
  if (!ob || ob.eventId !== eventId) return;
  if (ob.departed) await store.setReturnVia(RETURN_VIA.timer);
  await resume(ob.threadId); // the activation closes the break as a normal return
}

// ---------- task list ----------
export async function listThreads() {
  const [threads, crumbs, ob, wu] = await Promise.all([store.getThreads(), store.getBreadcrumbs(), store.getOpenBreak(), store.getWrapUp()]);
  let tabs = [];
  try { tabs = await chrome.tabs.query({}); } catch { /* none */ }
  const rows = [];
  for (const t of Object.values(threads)) {
    const crumb = crumbs[t.id] || null;
    if (t.auto && !crumb) continue; // an auto thread you never parked or left is noise
    const url = (crumb && crumb.url) || (t.tabUrls && t.tabUrls[0]) || '';
    const mine = ob && ob.threadId === t.id;
    const row = {
      threadId: t.id,
      name: t.auto ? `Untitled (from ${hostOf(url) || 'a page'})` : t.name,
      taskType: t.taskType,
      url,
      tabCount: tabs.filter((tab) => tabInThread(tab, t, crumb)).length,
      isOpenBreak: !!(mine && ob.departed),
      isParked: !!(mine && !ob.departed),
      isWrapped: !!(wu && !wu.shown && wu.threadId === t.id),
      sortAt: Math.max((crumb && crumb.leftAt) || 0, t.createdAt || 0),
    };
    if (crumb && crumb.leftAt) row.leftAt = crumb.leftAt;
    if (crumb && crumb.nextStep) { row.nextStep = crumb.nextStep; row.nextStepSource = crumb.nextStepSource || NEXT_STEP_SOURCE.typed; }
    if (mine && ob.departed) row.awaySince = ob.leftAt;
    if (mine && ob.endsAt) row.endsAt = ob.endsAt;
    rows.push(row);
  }
  return rows.sort((a, b) => b.sortAt - a.sortAt);
}

// Typed in the panel's task list. Empty clears the next step.
export async function setNextStep({ threadId, nextStep } = {}, settings) {
  const thread = threadId && (await store.getThread(threadId));
  if (!thread) return { ok: false, error: 'no such task' };
  const text = String(nextStep || '').replace(/\s+/g, ' ').trim().slice(0, HIGHLIGHT_MAX);
  const crumb = await store.getBreadcrumb(threadId);
  if (!text) {
    if (crumb) { const { nextStep: _a, nextStepSource: _b, ...rest } = crumb; await store.putBreadcrumb(rest); }
    return { ok: true };
  }
  if (crumb) { await noteNextStep(thread, null, text, NEXT_STEP_SOURCE.typed, settings); return { ok: true }; }
  const tab = await taskTab(thread, null, settings);
  if (!tab) return { ok: false, error: 'open the task first' };
  await noteNextStep(thread, tab, text, NEXT_STEP_SOURCE.typed, settings);
  return { ok: true };
}
