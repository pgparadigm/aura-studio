# Studio dashboard, sub-project B: drag integrity, one grid, honest lanes

Date: 2026-09-24 · Build base: `main` 8b22032 (13.8.0-rc.3, sub-project A proved live) · Owner: the
"Aura Studio" Claude session, sole writer · Status: **spec only, awaiting Philip's build word**

## Order, as Philip set it

1. **B1. A drag never corrupts the arrangement** (claim C13). Ships first.
2. **B2. One grid, one playhead across every row** (claim C7).
3. **B3. Empty Atmosphere and Voice show nothing** (claim C17).
4. **B4. Selection follows the edit, and lanes are reachable by keyboard.** Small, and only what B1 to
   B3 touch.

C, D and E are not started. The clip-editing work in B1 is limited to making the existing drag and
trailing-edge resize correct; loops, audio trim and fade, splitting and automation stay in D.

## What was measured (A4, local and live, 8b22032)

| Claim | Measurement |
|---|---|
| C13 | One continuous drag, +2 bars then on to +12, turned the 8-bar Intro (bars 1–8) into two runs, bars 9–10 and 13–20: 10 filled bars instead of 8, and 2 undo entries for one gesture |
| C7 | The playhead moves but spans only the energy strip (y 217–303 at 1440×900); the lanes are at y 308–420. The energy strip spans x 299–1116; the lanes' row spans x 291–1124 and starts its timeline after a 128 px header |
| C17 | With no import and no take, the Atmosphere and Voice lanes each draw one clip across the arrangement |

## Causes, from the code

- **C13.** `dashClipPointer` calls `songMoveTo(start0, ns, …)` on every pointer move, where `start0` is
  where the drag BEGAN. After the first step the run is no longer there, so a later step either fails
  the overlap check (the drag stalls) or clears bars that are already empty and writes the run again
  at the new place, leaving the previous copy behind. Each step also goes through `oneCheckpoint`, so
  one drag writes one history entry per step.
- **C7.** `#saPlayhead` is a child of `#saEnergy`. The three rows use three time axes: `.sa-secs` spans
  the full width with 8 px padding and leaves empty bars out of its blocks; `.sa-energy` spans the full
  width with an 8 px margin; `.sa-lane` puts a 128 px header column before its timeline. In Loop the
  playhead's bar is fixed at 0 (`mode==='song' ? slotIndex : 0`).
- **C17.** In `renderDashLanes`, `if(!show && lane.id!=='atmosphere' && lane.id!=='voice') return;`
  exempts exactly the two lanes whose `has()` is about real audio, so they draw a clip whether or not
  audio exists.

## Design

### B1. Drag integrity (C13)

- **Every step of a drag moves the run from where it is now, never from where the drag began.** The
  handler tracks the run's current start and passes it to the move; the origin is kept only to report
  how far the gesture has gone.
