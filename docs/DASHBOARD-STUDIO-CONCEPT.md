# Aura Studio — Studio Dashboard concept (target)

**Status:** Accepted target for Studio mode (2026-09-23).  
**Mockup:** `docs/mockups/studio-dashboard-target.png`  
**Mode split:** Dense dashboard = Studio. Guided mode retained with fewer visible choices.

## North star

The whole song is the main workspace. Arrangement, energy curve, selected sound, and mixer stay in view together. Coordinated selection is mandatory: select a track/clip → highlight arrangement lane + mixer channel + right-rail sound controls. Shared playhead crosses energy, arrangement, and recording lanes.

## Layout (from mockup)

| Region | Contents |
|---|---|
| Header | Project name, "Saved on this device", undo/redo, transport, BPM/key/meter/position/loop, Guided\|Studio, Export |
| Left | Searchable sounds + feeling filters (Grounded / Radiant / Dreamlike), featured presets w/ audition, Project intention, Import / Record |
| Center top | Sections on continuous timeline; Target vs Measured energy lane; track lanes (Drums, Bass, Keys, Atmosphere, Melody, Voice, Texture) with MIDI/audio clips |
| Center bottom | Tabs: Mixer, Piano roll, Lyrics, Vocal coach, Perform |
| Right | Section energy (Intensity / Warmth / Movement / Space) + Preserve Voice/Melody; selected-track sound params; Aura guidance Preview/Apply/one-step undo; Architect / Transitions / Finish |

## Concept vs current (summary)

1. **Song-as-workspace** — Replace task-tab isolation (Beat/Melody/Song/Vocals/Balance/Sound) with persistent arrangement + contextual editors.
2. **Composable energy** — Drawable Target curve distinct from Measured analysis. Mappings (proposed, not verified): Intensity→density/accents/layers/dynamics; Warmth→timbre/filter/sat; Movement→variation/modulation/pattern activity; Space→reverb/delay/stereo/gaps. Never "louder = higher energy" alone. Preview before commit; preserve locks for voice/melody.
3. **Faster sound explore** — Search + vibe filters; audition with song; drag to track; replace vs new layer; preserve notes unless new part requested.
4. **Direct arrangement edit** — Drag/resize/loop/split/duplicate clips; mute/solo; MIDI + audio edit; automation. Connect existing melody note tools to per-clip editors. Independent audio clips / flexible tracks / continuous automation need separate verification.
5. **Recording in the composition** — Takes appear on Voice lane aligned to backing; count-in and timing adjust stay. Comping / punch-in are extensions.
6. **Immediate mixer** — Compact mixer under arrangement; dB + real meters; track select syncs channel; Mix Check highlights control. Drums group must expand to kick/snare/hat.
7. **Assistance at the moment** — Guidance beside selected section: highlight bars, explain, preview, compare, one reversible apply. Rules-based OK; LLM not required for useful guidance.
8. **Clearer project chrome** — Saved scope must say device vs cloud. Editable 4/4 only if playback/editing support other meters.
9. **Homes for existing strengths** — Intention/notes, Lyrics/breath/Vocal Coach, Architect/transitions, Perform/pads/MIDI, Mix Check, Rights & Sources, Guided sequence, explicit imported-vs-reconstructed (not stems).
10. **Mockup refinements before build** — Align energy graph to same time grid as clips; collapsible energy lane; label control scope (project/section/track/clip); keep Guided; labels+shapes not color alone; no universal emotion formulas.

## Build sequence (locked)

| Phase | Goal | Done when |
|---|---|---|
| **0 — Unify shell** | One Studio layout wiring existing tools into header/left/center/right without new DSP | Shared selection + shared playhead; tabs become lower editors; Guided still works |
| **1 — Selection & playback** | Click track/clip coordinates arrangement, mixer, right rail; playhead syncs energy+lanes | Warm-keys example works end-to-end |
| **2 — Energy automation** | Drawable Target vs Measured; section sliders write the curve; preserve locks; preview/apply | Curve edits change proposed mappings with undo |
| **3 — Richer clips** | Drag/resize/split/loop + piano-roll-on-clip + audio trim/fade | Arrangement edits without leaving song view |

Later: flexible tracks, continuous automation, take comping, expandable drum groups with live meters.

## Non-goals / honesty

- Mockup waveforms ≠ stem separation. Keep current "reconstructed parts ≠ separated stems" language.
- Feeling filters are creative directions, not fixed formulas.
- Do not claim FL-competitive depth without evidence on quality, timing, reliability, editing, export.

## Source

Philip Grey brief + mockup, 2026-09-23 (via Ray). Live /rc/ at publish time was 13.7.0-rc.4.
