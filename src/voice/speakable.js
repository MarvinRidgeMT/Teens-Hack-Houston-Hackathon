// Pickup's voice: what gets said. Pure functions, no DOM, tested by test/speak.test.mjs.
// The engine's replies are written to be read; these rules make them sound right when
// spoken: units and keys in words, sites by name, no quotes, and short.

import { keyWords } from '../shared/shortcuts.js';

export const MAX_SENTENCES = 3;
export const SLOW_FIRST_SOUND_MS = 6000; // a first sentence slower than this, twice, means the device is too slow
const SLOW_LIMIT = 2;

const SITE_NAMES = Object.freeze({
  'docs.google.com': 'Google Docs',
  'classroom.google.com': 'Google Classroom',
  'youtube.com': 'YouTube',
  'wikipedia.org': 'Wikipedia',
  'instructure.com': 'Canvas',
  'notion.so': 'Notion',
  'tiktok.com': 'TikTok',
  'instagram.com': 'Instagram',
  'reddit.com': 'Reddit',
  'x.com': 'X',
});

// "en.wikipedia.org" -> "Wikipedia"; "jstor.org" -> "jstor".
function siteName(host) {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const [known, name] of Object.entries(SITE_NAMES)) if (h === known || h.endsWith(`.${known}`)) return name;
  const labels = h.split('.');
  return labels.length > 1 ? labels[labels.length - 2] : h;
}

const URL_RE = /\bhttps?:\/\/([a-z0-9.-]+)(?:[/?#][^\s)]*[^\s).,!?:;])?/gi;
// A bare host (with an optional path) that isn't part of a decimal: needs a letter TLD.
const HOST_RE = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s)]*[^\s).,!?:;])?/gi;
const KEY_RE = /[⌃⇧⌥⌘]+[A-Z0-9]\b|\b(?:Ctrl|Control|Alt|Shift|Cmd|Command|Option)(?:\+[A-Za-z0-9]+)+\b/g;
const UNITS = [[/\b(\d+) ?min\b/g, 'minute'], [/\b(\d+) s\b/g, 'second'], [/\b(\d+) h\b/g, 'hour']];

function sentencesOf(text) {
  // Split after . ! ? followed by a space, so "1:20 PM" and "2.5" stay whole.
  return text.split(/(?<=[.!?])\s+(?=[^\s])/).map((s) => s.trim()).filter(Boolean);
}

export function splitSentences(text) {
  return sentencesOf(String(text || '').replace(/\s+/g, ' ').trim());
}

/** @param {string} reply @returns {string} */
export function speakableText(reply) {
  let t = String(reply || '');
  t = t.replace(URL_RE, (_, host) => siteName(host));
  t = t.replace(HOST_RE, (m, host) => (/^\d/.test(host) ? m : siteName(host)));
  t = t.replace(KEY_RE, (k) => keyWords(k).join(' '));
  t = t.replace(/\b(\d+)-min\b/g, '$1 minute'); // "a 25-min break"
  for (const [re, unit] of UNITS) t = t.replace(re, (_, n) => `${n} ${unit}${n === '1' ? '' : 's'}`);
  t = t.replace(/\s*·\s*/g, ', ');
  t = t.replace(/["“”„«»]/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return sentencesOf(t).slice(0, MAX_SENTENCES).join(' ');
}

/**
 * One first-sound measurement in, the updated slow count out. Two slow first sounds in a
 * row (over SLOW_FIRST_SOUND_MS) means this computer can't keep up: turn talking back off.
 */
export function firstSoundVerdict(slowCount, ms) {
  const slow = ms > SLOW_FIRST_SOUND_MS ? slowCount + 1 : 0;
  return { slowCount: slow, giveUp: slow >= SLOW_LIMIT };
}
