// DEV ONLY storage inspector. Owner: Anish (Engine). test/dev/ is never shipped.

const $ = (id) => document.getElementById(id);
const time = (ms) => (ms ? new Date(ms).toLocaleTimeString() : '');
const secs = (ms) => (ms == null ? '' : (ms / 1000).toFixed(1));

function cell(text, cls) {
  const td = document.createElement('td');
  td.textContent = text == null ? '' : String(text);
  if (cls) td.className = cls;
  return td;
}
function row(cells) {
  const tr = document.createElement('tr');
  tr.append(...cells);
  return tr;
}

let local = {};

function renderOpenBreak() {
  const ob = local.openBreak;
  if (!ob) { $('openBreak').textContent = 'none'; return; }
  const away = ob.departed ? `away for ${secs(Date.now() - ob.leftAt)} s so far` : 'parked, waiting for you to leave';
  $('openBreak').textContent = `${away}\n` + JSON.stringify(ob, null, 2);
}

async function render() {
  local = await chrome.storage.local.get(null);
  const session = await chrome.storage.session.get(null);
  const threads = local.threads || {};
  const name = (id) => (threads[id] ? threads[id].name : id);

  $('settings').textContent = JSON.stringify(local.settings || 'not set: run dev setup', null, 2);
  renderOpenBreak();

  const events = local.events || [];
  $('eventCount').textContent = `(${events.length} total)`;
  $('events').replaceChildren(...events.slice(-10).reverse().map((e) => row([
    cell(time(e.returnedAt)),
    cell(e.signal),
    cell(e.condition),
    cell(e.awayBucket),
    cell(secs(e.returnedAt - e.leftAt), 'num'),
    cell(e.firstInteractionAt ? secs(e.firstInteractionAt - e.returnedAt) : 'not yet', 'num'),
    cell(e.cardShown),
    cell(e.debug),
    cell(name(e.threadId)),
    cell((e.distractionHosts || []).join(', ')),
    cell(e.returnVia),
  ])));

  const crumbs = Object.values(local.breadcrumbs || {});
  $('crumbs').replaceChildren(...crumbs.map((c) => row([
    cell(name(c.threadId)), cell(c.tabId), cell(c.url), cell(c.scrollY, 'num'),
    cell(c.highlight), cell(c.nextStep), cell(c.nextStepSource), cell(c.signal), cell(time(c.leftAt)),
  ])));

  $('threads').replaceChildren(...Object.values(threads).map((t) => row([
    cell(t.name), cell(t.groupId), cell(!!t.auto), cell(t.taskType), cell((t.tabUrls || []).join('\n')),
  ])));

  $('session').textContent = JSON.stringify(session, null, 2);
  const wu = local.wrapUp;
  $('wrapUp').textContent = wu ? `${wu.shown ? 'Start here already shown' : `waiting for the first activity after ${wu.dayKey}`}\n` + JSON.stringify(wu, null, 2) : 'none';
}

const out = (t) => { $('devOut').textContent = `${new Date().toLocaleTimeString()}: ${t}`; };
async function lastWorkTabId() {
  const { lastWorkByWindow = {} } = await chrome.storage.session.get('lastWorkByWindow');
  const all = Object.values(lastWorkByWindow).sort((a, b) => (b.at || 0) - (a.at || 0));
  return all[0] ? all[0].tabId : null;
}
$('wrap').addEventListener('click', async () => {
  const tabId = await lastWorkTabId();
  if (tabId == null) { out('no work tab seen yet'); return; }
  const r = await chrome.runtime.sendMessage({ type: 'wrapUp', tabId, nextStep: $('wrapStep').value || undefined });
  out(r && r.ok ? `wrapped up (day ${r.wrapUp.dayKey})` : `wrap up failed: ${r && r.error}`);
});
// Rewrites wrapUp.dayKey to the day before the current one, so the next activity shows Start here.
$('tomorrow').addEventListener('click', async () => {
  const { wrapUp } = await chrome.storage.local.get('wrapUp');
  if (!wrapUp) { out('wrap up first'); return; }
  const d = new Date(Date.now() - 4 * 3600000 - 86400000);
  const p = (n) => String(n).padStart(2, '0');
  const dayKey = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  await chrome.storage.local.set({ wrapUp: { ...wrapUp, dayKey, shown: false } });
  out(`dayKey set to ${dayKey}; switch to any tab to trigger Start here`);
});
$('resumeBtn').addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ type: 'resumeTask' });
  out(r && r.ok ? `resumed ${r.threadId}${r.already ? ' (already there: scroll only)' : ''}` : `resume: ${r && r.error}`);
});

$('clear').addEventListener('click', async () => {
  if (!confirm('Delete all Pickup events, threads, breadcrumbs and the open break? Settings stay.')) return;
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  if (settings) await chrome.storage.local.set({ settings });
  $('cleared').textContent = `Cleared at ${new Date().toLocaleTimeString()}.`;
});

chrome.storage.onChanged.addListener(() => { render(); });
setInterval(renderOpenBreak, 1000); // keeps "away for N s" ticking
render();
