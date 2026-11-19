// Possible interruption signals. Owner: Anish (Engine).
// Chrome can see tab switches, window focus and idle state. It cannot see a phone
// or know why you left, so each of these is only a *possible* interruption.
//
//   tab   - switched from a work tab to a listed distraction site (tabs.onActivated / onUpdated)
//   focus - Chrome lost focus to another app for more than 1 s (windows.onFocusChanged)
//   idle  - no input for 3 min, or screen locked (idle.onStateChanged)
//   park  - Alt+P / popup Park (commands.onCommand), the strongest signal

import * as store from '../shared/store.js';
import { MSG } from '../shared/messages.js';
import { FOCUS_BLIP_MS, IDLE_DETECTION_SEC, SIGNALS } from '../shared/constants.js';
import { isWorkUrl, isDistractionUrl } from '../shared/sites.js';
import { threadForTab, tabInThread, isWorkTab, canHoldTask } from './threads.js';
import { openBreakFor, closeBreakOnReturn, markDeparted, park } from './events.js';
import { getTab, getActiveTab, isWindowFocused, sendToTab, tabUrl, log } from './util.js';

async function tabIsWork(tab, settings) {
  if (!tab) return false;
  return isWorkTab(tab, settings, await threadForTab(tab));
}

// Core: the user is now looking at `tab` in a focused window.
// Returns { switchAt } when a window switch onto a distraction waits for confirmation.
export async function onTabFocused(tab, how) {
  if (!tab) return null;
  await settlePendingSwitch();
  const settings = await store.getSettings();
  let result = null;
  const windowId = tab.windowId;
  const url = tabUrl(tab);
  // The tab the user was last looking at, in any window: switching windows from a
  // work tab to a YouTube window is a leave too, not only switching tabs.
  const prev = (await store.getLastFocused()) || (await store.getLastActive(windowId));
  const ob = await store.getOpenBreak();
  const nowWork = await tabIsWork(tab, settings);

  if (ob) {
    const thread = await store.getThread(ob.threadId);
    const crumb = await store.getBreadcrumb(ob.threadId);
    // A distraction tab is never "back", even if Chrome put it in the task group.
    const inThread = tabInThread(tab, thread, crumb) && !isDistractionUrl(url, settings);
    if (ob.departed && inThread) {
      if (await isWindowFocused(windowId)) await closeBreakOnReturn(tab, settings);
    } else if (!ob.departed && !inThread) {
      await markDeparted(Date.now(), settings);
      if (isDistractionUrl(url, settings)) await store.addBreakTab(ob.eventId, tab.id);
    } else if (ob.departed && isDistractionUrl(url, settings)) {
      await store.addBreakTab(ob.eventId, tab.id);
    }
  } else if (prev && prev.tabId !== tab.id && prev.isWork && isDistractionUrl(url, settings)) {
    const workTab = await getTab(prev.tabId);
    if (workTab && how === 'window') {
      // Clicking a tab in another window focuses that window (showing YouTube)
      // just before the clicked tab activates. Decide after FOCUS_BLIP_MS.
      const at = Date.now();
      await store.setPendingSwitch({ at, workTabId: workTab.id, windowId });
      result = { switchAt: at };
    } else if (workTab) {
      const opened = await openBreakFor(workTab, SIGNALS.tab, Date.now(), settings, { windowId });
      if (opened) await store.addBreakTab(opened.eventId, tab.id);
    }
  }

  // Remember where we came from, so a new tab that later navigates to a
  // distraction still knows which work tab was left.
  const cameFrom = prev && prev.tabId !== tab.id
    ? (prev.isWork ? { tabId: prev.tabId } : prev.cameFrom || null)
    : (prev && prev.cameFrom) || null;
  const seen = { tabId: tab.id, url, title: tab.title || '', isWork: nowWork, cameFrom, at: Date.now() };
  await store.setLastActive(windowId, seen);
  // While a window switch waits for confirmation, the work tab stays "last looked
  // at", so a quick hop to another YouTube tab is still a leave from work.
  if (!result) await store.setLastFocused(seen);
  if (nowWork) await store.setLastWork(windowId, { tabId: tab.id, url, at: Date.now() });
  log('focus', how, nowWork ? 'work' : isDistractionUrl(url, settings) ? 'distraction' : 'other', url.slice(0, 80));
  return result;
}

