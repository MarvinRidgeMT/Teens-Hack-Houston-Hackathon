// Pickup panel: the voice half (pickup.js is the Ask box, break timer, task list
// and Today strip). Owner: Anish.
// - runCommand() is the one path for typed and spoken asks: parse() -> voiceCommand
//   -> the engine's fixed-template reply. Typed asks resume with returnVia 'panel'.
// - Push-to-talk always works: hold the button or Space, click once, or the panel key (toggle-voice).
// - "Listen for 'Hey Pickup'" is opt-in (default off) and runs only while this panel is open.
// - Speech is recognised on this device only (recognizer.js enforces processLocally = true).
// - The engine builds every reply (src/sw/voice.js); this page shows it as text.
// - "Pickup talks back" (default off) uses Pickup's own voice (voice-out.js: Kokoro af_heart,
//   on this device, the same on every OS). Never a system voice (speechSynthesis / chrome.tts).
// - No audio and no transcripts are kept. Only a dictated next step is stored, by the engine.

import { MSG } from '../shared/messages.js';
import { fillShortcuts } from '../shared/shortcuts.js';
import { parse, splitWake, tidyWords, wakeCommand } from './intents.js';
import { createRecognizer, onDeviceStatus, micState } from './recognizer.js';
import * as voice from './voice-out.js';

const HOLD_MS = 300;            // pressed longer than this = hold-to-talk, else a click
const ONE_SHOT_MAX_MS = 8000;   // a click or the panel key listens this long at most
const WAKE_WINDOW_MS = 6000;    // after a bare "Hey Pickup", wait this long for the command
const SHORTCUT_FRESH_MS = 4000; // the panel key that opened this panel
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture']);
const NOT_AVAILABLE = "On-device speech isn't available in this Chrome, so voice is off. Pickup never sends your voice to a server.";
const WAKE_AT_START = /^\s*(?:hey,?\s+)?pick\s?-?up\b/i;
const VOICE_READYING = "Getting Pickup's voice ready…";
const VOICE_TOO_SLOW = "Pickup's voice needs a newer computer. Replies are shown as text.";

const $ = (id) => document.getElementById(id);
const S = {
  ready: false, device: 'missing', mic: 'unknown', voiceEnabled: false, wakeOn: false, readAloud: false, voiceShownReady: false,
  mode: 'off',            // 'off' | 'talk' | 'wake'
  rec: null, speaking: false, busy: false,
  talk: { finals: [], interim: '', pressing: false, downAt: 0, oneShot: false, timer: null },
  wake: { backoff: 300, startedAt: 0, awaitUntil: 0 },
};

// ---------- status ----------
function render() {
  // The pill shows only while the mic is actually listening; otherwise the header shows the task line.
  const listening = S.mode === 'talk' || S.mode === 'wake';
  let text = 'Listening…';
  if (S.mode === 'wake') text = S.wake.awaitUntil > Date.now() ? 'Listening… say your command' : 'Listening for "Hey Pickup"…';
  $('status').hidden = !listening;
  $('statusText').textContent = text;
  const mic = $('mic');
  mic.disabled = !S.ready;
  mic.title = S.ready ? 'Hold to talk' : 'Set up the microphone in Voice settings to talk';
  mic.setAttribute('aria-pressed', String(S.mode === 'talk'));
  $('micLabel').textContent = S.mode === 'talk' ? (S.talk.oneShot ? 'Listening... click to stop' : 'Listening... let go to send') : 'Hold to talk';
  $('wake').disabled = !S.ready;
  $('wake').checked = S.wakeOn;
  $('readAloud').checked = S.readAloud;
}

let firstRefresh = true;
async function refresh() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  S.voiceEnabled = !!settings.voiceEnabled;
  S.wakeOn = S.voiceEnabled && !!settings.wakeWord;
  const wasOn = S.readAloud;
  S.readAloud = settings.readAloud === true;
  if (S.readAloud && !wasOn) warmVoice();
  S.device = await onDeviceStatus();
  S.mic = await micState();
  S.ready = S.voiceEnabled && S.device === 'available' && S.mic === 'granted';

  const setup = $('setup');
  setup.hidden = S.ready;
  if (S.device === 'missing' || S.device === 'unavailable') {
    $('setupText').textContent = NOT_AVAILABLE;
    $('btnSetup').hidden = true;
  } else if (!S.ready) {
    const why = [];
    if (S.mic !== 'granted') why.push('microphone access');
    if (S.device === 'downloadable') why.push('the on-device English speech model');
    if (S.device === 'downloading') why.push('the on-device speech model (downloading now, this can take a few minutes)');
    $('setupText').textContent = why.length ? `Voice needs a one-time setup: ${why.join(' and ')}.` : 'Voice is off.';
    $('btnSetup').textContent = why.length ? 'Set up the microphone' : 'Turn voice on';
    $('btnSetup').hidden = false;
  }
  firstRefresh = false; // Voice settings stays closed until the user opens it.
  if (!S.ready) stopEverything({ keepWakeSetting: true });
  else if (S.wakeOn && S.mode === 'off' && !S.speaking) startWake();
  else if (!S.wakeOn && S.mode === 'wake') stopWake();
  render();
}

