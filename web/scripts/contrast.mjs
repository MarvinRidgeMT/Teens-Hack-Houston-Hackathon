// Contrast check for the v4 site tokens (WCAG 2.x ratios). Text pairs ≥ 4.5 (large ≥ 3), UI/focus ≥ 3.
// Text on glass is measured against the WORST background behind it: the strong glass fill
// composited over the deepest pastel volume a section uses (lavender-2) and over the blush light.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/styles/tokens.css'), 'utf8');
const tok = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${name} missing`);
  let v = m[1].trim();
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  return ref ? tok(ref[1]) : v;
};
const rgb = (v) => {
  if (v.startsWith('#')) {
    const h = v.length === 4 ? v.slice(1).split('').map((c) => c + c).join('') : v.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(',').map((s) => parseFloat(s));
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const glassOver = (bgName) => over(rgb(tok('glass-fill-strong')), rgb(tok(bgName)));
const bgs = {
  canvas: rgb(tok('canvas')), 'canvas-2': rgb(tok('canvas-2')), pearl: rgb(tok('pearl')), white: rgb(tok('surface-elevated')),
  lavender: rgb(tok('lavender')), 'lavender-2': rgb(tok('lavender-2')), mint: rgb(tok('mint')), 'mint-2': rgb(tok('mint-2')), sage: rgb(tok('sage')),
  blush: rgb(tok('blush')), bubblegum: rgb(tok('bubblegum')), green: rgb(tok('green')), 'green-2': rgb(tok('green-2')),
  'glass-strong over lavender-2': glassOver('lavender-2'), 'glass-strong over bubblegum': glassOver('bubblegum'),
  'glass (weak) over lavender-2': over(rgb(tok('glass-fill')), rgb(tok('lavender-2'))),
  'glass-strong over light-lilac': over(rgb(tok('glass-fill-strong')), over(rgb(tok('light-lilac')), rgb(tok('canvas')))),
  'glass-strong over light-blush': over(rgb(tok('glass-fill-strong')), over(rgb(tok('light-blush')), rgb(tok('canvas')))),
  'glass (weak) over light-lilac': over(rgb(tok('glass-fill')), over(rgb(tok('light-lilac')), rgb(tok('canvas')))),
};
let fail = 0;
const check = (fgName, bgName, min, why) => {
  const r = ratio(rgb(tok(fgName)), bgs[bgName]);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${fgName} on ${bgName} = ${r.toFixed(2)}:1 (min ${min}) ${why}`);
};
for (const bg of Object.keys(bgs)) check('plum', bg, 4.5, 'primary text');
for (const bg of ['canvas', 'canvas-2', 'pearl', 'white', 'lavender', 'mint', 'sage', 'blush', 'glass-strong over lavender-2', 'glass-strong over bubblegum', 'glass-strong over light-lilac', 'glass-strong over light-blush']) check('plum-2', bg, 4.5, 'secondary text');
for (const bg of ['canvas', 'pearl', 'white', 'canvas-2']) check('plum-3', bg, 4.5, 'tertiary text (small labels)');
for (const bg of ['canvas', 'pearl', 'white', 'canvas-2', 'sage']) check('accent-ink', bg, 4.5, 'links');
for (const bg of ['canvas', 'canvas-2', 'pearl', 'white', 'mint', 'lavender']) check('focus-ring', bg, 3, 'focus ring');
check('danger', 'white', 4.5, 'delete text');
console.log(fail ? `\n${fail} contrast failures` : '\nall v4 contrast checks passed');
process.exit(fail ? 1 : 0);
