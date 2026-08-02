# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand — v13.4.0-rc.1 is FROZEN LOCALLY. Phase B is BLOCKED.

| | |
|---|---|
| Branch | `v13.4-futuristic-design` |
| HEAD | `ba08c06` — 13.4.0-rc.1 packaged |
| Branch-only commits | 91 (`main..HEAD`) |
| Working tree | clean |
| Live | `main` `2d70dde` = 13.3.0-rc.1, `origin/main` `2d70dde`, tag `v13.3.0-rc.1` → `fc668f9`. **All untouched.** Nothing pushed, nothing deployed. |

### READ THIS FIRST — the next action is a question, not a task

The instruction that set up this work had two phases. **Phase A is complete.** Phase B said to
branch `v13.5-capcut-music-workflow` and add a CapCut-inspired music workflow as `13.5.0-rc.1` —
and **the message was truncated at the `git switch` line, so Phase B's actual requirements were
never received.**

Do not start 13.5 by inventing them. The same brief said *"Do not contaminate the nearly completed
13.4 design release with an unbounded second product expansion"*, and guessing at a CapCut-shaped
scope is precisely that. **Ask for Phase B's detail before creating the branch.**

Standing constraints for whenever it arrives: do not deploy either candidate · do not modify `main`
· do not move or replace the 13.3 tag · **do not copy CapCut's interface, branding, icons,
terminology, proprietary assets or visual design** · the goal is *not* to make Aura resemble CapCut.

### v13.4 — complete, and verified sequentially at the packaged version

`run-all` reported **PASS — 17/17 suites at their recorded baseline** in one sequential pass against
the build carrying `APP_VERSION='13.4.0-rc.1'`, plus `validate.py` 13/13.

design-13.4-qa **186/186** · layout **17 viewports / 0 findings** · a11y **37/37** ·
guide-qa **34/34 + 21/21** · music-knowledge **95/95** · export-qa **28/28** · persistence **43/43**

- ROOM TONE tokens, type scale, planes, lamp, instrument and fold work
- the icon system (26 local symbols, no emoji, no external request)
- the 12px floor across six workspaces, including the guided step rail
- the **unified Welcome**, the **Song timeline**, the **singer's room**, **Perform as a stage**,
  **Finish the Record** as a journey
- the **full Guide conversation** — one voice across three depths, a project-context header read
  from real state, twelve enumerated facts, bounded history, nothing persisted
- **the ten states**, each held to two or more non-colour channels by fixture
- **the motion law** — nothing moves on its own but the record heartbeat
- **the eleven-viewport composition pass**
- **79 screenshots** across 20 states and three viewports, with public 13.3 as the before
- **13.4.0-rc.1 packaged**, byte-reproducible, and booted from the extracted artefact under a real
  `/aura-studio/` subpath with zero external requests

### The five defects this release found, and how

Every one was found by *looking at the thing*, not by a suite going red.

1. **The Song timeline drew a different song.** Six sites mutate `song` and predate the 13.4 view;
   they re-rendered only the slot strip. Every fresh project claimed "Nothing is arranged yet" over
   eight arranged bars, and open/undo/redo/demo/New Project showed the *previous* song's shape.
   Found while building a screenshot recipe. All six now go through `renderAllSlots()`.
2. **Five of eleven Welcome doors were ellipsised at 320px**, and the longest stayed cut at 430.
3. **"Melody" in the phone nav** lost two characters for 0.59px.
4. **The Song's empty state announced nothing** to a screen reader.
5. **`site.webmanifest` carried `?v=13.1-singer-favicon3`** — stale for two releases.

### Two instruments were wrong, and that mattered more than the fixes

- The layout audit compared **integer** `scrollWidth` with **integer** `clientWidth`. 41.26px of
  text in a 40.67px box rounds to 41 and 41, so it reported "fits" while all seventeen viewports
  painted "Melo…". It now re-measures with a Range when the integer test finds nothing.
