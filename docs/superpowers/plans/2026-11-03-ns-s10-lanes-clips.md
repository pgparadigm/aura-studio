# S10 Arrangement: lanes and clips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the lanes of `docs/mockups/studio-dashboard-target.png`: each head with the lane's colour edge, its instrument
icon, name, lock where there is one, M, S and record-arm; the Voice group (Lead, Double, Harmony) folding into one row;
MIDI clips that show their notes, audio clips that show their sound; the selected clip lit; Ctrl-drag copies a clip.

**Architecture:** `renderDashLanes()` in `rc/app.js` builds each row from `DASH_LANES`. Note previews are drawn from the
pattern data each clip plays (a mini piano roll per bar of the run); audio waveforms from the take's or the import's
own buffer (peaks read from the samples: no audio is rendered). Ctrl-drag copies through the song's own duplicate path,
one undo step.

**Spec:** roadmap row S10 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); Philip, 2026-11-03: "Finish
everything before I review it. Should look like attached."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s10-lanes` (on S9). One test at a time; a mutant for each.
- No control without a job: record-arm only on vocal lanes (Aura records voice, not MIDI); Melody's lock is Preserve's
  toggle, Voice's the badge (Aura never changes the voice).
- Saved state unchanged unless a check says so (the Voice group's fold is this device's view, not the song's).
- Version 13.9.0-rc.8.

## Checks (dashboard-n, `n10*`), in the order they are written

1. `n10LaneHead`: every head shows its colour edge (the lane's colour), an icon in that colour, the name, M and S;
   the vocal lanes a record-arm that arms that track; Melody a lock that is Preserve's; the Voice row the badge.
2. `n10VoiceGroup`: Lead, Double and Harmony fold into one Voice row (the picture) and unfold; the fold is kept.
3. `n10NotePreview`: each MIDI clip shows its notes: as many marks as the pattern plays in the bars it covers, each at
   its step.
4. `n10Waveform`: a take's clip and the import's clip show their own audio (a quiet part draws low, a loud part high).
5. `n10SelectedGlow`: the selected clip is lit (its border and a glow), the others not.
6. `n10CtrlDragCopy`: Ctrl-drag copies a clip to the bar it is dropped on; the original stays; one undo step.

## Progress

- [ ] 1 · [ ] 2 · [ ] 3 · [ ] 4 · [ ] 5 · [ ] 6 · [ ] mutants · [ ] bump · [ ] gate · [ ] publish