function sendEngine(msg) {
  return chrome.runtime.sendMessage(msg).catch(() => null);
}

// ---------- speaking: Pickup's own voice ----------
// Loads when the panel opens with talking back on (or when it is turned on), with a warm-up,
// so the first real reply is quick. "Getting Pickup's voice ready…" shows the first time only.
async function warmVoice() {
  const note = $('voiceNote');
  let shown = false;
  const t = setTimeout(() => { if (!S.voiceShownReady) { note.textContent = VOICE_READYING; shown = true; } }, 300);
  try {
    await voice.load();
    S.voiceShownReady = true;
    if (shown) note.textContent = '';
    return true;
  } catch (e) {
    await voiceFailed(e);
    return false;
  } finally { clearTimeout(t); }
}

// Can't load, or too slow twice: talking back goes off, one honest line, everything else keeps working.
async function voiceFailed(err) {
  if (err) console.warn('Pickup voice unavailable:', err);
  voice.stop();
  S.readAloud = false;
  $('voiceNote').textContent = VOICE_TOO_SLOW;
  render();
  await sendEngine({ type: MSG.setVoiceSettings, readAloud: false });
}

async function speak(text, { force = false, startedAt } = {}) {
  if (!S.readAloud && !force) return; // replies are always shown as text; spoken only if "Pickup talks back" is on
  S.speaking = true;
  if (S.rec && S.mode === 'wake') { try { S.rec.abort(); } catch { /* ended */ } S.rec = null; } // don't hear ourselves
  render();
  try {
    const r = await voice.say(text, { startedAt });
    if (r.giveUp) await voiceFailed(new Error(`first sound took ${r.firstSoundMs} ms, twice`));
  } catch (e) {
    await voiceFailed(e);
  } finally {
    S.speaking = false;
    render();
    setTimeout(() => { if (S.mode === 'wake' && !S.rec && !S.speaking) wakeSession(); }, 250);
  }
}

function stopSpeaking() { voice.stop(); }

function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
    o.onended = () => ctx.close();
  } catch { /* no audio */ }
}

// ---------- one ask (typed or spoken) -> engine -> reply ----------
// typed: true from the Ask box or a chip (returnVia 'panel'); false for speech ('voice').
// The transcript labels show only once something has been asked (until then, just the hint).
const setHeard = (text) => { $('heard').textContent = text; $('heard').closest('.talk')?.removeAttribute('data-empty'); };

export async function runCommand(raw, { typed = false } = {}) {
  const said = tidyWords(raw);
  setHeard(said || (typed ? ' ' : '(nothing heard)'));
  const w = splitWake(said);
  const command = w.wake && WAKE_AT_START.test(said) ? w.rest : said;
  if (!command) { showReply(typed ? 'Type a question, like "where was I?"' : "I didn't catch that."); return null; }
  if (S.busy) return null; // one command at a time: a second one while answering is dropped
  S.busy = true;
  const startedAt = performance.now(); // time to first sound is measured from the ask
  try {
    const { intent, args } = parse(command);
    if (intent === 'stop' && !typed) await setWake(false);
    const msg = { type: MSG.voiceCommand, intent, args };
    if (typed) msg.via = 'panel';
    const r = await sendEngine(msg);
    const say = (r && r.say) || "Pickup didn't answer. Try again.";
    showReply(say);
    speak(say, { startedAt }); // never blocks typing: the next ask cuts this one off
    return r;
  } finally { S.busy = false; }
}
const handleUtterance = (raw) => runCommand(raw, { typed: false });

function showReply(text) { $('reply').textContent = text; }

