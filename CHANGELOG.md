# Changelog

## v13.2.0 — 2026-07-30 (import & rebuild, completed)

**A singer can import a song and get an editable reconstruction they can check.**
The promise is unchanged and stated on the panel: *Aura creates an editable reconstruction from what
it can hear. Review and adjust the result.* Nothing here claims separation, stem extraction, vocal
removal or transcription, and there is no vocal-removal control, enabled or disabled.

### The panel had three titles; now it has one

The Browser showed **Vibes** (panel title) → **Vibes | Imported Audio** (tabs) → **Start here**. The
tab row is gone. One title, one description, two paths — *Start with a vibe* and *Import a song* —
then `Start here`, `All vibes`, and **Your recording**, which does not exist until a file does.

### Your recording is a reference, and it stays out of your export until you say otherwise

`scheduleSample()` renders into the offline export graph as well as the live one, and `smp.on` was
set `true` on import. A singer could therefore export a WAV with their imported song inside it
without ever having asked for that. **On import the Sample channel is now muted**, the card says
*Not in your track* and *Off, so your export is Aura's parts only*, and one control turns it on.

### The reference card

Name, duration, format, channel count, sample rate and size; waveform; play as recorded (its own
un-warped `BufferSource`, so it is not tempo-mapped like the in-track copy); level; include-in-track;
Use a different file; Work it out again; Compare with Aura; Balance; Remove. No control on the card
is ever disabled — *Stop comparing* is created when there is something to stop and removed when
there is not.

**Compare with Aura** plays *Your recording* / *Aura's version* / *Both together* as a live
multiplier on the existing group gains. It is never written into `mix[]`, so it cannot reach
autosave, a `.aura` file, a share link or a render, and leaving the comparison restores the real
balance exactly because the gains are recomputed from `mix[]` alone. Levels are matched by measuring
the reference's RMS against one bar of Aura rendered through **the same graph as export**, matched
inside 1 dB, corrected by at most 6 dB, and it says plainly when it could not finish the job.

**Quick balance** — Your recording · Aura's version · Drums · Bass & low end · Harmony · Melody —
maps onto the groups that already exist. Two rows are macros that write proportionally into their
members' real `mix[].vol`, so a move persists, undoes and exports with no new schema field. The note
says it, verbatim: *these faders balance the imported recording against the parts Aura rebuilt — they
are not separated stems of your file.*

### Percussion: two questions, two answers

Timing and instrument identification are now measured and reported **separately**. A single averaged
number let a dependable grid hide an undependable drum name. When timing is confident and the label
is not, the hit still lands on its step — in the broad Percussion lane, marked *Needs review* — and
one tap moves it to any other drum or drops it.

Defects found and fixed, each confirmed by measurement:

- **Band energies were sums over unequal bin counts.** `top` spans ~210 bins and `sub` about five, so
  a quiet hi-hat outweighed a loud kick by two orders of magnitude and every ratio said "hat". Bands
  are now mean magnitude per bin — a spectral density, the only form in which they compare.
- **The 120–180 Hz band sat on the wrong side of the kick/snare question.** A kick read `rBody 0.76 /
  rSub 0.21`; the single most important distinction in the file was inverted.
- **Percentile gates forced a fixed distribution of lanes** regardless of content, so a kick-only loop
  could never be all kick and a twelve-onset file took "percentiles" of a handful of samples. Replaced
  with per-band presence tests whose thresholds were read off measured distributions.
- **One merged onset could only name one drum**, so a kick and a hi-hat on the same step were mutually
  exclusive and four-on-the-floor always lost a lane. Each band detector now owns its own events, and
  cross-source arbitration keeps two only when each family carries energy in its own band.
- **The beat grid was placed from broadband flux**, so a pattern with hats on every even sixteenth
  locked a whole sixteenth away from the beat and shifted every step index — dembow was out by 1.5
  sixteenths. The grid is now placed from a low-weighted signal, and refined per beat so a long file
  does not drift.
- **An adjacent-step pass thinned every sixteenth-note lane to eighths.** De-flamming now happens in
  time, where "much sooner than a sixteenth and much weaker" is measurable, and hats are exempt.