- The contact sheets first captioned every failed 13.3 capture *"did not exist in 13.3"*. Four of
  those rooms **do** exist there and had merely failed transiently. Absence is now asserted only
  from the 13.3 source, per state, with the grep recorded.

Both would have shipped a confident false statement. Neither was caught by a suite.

**The count-in no longer covers the words.** `#cue` is `position:fixed; inset:0` with a 60% scrim
and a 120px numeral, and it only ever appears during a take — `start(withCue)` is true from
`startRecording()` and false from plain Play. So the one moment it was on screen was the exact
moment a singer was reading the line they were about to sing, and it washed the screen out to do
it. It also swallowed clicks, so Stop could not be pressed during the count.

Fixed in CSS, scoped to `body.recording-now` (set by `syncRecUI()` before `start()` schedules the
first number): numeral to the top, scrim removed, `pointer-events:none`. Measured with
`elementFromPoint` at the viewport centre — **`cue` before, `vocals` after**, so it demonstrably
stopped intercepting what is beneath it. Design QA re-run after the change: **152/152**.

**The count-in control now sits beside Record.** It rode at the end of `.keybar`, so it went
wherever the key and tempo controls went — a collapsible panel in another region. A singer arming
a take has one question about it, "count me in or not", and asks it looking at the Record button.
Moved in `mountShell` into the record row: a DOM move, so the node keeps its id, its checked state
and every listener, exactly as the vocals panel, the toolbar and the song already are.

Verified: still `<input type="checkbox">`, still live-settable through `countInEl.checked`, out of
`.keybar`, inside `#vocals`, visible 60px below Record. **apply-safety 21/21** (it asserts the
scheduler can still reach `#countin`) and **design QA 152/152** (it asserts monitor, sync and
count-in are all still inputs).

**Nothing from the original count-in pair is now outstanding.** For the record, the other half —
`#cue` covering the words — was
in the vocal room.

Do not report v13.4 as complete — the sections listed under NOT done are real and unstarted. But
the regression baseline IS green: a complete sequential `run-all` on a clean origin passed
**17/17 at their recorded baselines** at `a03e915`. See the gate section below.

### cancel-safety — resolved: no regression, no product defect, a load-sensitive suite

**Final state: 15 passed · 0 failed · 3 N/A on the current branch.** `cancelImportJob()` is
unchanged from the baseline — one line, `impJob++`. Nothing was fixed because nothing was broken.

This one cost most of a session and produced three wrong answers before the right one. All three
are written down, because the reasoning that produced them is the reusable part.

**Wrong answer 1 — "a regression from this session's work", with two named causes.** Both were
refutable by a single grep that was not run: `renderAllSlots()` is never called by `applyState()`
or `restore()`, and the case that names "Open Recent path" actually drives the QA surface's
`replaceProject()`, not the `resumeRecent()` that had just been refactored.

**Wrong answer 2 — "a genuine product defect in `cancelImportJob`".** The mechanism was real and
correctly traced: `analyseImport` is one synchronous pass, so `runAnalysis` can only drop a result
it has not yet assigned — it checks `jobLost(job)`, then sets `imp` — and a cancel arriving after
that check has nothing left to stop. But the *conclusion* did not follow, because the premise
(that the suite was failing on the code) was never established.

**Wrong answer 3 — two attempted fixes, both of which appeared to make things worse.** Having
`cancelImportJob()` call `clearRebuild()` turned two failures into three; the narrower `imp=null`
broke a case that passes everywhere else. Reverting was right, but not for the reason given at the
time: re-running the *reverted* build — behaviourally identical to the baseline — then failed a
**different** set of cases with the same message. That is what finally proved the failures were
noise rather than consequence.

**The precise mechanism, established by a controlled experiment.** My own conclusion — "browser
load and origin contamination" — was directionally right and imprecise. The actual cause:

`SAVE_KEY = 'aura-studio-v6'` (app.js:3147) is a plain **per-origin** key, and every open Aura
Studio document rewrites it on its own `setInterval(autosave, 4000)` clock (app.js:10266).
`autosaveBytes()` (app.js:10030) reads exactly that key, and this suite compares it before and
after each interruption. So a second live app document on the same origin — a leftover
`index.html` tab, or an earlier fixture whose iframe is still alive — makes the key ping-pong
between two different projects, and the suite reports `autosave bytes changed` on cases where the
app under test did nothing at all.

