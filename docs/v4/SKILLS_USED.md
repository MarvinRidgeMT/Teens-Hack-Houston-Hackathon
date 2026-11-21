# V4 tool and skill ledger

One row per use. "unavailable" rows record what could not run and why.

| Time (ET) | Tool / skill | Command or call | Purpose | Output / decision |
|---|---|---|---|---|
| 10:12 | shell | `git fetch`, `git rev-parse origin/main` | Record start SHA | `origin/main` = `46dabed4fa9f8364a524c6ed500c7985f3875a50` |
| 10:12 | shell | `ls design/v4-refs` | Read reference screenshots | Folder empty. Anish chose: proceed from the prompt's written failures and constraints |
| 10:14 | AskUserQuestion | scope, refs, pilot data | Settle open decisions | Website + extension; no ref screenshots; Evidence gets a marked slot (no pilot numbers in repo) |
| 10:16 | git | `checkout -b redesign/v4 46dabed`, `tag pre-v4` (local, not pushed) | Checkpoint | Branch `redesign/v4`, tag `pre-v4` |
| 10:16 | npm / node | `npm test`, `node test/check-integration.mjs`, `npm --prefix web run build` | P0 baseline | All green: 69 contrast, engine, voice, panel, features pass; integration 0 fail 0 warn; web build OK |
| 10:18 | test/dev/web-shots.mjs (Chrome for Testing, headless) | 7 shots of v3 | Before record | `docs/v4/before/*.png` (1440 and 375) |
| 10:18 | Blender | `/Applications/Blender.app/Contents/MacOS/Blender --version` | Check 3D tool | Blender 5.3.0 available (headless CLI) |
| 10:18 | Impeccable CLI | `impeccable --help` | Check real command names | `detect`, `ignores`, `world`, … (critique/audit/polish are skill workflows, not CLI verbs) |
