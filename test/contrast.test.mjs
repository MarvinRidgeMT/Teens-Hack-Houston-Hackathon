// WCAG 2 contrast for the V4 design tokens (design/tokens.json "v4"): light (Pearl), dark (Plum
// midnight), and Calm colours over both, plus the content-script card and the toolbar badge.
// FAIL: a text pair under 4.5:1 (large display text 3:1), a control / icon / focus pair under 3:1,
// a badge glyph under 4.5:1, src/shared/tokens.css disagreeing with tokens.json, or a pastel
// (lavender, mint, sage, blush, green, spark, reward, cta) used as a text colour anywhere in src/ or site/.
// Run: node test/contrast.test.mjs  (npm test runs it)

import fs from 'node:fs';
import path from 'node:path';
import { BADGE } from '../src/shared/constants.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/tokens.json'), 'utf8'));
const V4 = tokens.v4;

const rgb = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); };
const lum = (h) => { const [r, g, b] = rgb(h).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// rgba(r, g, b, a) composited over an opaque backdrop -> hex (worst case for a translucent surface).
const over = (rgba, backdrop) => {
  const m = rgba.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
  if (!m) return rgba;
  const a = +m[4]; const bd = rgb(backdrop).map((c) => c * 255);
  return '#' + [1, 2, 3].map((i, k) => Math.round(+m[i] * a + bd[k] * (1 - a)).toString(16).padStart(2, '0')).join('');
};

let passed = 0, failed = 0;
const out = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (ok) passed++; else { failed++; process.exitCode = 1; } };
const check = (label, a, b, min, what) => {
  if (!a || !b || !a.startsWith('#') || !b.startsWith('#')) { out(false, `${label}: ${what}: missing or not a hex colour (${a} on ${b})`); return; }
  const r = ratio(a, b);
  out(r >= min, `${label}: ${a} on ${b} = ${r.toFixed(2)}:1 (min ${min}) ${what}`);
};

if (!V4 || !V4.light || !V4.dark || !V4.calm) { out(false, 'design/tokens.json has no "v4" light/dark/calm'); process.exit(1); }

// [foreground, background, minimum, what]
const TEXT = 4.5, LARGE = 3, UI = 3;
const PAIRS = [
  ['ink', 'paper', TEXT, 'body text on the page'],
  ['ink', 'surface', TEXT, 'text on cards'],
  ['ink', 'resume-tint', TEXT, 'the next step on its tint'],
  ['ink', 'accent-tint', TEXT, 'text on a lavender fill'],
  ['ink', 'selected', TEXT, 'text on a mint selected / active row'],
  ['ink-body', 'paper', TEXT, 'muted text on the page'],
  ['ink-body', 'surface', TEXT, 'muted text on cards'],
  ['ink-body', 'resume-tint', TEXT, 'the next-step label'],
  ['ink-body', 'selected', TEXT, 'muted text on an active row'],
  ['on-accent', 'accent', TEXT, 'label on an accent fill (brand tile, accent chips)'],
  ['accent', 'paper', TEXT, 'accent-ink text on the page (setup wordmark, info icon)'],
  ['accent', 'surface', TEXT, 'accent-ink text on cards'],
  ['accent-tint-ink', 'accent-tint', TEXT, 'secondary label on lavender'],
  ['on-cta', 'cta', TEXT, 'primary button label (plum on green)'],
  ['on-cta', 'cta-hover', TEXT, 'primary button label, hovered'],
  ['cta-edge', 'surface', UI, 'primary button rim against its card'],
  ['cta-edge', 'paper', UI, 'primary button rim against the page'],
  ['resume', 'surface', TEXT, 'resume text and the active task on cards'],
  ['resume', 'paper', TEXT, 'resume text and links on the page'],
  ['resume', 'resume-tint', TEXT, 'resume text on its tint'],
  ['resume', 'selected', TEXT, 'the active task name on its mint row'],
  ['selected-edge', 'surface', UI, 'selected / active row edge'],
  ['danger', 'surface', TEXT, 'the Delete-all label'],
  ['on-spark', 'spark', TEXT, 'the task name on its mint underlay'],
  ['on-reward', 'reward', TEXT, 'text on a blush fill'],
  ['border-strong', 'surface', UI, 'input and quiet-button outlines'],
  ['border-strong', 'paper', UI, 'outlines on the page'],
  ['focus-ring', 'surface', UI, 'focus ring on cards'],
  ['focus-ring', 'paper', UI, 'focus ring on the page'],
  ['accent', 'surface', UI, 'checkboxes and the brand tile against cards'],
  ['rest', 'surface', UI, 'paused / away icons'],
  ['on-state', 'state-parked', TEXT, 'badge / dot glyph P'],
  ['on-state', 'state-away', TEXT, 'badge glyph •'],
  ['on-state', 'state-wrapped', TEXT, 'badge glyph ☾'],
  ['on-state', 'state-saved', TEXT, 'badge glyph ✓'],
  ['on-state', 'state-neutral', TEXT, 'badge glyph ! ?'],
  ['state-saved', 'surface', UI, 'saved dot on cards'],
  ['state-parked', 'surface', UI, 'parked dot on cards'],
  ['state-away', 'surface', UI, 'away dot on cards'],
];
const ALIAS = V4.aliases || {};
const pick = (map, name) => map[name] || map[ALIAS[name]];

