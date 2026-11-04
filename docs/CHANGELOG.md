# Changelog — Aura Studio `/rc/`

The `/rc/` build only (`https://pgparadigm.github.io/aura-studio/rc/`). The root build stays 13.6.0-rc.3. Every
release here passed the full regression in Chromium and WebKit from a frozen copy, with the export and saved state
matching f304607. Plan: `docs/superpowers/plans/2026-10-25-aura-north-star.md`.

## 13.9.0-rc.10 — the dock and the mixer (north star S12)

- **The dock's row** holds the editor tabs (Mixer, Beat grid, Piano roll, Lyrics, Vocal coach, Perform) and, at its right
  end, **Mix check** (Check my mix, with the mixer brought forward so its findings can point at the strips) and **Sources**
  (the Rights & Sources card, which Studio could not reach before, now opens in the dock).
- **Every strip the same width**, the Master's too, filling the dock. Each shows its track's icon in the lane's colour,
  its whole name, its level in dB above the meter, the meter and the fader, a **pan knob** with L and R, and M and S. The
  knob is the channel's Pan (the same value as the Pan control below it): drag up and down, the wheel or the arrow keys;
  double-click centres it. The Drums knob turns Kick, Snare and Hats together, keeping their spread.
- **The meters are LED columns**, L and R side by side, green at the floor, amber near the top (the same live meters as
  before: nothing of them reaches the export).
- **The selected track's strip is lit** (a violet border and a glow); picking a lane lights its strip, picking a strip
  picks its lane. The Master strip no longer looks selected.
- The Master's loudness readouts (S, I, TP, the file) sit in their own column beside it, with Mix effects and Reset
  mixer under them; the mixer's head row is gone in Studio, as in the picture.
- Checks: `n12Tabs`, `n12StripParts`, `n12EqualWidth@1440`/`@1920`, `n12SelectedStrip`, `n12StereoMeters`. Fourteen
  mutants killed. `n12EqualWidth` was written after the layout it checks (a guard, red on the rc.9 tree and proven by a
  mutant); the stereo half of `n12StereoMeters` guards behaviour that was already there.
- With Drums or the voices open the strips share the row with no sideways scroll, as E required (`e4Fits`): each
  narrower, its name without the icon and a size smaller; every name stays whole.
- QA, retargeted: `e3Select` takes a lit border and glow (this release's style) as well as an outline for the selected
  Drums group; a strip with neither still fails it.
- Each strip's icon follows its name in the markup and shows first (a reader takes the name's first child, and
  `n5OneNamePerTrack` read the icon as an empty name). Mix effects and Reset mixer head the readouts' column: below
  1400 px Ask Aura floats over the dock's bottom-right corner, where Reset mixer had been. The fader zone is 88 px (96)
  so the lanes keep their room (E15).
- QA, extended: `e5Units` reads the new Drums knob as the three drums' middle pan (it read every Drums control as the
  fader).
- The knob's L and R are 11 px (they were 9.5), and an open group's names 11 px (10), held whole by tighter spacing:
  the type floor `n5Type` holds.

## 13.9.0-rc.9 — energy and sections (north star S11)

- **The energy lane** has its name and legend (Target, Measured) in the track-name column, a 0 / 50 / 100 scale at the
  plot's edge, the Target curve filled beneath, and Measured drawn dotted. Musical intensity is a chip in the plot's corner.
- **One point per section on the Target curve**, at the section's middle. Dragging it up or down (or Arrow up and down
  when it has focus) sets that section's Intensity exactly as the Shape panel's slider does; one undo step a drag.
- **Section blocks move and resize:** drag a block along the song to move its bars onto empty bars; drag its right edge to
  lengthen or shorten it. Both go through the arrangement's own move and resize, so energy follows; one undo step a
  gesture. A click without a drag still selects the section.
- **Each section block wears its slot's colour** (six slots); the selected one glows.
- Checks: `n11Scale@1440`/`@1920`, `n11DragPoint`, `n11SectionDrag`, `n11SectionResize`, `n11SectionLook`. Eleven
  mutants killed. `n11SectionResize`, and the part of `n11SectionDrag` that stops the click after a drag from undoing the
  move's selection, were written after the code, as guards, each proven by a mutant rather than a red-green step.
- QA, retargeted: `claimsB` C8 reads the energy lane's whole legend (Target and Measured are two entries now, as in
  the picture; it read only the first). A legend without Measured still fails it.
- The energy scale's numbers are 11 px (they were 10.5, under the type floor `n5Type` holds).

