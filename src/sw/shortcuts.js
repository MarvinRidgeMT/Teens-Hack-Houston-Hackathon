// The user's real keyboard shortcuts, for every label Pickup shows. Owner: Anish (Engine).
// chrome.commands.getAll() formats each key for the OS (glyphs on a Mac, "Alt+…" text elsewhere)
// and follows rebinding at chrome://extensions/shortcuts; '' means no key is set.

import { fromCommands, fallbackFor, backHint } from '../shared/shortcuts.js';
import { log } from './util.js';

export async function getShortcuts() {
  let platform = 'unknown';
  try { platform = (await chrome.runtime.getPlatformInfo()).os; } catch (e) { log('getPlatformInfo failed', e); }
  try {
    return fromCommands(await chrome.commands.getAll(), platform);
  } catch (e) {
    log('commands.getAll failed; using the platform table', e);
    return fallbackFor(platform);
  }
}

// " · <resume key> takes you back", or '' when the resume key is not set.
export async function resumeHint() {
  return backHint((await getShortcuts()).resume);
}
