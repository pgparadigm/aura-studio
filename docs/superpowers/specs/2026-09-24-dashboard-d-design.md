# Studio dashboard, sub-project D: clip editing

Date: 2026-09-24 · Build base: `main` bfe3c45 (13.8.0-rc.5, A, B and C proved live) · Owner: the "Aura
Studio" Claude session, sole writer · Status: **spec only, awaiting Philip's build word**

## What a clip is in Aura (everything below follows from this)

- **A MIDI clip is a view of a section run.** Drums, Bass, Keys, Melody and Texture at the same bars
  are one section: one pattern (one bar of 16 steps) played for each bar of the run. Moving or editing
  one lane's clip moves or edits that section, on every lane at those bars and in every other place
  the section plays. D keeps this model (6 section slots, 32 bars; no per-lane patterns) and says so on
  screen instead of pretending clips are independent.
- **Loop already exists.** Lengthening a clip with B's trailing-edge resize repeats its one-bar pattern,
  so a longer clip is a loop. D adds no separate loop gesture.
- **Audio clips are not in the project.** Voice is the take's edit list (non-destructive, memory-only,
  its own undo in the take room). Atmosphere is the imported reference and the part of it that loops
  (memory-only, its own undo). `MEDIA_PERSISTENCE` says neither is ever saved, and D does not change
  that.

## Measured on live bfe3c45 (what D fixes)

1. **Split can erase a section you wrote.** Reproduced on live `/rc/` in the test pane: pattern 2 held a
   two-note melody and was not placed in the song; an Alt-split of the Intro wrote the Intro into
   pattern 2 and the melody went from `[[60,0,4,90],[64,4,4,90]]` to `[]`, with no warning (one Undo
   entry, so Undo recovers it if you notice). Cause: `songSplitBlock` takes the first slot **not placed
   in the song**, not the first **empty** one. The Song view's "Split in two" button (since v13.6) uses
   the same function. The copy also drops the bass notes' `g` field, and `patternHasNotes` ignores bass.
2. **"Repeat it" can delete the end of the song.** Reproduced on live: a 32-bar song of four 8-bar
   sections; Repeat on the first returned success and section 4 (bars 25–32) was gone. `songDuplicate`
   drops whatever is pushed past bar 32; the Song view's guard checks only that the copy fits.
3. **Split is invisible and fixed at the midpoint.** It exists only as Alt+press on a clip. Duplicate,
   Delete and "make this one its own" are not reachable from the dashboard at all.
