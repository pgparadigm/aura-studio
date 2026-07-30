# Aura Studio — project instructions

## What this is

A static browser music studio **for singers, not producers**.

> Pick a vibe. Get a backing track. Sing.

The journey is: choose how it should feel → Aura builds it → Play → Sing → Record → Export.
A complete beginner must understand what to do in five seconds. It must feel like a private
midnight rehearsal room, never like GarageBand, BandLab or a professional DAW.

Advanced capability is never deleted — it is revealed progressively. Guided Mode is the default;
Studio Mode keeps the full control surface one tap away.

## Architecture — non-negotiable

Public runtime is `index.html`, `styles.css`, `app.js`.

**Approved exception:** local brand assets ship alongside them — `brand/*.svg`, the favicon PNGs,
`favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png` and `site.webmanifest`. They are static
files with no code, no build step and no network access. Nothing else may be added without approval.
The in-app emblem is an inline `<svg>` sprite in `index.html` referenced by `<use>`, so the marks
cost no extra request and work offline and from `file://`.

No framework. No package manager. No build step. No external font. No component library.
No accounts. No cloud requirement. No analytics or telemetry. No CDN. No absolute `http(s)://`
in any runtime file. Core music creation works with no network.

Do not add dependencies. Do not rewrite the app. Preserve existing element IDs and event wiring.

There is no service worker on the shipping line. "Offline" means: no network calls and no account.
It does **not** mean the app survives a hard reload while offline — say it precisely.

## Branches and release

- `main` = the live site at https://pgparadigm.github.io/aura-studio/ (Pages serves `main` at root;
  there is no `gh-pages`). Never commit to `main` directly.
- `v13.0.3` / `eda8f69` is the frozen, deployed baseline and the rollback reference.
- `v14-dev` and `v14-experimental` are **local only and must never be pushed.** Their history
  carries ~13 MB of MusicRNN checkpoint weights (added by `ab7cb29`, deleted by `fb9d049`, never
  rewritten). `v14-experimental` is an *ancestor* of `v14-dev`, so pushing either publishes them.
  The repo's own `tests/qa-provenance.json` records the checkpoint licence as **UNRESOLVED**.
- Do not amend, force-push, move tags, merge to `main`, or deploy without explicit approval.
- **Deploy only when the user says `SHIP`.** Use plain `git push`. Do not use `deploy.py` — its
  commit message is hard-coded to v13.0.3 and it needs a PAT. `gh` is not installed here.
- When shipping, bump `APP_VERSION` (`app.js`) and the `?v=` cache-busters (`index.html`) together.

## Audio invariants — things that fail silently

The scheduler reads the DOM **inside its loop**. Treat these as a hard contract:

- `#bpm` and `#swing` must stay `<input>` elements with numeric `.value`. `secondsPerStep()` and
  `loop()` read them every 25 ms; a non-input yields `NaN`, the lookahead never fires, and the
  transport dies with **no console error**.
- `mountShell()` returns early if `body > header:not(.xport)` is missing — silently removing the
  record button, metronome, readout, Project menu, undo/redo, the More sheet and Export.
- `#navExport` is only created if `.wtabs` exists. Renaming that class removes one-tap mobile export.
- Also read live by audio/export: `#master`, `#autofill`, `#countin`, `#chordVol`, `#bassVol`,
  `#reverb`, `#melVol`, `#vocalVol`, `#sync`, `#monitor`, `#chordStyle`, `#bassStyle`, `#melSound`,
  `#scaleLock`, `#fxRevSize`, `#fxDlyTime`, `#fxDlyFb`, `#fxComp`, `#play`, `#export`, `#grid`.

Do not touch the bus graph (`buildBusses`), the scheduler, `scheduleStepAudio`, or the offline
export graph without a specific reason. Export renders through the *same* graph as playback — that
is why export matches what you hear. Keep it that way.

Do not change the `VIBES`, `BEATS` or `PROGS` musical data unless fixing a verified defect.

## Project format invariants

- `SCHEMA_VERSION = 2`, internal compact state `v:13`. The machine-checkable contract is
  `aura-project.schema.json`; the prose is `AURA_PROJECT_SCHEMA.md`.
- Project identity rules, in full:
  - **Save** preserves `projectId` and `createdAt` and advances only `updatedAt`.
  - **Save As** mints a fresh `projectId` and `createdAt`.
  - **New Project** clears `projMeta`, so its first Save mints a fresh identity.
  - **Open Recent** restores the recent entry's stored `projectId` and `createdAt` when that
    metadata exists. Recents carry a `meta` block in `localStorage` — the `.aura` schema is
    not involved.
  - A legacy recent written before that block existed opens with no identity; its next Save
    mints one, which is correct because there is nothing to resume.
  - Open Recent must **never** inherit the identity of the project open beforehand.
- **Vocal takes and imported audio are never written** to a `.aura` file or a share link.
  `serialize()` has no audio key; `MEDIA_PERSISTENCE` asserts both flags false. Keep it that way.
