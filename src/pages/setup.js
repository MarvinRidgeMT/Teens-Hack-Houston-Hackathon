// Pickup setup page (SetupTemplate). Owner: Abhinav (pages).
// Writes chrome.storage.local `settings` (participant, workSites, distractionSites,
// awayThresholdMs, nudgeDelayMin, debug, forceCard, features), asks for host access
// to the work sites, registers the content script and injects it into open work tabs.
// Voice toggles (voiceEnabled, wakeWord, readAloud) go through setVoiceSettings.

import { MSG } from '../shared/messages.js';
import { DEFAULT_SETTINGS, KEYS } from '../shared/constants.js';
import { $, h, send, hasChrome, getLocal, button, badge } from './ui.js';
import { FEATURE_DEFAULTS, featuresOf, cleanSite, originsFor, matchesFor, mergeSettings, validate } from './setup-logic.js';
import { plural } from './format.js';
import { urlMatches } from '../shared/sites.js';

const SCRIPT_ID = 'pickup-content';
const lists = { work: [], distraction: [] };

// ---------- status line (glyph + words) ----------
function status(state, text, details) {
  const s = $('status');
  const body = h('span', null, text);
  if (details && details.length) body.append(h('ul', null, details.map((d) => h('li', null, d))));
  s.replaceChildren(badge(state), body);
  s.hidden = false;
}

// ---------- site lists ----------
function renderList(kind) {
  const ul = $(`${kind}-list`);
  ul.replaceChildren();
  if (!lists[kind].length) {
    ul.append(h('li', { className: 'st-empty' }, kind === 'work' ? 'No work sites yet' : 'No distraction sites yet'));
    return;
  }
  for (const site of lists[kind]) {
    const rm = button('Remove', { small: true, kind: 'ghost' });
    rm.setAttribute('aria-label', `Remove ${site}`);
    rm.addEventListener('click', () => {
      const i = lists[kind].indexOf(site);
      if (i >= 0) lists[kind].splice(i, 1);
      renderList(kind);
      $(`${kind}-add-input`).focus();
    });
    ul.append(h('li', null, h('span', null, site), rm));
  }
}

function addSite(kind) {
  const input = $(`${kind}-add-input`);
  const site = cleanSite(input.value);
  if (!site) { status('nothing', `"${input.value.trim()}" is not a site. Type a host like wikipedia.org.`); input.focus(); return; }
  if (!lists[kind].includes(site)) lists[kind].push(site);
  input.value = '';
  renderList(kind);
  input.focus();
}

for (const kind of ['work', 'distraction']) {
  $(`${kind}-add`).addEventListener('click', () => addSite(kind));
  $(`${kind}-add-input`).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSite(kind); }
  });
}
$('setup-form').addEventListener('submit', (e) => e.preventDefault());

// ---------- form <-> settings ----------
function readForm() {
  const features = {};
  for (const k of Object.keys(FEATURE_DEFAULTS)) features[k] = $(`feat-${k}`).checked;
  return {
    participant: $('participant').value,
    workSites: [...lists.work],
    distractionSites: [...lists.distraction],
    awayMin: $('away-min').value,
    nudgeMin: $('nudge-min').value,
    debug: $('debug').checked,
    forceCard: $('force-card').checked,
    features,
    voiceEnabled: $('voice-enabled').checked,
    wakeWord: $('wake-word').checked,
    readAloud: $('read-aloud').checked,
  };
}

function fillForm(s) {
  $('participant').value = s.participant || '';
  lists.work = [...(s.workSites || [])];
  lists.distraction = [...(s.distractionSites || [])];
  renderList('work');
  renderList('distraction');
  $('away-min').value = String(Math.max(1, Math.round((s.awayThresholdMs || DEFAULT_SETTINGS.awayThresholdMs) / 60000)));
  $('nudge-min').value = String(s.nudgeDelayMin || DEFAULT_SETTINGS.nudgeDelayMin);
  $('debug').checked = !!s.debug;
  $('force-card').checked = !!s.forceCard;
  $('voice-enabled').checked = !!s.voiceEnabled;
  $('wake-word').checked = !!s.wakeWord;
  $('read-aloud').checked = s.readAloud !== false;
  const f = featuresOf(s);
  for (const k of Object.keys(FEATURE_DEFAULTS)) $(`feat-${k}`).checked = f[k];
  syncDependents();
  syncChips(s);
}

function syncDependents() {
  $('force-card').disabled = !$('debug').checked;
  if (!$('debug').checked) $('force-card').checked = false;
  $('wake-word').disabled = !$('voice-enabled').checked;
  if (!$('voice-enabled').checked) $('wake-word').checked = false;
}
$('debug').addEventListener('change', syncDependents);
$('voice-enabled').addEventListener('change', syncDependents);

