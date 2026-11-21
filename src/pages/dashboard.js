// Pickup dashboard. Owner: Abhinav (pages).
// Reads `events` and `threads` from chrome.storage.local; never changes an event.
// Every number comes from src/shared/stats.js, which leaves debug events out.
// Sample data lives only in memory behind the "Sample data" banner.

import { KEYS, DEFAULT_SETTINGS } from '../shared/constants.js';
import { summarize, awayBuckets, comebacksThisWeek, longestBreakMs, byCondition, bucketOf, secondsToFirst,
  awayMsOf, formatSeconds, BUCKETS } from '../shared/stats.js';
import { $, h, hasChrome, getLocal, badge } from './ui.js';
import { toCsv } from './csv.js';
import { sampleEvents, sampleThreadNames } from './sample-data.js';
import { drawReceipt, downloadCanvas } from './receipt.js';
import { featuresOf } from './setup-logic.js';
import { plural, durationText } from './format.js';

const CSV_MIME = 'text/csv;charset=utf-8';
let mode = 'mine';      // 'mine' | 'sample'
let mine = { events: [], names: {}, settings: { ...DEFAULT_SETTINGS } };
let sample = null;

const current = () => (mode === 'sample' ? sample : mine);

function status(state, text) {
  const s = $('status');
  s.replaceChildren(badge(state), h('span', null, text));
}

// ---------- chips ----------
const CONDITION = {
  pickup: { dot: 'pk-dot pk-dot--parked', text: 'Pickup (card)' },
  control: { dot: 'pk-dot pk-dot--neutral', text: 'Control (no card)' },
};
function conditionChip(c) {
  const k = CONDITION[c] || { dot: 'pk-dot pk-dot--neutral', text: c || 'Unknown' };
  return h('span', { className: 'pk-chip' }, h('span', { className: k.dot, attrs: { 'aria-hidden': 'true' } }), k.text);
}

// How the user came back (event.returnVia), in words.
const VIA = {
  tab: 'Switched tabs', resumeKey: 'Resume key (Alt+R)', notification: 'Notification', idle: 'Back at the keyboard',
  voice: 'Voice', panel: 'Pickup panel', timer: 'Break timer',
};
const SOURCE = { typed: 'You wrote it', selected: 'You picked it', spoken: 'You said it' };

