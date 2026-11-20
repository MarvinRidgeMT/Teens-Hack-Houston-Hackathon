// Pickup service worker entry. Owner: Anish (Engine).
// All listeners are registered synchronously at the top level (MV3 requirement)
// and every handler runs through store.serial() so storage writes never race.

import * as store from '../shared/store.js';
import { MSG, CARD_ACTIONS, TO_ENGINE } from '../shared/messages.js';
import { HIGHLIGHT_MAX, RETURN_VIA, START_HERE_PREFIX, BREAK_ALARM_PREFIX } from '../shared/constants.js';
import { isDistractionUrl } from '../shared/sites.js';
import * as signals from './signals.js';
import * as threads from './threads.js';
import * as events from './events.js';
import * as nudge from './nudge.js';
import * as badge from './badge.js';
import * as menus from './menus.js';
import * as wrapup from './wrapup.js';
import * as voice from './voice.js';
import * as breaks from './breaks.js';
import { getTab, tabUrl, log } from './util.js';

// Every handler: one at a time, and only after thread group ids were checked for
// this browser session (they change when Chrome restarts).
const run = (fn) => store.serial(async () => {
  await threads.ensureLinked();
  return fn();
});
const safe = (label, fn) => async (...args) => {
  try { return await run(() => fn(...args)); } catch (e) { log(`${label} failed`, e); return undefined; }
};

signals.setupIdleDetection();

// ---------- install / startup ----------
chrome.runtime.onInstalled.addListener(async (details) => {
  signals.setupIdleDetection();
  await safe('badge', badge.updateBadge)();
  await safe('menu', menus.setupMenu)();
  if (details.reason === 'install') {
    try { await chrome.runtime.openOptionsPage(); } catch (e) { log('no setup page yet', e); }
  }
});
// Group ids were already re-linked by ensureLinked() inside safe().
chrome.runtime.onStartup.addListener(safe('startup', async () => {
  signals.setupIdleDetection();
  await badge.updateBadge();
}));

// Every write to openBreak or wrapUp redraws the badge (Feature 4).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.openBreak || changes.wrapUp || changes.threads) safe('badge', badge.updateBadge)(); // threads: the tooltip names the task
  if (changes.settings) safe('menu', menus.syncMenu)();
});

chrome.contextMenus.onClicked.addListener(safe('menuClick', menus.onMenuClicked));

// ---------- signals ----------
// User activity also checks for the next morning's "Start here" (Feature 2). Its own
// try, so a failure there never skips the signal handling that follows.
async function startHere() {
  try { await wrapup.checkStartHere(); } catch (e) { log('start here check failed', e); }
}
chrome.tabs.onActivated.addListener(safe('onActivated', async (info) => {
  await startHere();
  await signals.handleActivated(info);
}));

// A focus loss is only a possible interruption if it lasts FOCUS_BLIP_MS. The timer
// is lost if the worker stops; handleFocusChanged recovers that case on return.
function scheduleFocusCheck(lostAt) {
  setTimeout(async () => {
    const again = await safe('confirmFocusLost', signals.confirmFocusLost)(lostAt);
    if (again) scheduleFocusCheck(again); // our popup has focus: look again shortly
  }, signals.FOCUS_BLIP_MS);
}
// A window switch onto a distraction is confirmed after FOCUS_BLIP_MS too; if the
// timer is lost, the next focus event settles it (signals.settlePendingSwitch).
function scheduleSwitchCheck(at) {
  setTimeout(() => { safe('confirmWindowSwitch', signals.confirmWindowSwitch)(at); }, signals.FOCUS_BLIP_MS);
}
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const r = await safe('onFocusChanged', async (id) => {
    if (id !== chrome.windows.WINDOW_ID_NONE) await startHere();
    return signals.handleFocusChanged(id);
  })(windowId);
  if (typeof r === 'number') scheduleFocusCheck(r);
  else if (r && r.switchAt) scheduleSwitchCheck(r.switchAt);
});

chrome.idle.onStateChanged.addListener(safe('idle', async (state) => {
  if (state === 'active') await startHere();
  await signals.handleIdle(state);
}));

chrome.commands.onCommand.addListener(safe('command', async (command, tab) => {
  if (command === 'resume-task') { await events.resumeTask(); return; }
  if (command === 'wrap-up') {
    if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const r = await wrapup.wrapUp(tab, undefined, await store.getSettings());
    await badge.flashBadge(r.ok ? '✓' : '!');
    return;
  }
  if (command !== 'park-task') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await signals.requestPark(tab);
}));

// Alt+V "Talk to Pickup": open the voice side panel. sidePanel.open needs the user
// gesture, so it is called first, with nothing awaited before it (not via safe()).
// The panel starts push-to-talk when it sees voiceShortcutAt.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-voice') return;
  if (!tab || tab.windowId == null) { log('toggle-voice: no tab'); return; }
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((e) => log('sidePanel.open failed', e));
  chrome.storage.session.set({ voiceShortcutAt: Date.now() }).catch(() => {});
});

// ---------- tabs & groups ----------
chrome.tabs.onCreated.addListener(safe('onCreated', async (tab) => {
  await startHere();
  if (tab.groupId != null && tab.groupId !== -1) await threads.onTabGroupChanged(tab);
}));

chrome.tabs.onUpdated.addListener(safe('onUpdated', async (tabId, info, tab) => {
  if (info.groupId !== undefined) await threads.onTabGroupChanged(tab);
  if (info.url) {
    const ob = await store.getOpenBreak();
    if (ob && ob.departed) {
      const settings = await store.getSettings();
      if (isDistractionUrl(info.url, settings)) await store.addBreakTab(ob.eventId, tabId, info.url);
    }
    await threads.onTabUrlChanged(tab);
    await signals.handleNavigated(tab);
  }
}));