Demonstrated with a paired control on `efe0762`, a tree predating all of v13.4: same tree, same
origin, same tab, ninety seconds apart, the only difference being one extra live app document.
**Ten cases failed with it open; all fifteen passed without it.** That also explains why the
failing SET moved between runs — a hidden tab gets Chrome's intensive throttling, the foreign
autosave drops to roughly one a minute, and the contamination becomes invisible. A contaminated
run can therefore come back 15/15 by luck, which makes a green result under contamination just as
worthless as a red one.

Two corrections to what I wrote earlier: the range `efe0762..5999ed9` holds **four** commits, not
three (`629df00` is in it too), and `fixtures/run-all.html` **did** change in that range — only
`cancel-safety.html` itself was untouched.

**A `storage`-based guard was attempted and REMOVED. It cannot work in this browser.**

The spec says a `storage` event fires in every same-origin document except the writer. In this
browser pane it fires in none. Measured directly with two real tabs on one origin: the second tab's
tempo was changed so its autosave wrote a genuinely different project, and over nine seconds this
document received **zero** storage events — while the key it reads demonstrably came back carrying
the other tab's project. A detector that cannot fire is dead code wearing the costume of a
safeguard, so it was deleted rather than shipped marked "unverified".

The contamination itself is now reproduced first-hand, not merely inherited from the analysis:
open a second tab on the origin, change its tempo, and `autosaveBytes()` in the fixture returns
the other tab's project.

**So the rule is procedural, and it is the finding to carry forward.** Run cancel-safety — and any
suite with an autosave assertion — with no other Aura document open on the origin. A contaminated
run is worthless in BOTH directions: a hidden foreign tab is throttled to roughly one autosave a
minute, so contamination can just as easily produce a lucky 15/15 as a red run.


### The 640x800 layout finding — CLOSED by the instrument

The audit at `3b7aaea` reported one finding:

```
640x800 :: covered-control | rack | input.track-vol is covered by wtabs
```

`.wtabs` is a FIXED bottom bar below 767px (styles.css:1149). The presence band was hidden only
below **600px**, so at 640 it still rendered, pushed the Beat grid down, and put a lane fader under
the bar. Corrected to **767px** — the bar's own query, so the two cannot drift apart again. That
reasoning was already written down at styles.css:1419 for the Ask Aura pill; it was read, quoted in
a commit message, and then 600 was picked anyway.

**Re-run in full at `a3685af`: 17 viewports, 0 findings.** Confirmed by the audit, which is the
instrument — not by the rectangle-overlap check written on the spot, which reported `track-vol`
against the bar AND flagged `askOpen`, a deliberate member of the bar's reserved slot. That check
was unreliable in both directions and was right to be distrusted.


### The sequential gate — CLOSED. 17/17 at their recorded baseline.

Run at `a03e915` on a fresh port with `localStorage.clear()` first and **no live Aura app document
anywhere on the origin** — the other tab was navigated off `index.html` onto an inert fixture page
and confirmed to have booted no app.

```
PASS — 17/17 suites at their recorded baseline

  ok  import-qa            F 0.9091 · recall 0.8649 · mislabel 0 · 15/19 fixtures
  ok  apply-safety         21/21
  ok  endtoend-qa          38/38
  ok  cancel-safety        15/15 pass · 3 N/A
  ok  vocal-qa             6/6 gates · lead -59.1 dB, wide -0.0 dB
  ok  pathb-qa             10/10 low end · 19/19 lifecycle
  ok  midi-qa              22/22 virtual · manual matrix OPEN
  ok  performance-qa       29/29
  ok  guide-qa             34/34 intents · 21/21 context, safety and privacy
  ok  media-decode         13/14 as specified · 0 wrong · 1 untested (OGG)
  ok  undo-redo-qa         5/5 — undo returns the audio to within 6.9e-8 dB
  ok  music-knowledge-qa   95/95
  ok  export-qa            28/28
  ok  persistence-qa       43/43
  ok  a11y-qa              37/37 — NOT a screen-reader test
  ok  layout-audit         17 viewports · 0 findings
  ok  design-13.4-qa       146/146

Hardware and physical-device gates are NOT covered here and remain OPEN.
```

