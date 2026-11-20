// Pickup panel: Ask box, break timer, task list, Today strip. Owner: Anish.
// Works with voice off. Every reply comes from the engine's fixed templates; this
// page only formats recorded facts (task names, times, counts, the user's own words).

import { MSG } from '../shared/messages.js';
import { runCommand } from './panel.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const SOURCE_LABEL = { typed: 'you wrote this', selected: 'you picked this', spoken: 'you said this' };

function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
const mins = (ms) => Math.max(1, Math.round(ms / 60000));

// ---------- Ask ----------
function wireAsk() {
  const input = $('askInput');
  $('askForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    await runCommand(text, { typed: true });
    refreshAll();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; }
  });
  for (const b of document.querySelectorAll('[data-ask]')) {
    b.addEventListener('click', async () => { await runCommand(b.dataset.ask, { typed: true }); refreshAll(); });
  }
}

// ---------- break timer ----------
let tick = null;
async function startBreak(minutes) {
  const nextStep = $('timerStep').value.trim();
  const r = await send({ type: MSG.startBreak, minutes, nextStep: nextStep || undefined });
  if (r && r.ok) { $('timerStep').value = ''; $('timerMin').value = ''; }
  else $('reply').textContent = (r && r.error === 'no task to take a break from')
    ? 'Open your work page first, then start the break.'
    : 'Pick a number of minutes from 1 to 120.';
  refreshAll();
}

function wireTimer() {
  for (const b of document.querySelectorAll('[data-min]')) b.addEventListener('click', () => startBreak(Number(b.dataset.min)));
  $('timerForm').addEventListener('submit', (e) => { e.preventDefault(); startBreak(Number($('timerMin').value)); });
  $('timerBack').addEventListener('click', async () => {
    const { openBreak } = await chrome.storage.local.get('openBreak');
    if (openBreak) await send({ type: MSG.resumeTask, threadId: openBreak.threadId, via: 'panel' });
    refreshAll();
  });
  $('timerCancel').addEventListener('click', async () => { await send({ type: MSG.cancelBreak }); refreshAll(); });
}

function drawClock(endsAt) {
  const left = Math.max(0, endsAt - Date.now());
  const s = Math.ceil(left / 1000);
  $('timerClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (!left) { $('timerEnds').textContent = "Time's up. Pickup sent one notification."; clearInterval(tick); tick = null; }
}

async function renderTimer(ob, threads, settings) {
  const running = !!(ob && ob.endsAt);
  $('timerIdle').hidden = running;
  $('timerRun').hidden = !running;
  $('timerDebug').hidden = !settings.debug;
  clearInterval(tick); tick = null;
  if (!running) return;
  const t = threads[ob.threadId];
  $('timerTask').textContent = t ? (t.auto ? 'Your task' : t.name) : 'Your task';
  $('timerEnds').textContent = `Ends at ${clock(ob.endsAt)}${settings.debug ? ' (debug: 10 s per minute)' : ''}. You'll get one notification.`;
  drawClock(ob.endsAt);
  if (ob.endsAt > Date.now()) tick = setInterval(() => drawClock(ob.endsAt), 1000); // from stored endsAt: survives closing the panel
}

// ---------- task list ----------
const editing = new Set(); // threadIds with the next-step field open

function statusChip(row) {
  if (row.endsAt && row.endsAt > Date.now()) return { kind: 'timer', text: `Break · back at ${clock(row.endsAt)}` };
  if (row.isOpenBreak) return { kind: 'away', text: `Away ${mins(Date.now() - row.awaySince)} min` };
  if (row.isParked) return { kind: 'parked', text: 'Parked' };
  if (row.isWrapped) return { kind: 'wrapped', text: 'Saved for tomorrow' };
  return null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function taskRow(row) {
  const li = el('li', 'task');
  const head = el('div', 'task-head');
  head.append(el('p', 'task-name', row.name));
  const chip = statusChip(row);
  if (chip) { const c = el('span', 'status-chip', chip.text); c.dataset.kind = chip.kind; head.append(c); }
  li.append(head);
  if (row.nextStep) {
    const p = el('p', 'task-step');
    p.append(el('span', 'src', `Next step (${SOURCE_LABEL[row.nextStepSource] || SOURCE_LABEL.typed}): `), document.createTextNode(row.nextStep));
    li.append(p);
  }
  const meta = [];
  if (row.leftAt) meta.push(`last here ${ago(row.leftAt)}`);
  if (row.tabCount) meta.push(`${row.tabCount} tab${row.tabCount === 1 ? '' : 's'} open`);
  if (meta.length) li.append(el('p', 'task-meta', meta.join(' · ')));

  const actions = el('div', 'row');
  const resume = el('button', 'pill small primary', 'Resume');
  resume.type = 'button';
  resume.setAttribute('aria-label', `Resume ${row.name}`);
  resume.addEventListener('click', async () => { await send({ type: MSG.resumeTask, threadId: row.threadId, via: 'panel' }); refreshAll(); });
  const edit = el('button', 'pill small', row.nextStep ? 'Edit next step' : 'Add next step');
  edit.type = 'button';
  edit.setAttribute('aria-expanded', String(editing.has(row.threadId)));
  edit.setAttribute('aria-label', `${row.nextStep ? 'Edit' : 'Add'} next step for ${row.name}`);
  edit.addEventListener('click', () => { if (editing.has(row.threadId)) editing.delete(row.threadId); else editing.add(row.threadId); renderTasks(lastRows, row.threadId); });
  actions.append(resume, edit);
  li.append(actions);

  if (editing.has(row.threadId)) {
    const form = el('form', 'edit');
    const id = `step-${row.threadId}`;
    const label = el('label', 'sr-only', `Next step for ${row.name}`);
    label.htmlFor = id;
    const input = el('input', 'field');
    input.id = id; input.type = 'text'; input.maxLength = 200; input.value = row.nextStep || '';
    input.placeholder = 'Your next step, in your words';
    const save = el('button', 'pill small primary', 'Save');
    save.type = 'submit';
    form.append(label, input, save);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await send({ type: MSG.setNextStep, threadId: row.threadId, nextStep: input.value });
      editing.delete(row.threadId);
      refreshAll(row.threadId);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); editing.delete(row.threadId); renderTasks(lastRows, row.threadId); }
    });
    li.append(form);
  }
  return li;
}

