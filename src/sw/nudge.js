// Drift nudge: one notification per break, only if the user wrote a next step.
// Owner: Anish (Engine). Never generic, never blocks a site.

import * as store from '../shared/store.js';
import { NUDGE_ALARM_PREFIX, DEBUG_NUDGE_DELAY_MIN, BREAK_ALARM_PREFIX } from '../shared/constants.js';
import { resumeHint } from './shortcuts.js';
import { log } from './util.js';

export async function scheduleNudge(openBreak, crumb, settings) {
  if (!openBreak || !openBreak.departed || !crumb || !crumb.nextStep) return;
  // Wrapped up for the day: leaving now is not something to nudge about.
  // A planned break (break timer) gets its own "Break's over" notification instead.
  if (openBreak.plannedMin) { log('no nudge: break timer running'); return; }
  const wu = await store.getWrapUp();
  if (wu && !wu.shown && openBreak.leftAt >= wu.at) { log('no nudge: wrapped up for the day'); return; }
  const delay = settings.debug ? DEBUG_NUDGE_DELAY_MIN : Math.max(0.5, Number(settings.nudgeDelayMin) || 5);
  await chrome.alarms.create(NUDGE_ALARM_PREFIX + openBreak.eventId, { delayInMinutes: delay });
  log('nudge scheduled in', delay, 'min');
}

// Every place a break ends or is replaced calls this, so it also clears that break's
// break-timer alarm.
export async function cancelNudge(eventId) {
  if (!eventId) return;
  await chrome.alarms.clear(NUDGE_ALARM_PREFIX + eventId);
  await chrome.alarms.clear(BREAK_ALARM_PREFIX + eventId);
}

export async function onAlarm(alarm) {
  if (!alarm.name.startsWith(NUDGE_ALARM_PREFIX)) return;
  const eventId = alarm.name.slice(NUDGE_ALARM_PREFIX.length);
  const ob = await store.getOpenBreak();
  if (!ob || ob.eventId !== eventId || !ob.departed || ob.nudged) return;
  if (ob.plannedMin || ob.breakOverShown) return; // a break timer owns this break's one notification
  const crumb = await store.getBreadcrumb(ob.threadId);
  const thread = await store.getThread(ob.threadId);
  if (!crumb || !crumb.nextStep || !thread) return;
  await chrome.notifications.create(eventId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon128.png'),
    title: `Your next step for ${thread.name}`,
    message: `Next: ${crumb.nextStep}${await resumeHint()}`,
    priority: 0,
  });
  await store.setOpenBreak({ ...ob, nudged: true });
  log('nudge shown', thread.name);
}