// ---------- push-to-talk ----------
function startTalk({ oneShot }) {
  if (!S.ready || S.mode === 'talk') return false;
  pauseWake();
  const rec = createRecognizer({ continuous: true });
  if (!rec) { S.device = 'missing'; refresh(); return false; }
  S.talk = { finals: [], interim: '', pressing: !oneShot, downAt: performance.now(), oneShot, timer: null };
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) S.talk.finals.push(res[0].transcript); else interim += res[0].transcript;
    }
    S.talk.interim = interim;
    setHeard(tidyWords([...S.talk.finals, interim].join(' ')) || ' ');
    if (S.talk.oneShot && S.talk.finals.length) stopRec(); // one thing said: done
  };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') showReply(`Voice stopped: ${e.error}.`);
    if (FATAL.has(e.error)) refresh();
  };
  rec.onend = () => {
    clearTimeout(S.talk.timer);
    if (S.rec !== rec) return; // an older recogniser ending late
    S.rec = null;
    if (S.mode !== 'talk') return;
    S.mode = 'off';
    const text = tidyWords(S.talk.finals.join(' ') || S.talk.interim);
    render();
    if (S.talk.cancelled) { resumeWake(); return; }
    (text ? handleUtterance(text) : Promise.resolve(showReply("I didn't hear anything."))).finally(resumeWake);
  };
  try { rec.start(); } catch (e) { showReply(`Couldn't start the microphone: ${e.message}`); return false; }
  S.rec = rec;
  S.mode = 'talk';
  if (oneShot) S.talk.timer = setTimeout(stopRec, ONE_SHOT_MAX_MS);
  render();
  return true;
}

function stopRec() { if (S.rec) { try { S.rec.stop(); } catch { /* ended */ } } }
function cancelTalk() {
  if (S.mode !== 'talk') return;
  S.talk.cancelled = true;
  if (S.rec) { try { S.rec.abort(); } catch { /* ended */ } }
}

function pressStart() {
  if (!S.ready) return;
  if (S.mode === 'talk') { cancelTalk(); return; } // click while listening = stop
  stopSpeaking();
  startTalk({ oneShot: false });
}
function pressEnd() {
  if (S.mode !== 'talk' || !S.talk.pressing) return;
  S.talk.pressing = false;
  if (performance.now() - S.talk.downAt >= HOLD_MS) stopRec(); // hold released: send
  else { // a click: listen for one thing
    S.talk.oneShot = true;
    S.talk.timer = setTimeout(stopRec, ONE_SHOT_MAX_MS);
    render();
  }
}

// ---------- wake word ("Hey Pickup") ----------
// Continuous on-device recognition; a final result that starts the wake phrase runs
// the rest as a command. Restarts on end with backoff. Paused while Pickup speaks.
// This block is the first thing to cut: push-to-talk does not depend on it.
async function setWake(on) {
  S.wakeOn = on && S.ready;
  await sendEngine({ type: MSG.setVoiceSettings, wakeWord: S.wakeOn });
  if (S.wakeOn) startWake(); else stopWake();
  render();
}

function startWake() {
  if (!S.ready || !S.wakeOn || S.mode !== 'off' || S.speaking) return;
  S.mode = 'wake';
  S.wake.backoff = 300;
  wakeSession();
}

function wakeSession() {
  if (S.mode !== 'wake' || S.rec || S.speaking) return;
  const rec = createRecognizer({ continuous: true });
  if (!rec) { S.mode = 'off'; S.device = 'missing'; refresh(); return; }
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0].transcript;
      const awaiting = S.wake.awaitUntil > Date.now();
      const w = wakeCommand(text); // only "hey pickup" at the start counts
      if (!res.isFinal) { if (w.wake || awaiting) setHeard(tidyWords(text)); continue; }
      if (awaiting && !w.wake) { S.wake.awaitUntil = 0; handleUtterance(text); continue; }
      if (!w.wake) continue; // not for us: ignored and not kept
      if (w.rest) { S.wake.awaitUntil = 0; handleUtterance(w.rest); } else {
        chime();
        S.wake.awaitUntil = Date.now() + WAKE_WINDOW_MS;
        setTimeout(render, WAKE_WINDOW_MS + 50);
        render();
      }
    }
  };
  rec.onerror = (e) => {
    if (FATAL.has(e.error)) { showReply(`Listening stopped: ${e.error}.`); S.mode = 'off'; refresh(); }
  };
  rec.onend = () => {
    if (S.rec !== rec) return; // aborted for push-to-talk or speech: whoever replaced it owns S.rec
    S.rec = null;
    if (S.mode !== 'wake' || S.speaking) return;
    const lasted = performance.now() - S.wake.startedAt;
    S.wake.backoff = lasted < 2000 ? Math.min(S.wake.backoff * 2, 8000) : 300;
    setTimeout(wakeSession, S.wake.backoff);
  };
  try { rec.start(); } catch (e) { showReply(`Couldn't start listening: ${e.message}`); S.mode = 'off'; render(); return; }
  S.rec = rec;
  S.wake.startedAt = performance.now();
  render();
}