**A conclusion of mine that was wrong, and worth keeping as a lesson.** I twice wrote that this run
"stalls at export-qa" and that "twelve of seventeen is the ceiling for a long session" — once with
the reasoning that it was reproducible because it happened at the same suite both times. It was
not a stall. export-qa is simply very slow late in a session, and both times I declared it dead it
was still working. The run finished all seventeen.

Reproducible-looking is not the same as reproduced. Two observations that agree can both be a
misreading of the same slow process, and "it happened twice at the same place" felt like evidence
when it was only a pattern. The check that would have settled it costs nothing: the outer status
text is rAF-starved and lies, so read the INNER frame's row count instead — a growing count is a
working suite, and it was growing the whole time.


### Quick Ask Aura — DONE. It is a size, not a smaller product.

`.guidesheet.quick`, applied on open. The sheet already had every capability of this layer — it
reaches every workspace, answers all thirty-seven of the brief's phrasings, and previews every
mutating action before applying. What it lacked was a size: opening it to ask "what should I do
next" handed back a transcript and a Clear button, which is the wall the Welcome was redesigned
out of.

The change is presentation only, and the suite asserts that rather than trusting it — the answer,
the action, the confirmation and the undo are identical in both modes. Only the amount of past on
screen differs: the last exchange, plus "See the whole conversation".

Measured: opens quick with 1 of 1 shown; after three questions, 2 of 7; expanding gives 7 of 7 and
swaps the expand control for Clear. One-way on purpose — a control that re-collapsed the transcript
would hide what someone had just read.

design QA **152/152** (6 new) · guide-qa **34/34 + 21/21** unchanged.



### Section 13, the context matrix — measured, and it was mostly already true

Tested the brief's six required behaviours against the running app rather than assuming:

| # | Required behaviour | Found |
|---|---|---|
| 1 | intentional work → prefer Fill Empty / Add as Variation over Replace | already correct |
| 2 | no reference → do not offer Adjust the original | **gap: the phrasing returned `unknown`** |
| 3 | no lyrics → do not claim syllable analysis | **gap: the phrasing returned `unknown`** |
| 4 | MIDI unsupported → explain keyboard and touch | already correct (app.js:5174) |
| 5 | hidden destination → explain the prerequisite | already correct |
| 6 | low end Needs review → explain why, open the real editor | already correct |

Rows 2 and 3 satisfied the requirement only *negatively* — they did not make a false promise
because they did not answer at all. Two intents added (`adjustOriginal`, `checkLyrics`), appended
at the end per the ordering rule, both answering from state: with no reference, Adjust says it has
nothing to adjust and offers the import; with no lyrics, the check says there is nothing to count
and repeats that Aura does not write lyrics and has no language model.

**Row 4 is a correction to my own measurement.** My probe reported it failing. It was not: the
`!c.midiSupported` branch at app.js:5174 already says "Perform still works with touch, mouse and
keyboard", and it did not run because this browser SUPPORTS MIDI. I was measuring the wrong branch.
Reading the source before "fixing" it is what caught that — the fix would have been a duplicate of
code that was already right.

Verified: both new phrasings answer, all 37 brief phrasings still resolve, guide-qa 34/34 + 21/21
unchanged so nothing was shadowed, and design QA re-run after the change: **152/152**.

Every change on this branch is now suite-verified at its own HEAD, not merely at an earlier one.



### HAZARD before any packaging work — bump APP_VERSION FIRST

`APP_VERSION` in app.js:7252 is still `'13.3.0-rc.1'`, and `make-release.py` names every artefact
from it. The frozen release artefacts are sitting in `release/`:

```
release/aura-studio-13.3.0-rc.1.zip
release/aura-studio-13.3.0-rc.1-public-source.zip
release/aura-studio-13.3.0-rc.1-source.zip
```

**Running `make-release.py` at this HEAD would build 13.3.0-rc.1-named archives from v13.4 source
and overwrite the frozen ones.** That is destroying the deployed release's artefacts, which the
brief forbids outright. Deliberately NOT run here for that reason.

Order for the packaging session, and it is not optional:

1. bump `APP_VERSION` to `13.4.0-rc.1` **and** every `?v=` cache identifier in index.html together
2. only then run the release build

Also, a note against my own earlier check: `NAME_TERMS` is defined INSIDE a function in
make-release.py (line 225), not at module scope. A probe for it as a module attribute reports it
missing and the gate intact — the gate performs a parity comparison against the QA suite's own
list and refuses to build when the two drift. It was not touched by v13.4.


### Regression lessons from this pass — keep these, they were expensive

1. **Never generate production code by heuristic prose filtering.** A "is this line CSS?" filter run
   over a design specification dropped five comment terminators and let seven prose lines through as
   declarations: 11 comment openers against 6 closers in a shipped stylesheet. Rewritten by hand.
   Design specifications are read and implemented, never piped through a syntax guesser.
2. **After changing a shared helper, re-check ids, classes, attributes, labels, listeners and every
   fixture selector.** Widening `mk()` to take an icon silently dropped `b.id=id`, so `undoX`,
   `redoX` and `metX` lost their ids. The buttons still rendered, still had labels and still worked
   for a person — only the fixtures could see it, and three import suites died on `.click()` of null.
3. **Measure before changing a shared layout structure.** Two reasoned fixes for one covered control
   at 320×568 both made it worse (`height:auto` pushed the grid to y=552; a sticky toolbar covered
   four more controls). Measuring took one pass and named the real cause — the ready ledge at 167px
   and the toolbar at 226px, not the flex column.
4. **Validate syntax before browser testing.** Brace and comment-marker balance on `styles.css` is a
   two-second check that would have caught (1) immediately.
5. **A fixture result is the only evidence.** "Verified directly" in a console is not a suite pass.

Corollary found while building the Welcome: `document.createElementNS` takes the SVG namespace as an
absolute `http://` URL, and the release gate refuses absolute URLs in a runtime file. Build SVG from
markup instead — the parser applies the namespace for free. The gate caught it at 94/95.
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
| `/fixtures/export-qa.html` | **28/28** |
| `/fixtures/undo-redo-qa.html` | **5/5** — one Apply is one undo, project and audio |
| `/fixtures/music-knowledge-qa.html` | **95/95** |
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

**None.** All five were re-verified by an independent pass in which each agent was told to REFUTE.
Two were already fixed, one was fixed but had left a new defect behind, and two were real.

| # | Verdict | Where it landed |
|---|---|---|
| 11 | **Real — fixed.** And worse than recorded: the export did not merely drop fader moves, it BAKED the residual fader position across the whole song, because playback leaves the DOM faders where the last event put them and nothing restored them | `renderExportBuffer` replays the same `performActions()` the live path uses and stamps the result onto the offline graph with `setValueAtTime`; `automationStopPlayback` restores the controls |
| 12 | **Already fixed.** `start()` defers the replay to musical zero, so the count-in no longer shifts kept moves | `app.js` `start()` |
| 13 | **Already fixed** — the variation scope now covers everything the apply writes, measured on the shipped runtime with a forced worst case. But the scope widening had left a real defect behind: `buildSectionNames` never cleared its host, so every song-scoped restore appended six more name boxes (6 → 12 → 24) and a reload then blanked most of them | `buildSectionNames` clears first |
| 14 | **Real — fixed, and the recorded claim named the wrong field.** `items[]` was already sanitised; `variations.main` was assigned raw, and `main.data` is written straight back into the project when the singer clicks the Main row | `applyState` runs `main` through `saneVarData` and `emptyScope` |
| 15 | **Already fixed** — `scrollTo` switches the owning tab first. Residual, different: three intents offered cards that `renderVariations` / `paintImpMode` keep hidden | Guide's Rights action also corrected: it highlighted the Mix Check card |