4. **The Target curve does not follow the music.** None of `songResize`, `songMoveBlock`,
   `songDuplicate`, `songRemoveBlock`, `songSplitBlock` or `songMoveTo` (B's drag) touches the Target,
   so after a drag, a repeat or a removal the drawn Target sits over different music.
5. **Double-click opens the wrong editor.** Keys opens the *melody* piano roll; Drums and Bass open the
   Mixer; Texture (open hats) is marked `kind:'audio'`, so double-click does nothing.
6. **The audio lanes draw a placeholder.** Voice draws one block across the whole song, not the take's
   clips; Atmosphere draws the same block whether the file runs once or loops a part.
7. **The guidance line always asks for more lift** (found in C): it compares raw energy with 0.45,
   which Aura's fullest groove (about 0.42) never reaches.

## Goal

Edit clips where they sit: split where you choose, repeat, make one occurrence its own, remove, and open
the editor that actually holds that lane's notes; see the voice take's real clips and trim, fade, move
and split them in place. Never lose music silently, and keep the drawn Target over the music it was
drawn for.

## Decisions for Philip (recommendation first; the design below assumes it)

1. **What does Delete do to the time after the clip?**
   - **Recommended: close the gap**, the same meaning as the Song view's "Take it out", with the Target
     moving with the bars (D4). One meaning across both views.
   - Alternative: leave silence where the clip was (the usual DAW behaviour); the song keeps its length
     and a gap appears.
2. **Should the Target follow the music for every run operation, including B's drag and the Song
   view's buttons?**
   - **Recommended: yes.** They share the same run functions, so one helper fixes all of them. B's checks
     re-run unchanged (they measure `song`, not the Target).
   - Alternative: only D's new operations; B's drag keeps leaving the Target behind.
3. **How do voice clip edits undo?**
   - **Recommended: through the take's own history**, with an "Undo clip edit" button on the clip bar
     while a voice clip is selected; Cmd+Z and One-step undo stay the project's. Take edits cannot enter
     the project history, which is built from the saved project, and audio is never saved.
   - Alternative: one merged undo across project, take and reference. A new architecture, not D.

## Design

### D1. The clip bar and the run operations

- **Clip bar:** one line at the top of the arrangement, shown while a clip is selected, visible at 768
  to 1440 without opening a panel; it wraps, never widens the page. It names the clip and where it
  plays: "Verse · bars 3–4 · also plays at 9–10".
- **MIDI clip actions:** Split at bar N · Repeat · Make this one its own · Remove · Edit notes.
  Keyboard, only while the arrangement has focus: Enter = Edit notes, Delete or Backspace = Remove.
- **Split at bar N:** N is the bar where you last pressed the clip (a press without movement selects it
  and marks the bar; clamped so both halves keep at least one bar); selected by keyboard, it is the
  midpoint. The button always shows N. Alt+press stays as a shortcut and now splits at
  the pressed bar through the same function.
- **Repeat:** a copy straight after, pushing the rest along. **Refused, with the reason on the button,
  when anything would be pushed past bar 32** ("No room: bars 25–32 would fall off the end"). The same
  rule applies to the Song view's "Repeat it".
- **Make this one its own:** points this run at an empty section slot holding an exact copy, named
  "Verse 2", so its notes can change without changing the other Verse.
- **Remove:** per decision 1.
- **The free-slot rule** (split, make its own, both views): a slot is free only if it is not placed in
  the song **and holds no music** (drums, chords, melody, bass, accents). A slot with music is never
  overwritten. With none free, the action is disabled with the reason: "All 6 sections hold music.
  Clear one first."
- **Copies are exact:** every note field (bass `g` included), accents, and the section's stored Shape
  values from C.
- **One action, one Undo:** each runs inside one checkpoint, as today.

### D2. The editor that holds the lane's notes

| Lane | Double-click or Edit notes opens |
|---|---|
| Drums | a new **Beat grid** editor tab (the existing step grid and step bar, moved into the editor host like the other tabs), on the clip's section, drum rows in view |
| Keys | the Beat grid, chord rows in view |
| Texture | the Beat grid, open-hat row in view; the lane's `kind` corrected to MIDI |
| Melody | the Piano roll, as today |
| Bass | no editor exists; says so ("Bass is written by the groove and the chords; there is no bass note editor yet") and does not switch tabs |

The editor names what it edits and where else it plays: "Editing Verse · plays at bars 3–4 and 9–10.
Make this one its own to change only here."

### D3. Audio clips that show what plays

- **Voice:** the lane draws the take's clips where they sound, from each clip's `at` and length at the
  current tempo, with musical zero at bar 1. Selecting one shows: drag to move, drag an edge to trim,
  Fade in and Fade out (0.12 s and 0.18 s, the take room's values), Split at the pressed point, and Undo
  clip edit (decision 3). All go through the existing `takeMove`, `takeTrim`, `takeSetFade` and
  `takeSplitAt`, so the dashboard and the take room cannot disagree. The bar says what the take room
  says: take edits live with this recording and are not saved in the project.
- **Atmosphere:** drawn where it plays: the whole file runs once from bar 1 for its length at its
  playback rate; a chosen part loops across the arranged length, drawn with its loop seams. The clip bar
  says "Loops 0:12–0:28 of song.mp3" with **Choose the part** (opens the existing section editor) and
  **Whole file**. No edge-trim on the timeline (the part of the file and the song's bars are different
  axes) and no fades on the reference (none exist).
- The imported-is-not-stems wording is unchanged.

### D4. The Target follows the music

One helper applies the same bar move to the Target as to the song: Repeat copies the run's Target
values into the copy and shifts the rest; Remove takes them out with the bars when it closes the gap
(if decision 1 goes the other way, the Target stays where it is over the silence); a resize
fills new bars with the run's last value; Split and Make its own leave the Target where it is. Per
decision 2, B's drag and the Song view's Earlier and Later use the same helper. Only when a Target curve
exists; Measured needs nothing, since it is computed from the notes.

### D0. The guidance line (in D only because it is one line)

`if(m.energy<0.45)` becomes `if(energyPct(energyTransform(pat,dashParamsFor(pat)).report,m.energy)<45)`:
the same section range C uses. It reads C and changes nothing in C. If the build needs more than this one
line, D0 is dropped from D.

## Out of scope for D

Automation and per-section tone (listed as later in the concept), a bass note editor, fades or gain on
the imported reference, a merged undo across project, take and reference, per-lane patterns, comping and
punch-in, E (drum group, dB meters). The dashboard, and so D, does not exist on a phone (767 px and
narrower keep the classic shell, by design since A).

## Verification

Test-only `qa/dashboard-d.qa.js`, RED on bfe3c45 first, then GREEN, then live.

- **Split never erases:** an unarranged section with a melody; split the Intro; that section is
  untouched and the half goes to an empty slot, or the split is refused with its reason. RED today.
- **Split is exact:** the new half's notes equal the source's, bass `g` included; one Undo restores
  `serialize()` exactly.
- **Repeat loses nothing:** a full 32-bar song; Repeat refused with the reason; every section still
  there. RED today.
- **Make its own and Remove:** layout as decided; one Undo each.
- **Target follows:** draw a Target; Repeat, Remove and drag; each section's bars carry the Target they
  carried before. RED today.
- **Right editor:** Drums and Keys and Texture open the Beat grid on the clip's section at their rows;
  Melody the Piano roll; Bass says so and stays. RED today.
- **Voice clips:** a synthetic take through the existing `takeInstall` hook; the lane draws its clips at
  their positions; trim, fade, move and split through the clip bar change `take.clips` exactly as the
  take room's functions do; the project snapshot is unchanged by any of them; Undo clip edit restores.
- **Atmosphere footprint:** whole file runs once for its length; a part loops across the arrangement;
  Choose the part opens the section editor.
- **Guidance line:** after Apply at 90 it no longer asks for more lift; at 10 it does.
- **Mutants:** the old free-slot rule ("not in the song") must fail Split never erases; the Target
  helper removed must fail Target follows; the Repeat guard removed must fail Repeat loses nothing.
- **Regression:** A 18/18, B 9/9, C 8/8, ship gate at 375, 1024, 1280, 1440 fresh plus a live shrink,
  network law (`fetch(` count 1). Checks that need playback (B's b2Loop, A's C7) need a running audio
  clock; if the test pane's clock is frozen they are reported NOT RUN, with the freeze shown on a bare
  audio context, never counted as passes.

**What these checks do not establish:** how edits sound, a real finger or pen, Safari, a real microphone
take (the take is synthetic), whether singers find the clip bar.

## Release

13.8.0-rc.5 → 13.8.0-rc.6. Commits on `wt/rc-fixes`; pushed to `main` only on Philip's build word, with
`main` still bfe3c45 immediately before the push; proved live by hash, the gate, and the D checks.
