// Pickup pages: small pure formatters (no chrome.*, no DOM). Owner: Abhinav (pages).
// Tested in Node by test/pages.test.mjs. Every string here states a recorded fact.

const MIN = 60000;
const HOUR = 60 * MIN;

// "just now", "7 min ago", "2 h ago", "yesterday", "3 days ago"
export function agoText(at, now = Date.now()) {
  if (!Number.isFinite(at)) return '';
  const d = Math.max(0, now - at);
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < 24 * HOUR) return `${Math.floor(d / HOUR)} h ago`;
  const days = Math.floor(d / (24 * HOUR));
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

// Away time as a fact: "Away 7 min", "Away 1 h 5 min", "Away under 1 min"
export function awayText(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < MIN) return 'Away under 1 min';
  return `Away ${durationText(ms)}`;
}

// "7 min", "1 h 5 min", "2 h"
export function durationText(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < MIN) return 'under 1 min';
  const totalMin = Math.round(ms / MIN);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// "3:40 PM" in the user's locale
export function clockText(at) {
  if (!Number.isFinite(at)) return '';
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

// Where a next step came from. Missing = typed (older data).
export function stepSourceLabel(source) {
  if (source === 'selected') return 'Your next step (you picked this)';
  if (source === 'spoken') return 'Your next step (you said this)';
  return 'Your next step (you wrote this)';
}

export function capitalize(s) {
  const t = String(s || '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
