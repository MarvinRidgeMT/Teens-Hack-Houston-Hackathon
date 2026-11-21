// Pickup popup (PopupTemplate). Owner: Abhinav (pages).
// Opening the popup sends only read-only messages (getTabInfo, listThreads); the
// engine already ignores the focus change the popup causes. Every action is a click.

import { MSG } from '../shared/messages.js';
import { TASK_TYPES, DEFAULT_TASK_TYPE, DEFAULT_SETTINGS, KEYS } from '../shared/constants.js';
import { isDistractionUrl } from '../shared/sites.js';
import { $, h, send, button, badge, hasChrome, getLocal, openPage } from './ui.js';
import { shortcuts, fillShortcuts, keyText } from '../shared/shortcuts.js';
import { agoText, awayText, clockText, plural, stepSourceLabel, capitalize } from './format.js';

let tab = null;        // the active tab when the popup opened
let windowId = null;   // for chrome.sidePanel.open (must be known before the click)
let info = null;       // getTabInfo reply

// ---------- notices (glyph + text, never colour alone) ----------
function notice(state, text) {
  const n = $('notice');
  n.replaceChildren(badge(state), h('span', null, text));
}

// ---------- task type switch ----------
function buildTypeSwitch(fieldset, name, selected, onChange) {
  for (const old of fieldset.querySelectorAll('label')) old.remove();
  for (const t of TASK_TYPES) {
    const input = document.createElement('input');
    input.type = 'radio'; // before value: a radio's value is its attribute
    input.name = name;
    input.value = t;
    input.checked = t === selected;
    input.addEventListener('change', () => { if (input.checked && onChange) onChange(t); });
    fieldset.append(h('label', null, input, h('span', null, capitalize(t))));
  }
}
const checkedType = (fieldset) => {
  const c = fieldset.querySelector('input:checked');
  return c ? c.value : DEFAULT_TASK_TYPE;
};

// ---------- render ----------
function renderTask(thread, breadcrumb, row) {
  $('task-card').hidden = false;
  $('task-name').textContent = thread.name;
  const tabs = (row && row.tabCount) || (thread.tabUrls && thread.tabUrls.length) || 1;
  const bits = [capitalize(thread.taskType || DEFAULT_TASK_TYPE), plural(tabs, 'tab')];
  $('task-meta').textContent = bits.join(' · ');
  if (breadcrumb && breadcrumb.nextStep) {
    $('task-step').hidden = false;
    $('task-step-label').textContent = stepSourceLabel(breadcrumb.nextStepSource);
    $('task-step-text').textContent = breadcrumb.nextStep;
  }
  buildTypeSwitch($('task-type-current'), 'tt-current', thread.taskType || DEFAULT_TASK_TYPE, async (t) => {
    const r = await send({ type: MSG.setTaskType, threadId: thread.id, taskType: t });
    if (r && r.ok) {
      $('task-meta').textContent = [capitalize(t), ...$('task-meta').textContent.split(' · ').slice(1)].join(' · ');
      notice('saved', `Task type: ${capitalize(t)}`);
    } else notice('nothing', 'Task type not changed.');
  });
}

function renderSuggested(thread, suggested) {
  const list = $('suggested');
  list.replaceChildren();
  $('suggested-section').hidden = !suggested.length;
  for (const s of suggested) {
    const keep = button('Keep', { small: true });
    const remove = button('Remove', { small: true, kind: 'ghost' });
    let host = '';
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch { /* keep empty */ }
    const li = h('li', null,
      h('span', { className: 'pp-row-text' }, h('b', { title: s.title || s.url }, s.title || s.url), h('span', { className: 'pk-meta' }, host)),
      h('span', { className: 'pp-row-actions' }, keep, remove));
    keep.setAttribute('aria-label', `Keep ${s.title || host} in this task`);
    remove.setAttribute('aria-label', `Remove ${s.title || host} from this task`);
    keep.addEventListener('click', async () => {
      const r = await send({ type: MSG.keepInThread, threadId: thread.id, tabId: s.tabId });
      if (r && r.ok) { li.remove(); notice('saved', 'Kept in this task.'); } else notice('nothing', 'Nothing changed.');
      if (!list.children.length) $('suggested-section').hidden = true;
    });
    remove.addEventListener('click', async () => {
      const r = await send({ type: MSG.removeFromThread, threadId: thread.id, tabId: s.tabId });
      if (r && r.ok) { li.remove(); notice('saved', 'Removed from this task. It stays out from now on.'); } else notice('nothing', 'Nothing changed.');
      if (!list.children.length) $('suggested-section').hidden = true;
    });
    list.append(li);
  }
}

// One status per task row: glyph + words.
function rowState(r, now) {
  if (r.isOpenBreak) {
    if (r.endsAt) return ['away', `Back at ${clockText(r.endsAt)} (planned)`];
    return ['away', r.awaySince ? awayText(now - r.awaySince) : 'Away'];
  }
  if (r.isParked) return ['parked', r.endsAt ? `Parked · back at ${clockText(r.endsAt)}` : 'Parked'];
  if (r.isWrapped) return ['wrapped', 'Saved for tomorrow'];
  if (r.leftAt) return ['saved', `Place saved ${agoText(r.leftAt, now)}`];
  return ['none', 'No place saved yet'];
}

