# The pro hand-off (rc.17) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the live `/rc/` records vocals uncompressed, keeps them at 24-bit, lets the singer choose which take plays
in each part (comping), and Save everything hands off one dry, comped, 24-bit file per vocal track from bar 1 that
lines up in FL or Pro Tools; with the whole core loop still complete on desktop and phone.

**Architecture:** an AudioWorklet capture beside today's MediaRecorder, aligned to it by cross-correlation (today's
timing kept); 24-bit takes in both stores (schema 6); a per-track pass list in the take history; a take picker in the
clip bar; a dry render through the one scheduler with whole-sample placement.

**Tech Stack:** `rc/app.js`, `rc/styles.css`, `rc/index.html`; checks in `qa/dashboard-n.qa.js` + `.jobs.cjs`
(`h*`), runner `qa/run.cjs`.

**Spec:** `docs/superpowers/specs/2026-11-06-pro-handoff-design.md` (read it; this plan argues from it).

## Global Constraints

- Work in `~/Code/aura-studio-worktrees/rc17-handoff` (branch `wt/rc17-handoff`, from `main` e17f315). One test at a
  time, red for the right reason first; a mutant for each rule.
- Version 13.9.0-rc.17. Full gate in both engines against f304607, zero failures; `e1Saved`, `e2ExportGraph`,
  `e2ExportJitter` match. NOT RUN allowed: WebKit `e12RealRecord`, `cl13MicRawApplied` (no synthetic microphone).
