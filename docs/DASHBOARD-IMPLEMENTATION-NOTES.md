# Studio Dashboard — implementation notes (rc 13.8.0-rc.1)

Phases 0–3 landed in the **rc-fixes** worktree `rc/` against Philip’s accepted mockup (`docs/mockups/studio-dashboard-target.png`) and `DASHBOARD-STUDIO-CONCEPT.md`.

## What works

### Phase 0 — Unify shell
- Studio mode (`body:not(.guided)`) shows: Sounds left rail, Arrangement center (sections + energy + track lanes), lower editor tabs (Mixer / Piano roll / Lyrics / Vocal coach / Perform), right Shape rail.
- Guided mode keeps the existing step rail + Beat/Melody/Song/Vocals flow; dashboard hosts stay hidden.
- Header gains “Saved on this device”, key/meter/pos meta, Loop toggle (Loop = pattern mode; off = song arrangement).
- `APP_VERSION` / cache-bust → `13.8.0-rc.1`.

### Phase 1 — Selection & playhead
- Selecting a lane or clip highlights the arrangement lane, matching mixer strip(s) (`data-dash-sel`), and right-rail track controls.
- Warm keys featured preset selects the Keys lane + Soft Rhodes (`chordStyle=soul`) and syncs mixer Chords strip.
- Shared playhead (`#saPlayhead`) updates from the existing `paintPlayhead` hook across energy + lanes.

### Phase 2 — Energy
- Drawable **Target** curve on `#saEnergyCanvas` vs **Measured** (from `sectionMetrics().energy`).
- Shape this section: Intensity / Movement / Space are saved per section. Intensity is read on the section's own range (everything removable gone, to every groove hit added) and paints that Target across the section's bars; the rail shows "Target · Measured" on the same 0–100 range.
- Apply (13.8.0-rc.5) changes only that section's drums, accents and bass, from Aura's own groove engine, until Measured is within 0.03 of Target, and reports what it added and removed. Never a level, never the melody or voice, never the downbeat kick or the backbeat snares. One checkpoint, One-step undo. Preview plays the new notes without writing them.
- Whole song ("These change every section, not just this one"): Warmth→chords EQ + soul/pad lean; Room→Reverb slider + chords reverb send, and the Voice / Melody sends only with their locks off; Echo→chords and hats delay sends. Never a level.

### Phase 3 — Clips
- MIDI section clips: drag to move (empty destination), trailing-edge resize via existing `songResize`, double-click opens Piano roll tab while arrangement stays.
- Mute/Solo on lane headers drive `mix[]` mute/solo.
- Atmosphere / Voice lanes show content when import / take exists (reconstructed-vs-imported language unchanged).

## Gaps / stubs

| Area | Status |
|---|---|
| Full DSP energy→density/accents/layers automation | Section Apply rewrites drums, accents and bass to meet the Target (13.8.0-rc.5); per-bar variation and per-section tone need automation (D) |
| Continuous per-bar automation lanes | Not started (later phase) |
| Independent flexible tracks beyond GROUPS | Lanes are a view onto existing groups |
| Clip split / loop gestures | Resize + move only; split still via song tools / bar grid |
| Audio clip trim/fade in arrangement | Voice editing remains in take room; not duplicated on the lane |
| Expandable drum group (kick/snare/hat meters) | Lane is grouped; mixer still has separate strips |
| Feeling filters | Directional UI filter on featured presets — not fixed formulas |
| Stem separation | Not implied — Sample lane = imported reference; Aura parts = reconstructed |

## Honesty
Mockup waveforms are illustrative. Imported audio is a reference layer; Aura parts are reconstructions, not separated stems.
