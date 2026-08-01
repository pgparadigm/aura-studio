# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand

| | |
|---|---|
| Branch | `v13.3-complete-studio` (new work) |
| HEAD | `8f90ddc` — *the manifest counts the device rows instead of asserting a stale 69* |
| Working tree | clean |
| `APP_VERSION` | `13.3.0-rc.1` — bumped, together with every `?v=` cache identifier in `index.html` |
| `SCHEMA_VERSION` | `3` — and files are stamped with the **minimum reader version they need**, not the newest the writer knows. `serialize()` is **31 keys**: the v13.2 twenty-five plus `lo`, `var`, `perf`, `gv`, `ly`, `pi` |
| Release status | **local RC complete** — code, suites, documentation and artefacts all done and consistent. **NOT deployed, NOT tagged, NOT pushed.** The live site stays on 13.2.0-rc.1 |

### LIVE, and not to be touched by this work

`main` `e20155f` serves https://pgparadigm.github.io/aura-studio/ at `13.2.0-rc.1`.
Source of that release: `v13.2-import-rebuild` `3c4759b`, tag `v13.2.0-rc.1`.
**No deployment is authorised during this pass.** The previous RC stays online as-is.

### Commit chain on v13.3-complete-studio

```
587e620  music-knowledge suite covers both new features and the New Project leak: 86/86
cbf76ba  Find a sound and Create something, and seven blocks that leaked into New Project
c82e63e  the regression earned its keep: three stale key counts and a shadowed Guide
1296a2f  music-knowledge QA: 63 checks, and it caught an artist name in the shipped app
56af5e7  Guide craft intelligence, Tool Router, and Finish the record
51d3dbe  Rights & Sources, and the complete project export nobody ships
9c4c2c6  Project intention, and persistence for everything the knowledge layer adds
5c58867  nothing is left behind an inaccessible surface
da13f47  Lyric and Topline Studio, and a Vocal Coach that reads the project
33cddd6  Song Architect, Transition Designer, Emotion Map and Mix Check
79c4685  reggaetón groove builder: the rules as musical logic, not a preset
47bac2c  music knowledge: a capability ledger, and knowledge Aura can act on
3071acb  the last four from the review: scope, count-in, clamping, and an honest promise
2d9119c  six more from the review: wrong audio, spent undo steps, and a live microphone
c3704c1  state: record the twelve confirmed review findings that are still open
657422b  a loaded reference is never un-muted except by the singer
24c329e  export-qa verified: 24/24, with the measured numbers
20e7524  export suite: one render per measurement, not four
58ce7c8  state: record export-qa's count as not re-verified, and why
2eb47f3  undo and redo get their own suite, because inside a long run they lie
8b389b0  export suite: run the reference in/out checks after undo/redo
13ffad5  a cancelled import no longer edits the project, and exports are reproducible
3c8136e  accessibility, and the round trip that was eating people's work
fde6e61  Aura Guide: offline structured guidance, and it says so
641a128  Perform view and live-arrangement recording, on one shared action layer
40caa84  DJ controller: Web MIDI, mappings and MIDI Learn
4ec3281  Add as variation: a dedicated `var` block, not a duplicated project
c430394  editable low-end reconstruction, generated from the analysis
6b73976  import paths named, and a tempo decision before Apply
3c4759b  <- branched from the frozen 13.2.0-rc.1 source
```

---

## What is DONE in this pass

1. **Three named import paths** — Analyze only / Rebuild with Aura / Adjust the original.
   Rebuild is the default. Analyze renders **zero** Apply buttons and mutates nothing.
2. **Tempo decided before Apply** — detected / keep / half / double / another. Every Apply calls
   `applyChosenTempo()` first, inside the same checkpoint. Fixed the live defect where analysis
   read 100 BPM and the reconstruction applied at a stale 140.
