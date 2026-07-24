# Aura Studio — Redesign & Capability Roadmap

Reference library: `~/Documents/★ Studio` — 153 tracks. Kanye is the centre of gravity
(79 of 83 Unreleased, plus 18 of 70 Instrumental incl. ¥$ / Kids See Ghosts), then a
Persian rap cluster (Mehrad Hidden, Alireza JJ, Arman), UK drill (Central Cee),
and contemporary R&B/trap (Don Toliver, Brent Faiyaz, Travis Scott, Ty Dolla $ign,
Big Sean, Tory Lanez, Drake). Five female reference vocals in `Voice/`.

**What this means for the product:** Aura's existing Kanye lanes (Soul · Chipmunk,
808 · Heartbreak, Gospel · Sunday) and Tehrán · Noir are the right spine. The gaps
against this library are **drill**, **Houston/Toliver-style melodic trap**, and
**modern R&B**, plus the sampling workflow Kanye actually uses.

---

## A. Redesign phases (the UI brief)

| Phase | Contents | Status |
|---|---|---|
| 1 | Audit, design tokens, regression contract, backup | **Done** — `REGRESSION.md`, `DESIGN.md` |
| 2 | App shell: top transport, left Browser, workspace tabs, responsive structure | **Done** — v13 |
| 3 | Channel Rack, Piano Roll, Playlist, Mixer visual redesign | **Done** — v13 / v13.0.1 |
| 4 | Undo/redo, projects (.aura), metronome, keyboard shortcuts | **Done** — v13, schema v2 in v13.0.0 |
| 5 | Testing, accessibility, responsive refinement | **Done** — v13.0.2 / v13.0.3 (desktop 1180–1920, phones 320–430 + landscape) |

**Redesign complete at v13.0.3.** Remaining work is capability, not layout — see v14+ below.

Guided Mode and Studio Mode share one DOM and one state object; the mode only
changes which regions are visible and how much is emphasised.

---

## B. Sample import + "conscious remix"

This is the biggest new capability. Split by what the browser can honestly do.

### B1. Import & analysis — fully achievable offline
- Drag-and-drop or file-picker for WAV/MP3/M4A → `decodeAudioData`.
- **Tempo detection**: onset-envelope autocorrelation over 60–180 BPM. Reliable on
  drum-forward material, offer manual override.
- **Key/scale detection**: chroma vector (12-bin constant-Q-ish FFT) matched against
  Krumhansl profiles → key + major/minor confidence. Feeds Aura's existing scale lock,
  so anything you then draw is automatically in the sample's key.
- **Waveform + transient markers** rendered to canvas.
- **Auto-slice at transients** into pads you can re-sequence on the Channel Rack.

### B2. Manipulation — achievable, this is the Kanye toolkit
- **Chop & re-trigger** slices on the 16-step grid.
- **Pitch/speed**: `playbackRate` (tape-style, pitch+speed linked — exactly the chipmunk-soul
  technique) and a **granular pitch-shift** for pitch-without-speed.
- **Reverse**, **stutter/roll**, **gate**, **filter sweeps**, **saturation/bitcrush**,
  **tape wobble** (LFO on playbackRate).
- **Sidechain the sample to Aura's kick** — the existing ducker already does this.
- **Loop-lock**: snap the sample's detected tempo to project BPM.

### B3. "Conscious remix" — what it will actually mean
Not a black box. A **remix planner** that reads the analysis and proposes a concrete,
editable plan, grounded in `KANYE-CODEX.md`:

> Detected: 141 BPM, F minor, dense low end.
> Plan: half-time it to 70.5 · chop the vocal at bars 3 and 7 · drop the sample's
> low end below 120 Hz and let Aura's 808 carry the root · dembow → boom-bap ·
> add a V7 turnaround in bar 8.

Each line is a toggle you can accept, edit or reject. Every action maps to a real
control, so nothing happens that you can't see and undo.

### B4. Honest limits
- **True stem separation** (isolating vocals from a finished mix) needs a Demucs-class
  ML model — tens of MB and a WASM/ONNX runtime. That breaks "no CDN, offline, no build".
  Options: (a) skip it, (b) ship a mid/side + spectral-band **approximation** clearly
  labelled as such, (c) make it a deliberate opt-in download. **Recommend (b) now, (c) later.**
- **Auto-Tune**: real pitch correction needs pitch tracking + PSOLA. Feasible but
  a big build; deferred, and it must never be sold as "Auto-Tune".
- Copyright: imported audio stays local, never uploaded. Aura is offline by design.

---

## C. "Everything Kanye uses, online"

| Kanye technique | Aura today | To build |
|---|---|---|
| Chipmunk soul (sped-up sample) | — | B1+B2: import, detect, `playbackRate` up, chop |
| MPC drum feel / swing | Swing + deterministic velocity wobble | Per-step micro-timing nudge |
| Tuned 808s carrying the chords | 808 bass follows chord root, sidechained | 808 glide/portamento between notes |
| Rhodes / soul 7ths | `soul` chord voice, auto diatonic 7th | Inversions, wider voicings |
| Gospel choir | — | `choir` voicing (codex item 9) |
| Beat switch mid-song | 6 sections + playlist | One-click "switch" marker in the Playlist |
| Blackout before the drop | Auto-fill snare build | Codex item 7: hard-mute last 2 steps |
| Drums-erupt-as-coda (Donda) | — | Codex item 8: arrangement macro |
| Distortion / saturation (Yeezus) | — | Codex item 10: "Grit" master knob |
| Vocal chops as an instrument | — | Slice a vocal, play it from the Piano Roll |
| Stacking / doubling vocals | Single take | Multiple takes + comping |
| Reference-track A/B | — | Import a reference, level-matched A/B button |

Codex items 4–10 (half-time beats, tom/taiko voice, stadium duck, blackout, Donda mode,
choir voice, Grit knob) remain specced in `KANYE-CODEX.md` and fold into Phase 3/4.

---

## D. New vibes to close the gap with the reference library

| Vibe | Lane | Spec |
|---|---|---|
| Drill · Noir | Central Cee | 140 half-time, minor, sliding 808, boom-bap kit w/ drill hats |
| Houston · Melodic | Don Toliver | 75, minor, airy pad, trap kit, wide reverb |
| R&B · Silk | Brent Faiyaz | 88, dorian, Rhodes 7ths, soft lofi kit |

(Named for the sound, not the artist — the existing convention.)

---

## v14+ — carried forward

Not started; deferred out of the v13 line, which is frozen.

| Item | Why it was deferred |
|---|---|
| Deploy to GitHub Pages | Blocked all through v13 on a credential; `deploy.py` is ready and waiting for `GH_TOKEN`. |
| Safari / iOS / Android verification | Cannot be driven from the build environment — the manual checklist lives in `BROWSER-TEST-REPORT.md`. |
| Native download + OS file-picker round trip | Same reason: a real browser dialog cannot be automated here. |
| Real-touch validation (long-press accents, two-finger gestures) | Simulated `TouchEvent`s pass; a physical device is still required. |
| Per-track effect sends beyond reverb/delay | Capability, not layout. |
| Audio-clip arrangement (beyond tape-style sample sync) | Larger engine change; out of scope for the v13 line. |
| Cloud projects / sharing beyond the URL hash | Needs a server; Aura is deliberately offline-first today. |

