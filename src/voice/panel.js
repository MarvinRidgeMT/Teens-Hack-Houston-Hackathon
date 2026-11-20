// "Talk to Pickup" side panel. Owner: Anish.
// - Push-to-talk always works: hold the button or Space, click once, or Alt+V.
// - "Listen for 'Hey Pickup'" is opt-in (default off) and runs only while this panel is open.
// - Speech is recognised on this device only (recognizer.js enforces processLocally = true).
// - The engine builds every reply (src/sw/voice.js); this page only shows and speaks it.
// - No audio and no transcripts are kept. Only a dictated next step is stored, by the engine.

import { MSG } from '../shared/messages.js';
import { parse, splitWake, tidyWords } from './intents.js';
import { createRecognizer, onDeviceStatus, micState } from './recognizer.js';

const HOLD_MS = 300;            // pressed longer than this = hold-to-talk, else a click
const ONE_SHOT_MAX_MS = 8000;   // a click or Alt+V listens this long at most
const WAKE_WINDOW_MS = 6000;    // after a bare "Hey Pickup", wait this long for the command
const SHORTCUT_FRESH_MS = 4000; // Alt+V that opened this panel
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'audio-capture']);
const NOT_AVAILABLE = "On-device speech isn't available in this Chrome, so voice is off. Pickup never sends your voice to a server.";
const WAKE_AT_START = /^\s*(?:hey,?\s+)?pick\s?-?up\b/i;

const $ = (id) => document.getElementById(id);
const S = {
  ready: false, device: 'missing', mic: 'unknown', voiceEnabled: false, wakeOn: false,
  mode: 'off',            // 'off' | 'talk' | 'wake'
  rec: null, speaking: false, busy: false,
  talk: { finals: [], interim: '', pressing: false, downAt: 0, oneShot: false, timer: null },
  wake: { backoff: 300, startedAt: 0, awaitUntil: 0 },
};

// ---------- status ----------
function render() {
  let text = 'Off', state = 'off';
  if (S.device === 'missing' || S.device === 'unavailable') text = 'On-device speech not available';
  else if (S.speaking) { text = 'Speaking'; state = 'speaking'; }
  else if (S.mode === 'talk') { text = 'Listening (on this device)'; state = 'listening'; }
  else if (S.mode === 'wake') {
    state = 'listening';
    text = S.wake.awaitUntil > Date.now() ? 'Listening (on this device): say your command' : 'Listening for "Hey Pickup" (on this device)';
  } else if (!S.ready) text = 'Off (set up voice first)';
  $('status').textContent = text;
  $('status').dataset.state = state;
  const mic = $('mic');
  mic.disabled = !S.ready;
  mic.setAttribute('aria-pressed', String(S.mode === 'talk'));
  $('micLabel').textContent = S.mode === 'talk' ? (S.talk.oneShot ? 'Listening... click to stop' : 'Listening... let go to send') : 'Hold to talk';
  $('wake').disabled = !S.ready;
  $('wake').checked = S.wakeOn;
}

async function refresh() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  S.voiceEnabled = !!settings.voiceEnabled;
  S.wakeOn = S.voiceEnabled && !!settings.wakeWord;
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
    $('btnSetup').textContent = why.length ? 'Set up voice' : 'Turn voice on';
    $('btnSetup').hidden = false;
  }
  if (!S.ready) stopEverything({ keepWakeSetting: true });
  else if (S.wakeOn && S.mode === 'off' && !S.speaking) startWake();
  else if (!S.wakeOn && S.mode === 'wake') stopWake();
  render();
}

function sendEngine(msg) {
  return chrome.runtime.sendMessage(msg).catch(() => null);
}

