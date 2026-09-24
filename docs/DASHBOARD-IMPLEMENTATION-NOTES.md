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
- Intensity / Warmth / Movement / Space write per-section params; Intensity also paints the Target across the selected section’s bars.
- Preserve Voice / Melody locks; Preview (best-effort live) / Apply (checkpointed) / One-step undo.
- Apply mappings (best-effort, **not** master-volume-only): Space→`reverbWet` + sends; Warmth→chords EQ + soul/pad lean; Movement→delay sends / hat motion; Intensity→snare/hat levels + Target curve.

### Phase 3 — Clips
- MIDI section clips: drag to move (empty destination), trailing-edge resize via existing `songResize`, double-click opens Piano roll tab while arrangement stays.
- Mute/Solo on lane headers drive `mix[]` mute/solo.
- Atmosphere / Voice lanes show content when import / take exists (reconstructed-vs-imported language unchanged).

## Gaps / stubs

| Area | Status |
|---|---|
| Full DSP energy→density/accents/layers automation | Partial — uses mixer/EQ/sends/style; does not rewrite drum patterns on Apply yet |
| Continuous per-bar automation lanes | Not started (later phase) |
| Independent flexible tracks beyond GROUPS | Lanes are a view onto existing groups |
| Clip split / loop gestures | Resize + move only; split still via song tools / bar grid |
| Audio clip trim/fade in arrangement | Voice editing remains in take room; not duplicated on the lane |
| Expandable drum group (kick/snare/hat meters) | Lane is grouped; mixer still has separate strips |
| Feeling filters | Directional UI filter on featured presets — not fixed formulas |
| Stem separation | Not implied — Sample lane = imported reference; Aura parts = reconstructed |

## Honesty
Mockup waveforms are illustrative. Imported audio is a reference layer; Aura parts are reconstructions, not separated stems.
