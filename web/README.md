# Pickup website source

React + TypeScript + Vite + React Three Fiber. Builds static files into `../site/`, which is what gets deployed (GitHub Pages or any static host). Never edit `site/` by hand; edit here and rebuild.

```bash
npm --prefix web install
npm --prefix web run dev      # http://localhost:5173
npm --prefix web run build    # type-check, then write ../site
npm --prefix web run preview  # serve ../site at http://localhost:4173
```

- **Copy and claims:** `src/content/site.ts`. Every claim there is checked against the extension (see `docs/PRODUCT.md`).
- **Before Saturday:** set `PILOT_RESULTS` (Abhinav, real numbers only), `LINKS.videoId` (unlisted YouTube id, no autoplay) and `LINKS.devpost`, then rebuild.
- **Download link** (`LINKS.download`) points to the zip on GitHub `releases/latest`. Attach the zip (`scripts/make-release.sh`) to each new release.
- **3D:** `src/three/`. The laptop is built from primitives in code (nothing to license). Its screens are the real screenshots in `public/assets/shot-*.jpg` inside a drawn browser frame. Phones, no-WebGL browsers and Save-Data get the CSS laptop instead; the canvas stops rendering when off screen.
- **Motion:** GSAP + ScrollTrigger for the opening and the scroll story, Lenis for wheel smoothing (driven by GSAP's ticker), Motion for UI state changes. All of it respects `prefers-reduced-motion`.
- **Screenshots for review:** `node test/dev/web-shots.mjs http://localhost:5173/ <outDir> name:1440x900[:#selector][:dark][:reduce]`.
- **Fonts:** Bricolage Grotesque (via `@fontsource-variable`, OFL) and Inter (`public/assets/fonts/`, OFL), both self-hosted.