function stopWake() {
  if (S.mode !== 'wake') return;
  S.mode = 'off';
  S.wake.awaitUntil = 0;
  if (S.rec) { try { S.rec.abort(); } catch { /* ended */ } }
  S.rec = null;
  render();
}
function pauseWake() { if (S.mode === 'wake') stopWake(); }
function resumeWake() { if (S.wakeOn && S.ready && S.mode === 'off' && !S.speaking) startWake(); }

function stopEverything({ keepWakeSetting = false } = {}) {
  cancelTalk();
  stopWake();
  stopSpeaking();
  if (!keepWakeSetting && S.wakeOn) setWake(false);
  render();
}

// ---------- wiring ----------
function wire() {
  const mic = $('mic');
  mic.addEventListener('pointerdown', (e) => { if (e.button === 0) { mic.setPointerCapture(e.pointerId); pressStart(); } });
  mic.addEventListener('pointerup', pressEnd);
  mic.addEventListener('pointercancel', pressEnd);
  // Space = push-to-talk anywhere in the panel (except on other controls); Esc stops.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); stopEverything(); return; }
    if (e.code !== 'Space' || e.repeat) return;
    const t = e.target;
    if (t !== mic && t.closest && t.closest('input, button, summary, a, textarea, select')) return;
    e.preventDefault();
    S.spaceTalk = true;
    pressStart();
  });
  // Only end a Space push-to-talk; Space on a checkbox or button keeps its normal job.
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || !S.spaceTalk) return;
    S.spaceTalk = false;
    e.preventDefault();
    pressEnd();
  });
  // A keyboard "click" on the mic button (Enter) = one-shot.
  mic.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (S.mode === 'talk') cancelTalk(); else startTalk({ oneShot: true }); } });

  $('wake').addEventListener('change', (e) => setWake(e.target.checked));
  $('readAloud').addEventListener('change', async (e) => {
    S.readAloud = e.target.checked;
    if (S.readAloud) { $('voiceNote').textContent = ''; warmVoice(); } else stopSpeaking();
    await sendEngine({ type: MSG.setVoiceSettings, readAloud: S.readAloud });
  });
  $('sample').addEventListener('click', async () => {
    $('sample').disabled = true;
    try { if (await warmVoice()) await speak(voice.SAMPLE, { force: true }); } finally { $('sample').disabled = false; }
  });
  $('listenStop').addEventListener('click', () => { if (S.mode === 'talk') cancelTalk(); else setWake(false); });
  $('btnSetup').addEventListener('click', async () => {
    if (S.mic === 'granted' && S.device === 'available') {
      await sendEngine({ type: MSG.setVoiceSettings, voiceEnabled: true });
      refresh();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/voice/enable.html') });
    }
  });
  $('btnOff').addEventListener('click', async () => {
    stopEverything();
    await sendEngine({ type: MSG.setVoiceSettings, voiceEnabled: false });
    refresh();
  });
  $('btnDiag').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/voice/spike.html') }));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) refresh();
    if (area === 'session' && changes.voiceShortcutAt && changes.voiceShortcutAt.newValue) onShortcut(changes.voiceShortcutAt.newValue);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  navigator.permissions.query({ name: 'microphone' }).then((p) => { p.onchange = refresh; }, () => {});
  // While the model downloads or voice isn't set up, look again now and then.
  setInterval(() => { if (!S.ready) refresh(); }, 5000);
}

// The panel key (toggle-voice): the engine opened this panel (or it was open) and asked for push-to-talk.
let lastShortcut = 0;
function onShortcut(at) {
  if (at === lastShortcut) return; // the same key press seen twice (load + storage change)
  lastShortcut = at;
  if (!S.ready) { showReply('Set up voice first.'); return; }
  if (S.mode === 'talk') { cancelTalk(); return; }
  stopSpeaking();
  startTalk({ oneShot: true });
}

(async () => {
  wire();
  fillShortcuts().catch(() => {});
  await refresh();
  const { voiceShortcutAt } = await chrome.storage.session.get('voiceShortcutAt').catch(() => ({}));
  if (voiceShortcutAt && Date.now() - voiceShortcutAt < SHORTCUT_FRESH_MS) onShortcut(voiceShortcutAt);
})();