- Recorded and imported audio live only in memory (`vocalBuffer`, `smp.buf`). There is no IndexedDB.
- The schema stores no vibe identity, so restored projects legitimately have no vibe name.

## Design character

Deep violet-black, quiet, refined. Silver type carries the interface. Only one violet action
dominates at a time. Vibes should read as emotional doors, not presets. Play as obvious as a music
app; Record as direct as Voice Memos.

Colour discipline: violet = brand and structure; **pink is reserved for recording and destructive
actions**; gold is reserved for musical roots and anchors. Never signal state by colour alone —
add a border, a surface change, a checkmark or a glyph.

Type: system stacks only. Nothing meaningful below 12px. Spacing on 4 / 8 / 12 / 16 / 24 / 32
(`--space-1`…`--space-8`).

Touch targets are 44px on phones, ≥40px on desktop.

## Import & rebuild invariants (v13.2)

- **The imported recording is a reference, not a part.** `scheduleSample()` renders into the *offline
  export graph* as well as the live one, so anything audible is in the singer's WAV. On import the
  Sample channel is muted (`mix.sample.mute=1`) and only the card's include control turns it on.
  Never restore an "audible by default" import — it puts someone's copyrighted song in their export.
- **`window.__auraRebuild`** is a deliberate, frozen, read-only test surface exposing the analysis
  functions. `fixtures/import-qa.html` needs it to measure the SHIPPED runtime; there is no Node here.
  Removing it does not fail loudly — the suite reports it and must not be called passing.
- **Timing confidence and instrument confidence are never averaged.** A dependable grid must not be
  able to hide an undependable drum name. Two numbers, both shown.
- **One Aura pattern is ONE bar.** A multi-bar progression cannot live inside one pattern; it takes
  one chord per section slot. Writing chords at steps 0/4/8/12 plays them four times too fast.
- **The analysis object `imp` is never serialised.** Preview edits (lane reassignment, chord changes,
  boundary drags, note keep/drop) live on it precisely so they cannot reach storage before Apply.
- Every apply runs inside `oneCheckpoint()`, and `autosave()` returns early while `applyDepth>0`.
  `transposeMelody`, `resnapMelodies` and `applyBeat` all autosave on their own account.
- Band energies in `spectralFrames` are **mean magnitude per bin**, not sums. The bands differ in
  width by ~40×; summing makes every ratio meaningless.
- Percussion thresholds in `famPresent` were read off measured distributions in the QA suite. If you
  change a band edge or the normalisation, **re-measure them** — do not nudge them by taste.

## Test commands

```bash
python3 fixtures/validate.py                    # 12/12 expected
python3 fixtures/validate.py RT-schema-final.aura
```

Browser suites — serve the repo root, then open each and press its button:

```bash
python3 -m http.server 8791
```

- `/fixtures/import-qa.html` — 19 generated fixtures against the shipped engine. Expected at the
  v13.2 release candidate: timing F **0.909**, lane recall **0.865**, mislabel rate **0**, level
  invariance identical, **15/19** fixtures fully passing. Machine-readable result in `#qa-json` and
  `window.__auraQAResult`.
- `/fixtures/apply-safety.html` — Replace / Fill Empty / undo / Discard against the real runtime.
  Expected **21/21**. Result in `window.__auraSafetyResult`.

Both are deterministic: the audio comes from a seeded PRNG, so a score only moves when the engine
moves. `Math.random()` is banned in `fixtures/qa-audio.js`.

`fixtures/schema-validate.js` is **not runnable from the CLI** — it has no entry point and `node`
is not installed. It is a library for `fixtures/test.html`. Never report it as passing.

Preview (repository-local):

```bash
python3 serve.py
```

`serve.py` resolves the repository from its own location, so it works from any working directory and
binds 127.0.0.1 only. `.claude/launch.json` in this repo points at it.

**Never edit a file outside this repository to run the tests.** The Browser-pane `preview_start` tool
resolves `launch.json` from the PARENT directory, so it cannot see this repo's config — start
`serve.py` and open `http://127.0.0.1:8791/` as a URL. Do not "fix" that by editing the parent config
and do not leave a session-specific mirror path anywhere outside this repository.

## Handoff

`AURA-STATE.md` is the durable state of this work: branch, HEAD, what is verified, the exact next task,
open gates, and the decisions that must not be reopened. **Update it after every commit.** Read it
first in a new session — it is shorter and more current than this file.

## Reporting rules

Be factual and restrained. State what was inspected, what changed, what passed, what failed, and
what is still open.

Never write "fully verified" for a simulated check, "real browser tested" for emulation, "complete"
while gates are open, or "offline" without saying which states. Do not mark unavailable hardware
checks (Safari, iOS, Android, physical touch) as passed — they have never been run.

Prefer painted output over `getComputedStyle` when verifying CSS: reads taken inside a transition
return interpolated values and will mislead you.

No celebratory progress essays.
