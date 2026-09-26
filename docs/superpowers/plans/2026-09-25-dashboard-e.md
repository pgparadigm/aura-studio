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

## Build notes (2026-09-25)

What the build found that the plan did not expect, in the order it happened.

1. **Playwright is not clean as a package** (PACKAGE IS NOT REPO fired). `playwright-core` carries three
   `SKILL.md` files (two with `allowed-tools` grants) and `reinstall_*` scripts that delete
   `/Applications/Google Chrome.app`; `playwright` carries agent and prompt templates. Only
   `playwright-core` was installed, stripped, and recorded (`docs/QA-RUNNER.md`, the firing file).
2. **The A–D baseline needed its own preconditions.** Three B/A checks failed on the untouched f304607
   until the runner ran them after the steps their comments name (`loadDemoArrangement`, `a2Draw`).
3. **Undo did not restore the sound** of the Master level or the mix effects (only their readouts), since
   before E. Fixed (`applyMasterFxLive`); `e1Undo` would fail without it (mutant).
4. **The selection outline never rendered.** `--electric-violet` is undefined, so A's
   `outline:2px solid var(--electric-violet)` was invalid; C5 checked the attribute, not the screen. The
   mixer's rule got a fallback. Seven other bare uses remain (listed in the report), untouched.
5. **The Master strip overflowed** once its loudness readouts landed (958 px of content in 932); `e4Fits`
   caught it; the Master is 176 px, the most nine open strips leave at 1440.
6. **"Byte-identical by hash" cannot be proven by any build.** Neither engine renders one project to the
   same bytes twice, f304607 included: Chromium within one page, WebKit across documents (only its reverb
   convolver varies). Proven instead: the export's graph is identical to f304607's (`e2ExportGraph`), and
   E's audio differs from f304607's by no more than f304607's differs from itself (`e2ExportJitter`).
7. **A channel over 0 dBFS before the Master is not a finding.** Aura mixes in float; the demo's kick and
   snare do it at defaults. What it costs, the limiter working, is its own measured finding.
8. **The export render is the analysis's cost** (Chromium 4.0 s, WebKit 2.0 s for the 26 s demo; the taps
   add about 0.2 s). The analysis renders in up to four overlapping windows at once.
9. **Automated oscillators take their phase from absolute context time** in both engines (a swept sine
   shifted 4.5 s differs by 1.56; a constant one by nothing). So windows measure energy exactly (within
   0.02 dB of one render) but not the true peak (0.3 dB off). The true peak comes from one full render, a
   second stage. Two hypotheses were disproved on the way: a one-frame stitching offset (fixed anyway, no
   effect) and a note-time shift (no lag aligned them).
10. **The harness misread a late WebKit clock start as frozen** (0.142 s of 0.4 s). The probe now waits for
    the clock to begin and measures its rate.
11. **The peak-hold line fell during a steady tone** (each 33 ms window peaks a hair under the true
    amplitude). A peak within 0.1 dB of the hold refreshes it.
12. **Stale readouts outside the mixer**: the reference card's level stayed at its old value after a Sample
    fader move, and its "In my track" after the Sample strip's M; one reference-level drag was one undo
    entry per pixel. All fixed with `e5Balance`.
13. **The findings panel outlived the mixer** (it floats over the arrangement). It now goes away, with its
    highlights and its after-Show re-check, whenever the Studio mixer is not the open editor
    (`e6PanelFollows`).
