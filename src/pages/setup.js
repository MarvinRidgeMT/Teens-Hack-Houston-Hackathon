// Pickup setup page (SetupTemplate). Owner: Abhinav (pages).
// Writes chrome.storage.local `settings` (participant, workSites, distractionSites,
// awayThresholdMs, nudgeDelayMin, debug, forceCard, features), asks for host access
// to the work sites, registers the content script and injects it into open work tabs.
// Voice settings live in the side panel (it owns them); this page only links there.

import { DEFAULT_SETTINGS, KEYS } from '../shared/constants.js';
import { $, h, hasChrome, getLocal, button, badge } from './ui.js';
import { FEATURE_DEFAULTS, featuresOf, cleanSite, siteInputError, originsFor, matchesFor, mergeSettings, validate } from './setup-logic.js';
import { plural } from './format.js';
import { fillShortcuts } from '../shared/shortcuts.js';
import { urlMatches } from '../shared/sites.js';

const SCRIPT_ID = 'pickup-content';
const lists = { work: [], distraction: [] };

// ---------- status line (glyph + words) ----------
function status(state, text, details) {
  const s = $('status');
  const body = h('span', null, text);
  if (details && details.length) body.append(h('ul', null, details.map((d) => h('li', null, d))));
  s.replaceChildren(badge(state), body);
}

// ---------- site lists ----------
function renderList(kind) {
  const ul = $(`${kind}-list`);
  ul.replaceChildren();
  for (const site of lists[kind]) {
    const rm = button('×', { small: true, kind: 'ghost' });
    rm.setAttribute('aria-label', `Remove ${site}`);
    rm.addEventListener('click', () => {
      const i = lists[kind].indexOf(site);
      if (i >= 0) lists[kind].splice(i, 1);
      renderList(kind);
      markDirty();
      $(`${kind}-add-input`).focus();
    });
    ul.append(h('li', null, h('span', null, site), rm));
  }
  for (const b of document.querySelectorAll(`.st-preset[data-kind="${kind}"]`)) b.setAttribute('aria-pressed', String(lists[kind].includes(b.dataset.site)));
  $('youtube-note').hidden = !lists.work.some((w) => w.startsWith('youtube.com'));
}

function pushSite(kind, site) {
  if (!lists[kind].includes(site)) lists[kind].push(site);
  renderList(kind);
  markDirty();
}

// Empty box: nothing happens. A non-empty bad entry: an error next to that field.
function addSite(kind) {
  const input = $(`${kind}-add-input`);
  const err = siteInputError(input.value);
  $(`${kind}-add-error`).textContent = err;
  input.setAttribute('aria-invalid', String(!!err));
  if (err) { input.focus(); return false; }
  if (!input.value.trim()) return true;
  pushSite(kind, cleanSite(input.value));
  input.value = '';
  input.focus();
  return true;
}

for (const kind of ['work', 'distraction']) {
  $(`${kind}-add`).addEventListener('click', () => addSite(kind));
  $(`${kind}-add-input`).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSite(kind); }
  });
  $(`${kind}-add-input`).addEventListener('input', () => { $(`${kind}-add-error`).textContent = ''; $(`${kind}-add-input`).removeAttribute('aria-invalid'); });
}
for (const b of document.querySelectorAll('.st-preset')) {
  b.addEventListener('click', () => {
    const { kind, site } = b.dataset;
    if (lists[kind].includes(site)) { lists[kind] = lists[kind].filter((x) => x !== site); renderList(kind); markDirty(); }
    else pushSite(kind, site);
  });
}

// "Unsaved changes" pill next to Save.
function markDirty() { $('dirty').hidden = false; }
$('setup-form').addEventListener('input', (e) => { if (!/-add-input$/.test(e.target.id)) markDirty(); });
$('setup-form').addEventListener('change', (e) => { if (!/-add-input$/.test(e.target.id)) markDirty(); });
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
    calm: $('calm').checked,
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
  const f = featuresOf(s);
  for (const k of Object.keys(FEATURE_DEFAULTS)) $(`feat-${k}`).checked = f[k];
  $('calm').checked = !!s.calm;
  syncDependents();
  $('dirty').hidden = true;
}

function syncDependents() {
  $('force-card').disabled = !$('debug').checked;
  if (!$('debug').checked) $('force-card').checked = false;
}
$('debug').addEventListener('change', syncDependents);

// ---------- Save and start ----------
// permissions.request is the first chrome call in this handler and nothing is
// awaited before it, so Chrome still sees the click as the user's gesture.
$('save').addEventListener('click', () => {
  // Text still in an Add box counts (empty boxes are ignored); a bad entry stops here with its inline error.
  if (!addSite('work') || !addSite('distraction')) return;
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

    const notes = [];
    let injected = null;
    let attachError = '';
    try { injected = await registerAndInject(next.workSites, notes); } catch (e) { attachError = String((e && e.message) || e); }
    fillForm(next);
    const lines = [`${plural(next.workSites.length, 'work site')}, ${plural(next.distractionSites.length, 'distraction site')}.`];
    if (!attachError) lines.push(injected === null ? 'Reload your open work tabs so Pickup can see them.' : `${plural(injected, 'open work tab')} ready without a reload.`);
    if (next.debug) lines.push('Debug is on: events are marked as testing.');
    for (const w of next.workSites) {
      const blocked = next.distractionSites.find((d) => urlMatches(`https://${w}`, [d]));
      if (blocked) lines.push(`${w} is also covered by ${blocked} in your distractions, so it still counts as a distraction. Remove ${blocked} there to make it work.`);
    }
    if (attachError) status('nothing', `Settings saved, but Pickup could not attach to your work tabs: ${attachError}`, [...lines, ...notes]);
    else status('saved', 'Saved. Open a work site to try it.', [...lines, ...notes]);
  } catch (e) {
    status('nothing', `Nothing saved: ${String((e && e.message) || e)}`);
  } finally {
    $('save').disabled = false;
  }
}

// Registers Sidd's content script on the work sites and injects it into tabs that
// are already open (skipping tabs that already have it). Returns how many open tabs
// have it, or null if the tab list could not be read. Throws if registering fails;
// an existing registration is updated in place, so a failure leaves the old one.
async function registerAndInject(workSites, notes) {
  const matches = matchesFor(workSites);
  // The js list stays a literal so test/check-integration.mjs can check each file exists.
  const script = {
    id: SCRIPT_ID,
    matches,
    js: ['src/vendor/motion.js', 'src/vendor/anime.umd.min.js', 'src/content/card.js', 'src/content/overlay.js', 'src/content/docs.js', 'src/content/content.js'],
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_idle',
  };
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);

  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: matches }); } catch { return null; }
  let n = 0;
  for (const tab of tabs) {
    try {
      // content.js sets window.__pickupContentLoaded; don't inject a second copy.
      const [probe] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => !!window.__pickupContentLoaded });
      if (!(probe && probe.result)) await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: script.js });
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
fillShortcuts().catch(() => {});

(async () => {
  const stored = await getLocal(KEYS.settings);
  const s = { ...DEFAULT_SETTINGS, ...(stored[KEYS.settings] || {}) };
  fillForm(s);
  if (!hasChrome) status('none', 'Showing defaults: open this page from Pickup in Chrome to see your settings.');
  else if (!s.workSites.length) status('none', 'Add your work and distraction sites, then click Save and start.');
})();
