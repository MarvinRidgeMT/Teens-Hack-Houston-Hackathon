// On-device speech for the voice panel. Owner: Anish.
// Hard rule: SpeechRecognition only ever runs with processLocally = true. The
// default (false) sends audio to a server. If the property is missing or does not
// stick, createRecognizer() returns null and voice stays off. Never a fallback.
// test/check-integration.mjs FAILs any recogniser in src/ that skips this.

export const LANG = 'en-US';
export const OPTS = Object.freeze({ langs: [LANG], processLocally: true });
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

// 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'missing'
export async function onDeviceStatus() {
  if (!SR || typeof SR.available !== 'function' || !('processLocally' in SR.prototype)) return 'missing';
  try { return await SR.available(OPTS); } catch { return 'unavailable'; }
}

// Must be called straight from a click (install() needs a user gesture).
export function installOnDevice() {
  if (!SR || typeof SR.install !== 'function') return Promise.resolve(false);
  try { return Promise.resolve(SR.install(OPTS)).then((r) => r !== false, () => false); } catch { return Promise.resolve(false); }
}

export function createRecognizer({ continuous = true } = {}) {
  if (!SR || !('processLocally' in SR.prototype)) return null;
  const rec = new SR();
  rec.processLocally = true;
  if (rec.processLocally !== true) return null;
  rec.lang = LANG;
  rec.continuous = continuous;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export async function micState() {
  try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch { return 'unknown'; }
}
