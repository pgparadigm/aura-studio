# Aura Studio — Redesign & Capability Roadmap

Reference library: `~/Documents/★ Studio` — 153 tracks. The soul/808 lineage is the centre of gravity
(79 of 83 Unreleased, plus 18 of 70 Instrumental incl. ¥$ / Kids See Ghosts), then a
Persian rap cluster (Mehrad Hidden, Alireza JJ, Arman), UK drill (Central Cee),
and contemporary R&B/trap (Don Toliver, Brent Faiyaz, Travis Scott, Ty Dolla $ign,
Big Sean, Tory Lanez, Drake). Five female reference vocals in `Voice/`.

**What this means for the product:** Aura's existing soul/808 lanes (Soul · Chipmunk,
808 · Heartbreak, Gospel · Sunday) and Tehrán · Noir are the right spine. The gaps
against this library are **drill**, **Houston/Toliver-style melodic trap**, and
**modern R&B**, plus the chop-and-rebuild sampling workflow those records are built on.

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

### B2. Manipulation — achievable, this is the chop-and-rebuild toolkit
- **Chop & re-trigger** slices on the 16-step grid.
- **Pitch/speed**: `playbackRate` (tape-style, pitch+speed linked — exactly the chipmunk-soul
  technique) and a **granular pitch-shift** for pitch-without-speed.
- **Reverse**, **stutter/roll**, **gate**, **filter sweeps**, **saturation/bitcrush**,
  **tape wobble** (LFO on playbackRate).
- **Sidechain the sample to Aura's kick** — the existing ducker already does this.
- **Loop-lock**: snap the sample's detected tempo to project BPM.

### B3. "Conscious remix" — what it will actually mean
Not a black box. A **remix planner** that reads the analysis and proposes a concrete,
editable plan, grounded in `research/PRODUCTION-CODEX-2025.md`:

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

## C. "Everything that lineage uses, online"

| Technique | Aura today | To build |
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
choir voice, Grit knob) remain specced in `research/PRODUCTION-CODEX-2025.md` and fold into Phase 3/4.

---

## D. New vibes to close the gap with the reference library

| Vibe | Lane | Spec |
|---|---|---|
| Drill · Noir | Central Cee | 140 half-time, minor, sliding 808, boom-bap kit w/ drill hats |
| Houston · Melodic | Don Toliver | 75, minor, airy pad, trap kit, wide reverb |
| R&B · Silk | Brent Faiyaz | 88, dorian, Rhodes 7ths, soft lofi kit |

(Named for the sound, not the artist — the existing convention.)

---

## v13.3 — delivered in the 13.3 line

| Item | Where it landed |
|---|---|
| Three named import paths, and a tempo decision before Apply | `impMode`, `impTempo`, `applyChosenTempo()` |
| Low-end analysis and an original bass part | `detectLowEnd()`, `lowEndPlan()`, `lo` schema block |
| Apply as a version instead of over your work | `applyAsVariation()`, `var` schema block |
| Perform view and live-arrangement recording | `runAction()`, `perf` schema block |
| DJ / MIDI controller with MIDI Learn | Web MIDI, mappings in `localStorage` only |
| Ask Aura — offline structured guidance | `GUIDE_INTENTS`, never a generative model |
| Reproducible exports | `getNoise()` / `makeIR()` seeded with mulberry32 |
| The music-knowledge integration ledger | `AURA-MUSIC-KNOWLEDGE-INTEGRATION.md`, every Part 1–34 dispositioned |
| Structured local knowledge | `knowledge/*.js` — five modules, 39 entries, script tags, never fetched |
| Reggaetón Groove Builder and Idea Codes | `groove`, `grooveBeat()`, fixed-width base-36 codes |
| Song Architect, Transitions, Emotion Map, Mix Check | `applyArchitect()`, `TRANSITIONS`, `emotionMap()`, `mixCheck()` |
| Lyric & Topline Studio and Vocal Coach | `lyricAnalysis()`, `vocalCoach()`, `ly` schema block |
| Project intention, Rights & Sources, complete export, Finish | `pi` schema block, `provenance`, `exportCompleteProject()` |
| **Find a sound** | `SOUND_FAMILIES`, `trySound()`, saved family in `gv.sf` |
| **Create something** | `createSomething()` — one checkpoint, reproducible including *Surprise me* |

## Still open, and honestly so

| Item | What it is blocked on |
|---|---|
| VoiceOver / TalkBack | Needs a real device and a person listening. The 36 automated checks verify structure and cannot verify what a screen reader says. |
| A physical MIDI controller | Web MIDI is exercised with synthetic messages only. Twenty rows of the device checklist cover the hardware. |
| Safari, iOS, Android | One Chromium build is the whole of the automated evidence. |
| OGG decode | No encoder on this machine can generate the fixture; Chrome and Firefox both decode OGG, so this is a fixture gap rather than a known failure. |
| The GitHub Release for `v13.2.0-rc.1` | Needs the repository owner's session; `gh` is not installed and no token is available here. |

## v14+ — carried forward

Not started; deferred out of the v13 line.

| Item | Why it was deferred |
|---|---|
| Deploy to GitHub Pages | **Done** — `13.2.0-rc.1` is live at https://pgparadigm.github.io/aura-studio/. The 13.3 line is not deployed. |
| Safari / iOS / Android verification | Cannot be driven from the build environment — the manual checklist lives in `BROWSER-TEST-REPORT.md`. |
| Native download + OS file-picker round trip | Same reason: a real browser dialog cannot be automated here. |
| Real-touch validation (long-press accents, two-finger gestures) | Simulated `TouchEvent`s pass; a physical device is still required. |
| Per-track effect sends beyond reverb/delay | Capability, not layout. |
| Audio-clip arrangement (beyond tape-style sample sync) | Larger engine change; out of scope for the v13 line. |
| Cloud projects / sharing beyond the URL hash | Needs a server; Aura is deliberately offline-first today. |
| Stem separation of an imported song | **Not a scheduling problem.** No licence-clean model exists to ship: Demucs' own author excluded the weights from its MIT licence, MoisesDB is CC BY-NC-SA, MUSDB18 is academic-only, and REPET is covered by US9093056B2 until 2033. Aura reconstructs rather than separates, and says so. See `aura-engine/MODEL-LICENSES.md`. |

