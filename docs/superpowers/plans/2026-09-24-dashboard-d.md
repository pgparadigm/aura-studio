# Dashboard sub-project D (clip editing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Edit clips where they sit (split at a chosen bar, repeat, make one its own, remove, open the lane's real note editor, edit voice clips in place, see where the reference plays) without ever losing music silently, with the drawn Target moving with the bars.

**Architecture:** All run operations stay in the existing `song*` functions (shared by the dashboard and the Song view); D makes them safe (a free-slot rule that never overwrites music, a Repeat guard, exact copies) and gives them one Target remap helper. A clip bar in the arrangement drives them. Voice clip edits go through the take room's own functions and history; the reference through the section's. No new persisted fields.

**Tech Stack:** static `rc/app.js` IIFE, `rc/index.html`, `rc/styles.css`; test-only ES modules under `qa/` run in the browser pane.

**Spec:** `docs/superpowers/specs/2026-09-24-dashboard-d-design.md` (decisions: Remove closes the gap; the Target follows every arrangement edit incl. B's drag and the Song view buttons; voice clip edits undo through the take's history, Cmd+Z stays the project's).

## Global Constraints

- Base `main` bfe3c45; sole writer; stop if `main` moves. Do not start E; do not promote `/rc/`; do not merge `v13.7-recording-confidence`; do not compact the shared memory index; do not touch `evict.py`.
- Ship gate: 375, 1024, 1280, 1440 fresh plus one live shrink 1440 → 375; width never exceeds the viewport; the Welcome ✕ stays on screen.
- A 18/18, B 9/9, C 8/8 must still pass. Split-overwrite and Repeat-off-the-end must FAIL on a mutant.
- Network law: exactly one `fetch(`, inside `loadSampleUrl`.
- Audio is never saved (`MEDIA_PERSISTENCE` unchanged); every MIDI/arrangement action is one checkpoint (one Undo).
- Version 13.8.0-rc.5 → 13.8.0-rc.6.

---

### Task 1: D checks and RED on bfe3c45

**Files:** Create `qa/dashboard-d.qa.js`.

**Interfaces produced (the build must provide these for GREEN):**
- `#saClipBar` (hidden when no clip is selected) with `#saClipName` (label) and `#saClipWhy` (visible reasons for disabled actions); buttons `[data-act]`: MIDI `split`, `repeat`, `own`, `remove`, `edit`; voice `fadein`, `fadeout`, `vsplit`, `vundo`; atmosphere `part`, `whole`.
- Test hooks on `__auraSuite`: `songRemoveBlk(start)`, `songOwnBlk(start)`, `refRunsOnce()`.
- Editor tab `data-ed="grid"`; the focused grid row carries class `dash-focus`; the editor host starts with `.ed-note`.
- Clip datasets: voice clips `data-take-id`; the atmosphere clip `data-mode` (`once`|`loop`) and child `.seam` per loop boundary.

Checks (each on a fresh load; projects built by patching `buildFile()` and reopening with `openFile()`):

- [ ] `d1SplitNeverErases`: pattern 2 holds a melody and is unarranged; Alt-press the Intro drums clip at 75%; pattern 2's melody intact and the second half is NOT pattern 2. Then melodies in patterns 2–6 (none free): Alt-press; song and every melody unchanged.
- [ ] `d1SplitExact`: pattern 1 bass with `g:1`; song [0×4, 1×4]; press the pattern-1 clip at 25% (bar 5) and use `split`; runs become [1,4,5] and [k,5,8]; pattern k's `lo`, `pat`, `acc`, `mel` equal pattern 1's; one Undo restores the snapshot exactly.
- [ ] `d1RepeatNoLoss`: song [0×8,1×8,2×8,3×8]; `songDupBlock(0)` returns false and the song is unchanged; the `repeat` button is disabled and `#saClipWhy` says why (/fall off/); with room ([0×8]) Repeat gives [0×16] and one Undo restores.
- [ ] `d1OwnRemove`: song [0×4,1×4,0×4]; select the clip at 8, `own`: song [0×4,1×4,k×4], pattern k equals pattern 0, name ends " 2"; label of the clip at 0 before that said "also plays at 9–12"; `remove` on the clip at 4 closes the gap; one Undo each restores.
- [ ] `d4TargetFollows`: Target 20/50/80 on sections at 0–3, 4–7, 8–11 (patterns 0,1,2 with drums); Repeat at 4 → Target [20×4,50×8,80×4]; reload; Remove at 0 → [50×4,80×4]; reload; drag the section at 8 to 12 (empty) → Target 80 at 12–15.
- [ ] `d2Editors`: double-click Drums → tab `grid`, host holds `#grid`, `tr.dash-focus` is the kick row, `currentPattern` is the clip's; Keys → first chord row; Texture → open-hat row; Melody → tab `piano`; Bass → message /no bass note editor/ and the tab does not change; the host's `.ed-note` names the section and its bars.
- [ ] `d3Voice`: a synthetic 4 s take through `takeInstall`; `takeSplit(2)`; the Voice lane shows one clip per take clip at `at·bpm/240` bars; select → `fadein` sets fadeIn 0.12 with one take-history entry; a body drag of one bar moves `at` by 240/bpm s with one entry; `vsplit` adds a clip; `vundo` reverts the last; the project snapshot is identical before and after all of it.
- [ ] `d3Atmosphere`: demo arrangement; the clip's `data-mode` equals `refRunsOnce()`; in loop mode `.seam` count equals ceil(arranged s / loop s) − 1; `part` puts `#refSect` in the editor host; `whole` makes `refRegionRead().whole` true.
- [ ] `d0Guidance`: Apply at 90 → `#drGuide` does not ask for more lift; Apply at 5 → it does.
- [ ] RED at 1440 on bfe3c45, fresh loads; record each failure reason. Commit `qa: dashboard D checks; RED on bfe3c45`.

### Task 2: Safe run operations and the Target that follows (D1 core, D4)

**Files:** Modify `rc/app.js` (run functions ~1537–1640, Song view acts ~1783–1795, `songMoveTo` ~12865, hooks).

**Produces:** `patternHasNotes(i)` counts bass; `songFreeSlot()` → first pattern not in the song AND without notes, or −1; `songCopyPattern(from,to)` exact copy (notes with every field via `Object.assign`, accents, stored Shape values); `songDuplicateRoom(start)` → `{ok, why}`; `songMakeOwn(start)`; `energyRemap(src, fill)`.

- [ ] `energyRemap(src, fill)`: if `energyDoc.target` is an array, `t'[i] = src[i] >= 0 ? t[src[i]] : (fill[i] ?? t[i])`; called inside each operation's checkpoint. Maps: resize grow fills new bars with the run's last value; swap maps both runs; duplicate copies the run and shifts the tail; remove shifts left and fills the vacated tail with 0.35; `songMoveTo` maps the moved bars. Split and own do not move bars.
- [ ] `songSplitBlock`: use `songFreeSlot()` and `songCopyPattern`; unchanged signature `(start, offset)`.
- [ ] `songDuplicate`: refuse when `songDuplicateRoom(start).ok` is false (anything would pass bar 32).
- [ ] Song view: "Repeat it" disabled with `songDuplicateRoom().why`; "Split in two" uses `songFreeSlot()`.
- [ ] Hooks `songRemoveBlk`, `songOwnBlk`.
- [ ] GREEN `d1SplitNeverErases`, `d1RepeatNoLoss`, `d4TargetFollows` (UI parts wait for Task 3). Mutants: free slot back to "not in the song" → `d1SplitNeverErases` FAIL; guard removed → `d1RepeatNoLoss` FAIL; remap removed → `d4TargetFollows` FAIL. Restore by hash. Commit.

### Task 3: The clip bar (D1 UI)

**Files:** `rc/index.html` (`#saClipBar` after `#saBar`), `rc/styles.css`, `rc/app.js` (`paintClipBar`, clip pointer marks the pressed bar, Alt-split at the pressed bar, keyboard).

- [ ] A press on a MIDI clip records `dash.clip.at` (bar offset under the pointer, clamped 1..bars−1); the end of an unmoved gesture keeps it. Alt+press splits at that offset (fixes the absolute-bar bug: today it passes `start+bars/2` as an offset).
- [ ] `paintClipBar()` after every arrangement render and selection: name + bars + "also plays at …"; MIDI actions with reasons for each disabled one in `#saClipWhy`; Remove = `songRemoveBlock` (closes the gap); Make its own = `songMakeOwn`.
- [ ] Keyboard in `#studioArr`: Enter → edit, Delete/Backspace → remove.
- [ ] GREEN `d1SplitExact`, `d1RepeatNoLoss` (button), `d1OwnRemove`. Commit.

### Task 4: The right editor (D2)

**Files:** `rc/index.html` (etab `grid` "Beat grid"), `rc/app.js` (`setStudioEditor('grid')`, `dashEditClip`, Texture `kind:'midi'`), `rc/styles.css` (`.dash-focus`, `.ed-note`).

- [ ] `setStudioEditor('grid')`: `showView('rack')`, park `#stepbar` and `#grid`'s `.grid-wrap` into the host.
- [ ] `dashEditClip(lane, pat)`: drums/texture/keys → grid with the kick / open-hat / first-chord row `.dash-focus` scrolled into view; melody → piano; bass → toast, no switch; `.ed-note` names the section and its bars. Double-click and Edit notes both call it.
- [ ] GREEN `d2Editors`. Commit.

### Task 5: Audio clips (D3)

**Files:** `rc/app.js` (`renderDashLanes` voice and atmosphere branches, voice gestures, clip bar audio actions, `renderTakeRoom` wrapper redraws lanes, hook `refRunsOnce`), `rc/index.html` (none beyond Task 3's bar), `rc/styles.css` (`.seam`, voice clips).

- [ ] Voice: one clip per take clip, left `max(0,at)·bpm/240` bars, width `takeOutLen·bpm/240`; `data-take-id`; body drag = live `c.at` then, on release, restore and `takeMove(id, final)` (one entry; the take room's nudge pattern); edge drag = `takeTrim(id,'end',t)` on release; clip bar: Fade in / Fade out (`takeSetFade` 0.12 / 0.18 toggles), Split here (`takeSplitAt` at the pressed time), Undo clip edit (`takeUndo`), and the sentence that take edits are not saved.
- [ ] Atmosphere: `data-mode` from `sampleRunsOnce()`; once → width = (region length / `sampleRate()`)·bpm/240 bars; loop → arranged length with `.seam` every (region length / rate) s; clip bar: "Loops a–b of name" / "Runs once", Choose the part (`setStudioEditor('ref')` parks `#refCard`, shows `#refSect`), Whole file (`refSectCheckpoint(); refSectWhole()`).
- [ ] GREEN `d3Voice`, `d3Atmosphere`. Commit.

### Task 6: The guidance line (D0)

- [ ] Replace `if(m.energy<0.45)` with `if(energyPct(energyTransform(pat,dashParamsFor(pat)).report,m.energy)<45)`. One line; if it needs more, drop D0. GREEN `d0Guidance`. Commit.

### Task 7: Release, gate, push, prove live

- [ ] rc.5 → rc.6 (1 in `app.js`, 13 in `index.html`); notes doc Phase 3 lines; network law; full local regression (A, B, C, D) at 1440; gate at four widths plus the live shrink; remove the preview launch entry; `main` must be bfe3c45; push; poll live hashes; repeat the gate, D, A, B and C checks on live; record shard and memory; post the D proof table.
