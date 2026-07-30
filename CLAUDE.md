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

## Test commands

```bash
python3 fixtures/validate.py                    # 12/12 expected
python3 fixtures/validate.py RT-schema-final.aura
```

`fixtures/schema-validate.js` is **not runnable from the CLI** — it has no entry point and `node`
is not installed. It is a library for `fixtures/test.html`. Never report it as passing.

Preview (repository-local):

```bash
python3 -m http.server 8791
```

Run it from the repo root, then open http://localhost:8791. That is what `.claude/launch.json` in this
repo does. Note for sandboxed agents: if the dev server cannot read this directory, serve a copy from a
writable temp dir instead — never commit the mirror, and never leave configuration changed outside
this repository.

## Reporting rules

Be factual and restrained. State what was inspected, what changed, what passed, what failed, and
what is still open.

Never write "fully verified" for a simulated check, "real browser tested" for emulation, "complete"
while gates are open, or "offline" without saying which states. Do not mark unavailable hardware
checks (Safari, iOS, Android, physical touch) as passed — they have never been run.

Prefer painted output over `getComputedStyle` when verifying CSS: reads taken inside a transition
return interpolated values and will mislead you.

No celebratory progress essays.
