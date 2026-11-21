// Calm colours: sets data-calm on <html> from settings.calm and keeps it in step.
// Palette cross-fade: when the colours change after the page has loaded (the OS switches
// light/dark, or Calm is turned on or off), they ease over duration-base instead of snapping.
// Adapted from the page-fade in 21st.dev's "Sun Moon Dark Mode Theme Toggle" (dhxwhy):
// a short-lived stylesheet turns on colour transitions for one change, then removes itself.
// Only colour properties fade, so layout never moves. Skipped under prefers-reduced-motion.
// Loaded by the popup, setup, dashboard and side panel (<script type="module">).
// Not used by the content-script card. Owner: Anish.

const FADE_ID = 'pk-palette-fade';
const FADE_PROPS = 'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, stop-color, box-shadow';
let fadeTimer = 0;

function msToken(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : n) : fallback;
}

export function fadePalette() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ms = msToken('--duration-base', 220);
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'ease-out';
  let style = document.getElementById(FADE_ID);
  if (!style) {
    style = Object.assign(document.createElement('style'), { id: FADE_ID });
    document.head.append(style);
  }
  style.textContent = `*, *::before, *::after { transition-property: ${FADE_PROPS} !important; transition-duration: ${ms}ms !important; transition-timing-function: ${ease} !important; transition-delay: 0s !important; }`;
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => style.remove(), ms + 100);
}

let calm = null; // null until the first read, so the first paint never fades
const apply = (settings) => {
  const next = !!(settings && settings.calm);
  if (calm !== null && next !== calm) fadePalette();
  calm = next;
  document.documentElement.toggleAttribute('data-calm', next);
};

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fadePalette);

if (globalThis.chrome && chrome.storage) {
  chrome.storage.local.get('settings').then(({ settings }) => apply(settings)).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });
}
