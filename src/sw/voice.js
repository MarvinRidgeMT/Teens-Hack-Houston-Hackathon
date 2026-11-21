// Voice commands ("Hey Pickup"). Owner: Anish (Engine).
//
// The panel (src/voice/panel.js) parses speech into { intent, args } and sends
// `voiceCommand`. The engine acts through the normal engine functions (resume,
// park, tidy) and builds the spoken sentence here, so every wording rule lives in
// one tested place: buildReply(). Replies are fixed templates filled only with
// recorded facts and the user's own words. Voice never writes events itself.

import * as store from '../shared/store.js';
import * as events from './events.js';
import * as wrapup from './wrapup.js';
import * as breaks from './breaks.js';
import { RETURN_VIA, NEXT_STEP_SOURCE } from '../shared/constants.js';
import { log } from './util.js';

const LATER_TIDY_WINDOW_MS = 30 * 60000; // "tidy" only right after a logged return

// ---------- wording (pure) ----------
function minutes(ms) {
  const m = Math.round(ms / 60000);
  if (ms < 60000) return 'less than a minute';
  return m === 1 ? '1 minute' : `${m} minutes`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const NO_TASK = "I don't have a task saved yet.";
export const HELP = 'I can tell you where you were, take you back, park, or wrap up.';

// state: { task: { name } | null, nextStep?, highlight?, ok?, reason?, words?, moved?,
//          awayMs?, awayOpen?, breaks?, medianSec? }
export function buildReply(intent, state = {}) {
  const task = state.task && state.task.name ? state.task.name : null;
  switch (intent) {
    case 'whereWasI': {
      if (!task) return NO_TASK;
      const parts = [`You were on ${task}.`];
      if (state.nextStep) parts.push(`Your next step: ${state.nextStep}.`);
      if (state.highlight) parts.push(`Last thing you highlighted: ${state.highlight}.`);
      return parts.join(' ');
    }
    case 'resume':
      if (!task) return NO_TASK;
      if (!state.ok) return `I couldn't open ${task}.`;
      if (state.already) return `You're already on ${task}.`;
      return `Taking you back to ${task}.`;
    case 'park':
      if (!state.ok) return state.reason === 'page' ? "I can't park this page. Go to your work tab first." : NO_TASK;
      return state.words ? `Parked ${task}. Next step saved.` : `Parked ${task}.`;
    case 'setNextStep':
      if (!state.words) return "Say 'next step' and then the step.";
      if (!task) return NO_TASK;
      return `Got it. Next step: ${state.words}.`;
    case 'wrapUp':
      if (!task) return NO_TASK;
      if (state.ok === false) return `I couldn't save ${task}. Go to your work tab first.`;
      return state.words ? `Saved ${task} for tomorrow. Next step: ${state.words}.` : `Saved ${task} for tomorrow.`;
    case 'tidy':
      if (!state.moved) return 'Nothing to tidy.';
      return `Moved ${plural(state.moved, 'distraction tab', 'distraction tabs')} into Later.`;
    case 'awayTime':
      if (state.awayMs == null) return "I don't have a break logged yet.";
      return state.awayOpen ? `You've been away ${minutes(state.awayMs)} so far.` : `You were away ${minutes(state.awayMs)}.`;
    case 'today': {
      if (!state.breaks) return 'Today: no breaks logged yet.';
      const first = `Today: ${plural(state.breaks, 'break', 'breaks')}.`;
      return state.medianSec == null ? first : `${first} Median ${plural(state.medianSec, 'second', 'seconds')} back to work.`;
    }
    case 'stop':
      return 'Okay.';
    case 'breakTimer':
      if (state.reason === 'minutes') return 'Say how many minutes, from 1 to 120.';
      if (!state.ok) return NO_TASK;
      return `Break started. Back to ${task} at ${state.endsAtText}.`;
    case 'cancelBreak':
      return state.cancelled ? 'Break timer cancelled.' : "There's no break timer running.";
    default:
      return HELP;
  }
}

export function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// Facts for "how am I doing": today's non-debug events only.
export function todayFacts(allEvents, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const todays = allEvents.filter((e) => !e.debug && e.returnedAt >= start.getTime() && e.returnedAt <= now);
  const backMs = todays.filter((e) => e.firstInteractionAt).map((e) => e.firstInteractionAt - e.returnedAt);
  const med = median(backMs);
  // Most time away by distraction site (for the panel's Today strip). Facts only.
  const byHost = new Map();
  for (const e of todays) if (e.distractionHost) byHost.set(e.distractionHost, (byHost.get(e.distractionHost) || 0) + (e.awayMs || e.returnedAt - e.leftAt));
  const [host, awayMs] = [...byHost].sort((a, b) => b[1] - a[1])[0] || [];
  return { breaks: todays.length, medianSec: med == null ? null : Math.round(med / 1000), topHost: host ? { host, awayMs } : null };
}

// ---------- which task is "the" task ----------
// The open break's task; else the task left most recently; else the last work tab's task; else none.
async function currentTask() {
  const ob = await store.getOpenBreak();
  const crumbs = await store.getBreadcrumbs();
  let threadId = ob && ob.threadId;
  if (!threadId) {
    const latest = Object.values(crumbs).sort((a, b) => (b.leftAt || 0) - (a.leftAt || 0))[0];
    threadId = latest && latest.threadId;
  }
  if (!threadId) threadId = await events.pickResumeTarget(); // same order as the resume key: then the last work tab's task
  const thread = threadId ? await store.getThread(threadId) : null;
  return { ob, thread, crumb: threadId ? crumbs[threadId] || null : null };
}

async function activeTab() {
  try {
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return t || null;
  } catch { return null; }
}


const words = (args) => String((args && args.nextStep) || '').trim().slice(0, 200);

// ---------- voiceCommand ----------
export async function handleVoiceCommand(msg, settings) {
  const intent = msg && msg.intent;
  const args = (msg && msg.args) || {};
  const { ob, thread, crumb } = await currentTask();
  const task = thread ? { name: thread.name } : null;
  const state = { task };
  const data = { intent };
  // Typed in the Pickup panel's Ask box -> 'panel'; spoken -> 'voice'.
  const via = msg && msg.via === RETURN_VIA.panel ? RETURN_VIA.panel : RETURN_VIA.voice;

  switch (intent) {
    case 'whereWasI':
      if (crumb) { state.nextStep = crumb.nextStep || ''; state.highlight = crumb.highlight || ''; }
      break;

    case 'resume':
      if (thread) {
        // Same path as the resume key: resume(), so return detection and the coin flip still happen.
        // The voice marker is set only when a left break of this task is open.
        const r = await events.resumeTask(thread.id, { via });
        state.ok = !!(r && r.ok);
        state.already = !!(r && r.already);
        data.tabId = r && r.tabId;
      }
      break;

    case 'park': {
      const tab = await activeTab();
      const w = words(args);
      const parked = tab ? await events.park(tab, w, settings, { nextStepSource: w ? NEXT_STEP_SOURCE.spoken : undefined }) : null;
      if (parked) {
        state.ok = true;
        state.words = w;
        state.task = { name: ((await store.getThread(parked.threadId)) || {}).name || 'your task' };
      } else state.reason = 'page';
      break;
    }

    case 'setNextStep': {
      const w = words(args);
      state.words = w;
      if (w && crumb) {
        await events.noteNextStep(thread, null, w, NEXT_STEP_SOURCE.spoken, settings); // keeps every other field
        data.saved = w;
      } else if (w) state.task = null;
      break;
    }

    case 'wrapUp':
      if (thread) {
        // Only a tab of this task: the active one, else the one it was left on,
        // else any tab of it (you may be saying it from YouTube). Never another
        // page, or tomorrow's Start here would point at the wrong task.
        const w = words(args);
        const tab = await events.taskTab(thread, crumb, settings);
        const r = tab ? await wrapup.wrapUp(tab, w, settings, { nextStepSource: w ? NEXT_STEP_SOURCE.spoken : undefined }) : null;
        state.ok = !!(r && r.ok);
        state.words = state.ok ? w : '';
        if (state.ok) state.task = { name: ((await store.getThread(r.wrapUp.threadId)) || thread).name };
      }
      break;

    case 'tidy': {
      const last = (await store.getEvents()).at(-1);
      if (!ob && last && Date.now() - last.returnedAt < LATER_TIDY_WINDOW_MS) {
        const r = await events.tidy(last.id, settings);
        state.moved = (r && r.moved) || 0;
      } else state.moved = 0;
      break;
    }

    case 'awayTime':
      if (ob && ob.departed) { state.awayMs = Date.now() - ob.leftAt; state.awayOpen = true; } else {
        const last = (await store.getEvents()).at(-1);
        if (last) state.awayMs = last.returnedAt - last.leftAt;
      }
      break;

    case 'today':
      data.today = todayFacts(await store.getEvents());
      Object.assign(state, data.today);
      break;

    case 'breakTimer': {
      if (!args.minutes) { state.reason = 'minutes'; break; }
      const r = await breaks.startBreak({ minutes: args.minutes, nextStep: words(args) }, settings,
        { nextStepSource: via === RETURN_VIA.panel ? NEXT_STEP_SOURCE.typed : NEXT_STEP_SOURCE.spoken });
      state.ok = !!(r && r.ok);
      if (state.ok) {
        state.task = { name: ((await store.getThread(r.threadId)) || {}).name || 'your task' };
        state.endsAtText = breaks.clockTime(r.endsAt);
        data.endsAt = r.endsAt;
      }
      break;
    }

    case 'cancelBreak': {
      // "Cancel the break" / "I'm back early". Before you've left: just cancel the
      // timer. While away: a return. "Back early" with no timer is a plain "I'm back".
      const timer = !!(ob && ob.plannedMin);
      if (timer && !ob.departed) {
        state.cancelled = !!(await breaks.cancelBreak(settings)).ok;
      } else if ((timer || args.early) && thread) {
        const r = await events.resumeTask(thread.id, { via });
        state.ok = !!(r && r.ok);
        state.already = !!(r && r.already);
        data.intent = 'resume';
      }
      break;
    }

    case 'stop':
      break;

    default:
      data.intent = 'unknown';
  }
  const say = buildReply(data.intent, state);
  log('voice', data.intent, '->', say);
  return { ok: true, say, data };
}

// ---------- setVoiceSettings ----------
export async function setVoiceSettings(msg) {
  const patch = {};
  for (const k of ['voiceEnabled', 'wakeWord', 'readAloud']) if (typeof msg[k] === 'boolean') patch[k] = msg[k];
  if (patch.voiceEnabled === false) patch.wakeWord = false; // wake word needs voice on
  if (Object.keys(patch).length) await store.setSettings(patch);
  const s = await store.getSettings();
  return { ok: true, voiceEnabled: !!s.voiceEnabled, wakeWord: !!s.wakeWord, readAloud: s.readAloud !== false };
}
