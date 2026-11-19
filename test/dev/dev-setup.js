// DEV ONLY. Not Abhinav's setup page. Owner: Anish (Engine), test/dev/ is never shipped.
// Writes test settings, grants host access to the work sites, registers the dev
// stub content script and injects it into tabs that are already open.

const STUB_ID = 'pickup-dev-stub';
const STUB_FILE = 'test/dev/stub-content.js';
const WORK_SITES = ['docs.google.com', 'wikipedia.org'];
// matchOriginAsFallback needs every pattern's path to be "/*".
const MATCHES = ['*://docs.google.com/*', '*://wikipedia.org/*', '*://*.wikipedia.org/*'];

const $ = (id) => document.getElementById(id);
const out = (line) => { $('out').textContent += line + '\n'; };

$('apply').addEventListener('click', async () => {
  $('out').textContent = '';
  // permissions.request must be the first call in the click handler, with no await before it.
  const asking = chrome.permissions.request({ origins: MATCHES });
  try {
    if (!(await asking)) { out('Host access was not granted. Nothing else was changed.'); return; }
    out('Host access granted for ' + MATCHES.join(', '));

    const settings = {
      participant: 'anish-dev',
      workSites: WORK_SITES,
      distractionSites: ['youtube.com'],
      awayThresholdMs: 120000,
      nudgeDelayMin: 5,
      debug: $('debug').checked,
      forceCard: $('forceCard').checked,
    };
    await chrome.storage.local.set({ settings });
    out('Settings saved: ' + JSON.stringify(settings));

    await unregisterStub();
    await chrome.scripting.registerContentScripts([{
      id: STUB_ID,
      matches: MATCHES,
      js: [STUB_FILE],
      allFrames: true,
      matchOriginAsFallback: true,
      runAt: 'document_idle',
    }]);
    out('Registered ' + STUB_FILE + ' (allFrames, matchOriginAsFallback).');

    const tabs = await chrome.tabs.query({ url: MATCHES });
    let injected = 0;
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: [STUB_FILE] });
        injected++;
      } catch (e) {
        out(`Could not inject into tab ${tab.id} (${tab.url}): ${e.message}`);
      }
    }
    out(`Injected into ${injected} open tab(s). New tabs get it automatically.`);
    out('Done. Open the storage inspector next.');
  } catch (e) {
    out('Failed: ' + (e && e.message ? e.message : e));
  }
});

$('unregister').addEventListener('click', async () => {
  $('out').textContent = '';
  try {
    const n = await unregisterStub();
    out(n ? 'Dev stub unregistered. Reload work tabs to drop it from open pages.' : 'Dev stub was not registered.');
  } catch (e) {
    out('Failed: ' + (e && e.message ? e.message : e));
  }
});

// Popup stand-in: sends the same startTask message Abhinav's popup will send.
async function listWorkTabs() {
  const tabs = await chrome.tabs.query({ url: MATCHES });
  $('tab').replaceChildren(...tabs.map((t) => {
    const o = document.createElement('option');
    o.value = String(t.id);
    o.textContent = `${t.id}: ${(t.title || t.url).slice(0, 60)}`;
    return o;
  }));
}
$('refresh').addEventListener('click', listWorkTabs);
$('start').addEventListener('click', async () => {
  $('out').textContent = '';
  const tabId = Number($('tab').value);
  if (!tabId) { out('Pick a work tab first (open the Doc, then Refresh list).'); return; }
  const r = await chrome.runtime.sendMessage({ type: 'startTask', tabId, name: $('name').value });
  out('startTask reply: ' + JSON.stringify(r));
});
listWorkTabs();

async function unregisterStub() {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [STUB_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [STUB_ID] });
  return existing.length;
}