- **Voting ran across the whole song**, averaging intro, verse, chorus and outro into a smear and
  deleting anything that only appears in the chorus. Voting now happens inside the most self-similar
  window, and the row says which bars it used.
- **A sustained bass note scored as a kick** — the sub-tail term had no upper bound. A kick thumps for
  55–93 ms and an 808 for 160–175; a bass note rings past 400. That is now a gate, not an opinion.
- **A recording with no drums filled a drum grid.** Aura now measures whether a kit is present at all
  (every fixture with percussion scores ≥ 0.033 against 0.0004 for pad-and-bass) and writes nothing
  when it is not.
- **Accents came from classification confidence.** An accent means *louder*; it now comes from measured
  amplitude against the lane's own 90th percentile.

Swing is measured and offered rather than flattened. Movement finer than a sixteenth is reported
rather than invented. Half-time and half-bar readings, and the metrical relatives of the tempo, are
offered as one-tap re-fits of the preview — no re-analysis, nothing applied.

### Song, harmony, melody

- **Song** finds repeated areas from beat-synchronous feature self-similarity and names them only as
  far as the evidence goes. A repeated loudest area can become a Chorus and a short quiet area before
  it a Pre-chorus; when the recording has too little dynamic range to tell a verse from a chorus, the
  parts are called **A, B, C** and the row says why. Boundaries are adjustable in bars before applying.
- **Harmony** measures chroma once per beat, which buys all four bar phases for free — so *which beat
  your bar starts on* is exposed for review instead of silently applied — and lets one-versus-two
  chords per bar be tested rather than assumed. A close second key is offered. Every bar is tappable
  and only chords inside the key are offered, named in the key Apply will actually set.
- **Applying chords no longer plays the progression four times too fast.** One Aura pattern is one
  bar; four chords were being written at steps 0/4/8/12 of a single pattern. A progression now takes
  one chord per section slot, laid across the arrangement at its real rate.
- **Melody** stays opt-in and now shows its working: when Aura heard each note, what note it became,
  where it lands, and a per-note keep/drop. Steadiness is the measured stability of the pitch, capped
  at 70% and described as what it is — *not* a claim that the line is the tune, the original singer,
  or any one instrument.

### Apply, undo, discard

- **Replace what's there** clears every drum lane in the section, including claps, percussion and
  accents, then writes the reconstruction. Verified: no prior lane survives.
- **Only fill the gaps** writes into empty steps only and never clears a hit or an accent.
- **One Apply is one undo checkpoint.** `autosave()` is where `pushHistory()` runs, and
  `transposeMelody`, `resnapMelodies` and `applyBeat` each autosave on their own — *Apply the key and
  chords* was creating up to three undo steps, and the remix plan up to four. Every apply now runs
  inside `oneCheckpoint()`.
- **Discard changes nothing**: the stored project is byte-identical and no checkpoint is created. The
  4-second autosave timer keeps running and rewrites an identical string, which is why the verified
  claim is *zero state change and zero history growth*, not "zero writes".
- Preview edits — reassigning a step, changing a bar's chord, dragging a boundary, dropping a note —
  live on the analysis object, which is never serialised. Verified: zero state change.

### Measured

`fixtures/import-qa.html` generates 19 original fixtures from a seeded PRNG (no `Math.random`, no
commercial audio) and runs them through **the shipped runtime** in an iframe:

| | v13.2 foundation (one file) | now (19 fixtures) |
|---|---|---|
| onset timing F at ±35 ms | not measured | **0.909** (P 0.835, R 0.997) |
| lane recall | 4/8 | **0.865** (160/185 steps) |
| snare lane | 0/2 — right step, wrong lane | exact on 7 of 8 kit fixtures |
| confident mislabels of ambiguous voices | not measured | **0 of 44** |
| soft vs loud, same pattern | not measured | **bit-identical** |
| fixtures fully passing | — | 15/19 |
| slowest analysis | — | 651 ms (a 58-second file) |

`fixtures/apply-safety.html` drives the real runtime and passes **21/21**.
`python3 fixtures/validate.py` 12/12; `RT-schema-final.aura` PASS.

