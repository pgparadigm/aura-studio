# Aura Studio — north-star target (spec)

Recorded 2026-10-25 from Philip's messages of that day. The roadmap that builds it is
`docs/superpowers/plans/2026-10-25-aura-north-star.md`. Nothing here is built yet.

## 1. What is the target

**The second spec Philip pasted on 2026-10-25 (section 3 below) plus the picture is the target. The first spec
he pasted is a bug list only (section 5).** All work is in `rc/` (served at `/rc/`). The root
`index.html`/`app.js`/`styles.css` (13.6.0-rc.3) are never touched.

**The picture** is `docs/mockups/studio-dashboard-target.png` (1586×992, SHA-256 prefix `a5102e6ab9e45b04`, in the
repo since `26ee008`). The picture Philip attached on 2026-10-25 shows the same design: compared by eye, every
label and value visible in both matches (project "Evening Resonance", 92 BPM, E minor, 4/4, 13.1, CHORUS • BARS
17–24, Intensity 68 / Warmth 72 / Movement 40 / Space 56, Soft Rhodes, 3.2 kHz / −12 dB / −16 dB, "Give the chorus
more lift"). Not compared pixel by pixel; if the attached file differs, it replaces this one.

## 2. Philip's decisions, 2026-10-25 (verbatim)

> 1. Write one staged plan that merges it with the existing ten-stage plan, all inside /rc/, under the same release
>    rules. Never touch the root 13.6.0-rc.3 files. Nothing gets built until I approve the plan.
> 2. Early stages are the real bugs: the Create dialog trap, undo depth on load, overflow at 1280 and 390 wide,
>    contrast and aria labels, Ask Aura covering the dock toggle, and the piano roll's width.
> 3. Stage 3: the picture's right panel is my answer. Warmth joins Intensity, Movement and Space in the section
>    card, and Preserve becomes Voice and Melody chips. Room and Echo leave the section card but stay as Reverb send
>    and Delay send on the selected track card. Drop "Apply to whole song" from the panel, and offer it through Aura
>    guidance's Apply instead.
> 4. Keep the three voice lanes (Lead, Double, Harmony). In the arrangement they can collapse under one Voice group
>    that expands.
> 5. Font: use the system stack only, no font server. The network rule stands.
> 6. First run: no blocking dialog. Returning users open their last project. First-time users get the demo project
>    and a dismissible tour.
> 7. Audio: don't add the limiter now. Keep f304607 as the reference. List the near-clipping peak in the plan as a
>    separate decision for me.
> 8. Scope: put the playlist, automation clips, MIDI files and synth UI in a later phase, after the north-star layout
>    ships.

## 3. The target spec (verbatim, as pasted)

> North-star redesign: make Aura Studio match the attached mockup (one-screen DAW, plum/violet dark theme) while
> staying beginner-easy. Build on the P0/P1 work already done; keep autosave, undo, .aura migration, export, and the
> existing Guided/Studio toggle.
>
> LAYOUT (desktop 1440x900, single screen, no page scroll)
> 1. Top bar: logo, editable project name with dropdown, "Saved on this device" status, undo/redo, centered transport
>    (stop, play, record), BPM field, key/scale picker (e.g. E minor), time signature (4/4), bar.beat position, Loop
>    toggle; right side Guided | Studio segmented toggle and a primary Export button.
> 2. Left "Sounds" panel: search box, three mood filter chips (Grounded, Radiant, Dreamlike), featured preset cards
>    each with thumbnail, name, tags, mini waveform, and a play preview button; a "Project intention" card (editable
>    text, e.g. "Intimate verses. An expansive release. Keep: vocal + main melody"); Import audio and Record sound
>    buttons at the bottom.
> 3. Center "Arrangement": bar ruler with snap dropdown and zoom slider plus Fit; colored section strip (Intro, Verse,
>    Build, Chorus, Resolve) that is draggable and resizable; an "Energy" lane showing a target curve (editable
>    breakpoints) vs a dotted measured curve; tracks (Drums, Bass, Warm keys, Atmosphere, Melody, Voice, Texture),
>    each with a colored icon, name, M, S, record-arm, and lock; clips colored per track showing MIDI note previews or
>    audio waveforms; drag, resize, Ctrl-drag copy, delete; a playhead that follows playback.
> 4. Bottom dock tabs: Mixer | Piano roll | Lyrics | Vocal coach | Perform, plus Mix check and Sources buttons. Mixer
>    shows one strip per track plus Master, each with an icon, name, dB readout, stereo LED meters, a fader, a pan
>    knob with L/R, and M/S; the selected track's strip is highlighted.
> 5. Right inspector, context-aware:
>    a. Section card ("CHORUS • BARS 17–24" with prev/next): "Shape the energy" sliders for Intensity, Warmth,
>       Movement, Space (0–100 with values) and Preserve chips (Voice, Melody) that lock those tracks from AI changes.
>    b. Selected track card: instrument preset dropdown, then Filter cutoff, Reverb send, Delay send sliders with units.
>    c. "Aura guidance" card: one plain-language suggestion (e.g. "Give the chorus more lift. Add atmosphere. Open the
>       keys. Keep your voice untouched.") with Preview (A/B audition) and Apply buttons, plus One-step undo.
>    d. Song tools list: Architect, Transitions, Finish.
>
> EASE OF USE
> - First run opens straight into this view with a demo project loaded (no blocking modal); a dismissible 4-step
>   coach-mark tour (Sounds, Arrangement, Mixer, Aura guidance).
> - Every control has a tooltip in plain words; no jargon without explanation.
> - Clicking a section selects it and updates the inspector; clicking a track updates the track card and highlights
>   its mixer strip.
> - Drag a preset card onto a track or empty lane to create/replace the sound.
> - Energy sliders and Aura Apply change the arrangement audibly and are each one undo step; Preview never commits.
> - Guided mode = same screen with the dock collapsed and only Sounds, sections, Energy, and Aura guidance active;
>   Studio = everything.
>
> VISUAL SPEC
> - Background #120d1a to #1a1324, panels #1e1729 with 1px #2e2440 borders, 10px radius, accent violet #8b5cf6,
>   track colors: drums orange, bass teal, keys violet, atmosphere blue, melody gold, voice pink, texture purple.
> - Inter or similar, 12–13px UI text, 11px meta at >=4.5:1 contrast; compact 36px track rows; subtle glow on the
>   selected clip and active section.
>
> RESPONSIVE
> - 1280x800: the inspector collapses to a slide-over; the Sounds panel to an icon rail.
> - <=480px: tabs for Sounds / Arrange / Mix / Aura, one panel at a time, a horizontally scrolling arrangement with a
>   sticky track column, and the transport fixed at the bottom.
>
> ACCEPTANCE
> - Playwright screenshot at 1440x900 visually matches the mockup layout (save qa/screens/northstar.png).
> - No console errors, no horizontal overflow at any breakpoint, all interactions undoable, export includes every
>   mixer, energy, and inspector change.
> - Commit per section with a CHANGELOG entry. Do not change the deploy target.

**Corrections to the pasted text, by Philip's decisions:** "Inter or similar" → the system font stack (decision 5).
"Build on the P0/P1 work already done": none of the first spec was built before 2026-10-25; its P0 bugs are the
first stages of the plan and its P1/P2 features are a later phase (decision 8). "Voice" is a group of three lanes
(decision 4).

## 4. Constraints carried from earlier decisions (still in force)

- Release rules: test-first; the full regression in Chromium and WebKit with zero failures; the export graph and the
  saved state match f304607; the default export stays within f304607's own run-to-run spread; publish to `/rc/`
  only; verify the live bytes; revert and stop on any failure; update the handoff after each push.
- Network rule: Aura makes no network request except the exact URL the singer pastes, at the moment they press Load.
- Takes: three vocal tracks (Lead, Double, Harmony); new takes are mono; old stereo takes open and play.
- Option (d): the right panel is a drawer below 1400 px wide and a column from 1400.

## 5. The bug list (the first spec's P0 items, verbatim, for reference only)

> 1. Create dialog: Esc, backdrop click and the X close it; focus is trapped while it is open and restored after; it
>    does not auto-open if an autosave/project exists (show "Continue last project" instead). AC: fresh load + Esc
>    leaves every toolbar button clickable.
> 2. Undo stack must be 0 on a fresh load (startup/restore must not push history). AC: __auraSuite.undoDepth()===0
>    after load; toggling one step then Ctrl+Z reverts exactly that step; Ctrl+Shift+Z / Ctrl+Y redo it.
> 3. Export: reachable and working at every breakpoint (toolbar on desktop/laptop, Export tab on mobile). Add a
>    brickwall limiter on master with a -1 dBFS ceiling in both the live and offline graphs. AC: download fires at all
>    three viewports; exported WAV peak <= -1 dBFS.
> 4. "Ask Aura" FAB must not overlap the mixer dock toggle (move it above the dock or into the toolbar). AC: no
>    element-intersection between them at any viewport.
> 5. Layout: step grid never clips rows (auto height, or a visible scrollbar); piano roll grid fills 100% of the
>    panel width and scales with bars/zoom; remove the empty left gutter in Guided desktop; the "backing track is
>    ready" banner + alert card collapse to a one-line strip outside the Guided overview so editors sit above the
>    fold at 800px height.
> 6. Mobile (<=480px): step sequencer shows 8 steps per page with a 1–8/9–16 pager, or horizontal scroll with a
>    sticky channel-name column; the per-row volume slider moves into a long-press/channel menu; the rail and section
>    bar scroll horizontally with fade edges; no element extends past the viewport (document.scrollWidth ===
>    innerWidth).
> 7. Accessibility: aria-label on every icon-only button (#pathVibe, #importPick, metronome, undo, redo, more); a
>    visible label/value on all three toolbar sliders (BPM, Swing, Master); touch targets >=40px on mobile and >=32px
>    on desktop; all text >=4.5:1 contrast (fix the ▶ glyphs on preset cards, hint and grey meta text, tab labels);
>    visible :focus-visible rings; hover and active states on every control.

Item 3's limiter is decision 7 (not now). The audit of rc.16 against these items is in the plan, section 2.

## 6. Later phase (decision 8, and the first spec's other features)

Not scheduled; each needs its own spec when its turn comes, after the north-star layout ships: patterns + playlist
timeline (Song mode plays it), automation clips rendered in export, MIDI file import (MIDI export already exists),
synth channel UI; and, from the first spec, tap tempo, 3/4 and 6/8, zipped stems, a shortcut overlay, channel-rack
upgrades (per-step velocity, add/remove channel, sampler drop, 16/32/64 steps), piano-roll editing extras, Web MIDI
record, and the optional Studio density theme.
