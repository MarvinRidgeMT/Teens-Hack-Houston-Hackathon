import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/components.css';
import './styles/hero.css';
import './styles/story.css';
import './styles/sections.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// The production build ships prerendered HTML (scripts/prerender.mjs): hydrate it. Dev renders fresh.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