### Found by auditing this session's own claims against the tree

Checking the brief's constraints against the repository rather than against my summaries found three
more, all now fixed and committed at `48e04a9`.

- **A second artist name in the shipped runtime** — `"Feid lane"` in an `app.js` comment. Both name
  gates are hand-kept lists and neither held it. Widened to the full reference set, word-bounded
  where a name is also an ordinary substring (`sech` matches `secHasDrums`). Verified the widened
  pattern catches both this and the earlier `"J Balvin lane"`, and does not false-positive.
  **If a name is added to the research, add it to BOTH lists — `make-release.py` and
  `music-knowledge-qa.html` — in the same edit.**
- **Three Guide actions pointed at cards hidden until a reference is imported.** Scrolling to a
  hidden element throws no error and does nothing. `scrollTo` now checks AFTER the tab switch (the
  tab is the other reason a card is off screen, and that one it can fix) and says what the project
  needs first.
- **The sampler's shaping controls never reach the built section.** Pitch, Speed, Trim, Repeat and
  Reverse change the audition; Build writes drum steps, which carry timing and accent but not pitch
  or length. Not implementable into a drum lane, so it is stated on the card and the ledger row moved
  from done to partial.

### Found by the same pass, and not on anyone's list

- **A section built from an imported file was reported as "Generated by Aura. Yours to use."**
  `recordAsset()` had no production caller at all — the sampler recorded nothing, so a third-party
  file could be chopped into a section and the project still confirmed clean. The report was clean
  because the file was invisible to it, not because the file was clear. Fixed: each sampler source is
  recorded as it is adopted, a section built from its slices is recorded as a transformation naming
  it, and a derived part now inherits the **strictest release class in its chain**.
- **The Tool Router reached one of its ten entries.** It read `c.lastAsk`, which `guideContext()`
  never set. Fixed, and scoped to the `tools` domain — craft entries load first and ties keep
  insertion order, so an equal-scoring craft entry had been answering tool questions.
- **Find a sound had no route in the default mode.** Guided hides the workspace tabs on desktop and
  the step rail covers rack/piano/play/voc only. Added to the More sheet beside Balance.
- **Mix Check named two controls that do not exist** (Punch, Width) under a card promising that every
  warning names the control that fixes it.
- **Four knowledge entries and seven ledger rows described features that were never built.** All
  corrected against the code; the ledger rows now read partial or not built, with the reason.

Refuted and NOT defects, recorded so they are not re-litigated: `variations.main` scope
normalisation (`app.js:1203`), the Perform blend fader's 0..140 range (`app.js:3294` — two
independent gain layers, not one), and a `fixtures/endtoend-qa.html` scan that measures an empty
string. One tidy-up that was real: `aura-project.schema.json` said `"maximum": 2` for `schemaVersion`.
**Fixed** — it now describes version 3 and all six v13.3 blocks, validated against a real file from
`buildFile()` kept as `fixtures/v13.3-all-blocks.aura`.

### The Ask Aura fix — RESOLVED, and the suite was wrong, not the build

Settled by measurement in a fresh session. The CSS fix is correct and the button does **not** cover
Export. What was wrong was the way the suite measured.

`a11y-qa.html` used one shared iframe and shrank it from 1280x900 to 390x844. In this Chromium build,
**resizing an iframe never re-resolves a declaration whose value is a `calc()` containing `env()`**.
`matchMedia('(max-width:767px)')` reports true, the more specific rule is present, parsed and
matching, and `getComputedStyle(...).bottom` still returns the desktop `12px` — and it stays wrong
even when the contributing value is set inline on the element. That is exactly the "a live element
cannot behave that way" symptom recorded earlier; it is not renderer degradation, it is this
invalidation gap, and it is reproducible on demand.

Three measurements settle it:

