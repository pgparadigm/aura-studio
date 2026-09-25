# Studio dashboard, sub-project E: the mixer

Date: 2026-09-25 · Build base: `main` f304607 (13.8.0-rc.6, A to D proved live) · Owner: the "Aura Studio"
Claude session, sole writer · Status: **spec only, awaiting Philip's build word**

## What the concept asks

Concept item 6, "Immediate mixer": a compact mixer under the arrangement; dB and real meters; track
selection syncs the channel; Mix Check highlights the control; the Drums group expands to kick, snare
and hat. Track selection syncing the channel already works (A, claim C5) and stays as it is.

## Measured on live f304607

1. **The mixer does not fit where the dashboard puts it.** The editor area is 38% of the window height,
   capped: 292 px at 1024×768, 304 px at 1280×800, 342 px at 1440×900. One channel strip is 429 px tall,
   so no strip is ever fully visible, and the strips wrap. **The Master strip lands on a second row below
   the editor's bottom edge**: row top 761 vs editor bottom 551 at 1024, 900 vs 703 at 1280, 962 vs 803 at
   1440 (where Sample is down there too). The same editor area is what leaves the arrangement 58 px at
   1024×768 (found in D).
2. **No dB anywhere.** Channel faders read 0 to 140 %, the master 0 to 100 %; EQ and send sliders show no
   value at all.
3. **The meters are not in dB.** Bar height is RMS × 260 (code), so a full bar is an RMS of −8.3 dBFS:
   anything louder pins it, and there is no peak, no clip sign and no limiting sign. The master meter taps
   the sum *before* the glue compressor and the limiter, so it is not what the export hears.
4. **The Shape rail's "Selected track" controls misreport.** "Filter cutoff 200 Hz–8 kHz" actually sets
   the channel's high-shelf *gain* (±12 dB at 4 kHz); there is no filter. "Reverb send" and "Delay send"
   show "dB" from `(v/100)·36 − 36`, a formula unrelated to the gains the audio uses
   (`REV_BASE × Reverb + rev/100 × 0.6`, and `dly/100 × 0.6`).
5. **No drums group.** The Drums lane covers three strips (Kick, Snare + Clap, Hats + Perc); there is no
   control that moves them together.
6. **Mix Check is out of reach in the dashboard.** It lives in the Balance view, which Studio never shows;
   the Finish list only counts its warnings. Two of its fixes send the singer to that hidden view ("Pan in
   Balance", "the channel levels in Balance"), and its clip warning reads fader settings (three channels
   over 120 %), not audio.

## Goal

A mixer that fits under the arrangement at every dashboard width with every channel and the Master in
view; levels, EQ, sends and meters in real dB; a Drums group that expands to Kick, Snare and Hats;
selected-track controls that say what they do; and Mix Check that shows the channel that fixes a
warning. Nothing changes the sound or the export unless the singer moves a control.

## Decisions for Philip (recommendation first; the design below assumes it)

1. **What is the Drums group fader?**
   - **Recommended: a linked control, no new audio bus.** It moves Kick, Snare and Hats together by the
     same number of dB, keeping their balance; it stops when the loudest reaches 140 %, so the balance
     never bends, and at the bottom all three go silent together. Levels are stored as whole percents, so
     each move is computed from the levels at the start of the drag and rounding never accumulates. Its
     mute and solo act on all three; its meter combines the three (the highest
     peak, the summed power). No change to the audio graph, the saved project or the export.
   - Alternative: a real drum bus, a ninth channel with its own fader, EQ, sends and true bus meter.
     It changes the audio graph, the export path and the saved format (`mx` is index-mapped by channel).
2. **How does the mixer get compact?**
   - **Recommended: short strips in the dashboard, one channel's detail at a time.** Each strip keeps its
     name, a shorter fader, meter, dB value and M/S (about 150 px tall), in one row with the Master pinned
     at the right. Pan, EQ Low/Mid/High and the Reverb/Delay sends move to one "Channel" row under the
     strips for the selected channel, the same controls one channel at a time. The mix effects row (Space,
     Echo, Repeats, Punch) sits behind a "Mix effects" toggle. Guided mode and the dock keep the full strips
     exactly as they are.
   - Alternative: keep the full strips and let the singer drag the editor area taller. The default stays
     as measured above.
3. **What does the Master meter read?**
   - **Recommended: what the export writes**, after the limiter, with a "Limiting −x dB" sign read from
     the limiter's own gain reduction.
   - Alternative: keep reading the sum before the compressor and limiter, labelled "into the master".

## Design

### E1. Levels in dB

- Fader positions are stored as today (% in `mx`, no format change). Every level label shows dB:
  20·log10(vol/100) to one decimal, "−∞ dB" at zero (100 % is 0.0 dB, 50 % is −6.0 dB, 140 % is +2.9 dB);
  the master from its own 0 to 100 %. EQ values in dB (±12). Sends in dB from the gain the audio actually
  uses, "−∞ dB" at zero. Double-click reset unchanged.

### E2. Real meters

- Every channel meter and the Master show peak and RMS on a dBFS scale (−60 to 0, marks at −24, −12, −6
  and 0), peak hold 1.5 s, and a clip light that latches until clicked when a sample reaches full scale.
  Channel meters stay post-fader, as the analysers already sit. The Master follows decision 3. Meters fall
  to −∞ when playback stops. The dock's mini meters use the same dBFS scale (bars only, no numbers).