**Still imperfect, and stated rather than hidden:** a saturated 808 costs lane recall (0.62); drums
under a dense pad and bass cost timing precision (0.74) and recall (0.67); tempo can land on a simple
metrical relative of the truth — the alternates are offered in one tap, but the first answer is not
always the expected one; and key detection picked the dominant minor on one harmony-only fixture.

### Unchanged

Audio engine, bus graph, scheduler, export path, musical data (`VIBES`, `BEATS`, `PROGS`), brand,
Guided Mode, mobile shell. **`.aura` is untouched**: `SCHEMA_VERSION` stays 2, `serialize()` still
returns exactly its 25 keys, and no analysis result or media byte can reach a project file, a share
link or `localStorage`. `appVersion` becomes **13.2.0**.

## v13.0.3 — 2026-07-24 (mobile completion + documentation)

**Phones get a real structure instead of a squeezed desktop.**

- **Mobile top bar (<768px)**: compact emblem, truncated project name, Play, Record and an
  always-visible **More**. The desktop cluster is hidden outright rather than overflowing —
  the transport previously needed 822px inside a 372px viewport, which put Project and the
  overflow menu off-screen and made Save, Open and Export unreachable.
- **Mobile bottom navigation**: Beat · Melody · Arrange · Vocals · **Export** (Export fires
  the WAV export directly). Mix moves into the More sheet.
- **More sheet** carries everything else, one tap away: New Project, Open Project, Save,
  Save As, Recent Projects, Mix, Browser, Inspector, Guided/Studio, Tempo, Swing, Master
  volume, Metronome, Undo, Redo, Copy link, MIDI export, Export WAV and Help. The three
  transport sliders are moved into the sheet as the real controls, not copies.
- Landscape phones (≤430px tall) use the same structure; 44px touch targets throughout.
- The desktop transport above 768px is unchanged, as are all keyboard shortcuts.

**window.prompt is gone**

- **Project name dialog** for Save and Save As: pre-filled and pre-selected text, Enter
  confirms, Escape cancels, focus trap, focus restoration, empty-name validation, filename
  sanitisation (illegal and control characters stripped) and an 80-character cap.
- **Recent Projects drawer** replaces the numbered prompt list: name, relative updated time,
  a note when the project had vocal takes or imported audio that were not stored, plus Open
  and Remove-from-recents per row.

**Fixed**

- `.work` carries a decorative `clip-path`, which clips fixed-position descendants — it made
  the new bottom navigation invisible and unclickable. Disabled on phone layouts.
- On phones, Fit 16 now yields to the 44px touch target and lets the sequencer scroll
  sideways inside its panel, instead of clipping steps behind `overflow:hidden`.
- A `const` declared later in `mountShell` was referenced by the new mobile block, which
  threw a TDZ error and stopped the shell from mounting at all.

**Also** — Inspector rows stack their label above the control in a narrow panel so selects
no longer clip, and the Browser only splits into two columns from 380px (was 320px), which
was wrapping the mood · BPM · key line.

**Release integrity**

- `appVersion` is now **"13.0.3"** — it identifies the build that wrote the file, so a v13.0.3
  export must say so. `schemaVersion` stays 2 and `project.internalStateVersion` stays 13;
  neither the schema structure nor the state format changed.
- `RT-schema-final.aura` regenerated from the final build through the real Save path,
  replacing the export produced from `51900bf`.
- The release manifest is now a generated artefact (untracked): a tracked file cannot contain
  the SHA of the commit that contains it, which is what left the previous manifest naming a
  stale commit.

## v13.0.2 — 2026-07-24 (acceptance fixes)

- **Fit 16 was non-monotonic**: sweeping 1120→1440 the pad *collapsed* as the window widened
  (39→32px at 1184, 33→32 at 1208 and 1232) because the loop took the first plan that fit and
  a looser plan reintroduced the volume column. It now picks the plan yielding the largest
  pad. Re-swept at 4px resolution: 81 samples, zero drops, zero jumps >1px, zero overflow.
- **Active workspace and Inspector state now persist** (`aura-view`, `aura-inspect`); mode,
  Fit/Zoom and the mixer dock already did.
