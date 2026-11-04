# S12 Dock and mixer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the dock of `docs/mockups/studio-dashboard-target.png`: the tab row (Mixer, Beat grid, Piano roll, Lyrics,
Vocal coach, Perform) with Mix check and Sources at its right; mixer strips of equal width, each with the track's icon
and name, its dB readout, stereo LED meters, fader, a pan knob with L and R, M and S; the selected track's strip lit;
picking a track lights its strip and picking a strip picks its track.

**Architecture:** `buildMixer()` in `rc/app.js` builds every strip once; the Studio dock shows it as `#mixer.compact`
inside `#studioEdHost`. New parts are added to the strips `buildMixer()` already makes and shown only in the compact
mixer (the classic mixer outside Studio keeps its layout). The pan knob is a second view of the channel's Pan (the same
`mix[id].pan`, the same live write and the same save as the Pan slider below). The meters are the live AudioWorklet
meters already there (two sides, L and R; a zero-gain sink, never in the export), restyled as LED columns. Mix check is
the existing `#mixCheckBtn` moved into the tab row; Sources opens the existing Rights & Sources card.

**Spec:** roadmap row S12 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); Philip, 2026-11-03: "Finish
everything before I review it. Should look like attached."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s12-mixer` (on S11). One test at a time; a mutant for each.
- The export graph does not change (`e2ExportGraph`); saved state does not change (`e1Saved`).
- Decision 4: the voice strips stay three (Lead, with Double and Harmony behind its arrow, as rc.12 has them). D5: the
  Beat grid tab stays.
- Version 13.9.0-rc.10.

## Checks (dashboard-n, `n12*`), in the order they are written

1. `n12Tabs`: the dock's tabs in one row, in order, and at the row's right end a Mix check button and a Sources button
   on the same line; Mix check runs Check my mix; Sources opens the Rights & Sources card.
2. `n12StripParts`: every visible channel strip shows its track's icon (in the lane's colour), its whole name, a dB
   readout above the meter, a meter, a fader, a pan knob with L and R, M and S; the knob sets that channel's Pan
   (Arrow keys, a drag; double-click centres it) and the Pan slider below shows the same value.
3. `n12EqualWidth@1440,1920`: every visible strip, the Master's too, is the same width (±1 px), no name is cut, and
   the strips fit the dock without sideways scrolling.
4. `n12SelectedStrip`: picking a lane lights its strip (a violet border and a glow) and no other; clicking a strip picks
   its lane.
5. `n12StereoMeters`: each meter is two LED columns (L, R), segmented, green at the floor and amber near the top; with
   Bass panned hard left and playing, Bass's L column rises and its R column does not.

## Decisions made while building

- **No pan knob on the Master:** the picture shows one, but there is no master pan in the graph, and adding one changes
  the export graph (`e2ExportGraph` holds it).
- **The selected channel's row stays under the strips** (Pan, Low, Mid, High, Reverb, Delay): the picture has none, and
  without it Low and Mid EQ and the sends could not be reached.
- **The Master's loudness readouts stay**, in a column of their own beside the Master (not in the picture; they are what
  Check my mix's targets are read against). Mix effects and Reset mixer sit under them in Studio; elsewhere both, and Mix
  check, go back to the mixer's head (one button each).
- **The Drums knob moves Kick, Snare and Hats by the same amount** (their spread holds), as the Drums fader does for level.
- **The dB above each meter is the fader's setting** (as before), not a live reading.
- ~~With Drums or the voices unfolded the strips keep 88 px and the row scrolls sideways~~ `superseded`: E's `e4Fits`
  (an approved earlier rule) requires no sideways scroll with a group open; found by the full Chromium run on the S15
  tree. Now the strips share the row (67 px at 1440, 77 at 1024), names without icons a size smaller, every name whole.
  The Master's −6 dB label is dropped in the dock: it overlapped 0 at that height.
- **Process miss, reported:** S12 was checked with its own checks only; the full suites found `e3Select` (retargeted:
  lit border and glow as well as an outline) and `e4Fits` (fixed) only on the S15 tree.

## Found on the way

- **TDD deviation, reported:** `n12StripParts` needed whole names, which needed the equal-width layout, so the layout came
  before `n12EqualWidth` was written. That check is a guard: red on the rc.9 tree (68 px strips, a 176 px Master,
  "Atmosphere" cut) and killed by a mutant that gives the Master its old width. My first mutant for it survived because
  it did not actually restore that width (`flex:1 1 0` overrode it): a weak mutant, replaced.
- WebKit sets "Atmosphere" about 2 px wider than Chromium; the names are tightened so both fit at the 88 px minimum.

## Progress

- [x] 1 · [x] 2 · [x] 3 (guard) · [x] 4 · [x] 5 · [x] mutants (14) · [ ] bump · [ ] gate · [ ] publish
