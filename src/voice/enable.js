// One-time "Enable voice" tab: a side panel can't show Chrome's microphone prompt,
// so the grant happens here, on the same chrome-extension:// origin as the panel.
// Also offers the on-device model install (needs a click). Owner: Anish.

import { initLog, log, errText } from './spike-log.js';

const $ = (id) => document.getElementById(id);
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const OPTS = { langs: ['en-US'], processLocally: true };
const status = (s) => { $('status').textContent = s; };

function install() {
  // Called straight from a click: install() needs a user gesture.
  if (!SR || typeof SR.install !== 'function') { log('SpeechRecognition.install missing'); return Promise.resolve(false); }
  log('install()', OPTS);
  let p;
  try { p = SR.install(OPTS); } catch (e) { log('install threw', errText(e)); return Promise.resolve(false); }
  return Promise.resolve(p).then((r) => { log('install() ->', r); return r === true || r === undefined; }, (e) => { log('install rejected', errText(e)); return false; });
}

async function enable() {
  // Start install inside the gesture first; the mic prompt can take a while to answer.
  const installing = (async () => {
    if (!SR || typeof SR.available !== 'function') return 'missing';
    const before = await SR.available(OPTS);
    log('available() before:', before);
    return before;
  })();
  let installP = null;
  // available() is async, so kick off install() now (still inside the click) unless we know it is not needed.
  if (SR && typeof SR.install === 'function') installP = install();
  status('Asking for the microphone...');
  let micOk = false;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    micOk = true;
    log('microphone granted');
  } catch (e) { log('microphone not granted:', errText(e)); }
  const before = await installing;
  const installed = installP ? await installP : false;
  const after = SR && typeof SR.available === 'function' ? await SR.available(OPTS) : 'missing';
  log(`available() after: ${after} (before: ${before}, install ok: ${installed})`);
  if (micOk && after === 'available') {
    status('Voice is ready. You can close this tab and use the Pickup side panel.');
    setTimeout(() => window.close(), 2500);
  } else if (!micOk) {
    status('Microphone blocked. Allow it for this extension in Chrome settings, then try again.');
  } else {
    status("On-device speech isn't available in this Chrome, so voice is off. Pickup never sends your voice to a server.");
  }
}

(async () => {
  await initLog('enable', $('log'));
  $('btnEnable').addEventListener('click', enable);
  $('btnInstall').addEventListener('click', install);
  $('btnClose').addEventListener('click', () => window.close());
  log('enable page loaded');
})();