3. **Low-end analysis + original bass part** — `detectLowEnd()`, section-aware generation, editable
   note chips, `lo` schema key.
4. **Add as variation** — a dedicated `var` block, scoped capture/restore, one-op-one-undo.
   Not six more Song slots, and not a duplicated project.
5. **DJ controller** — Web MIDI, generic-first, MIDI Learn, mappings in `localStorage` (never in
   `.aura`). No vendor hard-coding, no hardware identity stored anywhere.
6. **Perform view + live-arrangement recording** — 22 normalised actions behind one `runAction`
   dispatch shared by the screen, the controller and the recorder.
7. **Aura Guide** — offline, rules-based, context-aware, Understand → Preview → Confirm → Apply.
   Never labelled generative AI. History is not persisted and never enters `.aura`.
8. **Accessibility** — 36/36 automated. Semantics, names, groups, live regions, dialog + focus
   trap and restoration, contrast, confidence in words. **Not a screen-reader test.**
9. **Persistence and schema 3** — 43/43, including sixteen malformed-data cases.
10. **Export verification** — dedicated suite through the shipped offline graph.
11. **Music-knowledge integration** — `AURA-MUSIC-KNOWLEDGE-INTEGRATION.md` dispositions every Part
    1–34 of the attachment, including ten explicit exclusions. Knowledge ships as `knowledge/*.js`
    (five modules, 39 entries, ordinary script tags — never fetched, because `fetch()` fails on
    `file://`). Book II entries carry `volatile:true` and a `verified` date; craft entries do not,
    because where a kick sits does not expire.
12. **Groove Builder** — the three unbreakable rules as musical logic, not a preset. Idea Codes are
    fixed-width base-36, two characters per control.
13. **Song Architect, Transition Designer, Emotion Map, Mix Check** — all inside Song, no new tabs.
14. **Lyric & Topline Studio and Vocal Coach** — over the singer's own words, English and Spanish
    syllables. No lyric generation, no health or medical advice.
15. **Project intention, Rights & Sources, complete project export, Finish the record.**
16. **Find a sound** — twelve families browsed by feeling, each one Aura's own synthesis with a plain
    descriptive name. The audition sets the **real** melody voice and the **real** mixer, so what you
    hear is what you get. Warmer/wider/darker accumulate; pressing the family again returns it to
    base; the card says when a control has hit its limit instead of reporting success. The saved
    family rides in `gv.sf` and counts toward `requiredSchema`.
17. **Create something** — four questions (lane, tempo feeling, mood, starting point) that write a
    complete editable version inside **one** checkpoint. Reproducible, including *Surprise me*,
    which picks from the seed rather than at random. Opens from the vibes strip and the welcome —
    it is not a fifteenth tab.
18. **New Project no longer carries the last song forward.** It cleared patterns, mixer and
    automation but none of the seven v13.3 blocks: groove, groove seed, saved sound, lyrics,
    performance notes, intention and the rights ledger. The lyrics and the intention were then
    written into the next `.aura` the singer saved; the rights ledger was wrong the other way,
    reporting imported audio a blank project did not hold.

## What is NOT done

Everything that can be done on this machine is done. What remains needs hardware or a person:

- Physical gates, all 77 rows of `DEVICE-CHECKLIST.md`, **none run**: a real MIDI controller, a real
  phone, VoiceOver, TalkBack, Safari, iOS, Android, OGG decode.
- **No deployment is authorised during this pass.** Nothing is tagged or pushed.
- The GitHub Release for `v13.2.0-rc.1` still needs the repository owner's session.

---

## Test commands for this branch

```bash
python3 serve.py
```

