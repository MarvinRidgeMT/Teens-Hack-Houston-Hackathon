// Pickup shared constants. Owner: Anish (Engine).
// Content scripts cannot import modules: Sidd copies the few values he needs
// into content.js. If you change a value here, tell him.

export const KEYS = Object.freeze({
  settings: 'settings',
  threads: 'threads',
  breadcrumbs: 'breadcrumbs',
  openBreak: 'openBreak',
  events: 'events',
});

// chrome.storage.session keys (engine-internal, cleared when Chrome closes).
export const SESSION_KEYS = Object.freeze({
  lastActiveByWindow: 'lastActiveByWindow', // { [windowId]: { tabId, url } }
  lastWorkByWindow: 'lastWorkByWindow',     // { [windowId]: { tabId, url, threadId } }
  tabState: 'tabState',                     // { [tabId]: { url, scrollY, highlight, at } }
  breakTabs: 'breakTabs',                   // { [eventId]: tabId[] } distraction tabs seen during a break
  focusLostAt: 'focusLostAt',               // number | null
  lastFocused: 'lastFocused',               // { tabId, url, isWork, cameFrom, at } last tab seen in a focused window
  groupsLinked: 'groupsLinked',
  focusPopupSeen: 'focusPopupSeen',
  pendingSwitch: 'pendingSwitch',           // { at, workTabId, windowId } a window switch onto a distraction, confirmed after FOCUS_BLIP_MS         // true while a focus loss was caused by Pickup's own popup             // true once thread groupIds were checked this browser session
  lastNudgeDay: 'lastNudgeDay',
});

export const DEFAULT_SETTINGS = Object.freeze({
  participant: '',
  workSites: [],
  distractionSites: [],
  awayThresholdMs: 120000, // 2 minutes
  nudgeDelayMin: 5,
  debug: false,            // testing only: 10 s threshold, events tagged debug:true
  forceCard: false,        // testing only (needs debug): every return shows the card
});

export const DEBUG_THRESHOLD_MS = 10000;
export const DEBUG_NUDGE_DELAY_MIN = 0.5; // chrome.alarms minimum is 30 s
export const FOCUS_BLIP_MS = 1000;        // ignore Chrome focus losses shorter than this
export const IDLE_DETECTION_SEC = 180;    // idle after 3 minutes without input
export const HIGHLIGHT_MAX = 200;

// Decision 7 (provisional): a next step stays until the next Alt+P. Set to true to
// clear it after the first logged return (the card shows it once, then it is gone).
export const NEXT_STEP_CLEARS_ON_RETURN = false;

export const SIGNALS = Object.freeze({
  tab: 'tab',       // switched to a listed distraction site
  focus: 'focus',   // Chrome lost focus to another app
  idle: 'idle',     // idle 3+ min or screen locked
  park: 'park',     // Alt+P / popup Park
});

export const CONDITIONS = Object.freeze({ pickup: 'pickup', control: 'control' });
export const TASK_TYPES = Object.freeze(['writing', 'reading', 'problems']);
export const DEFAULT_TASK_TYPE = 'writing';

export const LATER_GROUP_TITLE = 'Later';
export const NUDGE_ALARM_PREFIX = 'nudge:';

export function awayBucket(awayMs) {
  const min = awayMs / 60000;
  if (min < 5) return '2-5';
  if (min < 15) return '5-15';
  return '15+';
}
