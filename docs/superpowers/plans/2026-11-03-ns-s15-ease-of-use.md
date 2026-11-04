# S15 Ease of use — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Philip's priority (2026-10-31): "Studio shows 20+ controls at once with no starting point — show one clear first
action for a beginner, with meters and readouts quiet until playing." Plus a plain-words tooltip on every control (jargon
explained); a preset card dragged onto a track's lane gives that track its sound; each energy slider and each Apply one
undo step, and each Apply heard in the export.

**Architecture:** a beginner is someone who has not pressed Play yet on this device (`aura-played`, set on the first Play,
kept). Until then exactly one control is styled primary: ▶ Play, labelled. Export, Apply and Ask Aura wear the secondary
style; after the first Play everything returns to how it looks today. The Master's File line shows nothing before a
first Play (S, I and TP already show —). Tooltips: every visible control gets a `title` in plain words; a jargon table
explains LUFS, dBTP, EQ, sends, Pan, Mute and Solo, Snap and the energy words. Drag and drop: a featured card carries its
preset id; a lane's head and body accept it when the preset is for that track (Keys, Bass, the pad), one undo step.

**Spec:** roadmap row S15 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); Philip, 2026-11-03: "Finish
everything before I review it."

## Decisions made before building (Philip may overrule; reported)

- **The one first action is ▶ Play** (the first visit opens on the demo; hearing it is the first step). The roadmap row
  asks for exactly one primary action and does not name it.
- **"Beginner" ends at the first Play** on this device, not at the end of the tour.
- **A preset only drops on its own track's lane:** Warm keys, Air texture (a pad), Electric piano and Nylon pluck on
  Keys; Deep pulse on Bass; Bright lead, Pluck lead, Soft bells and Velvet lead on Melody. A drop on another lane changes
  nothing and says where that sound goes: a preset is a sound for one instrument, never moved to another.

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s15-ease` (on S14). One test at a time; a mutant for each.
- Saved state unchanged except the new device flag `aura-played` (not in the project).
- Version 13.9.0-rc.13.

## Checks (dashboard-n, `n15*`), in the order they are written

1. `n15OneFirstAction@1440,1280,390`: a first visit, tour closed: exactly one primary-styled control on screen, ▶ Play,
   visible without scrolling; after the first Play, Export is primary again.
2. `n15QuietUntilPlaying`: a first visit before Play: every meter empty, no meter paints, S, I, TP and the File line show
   no numbers.
3. `n15Tooltips`: every visible control in Studio at 1440 has a plain-words tooltip; the jargon controls' tooltips
   explain the term.
4. `n15DropPreset`: a featured card dragged onto its track's lane gives that track the sound, one undo step; dropped on
   another lane it changes nothing and says where it goes.
5. `n15SliderOneStep`: each of Intensity, Warmth, Movement and Space, dragged, is one undo step.
6. `n15ApplyInExport`: an Apply changes the exported audio (and Undo puts the export back).

## Progress

- [ ] 1 · [ ] 2 · [ ] 3 · [ ] 4 · [ ] 5 · [ ] 6 · [ ] mutants · [ ] bump · [ ] gate · [ ] publish