- **A move only lands on empty bars** (other than the run's own). A step that would overlap another run
  is skipped, and the clip holds its last valid place until the pointer reaches a valid one.
- **One undo step per finished drag.** A drag is one transaction: history and autosave are held from
  pointer-down to the end of the gesture, then written once. A drag that ends where it began writes
  nothing. The same rule covers a trailing-edge resize.
- **The gesture always ends.** The clip captures the pointer; the transaction ends on `pointerup`,
  `pointercancel` or `lostpointercapture`, and a new pointer-down on any clip first ends any
  transaction still open, so a lost release can never leave history or autosave switched off.
- **Invariant, checked after every step and at the end:** the number of filled bars and the number of
  runs are unchanged by a move. A resize changes only the resized run's length.

### B2. One grid, one playhead (C7)

- **One time axis for the whole arrangement.** Sections, energy and lanes share a left gutter of the
  lane-header width and a single timeline column. Bar `b` sits at the same x in all three rows, to
  within 1 px, at every width from 768 px up.
- **One bar count.** All three rows and the playhead use the same number of bars (today's
  `max(8, songUsedLen())`), taken from one function.
- **Sections keep their place in time.** Empty bars before or between sections render as gaps, so a
  section's block starts at its first bar.
- **One playhead.** A single line in the timeline column, running from the top of the sections row to
  the bottom of the last lane, and scrolling with the arrangement. It is moved by the existing
  `paintPlayhead` hook.
- **Loop mode.** While a section loops, the playhead moves within that section's bars instead of
  sitting at bar 1.
- The energy curve is drawn and hit-tested on the same column, so a stroke at bar `b` lands on bar `b`.

### B3. Empty lanes show nothing (C17)

- Atmosphere draws a clip only when an import is loaded; Voice only when a take exists. Otherwise the
  lane keeps its header (name, M, S) and an empty body. No placeholder clip, no waveform.
- The lanes redraw when an import arrives or is removed and when a take is recorded or cleared, so
  the clip appears and disappears without a page reload.
- Wording stays as the notes require: the Atmosphere clip is the imported reference, never "stems".

### B4. Selection follows the edit; lanes by keyboard

- After a finished move or resize, the moved run stays selected: the clip keeps its highlight, the
  rail's section line shows its new bars, and the mixer highlight is unchanged.
- Lane headers become buttons, so Tab reaches each lane and Enter or Space selects it, with a visible
  focus ring. Selection by pointer is unchanged.

## Out of scope for B

Clip loop, split, audio trim and fade, automation (D); energy that rewrites density and accents (C);
drum group and dB meters (E); keyboard moving of clips. Guided mode and phones (≤767 px, classic shell)
are unchanged.

## Verification

Test-only module `qa/dashboard-b.qa.js` beside A's; RED on 8b22032 first, then GREEN, then live.

- **B1:** drag the Intro by +2, +5 and +12 bars in one continuous gesture, then back left past its
  origin: filled bars and run count unchanged after every step; exactly one undo entry for the whole
  gesture; one Undo restores the pre-drag `serialize()` exactly. A drag onto an occupied run holds
  the clip. A drag released where it began adds no undo entry. A gesture ended by `pointercancel` still
  writes its one entry, and the next unrelated edit autosaves normally (history is not left off). The
  same for a trailing-edge resize. A mutation run that restores `start0` must fail these checks.
- **B2:** at 1024, 1280 and 1440, for bars 1, 5 and the last bar, the x of the section edge, the energy
  bar, each lane's bar and the playhead agree within 1 px. The playhead spans from the sections row's
  top to the last lane's bottom, including when the arrangement scrolls. In Loop on a later section,
  the playhead moves inside that section's bars.
- **B3:** fresh project: Atmosphere and Voice have zero clips. After loading Aura's demo song:
  Atmosphere has one clip, without a reload. After clearing the import with the Sound room's Clear
  (`#smpClear`): zero again, without a reload.
- **B4:** after a drag, the moved clip is selected and the rail's section line names its new bars; Tab
  reaches a lane header and Enter selects that lane (lane highlight, mixer strips, rail track).
- **Regression:** A's checks (`layout`, `a1`, `a2*`, `a3*`, `claimsA/B/C`) all pass, with C7, C13
  and C17 now passing; network law unchanged (`fetch(` count 1, in `loadSampleUrl`).
- **Ship gate:** fresh loads at 375, 1024, 1280, 1440 and one live shrink 1440 → 375 (screenshot before
  measuring). Page wider than the viewport, or the Welcome ✕ off screen, blocks the ship. `main` must
  still be `8b22032` immediately before the push.

**What these checks do not establish:** a real finger drag on a touchscreen (pointer events are
dispatched by script, plus one real mouse drag at the end), Safari, and how a moved arrangement sounds.

## Release

`APP_VERSION` and every `?v=` string 13.8.0-rc.3 → 13.8.0-rc.4. Commits on `wt/rc-fixes`; pushed to
`main` only on Philip's build word; proved on live by hash, the ship gate, and the B checks.
