# QA runner: the dashboard checks in Chromium and WebKit

`qa/run.cjs` drives the in-page checks (`qa/dashboard-{a,b,c,d,e}.qa.js`) in real browsers, Playwright's
Chromium and WebKit, one FRESH browser context per job (empty storage, as every suite expects), at the
viewport each job names. The checks run inside the page, against the shipped `/rc/` build.

```bash
node qa/run.cjs
```

Useful flags:

| Flag | What it does |
|---|---|
| `--engines chromium,webkit` | which browsers (both by default) |
| `--jobs gate,a,b,c,d,e` | which suites (all by default); `gate` is the ship gate |
| `--only <text>` | only jobs whose id contains the text |
| `--skip <text>` | leave out jobs whose id contains the text (the live run skips `e2ExportJitter`, which needs `/rc-base/` on the same origin) |
| `--snapshot` | serve a frozen copy of `rc/` and `qa/` taken at start, so a long run tests one build while you edit |
| `--base-root <dir>` | an older build (a directory holding its `rc/`) for the `base: true` comparisons, also served at `/rc-base/` |
| `--rc-root <dir>` | serve `/rc/` from `<dir>/rc`: pass the directory that HOLDS `rc/`, as with `--base-root` (a mutated copy, for mutation testing; passing `…/rc` itself 404s the app and every check "fails" on a dead page) |
| `--base <url>` | run against a published site instead of the local server (for example the live root) |
| `--out <file>` | write every result, with its evidence, as JSON |

An older build for comparison: `git archive f304607 rc | tar -x -C <dir>`.

## What the runner does for every job

- **A real gesture first.** WebKit will not start an AudioContext without one, so the runner clicks a point
  on the page that is not a control.
- **Audio jobs check the clock.** A job marked `audio` first starts a bare AudioContext and measures its
  clock: it waits up to 2 s for the clock to begin, then measures its rate. If it never begins or runs
  under half speed, the job is **NOT RUN** with that evidence, never a pass and never a failure. (A fixed
  window once misread a late WebKit start, 0.142 s of 0.4 s, as frozen; that is why it measures a rate.)
- **Network law, live.** Every request to a host other than the local server (or the `--base` site) is
  counted per job and printed.
- **One warm-up load per engine** before its jobs. WebKit's first navigation after launch once took over
  30 s; that is the harness's cost, not a check's.
- **Multi-step jobs.** A `setup` step (such as loading the demo arrangement) must succeed or the job fails
  with that reason; `reload` reloads the page keeping storage.
- **`base: true` jobs** run on both builds and pass only when both pass and their `key` is identical.
- **A check that cannot tell** in a run returns `notRun: true` with its reason and is reported **NOT RUN**, never
  a pass. Only `e7ExportLatency` does this: when Chromium reports its output latency before the check can read
  it, the natural race it measures did not happen. `e7ExportLatencyHeld` covers that case in both engines.

## Installing Playwright here (done 2026-09-25, audited)

Playwright is not a project dependency. Only `playwright-core` is installed, from an audited tarball, into
`~/.local/share/aura-qa` (outside iCloud); the runner finds it there (`AURA_QA_PW` overrides the path).
Browsers: `chromium-headless-shell` and `webkit` in `~/Library/Caches/ms-playwright`.

The `playwright` and `playwright-core` npm packages carry an agent surface (three `SKILL.md` files, agent
and prompt templates, and `reinstall_*` scripts that delete and reinstall `/Applications/Google Chrome.app`).
`playwright` is not installed at all; from `playwright-core` the skills and the installer scripts were
removed after hashing. The audit is `~/.local/share/aura-qa/.audit-2026-09-25.json`, the firing record
`Records/Firings/2026-09-25__microsoft-playwright.md`. Never run `install --skills`, `install-skill`,
`init-agents`, or `install chrome|msedge`.

## What a green run does not establish

- How anything sounds. A meter can read correctly and a mix still sound wrong.
- A real finger or pen, and real trackpad behaviour: the checks dispatch pointer, wheel and key events.
- Safari itself: this is Playwright's WebKit build (26.6), close to Safari but not Safari.app.
- The human timing in `e6Novice` is a stated model (1.2 s to find the button, 1.8 s to read, 1.0 s to aim,
  about 0.4 s to drag); the analysis times in it are real.
