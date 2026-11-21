// Pickup's voice: Kokoro-82M (int8), voice af_heart, en-us, run on this device inside
// the side panel. Model, voice and runtime ship in the extension (scripts/build-voice.sh);
// nothing is fetched from the network. Owner: Anish.
// - load() once, with a warm-up. Device: WASM on the CPU, multi-threaded (manifest sets
//   COOP/COEP so the panel is cross-origin isolated). Measured 2026-11-21 in Chrome 157: the
//   int8 model on WebGPU stalled for over 60 s on some sentences (shaders recompile per input
//   length), while threaded WASM gave a first sound in about 1.4 s. WebGPU is only a fallback.
// - say(text): speakableText(), then sentence by sentence: sentence 1 plays while
//   sentence 2 is generated. One Web Audio queue; a new say() or stop() cuts the old one.
// - Every first sound is timed; two slow ones (over 6 s) and the caller turns talking back off.

import { speakableText, splitSentences, firstSoundVerdict } from './speakable.js';

const VOICE = 'af_heart';
const MODEL_ID = 'model';            // src/voice/model/ (localModelPath is src/voice/)
const WARM_UP = 'Ready.';

let loading = null;   // Promise<{ tts, device }>
let ctx = null;
let playing = [];     // AudioBufferSourceNodes scheduled for the current reply
let generation = 0;   // bumps on every say()/stop(); stale work checks it and bails
let slowCount = 0;

export const SAMPLE = 'Welcome back. Your next step is to find a source.';

// Debug hooks for the real-Chrome check (test/dev/voice-out-check.mjs). Facts only, no audio kept.
const debug = { device: null, loadMs: null, firstSoundMs: [], buffersPlayed: 0, contextState: null };
globalThis.__pickupVoice = debug;

async function pickDevice() {
  const forced = globalThis.__pickupVoiceDevice; // measurement override (dev checks only)
  if (forced === 'wasm' || forced === 'webgpu') return forced;
  return 'wasm';
}

async function create(device) {
  if (globalThis.__pickupVoiceFail) throw new Error('forced load failure (dev check)');
  const { KokoroTTS, env } = await import('./vendor/kokoro.web.js');
  env.wasmPaths = new URL('./vendor/', import.meta.url).href;
  return KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device });
}

/** Loads the model once and warms it up. Rejects if neither WebGPU nor WASM can run it. */
export function load() {
  if (loading) return loading;
  loading = (async () => {
    const t0 = performance.now();
    let device = await pickDevice();
    let tts;
    try { tts = await create(device); } catch (e) {
      if (device !== 'wasm' || !navigator.gpu || globalThis.__pickupVoiceFail) throw e;
      device = 'webgpu'; // WASM can't start here (no wasm support?): try the GPU before giving up
      tts = await create(device);
    }
    await tts.generate(WARM_UP, { voice: VOICE }); // first run compiles kernels; do it before a real reply
    debug.device = device;
    debug.loadMs = Math.round(performance.now() - t0);
    return { tts, device };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

function audioContext() {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext({ sampleRate: 24000 });
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  debug.contextState = ctx.state;
  return ctx;
}

/** Stops whatever Pickup is saying, at once. */
export function stop() {
  generation++;
  for (const src of playing) { try { src.stop(); } catch { /* not started */ } }
  playing = [];
}

/**
 * Speaks a reply. Resolves when it has finished playing (or was cut off).
 * Returns { firstSoundMs, giveUp } so the panel can turn talking back off on a slow computer.
 */
export async function say(text, { startedAt = performance.now() } = {}) {
  stop();
  const mine = generation;
  const parts = splitSentences(speakableText(text));
  if (!parts.length) return { firstSoundMs: null, giveUp: false };
  const { tts } = await load();
  const ac = audioContext();
  let at = ac.currentTime;
  let firstSoundMs = null;
  let ended = Promise.resolve();
  for (const part of parts) {
    const audio = await tts.generate(part, { voice: VOICE });
    if (mine !== generation) return { firstSoundMs, giveUp: false };
    const buf = ac.createBuffer(1, audio.audio.length, audio.sampling_rate);
    buf.copyToChannel(audio.audio, 0);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    at = Math.max(at, ac.currentTime);
    src.start(at);
    at += buf.duration;
    playing.push(src);
    ended = new Promise((resolve) => { src.onended = () => { debug.buffersPlayed++; resolve(); }; });
    if (firstSoundMs === null) {
      firstSoundMs = Math.round(performance.now() - startedAt);
      debug.firstSoundMs.push(firstSoundMs);
      debug.contextState = ac.state;
      dispatchEvent(new CustomEvent('pickup-voice', { detail: { type: 'first-sound', ms: firstSoundMs, device: debug.device } }));
    }
  }
  await ended;
  if (mine === generation) playing = [];
  const verdict = firstSoundVerdict(slowCount, firstSoundMs);
  slowCount = verdict.slowCount;
  return { firstSoundMs, giveUp: verdict.giveUp };
}
