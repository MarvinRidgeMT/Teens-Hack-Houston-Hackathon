// Phase 0 voice spike (go/no-go). Not the voice feature: buttons that answer the
// five spike questions and write every result to the on-page log.
// Hard rule: SpeechRecognition only ever runs with processLocally = true. If the
// property is missing or does not stick, recognition is refused. Owner: Anish.

import { initLog, log, errText, clearLogs, allLogText } from './spike-log.js';

const $ = (id) => document.getElementById(id);
const LANGS = ['en-US'];
const OPTS = { langs: LANGS, processLocally: true };
const WAKE = /\bhey,?\s+pick\s?up\b|\bpick\s?up\b/i;
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture', 'phrases-not-supported']);
const TEST_SENTENCE = 'Hey Pickup test. You were on Drought Essay. Your next step: find a source for the drought statistic.';

const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
let windowId = null;
let where = 'page';

// ---------- where am I ----------
async function detectWhere() {
  let tab;
  try { tab = await chrome.tabs.getCurrent(); } catch { tab = undefined; }
  where = tab ? 'tab' : 'panel';
  try { windowId = (await chrome.windows.getCurrent()).id; } catch (e) { log('windows.getCurrent failed', errText(e)); }
  $('where').textContent = where === 'panel' ? 'Running in: side panel' : 'Running in: tab (open as side panel to test the panel)';
  return where;
}

// ---------- 0. panel + mic ----------
function openPanel() {
  // Called synchronously from the click so the user gesture is still live.
  if (!chrome.sidePanel) { log('sidePanel API missing (no "sidePanel" permission?)'); return Promise.resolve(false); }
  if (windowId == null) { log('sidePanel.open: no windowId yet'); return Promise.resolve(false); }
  const t0 = performance.now();
  return chrome.sidePanel.open({ windowId }).then(
    () => { log(`sidePanel.open({windowId:${windowId}}) resolved in ${Math.round(performance.now() - t0)} ms`); return true; },
    (e) => { log('sidePanel.open rejected:', errText(e)); return false; },
  );
}

async function micState() {
  try {
    const st = await navigator.permissions.query({ name: 'microphone' });
    log(`mic permission state (${where}): ${st.state}`);
    st.onchange = () => log(`mic permission changed (${where}): ${st.state}`);
    return st.state;
  } catch (e) { log('permissions.query(microphone) failed:', errText(e)); return 'error'; }
}

async function micHere() {
  log(`getUserMedia({audio:true}) from ${where}...`);
  const t0 = performance.now();
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tr = s.getAudioTracks();
    log(`getUserMedia OK in ${Math.round(performance.now() - t0)} ms, track: ${tr[0] && tr[0].label}`);
    tr.forEach((t) => t.stop());
    return 'ok';
  } catch (e) {
    log(`getUserMedia FAILED in ${Math.round(performance.now() - t0)} ms:`, errText(e));
    return errText(e);
  }
}

// ---------- 1. available / install ----------
function apiShape() {
  if (!SR) return { SpeechRecognition: false };
  return {
    ctor: globalThis.SpeechRecognition ? 'SpeechRecognition' : 'webkitSpeechRecognition',
    available: typeof SR.available,
    install: typeof SR.install,
    processLocallyProp: 'processLocally' in SR.prototype,
    // old names, logged for diagnosis only, never used
    availableOnDevice: typeof SR.availableOnDevice,
    installOnDevice: typeof SR.installOnDevice,
  };
}

async function available() {
  log('API shape:', apiShape());
  if (!SR || typeof SR.available !== 'function') { log('SpeechRecognition.available is not a function: voice would be OFF'); return 'missing'; }
  const t0 = performance.now();
  try {
    const r = await SR.available(OPTS);
    log(`available(${JSON.stringify(OPTS)}) -> "${r}" in ${Math.round(performance.now() - t0)} ms`);
    return r;
  } catch (e) { log('available() threw:', errText(e)); return 'threw: ' + errText(e); }
}

function install() {
  // Must run inside the click: install() needs a user gesture.
  if (!SR || typeof SR.install !== 'function') { log('SpeechRecognition.install is not a function'); return Promise.resolve('missing'); }
  log(`install(${JSON.stringify(OPTS)}) started; watch chrome://components -> "Speech On-Device API"`);
  const t0 = performance.now();
  let p;
  try { p = SR.install(OPTS); } catch (e) { log('install() threw synchronously:', errText(e)); return Promise.resolve('threw'); }
  const tick = setInterval(() => log(`install() still pending after ${Math.round((performance.now() - t0) / 1000)} s`), 10000);
  return Promise.resolve(p).then(
    async (r) => { clearInterval(tick); log(`install() resolved -> ${JSON.stringify(r)} in ${Math.round((performance.now() - t0) / 1000)} s`); await available(); return r; },
    (e) => { clearInterval(tick); log('install() rejected:', errText(e)); return 'rejected: ' + errText(e); },
  );
}

