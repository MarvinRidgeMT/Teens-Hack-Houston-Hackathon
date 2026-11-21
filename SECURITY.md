# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.1 (latest release) | Yes |
| 1.0.0 and earlier | No. Please update to the latest release. |

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

1. Go to this repository's **Security** tab and click **Report a vulnerability**. This opens a private advisory that only the maintainers can see.
2. Include the Pickup version, your browser and its version, the steps to reproduce, and what an attacker could do.

We'll reply within 7 days and say whether we can reproduce the problem. Once a fix is released, we'll credit you in the release notes, unless you'd rather stay anonymous.

If private reporting isn't available, open an issue titled "Security contact request" with **no details**, and a maintainer will get in touch.

## Security model

Pickup is a Manifest V3 browser extension with no backend. These properties are checked in code:

- **No network requests.** The extension never calls `fetch`, `XMLHttpRequest`, WebSockets, `sendBeacon` or `EventSource`, and loads no remote script, font or image. `test/check-integration.mjs` fails if any of these appear.
- **Local storage only.** Data lives in `chrome.storage.local`. There are no accounts, cookies, servers or analytics. The pilot event log only leaves the computer if the user exports it as a CSV. **Delete all** on the dashboard clears everything.
- **Minimal page data.** Pickup stores what it needs to bring you back: your task's tabs, your place on the page and highlights capped at 200 characters. For distraction sites it keeps only the hostname. It never stores page text.
- **Opt-in site access.** Host access is `optional_host_permissions`. Setup asks the browser for access to the work sites the user lists, and nothing else.
- **On-device voice.** Voice is off by default. Speech recognition only starts with `processLocally = true`, and no audio or transcripts are kept. Pickup's spoken replies come from a bundled Kokoro model running on the device (`src/voice/model/`), which is downloaded once at build time by `scripts/build-voice.sh` and never at runtime.
- **No remote code.** Every library and model is bundled, with its license, in `src/vendor/`, `src/voice/vendor/` and `src/voice/model/`. The extension's content security policy is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. `'wasm-unsafe-eval'` is only there so the bundled ONNX Runtime WebAssembly can run, and no other script source is allowed.

### Why each permission is needed

| Permission | Used for |
|---|---|
| `tabs`, `tabGroups` | Seeing when you leave a work tab, and keeping each task in a named tab group |
| `idle` | Telling a real break from a short pause |
| `alarms`, `notifications` | The single drift nudge, the break timer and the "Start here" reminder |
| `storage` | Saving tasks, notes and the event log locally |
| `scripting` | Showing the return card and park overlay on the work sites you chose |
| `contextMenus` | "Make this my next step" on selected text |
| `sidePanel` | The Pickup panel |

## Repository safeguards

- **CI** (`.github/workflows/ci.yml`) runs `npm test`, `test/check-integration.mjs`, the website's token and contrast checks, its type-check and build, and `npm audit`. It also fails if `site/` doesn't match a fresh build of `web/`. Every workflow runs with read-only repository permissions.
- **CodeQL** (`.github/workflows/codeql.yml`) scans the JavaScript and TypeScript on every push to `main`, every pull request and once a week.
- **Dependabot** (`.github/dependabot.yml`) opens weekly pull requests for the website's npm dependencies and for GitHub Actions.
- **`.gitignore`** blocks `.env` files, private keys (`*.pem`, `*.key`), packed extensions (`*.crx`) and browser profiles.

Never commit API keys, tokens or the `.pem` key used to pack the extension. If one is committed by mistake, revoke it first, then remove it from the history.