## 13.9.0-rc.8 — lanes and clips (north star S10)

- **Lane heads** show the lane's colour, its instrument icon, the name, M and S. The vocal lanes have a record-arm: it
  makes that track the one Record records into. Melody's lock is Preserve's Melody (the same switch as the panel's); the
  voice shows the badge (Aura never changes it).
- **The Voice group:** Lead, Double and Harmony fold into one Voice row (as in the picture) and back; the fold is kept on
  this device. Folded, the row shows every track's takes, and its M and S act on all three.
- **Clips show what they play:** MIDI clips draw their notes (every drum hit, chord step, melody and bass note, bar by
  bar), audio clips their waveform, read from the take's or the import's own samples.
- **The selected clip glows** in its own colour.
- **Ctrl-drag (⌘ on a Mac) copies a clip** onto empty bars; the original stays; one undo step.
- The track names have a wider column (184 px), so none is cut.
- Checks: `n10LaneHead`, `n10VoiceGroupSet`/`Kept`, `n10NotePreview` (counted from the saved patterns), `n10Waveform`,
  `n10SelectedGlow`, `n10CtrlDragCopy`, one at a time, each red first; ten mutants killed.
- A vocal lane that is not armed shows a grey ● (a faint red read 2.2:1, under `n4Contrast`'s 4.5:1); armed, it is red.
- Clip names are 11 px (they were 9.5, under the type floor `n5Type` holds).

## 13.9.0-rc.7 — the arrangement's ruler and view (north star S9)

- **The arrangement's head:** "Arrangement", Snap, zoom (− slider +) and Fit, as in the picture, at every Studio width.
- **A bar ruler** above the sections: a tick each bar, numbers spaced so they never crowd (every bar on a short song,
  every other bar on a 32-bar song at 1440 px), each exactly over its bar line.
- **Zoom:** up to 8×; the ruler, sections, energy and track lanes widen together and stay lined up, the track names stay
  where they are as the song scrolls sideways, and Fit shows the whole song again. While playing zoomed in, the view
  turns a page so the playhead stays on screen.
- **Snap** (Bar, Beat, Step, Off) sets how far a vocal take moves when dragged: by whole bars, beats or sixteenths, so its
  own timing against the beat is kept; Off moves it freely. Kept on this device. Trims and Split are not snapped.
- **Track rows are 36 px** (they were 44 to 46), so more of the song's tracks fit.
- Checks: `n9RowHeight`, `n9Ruler` (8 and 32 bars), `n9ZoomFit`, `n9PlayheadFollows`, `n9SnapSet`/`n9SnapKept`, one at a
  time, each red first; nine mutants killed.
- QA, retargeted: `claimsB` C7 (the shared playhead covers the lanes) now measures to the last lane's bottom. The lanes
  box takes its own height since this release and so includes 12 px of bottom padding below every lane; before, the box
  was shorter than its lanes and any playhead reached past it. A mutant that stops the playhead short still fails C7.
- **The lanes keep their room (E15):** the head, the ruler, the sections and Energy take 32 px less than this stage first
  gave them (the ruler 18 px, the section blocks 30 px, tighter margins); at 1440 px the lanes show 290 px (280 required).
- QA, retargeted: `e15Height` asks for its minimum or the lanes' whole height when that is less (36 px rows make all
  nine lanes 356 px, so at 1512 px every lane is on screen and 360 px cannot be reached). A dock that takes the lanes'
  room still fails it.
- The ruler's numbers are 11 px (they were 10, under the type floor `n5Type` holds).
- QA: Snap joins the dead-control sweep's behaviour-only list (its job is the next drag; `n9Snap` holds it).

## 13.9.0-rc.6 — the Sounds panel (north star S8)

- **Featured presets you can hear without changing anything.** ▶ on a card plays its sound for about two seconds, in
  your key; it used to apply the preset and start the whole song. A press on the card applies the sound, as one undo
  step (Deep pulse and Air texture could not be undone before).
- **Each card shows its sound:** a thumbnail drawn on your device (nothing is downloaded) and the shape of that same
  two-second phrase: where each note sounds and how it fades.
- **Grounded, Radiant and Dreamlike** sit on one row in their own colours. With none pressed you see Warm keys, Deep
  pulse and Air texture; a feeling features three of its own (nine presets in all, each one of Aura's own sounds); press
  it again for the first three.
- **Search finds presets** by name or tags (and still filters the vibe tiles), and says when nothing matches. The icon
  beside "Sounds" shows everything again; it is greyed out when nothing is filtered.
- **Project intention** is a card: what the record is for, and what Aura keeps (your voice always, the melody while
  Preserve's Melody is on). The pencil edits it; Enter keeps it (one undo step), Escape leaves it.
- **From 1120 to 1399 px Sounds is a slim rail**, so the arrangement gets about 150 px more. Its search icon opens the
  whole panel over the arrangement; Import audio and Record sound are on the rail too. From 1400 px the chevron beside
  "Sounds" folds it to the rail and back, and remembers.
- **Local project** sits at the foot of the column; the column scrolls as one, so in a short window nothing is cut off
  (on a 1024x768 drawer the foot used to fall off the screen). An unsaved take marks the rail's search icon where the
  panel is a closed drawer.
- Checks: `n8PreviewPlays`, `n8CardApplies`, `n8Cards`, `n8Chips`, `n8Search`, `n8Intention`, `n8IconRail`,
  `n8CollapseSet`/`n8CollapseKept`, `n8Foot`, `n8Spacing`, written one at a time, each red first or killed by a mutant
  (fifteen in all). `e12NoticeWhere@studio1280` now checks the drawer placement, as Philip's 2026-09-26 rule gives it.
- QA: rc.5's share-link name check (`n7NameLink`) could not run on the live site: its addresses began with `/rc/`, which
  on the live build left `/aura-studio/` for GitHub's 404 page. They are relative to the page now (the app was not at
  fault; the check never reached it live). Its mutant is still killed.

## 13.9.0-rc.5 — the top bar (north star S7)

- **One row, as in the picture, from 1120 px:** the emblem and AURA STUDIO, the project's name with ⌄, Saved on this
  device; undo and redo; ■ ▶ ● in one box; "92 BPM ⌄ | E minor ⌄ | 4/4"; the position as bar.beat; Loop; Guided |
  Studio; **Export**, the one filled button. 56 px tall (it was 72), so the arrangement gets 16 px more.
- **■ Stop** stops what is playing (a take too) and puts the position back at the start.
- **The tempo button** opens Tempo, Swing, Vol and the metronome (right-click it for its settings). **The key button**
  opens the key and the mode, the same ones Song settings holds. A tempo or key change undoes in one step.
- **One Loop:** on loops this section, off plays the whole song.
- **Export** makes the WAV in one click and shows its progress.
- **Click the name to rename it** (Enter keeps it, Escape leaves it); it comes back after a reload. The ⌄ beside it
  opens the Project menu, which now also holds Recent Projects, Help & shortcuts, Export MIDI and Copy link.
- Narrower windows give up the wordmark first, then the save line. Below 1120 px the bar is as it was.
- Export's violet is deep enough for its white text (5.7:1; 4.2:1 is under the 4.5 floor), the name shows a focus ring
  when reached by Tab, and the bar's smallest text is 11 px.
- **Perform's Section ▶ and ◀ Section with Loop on** move the loop to the next or previous section (they did nothing
  there), or say there is none.
- **Rebuild with Aura's melody ideas work again.** Since 13.9.0-rc.3, ▶ Audition and Apply melody ideas said "Every
  note is dropped" and did nothing: Preserve's new yes-or-no check had the same name as the ideas' own note list and
  replaced it. Correction to 13.9.0-rc.3, which called the core path complete with this broken. A check now fails on
  any two functions of the same name (`n6NoDuplicateFunctions`); `n6MelodyIdeasApply` imports a song with a clear line,
  auditions and applies its ideas (one undo step).
- Checks: the `n7*` set (row and order at 1920, 1512, 1440 and 1280; Stop; tempo; key; 4/4 and position; Loop; Export;
  the name, its reload and a share link; Perform with Loop), each red on 13.9.0-rc.4 or killed by a mutant. Header checks
  that held the old bar now hold this one (see the S7 plan); below 1120 px they still match 9a9f19d.

## 13.9.0-rc.4 — your song, as it is

- **An imported song kept as the track comes out exactly as it went in.** It plays at its own speed (it used to be
  sped up or slowed down like tape to the project's tempo, which also moved its pitch: 10 % slower and about 1.8
  semitones lower when the project sat at 90 BPM and the song at 100) and goes straight to the output at its Level:
  none of Aura's master processing (compressor, treble boost, limiter), high-pass, EQ, pan or effects. Measured on a
  stereo test master: correlation 1.0, level 0.00 dB, cancels against the original by 90 dB or more in both engines.
- **Include it in my track sets the project's tempo to the song's** (the nearest whole BPM), so Aura's parts line up.
  If you move the tempo afterwards your song keeps its own speed and Aura's parts follow the new tempo.
- **Your own Level, Pan and EQ moves on your song still apply**; Aura adds nothing on its own (no reverb or delay
  sends, no master processing). A stereo song is no longer 3 dB hot in the channel. Its live level is set when it
  starts playing, for the song loaded then, mono or stereo.
- **The Remix plan keeps your bass** unless you tick "Cut the sample below 140 Hz" (it was ticked by default).
- A section chosen to loop under the beat keeps the old behaviour (matched to the tempo, through its channel).
- Correction to 13.9.0-rc.3: its export checks held the length of an imported song, not its sound; the 30 s song came
  out 33.33 s because it was slowed down.
- Checks: `n6ImportAsItIs`, `n6RemixKeepsBass`, each red on 13.9.0-rc.3 and with a mutant; `e2AsIsFollowsSong`
  (a stereo song after a mono level) red on this release's build before that, where `e2Sine`, `e2Square`, `e2Scale`
  and `e2Hold` also read a mono song 3 dB low. `e2ExportGraph` sets aside
  exactly the kept song's route (Philip's ruling) and must otherwise match f304607 line for line; a change elsewhere
  and an extra node in that route both still fail it.

