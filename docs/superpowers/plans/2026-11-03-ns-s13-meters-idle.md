# S13 Meters idle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the meters write nothing while nothing plays. Today `paintMeters()` runs on every animation frame and every
100 ms whether or not anything sounds, rewriting every meter's style each time (the audit's "about 40 a second").

**Architecture:** `paintMeters()` (rc/app.js) already decays each side (peak falls 20 dB/s, hold 1.5 s, RMS 300 ms).
It stops its loop once nothing is producing sound and every meter has fallen to rest, and starts again when sound
starts (play, record, an audition, a take or song preview: anything that sends meter data above the floor). The meter
data itself keeps coming from the AudioWorklet; only the painting sleeps.

**Spec:** roadmap row S13 (`docs/superpowers/plans/2026-10-25-aura-north-star.md`); S15's "meters and readouts quiet
until playing"; Philip, 2026-11-03: "Finish everything before I review it."

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/s13-meters` (on S12). One test at a time; a mutant for each.
- Export, saved state and the meter readings themselves unchanged (`e1Saved`, `e2*`).
- Version 13.9.0-rc.11.

## Checks (dashboard-n, `n13*`), in the order they are written

1. `n13IdleNoPaint`: with the mixer showing and nothing playing, no meter element's style changes over a second; after
   a play and Stop, the meters fall to empty and then go quiet the same way.
2. `n13PlayingPaints`: while the song plays, the meters write at least 20 times a second and show the sound.
3. `n13OneLoop`: hiding and showing the page several times does not add painting loops (each cycle used to start
   another 10 Hz timer that was never cleared).

## Found on the way

- **The first measure could not see the problem:** a MutationObserver saw no change while idle, because rewriting an
  unchanged inline style makes no mutation; the waste is the loop itself. The check now reads the meters' paint counter
  (a new `__auraMix.meterPaints()`, instrumentation only) and, in WebKit, counts the clip-path writes (Chromium exposes
  CSS properties through an interceptor that cannot be wrapped; the check reports null there rather than zero).
- **My own test bug, caught by a red that did not match the code:** when the writes could not be counted, the helper
  returned before its window elapsed, so Chromium read 0 paints even while playing.
- **A leak:** `startMeters()` added a 10 Hz interval each time the page came back from hidden, never cleared.
- **TDD, reported:** `n13PlayingPaints` and `n13OneLoop` were written after their code (the wake was needed for check 1;
  the leak was fixed while restructuring the loop). `n13OneLoop` is red on the rc.10 tree in WebKit (1920 writes a second
  before five hide-and-show cycles, 4176 after); both are proven by mutants.
- The findings panel's "close with the mixer" rode on the meter loop; it now runs from the editor and shell switches.

## Progress

- [x] 1 · [x] 2 (guard) · [x] 3 (guard) · [x] mutants (5) · [ ] bump · [ ] gate · [ ] publish
