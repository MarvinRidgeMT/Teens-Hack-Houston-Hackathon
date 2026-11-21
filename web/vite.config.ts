import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the static download site into ../site (deployable as plain files, e.g. GitHub Pages).
// Relative base so it works from a sub-path or a file server.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../site',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1100, // the lazy 3D chunk; it never loads on first paint
  },
  server: { port: 5173, strictPort: true },
});