| Suite | Expected |
|---|---|
| `/fixtures/run-all.html` | **runs all sixteen in sequence** — this is the one that proves order does not matter |
| `/fixtures/import-qa.html` | timing F **0.9091**, lane recall **0.8649**, mislabels **0**, 15/19 |
| `/fixtures/apply-safety.html` | **21/21** |
| `/fixtures/endtoend-qa.html` | **38/38** |
| `/fixtures/cancel-safety.html` | **15 pass, 3 N/A** |
| `/fixtures/vocal-qa.html` | **6/6 gates** |
| `/fixtures/pathb-qa.html` | **10/10 low end, 19/19 lifecycle** |
| `/fixtures/midi-qa.html` | **22/22 virtual**; the physical matrix stays OPEN |
| `/fixtures/performance-qa.html` | **29/29** |
| `/fixtures/guide-qa.html` | **34/34 intents, 21/21 context, safety and privacy** |
| `/fixtures/media-decode.html` | **13 as specified, 0 wrong, OGG untested** |
| `/fixtures/persistence-qa.html` | **43/43** |
| `/fixtures/export-qa.html` | **24/24** |
| `/fixtures/undo-redo-qa.html` | **5/5** — one Apply is one undo, project and audio |
| `/fixtures/music-knowledge-qa.html` | **86/86** |
| `/fixtures/a11y-qa.html` | **37/37** — automated only, never a screen-reader test |
| `/fixtures/layout-audit.html` | **17 viewports, 0 findings** |
| `python3 fixtures/validate.py` | 13/13 |

---

## Traps that cost real time in this pass — do not rediscover them

- **Aura's own boot pushes 2 undo checkpoints.** `hist.past.length===0` never means "fresh".
  `histBaseline` is captured at the end of init; measure against that.
- **The live app keeps autosaving.** Clearing `localStorage` while it runs is overwritten, and the
  reload restores the old project. Blank the frame, THEN clear, THEN load.
- **`rbapply` means "writes to the project".** `Find melody ideas` is analysis and uses `rbfind`.
- **Bass lives in `sub` (30-120 Hz), not `sub`+`low`.** A pad's bottom notes are 120-180 and will
  register as bass if you include that band.
- **Sustain must be a ratio, not time-above-half-the-rise.** Under a kick the rise is the kick.
- A `const` name that already exists in a harness function is a silent parse failure: the whole
  script never runs and the page just sits at "not run" with an empty console.
- **`hidden` is not self-enforcing.** The UA sheet's `[hidden]{display:none}` loses to ANY rule that
  sets a display, so `.thing{display:flex}` silently un-hides a panel the JS toggles with
  `el.hidden`. `[hidden]{display:none!important}` near the top of `styles.css` is the general fix;
  do not remove it and do not go back to patching one selector at a time.
- **`fromReadable` copies only keys present in `READ_INV`.** A compact key with no entry in
  `READ_MAP` survives the write and is silently DROPPED on read. That is how `lo`, `var` and `perf`
  were lost on every save-and-reopen for four commits while autosave looked perfect — autosave
  carries the compact state and never goes through the mapping. **Add every new key to `READ_MAP`.**
- **Suites inherit each other's projects.** The app restores its autosave at boot, so swapping the
  iframe `src` is not isolation. Use `AuraQAReset.blankAndClear()`. A green suite that only passes
  when it runs first is not a baseline.
- **Do not edit `app.js` while a regression run is reading it.** Suites load the file fresh per
  boot; a mid-edit tree produces failures that belong to no commit and cost a re-run to disprove.
- **`beatApplyMode` is one global shared by every reconstruction row.** Switching it to `variation`
  before applying the low end sends the low end into a variation too.
- **`setSampleMuted()` on the QA surface bypasses the checkpoint path**, leaving `hist.last` stale.
  The next autosave then captures a mixed state and a later single undo restores something that is
  neither the pre-apply nor the post-apply project. It made a correct undo look broken. Do state
  pokes AFTER any undo/redo assertions, not before.
- **`mix.sample.mute` is serialised** (channel 8 of `mx`). Muting the Sample channel is a project
  write, not just an audio one — which is why a cancelled import used to leave a checkpoint behind.