for (const theme of ['light', 'dark']) {
  for (const [fg, bg, min, what] of PAIRS) check(theme, pick(V4[theme], fg), pick(V4[theme], bg), min, `${fg} on ${bg}: ${what}`);
}

// Calm colours (settings.calm): the theme's values with the calm overrides, same rules for every pair a calm token touches.
const CALM_KEYS = Object.keys(V4.calm.light);
for (const theme of ['light', 'dark']) {
  const merged = { ...V4[theme], ...V4.calm[theme] };
  for (const [fg, bg, min, what] of PAIRS.filter(([f, b]) => CALM_KEYS.includes(f) || CALM_KEYS.includes(b))) {
    check(`calm ${theme}`, pick(merged, fg), pick(merged, bg), min, `${fg} on ${bg}: ${what}`);
  }
}

// The content-script card and park overlay: near-opaque pearl / plum surface, checked over the
// worst website behind it (pure white and pure black), so it reads on any page.
const CARD_PAIRS = [
  ['ink', 'bg', TEXT, 'card text'], ['muted', 'bg', TEXT, 'card muted text'], ['faint', 'bg', TEXT, 'fact labels, placeholders'],
  ['link', 'bg', TEXT, '"Your next step" label, "Parked"'], ['ink', 'panel', TEXT, 'the next step'], ['muted', 'panel', TEXT, 'the next-step source'],
  ['link', 'panel', TEXT, '"Your next step" on its panel'], ['ink', 'underlay', LARGE, 'task name (24px display) on its mint underlay'],
  ['ink', 'underlay', TEXT, 'task name on its mint underlay'],
  ['resume-ink', 'resume', TEXT, 'Resume label (plum on green)'], ['resume-edge', 'bg', UI, 'Resume button rim'], ['focus', 'bg', UI, 'focus ring'],
];
for (const theme of ['light', 'dark']) {
  const c = V4.card[theme];
  for (const backdrop of ['#ffffff', '#000000']) {
    const solid = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, over(v, backdrop)]));
    for (const [fg, bg, min, what] of CARD_PAIRS) check(`card ${theme} over ${backdrop}`, solid[fg], solid[bg], min, `${fg} on ${bg}: ${what}`);
  }
  const alpha = +(c.bg.match(/,\s*([\d.]+)\s*\)$/) || [0, 1])[1];
  out(alpha >= 0.94, `card ${theme}: surface opacity ${alpha} (min 0.94)`);
}
// card.js / overlay.js carry the same values as tokens.json v4.card.
const cardSrc = fs.readFileSync(path.join(ROOT, 'src/content/card.js'), 'utf8');
for (const theme of ['light', 'dark']) {
  const missing = Object.values(V4.card[theme]).filter((v) => !cardSrc.includes(v));
  out(!missing.length, `card ${theme}: card.js has every v4.card value${missing.length ? ` (missing ${missing.join(', ')})` : ''}`);
}

