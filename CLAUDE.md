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

- **The music-knowledge layer ships as `knowledge/*.js`** — five modules loaded by ordinary script
  tags before `app.js`. Approved exception to the three-file runtime rule, and they are in
  `make-release.py`'s allow-list. They must NOT be fetched: `fetch()` on a `file://` URL fails in
  every browser, and Aura has to work after being downloaded.
- **Book II knowledge is dated research, not fact.** Every entry drawn from it sets `volatile:true`
  and its `verified` date, and `K.freshness()` is the single place that formats the re-verify
  caveat. Craft knowledge carries no date because where a kick sits does not expire.
- **The kick on the floor is not adjustable.** `grooveBeat()` writes steps 0/4/8/12 unconditionally
  and never drops the downbeat. Three suites assert it at 82, 92 and 100 BPM across six section
  roles. If a control could move it, it would stop being this style.
- **Idea Codes are fixed-width base-36**, two characters per control. One character breaks silently
  the moment a value exceeds 35, because the body length then varies with the settings and the
  decoder mis-parses it.
- `SCHEMA_VERSION = 3`, internal compact state `v:13`. The machine-checkable contract is
  `aura-project.schema.json`; the prose is `AURA_PROJECT_SCHEMA.md`.
- **The number written into a file is the minimum reader version that file needs**, not the newest
  this build knows — `requiredSchema()` returns 2 for a project using none of the v13.3 blocks so
  the deployed 13.2.0-rc.1 can still open it, and 3 for one that uses any of them so 13.2 refuses
  rather than opening it, dropping the block and writing the loss back on the next Save.
- **Every new compact key MUST get a `READ_MAP` entry.** `toReadable` passes an unmapped key
  through, but `fromReadable` copies only keys present in `READ_INV` — so a key without an entry is
  written to every `.aura` file and silently dropped on read. `lo`, `var` and `perf` were lost that
  way for four commits while autosave looked perfect, because autosave carries the compact state and
  never goes through the mapping.
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

## Take editing invariants (v13.5)

- **The recording is never modified.** Editing produces a clip list — `from`/`to` in RECORDING
  seconds, `at` in TIMELINE seconds, plus gain, fades and a tape `rate`. `take-qa` hashes the
  buffer's samples before and after a session of edits and requires them identical.
- **A clip has TWO clocks and confusing them is the hazard.** `start(when, offset, duration)` takes
  its duration in BUFFER seconds — the spec scales it by `playbackRate` on the way out. Everything
  that measures a clip's TIMELINE length goes through `takeOutLen()`; anything that indexes the
  recording uses `to - from` directly. Turning a timeline position into a buffer edge scales BY the
  rate.
- **`at` carries no latency correction.** Monitoring latency and the sync slider are live,
  per-machine values; baking them into clip data would freeze one machine's timing into the edit.
  The scheduler applies them, which is also why an unedited take is placement-identical to 13.4.
- **One scheduler.** `scheduleTakeClips()` serves live playback AND the offline export. Two
  schedulers is how an export stops matching what the singer auditioned.
- **Clips are NOT serialised, deliberately.** They describe positions inside a memory-only buffer,
  so persisting them would restore an edit list pointing at nothing. They also get their own
  in-memory undo, because the project's undo stack is built from `serialize()` and cannot see them.
- **Take speed is TAPE speed.** Pitch and speed move together. No time-stretcher is bundled and the
  panel says so. Do not add one that claims to be transparent.
- **A crossfade is COMPUTED from the overlap, never stored.** It is a relationship between two
  clips; a stored number goes stale the moment either is dragged. Each side gets HALF the overlap
  because both ramp, and it is equal-gain — the two parts are the same voice a moment apart, so
  they correlate and equal-power would bulge. It applies only where it is LONGER than a fade the
  singer typed.
- **The level envelope is stored as FRACTIONS of the clip**, not seconds, so trimming or
  re-speeding carries the shape instead of stranding the points off the end. Capped at 8 points.
  Fades and envelope multiply into ONE curve on ONE gain node, sampled at both their corners.

## Sound-slice invariants (v13.6-rc.2)

- **The slice list is always contiguous and always covers the whole sound.** `sndSlicesFromCuts()`
  is the single place that builds it, and every operation goes through it.
- **A boundary too close to its neighbour is DROPPED — never the segment.** Skipping the segment
  leaves the next slice starting at its own cut, which opens a hole: the list stops covering the
  sound and the singer loses audio they can still see. This shipped that way briefly and `take-qa`
  caught it.
- **Boundary 0 is immovable and unremovable.** Slice 1 always starts at the beginning of the sound.
- The cut operations work on a derived **cut list**, not on the `{start,end}` pairs — a boundary is
  shared between two slices, and editing the pairs makes it easy to move one side only.
