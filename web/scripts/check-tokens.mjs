// Fails the build if a raw hex colour appears anywhere in web/src except styles/tokens.css.
// Allowed: three/LaptopModel.tsx (physical PBR material colours of the aluminium, keys and bezel,
// not UI palette), and mask/gradient alpha stops written as "#000" (alpha only, never a visible colour).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const allowFiles = new Set([path.join(root, 'styles', 'tokens.css'), path.join(root, 'three', 'LaptopModel.tsx')]);
const hex = /#[0-9a-fA-F]{3,8}\b/g;
const bad = [];
for (const f of fs.readdirSync(root, { recursive: true })) {
  const p = path.join(root, f);
  if (!/\.(css|ts|tsx)$/.test(p) || allowFiles.has(p)) continue;
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(hex)) {
      if (m[0] === '#000' && /mask|gradient\(#000/.test(line)) continue; // alpha masks
      if (/url\(#|href="#|id="|'#|"#[a-z]/.test(line.slice(Math.max(0, m.index - 6), m.index + 1))) continue; // anchors and SVG refs
      bad.push(`${path.relative(root, p)}:${i + 1}  ${m[0]}`);
    }
  });
}
if (bad.length) {
  console.error('Raw hex colours outside tokens.css (use a token):\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('check-tokens: no raw hex colours outside tokens.css');
