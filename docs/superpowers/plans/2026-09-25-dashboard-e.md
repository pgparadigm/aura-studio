# Dashboard E: the mixer — Implementation Plan

> **For agentic workers:** executed inline in the "Aura Studio" session (sole writer), phase by phase,
> each phase committed after its checks pass in Chromium and WebKit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a mixer a singer-producer would pick over FL Studio's: every channel and the Master on screen,
real dB and dBFS, loudness and true peak on the Master, and a Check my mix that listens to the audio and
points at the control that fixes it.

**Architecture:** all in the static `rc/` build (one IIFE in `rc/app.js`, `rc/index.html`, `rc/styles.css`).
One metering DSP function (`AURA_METER_DSP`) is the only formula for every level; the live meters run it
inside an AudioWorklet built from its own source text, and Check my mix runs it on an offline render read
block by block. The export path is untouched at defaults.

**Tech stack:** Web Audio (AudioWorklet from a Blob URL, OfflineAudioContext.suspend, IIRFilterNode), plain
DOM controls, test-only ES modules driven by `qa/run.cjs` over Playwright's Chromium and WebKit.

**Spec:** `docs/superpowers/specs/2026-09-25-dashboard-e-design.md` plus Philip's build word of 2026-09-25,
recorded in the spec's addendum. Where they differ, the build word wins.

## Global Constraints

- Base `main` f304607 (13.8.0-rc.6). Branch `wt/rc-fixes`. Release 13.8.0-rc.7. Rebase on current `main`
  before the push; publish `/rc/` exactly as A–D did (`git push origin HEAD:main`), then prove it live.
- Root stays 13.6.0-rc.3. Never merge `v13.7-recording-confidence`. Never touch `evict.py`. Never compact
  the shared memory index. No tunnel, no public exposure. Network law: exactly one `fetch(`.
- Export bytes at default settings identical to f304607, proven by hash. Saved projects load unchanged.
- Decisions taken (Philip): Drums = linked control, no new bus; compact = short strips in one row, Master
  pinned right, one detail row for the selected channel; Master meter reads after the limiter with
  "Limiting −x dB".
- Every requirement has a test; every test runs in Chromium and WebKit; a frozen audio clock is NOT RUN
  with the freeze shown, and the harness is fixed rather than the test skipped.
- Mutants: meters back to RMS × 260; meters on the mono sum; a Drums fader that moves only the kick;
  a Check my mix that reads fader positions; a clip light that does not latch.

## Files

| File | Responsibility |
|---|---|
| `rc/app.js` | `AURA_METER_DSP`, level maths and fader law, the control component, the mixer (both layouts), the Drums group, live meters (worklet), Master loudness, measured Check my mix, rail honesty, test hooks |
| `rc/index.html` | mixer head (Check my mix, Mix effects toggle), detail row, Master loudness block, rail labels, version |
| `rc/styles.css` | compact dashboard mixer, meters, highlight, findings |
| `qa/run.cjs` | runner: fresh context per job, both engines, clock probe, network-law count, multi-step jobs |
| `qa/dashboard-e.qa.js` | every E check (in-page) |
| `qa/dashboard-e.jobs.cjs` | E jobs for the runner (viewports, audio flag, steps) |
| `qa/dashboard-a.qa.js` | C5 selector follows the compact mixer, said out loud if changed |

## Phase 0 — harness (runner + baseline)

- [x] `qa/run.cjs`: static server on 127.0.0.1 over the repo, fresh context per job, viewport per job,
  trusted gesture before checks (WebKit needs one to start audio), clock probe → NOT RUN, external-request
  count per job (network law, live), multi-step jobs with `setup` steps that must succeed.
- [ ] Baseline A–D + gate on f304607 in both engines; any failure is diagnosed before E code is written.
- [ ] Commit.

## Phase 1 — levels in dB and the control (E1 + FL basics)