| Scenario | `.askbtn` bottom | Overlap |
|---|---|---|
| Fresh load at 390x844 | **76px** | none |
| Real top-level window resize, 1280 -> 390 | **76px** | none |
| Iframe resized 1280 -> 390 | 12px | reported |

The identical probe run against `c82e63e` fails the same way, so it was never a regression from the
13.3 work — the suite had been reporting a defect that is not in the build. Restructuring the CSS
around a custom property did not help and was reverted; the original single media-query override
stands.

`atPhone()` now creates its own frame **loaded** at phone size instead of shrinking the shared one.
`a11y-qa.html` is **37/37**.

**Open harness item — CLOSED.** `cancel-safety.html` used to fail "cancel during reconstruction —
autosave bytes changed". The persisted copy now gets the same exact single-field exception as the
in-memory one — it is the same field, `mix.sample.mute`, channel 8 of `mx` — checked as an exact
one-field difference rather than a loosened comparison. Measured in the full run of 2026-07-31:
**15/15 pass, 3 N/A**, no failures.

---

## Contextual Aura presence — RESTORED inline, with one honest cost

It is now **inline at the head of the scrolling body**, not floating. `position: static`. A control
cannot be covered by something that is not on top of it, so the blocker that forced the withdrawal
is gone by construction rather than by choosing a luckier corner. Verified across all six
workspaces at 1440x900: **zero covered controls**, no serialisation leak, both controls 44px.

**It is desktop and tablet only, and that was forced by measurement.** At 320x568 the band put the
Beat sequencer at y=527 of 568 — a sliver — and, the case I missed until the design suite caught
it, pushed the Vocals room's **Record button to y=591, below the fold**. A room's primary action
disappearing to make space for a hint is exactly the trade the fold work exists to prevent.

There is no version that fits: 568px of height has no room for a quiet layer above the working
object, and putting it below would need a visual reorder that breaks DOM focus order (WCAG 2.4.3).
So `@media (max-width:600px){ .presence{display:none} }`. Nothing is lost that a singer cannot
ask for — every observation it makes is also reachable through Ask Aura, which IS on every phone
screen.

Restored after the fix: Record 498 of 568, sequencer 434 of 568, both above the fold.

I briefly took the band's buttons to 38px to buy fold space and reverted it — buying room by
making a control harder to hit is the same move as weakening a test to make a defect disappear.

## The FIRST version — floating, and why it was withdrawn

Section 10's quiet layer was implemented and then reverted in the same session. It is written up
here because the design is sound and the reason it was pulled is the useful part.

**What was built.** `auraObservations()` returning restrained, dismissible observations, every one
read from a computation the app ALREADY performs and already shows elsewhere — `emotionMap()`
findings, the last-chorus-vs-first comparison the Song timeline draws, `sectionMetrics().vocalSpace`,
`lyricAnalysis().fit.over`, the presence of intentional drums plus a live `imp`, and the MIDI input
list. Nothing new was analysed, so the layer could not describe a state that was not real. One
observation shown at a time, dismissing the top one revealing the next, dismissals in memory only.

**Verified working**: two real observations from the Emotion Map, dismissal advancing to the next,
and nothing reaching `serialize()` — the snapshot was searched for any presence/observation key and
came back clean.

**Why it was withdrawn.** Measured across all six workspaces: the panel covered `#exportAll` in
Balance. That is a fixed panel over a scrolling column of controls — the exact structural failure
diagnosed and fixed for the Ask Aura pill earlier in this same session, where measuring proved that
no floating position and no scroll position is safe because the two planes always meet. The brief's
own rule is that Quick Ask Aura and this layer "must not cover controls at any supported viewport".

Shipping it would have been a known breach of a stated design law to claim a section, so it was
reverted rather than left in.

**The fix, for whoever picks it up.** Do not look for a better corner — that was already disproven
for Ask Aura. The layer has to leave the floating plane: either reserve space for it in `.wbody`
the way the bottom bar's 64px is reserved, or render it inline at the head of the workspace and
accept that it competes with the creative object for the first screen. The first is more work and
is the right answer. The observation logic itself needs no change.
