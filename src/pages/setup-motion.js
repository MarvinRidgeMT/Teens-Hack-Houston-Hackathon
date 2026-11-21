// Setup page headline: the "blur" effect of React Bits' BlurText (David Haz, MIT + Commons
// Clause), ported from React + motion/react to the bundled Motion (src/vendor/motion.js,
// window.Motion). Each word starts blurred, transparent and a little above, passes
// half-blurred and settles. Decorative, so it never runs under prefers-reduced-motion or
// Calm colours (settings.calm); the headline is then simply there. Owner: Anish.

const title = document.getElementById('st-title');
const M = globalThis.Motion;

async function calmOn() {
  try { return !!(await chrome.storage.local.get('settings')).settings?.calm; } catch { return false; }
}

async function blurIn() {
  if (!title || !M || title.dataset.split) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || await calmOn()) return;
  const text = title.textContent.trim();
  title.dataset.split = '1';
  title.textContent = '';
  title.setAttribute('aria-label', text);
  const words = text.split(/\s+/).map((word, i, all) => {
    const span = Object.assign(document.createElement('span'), { className: 'st-bt', textContent: word });
    span.setAttribute('aria-hidden', 'true');
    title.append(span, i < all.length - 1 ? ' ' : '');
    return span;
  });
  M.animate(words,
    { filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'], opacity: [0, 0.5, 1], y: [-12, 2, 0] },
    { duration: 0.7, times: [0, 0.5, 1], ease: [0.22, 1, 0.36, 1], delay: M.stagger(0.1, { startDelay: 0.12 }) });
}

blurIn();
