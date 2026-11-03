# S6 Right panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the right panel becomes the picture's four cards (section, selected track, Aura guidance, song tools), every
block on screen with nothing scrolling or covered at 1440x900, 1512x982 and 1920x1113.

**Architecture:** the panel already exists (`#dashRail` in `rc/index.html`, painted by `paintDashRail()` in
`rc/app.js`). S6 reorders and trims it, adds prev/next and a preset dropdown, folds "Apply to whole song" into the
guidance card's Apply, and moves Ask Aura into that card from 1400 px. Below 1400 px the panel stays a drawer
(`.inspect.open`, `#tgInspect`); from 1400 px it is a column (spec, option d).

**Tech Stack:** vanilla JS + Web Audio, no build step; checks in `qa/dashboard-n.qa.js`, jobs in
`qa/dashboard-n.jobs.cjs`, run by `qa/run.cjs` (Playwright-core 1.63, Chromium 153, WebKit 26.6).

**Spec:** `docs/superpowers/specs/2026-10-25-north-star-design.md` (section 1 item 3 and the panel text a-d);
roadmap row S6 in `docs/superpowers/plans/2026-10-25-aura-north-star.md`.

## Global Constraints

- Work in `rc/`, `qa/`, `docs/` only; never the root 13.6.0-rc.3 files.
- Every check seen failing on 13.9.0-rc.1 in both engines first; a mutant that puts the gap back fails it again.
- Full regression from a snapshot **of the bumped copy** (Philip, 2026-11-02): zero failures, only `e12RealRecord`
  NOT RUN in WebKit; `e2ExportGraph`, `e1Saved`, `e2ExportJitter` pass.
- Saved state: a project that never uses a new field saves the same bytes as before (`e1Saved`). A new field is
  written only when used, and the file then asks for the minimum reader schema that can play it (`requiredSchema`).
- Room and Echo leave the panel; their saved values (`en.s`) still load, save and play unchanged.
- Network rule and system font stack unchanged. Version 13.9.0-rc.2.
- Before every git write and every gate: `find <.git common dir> <worktree> -type f -flags +dataless | wc -l` is 0,
  else read each file first (iCloud evicts this folder).

## Open question: RULED (Philip, 2026-11-02, "Finish S6 and ship")

Per-section Warmth is the chords channel's EQ changing at each section's start, and the chord sound moves to the
track card's preset menu, as recommended below. Built as task 3.

### The question as it was put

**How per-section Warmth sounds (D2 settled only its saved state).** Today Warmth acts on Apply on the chords channel's
high and low shelf and leans the chord sound (soul above 65, pad below 35). The mixer has one chords channel for every
section. Recommended: per-section Warmth sets the chords channel's existing high and low shelf gains at each section's
start, live and in the export (no new node; nothing is scheduled when every section equals the song's Warmth, so the
default export graph is unchanged), and the chord sound leaves Warmth for the track card's preset dropdown (task 4).
Task 3 waits for Philip's ruling; S6 does not ship without it.

---

### Task 1: prev/next on the section card (`n6PrevNext`)

**Files:** Modify `rc/index.html` (`#drSecMeta` row), `rc/app.js` (`paintDashRail`, a `dashStepSection(d)`),
`rc/styles.css`; Test `qa/dashboard-n.qa.js`, `qa/dashboard-n.jobs.cjs`.

- [x] **Step 1: the failing check.** For each section start in `#saSecs .sa-sec[data-start]`, in order: `#drNext`
  moves the card to it (the meta reads `BARS <start+1> –`), `#drPrev` walks back; `#drPrev` is disabled on the first
  section and `#drNext` on the last; stepping adds no undo step. Runs at 1440, 1512, 1920 (column) and 1280, 390
  (drawer opened by `#tgInspect`).
- [x] **Step 2:** run it on 13.9.0-rc.1 in both engines; expect FAIL: no `#drPrev`/`#drNext`.
- [x] **Step 3:** add the two buttons beside `#drSecMeta`; `dashStepSection(d)` selects the next or previous run of
  `songRuns()` with a pattern exactly as a click on its section does (`currentPattern`, `songSel`, redraw, paint).
- [x] **Steps 1-4 done (2026-11-02).** Red 10/10 (no buttons), green 10/10; mutants: steps by 2 fails 10/10.
- [x] **Found while building:** picking a section (above the lanes, and so prev/next) spent an undo step at the next
  4-second autosave, because the saved state carries the current pattern (`cp`). Probe: identical in both engines.
  Fix: `selectionNotEdit()` carries only `cp` into the current history entry. `n6PrevNext` waits past the autosave
  (red 10/10 before the fix, green after; mutant without it fails 10/10). `n6PickKeepsEdit` (1440, 390): an edit
  made just before a pick keeps its own step and Cmd+Z takes it back; a whole re-baseline mutant fails it 4/4.

### Task 2: the section card holds the four shape sliders and the Preserve chips (`n6SectionCard`)

- [ ] **Step 1: the failing check.** The first card holds, in this order: the meta row with prev/next; Intensity,
  Warmth, Movement, Space (each 0-100 with its value shown); Preserve chips Voice and Melody (`aria-pressed`). Room,
  Echo and "Apply to whole song" are not in the panel.