- Publish to `/rc/` only (`git push origin HEAD:main`, fast-forward); the root's 13.6.0-rc.3 untouched.
- File-based FL → Aura → FL / Pro Tools only; no live sync. No network at run time except the singer's pasted URL
  (the capture worklet is a `blob:` module, as the meter's is).
- The microphone stays raw (`cl13MicRaw` keeps passing). The one-tap Export is unchanged.
- Not establishable here, said in every status: a real voice into a real microphone; the recorder's timing on a real
  iPhone / Safari; iPhone downloads of many files; listening.

## Order (Philip's): lossless recording, then dry takes in the export, then comping

1. **h1 `h1Lossless`** — `cpFakeMic` replaced for this check by a page-made microphone playing a known noise buffer;
   record 2 s on Lead; the stored take (read back from the device store after `voxSaved`) matches the source within
   2⁻²³ at the best lag (search ±0.3 s). rc.16 misses (Opus/AAC). Code: `AURA_CAPTURE_DSP` worklet source, loaded in
   `ensureMic` (blob URL, once per context), `capStart/capStop`, `acceptTakeBuffer(buf, head, target, src)` split out of
   `acceptRecording`, `capAlign(lossy, lossless, predictedLag)`. The 24-bit store comes with it (h3's code) because
   the test reads the stored take. Mutants: the worklet never loads; the store writes 16-bit.
2. **h2 `h2PlacementKept`** — a gated burst through the page-made microphone; S().lastAlign reports the recorder take's
   onset and the lossless take's onset on the timeline: equal within one sample; the take line says uncompressed.
   Mutant: the lag's sign flipped; the lag ignored.
3. **h3 `h3Store24`** — a take with a −110 dBFS tone under a −20 dBFS one (below the 16-bit floor) through
   `takeInstall`: survives the device store + reload (a reload job pair) and a `.aura` round trip (`buildFile` →
   `openFile`); a 16-bit rc.16 take record opens; the file declares schema 6 and validates (`schema-validate.js`).
   Also: `e12LongSetup/Check` and `e12Stems` expectations updated (24-bit sizes; dry files instead of take files).
4. **h4 `h4Passes`** — first take = pass 1 (`src`), two punch-ins = passes 2 and 3 with their `at`; ↶ removes pass 3,
   ↷ restores it; device store + `.aura` round trip keep them; a pre-rc.17 take gets pass 1 only when unmoved.
5. **h7 `h7DryFiles`** (dry takes before comping, Philip's order) — Save everything captured: `dry-lead-vocal.wav` and
   the others; no `take-*.wav`; 24-bit mono at the take's rate; length in seconds equal to `master.wav`'s (±1 sample);
   an unedited part sample-exact against the take at the export shift; a channel with heavy EQ, compression, reverb
   and delay leaves the dry file byte-identical; the burst's onset within 1 ms of the lead stem's. README names them.
   Code: `renderDryTrack(id)` (OfflineAudioContext at the buffer's rate, gain 1, `scheduleTakeClips(…, snap)`),
   `encodeWav24`, `exportCompleteProject` step 2c. Mutants: placement not snapped; the vocal level applied; the take
   files still written; the shift left out.
6. **h5 `h5Comp`** — Lead: pass 1 = 1234 Hz over 16 s, pass 2 = 600 Hz over bars 5–8, pass 3 = 880 Hz over bars 5–8;
   split at bar 7; the bar-5 part set to take 2, the bar-7 part to take 3, then back to 1: each stretch plays its tone
   (`cpTrackAt`), the join's crossfade exists (overlap ≥ 9 ms) and no sample step over 0.05 at it in the dry render;
   one ↶ per choice; a choice while playing reschedules the takes (`takeLive().sources` renewed). The dry file carries
   the comp. Code: `takePassOf`, `takePassesFor(clip)`, `takeUsePass(clipId, passId)`, `takesRestartLive()`.
   Mutants: offered pass not checked for cover; no join extension; from mapped without the pass offset.
7. **h6 `h6Picker@1920,1440,390,360`** — a part with three takes selected in the Studio lanes: "Takes" and 1/2/3 in
   the clip bar, on screen, whole, ≥ 36 px tall and wide, not overlapping each other or the bar's other buttons, the
   playing one `aria-pressed=true`; a tap switches (the name line reads "Take 2 of 3"); a part with one take shows no
   picker. Mutant: aria-pressed on the wrong button.
8. **h8 `h8Walk@1440,390`** — the FL reference render (`Pattern 1_2.wav`, read from disk by the runner as rc.16's walk
   did) → Sing over my beat → Lead (page-made mic) → two punch-ins → a comp → Double → a harmony file → Export (as
   rc.16's walk measured: length = FL's, beat level 0.00 dB, peak ≤ 0.985, 0 over) and Save everything (every dry file
   24-bit at bar 1, the same length as the master, the comp inside) → zero console errors.

Then: the full mutant rerun (rc.16's 61 + rc.17's), the full run, CHANGELOG, bump to 13.9.0-rc.17, the gate, publish,
the live checks (cl, cp, h, e2 on the live bytes), the FL walk through the live bytes, the record and memory.

## Progress

- [x] h1 · [x] h2 (+ h2b) · [x] h3 · [x] h4 · [x] h7 · [x] h5 (+ h5b) · [x] h6 · [x] h8 · [x] the FL render probe ·
  [x] rc.17 mutants · [x] full run (found `e13StopNoFreeze`, the take-room Reset/Trim) · [x] h9 · [ ] mutant rerun · [ ] bump · [ ] gate · [ ] publish · [ ] live checks · [ ] FL walk live · [ ] record

## Found while building it

- **The waveform match misplaced takes.** On a steady tone every period matches: two identical punch-ins landed 113 ms
  apart (Chromium) and 494 ms apart (WebKit), caught by h4. The match is now made on the loudness envelope, refused when
  a separate peak (20 ms or more away) comes within 0.05, and a take whose envelope hardly moves is placed by the clocks
  (h2b). First version of the refusal compared the best match with its own slope (refused 1 run in 2; fixed, mutant
  killed 3/3 once h2's bursts got a sung onset's 10 ms rise).
- **Chromium skips a new capture node for a few render quanta** right after a context starts (block stamps 4608 apart,
  not 4096); the stream loses nothing. Placing blocks by their stamps put a 128-512 sample silence into the take (1 run in
  4 of h1). Blocks are joined end to end.
- **A whole-sample start could play one sample at the gain node's default** (1) before a fade's first event: a 0.25
  click at a comp join in the dry render (3 runs in 4). The dry render holds the fade's opening gain (live and export
  untouched).
- **Takes over the same bars differ in length** (Stop pressed at different times), so "the take must cover the part"
  hid take 2 on the whole punch-in part. A take is offered when it holds half the part (or half a second); chosen, it
  plays as far as it reaches and the rest keeps its take (h5b).
- **Measured, not changed:** Aura's vocal compressor (Web Audio's own) looks ahead 6 ms, so the voice in Aura's mix,
  master and stems is 6 ms after where it was sung; the dry files are where it was sung (README). The recorder's own
  start wanders 5-14 ms take to take in Chromium (WebKit steady): an aligned take inherits it. Web Audio interpolates a
  source started between samples (both engines), so the live mix and the export smear every part a little; only the dry
  files place on whole samples. Fractional OFFSETS into a buffer are not interpolated (dry-no-snap survived until a part
  sat off bar 1). rc.15's punch crossfade puts each side's half-length fade in different halves of the overlap (a short
  bump for a held note through a punch point); comp joins reuse it.
- **The Guided take room's Reset and Trim after punch-ins** (found while the full run was going): both started from one
  part over the whole recording, so a punched track came back as every pass end to end and a take sung from a start
  point went back to bar 1 (rc.15 behaviour, but the phone shows that room in Studio, so it is a broken control on the
  core path). h9, red on 92433c0 in both engines, green after: both start from the track as recorded. First version
  pointed "edited" at the new meaning, which made the take room's summary and the export note call a punched track "the
  whole take, exactly as you sang it"; split into `takeEdited` (unchanged) and `takeShaped` (Reset only), h9 pins both.
  h9's first take had a tenth of quiet, which Trim's floor rule reads as empty (rc.15; named, not changed): the take now
  has 3 s each end. Five mutants killed.
- **The full run** (frozen copy, both engines, 2026-11-06): Chromium 486/488, WebKit 485/488. `e13StopNoFreeze` failed
  in both on its 16-bit size expectation (worst frame 33 ms and 68 ms, under its 200 ms): now 24-bit. `e7ExportLatency`
  NOT RUN in Chromium: the context knew its latency at once; identical on f304607 and the live rc.16 bytes on this Mac
  that day (the speaker output held open for hours by another process), so it is the machine, not rc.17;
  `e7ExportLatencyHeld` (the same rule, deterministic) passes in both engines.
- **Changed on purpose in existing checks:** `e12AuraFile` (schema 6), `e12Stems` and `e12LongTakes` (dry files, 24-bit
  sizes), `e12Q` (the store's quantisation is 24-bit), `n6SchemaValid` (too new is now 7), `e13StopNoFreeze` (24-bit size).