14. **Checks added beyond the plan** because a requirement row claimed more than its test proved:
    `e2Hold` (the hold line), `e2MasterDisplay` (the Master's readouts and targets on screen), every finding
    having a Show (`e6Show`), `e6Windows` (windowed analysis equals one render), `e5Balance`.
15. **After publishing (Philip's three points, 2026-09-25 evening; built and checked locally, NOT published):**
    - **The Master now reads as exported.** The live Master sat 0.37 LU above the file on the demo while the
      two raw readings were equal (−11.85 and −11.85): the export multiplies the whole file by one safety gain
      (0.985/peak) when a sample would pass 0.985. Every Master reading is now shown with that gain, taken from
      the export's own render of the current project state (after Stop, or from Check my mix), estimated from
      the loudest sample heard until then and marked "≈"; a File line shows the file's own I and true peak.
      `e2MasterAsExported`: Master −12.2, file −12.216 / −12.214 (Chromium / WebKit), 0.03 LU apart, within
      half the 0.1 display step; without the correction 0.38 (mutant caught).
    - **f304607's default export is not byte-identical from one render to the next** (`e2EngineRepeats`, run
      against f304607 served as `/rc/`): three renders in one page, three different WAV-data hashes in each
      engine (Chromium 614–883 of 2,253,804 samples differ; WebKit 15,090–32,607). The jitter rule stays the
      check; `e2EngineRepeats` fails loudly if an engine ever starts repeating itself.
    - **Live WebKit `e2ExportGraph` failed its own precondition, not the comparison** (keys equal to
      f304607's): the export places a voice take by `LAT()`, which reads the live context's output latency,
      0 in the instant after the context starts and then its real value (Chromium 16 ms, WebKit 5.2 ms). Two
      exports on either side of that instant place the take 5–16 ms apart. Pre-existing. The check now lets the
      context settle first, on both builds. (`superseded` as "not fixed": fixed on Philip's word, note 16.)
16. **The export waits for the live context's latency report** (its own commit, local, not published).
    - **Measured:** a new context reports `outputLatency` 0, then Chromium 16 ms after 13–50 ms and WebKit
      5.2 ms after 13–66 ms. Both engines reach the take about 45 ms into an export, so it is a race.
    - **Tests first, RED on the unfixed build.** `e7ExportLatencyHeld` holds the reported latency at 0 for
      150 ms (a slower device; that one boundary simulated): take 16.000 ms late in Chromium, 5.215 ms in
      WebKit. `e7ExportLatency` (natural timing, nothing simulated): 5.215 ms late in WebKit; Chromium passed,
      because the engine reported its latency first. A run that cannot tell is NOT RUN, never a pass.
    - **Fix:** `renderExportBuffer` awaits `latencySettled()` when there is a take and the context is under a
      second old and still silent (at most 1 s). GREEN in both engines; the held run waited to 169–185 ms.
    - **Mutant** (the wait line removed): the held test fails in both engines (16 ms, 5.215 ms); the natural
      one fails in WebKit and, in Chromium, passed once and could not tell once.
    - **Premise, corrected:** no user can reach this today. In the shipped app a take exists only after a
      recording (`onRecStop`), when the context has run for the whole take; only the test hook `takeInstall`
      could export in the first instant. It would become reachable if takes were ever restored on reload.
    - **Found, not fixed (from reading the code, not tested):** export and playback shift a take by the
      output latency *now*, not the latency it was recorded under, so if the output device changes after a
      take (wired speakers to Bluetooth headphones, say) the take moves by the difference. Storing the latency
      with the take at record time would fix export and playback together. Named, waiting for Philip.
      (`superseded` as "waiting": Philip PARKED it, and made it a prerequisite for restoring takes after a reload.)
17. **The jitter rule gets a floor** (Philip's word; its own commit, local, not published).
    - **Why:** the reference is three f304607 renders from a multimodal distribution, and it collapsed twice on
      unchanged builds: WebKit fresh (references 22 samples apart) and WebKit demo (references' largest-sample
      difference 2.3e-5 while E's renders landed at 2.55e-4, where f304607's own renders also land).
    - **The floor** is the widest f304607-against-f304607 difference recorded per engine and project (52
      measurements, 17 runs, 2026-09-25). The reference is never narrower than what the engine has been seen
      to do to f304607 on its own. A floor at the bottom of the range would not have fixed the demo case.
    - **Test first:** `e2JitterRule` runs the ONE verdict function `e2ExportJitter` uses against recorded
      measurements. RED on the old rule in both engines (both collapsed cases failed), GREEN 8/8 after.
    - **On the publish candidate** (4fa7f35's `rc/`) `e2ExportJitter` passes in both engines. **Mutant:** every
      export × 1.001 (+0.0087 dB) fails in both engines and both projects (RMS difference 2.0e-4 against
      thresholds of 1.5e-7 in Chromium and 6.8e-6 to 1.1e-5 in WebKit), so the smallest level change the
      floored rule still catches is about 0.0005 dB in WebKit and far smaller in Chromium (from those
      numbers, linear in the change).
18. **`--electric-violet` defined; the header Vol reads in dB** (Philip's word; one commit, local, not published).
    - `--electric-violet:#8D2BFF` in `:root`, the colour the rules' own `rgba(141,43,255,…)` companions assume.
      `e8Violet`: all seven rules that used it bare painted their text colour, transparent or nothing (RED,
      both engines); all seven paint #8D2BFF after.
    - `#masterVal` beside the header's Vol, repainted from every write of the Master level (the slider, the
      mixer's Master strip, undo/redo), and the slider's `aria-valuetext` says the same. `e8HeaderVol` at
      375 / 1024 / 1280 / 1440 / 1920: values −1.9 → 0.0 → +6.0 → undo 0.0 → redo +6.0 in both engines;
      mutant (undo does not repaint) caught.
    - **Where the Vol slider really lives** (measured, unchanged by this): the header bar only at 1920; the ⋯
      menu at 1024–1440 (the fit cascade moves the sliders there); the phone sheet at 375, below the fold
      (the sheet scrolls). The check opens ⋯ or the sheet and scrolls, as a person must.
    - **Found, not fixed (predates E; f304607 has it):** at 1024×768 the header bar overflows by 118 px (119
      in WebKit) after the whole cascade, so the ⋯ button sits at x 1091–1129, off the screen: Tempo, Swing,
      Vol and the actions moved into ⋯ cannot be reached by pointer at 1024. If opened, the menu runs 26 px
      off-screen (it is placed as if 236 px wide; it is 270), cutting Tempo's readout and now Vol's to 80 %.
      A resize event does not re-fit it. The check requires Vol's readout to be no less visible than Tempo's.
    - The Vol readout makes the ⋯ menu 3 px wider (273 px), so at 1280 and 1440 it now reaches the screen's
      right edge exactly (was 3 px short).
19. **The 1024 header** (Philip's word; its own commit, local, not published).
    - **Root cause, measured on three builds:** before the dashboard (26ee008^) the header's middle group was 528
      px at 1024 and the bar fitted. 26ee008 appended Key / Meter / Pos chips (179–213 px) and Loop (49 px) to
      that group, which cannot shrink (`flex:0 0 auto`, nowrap) and which the fit cascade never manages: after
      all three of its steps the bar was 118 px too wide (WebKit 119), clipping ⋯ AND the Project menu button.
      Not timing (a resize event changes nothing), not the Vol readout.
    - **Fix:** a fourth cascade step, only when the first three still do not fit: the chips give way, least
      useful first (Pos repeats the readout beside it, Meter is always 4/4, Key is also in the ready line),
      stopping the moment it fits; every control stays. And the ⋯ menu, placed as if 236 px wide, is pulled back
      on screen only when its measured width would run it off (it holds the sliders at 273 px).
    - **Tests first:** `e9HeaderReach` (⋯ on screen and hit-testable, its menu fully on screen, Tempo / Swing /
      Vol on screen and hit-testable with their readouts, after load and after Guided and back) RED at 1024 in
      both engines, GREEN after; guards at 1280 / 1440 / 1920. `e9HeaderSame` against 16f0cbb at 375 / 1024 /
      1280 / 1440 / 1920: everything outside the bar identical at every width; the bar and the open ⋯ menu
      identical where it already fitted; at 1024 its height and its set of controls identical.
    - **Mutants:** step 4 removed → 118/119 px overflow again (caught); menu placement removed → menu off-screen
      (caught); step 4 run at every width → `e9HeaderSame` fails at 1280 / 1440 / 1920 (the check can fail).
    - **Removed, said out loud:** a re-fit request when the chips are created. No reachable path needs it (the
      chips are built at boot before the first fit; the only later path, widening past 768, resizes the bar,
      which re-fits) and the mutant without it passed; the one test written for it rested on a false premise
      (booting in Guided still builds the chips) and failed its own precondition on both builds.
    - **Limits, measured:** at 1024 the bar fits with no spare room (the right cluster ends in the bar's own
      20 px padding, 1 px from its edge), so a font that renders wider could push ⋯ out again. From 768 to
      1000 px it still overflows (24–153 px, all chips hidden, ⋯ off-screen), as before the fix.
    - **Corrected 2026-09-26 (`superseded`: "cannot be reached by pointer"):** below 1120 px the header is
      `overflow-x:auto` by design (styles.css, "Letting the header scroll keeps every control reachable"), so on
      rc.9 and earlier ⋯ was out of view and reachable by scrolling the bar sideways, not unreachable. From 1120 to
      1279 the bar is `overflow:hidden`, where a clipped control would be truly unreachable.
20. **rc.10: the header from 768 up to 1280, with 24 px to spare** (Philip's word; its own commit, local).
    - **Cause, measured (Chromium, rc.9):** from 768 to 1000 px the bar was 24–153 px too wide after every step;
      at 1024 it fitted only by spilling 20 px into its padding. The grid split each shortfall between the brand
      and the right-hand buttons (Undo, Redo, Project, ⋯), squeezing the buttons, not the brand's text.
    - **Fix:** 768–1279 only (CSS scoped there; the cascade's stopping rule changes only below 1280): the right-hand
      buttons keep their width and the brand gives; every stop must leave 24 px, measured from each group's
      natural width; three more steps, least costly first: 5 the brand drops its wordmark and save line and the
      name ellipsizes, 6 Loop | Song gives way to the dashboard's Loop button (same mode, same job), 7 the bar ·
      beat readout goes. And the header re-fits when its content grows without its box changing (a longer
      project name or key, the save line on the switch to Studio). No control leaves the bar.
    - **Found on the way:** my first `spare()` summed the children and missed the chips' 8 px margin, and a fresh
      load fitted the bar in Guided before the save line appeared, so 1279 kept 8 px (0 by natural widths).
    - **Tests first, RED on rc.9 in both engines:** `e10HeaderRoom` at 768–1279 (no overflow or scroll, every
      header control reachable and none squeezed below its label, the emblem whole, the brand's text uncut, the
      room ≥ 24 px from natural widths, and 24 px more content still inside the content box, after load and
      after Guided and back); `e10HeaderRenamed` (a long name written by the app after load); `e10HeaderSweep`
      (every 4 px from 1279 to 768 on one resized page). `e9HeaderSame` against cacb4b5 at 375 / 768 / 900 /
      1024 / 1280 / 1440 / 1920.
    - **Mutants, all caught in both engines:** steps 5–7 removed (overflow back at 768–1024); margin 0 (the long
      name, and the sweep at 12+ widths); no re-fit on content growth (the long name); the margin-blind
      measurement (only the sweep: 17–18 px at 1163–1167 and 1239–1243); the right-hand buttons squeezable.
    - **Limits:** 1280 keeps its 9 px (frozen); at 1280+ nothing is guaranteed about room. The steps hide
      information, never a control, but Loop | Song and the readout do leave the bar below ~960 and ~830 px.
