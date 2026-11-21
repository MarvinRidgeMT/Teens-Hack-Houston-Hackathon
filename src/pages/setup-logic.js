// Pickup setup: pure helpers (no chrome.*, no DOM), tested in Node by test/pages.test.mjs.
// Owner: Abhinav (pages).

import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { normalizeSite } from '../shared/sites.js';

// settings.features: every flag is a boolean. readableCard is off by default, the rest on.
export const FEATURE_DEFAULTS = Object.freeze({
  readyNote: true,
  youWereHere: true,
  videoReplay: true,
  adaptiveCard: true,
  readableCard: false,
  receipt: true,
});

export function featuresOf(settings) {
  const f = (settings && settings.features) || {};
  const out = {};
  for (const [k, d] of Object.entries(FEATURE_DEFAULTS)) out[k] = typeof f[k] === 'boolean' ? f[k] : d;
  return out;
}

// "https://www.Wikipedia.org/" -> "wikipedia.org"; '' when it isn't a usable site.
export function cleanSite(raw) {
  const s = normalizeSite(raw);
  if (!s || /\s/.test(s)) return '';
  const host = s.split('/')[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return '';
  return s;
}

const hostOfSite = (site) => normalizeSite(site).split('/')[0];

// Host permissions to ask for, http and https (both are inside the manifest's
// optional_host_permissions; Chrome refuses a "*://" pattern in the permission prompt).
export function originsFor(sites) {
  const out = new Set();
  for (const s of sites || []) {
    const host = hostOfSite(s);
    if (!host) continue;
    out.add(`https://${host}/*`);
    out.add(`https://*.${host}/*`);
    out.add(`http://${host}/*`);
    out.add(`http://*.${host}/*`);
  }
  return [...out];
}

// Content-script match patterns. matchOriginAsFallback needs every path to be "/*",
// so a site with a path ("youtube.com/watch") registers on its whole host; the engine
// still decides what counts as work from the full entry.
export function matchesFor(sites) {
  const out = new Set();
  for (const s of sites || []) {
    const host = hostOfSite(s);
    if (!host) continue;
    out.add(`*://${host}/*`);
    out.add(`*://*.${host}/*`);
  }
  return [...out];
}

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
};

// The new settings object: existing keys are kept (never dropped), the form's keys
// replace theirs, features merge flag by flag. Voice keys are left to setVoiceSettings.
export function mergeSettings(current, form) {
  const cur = current || {};
  const next = { ...DEFAULT_SETTINGS, ...cur };
  next.participant = String(form.participant || '').trim().slice(0, 40);
  next.workSites = [...new Set((form.workSites || []).map(cleanSite).filter(Boolean))];
  next.distractionSites = [...new Set((form.distractionSites || []).map(cleanSite).filter(Boolean))];
  next.awayThresholdMs = clampInt(form.awayMin, 1, 60, Math.round(DEFAULT_SETTINGS.awayThresholdMs / 60000)) * 60000;
  next.nudgeDelayMin = clampInt(form.nudgeMin, 1, 120, DEFAULT_SETTINGS.nudgeDelayMin);
  next.debug = !!form.debug;
  next.forceCard = !!form.debug && !!form.forceCard; // force card only works with debug
  next.features = { ...(cur.features || {}), ...featuresOf({ features: { ...(cur.features || {}), ...(form.features || {}) } }) };
  return next;
}

// What's wrong with the form, in plain words, or '' when it can be saved.
export function validate(form) {
  const work = (form.workSites || []).map(cleanSite).filter(Boolean);
  if (!work.length) return 'Add at least one work site first.';
  const distraction = new Set((form.distractionSites || []).map(cleanSite).filter(Boolean));
  const both = work.filter((w) => distraction.has(w));
  if (both.length) return `${both[0]} is in both lists. Keep it in one.`;
  return '';
}
