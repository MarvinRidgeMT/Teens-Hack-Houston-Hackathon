// Runs after `vite build`: builds the SSR entry, renders <App/> to HTML and injects it into
// site/index.html inside #root, so the hero text is the first paint (LCP) instead of waiting for JS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(web, 'node_modules', '.prerender');
await build({ root: web, logLevel: 'warn', build: { ssr: 'src/entry-server.tsx', outDir: tmp, emptyOutDir: true, copyPublicDir: false } });
const { render } = await import(pathToFileURL(path.join(tmp, 'entry-server.js')).href);
const html = render();
const file = path.resolve(web, '../site/index.html');
const page = fs.readFileSync(file, 'utf8');
if (!page.includes('<div id="root"></div>')) throw new Error('site/index.html has no empty #root to fill');
fs.writeFileSync(file, page.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`prerender: injected ${(html.length / 1024).toFixed(1)} KB of HTML into site/index.html`);
