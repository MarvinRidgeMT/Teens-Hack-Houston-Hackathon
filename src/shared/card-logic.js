// Return card logic: F1 Stopped-at default, F3 video replay maths, F4 card variant
// and re-entry checklist. Owner: Anish. Pure, no DOM and no imports, so the content
// script can copy it as it is (keep the constants in step with constants.js).
// Every string here is a fixed template or the user's own words.

export const NOTE_FIELD_MAX = 120;      // = constants.js
export const VIDEO_REPLAY_SEC = 10;     // = constants.js
export const COMPACT_AWAY_MS = 300000;  // = constants.js

// F1: "Stopped at…" starts as the page's own title and the nearest heading above
// the viewport, editable. Not AI: it is the page's text.
export function stoppedAtDefault(title, heading) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const h = String(heading || '').replace(/\s+/g, ' ').trim();
  const s = t && h && h !== t ? `${t} › ${h}` : t || h;
  return s.slice(0, NOTE_FIELD_MAX);
}

// F3: where Resume puts the video (left paused).
export const replayFrom = (savedSec) => Math.max(0, Math.round((Number(savedSec) - VIDEO_REPLAY_SEC) * 10) / 10);

export function clockText(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const videoChipText = (savedSec) =>
  `Replaying from ${clockText(replayFrom(savedSec))} · you left at ${clockText(savedSec)} · Space to play`;

// F4: which card to draw. Decided only from awayMs (already logged on the event),
// so stats can work out the variant later: compact < COMPACT_AWAY_MS.
// startHere: the startHere message (after Wrap up). adaptive: settings flag.
export function cardVariant(awayMs, { startHere = false, adaptive = true } = {}) {
  if (startHere) return 'startHere';
  if (adaptive && Number(awayMs) < COMPACT_AWAY_MS) return 'compact';
  return 'full';
}

// F4: the re-entry checklist on the full card, made only of the user's own text.
// Ticking an item changes nothing in the events.
export function checklistItems({ stoppedAt, nextStep, stuckOn } = {}) {
  const items = [];
  if (stoppedAt) items.push('Re-read where I stopped');
  if (nextStep) items.push(nextStep);
  if (stuckOn) items.push(`Look at: ${stuckOn}`);
  return items;
}

// F4: the compact card's one line.
export function compactLine({ threadName, nextStep } = {}) {
  const parts = [`Back to ${threadName || 'your task'}`];
  if (nextStep) parts.push(`Next: ${nextStep}`);
  parts.push('Resume ↵', 'Esc');
  return parts.join(' · ');
}
