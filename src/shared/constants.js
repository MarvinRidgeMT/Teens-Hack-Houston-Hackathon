// Pickup shared constants. Owner: Anish (Engine).
// Content scripts cannot import modules: Sidd copies the few values he needs
// into content.js. If you change a value here, tell him.

export const KEYS = Object.freeze({
  settings: 'settings',
  threads: 'threads',
  breadcrumbs: 'breadcrumbs',
  openBreak: 'openBreak',
  events: 'events',
  wrapUp: 'wrapUp', // { threadId, tabId, url, scrollY, highlight, nextStep?, nextStepSource?, at, dayKey, shown }
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
  pendingSwitch: 'pendingSwitch',           // { at, workTabId, windowId } a window switch onto a distraction, confirmed after FOCUS_BLIP_MS
  lastNudgeDay: 'lastNudgeDay',
  breakHosts: 'breakHosts',                 // { [eventId]: host[] } distraction hostnames seen during a break, in order
  returnVia: 'returnVia',                   // { via, at } set just before Pickup itself activates the task tab
  badgeFlashUntil: 'badgeFlashUntil',       // ms timestamp: a confirmation flash is showing until then

});

export const DEFAULT_SETTINGS = Object.freeze({
  participant: '',
  workSites: [],
  distractionSites: [],
  awayThresholdMs: 120000, // 2 minutes
  nudgeDelayMin: 5,
  debug: false,            // testing only: 10 s threshold, events tagged debug:true
  forceCard: false,        // testing only (needs debug): every return shows the card
  voiceEnabled: false,     // voice side panel may use the mic (push-to-talk)
  wakeWord: false,         // listen for "Hey Pickup" while the panel is open
  readAloud: true,         // Pickup panel: speak replies (only while voice is on)
  calm: false,             // "Calm colours": lower-saturation accents on extension pages (tokens.css [data-calm])
  features: {},            // redesign feature flags; read through featuresOf() (DEFAULT_FEATURES fill the gaps)
});

// Redesign features (Fri night). Each can be turned off on the setup page and works
// with the others off. Read with featuresOf(settings), never settings.features directly.
export const DEFAULT_FEATURES = Object.freeze({
  readyNote: true,     // F1: Alt+P asks Stopped at / Next I'll / Stuck on
  youWereHere: true,   // F2: Resume marks the last highlight on the page
  videoReplay: true,   // F3: Resume puts a lecture video 10 s before where you left
  adaptiveCard: true,  // F4: compact card under 5 min away
  readableCard: false, // F5: larger text, 1.5 line height, extra spacing (opt in)
  receipt: true,       // F6: dashboard "Save comeback receipt"
});
export const featuresOf = (settings) => ({ ...DEFAULT_FEATURES, ...((settings && settings.features) || {}) });

export const NOTE_FIELD_MAX = 120;         // F1: stoppedAt and stuckOn on a breadcrumb
export const VIDEO_REPLAY_SEC = 10;        // F3: Resume rewinds this far before where you left
export const VIDEO_MIN_SEC = 5;            // F3: a video under this is not worth saving
export const VIDEO_MAX_SEC = 86400;        // F3: anything past 24 h is a bad value
export const COMPACT_AWAY_MS = 300000;     // F4: under 5 min away the card is one line (decided only from awayMs)

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

// How the user came back (event.returnVia). 'resumeKey' and 'notification' mean
// Pickup did the navigating, so stats can keep those returns apart.
export const RETURN_VIA = Object.freeze({
  tab: 'tab',                   // a normal tab or window activation
  resumeKey: 'resumeKey',       // Alt+R / popup resumeTask
  notification: 'notification', // clicked the nudge or the Start-here notification
  idle: 'idle',                 // back at the keyboard while Chrome was on the task
  voice: 'voice',               // "Hey Pickup, I'm back" (voice side panel)
  panel: 'panel',               // Resume from the Pickup panel (task list or typed Ask)
  timer: 'timer',               // clicked the "Break's over" notification of a planned break
});
export const RETURN_VIA_TTL_MS = 10000; // a returnVia marker older than this is ignored

// Toolbar badge (Feature 4). Text + tooltip carry the meaning; colour is extra.
// Toolbar badge: the "Warm Desk, Teal Spark" light state colours (the badge has one
// colour, no theme). White glyph on top. design/tokens.json state-*. Glyphs carry the
// meaning, not colour.
export const BADGE = Object.freeze({
  parked: { text: 'P', color: '#5b4be0' },  // state-parked (resume violet)
  away: { text: '•', color: '#5c6170' },    // state-away (neutral: being away is normal, never amber or red)
  wrapped: { text: '☾', color: '#1e2230' }, // state-wrapped (ink); use 'Z' if the glyph renders badly
  timer: { color: '#5b4be0' },              // resume violet; text is the minutes left, e.g. '9m'
  flash: { '✓': '#0d7c72', default: '#5c6170' }, // state-saved (teal), state-neutral
  flashTitle: { '✓': 'saved', '!': 'nothing saved (see the service worker console)', '?': 'no task to go back to yet' },
});
export const BADGE_FLASH_MS = 2000;

// Where a breadcrumb's next step came from. Missing means typed (older data).
export const NEXT_STEP_SOURCE = Object.freeze({ typed: 'typed', selected: 'selected', spoken: 'spoken' });

// Wrap up -> Start here (Feature 2).
export const DAY_STARTS_AT_HOUR = 4;        // before 4 AM still counts as the night before
export const START_HERE_DEBUG_MS = 60000;   // debug: Start here 60 s after wrap-up (demo)
export const START_HERE_PREFIX = 'starthere:';

export const CONDITIONS = Object.freeze({ pickup: 'pickup', control: 'control' });
export const TASK_TYPES = Object.freeze(['writing', 'reading', 'problems']);
export const DEFAULT_TASK_TYPE = 'writing';

export const LATER_GROUP_TITLE = 'Later';
export const NUDGE_ALARM_PREFIX = 'nudge:';

// Break timer (Pickup panel): "Back in 10". One alarm and at most one notification
// per break, both named breakend:<eventId>; it replaces the drift nudge for that break.
export const BREAK_ALARM_PREFIX = 'breakend:';
export const BREAK_TICK_ALARM = 'breaktick';  // redraws the badge countdown while a timer runs
export const BREAK_MIN = 1;
export const BREAK_MAX = 120;
export const DEBUG_BREAK_MS_PER_MIN = 10000;  // debug: a "10 min" break ends in 100 s (for filming)

export function awayBucket(awayMs) {
  const min = awayMs / 60000;
  if (min < 5) return '2-5';
  if (min < 15) return '5-15';
  return '15+';
}
