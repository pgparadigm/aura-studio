# S14 Guided = the same screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** D3: Guided becomes the Studio screen with the dock collapsed and only Sounds, sections, Energy and Aura
guidance active. Today's step-by-step Guided screen (the 1 to 6 step rail, its rooms, the Vibes and Customize drawers
over the beat grid) goes on a desktop.

**Architecture:** two ideas the code ran together are separated. `guided` stays the MODE (the Guided | Studio switch,
saved as `aura-mode`). The old Guided LAYOUT (`body.guided`, about 100 CSS rules) stays only on a phone, until S16. On a
desktop, Guided shows the Studio dashboard with `body.gmode`: the dock's editor hidden (its tab row stays, as the
collapsed dock), and the lanes, the dock and the selected-track card made `inert` and dimmed. Every dashboard render
gated on `!guided` is gated on the classic layout instead.

**Spec:** roadmap row S14 and D3 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`; Philip took D3's
recommendation, 2026-10-31); Philip, 2026-11-03: "Finish everything before I review it."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s14-guided` (on S13). One test at a time; a mutant for each.
- Saved state and export unchanged. Phones (≤ 767 px) unchanged until S16.
- Checks that test the removed desktop step rail are retargeted or retired one by one, each named in the CHANGELOG.
- Version 13.9.0-rc.12.

## Checks (dashboard-n, `n14*`), in the order they are written

1. `n14GuidedSameScreen@1440,1280`: in Guided the top bar, Sounds, the sections, Energy and the right panel sit where
   Studio puts them (±2 px); no step rail or classic room shows; the dock is collapsed (its editor hidden) and the
   arrangement takes the room.
2. `n14GuidedInactive`: in Guided, Sounds (search), the sections (a click selects), Energy (a point's arrow keys) and
   the guidance card work; the lanes, the collapsed dock and the selected-track card are inert and dimmed.
3. `n14Toggle`: Guided and Studio switch without changing the project or the selected section; the mode is kept
   across a reload; at 390 px Guided is still the phone screen.

## Progress

- [ ] 1 · [ ] 2 · [ ] 3 · [ ] retargets · [ ] mutants · [ ] bump · [ ] gate · [ ] publish