Interfaces produced:
- `VOL_MAX` (199.53 %, +6.0 dB), `volToDb(v)`, `dbToVol(db)`, `fmtDb(db)` ("−∞ dB", "+2.9 dB"),
  `parseDb(text)` (accepts `-6`, `−6 dB`, `-inf`, `−∞`, `+2`), `faderPos(db)`/`faderDb(pos)` (law:
  +6 at top, 0 dB at 78 % of travel, −10 at 62 %, −20 at 45 %, −30 at 30 %, −40 at 18 %, −55 at 8 %,
  −70 at 2 %, −∞ at 0).
- `mkCtl(o)` → one control used by every mixer fader and slider: vertical or horizontal; drag is relative
  (no jump), Shift or Alt = fine (×0.1); wheel steps (0.5 dB, 0.1 with Shift), bursts coalesce into one
  undo entry; arrows/PageUp/PageDown/Home/End; double-click = default; click the value = type an exact
  number (Enter commits, Escape cancels); `role=slider` with `aria-valuetext` in real units; commit calls
  `autosave()` once per gesture.
- `applyState` reads `vol` as 0–199.53 with two decimals and EQ as ±12 with one decimal; integer projects
  load exactly as before. Master `#master` gets `max=199.53 step=any`.

Checks (E1): `e1DbLabels` (0/50/100/140/199.53 % read −∞/−6.0/0.0/+2.9/+6.0 dB; EQ ±x.x dB; sends show the
real gain in dB), `e1Law` (pos↔dB round trip, 0 dB at 78 %), `e1TypeIn` (type −3.5 → vol 66.83, −inf → 0,
+9 clamps to +6.0), `e1Reset` (double-click → 0.0 dB), `e1Fine` (Shift drag moves 1/10 as far), `e1Wheel`
(one notch = 0.5 dB; a burst is one undo entry), `e1Saved` (an f304607-format project opens and
re-serialises byte-identical; an old integer vol stays integer), `e1Undo` (fader, pan, EQ, send, master,
mute, solo, fx: undo restores the value AND the live node, redo re-applies).

## Phase 2 — compact mixer, Drums group, detail row, solo-exclusive (E3, E4)

- Dashboard (`#studioEdHost`): `#mixer.compact` — one row of short strips (name, fader + L/R meter, dB value,
  M S), Master pinned right; `#mixDetail` row for the selected channel (Pan, Low, Mid, High, Reverb, Delay,
  each with value and unit); `Mix effects` toggle for the fx row; `Check my mix` in the head.
- Drums group strip (dashboard only), collapsed by default, ▸ expands Kick, Snare, Hats beside it. Fader =
  the loudest member's dB; a move of Δ dB moves all three by Δ from their levels at gesture start; stops
  when the loudest reaches +6 dB; the bottom is all three silent. M/S act on all three; its meter combines
  them (max peak, summed power). No new bus, `mx` stays 8 channels.
- Solo-exclusive: Alt/Option- or Cmd/Ctrl-click on S solos that channel (or the group) alone.
- Master strip: M = listening mute (live output only, never saved, never in the export), said on the button.
- Guided keeps full strips (pan, EQ, sends on each strip) with the same controls.

Checks: `e4Fits` at 1024/1280/1440, collapsed and expanded (every fader, M, S, value and the Master hit by
elementFromPoint; no horizontal or vertical scroll in the mixer); arrangement taller than 58/182/244;
`e3Group` (−6 dB on the group = −6 dB each, balance kept at the +6 limit, M covers all three, expand shows
three, `mx` length 8); `e3Select` (Drums lane ↔ group strip; C5 still true); `e2Solo` (Alt-click solos one,
all others off, one undo entry); `e4Detail` (the row follows the selected channel; edits hit `mix[]` and the
live node).

## Phase 3 — meters (E2) and the Master's loudness

- `AURA_METER_DSP` (as proven in the Node pre-flight) added to `app.js`.
- Live: one `AudioWorkletNode('aura-meter')`, 9 stereo inputs (8 groups from their existing analyser point,
  Master from the limiter output), module from a Blob of the DSP source; output to a zero gain so it is
  pulled. Posts peak, RMS and clip per side, and the Master's momentary, short-term, integrated LUFS and true
  peak, about 30 times a second. Live only: `buildBusses` and the export are not touched.