- **Vibe preview now stops**: a second preview replaces the first and starting the transport
  cancels pending hits, via cancellable lookahead timers.
- **Sidebars stopped collapsing on narrow screens** — a regression from v13.0.1 where
  `body.shell.inspect-collapsed .app` re-declared `grid-template-columns` at 3-class
  specificity and overrode the responsive media queries. At 390px the Browser held 220px,
  leaving 138px of workspace. Collapsing now sets `--insp-col` instead.

## v13.0.1 — 2026-07-24 (visual density)

- Guided and Studio no longer compete: the six-step rail belongs to Guided, the five workspace
  tabs to Studio, and the rail's vertical space returns to the workspace. Mode persists.
- **Fit 16** (default) sizes the sequencer so all 16 steps are always visible — pads scale
  32–42px, gaps tighten before readability does, the track-volume column drops before the pads
  shrink further, and lane names are sticky. **Zoom** keeps full-size pads and allows scrolling.
  Touch keeps 44px targets. The chord grid and piano-roll time axis expose all 16 steps too.
  Verified at 1180 / 1280 / 1366 / 1440 / 1536 / 1920 — all 16 beat *and* chord steps visible,
  no horizontal scrolling.
- Browser presets are one compact row each (glyph · name · mood · BPM · key · preview) at
  220–250px, two columns only from ~320px; titles no longer clip. ▶ auditions a vibe's rhythm.
- Every scrollbar is themed: 8px, transparent track, violet-silver rounded thumb — no white.
- The Inspector is 240–260px, starts collapsed, and opens automatically when a note, clip,
  track or imported file is selected; its ⚙ control is now visible at every width.
- Datafield cooled: no warm accents, stronger central vanishing point, darkness preserved.
  Gold is now reserved for root notes, the current chord and section labels; interface
  selection (vibe cards, solo, imported files, badges) is violet-white.
- MIX distributes all nine strips evenly across the width with no dead space; Master is
  distinct without gold. The collapsed 52px dock outside MIX is unchanged.
- Fixed: `.cell` used `transition:all`, so every width measurement read a stale value; and the
  chord divider caption pinned the label column to 182px. Both blocked step fitting.

## v13 — 2026-07-24 (committed; deploy pending)

**Spatial hierarchy + Aura Datafield, then a product-integrity pass.**

- Viewport app shell: 250 / workspace / 300 grid, 72px transport, mixer dock that
  starts collapsed at 52px and expands to 200px (persisted; always collapsed under 760px
  viewport height). MIX view gives the mixer the whole workspace.
- Five stages — Beat, Melody, Arrange, Vocals, Mix. Sample import moved into
  Browser → Imported Audio with a contextual Audio Editor (no longer a sixth stage).
- Aura Datafield: a violet vanishing-point environment with an original music-data glyph
  language (BPM, bar·beat, note names, chords, velocities, frequencies). Intensity
  Off/Low/Full (default Low), auto-reduced while recording, on phones and low-perf; stops
  when the tab is hidden; honours reduced-motion. Working surfaces are near-opaque.
- Sequencer pads 42px, piano-roll rows 19px; six responsive breakpoints.
- File split: index.html + styles.css + app.js (cache-busted ?v=13).

**Product integrity**
- Undo/redo covers every edit (fixed tempo/swing/mode/mixer, which never recorded before).
- .aura schema v2 (independent of app version): readable field names, projectId, created/
  updated timestamps, and separate `capabilities` vs `content` blocks computed from the
  actual project. Validate-then-commit with rollback and readable errors; opening a project
  fully replaces the current one. Vocal takes and imported audio are never embedded.
- Touch-safe accents: long-press, a visible Accent control for the selected step, an ARIA
  label, and keyboard (A). Metronome with level, 1/2-bar count-in, three tones, preview,
  persisted — never in exports.
- Included demo ("Hear what Aura can make"), recent projects, unsaved-work guard.
- Honest audio detection: labelled estimates with confidence and manual BPM/key overrides.
- Error states for mic (denied/absent/busy/insecure), imports (too-large/wrong/undecodable)
  and storage (quota/private).