- The waveform canvas sizes from its **painted box**, and its redraw hangs off the tab listener at
  `app.js:10449`. `sndFindSlices()` draws while the Sound view is still closed, so without that
  hook the canvas keeps the markup's default size forever.

## Arrangement invariants (v13.6)

- **The operations work on RUNS, not slots** — `songResize`, `songMoveBlock`, `songDuplicate`,
  `songRemoveBlock`, `songSplitBlock`. Each runs inside `oneCheckpoint()` and ends with
  `renderAllSlots()`, because the timeline is a VIEW onto `song` and the 13.4 defect was six sites
  that re-rendered only the slot strip.
- **The song is 32 bars and always will be.** Growing a part takes its bars from the neighbour;
  swapping preserves total length; duplicating drops anything past bar 32 rather than wrapping.
- **Splitting needs a FREE section slot** and there are only `N_PATTERNS`. When none is free the
  control is disabled with the reason on it — it used to be enabled and silently do nothing, which
  this file already calls worse than a missing feature.
- The waveform is a canvas: **a canvas in a hidden view has no box to draw into.** Redraw is hooked
  to the tab listener at app.js:10449 — the one the file itself documents as "provably fires on
  every tab press, which showView does not".

## Design character

Deep violet-black, quiet, refined. Silver type carries the interface. Only one violet action
dominates at a time. Vibes should read as emotional doors, not presets. Play as obvious as a music
app; Record as direct as Voice Memos.

Colour discipline: violet = brand and structure; **pink is reserved for recording and destructive
actions**; gold is reserved for musical roots and anchors. Never signal state by colour alone —
add a border, a surface change, a checkmark or a glyph.

`[hidden]{display:none!important}` sits near the top of `styles.css` and must stay there. The UA
sheet's `[hidden]{display:none}` loses to any rule that sets a display, so `.thing{display:flex}`
silently un-hides a panel the JS toggles with `el.hidden`. Two shipped that way.

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
- A decode is not the same as a usable import. `decodeAudioData` is tolerant: a WAV promising two
  seconds with 400 bytes of payload returns **2 ms** and reports success. `MIN_MEDIA_SECONDS` exists
  because of that; do not remove it.
- The import is guarded by `impJob`, a generation counter checked at **every await**. Cancellation is
  cooperative — `decodeAudioData` cannot be aborted and `analyseImport` is one synchronous pass — so
  a late cancel discards the result rather than interrupting the work. Anything that replaces the
  whole project must call `cancelImportJob()`; `applyState()` already does.
- The vocal mask uses the **real part** of `L·conj(R)`, not its magnitude. The magnitude cannot tell
  +1 correlation from -1, so anti-phase (maximally wide) material scored as dead centre and was
  destroyed by the mode meant to keep it. Measured at -46 dB before the fix.
- Every named family control must change real project data. Four of the thirty did not, and
  `fixtures/endtoend-qa.html` now moves each control from 10 to 90 and fails if `serialize()` is
  unchanged. A knob that does nothing is worse than a missing feature.
- Lane-restoring family controls read `FAM_BEAT[fam]`. Two hand-written conditionals resolved the
  wrong family's beat, which silently restored an empty lane set.

## Test commands

```bash
python3 fixtures/validate.py                    # 13/13 expected
python3 fixtures/validate.py RT-schema-final.aura
```

Browser suites — serve the repo root, then open each and press its button:

```bash
python3 serve.py
```

- `/fixtures/import-qa.html` — 19 generated fixtures against the shipped engine. Expected: timing F
  **0.9091**, lane recall **0.8649**, mislabel rate **0**, level invariance identical, **15/19**
  fixtures fully passing. Machine-readable in `#qa-json` / `window.__auraQAResult`.
- `/fixtures/apply-safety.html` — Replace / Fill Empty / undo / Discard. Expected **21/21**.
- `/fixtures/layout-audit.html` — 17 viewports (width AND height). Expected **0 findings**.
  `__auraLayoutSweep(4)` self-drives it; poll `__auraSweepState`.
- `/fixtures/media-decode.html` — 14 media fixtures through the real `loadSampleFile()`. Expected
  **13 as specified, 0 wrong, OGG not generatable**. Run `python3 fixtures/make-media-fixtures.py`
  first if `fixtures/media/` is missing.