// A pending window switch is settled by the next focus event: if the user moved
// on within FOCUS_BLIP_MS it was a pass-through, otherwise (the 1 s timer was
// lost with the worker) they stayed on the distraction, so confirm it now.
async function settlePendingSwitch() {
  const p = await store.getPendingSwitch();
  if (!p) return;
  if (Date.now() - p.at < FOCUS_BLIP_MS) { await store.setPendingSwitch(null); return; }
  await confirmWindowSwitch(p.at);
}

// Runs FOCUS_BLIP_MS after a window switch onto a distraction. Opens the tab break
// (dated at the switch) only if the last focused window still shows a distraction.
export async function confirmWindowSwitch(at) {
  const p = await store.getPendingSwitch();
  if (!p || p.at !== at) return; // settled already
  await store.setPendingSwitch(null);
  if (await store.getOpenBreak()) return;
  let win;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch { return; }
  const shown = win && (await getActiveTab(win.id));
  const settings = await store.getSettings();
  if (!shown || !isDistractionUrl(tabUrl(shown), settings)) return;
  const workTab = await getTab(p.workTabId);
  if (!workTab) return;
  const opened = await openBreakFor(workTab, SIGNALS.tab, p.at, settings, { windowId: shown.windowId });
  if (opened) await store.addBreakTab(opened.eventId, shown.id);
}

// tabs.onActivated
export async function handleActivated({ tabId }) {
  const tab = await getTab(tabId);
  if (tab && (await isWindowFocused(tab.windowId))) await onTabFocused(tab, 'tab');
  else if (tab) {
    // Activated in a background window: just remember it.
    const settings = await store.getSettings();
    await store.setLastActive(tab.windowId, { tabId, url: tabUrl(tab), isWork: await tabIsWork(tab, settings), cameFrom: null, at: Date.now() });
  }
}

// tabs.onUpdated with a new URL: the active tab navigated (new tab -> youtube, or work tab -> youtube).
export async function handleNavigated(tab) {
  if (!tab.active || !(await isWindowFocused(tab.windowId))) return;
  const settings = await store.getSettings();
  const url = tabUrl(tab);
  const last = await store.getLastActive(tab.windowId);
  const ob = await store.getOpenBreak();

  if (ob) {
    if (ob.departed && isDistractionUrl(url, settings)) await store.addBreakTab(ob.eventId, tab.id);
    if (!ob.departed && ob.tabId === tab.id && !isWorkUrl(url, settings)) await markDeparted(Date.now(), settings);
    if (ob.departed) {
      const thread = await store.getThread(ob.threadId);
      const crumb = await store.getBreadcrumb(ob.threadId);
      // Same-tab return (e.g. Back from YouTube to the essay).
      if (tabInThread(tab, thread, crumb) && isWorkUrl(url, settings)) await closeBreakOnReturn(tab, settings);
    }
  } else if (isDistractionUrl(url, settings) && last && last.tabId === tab.id) {
    let workTab = null;
    if (last.isWork) {
      // The work tab itself went to a distraction: the break belongs to the page it left.
      workTab = { ...tab, url: last.url, title: last.title || '' };
    } else if (last.cameFrom) {
      workTab = await getTab(last.cameFrom.tabId); // new tab opened from a work tab
    }
    if (workTab) {
      // If the work tab itself navigated away, snapshot() falls back to its last saved state.
      const opened = await openBreakFor(workTab, SIGNALS.tab, Date.now(), settings, { windowId: tab.windowId });
      if (opened) await store.addBreakTab(opened.eventId, tab.id);
    }
  }
  const isWork = await tabIsWork(tab, settings);
  const seen = { ...(last || {}), tabId: tab.id, url, title: tab.title || '', isWork, at: Date.now() };
  await store.setLastActive(tab.windowId, seen);
  await store.setLastFocused(seen);
  if (isWork) await store.setLastWork(tab.windowId, { tabId: tab.id, url, at: Date.now() });
}

// windows.onFocusChanged
export async function handleFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const lostAt = Date.now();
    await store.setFocusLostAt(lostAt);
    await store.setFocusPopupSeen(false);
    return lostAt; // caller schedules confirmFocusLost after FOCUS_BLIP_MS
  }
  const lostAt = await store.getFocusLostAt();
  const viaPopup = await store.getFocusPopupSeen();
  await store.setFocusLostAt(null);
  await store.setFocusPopupSeen(false);
  // Chrome was unfocused for longer than a blip and the 1 s check never ran (the
  // worker was stopped in between): treat it as the focus break it was. Not when
  // the loss was our own popup: then nothing is known about the time after it.
  if (lostAt && !viaPopup && Date.now() - lostAt >= FOCUS_BLIP_MS) await recoverFocusLoss(lostAt);
  const tab = await getActiveTab(windowId);
  return tab ? onTabFocused(tab, 'window') : null;
}