- UI: L/R bars on a dBFS scale −60..0 (marks 0, −6, −12, −24, −48), peak (fast attack, 20 dB/s fall) plus
  RMS, a peak-hold line (1.5 s), a clip light that latches until clicked (|x| ≥ 0.999885, i.e. 0 dBFS to
  −0.001 dB). Master: S and I in LUFS, TP in dBTP, markers at −14 LUFS and −1 dBTP, a ↺ to restart I,
  "Limiting −x dB" from the limiter's own reduction. Dock mini meters on the same scale.

Checks: `e2Sine` (−6 dBFS sine through the Sample channel reads −6.0 ±0.2 peak, −9.0 ±0.2 RMS on both
sides), `e2HardLeft` (panned hard left: left −3 dB higher than the mono sum would read — mutant catches mono),
`e2Square` (0 dBFS square lights the clip light; it stays lit after the signal stops; a click clears it),
`e2Silence` (−∞ after stop), `e2Ebu` (EBU Tech 3341 cases 1–5 and the short-term case, synthesised to its
definitions and fed as WAV files through the meter worklet: I within 0.5 LU live, within 0.1 LU offline),
`e2TruePeak` (fs/4 sine at 45°: samples −3.01, true peak 0.0 +0.2/−0.4), `e2MasterMatchesExport` (the live
Master's integrated LUFS over a full play equals the exported file's within 0.5 LU), `e2Limiting` (a hot
master shows the sign; a quiet one does not), `e2ExportHash` (export WAV SHA-256 at defaults equals
f304607's, three projects).

## Phase 4 — Check my mix on the measured audio (E6)

- `analyzeMix()`: `renderExportBuffer({tap})` (the SAME render; a tap only adds dead-end analyser taps) with
  `OfflineAudioContext.suspend` every 32768 frames; per channel K-weighted and raw L/R, the dry backing sum,
  low-band kick and bass, pre-limiter; the Master measured on the returned buffer.
- Findings, each `{id, text, fix, show:[control refs]}` in plain words: voice buried / voice on top, kick lost
  under the bass, a channel over 0 dBFS before the Master, true peak over −1 dBTP, loud or quiet against
  −14 LUFS, heavy limiting, hollow (very wide), reverb wash. No finding reads a fader position.
- UI: `Check my mix` in the dashboard mixer head and the Guided card; each finding has Show, which selects
  the channel (expanding Drums if needed) and highlights the exact control. After a Show, the next move of
  that control re-checks in the background and marks the finding fixed.

Checks: `e6Measured` (a quiet take at a default fader → "voice buried"; three +6 dB channels with no notes →
no level finding; mutant: a fader-reading check fails both), `e6Show` (each finding's Show highlights the
controls it names, in the DOM and on screen), `e6Demo` (the demo at defaults with a normal take: no voice,
kick, hollow or wash finding), `e6Novice` (scripted, human-paced: open, Check my mix, read, Show, drag the
Vocals fader, re-check clean; under 10 s including the real analysis time).

## Phase 5 — honest rail, every value with its unit (E5)

- Rail "Selected track": "High EQ" in dB (the same `mix.hi`), Reverb and Delay sends in real dB; Shape and
  Whole-song sliders show their value with its unit and say what they set.
- `e5Units`: every control in the mixer (both layouts) and the rail has a readout whose number and unit
  equal the underlying value (computed from `mix[]`, `fx`, `energyDoc`), so a readout cannot lie.

## Phase 6 — ship

- [ ] Version 13.8.0-rc.7; full run A–E + gate in both engines; mutants; network law; export hash.
- [ ] `git fetch`; rebase on current `main` if it moved; re-run; push `HEAD:main`; poll the live `/rc/` files
  until their hashes equal local; run the gate and E's checks against the live site in both engines; the
  live shrink 1440 → 375; record, memory, report.
