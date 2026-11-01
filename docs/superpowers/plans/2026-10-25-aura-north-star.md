# Aura Studio north-star — staged roadmap

> **For agentic workers:** this is a ROADMAP of independent releases, not one task list. Before a stage is built,
> its own bite-sized, test-first task plan is written as `docs/superpowers/plans/<date>-ns-<stage>.md`
> (writing-plans format: failing test, run red, minimal code, run green, commit) and executed with
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** make `/rc/` match the north-star target (the pasted spec + `docs/mockups/studio-dashboard-target.png`)
one release at a time, fixing the real bugs first, without ever touching the root 13.6.0-rc.3 build.

**Architecture:** the same static app (`rc/index.html`, `rc/app.js`, `rc/styles.css`), changed in place, one stage
per release; every stage ships on its own, behind tests written first and seen failing on the build before it.
New checks live in a new suite, `qa/dashboard-n.qa.js` with jobs in `qa/dashboard-n.jobs.cjs`, run by the existing
`qa/run.cjs`.

**Tech stack:** vanilla JS + Web Audio, no build step, no dependencies; Playwright-core 1.63 at
`~/.local/share/aura-qa/node_modules/playwright-core` (Chromium 153, WebKit 26.6).

**Spec:** `docs/superpowers/specs/2026-10-25-north-star-design.md` (the target verbatim, Philip's eight decisions,
the bug list). Read it with this file.

**Status:** written 2026-10-25; **approved by Philip 2026-10-31** with every recommendation in section 6 taken
(D0-D7) and his own findings from the live rc.16 folded in (section 2, S2, S3, S6, S15). Execution started with S0.
The first push to `/rc/` waits for his go typed directly in chat (his approval arrived as pasted text).

## Global constraints

