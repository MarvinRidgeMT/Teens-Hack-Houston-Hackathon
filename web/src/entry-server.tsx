// Build-time prerender: renders the page to HTML so text paints before any JavaScript runs.
// scripts/prerender.mjs injects the result into site/index.html; main.tsx hydrates it.
import { renderToString } from 'react-dom/server';
import { App } from './App';

export function render(): string {
  return renderToString(<App />);
}
