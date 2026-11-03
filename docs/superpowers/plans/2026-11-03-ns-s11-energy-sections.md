# S11 Energy and sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the energy lane and section strip of `docs/mockups/studio-dashboard-target.png`: the lane's name and legend in
the track-name column, a 0 / 50 / 100 scale, the Target curve filled beneath with one point per section that can be
dragged (it sets that section's Intensity, as the Shape panel's slider does: one undo step), the Measured curve dotted;
the sections as coloured blocks that can be dragged along the song and resized, the active one lit.

**Architecture:** `paintDashEnergy()` draws the lane on its canvas; each section's point is a button over it, placed at the
run's centre and its Target. A point drag sets the section's Intensity through the same path as `#drInt` (the run's Target
redrawn from `energyTransform`), saved once on release. Section blocks (`#saSecs .sa-sec`) move through `songMoveTo` and
resize through `songResize`, the arrangement's own writers (energy follows them), one undo step a gesture.

**Spec:** roadmap row S11 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); Philip, 2026-11-03: "Finish
everything before I review it. Should look like attached."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s11-energy` (on S10). One test at a time; a mutant for each.
- A section's colour is its section slot's (six), not a new saved field.
- Version 13.9.0-rc.9.

## Checks (dashboard-n, `n11*`), in the order they are written

1. `n11Scale`: 100, 50 and 0 beside the plot at its top, middle and floor; the lane's name and legend in the track-name
   column (not over the plot); the Target curve filled beneath.
2. `n11DragPoint`: one point per section at its run's centre and Target; dragging a point up raises that section's
   Intensity (as the slider shows it) and its Target; one undo step; Undo restores.
3. `n11SectionDrag`: dragging a section block along the song moves its bars (onto empty bars); one undo step.
4. `n11SectionResize`: dragging a block's right edge lengthens or shortens it; one undo step.
5. `n11SectionLook`: each block in its slot's colour; the active one lit (a glow), the others not.

## Decisions made while building

- **Section colours by slot**, six of them, from the picture's Intro, Verse, Build, Chorus and Resolve (and one more):
  not a new saved field, so `e1Saved` is untouched.
- **A point drag selects its section**, so the Shape panel shows the Intensity being set.

## Found on the way

- My first fill check sampled a column on a bar's grid line; it now samples the middle of a bar.
- **TDD miss, reported:** `n11SectionResize` was written after the resize code (a guard, proven by the mutant that turns
  resizing into a move). The mutant `sec-click-after-drag` survived the first `n11SectionDrag` (synthetic pointer events
  send no click); the check now sends the click a browser sends, and the mutant dies.

## Progress

- [x] 1 · [x] 2 · [x] 3 · [x] 4 · [x] 5 · [x] mutants (11) · [ ] bump · [ ] gate · [ ] publish