async function recoverFocusLoss(lostAt) {
  const settings = await store.getSettings();
  const ob = await store.getOpenBreak();
  if (ob) {
    if (!ob.departed) await markDeparted(lostAt, settings);
    return;
  }
  const last = await store.getLastFocused();
  const tab = last && (await getTab(last.tabId));
  if (tab && (await tabIsWork(tab, settings))) {
    // The breadcrumb is taken now, on return; the page has not moved while Chrome was in the background.
    await openBreakFor(tab, SIGNALS.focus, lostAt, settings, { windowId: tab.windowId });
    log('focus loss recovered after a worker restart');
  }
}

// Is Pickup's own toolbar popup showing? On macOS opening it can blur the window.
async function popupIsOpen() {
  try { return (await chrome.runtime.getContexts({ contextTypes: ['POPUP'] })).length > 0; } catch { return false; }
}

// Runs FOCUS_BLIP_MS after Chrome lost focus. If Chrome is still unfocused, it's a possible interruption.
// Returns a new lostAt when the caller should check again (our popup has focus), else null.
export async function confirmFocusLost(lostAt) {
  if ((await store.getFocusLostAt()) !== lostAt) return null; // focus came back or changed
  if (await popupIsOpen()) {
    // Not an interruption. Keep watching: if the user leaves Chrome from the popup,
    // the popup closes and the next check sees Chrome unfocused with no popup.
    const next = Date.now();
    await store.setFocusLostAt(next);
    await store.setFocusPopupSeen(true);
    return next;
  }
  await store.setFocusLostAt(null); // handled here, so a later return does not recover it again
  let win;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch { return null; }
  if (!win || win.focused) return null;
  const settings = await store.getSettings();
  const ob = await store.getOpenBreak();
  if (ob) {
    if (!ob.departed) await markDeparted(lostAt, settings);
    return null;
  }
  const tab = await getActiveTab(win.id);
  if (tab && (await tabIsWork(tab, settings))) {
    await openBreakFor(tab, SIGNALS.focus, lostAt, settings, { windowId: win.id });
  }
  return null;
}

// idle.onStateChanged
export async function handleIdle(state) {
  const settings = await store.getSettings();
  const ob = await store.getOpenBreak();
  if (state === 'idle' || state === 'locked') {
    const leftAt = state === 'idle' ? Date.now() - IDLE_DETECTION_SEC * 1000 : Date.now();
    if (ob) {
      if (!ob.departed) await markDeparted(leftAt, settings);
      return;
    }
    let win;
    try { win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch { return; }
    const tab = win && (await getActiveTab(win.id));
    if (tab && (await tabIsWork(tab, settings))) await openBreakFor(tab, SIGNALS.idle, leftAt, settings, { windowId: win.id });
    return;
  }
  // 'active': back at the keyboard. If Chrome is focused on the thread, that's a return.
  if (!ob || !ob.departed) return;
  let win;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch { return; }
  if (!win || !win.focused) return;
  const tab = await getActiveTab(win.id);
  if (tab) await onTabFocused(tab, 'idle-active');
}

// commands.onCommand('park-task') and popup Park: open Sidd's one-line overlay.
export async function requestPark(tab) {
  if (!tab) return { ok: false, error: 'no tab' };
  const settings = await store.getSettings();
  if (!canHoldTask(tab, settings)) return { ok: false, error: 'this page cannot hold a task' };
  const thread = await threadForTab(tab);
  const askTaskName = !thread || !!thread.auto;
  // snapshot always replies, so it tells us whether Sidd's content script is in this tab.
  const alive = await sendToTab(tab.id, { type: MSG.snapshot }, 800);
  if (alive) {
    await sendToTab(tab.id, { type: MSG.openOverlay, askTaskName }, 300);
  } else {
    // No content script here (site not listed as work). Park without a note.
    await park(tab, '', settings);
    log('parked without overlay (no content script in this tab)');
  }
  return { ok: true };
}

export function setupIdleDetection() {
  try { chrome.idle.setDetectionInterval(IDLE_DETECTION_SEC); } catch (e) { log('idle setup failed', e); }
}

export { FOCUS_BLIP_MS };