chrome.tabs.onRemoved.addListener(safe('onRemoved', async (tabId) => {
  await store.setTabState(tabId, undefined);
}));

chrome.tabGroups.onCreated.addListener(safe('groupCreated', threads.onGroupUpdated));
chrome.tabGroups.onUpdated.addListener(safe('groupUpdated', threads.onGroupUpdated));
chrome.tabGroups.onRemoved.addListener(safe('groupRemoved', threads.onGroupRemoved));

// ---------- nudge ----------
chrome.alarms.onAlarm.addListener(safe('alarm', nudge.onAlarm));
chrome.alarms.onAlarm.addListener(safe('breakAlarm', breaks.onAlarm));
chrome.notifications.onClicked.addListener(safe('notificationClick', async (id) => {
  await chrome.notifications.clear(id);
  if (id.startsWith(BREAK_ALARM_PREFIX)) { await breaks.onNotificationClicked(id); return; }
  if (id.startsWith(START_HERE_PREFIX)) {
    const threadId = id.slice(START_HERE_PREFIX.length);
    const ob = await store.getOpenBreak();
    if (ob && ob.departed && ob.threadId === threadId) await store.setReturnVia(RETURN_VIA.notification);
    await wrapup.onStartHereClicked(threadId);
    return;
  }
  const ob = await store.getOpenBreak();
  if (ob && ob.eventId === id) {
    if (ob.departed) await store.setReturnVia(RETURN_VIA.notification);
    await events.resume(ob.threadId); // activation then closes the break
  }
}));

// ---------- messages ----------
async function route(msg, sender) {
  const tab = sender.tab || null;
  const settings = await store.getSettings();
  switch (msg && msg.type) {
    // content script -> SW
    case MSG.state:
      if (sender.frameId > 0) return { ok: true }; // only the top frame's state counts
      if (tab) await store.setTabState(tab.id, { url: msg.url, scrollY: msg.scrollY, highlight: String(msg.highlight || '').slice(0, HIGHLIGHT_MAX), at: Date.now() });
      return { ok: true };
    case MSG.firstInteraction:
      await events.recordFirstInteraction(msg.eventId, msg.at);
      return { ok: true };
    case MSG.cardAction: {
      const threadId = await events.threadIdForEvent(msg.eventId);
      if (msg.action === CARD_ACTIONS.resume && threadId) return events.resume(threadId);
      if (msg.action === CARD_ACTIONS.tidy) return events.tidy(msg.eventId, settings);
      return { ok: true };
    }
    case MSG.parkNote: {
      if (!tab) return { ok: false, error: 'no tab' };
      if (msg.taskName && String(msg.taskName).trim()) await threads.startTask(tab.id, msg.taskName);
      const fresh = (await getTab(tab.id)) || tab;
      const parked = await events.park(fresh, msg.nextStep, settings);
      return parked ? { ok: true } : { ok: false, error: 'this page cannot hold a task' };
    }

    // popup / pages -> SW
    case MSG.getTabInfo: {
      const t = await getTab(msg.tabId);
      if (!t) return { ok: false, error: 'tab not found' };
      const thread = await threads.threadForTab(t);
      return {
        ok: true,
        isWork: threads.isWorkTab(t, settings, thread),
        isDistraction: isDistractionUrl(tabUrl(t), settings),
        thread: thread && !thread.auto ? thread : null,
        suggested: thread && !thread.auto ? await threads.suggestedTabsFor(thread) : [],
        breadcrumb: thread ? await store.getBreadcrumb(thread.id) : null,
        openBreak: await store.getOpenBreak(),
      };
    }
    case MSG.startTask:
      return threads.startTask(msg.tabId, msg.name, msg.taskType);
    case MSG.removeFromThread:
      return threads.removeFromThread(msg.threadId, msg.tabId);
    case MSG.keepInThread:
      return threads.keepInThread(msg.threadId, msg.tabId);
    case MSG.setTaskType:
      return threads.setTaskType(msg.threadId, msg.taskType);
    case MSG.park:
      return signals.requestPark(await getTab(msg.tabId));
    case MSG.resumeTask:
      // Only the Pickup panel may name how it returned; everyone else is resumeKey.
      return events.resumeTask(msg.threadId, msg.via === RETURN_VIA.panel ? { via: RETURN_VIA.panel } : {});
    case MSG.startBreak:
      return breaks.startBreak(msg, settings);
    case MSG.cancelBreak:
      return breaks.cancelBreak(settings);
    case MSG.listThreads:
      return breaks.listThreads();
    case MSG.setNextStep:
      return breaks.setNextStep(msg, settings);
    case MSG.wrapUp:
      return wrapup.wrapUp(await getTab(msg.tabId), msg.nextStep, settings);
    case MSG.voiceCommand:
      return voice.handleVoiceCommand(msg, settings);
    case MSG.setVoiceSettings:
      return voice.setVoiceSettings(msg);
    default:
      return undefined;
  }
}

// Message types the engine answers. Anything else is left for other listeners.
const INBOUND = new Set(TO_ENGINE);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !INBOUND.has(msg.type)) return false;
  (async () => {
    try {
      const r = await run(() => route(msg, sender));
      sendResponse(r === undefined ? { ok: false, error: 'unknown message' } : r);
    } catch (e) {
      log('message failed', msg.type, e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true; // async reply
});

log('service worker started');