let lastRows = [];
function renderTasks(rows, focusThread) {
  lastRows = rows || [];
  const ul = $('tasks');
  ul.replaceChildren(...lastRows.map(taskRow));
  $('tasksEmpty').hidden = lastRows.length > 0;
  if (focusThread) {
    const input = document.getElementById(`step-${focusThread}`);
    if (input) input.focus();
    else {
      const btn = [...ul.querySelectorAll('button[aria-expanded]')].find((b) => b.getAttribute('aria-label').endsWith(`for ${(lastRows.find((r) => r.threadId === focusThread) || {}).name}`));
      if (btn) btn.focus();
    }
  }
}

// ---------- Today strip ----------
function renderToday(t) {
  const p = $('today');
  if (!t || !t.breaks) { p.textContent = 'No breaks logged today.'; return; }
  const parts = [['Today: ', `${t.breaks}`, ` break${t.breaks === 1 ? '' : 's'}`]];
  if (t.medianSec != null) parts.push(['', `${t.medianSec} s`, ' median back to work']);
  if (t.topHost) parts.push(['most time away: ', `${t.topHost.host} (${mins(t.topHost.awayMs)} min)`, '']);
  p.replaceChildren();
  parts.forEach(([a, b, c], i) => {
    if (i) p.append(document.createTextNode(' · '));
    p.append(document.createTextNode(a), el('b', null, b), document.createTextNode(c));
  });
}

// ---------- refresh ----------
let pending = null;
async function refreshAll(focusThread) {
  const [{ openBreak = null, threads = {}, settings = {} }, rows, today] = await Promise.all([
    chrome.storage.local.get(['openBreak', 'threads', 'settings']),
    send({ type: MSG.listThreads }),
    send({ type: MSG.voiceCommand, intent: 'today', args: {}, via: 'panel' }),
  ]);
  await renderTimer(openBreak, threads, settings);
  // Don't redraw under someone typing a next step.
  if (!editing.size || focusThread) renderTasks(Array.isArray(rows) ? rows : [], focusThread);
  renderToday(today && today.data && today.data.today);
}
function soon() { clearTimeout(pending); pending = setTimeout(() => refreshAll(), 150); }

wireAsk();
wireTimer();
refreshAll();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.openBreak || changes.threads || changes.breadcrumbs || changes.wrapUp || changes.events || changes.settings) soon();
});
setInterval(() => { if (!editing.size) soon(); }, 30000); // "Away 12 min" and "last here" stay current
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