- All work in `rc/` and `qa/` (and `docs/`). **Never touch the root `index.html`, `app.js`, `styles.css`
  (13.6.0-rc.3).** Do not change the deploy target (GitHub Pages from `main`, `/rc/` = `main`'s `rc/` folder).
- Release rules, every stage: tests first, seen failing on the current build in both engines; a mutant that puts
  the bug back must fail them; the full regression from a snapshot in Chromium and WebKit with **zero failures**
  (known NOT RUNs only: `e12RealRecord` in WebKit); export graph key equal to f304607's (`e2ExportGraph`); saved
  state byte-identical (`e1Saved`); default export within f304607's own run-to-run spread (`e2ExportJitter`);
  publish to `/rc/` only; live check (every `rc/` file byte-identical, `APP_VERSION` from the wire in both engines,
  the stage's tests on the live site, the audio check on the live bytes); a handoff entry in the project's system
  record (kept outside this repository) and a `docs/CHANGELOG.md` entry after each push; **revert and stop on any
  failure, or on any design conflict a decision below does not settle.**
- New tests run at **1440×900, 1280×800 and 390×844** (plus 1512×982 where the right panel is involved,
  **1920×1113 wherever overlap or the piano roll's width is tested** (Philip, 2026-10-31), and 1024/768 where
  overflow is).
- Network rule: no request except the URL the singer pastes, on Load. **System font stack only**; no font server.
- `.aura` files: old files always open. Any change to saved state bumps `schemaVersion` and adds a migration with a
  test that opens a file written by the build before.
- Three vocal tracks stay (Lead, Double, Harmony); in the arrangement they collapse under one **Voice** group.
- Undo: every edit is exactly one checkpoint; Preview never commits.
- **No new limiter; f304607 stays the audio reference** (decision 7). Anything that would change the export graph
  (a new node, a new channel) is a decision for Philip before it is built (section 6).
- Before/after screenshots of each stage go to `qa/screens/<stage>-{before,after}-<engine>-<W>.png`.

---

## 1. What is already done (from the old ten-stage plan)

| Old stage | State |
|---|---|
| 1. Seal regions (containment) | dropped 2026-09-26 — no gain. Replaced by a real-Safari profile of the lane-pick lag (track L below) |
| 2. Grid and vertical budget | **done, rc.15** (option d: right panel a drawer below 1400, a column from 1400) |
| 3. Right panel fits | **decided 2026-10-25** (decision 3) → stage S6 |
| 4. Take encode off the main thread | **done, rc.13** (Stop) and **rc.16** (Save) |
| 5. Type, one name per track | → S5 |
| 6. Lanes and energy as the mockup | → S9, S10, S11 |
| 7. Mixer strips | → S12 |
| 8. Top bar | → S7 |
| 9. Sounds sidebar | → S8 |
| 10. Meters idle when nothing plays | → S13 |

## 2. The bug list, audited on rc.16 (2026-10-25, read-only)

Headless Chromium 153 and WebKit 26.6, `rc/` at `9787568`, demo song loaded unless stated; probe scripts in the
session scratchpad (`northstar/audit.cjs`, `audit2.cjs`), not in the repo. Both engines agreed on every finding;
where their counts differ, both are given.

| Philip's item | On rc.16 | Stage |
|---|---|---|
| Create dialog trap | **Real.** The Create sheet (`#createSheet`) has no X; Tab is not held inside it (no `trapTab`; in Chromium 1 of 40 presses left it — WebKit does not tab to buttons by default, so it cannot show this); after Esc focus lands on `<body>`, not on the button that opened it. The Welcome (`#welcome`): a backdrop click does not close it, and after that click Esc no longer closes it either (its Esc listener is on the dialog, and focus has left it) | S1 |
| Undo depth on load | **Real.** `undoDepth()` is **2** on a fresh load, before any action (welcome still open). After reloading a saved project it is 0. Ctrl+Z and Ctrl+Shift+Z work; **Ctrl+Y does nothing** | S2 |
| Overflow at 1280 and 390 | **Not reproduced.** No sideways page scroll and no element past the viewport in any state examined: 1440, 1280, 1024, 768 and 390 wide; Studio and Guided; every visible workspace tab, editor tab and drawer (5–9 states per width and mode) | guard test in S3 |
| Ask Aura covering the dock toggle | **Not reproduced.** `#dockToggle` is never visible in rc.16 (same states as above). **What is real:** at 1400 and up, Ask Aura sits over the right panel (top 786 px at 1440×900) | guard in S3; fix in S6 |
| Contrast | **No failure among 203 text elements measured on solid backgrounds** at 1440 Studio (171 at 1280); **58 elements over gradients were not measured** (needs pixel sampling) | S4 |
| aria labels | **Real, one group:** the nine right-panel sliders (`#drInt` … `#drDly`) have no accessible name — each `<label>` labels its `<output>` (a labelable element that comes first), not its slider. The icons the spec named (`#pathVibe`, `#importPick`, metronome, undo, redo) are named | S4 |
| Touch targets | **Real on desktop:** 28 of 110 visible controls under 32 px in Studio at 1440 (24×24 lane M/S buttons, the 13×13 Musical intensity box), 12 of 58 (Chromium) and 18 of 57 (WebKit) in Guided, mostly the 30 px step buttons. **0 under 40 px at 390** | S4 |
| Piano roll width | **Real.** Studio editor: the grid is 640 px inside a 694 px scroller inside an 844 px panel (1440) or 983 px (1280); it does not fill or scale | S3 |
| Export peak (spec item 3) | **Already limited, not brickwall.** The master chain ends in a compressor at −1 dB, 20:1, 2 ms attack (`buildBusses`, live and offline), and the export scales any file whose peak passes 0.985 down to 0.985. Exports peak at **−0.13 dBFS**: 679 samples ≥ −1 dBFS in the default project's 25.6 s, 380–397 in the demo's 26 s | decision D1 |

**What this audit does not establish:** real Safari or a real phone; Guided mode's own panels beyond the default
view; contrast over gradients; keyboard focus rings (not measured).

**Philip's findings on the live rc.16 (2026-10-31, his report; he says it confirms the bugs above):**

| Finding | Stage |
|---|---|
| At **1920×1113** in Studio, Ask Aura covers the "One-step undo" button and the Architect row. Add 1920 to the overlap tests | S3 guard widths, S6 fix |
| The undo and redo buttons are **never disabled**, so an empty history cannot be seen. Disable them when there is nothing to undo or redo | S2 |
| The piano roll leaves **empty space on both sides at 1920** too, not only at 844–983 px panels. Fill the panel at every width | S3 |
| Studio shows 20+ controls at once with no starting point. S15 must show **one clear first action** for a beginner, with **meters and readouts quiet until playing** | S15 (meters also S13) |

## 3. Phase 1 — the bugs (13.8.0-rc.17 to rc.20)

### S0 (no release): make the release tools survive

The 2026-09-26 regression output, the f304607 baseline copy and every release helper were lost when
`/private/tmp` was wiped. Before S1: put the helpers in the repo (`qa/release/bump.py`, `qa/release/livehash.sh`,
`qa/release/liveseen.cjs`, `qa/release/handoff-update.py`) and keep the baseline at
`~/.local/share/aura-qa/base-f304607` (outside iCloud, outside `/tmp`). Done when the four tools run from the repo
and the baseline's `rc/` hashes match `git archive f304607 rc`.

### S1 — first run and dialogs (13.8.0-rc.17)

**Changes:** first-time visitors (no saved project, no `aura-seen`) get no dialog: the demo project loads and a
4-step coach-mark tour starts (Sounds, Arrangement, Mixer, Aura guidance; each step anchored to what is on screen at
that width — the panel where it is a column, its opener where it is a drawer, the tab at 390); Next, Back, Done and
Esc dismiss; dismissed once, it never returns (`aura-tour-done`). Returning visitors open their last project
(true today; kept by a test). The Welcome stops opening by itself and moves to the Project menu ("Start something
new…"). Welcome and Create sheet: Esc closes from anywhere while open, backdrop click closes, an X closes, Tab is
held inside, focus returns to the control that opened it.
**Test infrastructure:** `qa/run.cjs` marks every context as a returning visitor by default (init script:
`aura-seen=1`, `aura-mode=studio`, the state a Skip leaves today) so every existing test keeps today's empty
starting project; jobs with `firstRun: true` start truly fresh.
**Red tests (n1…):** `n1FirstRunNoDialog`, `n1FirstRunDemo`, `n1TourSteps` (4 steps, each anchor visible),
`n1TourDismissStays` (reload: no tour), `n1ReturningOpensLast`, `n1WelcomeEscAnywhere`, `n1WelcomeBackdrop`,
`n1CreateHasX`, `n1CreateTabHeld`, `n1CreateFocusBack`, `n1ToolbarClickable` (fresh load + Esc: every top-bar
control hit-tests to itself) — at 1440×900, 1280×800, 390×844.
**Changes by design to existing checks:** the runner's `shrinkTo` step reads `#wClose` on a fresh load (the
Welcome was open); it will open the Welcome from the menu first. Listed in the release entry, not hidden.
**Not proven by these tests:** that a first-time visitor understands the tour; real Safari focus behaviour (Safari
only tabs to buttons with "Press Tab to highlight each item" on, which headless WebKit mirrors).

### S2 — undo (13.8.0-rc.18)

**Changes:** find with evidence what pushes the two checkpoints during start-up (systematic debugging; no fix before
the cause), stop it; add Ctrl/Cmd+Y as redo; **the undo and redo buttons are disabled (and say so to assistive
tech) whenever there is nothing to undo or redo** (Philip, 2026-10-31). **Red tests:** `n2UndoZeroFresh`,
`n2UndoZeroFirstRun` (after S1's demo), `n2UndoZeroRestored`, `n2OneToggleOneStep`, `n2RedoShiftZ`, `n2RedoY`,
`n2ButtonsDisabledWhenEmpty` (fresh load: both disabled; one edit: undo enabled, redo disabled; Ctrl+Z: undo
disabled, redo enabled). **Not proven:** that every other control is one step — that is S17's sweep.

### S3 — piano roll fills its panel; overflow and Ask Aura guards (13.8.0-rc.19)

**Changes:** the piano roll's grid fills the editor panel's width **at every width** and scales with bars and zoom
(its column width is computed from the panel, not capped at today's 640 px; no empty space on either side).
**Red test:** `n3RollFills` (grid left and right edges within 2 px of the panel's at 1920×1113, 1440×900 and
1280×800; at 390 it scrolls sideways inside its own scroller, the page does not).
**Guards (pass today, must stay green):** `n3NoOverflow` (every view, tab and drawer at 1920/1440/1280/1024/768/390,
Studio and Guided: `scrollWidth === innerWidth`, nothing past the edge outside a scroller), `n3AskClearBelow1400`
(Ask Aura intersects no visible control below 1400). Ask Aura over the right panel at 1400+ (at 1920×1113 it covers
One-step undo and the Architect row) is fixed in S6.

### S4 — accessibility (13.8.0-rc.20)

**Changes:** the nine right-panel sliders get names (the `<output>` moves out of the `<label>`, or the slider is
named with `aria-labelledby`); desktop controls at least 32 px (lane M/S, the Musical intensity toggle, the Guided
step buttons), mobile stays at 40+; a visible `:focus-visible` ring on every control; hover and active states; text
over gradients measured by pixel sampling and fixed where under 4.5:1 (3:1 for large text).
**Red tests:** `n4ControlsNamed` (every visible control has a name with a letter or digit), `n4TargetsDesktop`,
`n4TargetsMobile`, `n4FocusRing` (each focusable control shows an outline or box-shadow change on keyboard focus),
`n4ContrastSolid`, `n4ContrastGradient` (screenshot sampling under each text box).
**Not proven:** a screen reader's actual reading; contrast of text drawn on canvas.

## 4. Phase 2 — the north-star layout (13.9.0-rc.1 onward)

Each stage below is one release, with the same gate. Measured targets come from the mockup scaled to the viewport.

| Stage | What ships | Red tests (examples) |
|---|---|---|
| **S5 Tokens, type, names** (old 5) | System font stack; the spec's palette as tokens (ground #120d1a→#1a1324, panels #1e1729, 1 px #2e2440 borders, 10 px radius, accent #8b5cf6, track colours drums orange, bass teal, keys violet, atmosphere blue, melody gold, voice pink, texture purple); 12–13 px UI, 11 px meta ≥ 4.5:1; one name and one colour per track in lanes, mixer strips and the panel (today the mixer says Chords, Sample, Vocals where the lanes say Warm keys, Atmosphere, Lead) | `n5NoWebfont`, `n5Tokens`, `n5OneNamePerTrack`, `n5MetaContrast` |
| **S6 Right panel** (old 3, decided) | Section card: CHORUS • BARS x–y with prev/next; Intensity, Warmth, Movement, Space (0–100, values shown); Preserve as Voice and Melody chips. Selected-track card: instrument preset dropdown, then the tone control (D4), Reverb send, Delay send with units. Aura guidance card: one suggestion, Preview (A/B, never commits), Apply (can apply song-wide, replacing "Apply to whole song"), One-step undo. Song tools list. The song-wide Room and Echo sliders leave the panel (their saved values still play). Ask Aura moves into the Aura guidance card at 1400+ so nothing covers the panel. Warmth per section (D2) | `n6Fits@1440x900,1512x982,1920x1113` (every block on screen, nothing scrolls, nothing under another control — at 1920×1113 One-step undo and the Architect row are covered today), `n6SectionCard`, `n6PrevNext`, `n6PreserveChips`, `n6TrackCard`, `n6PreviewNoCommit`, `n6ApplyWholeSong`, `n6AskInCard`, `n6OldFileWarmth` (a pre-S6 file opens with its Warmth everywhere) |
| **S7 Top bar** (old 8) | Logo; editable project name with dropdown; Saved on this device; undo/redo; centred stop, play, record; BPM field; key/scale picker; 4/4 (display); bar.beat; Loop; Guided \| Studio; Export as the primary button; one row, 52 px | `n7OneRow`, `n7Transport`, `n7KeyPicker`, `n7ExportPrimary`, `n7NameEdit` |
| **S8 Sounds panel** (old 9) | Search, mood chips on one row, featured preset cards with thumbnail (drawn on the device, no files fetched), name, tags, mini waveform, play preview; Project intention card; Import audio and Record sound at the bottom; at 1280 the panel becomes an icon rail | `n8Cards`, `n8PreviewPlays`, `n8Intention`, `n8IconRail@1280` |
| **S9 Arrangement: ruler and view** (old 6) | Bar ruler; Snap (bar, beat, step); zoom slider and Fit; the playhead follows playback when zoomed in; 36 px track rows | `n9Ruler`, `n9Snap`, `n9ZoomFit`, `n9PlayheadFollows`, `n9RowHeight` |
| **S10 Arrangement: lanes and clips** (old 6) | Lane heads with coloured icon, name, M, S, record-arm, lock; the Voice group (Lead, Double, Harmony) collapses and expands; clips show MIDI note previews and audio waveforms; selected-clip glow; Ctrl-drag copies (drag, resize, Split, Repeat, Remove and Delete exist today) | `n10LaneHead`, `n10VoiceGroup`, `n10NotePreview`, `n10Waveform`, `n10CtrlDragCopy`, each edit one undo step |
| **S11 Energy and sections** (old 6) | Energy lane with 0/50/100 scale, filled target curve with one draggable point per section (writes that section's Intensity: one undo step, audible), dotted measured curve; sections draggable and resizable, active-section glow | `n11Scale`, `n11DragPoint`, `n11SectionDrag`, `n11SectionResize` |
| **S12 Dock and mixer** (old 7) | Tabs Mixer, Piano roll, Lyrics, Vocal coach, Perform (+ Beat grid, D5), Mix check and Sources buttons; strips of equal width with icon, name, dB readout, stereo LED meters (live analysers only, not in the export), fader, pan knob with L/R, M/S; the selected track's strip highlighted; picking a track highlights its strip | `n12Tabs`, `n12StripParts`, `n12EqualWidth`, `n12SelectedStrip`, `n12StereoMeters`, graph unchanged |
| **S13 Meters idle** (old 10) | No meter repaint while nothing plays (today about 40 a second) | `n13IdleNoPaint`, `n13PlayingPaints` |
| **S14 Guided = same screen** (D3) | Guided becomes this screen with the dock collapsed and only Sounds, sections, Energy and Aura guidance active | `n14GuidedSameScreen`, `n14GuidedInactive`, `n14Toggle` |
| **S15 Ease of use** | **Philip's priority (2026-10-31): Studio shows 20+ controls at once with no starting point — show one clear first action for a beginner, with meters and readouts quiet until playing.** Plus: a plain-words tooltip on every control, jargon explained; drag a preset card onto a track or empty lane to create or replace its sound; each energy slider and each Apply one undo step and audible in the export | `n15OneFirstAction` (a beginner's screen has exactly one primary call to action, visible without scrolling at 1440/1280/390), `n15QuietUntilPlaying` (meters and readouts show no motion and no live numbers until Play), `n15Tooltips`, `n15DropPreset`, `n15SliderOneStep`, `n15ApplyInExport` |
| **S16 Phone (≤ 480)** | Sounds / Arrange / Mix / Aura tabs, one panel at a time; the arrangement scrolls sideways with a sticky track column; transport fixed at the bottom | `n16Tabs`, `n16StickyTracks`, `n16TransportFixed`, `n16NoOverflow` |
| **S17 Acceptance** | `qa/screens/northstar.png` at 1440×900; every region's box (top bar, Sounds, Arrangement, dock, the four panel cards) within ±16 px of the mockup's box scaled to 1440×900, measured once from the PNG into `qa/northstar-boxes.json`; no console errors; no horizontal overflow at 1440/1280/1024/768/390; an undo sweep (every control: one step, Ctrl+Z restores the snapshot); an export sweep (every mixer, energy and panel control changes the export) | `n17Boxes`, `n17NoConsoleErrors`, `n17NoOverflow`, `n17UndoSweep`, `n17ExportSweep` |

"Visually matches the mockup" is measured as region boxes, not a pixel diff: a painted mockup and a rendered page
never match pixel for pixel, so a pixel threshold would either always fail or prove nothing.

**Track L (not a release): the lane-pick lag.** Picking a lane takes 142–162 ms in headless WebKit (45 ms in
Chromium); the cause is not found. It needs Philip's Mac: Safari → Develop → Show Web Inspector → Timelines (Layout
& Rendering, JavaScript), pick lanes, read which phase dominates. Any fix becomes its own stage.

## 5. Phase 3 — later (decision 8; not scheduled)

After the north-star layout ships, each with its own spec: patterns + playlist timeline (Song mode plays it),
automation clips rendered in export, MIDI file import (MIDI export exists today), synth channel UI; and the first
spec's other features: tap tempo, 3/4 and 6/8, zipped stems, a shortcut overlay (a Help dialog exists), channel-rack
upgrades (per-step velocity, add/remove channel, sampler drop, 16/32/64 steps), piano-roll editing extras, Web MIDI
record, the optional Studio density theme.

## 6. Decisions for Philip

**All decided 2026-10-31: Philip took every recommendation below.** D0 back to back with one-line reports, stopping
only on a failure or an open question; D1 the peak stays until the layout ships, then a look-ahead limiter as its
own release with a new reference; D2 Warmth per section, old files copy the song's Warmth into every section; D3
Guided becomes the same screen; D4 High EQ, labelled plainly; D5 the Beat grid tab stays; D6 Texture stays a view of
the open hats; D7 as written.

| # | Decision | My recommendation |
|---|---|---|
| D0 | After you approve this plan, do the stages run back to back under the release rules (I stop only on a failure or an unsettled design question), or do I stop after each stage for your word? | Back to back, a one-line report per release, as in September |
| D1 | **The near-clipping peak** (decision 7). Exports peak at −0.13 dBFS: the master's limiter is a fast compressor (−1 dB, 20:1, no look-ahead), and the export's safety gain only pulls a file down to 0.985. Options: (a) leave it; (b) a look-ahead brickwall at −1 dBFS on the master (live and export): louder parts keep their level, the export changes, so f304607 stops being the reference; (c) the export's safety gain targets −1 dBFS instead of 0.985: simplest, the file is up to 0.87 dB quieter whenever it would pass −1 dBFS, also a new reference | (a) until the north-star layout ships, then (b) as its own release with a new reference you approve |
| D2 | Warmth moves into the section card. Today it is song-wide. Make it per section (saved state changes: `schemaVersion` bump; an old file copies its song Warmth into every section), or keep it song-wide and only place it in the card? | Per section — every other slider in that card is per section, and a song-wide slider in a section card would surprise |
| D3 | Guided becomes the same screen with the dock collapsed (the target). Today's step-by-step Guided rail goes. | Follow the target, as you chose it; say if the step rail must stay reachable |
| D4 | The picture's track card shows **Filter cutoff in kHz**. The app's channel tone control is a 4 kHz high shelf (High EQ, in dB). A real per-channel low-pass adds nodes, so the export graph changes. | Keep High EQ, labelled plainly with its dB value; a real filter waits for a new reference |
| D5 | The picture has no Beat grid tab. Without it, drum steps cannot be edited. | Keep a Beat grid tab in the dock |
| D6 | The picture gives **Texture** its own audio lane and mixer strip. Today Texture is the open hats, which play through the same mixer channel as the Drums' hats; a Texture channel of its own changes the export graph. | Keep the graph through phase 2: the Texture lane stays a view of the open hats, with no strip of its own; revisit with D1's new reference |
| D7 | Version numbers: the bug releases as 13.8.0-rc.17 to rc.20, the layout as 13.9.0-rc.1 onward. CHANGELOG at `docs/CHANGELOG.md` (not the site root). | As written |

## 7. Self-review against the spec (2026-10-25)

- Every LAYOUT item 1–5, EASE OF USE line, VISUAL SPEC line, RESPONSIVE line and ACCEPTANCE line maps to a stage:
  top bar S7; Sounds S8 (icon rail S8); Arrangement S9–S11; dock and mixer S12; inspector S6; first run S1; tooltips,
  preset drop, one-step edits S15; click-to-select S6/S12 (already true for lanes and sections, kept by tests);
  Guided S14; palette and type S5; glow S10/S11; 1280 slide-over exists (rc.15) and stays under S17's checks; phone
  S16; screenshot, console, overflow, undo and export sweeps S17; commits per stage and CHANGELOG in every release.
- Philip's decisions: 1 (this plan, `/rc/` only, approval first), 2 (S1–S4), 3 (S6), 4 (S10, S12 strips stay three),
  5 (S5), 6 (S1), 7 (D1, no limiter), 8 (section 5).
- Gaps found and closed: the release tools' loss (S0); the first-run demo would have changed every test's starting
  project (S1's runner default); "Ask Aura covering the dock toggle" does not reproduce, so the real overlap (the
  right panel) is fixed in S6 and the rest is guarded.
- Open: the per-stage task plans (written before each stage, by design); D0–D7.
