# Pickup download page

One static page: `index.html`, `styles.css`, `assets/`. No build step, no trackers, no third-party requests. One optional motion script, `assets/site.js`, runs on local copies of GSAP 3.13 + ScrollTrigger and Lenis 1.3.11 in `assets/vendor/` (smooth scroll, the hero headline's blur-in ported from React Bits' BlurText, a subtle section reveal). It does nothing under reduced motion, and the page is complete without it.

- **Look:** the site's own "Highlighter" palette (last block of `styles.css`): an electric-violet hero, lime/yellow/pink/cyan highlighter fills with ink text, an ink privacy band and a pink demo band, in light and dark. The extension keeps the calmer Sage & Ink palette from `design/`. The Driftbar meadow footer stays. Tokens and component styles are copied into `styles.css` from `src/shared/tokens.css` and `src/shared/pk.css`, so `site/` works on its own. Fireflies and fog move only when reduced motion is off.
- **Font:** Inter, self-hosted in `assets/fonts/` (SIL OFL 1.1, `assets/fonts/OFL.txt`).

- **Edit before Saturday:** the `PILOT RESULTS` block (never invent numbers), the `VIDEO` comment (unlisted YouTube id, no autoplay), the `DEVPOST` link, and `assets/install.gif` when Sidd's GIF exists.
- **Download button** points to `https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest`. It only works once the v1.0 release with the zip exists **and** the repo is public.
- **Screenshots** are real: `node test/dev/site-shots.mjs` takes them from the extension in Chrome for Testing. They still show the old look; `<!-- SHOTS -->` comments mark where redesign screenshots go.
- **Preview locally:** `python3 -m http.server -d site 8080`, then open http://localhost:8080.

## Custom domain (the hackathon's free .xyz)
1. Register the `.xyz` name with the hackathon's offer (Anish does this; nothing is bought here).
2. At the registrar, add the DNS records GitHub Pages documents for an apex domain: four `A` records to GitHub's Pages IPs (and optionally the `AAAA` ones), plus `www` as a `CNAME` to `marvinridgemt.github.io`.
3. Rename `site/CNAME.example` to `site/CNAME` and put the real domain in it (one line).
4. In the repo: Settings → Pages → Custom domain → the same domain; tick "Enforce HTTPS" once the certificate is ready.
5. Wait for DNS (minutes to a few hours), then open the domain to check.
