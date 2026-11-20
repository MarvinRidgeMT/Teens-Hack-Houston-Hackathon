# Pickup download page

One static page: `index.html`, `styles.css`, `assets/`. No build step, no scripts, no trackers, system fonts only.

- **Edit before Saturday:** the `PILOT RESULTS` block (never invent numbers), the `VIDEO` comment (unlisted YouTube id, no autoplay), the `DEVPOST` link, and `assets/install.gif` when Sidd's GIF exists.
- **Download button** points to `https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest`. It only works once the v1.0 release with the zip exists **and** the repo is public.
- **Screenshots** are real: `node test/dev/site-shots.mjs` takes them from the extension in Chrome for Testing.
- **Preview locally:** `python3 -m http.server -d site 8080`, then open http://localhost:8080.

## Custom domain (the hackathon's free .xyz)
1. Register the `.xyz` name with the hackathon's offer (Anish does this; nothing is bought here).
2. At the registrar, add the DNS records GitHub Pages documents for an apex domain: four `A` records to GitHub's Pages IPs (and optionally the `AAAA` ones), plus `www` as a `CNAME` to `marvinridgemt.github.io`.
3. Rename `site/CNAME.example` to `site/CNAME` and put the real domain in it (one line).
4. In the repo: Settings → Pages → Custom domain → the same domain; tick "Enforce HTTPS" once the certificate is ready.
5. Wait for DNS (minutes to a few hours), then open the domain to check.