function syncChips(s) {
  if (s.debug) { $('chip-away').textContent = 'Debug: away after 10 s'; $('chip-nudge').textContent = 'Debug: nudge after 30 s'; return; }
  $('chip-away').textContent = `Away after ${plural(Math.round(s.awayThresholdMs / 60000), 'min', 'min')}`;
  $('chip-nudge').textContent = `Nudge after ${plural(s.nudgeDelayMin, 'min', 'min')}`;
}

// ---------- Save and start ----------
// permissions.request is the first chrome call in this handler and nothing is
// awaited before it, so Chrome still sees the click as the user's gesture.
$('save').addEventListener('click', () => {
  const form = readForm();
  const problem = validate(form);
  if (problem) { status('nothing', problem); return; }
  if (!hasChrome) { status('none', 'Open this page from Pickup in Chrome to save.'); return; }
  const asking = chrome.permissions.request({ origins: originsFor(form.workSites) });
  finishSave(form, asking);
});

async function finishSave(form, asking) {
  $('save').disabled = true;
  try {
    let granted = false;
    try { granted = await asking; } catch (e) { granted = false; }
    if (!granted) {
      status('nothing', 'Nothing saved: site access was not given. Click Save and start again and choose Allow.');
      return;
    }
    const stored = await getLocal(KEYS.settings);
    const next = mergeSettings(stored[KEYS.settings], form);
    await chrome.storage.local.set({ [KEYS.settings]: next });
    const voice = await send({ type: MSG.setVoiceSettings, voiceEnabled: form.voiceEnabled, wakeWord: form.wakeWord, readAloud: form.readAloud });

    const notes = [];
    const injected = await registerAndInject(next.workSites, notes);
    fillForm({ ...next, ...(voice && voice.ok ? { voiceEnabled: voice.voiceEnabled, wakeWord: voice.wakeWord, readAloud: voice.readAloud } : {}) });
    const lines = [`${plural(next.workSites.length, 'work site')}, ${plural(next.distractionSites.length, 'distraction site')}.`];
    lines.push(injected === null ? 'Reload your open work tabs so Pickup can see them.' : `${plural(injected, 'open work tab')} ready without a reload.`);
    if (next.debug) lines.push('Debug is on: events are marked as testing.');
    for (const w of next.workSites) {
      const blocked = next.distractionSites.find((d) => urlMatches(`https://${w}`, [d]));
      if (blocked) lines.push(`${w} is also covered by ${blocked} in your distractions, so it still counts as a distraction. Remove ${blocked} there to make it work.`);
    }
    if (voice && !voice.ok) lines.push('Voice settings not saved.');
    status('saved', 'Saved. Pickup is on.', [...lines, ...notes]);
  } catch (e) {
    status('nothing', `Nothing saved: ${String((e && e.message) || e)}`);
  } finally {
    $('save').disabled = false;
  }
}

// Registers Sidd's content script on the work sites and injects it into tabs that
// are already open. Returns how many tabs got it, or null if injection failed.
async function registerAndInject(workSites, notes) {
  const matches = matchesFor(workSites);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  const files = [
    'src/vendor/motion.js',
    'src/vendor/anime.umd.min.js',
    'src/content/card.js',
    'src/content/overlay.js',
    'src/content/docs.js',
    'src/content/content.js',
  ];
  // The js list stays a literal so test/check-integration.mjs can check each file exists.
  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches,
    js: ['src/vendor/motion.js', 'src/vendor/anime.umd.min.js', 'src/content/card.js', 'src/content/overlay.js', 'src/content/docs.js', 'src/content/content.js'],
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_idle',
  }]);
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: matches }); } catch { return null; }
  let n = 0;
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files });
      n++;
    } catch (e) {
      notes.push(`Reload "${(tab.title || tab.url || '').slice(0, 50)}": Pickup could not reach it yet.`);
    }
  }
  return n;
}

// ---------- links ----------
$('shortcuts').addEventListener('click', (e) => {
  e.preventDefault();
  if (hasChrome) chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// ---------- load ----------
(async () => {
  const stored = await getLocal(KEYS.settings);
  const s = { ...DEFAULT_SETTINGS, ...(stored[KEYS.settings] || {}) };
  fillForm(s);
  if (!hasChrome) status('none', 'Showing defaults: open this page from Pickup in Chrome to see your settings.');
  else if (!s.workSites.length) status('none', 'Add your work and distraction sites, then click Save and start.');
})();