- A meter reads the louder of left and right. An analyser on its own measures the mono sum, which would
  read a hard-panned channel up to 6 dB low and could miss a clip on one side; so each meter splits left
  and right into two taps off the existing analyser point. Only the master tap moves (decision 3).
  Analysers and taps pass audio through unchanged, so the export must be byte-identical before and after:
  checked by hash.

### E3. The Drums group

- In the dashboard mixer the three drum strips start collapsed into one "Drums" strip (Kick · Snare ·
  Hats) with an expand arrow; expanded, the three strips show as today, with their "+ Clap" and "+ Perc"
  labels. The fader, mute and solo follow decision 1. Collapsed or expanded is view state, not saved.
- Selecting the Drums lane selects the group strip, and the three strips keep their selection marks, so
  A's claim C5 (three strips highlighted) still holds when collapsed.
- The per-voice levels of clap, open hat and shaker stay in the Beat grid, where they are today.

### E4. A compact mixer that fits

- Per decision 2. Target: every channel strip and the Master fully visible, without scrolling, at 1024,
  1280 and 1440; the mixer content at most 200 px tall, so while the Mixer is the open editor the editor
  area shrinks toward its 180 px minimum and the arrangement gets the rest. The other editors keep the
  height they have today.
- Clicking a strip selects its lane, as since A.

### E5. Selected-track controls that say what they do

- In the Shape rail, "Filter cutoff" becomes "High EQ" in dB: the same control, now named for what it
  already does. The sends show their real dB (E1). No new processing.

### E6. Mix Check in the mixer

- "Check my mix" in the dashboard mixer's header runs the same Mix Check and lists its warnings there.
  A warning that names a mixer setting gets "Show", which selects the channel and highlights the control:
  kick covering bass → the Kick and Bass faders and Bass Low EQ; reverb filling the vocal space → the
  Melody and Chords Reverb sends; parts pushed wide → the wide Pan controls; several channels pushed hot
  → those faders. In this list, Show replaces the two fixes that point at Balance; fixes that name a
  Shape slider (Weight, Space, Bass Breath) keep their wording, since the Shape rail is on screen. Warnings
  about notes (the bass running into the backbeat, busy sections) have no Show. Mix Check's own rules and
  text, and the Balance card in Guided mode, are unchanged.
- The clip warning stays a settings rule and is worded as one in the dashboard list; measured clipping is
  the meters' job (E2).

## Out of scope for E

A real drum bus (unless decision 1 goes the other way); clap, open-hat and shaker faders in the mixer;
automation; new effects; a measured, offline Mix Check; metering of the reference's input; anything on a
phone (the dashboard is hidden at 767 px and narrower, by design since A). Not reopened: the clip bar, the
Target, the editors. No bass note editor, no reference fades.

## Verification

Test-only `qa/dashboard-e.qa.js`, RED on f304607 first, then GREEN, then live.

- **Fits:** at 1024, 1280 and 1440, fresh, every strip and the Master fully inside the editor area, with
  each fader and M/S button clickable (elementFromPoint); the arrangement viewport taller than the
  measured 58 / 182 / 244 px. RED today.
- **dB:** labels at 0, 50, 100 and 140 % read −∞, −6.0, 0.0 and +2.9 dB; sends equal the real gains in
  dB; EQ labels in dB. RED today.
- **Meters:** a synthetic 1 kHz sine at −12 dBFS through the Sample channel (above its high-pass) reads
  the peak and RMS the channel's own gain predicts, within 1 dB (the test computes the expectation, it
  does not assume unity); panned hard left, it reads the left side's level, not the mono sum; a sine over
  full scale lights the clip sign; silence reads −∞; driving the master shows Limiting; the export's bytes
  are identical before and after the build. Needs a running audio clock: if the test
  pane's clock is frozen, reported NOT RUN, with the freeze shown on a bare audio context. RED today.
- **Drums group:** one Drums strip when collapsed; its fader down 6 dB lowers Kick, Snare and Hats by 6 dB
  each; it stops at a limit without bending the balance; M mutes all three; expand shows three; the saved
  `mx` has the same 8 channels. RED today.
- **Rail:** the High EQ label equals the channel's high-shelf dB; the sends equal the real gains. RED today.
- **Mix Check:** a kick-covering-bass project; Check my mix lists it; Show selects and highlights the Kick
  and Bass controls. RED today.
- **Mutants (proposed):** meters back to RMS × 260 must fail Meters; a meter reading the mono sum must fail
  the hard-left reading; a Drums fader that moves only the kick must fail Drums group.
- **Regression:** A 18/18, B 9/9, C 8/8, D 9/9; ship gate at 375, 1024, 1280, 1440 fresh plus a live shrink
  1440 → 375; network law (one `fetch(`).

**What these checks do not establish:** how a mix sounds; meter ballistics against a hardware meter; a
real finger on a short fader; Safari.

## Release

13.8.0-rc.6 → 13.8.0-rc.7. Commits on `wt/rc-fixes`; pushed to `main` only on Philip's build word, with
`main` still f304607 immediately before the push; proved live by hash, the gate, and the E checks.