- `/fixtures/cancel-safety.html` — 18 interruption paths. Expected **15 pass, 3 N/A**.
- `/fixtures/vocal-qa.html` — 14 vocal mixes. Expected **all six gates pass**.
- `/fixtures/endtoend-qa.html` — reference, sampler, families, persistence, export. Expected **38/38**.
- `/fixtures/pathb-qa.html` — Expected **10/10 low end, 19/19 lifecycle**.
- `/fixtures/midi-qa.html` — Expected **22/22 virtual**; the physical matrix stays OPEN.
- `/fixtures/performance-qa.html` — Expected **29/29**.
- `/fixtures/guide-qa.html` — Expected **34/34 intents, 21/21 context, safety and privacy**.
- `/fixtures/persistence-qa.html` — Expected **43/43**, including sixteen malformed-project cases.
- `/fixtures/export-qa.html` — Expected **28/28**. Renders through the shipped offline graph.
  Covers both halves of the automation contract: mute moves AND level moves reach the file, the
  direction performed is the direction rendered, and an export does not leave the mixer where the
  replay put it.
  ONE render per measurement: exports are deterministic, so averaging four was 44 renders for
  no added rigour and a suite nobody would wait for. Repeated `OfflineAudioContext` renders
  stall this Electron build after hours of suites, which looks like a hang and is not one.
- `/fixtures/undo-redo-qa.html` — Expected **5/5**. One Apply is one undo, in the project AND in
  the exported audio. Deliberately its own suite: inside a longer run the import's async tail makes
  it flaky, and the same sequence gave three different answers across three runs.
- `/fixtures/music-knowledge-qa.html` — Expected **95/95**. Proves the master document became
  behaviour: the three unbreakable groove rules across three tempos and six section roles, Idea Code
  round trip and determinism, Architect, all thirteen transitions, Emotion Map in both directions,
  Mix Check, syllables in English and Spanish, Vocal Coach with no health advice, intention
  persistence, rights blocking on an unknown source, export contents, Finish stages, 23 Guide
  phrasings, and the four things that must never be in the product — artist names, network calls,
  absolute URLs, and any claim to be a generative AI. Also Find a sound (the audition sets the
  shipped voice and mixer, nudges accumulate, re-picking resets, the limit is announced) and
  Create something (one checkpoint, reproducible including Surprise me, no new tab) — and that
  **New Project carries none of the seven v13.3 blocks forward**.
- `/fixtures/take-qa.html` — Expected **66/66**. The take edit list, crossfades, the level
  envelope, and the arrangement operations. Most assertions are measured
  from a **rendered export**, not from the model — an editor whose edits show on screen but are
  absent from the WAV is worse than no editor. It isolates the vocal by rendering twice, with and
  without the recording, and subtracting; it empties the arrangement first so each render is seconds
  rather than the ~25s a seeded project costs, and it renders the take-less baseline once.
- `/fixtures/a11y-qa.html` — Expected **37/37**. Structure only. **Never report it as a
  screen-reader test** — VoiceOver and TalkBack have never been run.
- `/fixtures/run-all.html` — runs every suite in sequence. This is the one that proves a suite's
  result does not depend on which suite ran before it.

**Every suite must call `AuraQAReset.blankAndClear(frame, sleep)` before booting the app.** The app
restores its autosave at boot, so swapping the iframe `src` is not isolation — `apply-safety.html`
failed a real assertion purely because `a11y-qa.html` had run first and left a variation behind.
Pass the suite's own Worker-backed `sleep`; the plain-`setTimeout` fallback appears to hang forever
in a hidden tab.

**Exports are deterministic and must stay that way.** `getNoise()` and `makeIR()` are seeded with
mulberry32. They used `Math.random()`, and since both cache per `AudioContext` while every export
builds a fresh `OfflineAudioContext`, one unchanged project exported to a different file every time
— 0.59 dB of RMS spread. Seeded noise is audibly identical and makes every export assertion mean
something.

**Every browser suite uses Worker-backed timers, and the layout audit calls `__auraSettleNow`.**
A hidden tab pauses `requestAnimationFrame` and throttles chained `setTimeout` to roughly one per
minute after five minutes. That does not merely slow a suite down — it measures unfitted layouts and
makes "click, wait, read" checks fire at unpredictable points. One spurious apply-safety failure was
traced to exactly this. Do not replace those timers with plain `setTimeout`.

Every suite is deterministic: the audio comes from a seeded PRNG, so a score only moves when the
engine moves. `Math.random()` is banned in `fixtures/qa-audio.js` and in the vocal fixtures.

`fixtures/schema-validate.js` is **not runnable from the CLI** — it has no entry point and `node`
is not installed. It is a library for `fixtures/test.html`. Never report it as passing.

Preview (repository-local):

```bash
python3 serve.py
```

`serve.py` resolves the repository from its own location, so it works from any working directory and
binds 127.0.0.1 only. `.claude/launch.json` in this repo points at it.

`serve.py` is **threaded**. Single-threaded it deadlocks `media-decode.html`, whose page fetches
fixtures while its iframe is still pulling `app.js` — one request in flight at a time turns that into
`TypeError: Failed to fetch`.

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