const dash = (label = 'none') => h('span', { className: 'db-muted' }, '–', h('span', { className: 'pk-sr' }, label));
const timeText = (at) => (Number.isFinite(at)
  ? new Date(at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

// ---------- render ----------
function renderSummary(events) {
  const s = summarize(events);
  const body = $('summary-body');
  body.replaceChildren();
  for (const c of ['pickup', 'control']) {
    const x = s[c];
    body.append(h('tr', null,
      h('td', null, conditionChip(c)),
      h('td', { className: 'num' }, String(x.n)),
      h('td', { className: 'num' }, x.missing ? `${x.measured} (${x.missing} without)` : String(x.measured)),
      h('td', { className: 'num' }, x.median === null ? dash('no data') : formatSeconds(x.median)),
      h('td', { className: 'num' }, x.q1 === null ? dash('no data') : `${formatSeconds(x.q1)} to ${formatSeconds(x.q3)} (IQR ${formatSeconds(x.iqr)})`)));
  }

  const groups = byCondition(events);
  const all = awayBuckets(events);
  const per = (list) => { const o = { '2-5': 0, '5-15': 0, '15+': 0 }; for (const e of list) { const b = bucketOf(e); if (b) o[b]++; } return o; };
  const p = per(groups.pickup);
  const c = per(groups.control);
  const bb = $('buckets-body');
  bb.replaceChildren();
  for (const b of BUCKETS) {
    bb.append(h('tr', null, h('td', null, `${b} min`), h('td', { className: 'num' }, String(p[b])), h('td', { className: 'num' }, String(c[b])), h('td', { className: 'num' }, String(all[b]))));
  }

  const week = comebacksThisWeek(events);
  const longest = longestBreakMs(week);
  $('week-facts').textContent = `This week: ${plural(week.length, 'comeback')}${longest !== null ? ` · longest break ${durationText(longest)}` : ''}.`;

  $('chip-count').textContent = `${s.total} counted`;
  $('chip-debug-text').textContent = `${s.debugLeftOut} testing (left out)`;
}

function renderEvents(events, names) {
  const body = $('events-body');
  body.replaceChildren();
  const list = events.filter((e) => e && typeof e === 'object').slice().sort((a, b) => (b.returnedAt || 0) - (a.returnedAt || 0));
  $('events-empty').hidden = list.length > 0;
  for (const e of list) {
    const secs = secondsToFirst(e);
    const away = awayMsOf(e);
    const bucket = bucketOf(e);
    const time = h('td', { className: 'db-time' }, timeText(e.returnedAt));
    if (e.debug) time.append(h('br'), h('span', { className: 'pk-chip' }, h('span', { className: 'pk-dot pk-dot--neutral', attrs: { 'aria-hidden': 'true' } }), 'Testing (left out)'));
    const row = h('tr', { className: e.debug ? 'db-debug' : '' },
      time,
      h('td', null, names[e.threadId] || (e.threadId in names ? 'Untitled task' : dash('task not found'))),
      h('td', null, conditionChip(e.condition)),
      h('td', { className: 'db-nowrap' }, bucket ? `${bucket} min` : dash(), away !== null ? h('span', { className: 'db-muted' }, ` · ${durationText(away)}`) : null),
      h('td', { className: 'num' }, secs === null ? dash('no interaction recorded') : formatSeconds(secs)),
      h('td', null, e.returnVia ? (VIA[e.returnVia] || e.returnVia) : dash()),
      h('td', { className: 'num' }, Number.isFinite(e.plannedBreakMin) ? `${e.plannedBreakMin} min` : dash()),
      h('td', null, e.nextStepSource ? (SOURCE[e.nextStepSource] || e.nextStepSource) : dash('not recorded')));
    body.append(row);
  }
}

function render() {
  const d = current();
  $('sample-banner').hidden = mode !== 'sample';
  $('load-sample').textContent = mode === 'sample' ? 'Show my data' : 'Load sample data';
  $('receipt').hidden = featuresOf(mine.settings).receipt === false;
  $('receipt').disabled = mode === 'sample';
  $('receipt').title = mode === 'sample' ? 'Show your data to save a receipt' : '';
  renderSummary(d.events);
  renderEvents(d.events, d.names);
}

// ---------- data ----------
async function loadMine() {
  const got = await getLocal([KEYS.events, KEYS.threads, KEYS.settings]);
  const threads = got[KEYS.threads] || {};
  const names = {};
  for (const [id, t] of Object.entries(threads)) names[id] = t && t.name ? t.name : '';
  mine = {
    events: Array.isArray(got[KEYS.events]) ? got[KEYS.events] : [],
    names,
    settings: { ...DEFAULT_SETTINGS, ...(got[KEYS.settings] || {}) },
  };
}

function toggleSample() {
  if (mode === 'sample') { mode = 'mine'; status('saved', 'Showing your data.'); }
  else {
    sample = { events: sampleEvents(), names: sampleThreadNames(), settings: mine.settings };
    mode = 'sample';
    $('status').replaceChildren();
  }
  render();
}
$('load-sample').addEventListener('click', toggleSample);
$('show-mine').addEventListener('click', toggleSample);

// ---------- CSV ----------
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
$('export-csv').addEventListener('click', () => {
  const d = current();
  const who = mode === 'sample' ? 'sample' : (String(mine.settings.participant || 'events').replace(/[^a-z0-9_-]+/gi, '-') || 'events');
  const name = `pickup-${who}-${today()}.csv`;
  const url = URL.createObjectURL(new Blob([toCsv(d.events, d.names)], { type: CSV_MIME }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  status('saved', `${plural(d.events.length, 'event')} exported to ${name}.`);
});

// ---------- receipt (F6) ----------
$('receipt').addEventListener('click', async () => {
  if (mode === 'sample') return;
  $('receipt').disabled = true;
  try {
    const { canvas, text } = await drawReceipt(mine.events);
    const name = await downloadCanvas(canvas, `pickup-receipt-${today()}.png`);
    status('saved', `Receipt saved as ${name}: ${text.headline}${text.comparison ? `. ${text.comparison}` : ''}`);
  } catch (e) {
    status('nothing', `No receipt saved: ${String((e && e.message) || e)}`);
  } finally {
    $('receipt').disabled = mode === 'sample';
  }
});

// ---------- delete all (with a confirm step) ----------
function closeConfirm() {
  $('delete-confirm').hidden = true;
  $('delete-all').setAttribute('aria-expanded', 'false');
  $('delete-all').focus();
}
$('delete-all').setAttribute('aria-expanded', 'false');
$('delete-all').setAttribute('aria-controls', 'delete-confirm');
$('delete-all').addEventListener('click', () => {
  $('delete-confirm').hidden = false;
  $('delete-all').setAttribute('aria-expanded', 'true');
  $('delete-cancel').focus();
});
$('delete-cancel').addEventListener('click', closeConfirm);
$('delete-confirm').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeConfirm(); } });
$('delete-yes').addEventListener('click', async () => {
  if (!hasChrome) { status('none', 'Open the dashboard from Pickup in Chrome to delete data.'); closeConfirm(); return; }
  try {
    // Remove every key except settings; settings are never cleared, even for a moment.
    const all = await chrome.storage.local.get(null);
    const drop = Object.keys(all).filter((k) => k !== KEYS.settings);
    if (drop.length) await chrome.storage.local.remove(drop);
    await chrome.storage.session.clear();
    mode = 'mine';
    await loadMine();
    render();
    closeConfirm();
    status('saved', 'Deleted. Only your settings are left.');
  } catch (e) {
    closeConfirm();
    status('nothing', `Not deleted: ${String((e && e.message) || e)}`);
  }
});

// ---------- live updates ----------
if (hasChrome) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !(changes[KEYS.events] || changes[KEYS.threads] || changes[KEYS.settings])) return;
    await loadMine();
    render();
  });
}

(async () => {
  await loadMine();
  render();
  if (!hasChrome) status('none', 'Open the dashboard from Pickup in Chrome to see your events. Load sample data to see the layout.');
})();