## 13.9.0-rc.3 — the core path

- **Your song at the desk:** after Import audio in Studio, the editor opens **Your song** with the song's card (play,
  Include it in my track) and Rebuild with Aura (tempo, Apply the key and chords, the beat). Before, both lived in
  Guided's song room, which Studio hides, so an import left nothing on screen to match Aura to the song. A Your song
  tab is there while a song is imported.
- **Preserve is real:** with Melody on (the default), Architect's room for vocals and the Transitions leave the melody
  alone; off, they change it as before. Voice is a badge: no Aura change reaches the voice.
- **Start with a vibe** gives the vibe tiles the whole Sounds column (they had a strip as short as 36 px at 1280x800);
  the column's close or Escape brings Sounds back.
- **Clear melody** on a section with no melody says so instead of doing nothing; so do Perform's **Next version** with
  one version (Add as variation makes another) and its **Pads** with no sound made (Make a sound fills them).
- **Project-file schema** restored into `docs/` and brought up to schema 5.
- Checks: every visible Studio control pressed once and none does nothing (`n6NoDeadControls`, 144 controls); the
  core path walked at the desk (`n6DeskCorePath`) and on the phone (`n6PhoneCorePath`); exports keep a take past the
  last bar and an imported song longer than the arrangement whole (`n6ExportTakeWhole`, `n6ExportImportWhole`).