function renderThreads(rows, currentId) {
  const list = $('threads');
  list.replaceChildren();
  const now = Date.now();
  const others = (Array.isArray(rows) ? rows : []).filter((r) => r.threadId !== currentId).slice(0, 6);
  $('threads-section').hidden = !others.length;
  for (const r of others) {
    const [state, text] = rowState(r, now);
    const resume = button('Resume', { small: true });
    resume.setAttribute('aria-label', `Resume ${r.name}`);
    resume.addEventListener('click', () => resumeThread(r.threadId));
    const meta = [text];
    if (r.nextStep) meta.push(`Next: ${r.nextStep}`);
    list.append(h('li', null, badge(state),
      h('span', { className: 'pp-row-text' }, h('b', { title: r.name }, r.name), h('span', { className: 'pk-meta', title: meta.join(' · ') }, meta.join(' · '))),
      resume));
  }
}

function renderStatusChip(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const parked = list.filter((r) => r.isParked).length;
  const away = list.filter((r) => r.isOpenBreak).length;
  const wrapped = list.filter((r) => r.isWrapped).length;
  const dot = $('status-dot');
  if (away) { dot.className = 'pk-dot pk-dot--away'; $('status-text').textContent = 'A task is waiting'; }
  else if (parked) { dot.className = 'pk-dot pk-dot--parked'; $('status-text').textContent = `${plural(parked, 'task')} parked`; }
  else if (wrapped) { dot.className = 'pk-dot pk-dot--wrapped'; $('status-text').textContent = 'Saved for tomorrow'; }
  else { dot.className = 'pk-dot'; $('status-text').textContent = 'Saved on this device'; }
}

// ---------- actions ----------
async function resumeThread(threadId) {
  const r = await send({ type: MSG.resumeTask, threadId });
  if (r && r.ok) window.close();
  else notice('none', 'No task to go back to yet.');
}

function wireTaskActions() {
  $('resume').addEventListener('click', () => resumeThread(info && info.thread ? info.thread.id : undefined));
  $('park').addEventListener('click', async () => {
    const r = await send({ type: MSG.park, tabId: tab.id });
    if (r && r.ok) window.close(); // the overlay opens in the page
    else notice('nothing', r && /cannot hold a task/.test(r.error || '') ? 'Nothing saved: this page cannot hold a task.' : 'Nothing saved.');
  });
  $('wrapup').addEventListener('click', async () => {
    const r = await send({ type: MSG.wrapUp, tabId: tab.id });
    if (r && r.ok) notice('wrapped', 'Saved for tomorrow. Pickup shows where to start when you come back.');
    else notice('nothing', r && /cannot hold a task/.test(r.error || '') ? 'Nothing saved: this page cannot hold a task.' : 'Nothing saved.');
  });
}

function wireStart() {
  $('start-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('start-name').value.trim();
    if (!name) { $('start-name').focus(); return; }
    $('start-btn').disabled = true;
    const r = await send({ type: MSG.startTask, tabId: tab.id, name, taskType: checkedType($('task-type')) });
    $('start-btn').disabled = false;
    if (r && r.ok) {
      notice('saved', `Started "${r.thread ? r.thread.name : name}". Its tabs are grouped under that name.`);
      await load();
    } else notice('nothing', 'Task not started.');
  });
}

function wireFooter() {
  // sidePanel.open must run straight from the click, with no await before it.
  $('open-panel').addEventListener('click', () => {
    if (!hasChrome || !chrome.sidePanel || windowId == null) { notice('nothing', 'The Pickup panel needs Chrome 116 or newer.'); return; }
    chrome.sidePanel.open({ windowId }).then(() => window.close(), async () => notice('nothing', `The Pickup panel did not open. Try ${keyText((await shortcuts()).panel)}.`));
  });
  $('open-dashboard').addEventListener('click', () => openPage('src/pages/dashboard.html'));
  $('open-setup').addEventListener('click', () => openPage('src/pages/setup.html'));
  $('go-setup').addEventListener('click', () => openPage('src/pages/setup.html'));
}

// ---------- load ----------
async function load() {
  for (const id of ['task-card', 'suggested-section', 'start-section', 'not-work', 'setup-needed']) $(id).hidden = true;
  $('task-step').hidden = true;

  const stored = await getLocal(KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[KEYS.settings] || {}) };

  if (hasChrome) {
    try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { tab = null; }
    windowId = tab ? tab.windowId : null;
  }
  const [tabInfo, rows] = await Promise.all([
    tab ? send({ type: MSG.getTabInfo, tabId: tab.id }) : Promise.resolve(null),
    send({ type: MSG.listThreads }),
  ]);
  info = tabInfo && tabInfo.ok ? tabInfo : null;
  const list = Array.isArray(rows) ? rows : [];
  renderStatusChip(list);

  if (!settings.workSites.length) $('setup-needed').hidden = false;

  const url = (tab && (tab.url || tab.pendingUrl)) || '';
  const isWeb = /^https?:/i.test(url);
  if (info && info.thread) {
    renderTask(info.thread, info.breadcrumb, list.find((r) => r.threadId === info.thread.id));
    renderSuggested(info.thread, info.suggested || []);
  } else if (isWeb && !isDistractionUrl(url, settings) && !(info && info.isDistraction)) {
    $('start-section').hidden = false;
    if (!$('task-type').querySelector('input')) buildTypeSwitch($('task-type'), 'tt-new', DEFAULT_TASK_TYPE);
  } else {
    $('not-work').hidden = false;
    $('not-work-text').textContent = isWeb
      ? 'This tab is on your distraction list, so it cannot hold a task.'
      : 'Open your work in a tab to start a task here.';
  }
  renderThreads(list, info && info.thread ? info.thread.id : null);

  if (!hasChrome) notice('none', 'Open this page from the Pickup toolbar button to see your tasks.');
}

wireTaskActions();
wireStart();
wireFooter();
fillShortcuts();
load();