- **Exports must stay deterministic.** `getNoise()` and `makeIR()` are seeded. Unseeded, one
  unchanged project rendered 0.59 dB apart across five exports, which forces a 2.4 dB tolerance and
  makes every export assertion meaningless.
- **Fire OfflineAudioContext renders with a gap between them.** Back to back with no yield, this
  Electron build's audio thread stalls and a suite sits silently at its first probe.
- **Never edit `app.js` or a fixture while a regression run is reading it.** Suites load fresh per
  boot; a mid-edit tree produces failures that belong to no commit and cost a full re-run to
  disprove. This cost two runs in this pass alone.

- **The QA surface's `newProject()` is a stub** that only mints a fresh identity — it is not the
  real New Project. Testing through it proves nothing about what New Project clears. Drive the
  actual menu item (`#projmenu .projmi[aria-label="New Project"]`) with `confirm` stubbed to true.
- **`__auraSuite.snapshot()` returns a string, and the objects behind other surfaces are live.**
  Capturing a "before" and stringifying it later compares the state against itself. Stringify at
  capture time.
- **`exportProjectText()` is the readable state mapping, not a project file.** The save path is
  `buildFile(name, asNew)` → `openFile(object, name)`; `openFile` correctly refuses the former.
- **Nudge handlers must build their options when pressed, not when wired.** An options object
  computed at wiring time sends the same value on every press, so the second press silently does
  nothing — which reads exactly like a dead control.
- **Resizing an IFRAME does not re-resolve a declaration whose value is a `calc()` containing
  `env()`.** Measured in this Chromium build: `matchMedia` reports the query matching, the more
  specific rule is present and matching, and `getComputedStyle` still returns the pre-resize value —
  even with the contributing custom property set inline on the element. It resolves only when the
  document **loads** at that width. A real top-level window resize is fine. Any suite that wants a
  phone layout must LOAD a frame at that size, not shrink one; `a11y-qa.html` reported the Ask Aura
  button covering Export for exactly this reason, on a build where it does not.
- **A limit message must test the value that actually clamps.** The melody EQ pins at ±12 long
  before an internal accumulator reaches its own bound, so checking the accumulator reported
  success while nothing moved.

---

## Open research actions (dossier)

Six audit corrections were applied with a stated limitation because the assembly pass ran with no web
access. Each is flagged inline in `research/YE-PRODUCTION-RESEARCH.md` and listed in its OPEN ACTIONS
section. None blocks the product; all are traceability, not substance.

1. Recover the *Electronic Musician* (2004, Ken Micallef) print interview — the varispeed quote is
   currently reached only through a gear-journalism page that returned HTTP 403.
2. Recover the offline Concrete Loop interview (Oct 2007) from a web archive — it is the origin of
   nearly every first-person claim about CS-2's drum and synth strategy.
3. Recover the canonical *Complex* URL for the BULLY credits; currently read via a Yahoo syndication
   mirror, and the 2026-06-19 deluxe credits have not been examined at all.
4. Recover the *Rolling Stone* byline for the CS-5 listening-party report.
5. Re-read the Ken Lewis / Studio Talks source: one characterisation was published and propagated,
   with the 2026-07-28 page date recorded as a scrape artefact, but the re-read was not performed.
6. Attempt archive.org snapshots for the dead primaries (Concrete Loop, RWD, Reuters).

Four Saint Pablo revision-timeline rows carry no outlet anywhere in the table and are marked
`[Unverified - excluded]` rather than given an invented attribution. Leave them that way.

---

## Decisions that must not be reopened