// The toolbar badge (one colour, white glyph).
const badge = [['P', BADGE.parked.color], ['•', BADGE.away.color], ['☾', BADGE.wrapped.color], ['9m', BADGE.timer.color], ['✓', BADGE.flash['✓']], ['?', BADGE.flash.default]];
for (const [g, c] of badge) check('badge', V4.badge.glyph, c, TEXT, `white glyph ${g} on the toolbar badge`);
out(BADGE.parked.color === V4.badge.parked && BADGE.away.color === V4.badge.away && BADGE.wrapped.color === V4.badge.wrapped && BADGE.flash['✓'] === V4.badge.saved,
  'BADGE in constants.js matches tokens.json v4.badge');

// src/shared/tokens.css is generated from tokens.json v4: every value must agree.
const css = fs.readFileSync(path.join(ROOT, 'src/shared/tokens.css'), 'utf8');
const block = (sel) => { const i = css.indexOf(sel); if (i < 0) return ''; const a = css.indexOf('{', i); return css.slice(a + 1, css.indexOf('}', a)); };
const decls = (txt) => Object.fromEntries([...txt.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const blocks = {
  light: decls(block(':root, :host {')),
  dark: decls(block(':root[data-theme="dark"], :host([data-theme="dark"]) {')),
  'dark (media)': decls(block(':root:not([data-theme="light"]), :host(:not([data-theme="light"])) {')),
  'calm light': decls(block(':root[data-calm] {')),
  'calm dark': decls(block(':root[data-calm][data-theme="dark"] {')),
  'calm dark (media)': decls(block(':root[data-calm]:not([data-theme="light"]) {')),
};
const want = { light: V4.light, dark: V4.dark, 'dark (media)': V4.dark, 'calm light': V4.calm.light, 'calm dark': V4.calm.dark, 'calm dark (media)': V4.calm.dark };
for (const [k, exp] of Object.entries(want)) {
  const diff = Object.entries(exp).filter(([n, v]) => blocks[k][n] !== v).map(([n, v]) => `${n}: css ${blocks[k][n]} / json ${v}`);
  out(!diff.length, `tokens.css ${k} agrees with tokens.json v4${diff.length ? ` (${diff.join('; ')})` : ` (${Object.keys(exp).length} tokens)`}`);
}

// Pastels are fills only: never a text colour (src/ including the content-script card, and site/).
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === 'vendor' ? [] : walk(p)) : /\.(css|html|js)$/.test(e.name) ? [p] : [];
  });
}
// The extension (src/) is checked for every v4 pastel; the built website (site/, its own lane and its own
// tokens, where lavender on a midnight band is legitimate) keeps the older spark / reward rule.
const PASTEL_VARS = 'spark|reward|cta|cta-hover|selected|lavender|lavender-2|mint|mint-2|sage|blush|bubblegum|green|green-2|pk-accent|pk-accent-hi|pk-mint|pk-panel';
const PASTEL_HEX = 'e7daff|d8c6ff|ddfbea|bff2d4|effcf4|ffd8e8|ffbfd8|c4f4ab|a6ea88';
const textRule = (vars, hex) => new RegExp(`(^|[^-])color\\s*:\\s*(var\\(--(${vars})\\)${hex ? `|#(${hex})\\b` : ''})|-webkit-text-fill-color\\s*:\\s*var\\(--(${vars})\\)`, 'i');
const scan = (fileList, rule) => fileList.filter((f) => fs.readFileSync(f, 'utf8').split('\n').some((l) => rule.test(l)));
const srcFiles = walk(path.join(ROOT, 'src'));
const siteFiles = walk(path.join(ROOT, 'site'));
const bad = [...scan(srcFiles, textRule(PASTEL_VARS, PASTEL_HEX)), ...scan(siteFiles, textRule('spark|reward', ''))];
out(!bad.length, bad.length ? `pastel used as text in ${bad.map((f) => path.relative(ROOT, f)).join(', ')}` : `pastels never used as text (${srcFiles.length} extension files; spark/reward in ${siteFiles.length} site files)`);

console.log(`\n${passed} contrast checks passed${failed ? `, ${failed} FAILED` : ''}`);