**Schema consistency (final data-layer pass — no interface/audio/Datafield/layout change)**
- Published contract: `aura-project.schema.json` (JSON Schema draft-07) and
  `AURA_PROJECT_SCHEMA.md` document every array index, tuple position, channel order, range
  and the 16-bit step bitmask rule. Exports now carry an `encoding` block naming those layouts.
- `capabilities` is now an **object** of booleans (was a string array) so new capabilities stay
  explicit and forward-compatible; `content` flags are symmetrical — `hasDrums`, `hasChords`,
  `hasBass`, `hasMelody`, `hasArrangement`, `hasMixerOverrides`, `hasVocalTakes`,
  `hasImportedAudio`, computed from actual state.
- Version fields disambiguated: `schemaVersion` 2 (file format), `appVersion` "13.0.0" (build),
  `project.internalStateVersion` 13 (compact-state migration; the earlier `stateVersion` name is
  still accepted on read).
- Save preserves `projectId` + `createdAt` and moves `updatedAt`; **Save As** (Shift+Cmd+S)
  mints a new `projectId` (`crypto.randomUUID()` where supported) and `createdAt` and lands as a
  separate recent-project entry.
- `mediaPersistence: {vocalTakesEmbedded:false, importedAudioEmbedded:false}` states the
  **format's** guarantee that recorded audio is never embedded — pinned `const:false` in the
  schema, so a file claiming otherwise is invalid. Distinct from `content.hasVocalTakes` /
  `content.hasImportedAudio`, which describe the **current project**.
- **Project menu** in the transport (Save · Save As… · Open Project… · New Project) makes
  Save As discoverable. New/Open/Save moved out of three separate icons into it, which also
  narrows the transport's right cluster from 1923px to 1785px.
- Fixture suite validates against the JSON schema, 12/12, via two independent validators —
  `fixtures/validate.py` (headless) and `fixtures/test.html` (browser): complete, empty,
  unknown-fields, future-schema, malformed, out-of-range tempo, invalid mode, wrong section
  count, wrong arrangement length, invalid note tuple, embedded-media, legacy.
- Verified end to end on the frozen build: a project exported to disk from the real app
  validates against the published schema; reopening it through the file picker and saving again
  preserves `projectId` and `createdAt`, advances `updatedAt`, and the second file also validates.


## v12 — 2026-07-23

**Sample import, remix planner, Guided Mode, MIDI export.**

**Import your own instrumental**
- New **Sample** tab: drop a WAV / MP3 / M4A (or pick a file). Aura decodes it, draws the
  waveform, and detects **tempo** and **key**. Audio never leaves your device and is never
  written to a save file or share link.
- Tape-style sync: the sample plays at `project BPM / sample BPM`, so pitch and speed move
  together exactly like speeding up a record. Half-time toggle, low-cut, and a start point.
- The sample gets its own **mixer channel** (volume, pan, EQ, sends, mute, solo) and renders
  into the exported WAV alongside everything else.
- **Sample BPM is editable** — detection is good but not perfect, so you can correct it.

**Remix plan**
- After import, Aura proposes a concrete, *editable* plan grounded in KANYE-CODEX.md —
  half-time the tempo, move to the detected key, cut the sample's low end so the 808 owns
  the bottom, load a boom-bap kit, duck the sample under the kick. Every line is a checkbox
  mapped to a real control. Nothing happens that you can't see, change, or undo.

**Guided Mode**
- A **Welcome** panel on first visit: *What do you want to make?* — start from a vibe, make a
  beat, write a melody, record over a track, remix your own audio, or open a project.
- **Guided / Studio** switch in the transport, and a dismissible 6-step rail
  (Choose your sound → Build your loop → Add a melody → Arrange → Record → Export).