- `.aura` is at `SCHEMA_VERSION` 3, and the number written into a file is the **minimum reader
  version that file needs**, not the newest the writer knows. `serialize()` grew from the v13.2
  twenty-five keys by ADDITIVE fields only — `lo` (low end), `var` (variations), `perf` (kept
  performance moves), `gv` (groove, its seed and the saved sound family), `ly` (lyrics and
  performance notes) and `pi` (project intention). A project using none of them still writes `2`, so the deployed 13.2.0-rc.1
  opens it; a project using any of them writes `3`, and 13.2 refuses it rather than opening it,
  ignoring the block and writing the loss back on the next Save. No analysis result, no media byte,
  ever reaches a project file, a share link or `localStorage`.
- Timing confidence and instrument confidence are never averaged into one number.
- One Aura pattern is one bar. A multi-bar progression takes one chord per section slot.
- Band energies are mean magnitude per bin, not sums — the bands differ in width by ~40×.
- `famPresent` thresholds came from measured distributions. Re-measure before changing a band edge.
- The imported recording is muted on arrival and only an explicit control includes it in the export.
- `MIN_MEDIA_SECONDS` exists because `decodeAudioData` returns 2 ms for a truncated file and calls it
  success. Do not remove it.
- The vocal mask uses the **real part** of `L·conj(R)`. The magnitude cannot tell +1 from -1, so
  anti-phase material scored as dead centre and was destroyed. Do not revert to the magnitude.
- Every named family control must change real project data. `endtoend-qa.html` enforces it.
- No control is disabled at rest; render it when it can act, remove it when it cannot.
- No separation claim in user-visible copy. The promise is: *Aura creates an editable reconstruction
  from what it can hear. Review and adjust the result.*
- `window.__auraRebuild`, `__auraMediaProbe`, `__auraVocal`, `__auraSuite` and `__auraSettleNow` are
  deliberate frozen read-only QA surfaces. There is no Node here; removing them silently disables the
  only way to measure the shipped build.
- The browser app must stay fully usable with no local engine installed.
- **Aura ships no model weights.** Demucs' own author excluded its weights from MIT. No licence-clean
  lead/backing model exists. See `aura-engine/MODEL-LICENSES.md`.
- **Never implement REPET** — US9093056B2 is active until 2033 and its reference implementation is
  MIT-licensed, which grants copyright and not patents.
- **Freeze transitions before measuring layout**, and force `__auraSettleNow` rather than waiting on
  `rAF` — a throttled or mid-transition frame invents bugs that do not exist.
- No artist, album or song name in anything a user can see, **or in any shipped runtime file**.
- External configuration is clean: `Projects/.claude/launch.json` restored to its original 525 bytes.

---

## Confirmed defects from the v13.3 adversarial review

A 24-agent review of `git diff 3c4759b..HEAD -- app.js styles.css index.html` produced 19 findings;
14 survived independent refutation, where each verifier was told to REFUTE and to default to
"refuted" when uncertain.

### Fixed

| # | Where | What it was |
|---|---|---|
| 1 | `app.js` `loadSampleFile` | **Export leak.** A cancelled import restored the pre-import mute (0 on a first import), leaving a loaded reference audible and in the WAV. Introduced by my own fix for a cancelled import burning an undo step. |
| 2 | `app.js` `applyState` | **Export leak.** Undo / Open Recent / share link / Open restored a mute bit from before the import while the buffer was still in memory. |
| 3 | `app.js` `renderExportBuffer` | The per-step automation replay restored `mutes` by rewriting only pre-existing keys. `mutes` is sparse, so a project with nothing muted restored **nothing** — one "Mute Beat" move silenced the rest of the file. |
| 4 | `app.js` `lowEndPlan` | Note lengths were converted from ms to steps at the CURRENT tempo while Apply was about to change it. Now sized at the tempo they will play at (`chosenStepSeconds()`), so the preview chips describe the part the singer actually gets. |
| 5 | `app.js` `bindFad` | A fader drag pushed one checkpoint per `input` event, flushing the 80-entry history and putting the preceding Apply out of reach. Now one checkpoint on `change`. |
| 6 | `app.js` `automationStartPlayback` | Replay called actions that autosave, so playing a kept performance wrote storage and spent undo steps. Now bracketed with `applyDepth`. |
| 7 | `app.js` `performActions` | **Privacy.** `record` was recordable and replayable, so a kept move could re-arm the MICROPHONE — including from a `.aura` or share link on someone else's machine. `record`, `undo` and `redo` are now `noAuto`: never captured, never replayed. |
| 8 | `app.js` `applyChosenTempo` | Wrote an unclamped BPM into a range input capped at 160, which clamps silently. Now clamped deliberately and stated in the tempo note before Apply. |
| 9 | `app.js` `newProject` | Never cleared `automation.events`, `variations` or `patterns[].bass`, so a new project inherited the last one's performance moves and muted itself mid-playback. |
| 10 | `styles.css` `.askbtn` | **Export untappable on phones.** The compensating `body.phone` rule never fired because nothing adds `phone` to `<body>`. Now driven by the same `max-width:767px` query that makes the nav a fixed 64px bar. **NOT VERIFIED IN A BROWSER — see below.** |

