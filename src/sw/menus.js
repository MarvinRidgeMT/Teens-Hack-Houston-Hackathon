// Right-click "Make this my next step" (Feature 3). Owner: Anish (Engine).
// Shown only on text selections on the user's work sites. The selected text becomes
// the task's next step, labelled as picked (not typed) so the card stays honest.

import * as store from '../shared/store.js';
import { HIGHLIGHT_MAX, NEXT_STEP_SOURCE } from '../shared/constants.js';
import { normalizeSite } from '../shared/sites.js';
import { ensureThreadForTab } from './threads.js';
import { noteNextStep } from './events.js';
import { flashBadge } from './badge.js';
import { log } from './util.js';

export const MENU_ID = 'pickup-next-step';

// Match patterns for the work sites: the host and its subdomains, plus the path if the entry has one.
export function menuPatterns(workSites) {
  const out = new Set();
  for (const raw of workSites || []) {
    const site = normalizeSite(raw);
    if (!site) continue;
    const slash = site.indexOf('/');
    const host = slash < 0 ? site : site.slice(0, slash);
    const path = slash < 0 ? '/*' : `${site.slice(slash)}*`;
    if (!/^[a-z0-9.-]+$/.test(host)) continue; // not a hostname Chrome would accept
    out.add(`*://${host}${path}`);
    out.add(`*://*.${host}${path}`);
  }
  return [...out];
}

function menuProps(settings) {
  const patterns = menuPatterns(settings.workSites);
  return patterns.length ? { visible: true, documentUrlPatterns: patterns } : { visible: false };
}

// runtime.onInstalled: menus persist across restarts, so they are made once here.
export async function setupMenu() {
  const settings = await store.getSettings();
  await chrome.contextMenus.removeAll();
  await new Promise((resolve) => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Make this my next step', contexts: ['selection'], ...menuProps(settings) }, () => {
      if (chrome.runtime.lastError) log('menu create failed', chrome.runtime.lastError.message);
      resolve();
    });
  });
}

// settings changed: follow the new work sites.
export async function syncMenu() {
  const settings = await store.getSettings();
  try { await chrome.contextMenus.update(MENU_ID, menuProps(settings)); } catch { await setupMenu(); }
}

export async function onMenuClicked(info, tab) {
  if (!info || info.menuItemId !== MENU_ID) return;
  const text = String(info.selectionText || '').replace(/\s+/g, ' ').trim().slice(0, HIGHLIGHT_MAX);
  if (!text) {
    // Google Docs draws text on a canvas, so Chrome usually gets no selection text there.
    log('Make this my next step: Chrome gave no selected text (common in Google Docs). Nothing saved; use the park key to type it.');
    await flashBadge('!');
    return;
  }
  const settings = await store.getSettings();
  const thread = tab && (await ensureThreadForTab(tab, settings));
  if (!thread) { log('Make this my next step: this page cannot hold a task'); await flashBadge('!'); return; }
  await noteNextStep(thread, tab, text, NEXT_STEP_SOURCE.selected, settings);
  await flashBadge('✓'); // no silent actions; no notification (kept for the nudge)
  log('next step picked', thread.name, text.slice(0, 60));
}
