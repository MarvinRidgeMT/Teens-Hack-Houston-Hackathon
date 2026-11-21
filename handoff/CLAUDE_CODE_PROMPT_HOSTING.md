# Follow-up for the same Claude Code session: go public, host the site, publish the extension

> Paste this into the **same** Claude Code session that's working on `release/v1.0`, after it reports Parts A–D (or now, and it will queue this after them). The team has decided: **the repo becomes public and the site is hosted on GitHub Pages.**

---

**Part E: host the website and publish the extension.** Decision from Anish: make `MarvinRidgeMT/Teens-Hack-Houston-Hackathon` **public** and host `site/` on **GitHub Pages**; the extension zip ships as GitHub release **v1.0.0**. Target: **everything live and checked by 1:45 PM ET**. Do the steps in order. Wherever it says **ASK**, stop and wait for my yes.

Invoke and follow these skills:
- `superpowers:verification-before-completion`
- `modern-web-guidance:chrome-extensions` (release zip)
- `engineering:deploy-checklist`, if available

Use `gh` for GitHub. If `gh auth status` fails, or the token is missing the `repo` or `workflow` scopes, tell me the exact command to run (`gh auth login` / `gh auth refresh -s workflow`) and wait.

### E1. Pre-public audit (before anything becomes visible)
1. **Secrets across all history:**
   - run `gitleaks detect --source . --log-opts="--all"` if it's installed;
   - otherwise grep `git log -p --all` for keys, tokens, passwords, private keys and `.env` contents, using these patterns: `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `sk-[A-Za-z0-9]{20,}`, `-----BEGIN .*PRIVATE KEY-----`, `(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}`.
   - **Any real hit is a blocker:** stop and tell me. Don't rewrite history without asking.
2. **Files that shouldn't be public:**
   - list tracked files over 5 MB;
   - any tracked `.env`, Chrome profile folders or `*.crx`/`*.pem`;
   - personal data: participant CSVs with real browsing URLs, emails, anyone's address or phone. The pilot CSVs contain visited URLs, so **ASK** before they become public; if they should stay private, move them out of the repo and summarise them in docs instead;
   - internal notes that name people unkindly or contain anything embarrassing.
3. **Licence:** there's no `LICENSE` file. **ASK** me which one; suggest MIT for our code and keep third-party notices (fonts OFL, Motion and Anime.js MIT, three MIT, GSAP's licence as in `node_modules/gsap`, any model attribution from `docs/v4/LAPTOP.md`) in `README.md` "Credits".
4. **Untracked working files:** make sure `handoff/` prompts and `Claude outputs/` are either intentionally tracked or ignored. Ask if unsure.
5. Report the audit in ≤ 8 lines.

### E2. Land the release branch
1. Finish Parts A–D: tests green, gate run 19 logged, README done.
2. **ASK:** "Merge `release/v1.0` into `main` and push?" On yes, merge (no force), push, and confirm that `origin/main` = the local `main`.

### E3. Make the repo public
1. **ASK:** "Ready to make the repo public?" (Sidd and Abhinav have agreed, per Anish.)
2. On yes, run `gh repo edit MarvinRidgeMT/Teens-Hack-Houston-Hackathon --visibility public --accept-visibility-change-consequences`.
3. **If it fails with a permission error,** Anish isn't an admin of `MarvinRidgeMT`. Tell me exactly who must do it, with the exact click path: repo **Settings → General → Danger Zone → Change visibility → Public**. Wait.
4. Check: `curl -sI https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon` returns 200 without login.

### E4. GitHub Pages from `site/`
1. Add `.github/workflows/pages.yml`, using only the official actions, with:
   - triggers: `push` to `main` (paths `site/**` and the workflow file) and `workflow_dispatch`;
   - `permissions: { contents: read, pages: write, id-token: write }`;
   - `concurrency: { group: pages, cancel-in-progress: true }`;
   - a job running `actions/checkout`, `actions/configure-pages`, `actions/upload-pages-artifact` (path: `site`) and `actions/deploy-pages`.
   - Pin the current major versions; check them in the docs.
   - Show me the file, then commit and push it (the token needs the `workflow` scope).
2. Enable Pages with the workflow as source: `gh api -X POST repos/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/pages -f build_type=workflow`. If it already exists, use `-X PUT`.
3. Run it (`gh workflow run pages.yml`, or the push triggers it) and wait (`gh run watch`).
4. The URL should be `https://marvinridgemt.github.io/Teens-Hack-Houston-Hackathon/`. Read the real URL from `gh api repos/…/pages --jq .html_url`.
5. **Verify the live site, really:**
   - `curl -sI` the page, the main JS, the CSS, the lazy 3D chunk and a font: all 200, with the right content types;
   - then open it in an **isolated** Chrome for Testing profile at 1440 and 375: no console errors; the 3D laptop loads (or its static fallback); fonts render; anchors work; reduced motion works (emulate it).
   - Screenshot it to `docs/v4/after/live-1440.png` and `live-375.png`.
   - Vite uses `base: './'`, so the sub-path should work. If any asset 404s, fix the path and redeploy.

### E5. Publish the extension (release v1.0.0)
1. Build the zip with `scripts/make-release.sh` from the **merged `main`**. It holds only `manifest.json`, `src/` (no dev or spike files) and `assets/`; no `test/`, `web/`, `site/`, `docs/`, `design/`, `handoff/`, dotfiles or package files.
2. Check the zip:
   - unzip it into a temp folder and load it unpacked in a fresh Chrome for Testing profile;
   - the setup page opens on install;
   - smoke-test the loop: start task → park → leave → return → card → Resume;
   - no errors in the service worker or the page;
   - `node test/check-integration.mjs` passes against the unzipped folder;
   - record the zip's size and SHA-256.
3. **ASK:** "Tag `v1.0.0` and publish the release?" On yes:
   - run `git tag -a v1.0.0 -m "Pickup v1.0.0"` and push the tag;
   - run `gh release create v1.0.0 pickup-v1.0.0.zip --title "Pickup v1.0.0" --notes-file docs/RELEASE_NOTES.md --latest`.
   - The notes cover: what it is, the 4-step install, both shortcut sets (Mac ⌃⇧P/⌃⇧R/⌃⇧V; Windows/Linux/ChromeOS Alt+P/R/V), "Works on", privacy, limits, and the zip's SHA-256.
4. Check without logging in:
   - `curl -sIL https://github.com/MarvinRidgeMT/Teens-Hack-Houston-Hackathon/releases/latest/download/pickup-v1.0.0.zip` ends in 200 with `application/zip` (or octet-stream), and the size matches.

### E6. Point the site at the real download and redeploy
1. In `web/src/content/site.ts`, make the primary **Download PickUp** link the direct asset `…/releases/latest/download/pickup-v1.0.0.zip`, with a secondary "All releases" link to `…/releases/latest`.
2. Remove any "no release yet" state, now that the release exists.
3. Add the live site URL to `README.md`, then rebuild `web/` → `site/`, commit, push, and let Pages redeploy.
4. Re-check E4.5 on the live URL, and click Download in the test profile. The file must arrive and match the SHA-256.

### E7. The judge's path, end to end (live)
In a brand-new Chrome for Testing profile, with nothing local:
1. open the live site;
2. click Download;
3. unzip;
4. open `chrome://extensions`, turn on Developer mode, Load unpacked;
5. complete setup;
6. on the dashboard, use **Load sample data**: the dashboard fills, with the sample banner;
7. run one real park → leave → return → Resume.

Screenshot each step to `docs/v4/after/judge-path-*.png`. Log it as **run 20 (live)** in `test/REAL_CHROME_LOG.md`, then commit and push the log.

### E8. Optional: custom domain (only if I say I've registered the free .xyz domain)
If I give you a domain, then:
- add `site/CNAME` (via `web/public/CNAME`, so it survives builds);
- run `gh api -X PUT repos/…/pages -f cname=<domain>`;
- tell me the exact DNS records to add at the registrar: `CNAME www → marvinridgemt.github.io`, plus the apex A records GitHub documents (185.199.108.153, .109, .110, .111);
- after DNS resolves, turn on "Enforce HTTPS".

Otherwise skip E8.

### E9. Final report (≤ 12 lines)
- **Live URLs, each checked with its HTTP status:** website, repo, release page, direct zip download.
- Zip size and SHA-256.
- Test runs 19 and 20 results.
- Screenshots (paths).
- Anything still needing a human: the Mac shortcut check on Anish's Mac, the video link, Devpost.
- **A ready-to-paste "Links" block for Devpost:** website, GitHub repo, download, plus a slot for the demo video.