### Still open

| # | Where | What it is |
|---|---|---|
| 11 | `app.js:402` | Only MUTE automation reaches the export; kept fader moves are dropped. The export reads fader values from the DOM once per render, so replaying a curve needs the render restructured — not a one-line fix. Until then the Perform copy overstates what is captured. **Decide: implement, or say plainly that only mutes are rendered.** |
| 12 | `app.js:332` | Automation replay starts at the Play press, but the export maps event time onto musical time — so with a count-in enabled, kept moves land a full bar early in the WAV. |
| 13 | `app.js:3724` | `applyChordsRebuild` in "Add as a new version" mode writes melody, arrangement and section names OUTSIDE the variation scope, so the main version is changed by an action whose whole promise is that it will not be. |
| 14 | `app.js:1207` | `variations.items[].data` is written into the project unclamped; a poisoned value makes export throw. `persistence-qa.html` covers malformed `var` at the top level but not the nested `data`. |
| 15 | `app.js:2743` | Every Guide "Open …" action targeting a card inside `#v-smp` is a silent no-op unless the Sound tab is already active. |

Refuted and NOT defects, recorded so they are not re-litigated: `variations.main` scope
normalisation (`app.js:1203`), the Perform blend fader's 0..140 range (`app.js:3294` — two
independent gain layers, not one), and a `fixtures/endtoend-qa.html` scan that measures an empty
string. One tidy-up that is real but harmless: `aura-project.schema.json` still says
`"maximum": 2` for `schemaVersion` and should say 3.

### The Ask Aura fix is unverified, and why

`a11y-qa.html` grew a hit test — `elementFromPoint` at the centre of every bottom-bar control at
390x844, which is the only way to catch "the box is the right size in the right place but a finger
cannot reach it". It caught the defect immediately (`navExport <- askOpen`), which is what it is for.

It still reports the failure AFTER the CSS fix, and that result cannot be trusted: in the same frame,
setting `element.style.bottom = '76px'` INLINE left `getComputedStyle().bottom` at `12px` and did not
move the rect. A live element cannot behave that way. The frame's style engine had stopped
recalculating — the same renderer degradation that made `OfflineAudioContext` renders stall earlier
in this session.

What is established by inspection: the rule is present in the served stylesheet, it sits in a
`(max-width: 767px)` block that `matchMedia` reports as matching, it comes after the base rule with
equal specificity, and the CSSOM shows the declaration parsed and retained. What is NOT established:
that it actually lifts the button on a real phone.

**Re-run `a11y-qa.html` in a fresh browser session before trusting either the pass or the fail.**
Expected there: 37/37.

**Open harness item:** `cancel-safety.html` fails "cancel during reconstruction — autosave bytes
changed". The project-snapshot comparison passes as sample-mute-only; the persisted-copy comparison
does not, and whether that is a real write or harness accounting was not established.
