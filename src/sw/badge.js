// Toolbar badge. Owner: Anish (Engine).
// One function draws the badge from storage; a top-level storage.onChanged listener
// in background.js calls it whenever openBreak or wrapUp is written, so no call site
// has to remember. The text and the tooltip carry the meaning, not the colour alone.

import * as store from '../shared/store.js';
import { BADGE, BADGE_FLASH_MS } from '../shared/constants.js';
import { log } from './util.js';

async function draw(text, color, title) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setTitle({ title });
  } catch (e) { log('badge failed', e); }
}

export async function badgeState() {
  const ob = await store.getOpenBreak();
  if (ob) {
    const thread = await store.getThread(ob.threadId);
    const name = thread ? thread.name : 'your task';
    return ob.departed
      ? { text: BADGE.away.text, color: BADGE.away.color, title: `Pickup: ${name} is waiting` }
      : { text: BADGE.parked.text, color: BADGE.parked.color, title: `Pickup: ${name} parked: leave when you're ready` };
  }
  const wu = await store.getWrapUp();
  if (wu && !wu.shown) {
    const thread = await store.getThread(wu.threadId);
    const name = thread ? thread.name : 'your task';
    return { text: BADGE.wrapped.text, color: BADGE.wrapped.color, title: `Pickup: ${name} saved for tomorrow` };
  }
  return { text: '', color: null, title: 'Pickup' };
}

export async function updateBadge() {
  if ((await store.getBadgeFlashUntil()) > Date.now()) return; // a confirmation is showing; its timer redraws
  const s = await badgeState();
  await draw(s.text, s.color, s.title);
}

// A short confirmation ('✓', '!', '?'). The real state comes back after ~2 s; if the
// worker stops first, the next storage change redraws it anyway.
export async function flashBadge(text, ms = BADGE_FLASH_MS) {
  const color = BADGE.flash[text] || BADGE.flash.default;
  await store.setBadgeFlashUntil(Date.now() + ms);
  await draw(text, color, `Pickup: ${BADGE.flashTitle[text] || text}`);
  setTimeout(() => {
    store.serial(async () => { await store.setBadgeFlashUntil(0); await updateBadge(); }).catch(() => {});
  }, ms);
}
