// WCAG 2 contrast for the design tokens, both themes, computed from design/tokens.json.
// FAIL: a text pair under 4.5:1, a control / icon / focus / badge-glyph pair under 3:1,
// or spark / reward used as a text colour anywhere in src/ or site/.
// Run: node test/contrast.test.mjs  (npm test runs it)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/tokens.json'), 'utf8'));
const byName = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]));

const rgb = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); };
const lum = (h) => { const [r, g, b] = rgb(h).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum, what]
const TEXT = 4.5, UI = 3;
const PAIRS = [
  ['ink', 'paper', TEXT, 'body text on the page'],
  ['ink', 'surface', TEXT, 'text on cards'],
  ['ink', 'resume-tint', TEXT, 'the next step on its tint'],
  ['ink-body', 'paper', TEXT, 'muted text on the page'],
  ['ink-body', 'surface', TEXT, 'muted text on cards'],
  ['ink-body', 'resume-tint', TEXT, 'the next-step label'],
  ['on-accent', 'accent', TEXT, 'primary button label'],
  ['accent-tint-ink', 'accent-tint', TEXT, 'secondary button label'],
  ['resume', 'surface', TEXT, 'resume text and the active task on cards'],
  ['resume', 'paper', TEXT, 'resume text on the page'],
  ['resume', 'resume-tint', TEXT, 'resume text on its tint'],
  ['danger', 'surface', TEXT, 'the Delete-all label'],
  ['on-spark', 'spark', TEXT, 'text on a spark fill'],
  ['on-reward', 'reward', TEXT, 'text on a reward fill'],
  ['border-strong', 'surface', UI, 'input and quiet-button outlines'],
  ['focus-ring', 'surface', UI, 'focus ring on cards'],
  ['focus-ring', 'paper', UI, 'focus ring on the page'],
  ['accent', 'surface', UI, 'primary button against its card'],
  ['rest', 'surface', UI, 'paused / away icons'],
  ['on-state', 'state-parked', UI, 'badge glyph P'],
  ['on-state', 'state-away', UI, 'badge glyph •'],
  ['on-state', 'state-wrapped', UI, 'badge glyph ☾'],
  ['on-state', 'state-saved', UI, 'badge glyph ✓'],
  ['on-state', 'state-neutral', UI, 'badge glyph ! ?'],
];
// Old names point at new tokens (tokens.css): mist -> resume-tint, periwinkle/focus-ring -> resume.
const ALIAS = { mist: 'resume-tint', periwinkle: 'resume' };
const val = (name, theme) => { const v = byName[name] || byName[ALIAS[name]]; return v && v[theme]; };

let passed = 0, failed = 0;
const out = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (ok) passed++; else { failed++; process.exitCode = 1; } };

for (const theme of ['light', 'dark']) {
  for (const [fg, bg, min, what] of PAIRS) {
    const a = val(fg, theme), b = val(bg, theme);
    if (!a || !b || !a.startsWith('#') || !b.startsWith('#')) { out(false, `${theme}: ${fg} on ${bg} missing or not a hex colour`); continue; }
    const r = ratio(a, b);
    out(r >= min, `${theme}: ${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)}:1 (min ${min}) ${what}`);
  }
}

// Calm colours (settings.calm): lower-saturation accent, resume and spark, same rules.
const CALM = tokens.color.calm || {};
const calmVal = (name, theme) => (CALM[name] && CALM[name][theme]) || ({ 'focus-ring': CALM.resume, periwinkle: CALM.resume }[name] || {})[theme] || val(name, theme);
const CALM_PAIRS = PAIRS.filter(([fg, bg]) => [fg, bg].some((n) => ['accent', 'resume', 'spark', 'focus-ring', 'on-accent'].includes(n)));
for (const theme of ['light', 'dark']) {
  if (!CALM.accent || !CALM.resume || !CALM.spark) { out(false, 'tokens.json has no calm accent/resume/spark'); break; }
  for (const [fg, bg, min, what] of CALM_PAIRS) {
    const a = calmVal(fg, theme), b = calmVal(bg, theme);
    const r = ratio(a, b);
    out(r >= min, `calm ${theme}: ${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)}:1 (min ${min}) ${what}`);
  }
}

// spark and reward are fills only: never a text colour.
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(css|html|js)$/.test(e.name) ? [p] : [];
  });
}
const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'site'))];
const asText = /(^|[^-])color\s*:\s*var\(--(spark|reward)\)|fillText[^;]*(spark|reward)|-webkit-text-fill-color\s*:\s*var\(--(spark|reward)\)/;
const bad = files.filter((f) => fs.readFileSync(f, 'utf8').split('\n').some((l) => asText.test(l)));
out(!bad.length, bad.length ? `spark/reward used as text in ${bad.map((f) => path.relative(ROOT, f)).join(', ')}` : `spark and reward never used as text (${files.length} files)`);

console.log(`\n${passed} contrast checks passed${failed ? `, ${failed} FAILED` : ''}`);