// ---------- 3. listen ----------
const L = {
  want: false, rec: null, session: 0, restarts: 0, sessionStart: 0, backoff: 300,
  speechStartAt: 0, firstInterimAt: new Map(), wakeSeen: new Set(), results: 0, pausedForTts: false, heartbeat: null,
};

function setStatus(s) { $('status').textContent = s; }

function makeRecognizer() {
  if (!SR) { log('No SpeechRecognition in this Chrome: voice OFF'); return null; }
  if (!('processLocally' in SR.prototype)) { log('REFUSED: this Chrome has no processLocally property, so on-device cannot be guaranteed. Voice OFF.'); return null; }
  const rec = new SR();
  rec.processLocally = true;
  if (rec.processLocally !== true) { log('REFUSED: processLocally did not stick (reads back', rec.processLocally, '). Voice OFF.'); return null; }
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  const ev = (name) => () => log(`rec.${name} (session ${L.session}, +${Math.round(performance.now() - L.sessionStart)} ms)`);
  rec.onstart = ev('onstart');
  rec.onaudiostart = ev('onaudiostart');
  rec.onsoundstart = ev('onsoundstart');
  rec.onspeechstart = () => { L.speechStartAt = performance.now(); ev('onspeechstart')(); };
  rec.onspeechend = ev('onspeechend');
  rec.onsoundend = ev('onsoundend');
  rec.onaudioend = ev('onaudioend');
  rec.onnomatch = ev('onnomatch');
  rec.onresult = onResult;
  rec.onerror = (e) => {
    log(`rec.onerror: ${e.error}${e.message ? ' - ' + e.message : ''} (session ${L.session})`);
    if (FATAL.has(e.error)) { L.want = false; setStatus(`Stopped: ${e.error}`); }
  };
  rec.onend = onEnd;
  return rec;
}

function onResult(e) {
  const now = performance.now();
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const res = e.results[i];
    const text = res[0].transcript;
    const key = `${L.session}:${i}`;
    if (!L.firstInterimAt.has(key)) L.firstInterimAt.set(key, now);
    L.results++;
    const conf = res.isFinal ? ` conf=${res[0].confidence.toFixed(2)}` : '';
    log(`${res.isFinal ? 'FINAL  ' : 'interim'} [${i}] "${text}"${conf}`);
    $('caption').textContent = text;
    const m = text.match(WAKE);
    if (m && !L.wakeSeen.has(key)) {
      L.wakeSeen.add(key);
      const rest = text.slice(m.index + m[0].length).replace(/^[\s,.!?]+/, '');
      const sinceSpeech = L.speechStartAt ? Math.round(now - L.speechStartAt) : -1;
      const sinceFirst = Math.round(now - L.firstInterimAt.get(key));
      log(`WAKE "${m[0]}" heard (${res.isFinal ? 'final' : 'interim'}); ${sinceSpeech} ms after onspeechstart, ${sinceFirst} ms after first text of this utterance; rest: "${rest}"; frontmost? hasFocus=${document.hasFocus()} visibility=${document.visibilityState}`);
      $('wake').textContent = `Wake word heard: "${m[0]}" -> "${rest}"`;
    }
  }
}

function onEnd() {
  const lasted = Math.round(performance.now() - L.sessionStart);
  log(`rec.onend (session ${L.session} lasted ${(lasted / 1000).toFixed(1)} s)`);
  L.rec = null;
  if (!L.want || L.pausedForTts) { if (!L.want) setStatus('Not listening'); return; }
  if (!$('chkRestart').checked) { L.want = false; setStatus('Ended (restart off)'); return; }
  L.backoff = lasted < 2000 ? Math.min(L.backoff * 2, 8000) : 300;
  L.restarts++;
  log(`restart #${L.restarts} in ${L.backoff} ms`);
  setTimeout(() => { if (L.want && !L.pausedForTts && !L.rec) startSession(); }, L.backoff);
}

function startSession() {
  const rec = makeRecognizer();
  if (!rec) { L.want = false; setStatus('On-device speech not available'); return false; }
  L.session++;
  L.sessionStart = performance.now();
  L.speechStartAt = 0;
  try {
    rec.start();
    L.rec = rec;
    log(`rec.start() session ${L.session} (processLocally=${rec.processLocally}, continuous=${rec.continuous}, interim=${rec.interimResults})`);
    setStatus('Listening (on this device)');
    return true;
  } catch (e) {
    log('rec.start() threw:', errText(e));
    L.want = false;
    setStatus('Start failed');
    return false;
  }
}

function startListening() {
  if (L.want) { log('already listening'); return; }
  L.want = true;
  L.restarts = 0;
  L.backoff = 300;
  if (!startSession()) return;
  clearInterval(L.heartbeat);
  L.heartbeat = setInterval(() => {
    if (L.want) log(`alive: session ${L.session}, restarts ${L.restarts}, results ${L.results}, hasFocus=${document.hasFocus()}, visibility=${document.visibilityState}`);
  }, 30000);
}