// ---------- speaking (local voices only) ----------
let voicePick = null;
async function pickVoice() {
  if (voicePick) return voicePick;
  try {
    const list = (await chrome.tts.getVoices()).filter((v) => v.remote === false && /^en/i.test(v.lang || ''));
    const v = list.find((x) => /^en-US$/i.test(x.lang)) || list[0];
    if (v) return (voicePick = { kind: 'tts', name: v.voiceName, lang: v.lang });
  } catch { /* fall through */ }
  const ss = (globalThis.speechSynthesis ? speechSynthesis.getVoices() : []).filter((v) => v.localService && /^en/i.test(v.lang));
  const v = ss.find((x) => /^en-US$/i.test(x.lang)) || ss[0];
  return v ? (voicePick = { kind: 'ss', voice: v }) : null; // never a remote voice; null = text only
}

async function speak(text) {
  const v = await pickVoice();
  if (!v) return;
  S.speaking = true;
  if (S.rec && S.mode === 'wake') { try { S.rec.abort(); } catch { /* ended */ } } // don't hear ourselves
  render();
  await new Promise((resolve) => {
    const done = () => { clearTimeout(guard); resolve(); };
    const guard = setTimeout(resolve, 20000);
    if (v.kind === 'tts') {
      chrome.tts.speak(text, {
        voiceName: v.name, lang: v.lang, rate: 1.05,
        onEvent: (e) => { if (['end', 'interrupted', 'cancelled', 'error'].includes(e.type)) done(); },
      });
    } else {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v.voice; u.rate = 1.05; u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    }
  });
  S.speaking = false;
  render();
  setTimeout(() => { if (S.mode === 'wake' && !S.rec && !S.speaking) wakeSession(); }, 250);
}

function stopSpeaking() {
  try { chrome.tts.stop(); } catch { /* none */ }
  try { speechSynthesis.cancel(); } catch { /* none */ }
}

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

// ---------- one utterance -> engine -> reply ----------
async function handleUtterance(raw) {
  const said = tidyWords(raw);
  $('heard').textContent = said || '(nothing heard)';
  const w = splitWake(said);
  const command = w.wake && WAKE_AT_START.test(said) ? w.rest : said;
  if (!command) { showReply("I didn't catch that."); return; }
  const { intent, args } = parse(command);
  if (intent === 'stop') await setWake(false);
  S.busy = true;
  const r = await sendEngine({ type: MSG.voiceCommand, intent, args });
  S.busy = false;
  const say = (r && r.say) || "Pickup didn't answer. Try again.";
  showReply(say);
  await speak(say);
}

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
    $('heard').textContent = tidyWords([...S.talk.finals, interim].join(' ')) || ' ';
    if (S.talk.oneShot && S.talk.finals.length) stopRec(); // one thing said: done
  };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') showReply(`Voice stopped: ${e.error}.`);
    if (FATAL.has(e.error)) refresh();
  };
  rec.onend = () => {
    clearTimeout(S.talk.timer);
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
      const w = splitWake(text);
      if (!res.isFinal) { if (w.wake || awaiting) $('heard').textContent = tidyWords(text); continue; }
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
    pressStart();
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { e.preventDefault(); pressEnd(); } });
  // A keyboard "click" on the mic button (Enter) = one-shot.
  mic.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (S.mode === 'talk') cancelTalk(); else startTalk({ oneShot: true }); } });

  $('wake').addEventListener('change', (e) => setWake(e.target.checked));
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

// Alt+V: the engine opened this panel (or it was open) and asked for push-to-talk.
let lastShortcut = 0;
function onShortcut(at) {
  if (at === lastShortcut) return; // the same Alt+V seen twice (load + storage change)
  lastShortcut = at;
  if (!S.ready) { showReply('Set up voice first.'); return; }
  if (S.mode === 'talk') { cancelTalk(); return; }
  stopSpeaking();
  startTalk({ oneShot: true });
}

(async () => {
  wire();
  await refresh();
  const { voiceShortcutAt } = await chrome.storage.session.get('voiceShortcutAt').catch(() => ({}));
  if (voiceShortcutAt && Date.now() - voiceShortcutAt < SHORTCUT_FRESH_MS) onShortcut(voiceShortcutAt);
})();