- [ ] **Step 2:** run red. **Step 3:** move `#drWarm` and the Preserve group into the first card; remove `#drRoom`,
  `#drEcho`, `#drSongApply` and the song block. **Step 4:** run green; mutant: Room back in, check fails.
- [ ] **Step 5 (`n6SongToneKept`):** a file with `en.s = [60, 80, 70]` opens and saves `en.s` unchanged (saved
  values still play: the mixer values an earlier Apply set are in the mixer state, untouched).

### Task 3: Warmth per section (waits for the open question)

Checks: `n6WarmthPerSection` (moving Warmth in one section leaves the others; one undo step; the export's chords
shelves change at that section's start only), `n6OldFileWarmth` (a pre-S6 file opens with its song Warmth in every
section and saves the same bytes), `e2ExportGraph` and `e1Saved` unchanged for the default project.

### Task 4: the selected-track card leads with a preset dropdown (`n6TrackCard`)

- [ ] **Step 1: the failing check.** With Warm keys selected, `#drTrackBlock` holds, in order: the track name, a
  preset `<select>` naming the chord sounds (Soft Rhodes, E-Piano, Pad, Nylon), High EQ in dB, Reverb send in dB,
  Delay send in dB. Picking a preset changes the chord sound, is one undo step, and the name line follows it.
  Melody offers its sounds the same way; a track without presets shows no dropdown.
- [ ] **Steps 2-4:** red, build on the existing `chordStyle`/`melodySound` setters, green; mutant: the dropdown
  writes nothing, check fails.

### Task 5: Aura guidance's Apply reaches the whole song (`n6ApplyWholeSong`, `n6PreviewNoCommit`)

- [ ] **Step 1: the failing checks.** The guidance card offers Apply for this section and for every section (the
  replacement for "Apply to whole song"); applying to every section changes each section's shape and is one undo
  step; One-step undo restores the snapshot. Preview plays the change and commits nothing: undo depth and the saved
  snapshot are the same after Preview ends.
- [ ] **Steps 2-4:** red, build, green; mutant: whole-song Apply touches only the current section, check fails.

### Task 6: Ask Aura sits in the guidance card from 1400 px (`n6AskInCard`)

- [ ] At 1440, 1512, 1920: `#askOpen` lies inside `#drGuideBlock`'s box and its centre hits itself. Below 1400 the
  existing `n3AskClearBelow1400` still holds. Red, build, green, mutant (button back to its fixed corner).

### Task 7: everything fits (`n6Fits`)

- [ ] At 1440x900, 1512x982, 1920x1113: every card of `#dashRail` lies fully inside the viewport, the panel does not
  scroll (`scrollHeight <= clientHeight + 1`), and the centre of every visible control in it hits that control (at
  1920x1113 One-step undo and the Architect row are covered today). Red, then spacing, green, mutant.

### Task 8: release 13.9.0-rc.2

- [ ] Version bump first, then the full gate on the bumped copy, then commit, push, livehash, liveseen, the S6 checks
  on the live site, the audio check on the live bytes, CHANGELOG and the handoff entry.

## Progress (2026-11-02)

- [x] Task 2: `n6SectionCard` red 10/10, green; Room-back mutant fails it. `n6SongToneKept` (a guard: passes before and
  after) caught a mutant that drops `en.s`. Old checks that drove the removed controls: `c2WholeSong` and claims row C12
  retired, C10 retargeted to the locks' guarantee, `e5Units` without Room and Echo.
- [x] Task 3 (after the ruling): `n6WarmthPerSection`, `n6WarmthSaved` red, green; `n6OldFileWarmth` a guard. Mutants
  (Warmth at every bar, schema left at 3, a missing section Warmth read as 50) each fail their check. Saved as
  `energy.w` only where a section differs from the song; schema 5 only then.
- [x] Task 4: `n6TrackCard` red, green; a menu that writes nothing fails it.
- [x] Task 5: `n6ApplyWholeSong` red, green (equal to applying section by section; One-step undo restores all);
  `n6PreviewNoCommit` a guard, caught a Preview that commits. `applyWholeSong()` removed (no caller left).
- [x] Task 6: `n6AskInCard` red at 1920/1512/1440, green; below 1400 unchanged (`n3AskClearBelow1400` 4/4).
- [x] Task 7: `n6Fits` red (1597-1699 px of panel in 738), green at all three; the keybar folded under Song tools'
  Settings (`n6SettingsOpen`); the no-fold mutant fails 5 of 6 runs.
- Found: at 390 the panel is hidden (S16), so the panel checks run at 1920, 1512, 1440 and 1280 only.
- [x] Task 8, gate: bumped to 13.9.0-rc.2 first. Gate 1 (`results/2026-11-02-ns6-gate`) failed `e4Fits@1440` and
  `e12MixerFits@1440` in both engines: the wider panel left the expanded Drums strips 25 px short (824 in 799).
  Philip's ruling: the Sounds column 30 px narrower below 1500 px (applied 1400-1499; below 1400 the panel is a
  drawer and takes nothing), strip widths untouched. Both checks green (829 px). Gate 2 (`ns6-gate-2`): Chromium
  318/318, WebKit 317/318 + `e12RealRecord` NOT RUN; saved state, export graph, jitter match f304607.
- [ ] Task 8, publish: commit, push, live files and load, S6 checks live, audio on the live bytes, record.
