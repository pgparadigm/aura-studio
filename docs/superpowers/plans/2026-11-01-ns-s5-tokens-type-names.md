# S5 — tokens, type, one name per track (13.9.0-rc.1) — task plan and record

**Goal:** the spec's palette and frames, its type, and one name per track (spec VISUAL SPEC; decision 5: system font
stack only).

## Measured on rc.20 (Chromium, 1440, demo loaded) — the reds

Regions on `rgb(13,7,20)` with 12 px radius and faint violet borders; the page on a radial gradient; 38-58 text
elements under 11 px (9-10 px); 29-33 in Arial Narrow; 30-36 in capitals; the mixer named its channels Chords, Sample,
Vocals where the lanes say Warm keys, Atmosphere, Lead. No `@font-face` anywhere (the network rule already held).

## Code

- Palette (`rc/styles.css`, appended): page `#120d1a` → `#1a1324`; `#xport`, `#browser`, `main.work`, `#inspect` on
  `#1e1729`, 1 px `#2e2440`, 10 px radius (ids keep them above earlier region rules; `body.shell main.work` beats
  `body.shell .work`). Tokens `--ns-*` defined for the stages that restyle components; `--ns-accent` #8b5cf6 with
  `--ns-accent-text` #7442c9 for white text (white on #8b5cf6 is 4.2:1).
- Type: `--font-display` → the system stack (was Arial Narrow); capitals → title case in 42 rules with their caps
  letter-spacing reset (kept: the wordmark and the section line, as the mockup draws them; the shared region-heading
  rule split so only the wordmark keeps caps); every 9-10 px size → 11 px (30 declarations).
- Names: the `GROUPS` display names Chords → Warm keys, Vocals → Lead, Sample → Atmosphere (ids, saved state and the
  export unchanged).

## Checks (both engines)

`n5Palette` (1440, 1280), `n5Type` (1920, 1440, 1280 with the right drawer open, 390), `n5NoWebfont` (guard),
`n5OneNamePerTrack` (1440, 1280); `n4Contrast` still green. Mutants caught: Arial Narrow back, 12 px radius back, the
Vocals name back, one 10 px size back.

**Not proven:** the look against the mockup (S17's region boxes); track colours across strips (S10/S12 restyle lanes
and strips); controls' own colours (later stages use `--ns-accent`).

## Gate 1 (2026-11-01): failed on two checks that pinned the old design — Philip's ruling

`results/2026-11-01-ns1-gate`: Chromium 282/287, WebKit 281/287 (+ the allowed `e12RealRecord` NOT RUN); export,
saved state and latency all passed. Two checks failed, both on S5's intended changes:

- `claimsA` row C6 found the selected strip by the name "Chords"; S5 names it Warm keys. **Philip:** find it by
  `data-g="chords"`. Mutant (the chords strip never selected) fails C6.
- `e9HeaderSame` (375, 1280, 1440, 1920) held every header box identical to rc.10 (9a9f19d); S5's font and title
  case move them. **Philip:** lock the control set, the bar's height within 2 px, and nothing clipped or off screen.
  Now at all seven widths (it held only the height from 768 to 1279 before): the bar's and the ⋯ menu's control sets
  by tag, id and classes, the Vol slider's place, the play mode shown in some form; the height within 2 px of rc.10's
  (new generic runner option `near: { height: 2 }`); every control in the bar and the open menu on screen, inside its
  container, hit at its centre, its label whole; the wordmark and save line whole. rc.10 is judged by the same rules
  and passes them.
  - Found while building it: at 900 S5 shows the Loop | Song segment where rc.10 and rc.20 show the Loop button
    (rc.11's rule: the segment where it fits; S5's title case makes it fit). rc.10 shows both from 1024 up (it
    predates rc.11). So the play mode counts as one control in either form; "never both" stays `e11OneModeControl`'s.
  - Mutants (Chromium): a hidden control fails all 7 widths; height +3 px fails all 7; +2 px passes 768-1920 and
    fails 375 (+18); the right cluster off screen fails 768-1920; cut labels fail 768-1920; the bar covered fails all
    7. (375 passes the off-screen and cut mutants because those controls are not in the phone bar.)
  - Not held: the phone's ⋯ sheet (`#msheet`), as before; box positions inside the bar (S7 brings the bar's own checks).

32 px desktop targets: region by region as each is redesigned (Philip, 2026-11-01).

## Gates 2 and 3 (2026-11-01): not clean, on audio timing; stopped, nothing published

- `results/2026-11-01-ns2-gate`: Chromium 286/287 + `e7ExportLatency` NOT RUN (the context had reported its latency
  before the export began; passed in ns1 and rc.17-rc.20; NOT RUN once before, 2026-10-31); WebKit 286/287 + the
  allowed `e12RealRecord`. Both changed checks green everywhere.
- `results/2026-11-01-ns3-gate`: Chromium 287/287; WebKit `e2ExportGraph` FAIL: S5's two back-to-back exports of the
  voice project disagreed (`sameTwice` false, 8254 vs 8287 graph lines); f304607 normal in the same run.
- Repeats (`probes/2026-11-01-exportgraph-flake`, WebKit, instrumented copy): S5 15/15 pass; **live rc.20 (1f19206)
  14/15, the same failure**. So it predates S5. In the rc.20 failure the first render lacks all 26 kick-to-bass ducks
  (`rc/app.js` scheduleStepAudio: `groupGain('kick')>0` gates them) while every drum hit is identical: the kick's mix
  gain read as zero (muted, soloed out or at zero) at the first export, not at the second. Cause of that transient:
  not found yet (`takeInstall` and `refInstall` set no mute or solo themselves).

## The export-graph failure was the check's instrument, not the export (2026-11-01; Philip chose "fix it first")

**`superseded`:** "the kick's mix gain read as zero" above. Wrong. In the failing render the kick group's own gain
line was identical to the other render's, and the duck code runs synchronously right after the graph is built, so no
mix change could remove the ducks and leave that line alone. What did: `exportGraph` (qa/dashboard-e.qa.js) knew every
node, param and buffer by a **WeakMap** keyed on its JS wrapper. In WebKit an AudioParam's wrapper is collected when
nothing in JS holds it, and the next `node.gain` hands out a new one the WeakMap does not know, so its calls go
unlogged. `bassDuck.gain` is the one param made at graph build and used only later, in the step loop: a collection in
between drops every duck from the log. The export itself made those calls; the instrument did not see them.

- Probe outside Aura (`probes/2026-11-01-exportgraph-flake/gc/`, with the runs below): WebKit lost an AudioParam's identity in 9 of 10 trials after
  a burst of garbage; Chromium 0 of 10. Holding the params in a Map: 0 of 10 in both.
- The real export under added garbage (a burst every 150th node created), WebKit, 5 runs each: the WeakMap instrument
  failed 4 of 5, **f304607 itself failing alongside rc.20 ("base FAIL")**; a Map instrument passed 5 of 5 with
  f304607's key.
- Fix: `ids` is a `Map` (released when the render returns). No change to `rc/`, so no rc.21: there is no app bug.
- New check `e2GraphSeesThroughGC`: 20 params used only after garbage are logged exactly as with no garbage. It must
  see a collection happen or it is NOT RUN (WebKit: a canary param's wrapper collected; Chromium: a collection that
  kept it). RED on the WeakMap: WebKit 41 of 61 lines (the 20 param calls lost) after 8 bursts; Chromium passes.
  GREEN on the Map: 61 of 61 in both engines, 3 runs.
- Not established: anything about the export's audio (the instrument only observes; e2ExportJitter holds the bytes);
  other instruments are not affected (this was the only WeakMap in qa/).