**More**
- Three vibes closing the gap with the reference library: **Drill · Noir** (G#m, 140),
  **Houston · Melodic** (Gm, 75), **R&B · Silk** (Dm dorian, 88), plus Half-time, Drill and
  Silk beat presets.
- **MIDI export** (♪) — a type-1 file with melody and chords on separate tracks at the
  project tempo, for taking your idea into any other DAW.
- Meters now update from both rAF and a 100 ms interval, so they stay honest even when the
  browser throttles animation frames.

## v11 — 2026-07-23

**The Aura redesign.** Aura Studio is now a viewport application, not a stacked web page.

**Shell**
- Fixed top transport: original Aura emblem (inline SVG — a stylised "A" whose negative
  space forms a three-petal mark, wing arcs, halo, frequency lines), project name with
  saved/unsaved dot, play, record, metronome, Loop/Song, bar·beat readout, undo/redo,
  new/open/save, mixer, share, export. Restrained violet glow while playing; only the
  record control turns pink.
- Left **Browser** with the 12 vibes as tiles — CSS-generated violet covers, a rhythm
  preview drawn from each vibe's own beat preset, BPM and key. No artist imagery.
- **Workspace** tabs: Channel Rack · Piano Roll · Playlist · Vocals.
- Right **Inspector** for project controls; bottom **dock** for the mixer.
- Aura palette: near-black violet environment, purple as the only brand colour, gold
  reserved for root notes and section labels, pink only for record and destructive.

**Playlist**
- Sections are now nameable (Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro by default)
  and every bar clip shows its section name. Auto-fill bars are marked with a gold dot.

**Mixer**
- Live per-channel meters plus a **Master** strip, all fed by inline analysers.
- Effects renamed in beginner language: Space, Echo, Repeats, Punch (with tooltips
  explaining the technical meaning).

**New features**
- **Undo / redo** across every edit (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), 80 steps deep.
- **Projects**: New, Save to a downloadable `.aura` file, Open a `.aura` file, named
  project, unsaved-changes dot and a browser warning before you lose work.
- **Metronome** toggle (M) with accented downbeat.
- **Keyboard shortcuts**: Space play, R record, M metronome, 1–4 switch view,
  [ / ] previous / next section, Cmd/Ctrl+S save, Cmd/Ctrl+Z undo.
- **Confirmation** before Clear section and Clear melody.

**Accessibility & responsive**
- Every control has an accessible name; the sequencer exposes grid roles; song bars are
  keyboard-operable; visible focus rings; `prefers-reduced-motion` honoured.
- Below 1280px the Browser and Inspector become slide-over panels; below 1181px the
  transport sliders relocate into the Inspector; below 768px targets grow for touch.

**Fixes**
- Live reverb was roughly 12 dB quieter than the exported WAV (two stale v9 lines scaled
  the reverb return after v10 moved the wet amount into the sends). Live now matches export.
- The piano-roll playhead no longer freezes at the last step after Stop.
- Meters reset to zero on stop instead of holding their last level.

State format v11 (adds `sn` section names). v8, v9 and v10 links and autosaves still load.

## v10 — 2026-07-23

**Mixer + core effects** — balance the track without leaving the page.

- New **🎚 Mixer** panel (toolbar button) with 7 channels: Kick, Snare (+Clap),
  Hats (+Perc), Bass, Chords, Melody and Vocals.
- Each channel has a **volume fader, pan, 3-band EQ (low / mid / high), a Reverb send,
  a Delay send, Mute and Solo**. Sends are post-fader, so muting or soloing a channel
  takes its reverb and delay with it — solo is real isolation.
- New global effects row: **Reverb size** (0.6–3.2 s decay), **Delay time** (60–700 ms),
  **Delay feedback**, and **Compression** (drives the existing glue compressor).
- Every control is neutral at its default, so opening the mixer changes nothing until
  you move something. **Reset mixer** returns everything to flat.
- The whole mixer applies to live playback *and* the exported WAV, and the export now
  leaves room for the reverb and delay tails instead of cutting them off.
- A muted or un-soloed Kick no longer sidechain-ducks the bass.
- State format v10 (adds `mx`, `fx`). Older links and autosaves still load.

## v9 — 2026-07-23

**Piano roll (the big one)** — Aura can now make original melodies, not just beats to sing over.

- New **🎹 Melody** panel: a real piano roll spanning C3–B5, quantized to the same 16-step
  grid as the drums, with its own melody per section.
- Draw notes by clicking, drag to move, drag the right edge to change length, click a note
  to delete it, right-click to cycle velocity (soft / normal / loud).
- **Stay in key** (on by default): every note snaps to the current scale, so nothing you
  draw can sound wrong. Uncheck it for chromatic freedom.
- Rows are shaded by scale — the key's root is gold, in-scale notes are lit, and the
  shading follows the key/mode live.
- 6 melody voices: Lead, Pluck, Keys, Pad, Bell, and 808 Bass.
- Melody follows the music: changing the key transposes every note, and changing the mode
  folds notes back into the new scale.
- Melody has its own mixer channel (volume, mute, reverb send) and renders into the
  exported WAV alongside drums, chords, bass and vocals.
- Each of the 12 vibes now sets a fitting default melody sound.
- State format v9 (adds `mel`, `ms`, `mlv`). Older share links and autosaves still load.

## v8.1 — 2026-07-23

**Kanye study pack** — built from a verified deep study of Kanye West's production
(five eras, 43 fact-checked claims); the full reference lives in KANYE-CODEX.md.

- New scale: **Harmonic Minor (gospel)** — the raised leading tone makes V a true
  dominant, so the Soul (Rhodes) voice's auto-7ths produce a real V7 pull
  (the Ultralight Beam chord physics). III is voiced major per gospel practice.
- New vibes:
  - **Soul · Chipmunk** — E♭ minor, 88 BPM, boom-bap, Rhodes 7ths, MPC-58% swing
    (the College Dropout pocket: era-median BPM, era home key).
  - **808 · Heartbreak** — C♯ minor, 120 BPM, four-on-the-floor 808 pulse with the
    backbeat deleted, i–iv piano vamp (the Love Lockdown template; the sidechained
    808 bass carries the chord roots).
  - **Gospel · Sunday** — C harmonic minor, 74 BPM, near-silent drums (kick + one clap),
    i–III–VI–V7, heavy reverb, swing 33 to approximate the 12/8 lean.
- New beat presets: **Heartbeat (no snare)** and **Gospel pulse (near-silent)**.
- New progressions (vibe-driven): i–iv lockdown vamp, i–III–VI–V7 gospel,
  i–♭VII–♭VI–♭VII soul flip.

## v8 — 2026-07-19

**Groove engine**
- Breathing sub-bass: every kick now sidechain-ducks the bass bus (~5 dB, fast recovery),
  so the low end pumps around the kick — the promise on the tin is now in the code.
- Auto-fill: in Song arrangements, the last bar before any section change automatically
  clears the tops and plays a rising 3-hit snare build capped with an open hat; exports also
  get an ending fill on the final bar. Loop-mode playback and pattern-only exports are never
  touched, and a muted snare disables the build entirely (the pattern plays as programmed).
  Toggle in the toolbar; on by default.

**Arrangement**
- Sections: 4 → 6. Song grid: 16 → 32 bars. Enough for intro / verse / pre / chorus / bridge.
- Playback and export now stop at the last used bar — empty trailing slots no longer add
  silence to the loop or the WAV (this also fixes the pre-existing silent tail after the
  default 8-bar seed).
- Old share links and autosaves load unchanged (state format v8, backward compatible).

**Vocals**
- New vocal channel on playback and export: 80 Hz high-pass + gentle 3:1 compression,
  so takes sit level and forward of the instrumental's presence scoop.
- Vocal volume slider now works live while a take is playing.

**Vibes**
- Urbano · Polished — clean, tight, radio-bright (J Balvin lane): F minor, 95 BPM,
  reggaetón-pop beat, nylon pluck.
- Atmosphérico — washed pads, dark and spacious (Feid lane): G# minor, 88 BPM,
  moody reggaetón beat, heavy reverb.
- Renamed the Persian lane: Zedbazi · Persian → Tehrán · Noir (vibes are named for the
  sound, not the artist).

**Copy / meta**
- Outcome-first tagline ("Tap a vibe → sing → export … under 60 seconds"), meta description,
  version badge.

## v6–v7

- Initial public release: 16-step sequencer, 7 vibes, 4 sections, 16-bar song mode,
  vocal recording with count-in and sync nudge, offline WAV export with peak-normalize
  safety, mix bus (presence scoop, glue compressor, air shelf, limiter, synthesized reverb),
  localStorage autosave, shareable URL state.