## 13.9.0-rc.2 — the right panel (north-star S6)

- **Four cards, all on screen** at 1440×900, 1512×982 and 1920×1113 with nothing scrolling: the section, the
  selected track, Aura guidance and Song tools. The panel column is wider from 1400 px and each slider is one line
  with its value. From 1400 to 1499 px the Sounds column is 30 px narrower, so the mixer keeps its room.
- **Section card:** the section's name and bars with previous and next; Intensity, Warmth, Movement and Space; the
  Preserve chips for Voice and Melody.
- **Warmth is per section** (Philip's ruling): from a section's first bar, the chords' treble and low end lean warmer
  or brighter than the mixer sets them. A section left at the song's Warmth schedules nothing, so existing projects
  sound exactly as before, and a file from before opens with its Warmth in every section. A file that gives a section
  its own Warmth is schema 5: an older build refuses it instead of playing it wrongly.
- **Selected track card:** a Sound menu first (Warm keys: Soft Rhodes, E-Piano, Pad, Nylon; Melody and Bass offer
  theirs), then High EQ, Reverb send and Delay send in dB. The chord sound moved here from Warmth.
- **Aura guidance:** Preview, Apply, Apply to all (every section you have shaped, in one undo step; it replaces "Apply
  to whole song") and One-step undo. Ask Aura sits in this card from 1400 px.
- **Song tools:** Architect, Transitions, Finish, and Settings, which opens the song-wide settings that used to sit
  under the panel (key, chord mood, sounds, levels, Reverb, the beat).
- **Removed** (Philip's stage-3 ruling): Room, Echo and "Apply to whole song". Their saved values still open and save.
- **Fixed:** picking a section spent an undo step a few seconds later, so Cmd+Z walked back through sections instead
  of undoing the last edit.
- Known: the Preserve chips hold Voice and Melody, but no Aura change reaches those tracks in this release, so turning
  one off changes nothing yet. The phone shows no right panel until S16.
- Checks: `c2WholeSong` and claims row C12 retired with the controls they drove; claims row C10 holds the locks'
  guarantee; the S6 checks run where the panel exists (1920, 1512, 1440 as a column, 1280 as a drawer).

## 13.9.0-rc.1 — the spec's palette, type and names (north-star S5; the layout phase begins)

- **Palette and frames:** the page runs #120d1a to #1a1324; the top bar, Sounds, the workspace and the right panel sit
  on #1e1729 with a 1 px #2e2440 border and 10 px corners.
- **Type:** the system font everywhere (no condensed Arial Narrow); title case instead of capitals, except the Aura
  Studio wordmark and the section line; nothing smaller than 11 px.
- **One name per track:** the mixer says Warm keys, Atmosphere and Lead, as the lanes do (it said Chords, Sample and
  Vocals). Saved projects and the export are unchanged.
- Checks: the mixer claim finds the chords channel's strip by its id, not its name; the header is no longer held box
  for box against rc.10 (S5 and S7 change it by design) but to the same controls, its height within 2 px, and nothing
  clipped or off screen, at every width. The export-graph check no longer loses track of an audio parameter when
  WebKit garbage-collects it mid-render (about 1 WebKit run in 30 failed; under added garbage f304607 failed it too;
  the export itself was not at fault), and a new check holds that through a forced collection. The version claim
  accepts any version from 13.8.0-rc.1 up (it accepted only 13.8.0-rc.N, so this release failed it on the live site
  and was withdrawn, then republished unchanged once the claim was fixed).

## 13.8.0-rc.20 — accessibility (north-star S4, part one)

- **Every control has a name** for screen readers: the nine right-panel sliders had none.
- **Keyboard focus is always drawn:** text boxes, links and folding headings had no focus ring.
- **Text contrast:** white text on the Play, pattern, Apply and phone "Play backing" buttons now meets 4.5:1 (the
  lightest part of their violet was too light).
- Not yet: the 32 px minimum size for desktop controls, waiting for Philip's choice of when (now, or region by region
  as each is redesigned).

## 13.8.0-rc.19 — the piano roll fills its panel; the header Key is right (north-star S3)

- **The piano roll fills its panel at every width**, with no empty space either side (it was 640 px wide and centred:
  212 px of empty space each side at 1920). On a phone it still scrolls sideways inside its own frame.
- **The Studio header's Key always shows the project's key** (it showed "C major" until playback, whatever the key).
  Every key change now goes through one place, a restored project included, and a check fails if anything bypasses it.
- Guards added: no sideways page scroll in any view at 1920, 1440, 1280, 1024, 768 or 390; Ask Aura covers no control
  below 1400 (above 1400 it is moved in a later release).

## 13.8.0-rc.18 — undo (north-star S2)

- **Undo starts empty on every load.** A fresh project used to start with two undo steps of Aura's own set-up, so
  the first Undo undid the starting groove.
- **Ctrl/Cmd+Y redoes**, next to Ctrl/Cmd+Shift+Z.
- **The Undo and Redo buttons are disabled when there is nothing to undo or redo** (the top bar and the Perform card).
- Known, not changed here: the Studio header's Key is stale until playback (fixed in rc.19); the project name is not
  autosaved (S7).

## 13.8.0-rc.17 — first run and dialogs (north-star S1)

- **A first visit opens no dialog.** The demo song loads in Studio and a four-step tour (Sounds, your song, the
  mixer, Aura's ideas) points at each part. The tour never covers the top bar; Esc, the X or Done end it for good.
- **Returning visitors open their last project**, as before, with no dialog and no tour.
- **The Welcome moved to the menus:** "Start something new…" in the Project menu, and in the ⋯ sheet on a phone.
- **The Welcome and the Create sheet** close with Esc wherever focus is, and with a click on the backdrop; the Create
  sheet has an X, keeps Tab inside it, and gives focus back to the button that opened it.
- **Fixed:** a page that loaded straight into Studio drew an empty arrangement, and picking a vibe in Studio left the
  lanes showing the old vibe (the arrangement was not redrawn after a vibe).
- Known, not changed here: a reloaded project shows "Untitled" because the project name is not autosaved (S7).
- Known, not changed here: in Studio the header's Key shows the key from before the project loaded (e.g. "C major" for
  a D# minor song) until playback starts; present in rc.16 too. Proposed for the next release (S2).
