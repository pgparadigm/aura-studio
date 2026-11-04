# S9 Arrangement: ruler and view — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the arrangement's head and ruler in `docs/mockups/studio-dashboard-target.png`: "Arrangement" with Snap (Bar,
Beat, Step, Off), a zoom slider between − and +, and Fit; a bar ruler (numbers spaced so they never crowd, a tick each
bar, the playhead's mark); zoom that widens every row together while the track names stay put; the playhead kept in
view while playing zoomed in; 36 px track rows.

**Architecture:** `#studioArr` is already the scroll container and places sections, energy, lanes and clips by bar as a
share of the lane body's width, so zoom is one CSS variable (`--sa-zoom`) that widens those rows; heads and the energy
labels stick to the left. The ruler is a new row placed the same way. Snap applies where positions are finer than a
bar: a take's move (by whole units, so its own timing against the beat is kept); Split stays where you press
(`d3Voice`). Trims are not snapped (decided while building: a take shorter than a bar has no bar line inside it, so a
bar-snapped trim would jump out of range).

**Spec:** roadmap row S9 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); Philip, 2026-11-03: "Finish everything
before I review it. Should look like attached."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s9-arrange` (on S8). Root 13.6.0-rc.3 never touched.
- **One test at a time** (memory: feedback-tdd-one-test-at-a-time). A mutant for each.
- Saved state unchanged (`e1Saved`): Snap and zoom are this device's view settings, not the song's.
- Version 13.9.0-rc.7.

## Checks (dashboard-n, `n9*`), in the order they are written

1. `n9RowHeight@1440,1920`: every track row is 36 px (±1).
2. `n9Ruler@1440,1920`: a ruler above the sections; its bar numbers sit over the lanes' bar lines (±1 px), at least
   24 px apart, starting at 1; a tick each bar.
3. `n9ZoomFit`: zoom 4× makes the lane bodies 4× as wide (±2 %), the arrangement scrolls sideways, track names stay in
   place, the ruler, sections, energy and lanes stay aligned at bar 5; Fit returns to the whole song with no sideways
   scroll; − and + step it.
4. `n9PlayheadFollows`: at 4× while playing, the view scrolls so the playhead stays on screen.
5. `n9Snap`: a take dragged 1.3 bars moves 1 bar (Bar), 1.25 (Beat), 1.3125 (Step), 1.3 (Off), each one undo step;
   the choice is kept across a reload.

## Progress

## Found on the way

- The energy strip sat 1 px wider than the lanes on each side; zoom multiplied it (3 px off at 4×). It takes the lanes'
  offsets now.
- Rows were 44 px at 1440 and 46 at 1920: a 44 px minimum plus the 1 px borders, squeezed by the column at 1440.
- **Process miss, reported:** S9 was checked with its own checks only. The full suites, first run on the S15 tree, found
  two regressions from this stage: `claimsB` C7 (retargeted: it measured the lanes box's padding) and `e15Height` (fixed:
  32 px reclaimed; retargeted at 1512 where all lanes already show).

- [x] 1 · [x] 2 · [x] 3 · [x] 4 · [x] 5 · [x] mutants (9) · [ ] bump · [ ] gate · [ ] publish
