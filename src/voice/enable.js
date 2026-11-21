// One-time "Enable voice" tab. A side panel can't show Chrome's microphone prompt
// (getUserMedia there fails at once with "Permission dismissed"), so the grant
// happens here, on the same chrome-extension:// origin, and the panel can use the
// mic afterwards. Also starts the on-device model download (needs a click).
// Owner: Anish.

import { MSG } from '../shared/messages.js';
import { shortcuts, keyText } from '../shared/shortcuts.js';
import { initLog, log, errText } from './spike-log.js';
import { onDeviceStatus, installOnDevice } from './recognizer.js';

const $ = (id) => document.getElementById(id);
const status = (s) => { $('status').textContent = s; };
const NOT_AVAILABLE = "On-device speech isn't available in this Chrome, so voice is off. Pickup never sends your voice to a server.";

async function enable() {
  // Start the model install first, while the click's user gesture is still fresh.
  const installing = installOnDevice();
  status('Asking for the microphone...');
  let micOk = false;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop()); // nothing is recorded; this only asks for permission
    micOk = true;
    log('microphone granted');
  } catch (e) { log('microphone not granted:', errText(e)); }
  if (!micOk) { status('Microphone blocked. Allow it for Pickup in Chrome site settings, then click Enable voice again.'); return; }

  status('Downloading the on-device speech model if needed...');
  log('install() ->', await installing);
  let device = await onDeviceStatus();
  for (let i = 0; device === 'downloading' && i < 120; i++) { // up to 10 min
    status(`Downloading the on-device speech model... (${i * 5} s)`);
    await new Promise((r) => setTimeout(r, 5000));
    device = await onDeviceStatus();
  }
  log('on-device status:', device);
  if (device !== 'available') { status(device === 'downloadable' ? 'The speech model did not download. Click "Download speech model only" to try again.' : NOT_AVAILABLE); return; }

  const r = await chrome.runtime.sendMessage({ type: MSG.setVoiceSettings, voiceEnabled: true }).catch(() => null);
  log('setVoiceSettings ->', r);
  status(`Voice is ready. Open the Pickup side panel (${keyText((await shortcuts()).panel)}) to talk. This tab closes in 3 s.`);
  setTimeout(() => window.close(), 3000);
}

(async () => {
  await initLog('enable', $('log'));
  $('btnEnable').addEventListener('click', enable);
  $('btnInstall').addEventListener('click', async () => log('install() ->', await installOnDevice(), 'status now', await onDeviceStatus()));
  $('btnClose').addEventListener('click', () => window.close());
  log('enable page loaded; on-device status:', await onDeviceStatus());
})();