function stopListening() {
  L.want = false;
  clearInterval(L.heartbeat);
  if (L.rec) { try { L.rec.stop(); } catch (e) { log('rec.stop threw', errText(e)); } }
  log('stop requested');
  setStatus('Not listening');
}

// ---------- 4. voices ----------
async function voices() {
  let list = [];
  try { list = await chrome.tts.getVoices(); } catch (e) { log('chrome.tts.getVoices failed:', errText(e)); return []; }
  const en = list.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
  const local = en.filter((v) => v.remote === false);
  log(`chrome.tts.getVoices(): ${list.length} voices, ${en.length} English, ${local.length} English with remote:false`);
  for (const v of en) log(`  voice "${v.voiceName}" lang=${v.lang} remote=${v.remote} ext=${v.extensionId || '-'}`);
  try {
    const ss = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
    log(`speechSynthesis.getVoices(): ${ss.length} English (${ss.filter((v) => v.localService).length} localService)`);
  } catch (e) { log('speechSynthesis.getVoices failed', errText(e)); }
  return local;
}

async function speak(text = TEST_SENTENCE, { volume = 1 } = {}) {
  const local = await voices();
  if (!local.length) { log('No local English chrome.tts voice: would fall back to speechSynthesis localService, never a remote voice'); return 'no-local-voice'; }
  const v = local[0];
  const pause = $('chkPause').checked && L.want;
  if (pause) {
    L.pausedForTts = true;
    if (L.rec) { try { L.rec.abort(); } catch { /* already ended */ } }
    log('paused listening for speech');
  }
  const t0 = performance.now();
  log(`chrome.tts.speak with "${v.voiceName}" (${v.lang}), rate 1.05, pause-listening=${pause}: "${text}"`);
  return new Promise((resolve) => {
    const done = (why) => {
      if (L.pausedForTts) {
        L.pausedForTts = false;
        setTimeout(() => { if (L.want && !L.rec) { log('resuming listening after speech'); startSession(); } }, 300);
      }
      resolve(why);
    };
    chrome.tts.speak(text, {
      voiceName: v.voiceName, lang: v.lang, rate: 1.05, volume,
      onEvent: (e) => {
        if (e.type === 'word') return;
        log(`tts event ${e.type} at +${Math.round(performance.now() - t0)} ms${e.errorMessage ? ' ' + e.errorMessage : ''}`);
        if (['end', 'interrupted', 'cancelled', 'error'].includes(e.type)) done(e.type);
      },
    });
    if (chrome.runtime.lastError) { log('tts.speak lastError', chrome.runtime.lastError.message); done('error'); }
  });
}

// ---------- wiring ----------
function wire() {
  $('btnOpenPanel').addEventListener('click', openPanel);
  $('btnOpenTab').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/voice/spike.html') }));
  $('btnMicState').addEventListener('click', micState);
  $('btnMicHere').addEventListener('click', micHere);
  $('btnEnableTab').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/voice/enable.html') }));
  $('btnAvailable').addEventListener('click', available);
  $('btnInstall').addEventListener('click', install);
  $('btnStart').addEventListener('click', startListening);
  $('btnStop').addEventListener('click', stopListening);
  $('btnVoices').addEventListener('click', voices);
  $('btnSpeak').addEventListener('click', () => speak());
  $('btnCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(await allLogText($('log'))); log('log copied to clipboard'); } catch (e) { log('copy failed (select the log and copy by hand):', errText(e)); }
  });
  $('btnClear').addEventListener('click', clearLogs);
  document.addEventListener('visibilitychange', () => log(`visibility -> ${document.visibilityState}`));
  window.addEventListener('focus', () => log('window focus'));
  window.addEventListener('blur', () => log('window blur'));
  // Alt+V ("toggle-voice") while this page is open: try opening the panel from the command.
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-voice') return;
    const wid = (tab && tab.windowId) || windowId;
    log(`command ${command} received in ${where}; sidePanel.open({windowId:${wid}})`);
    chrome.sidePanel.open({ windowId: wid }).then(() => log('sidePanel.open from command resolved'), (e) => log('sidePanel.open from command rejected:', errText(e)));
  });
}

(async () => {
  await detectWhere();
  await initLog(where, $('log'));
  wire();
  const ua = navigator.userAgentData ? navigator.userAgentData.brands.map((b) => `${b.brand} ${b.version}`).join(', ') : navigator.userAgent;
  log(`spike loaded in ${where} (window ${windowId}); ${ua}; API shape: ${JSON.stringify(apiShape())}`);
})();

// For the dev CDP probe only (test/dev/voice-spike-probe.mjs).
globalThis.__spike = { detectWhere, openPanel, micState, micHere, available, install, startListening, stopListening, voices, speak, apiShape, state: L };
