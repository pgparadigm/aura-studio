# Studio dashboard, sub-project A: make it sound

Date: 2026-09-24 · Build base: `main` 67822a6 (dashboard Phases 0–3 reapplied at 26ee008, plus the
layout fix) · Owner: the "Aura Studio" Claude session (Philip's choice, 2026-09-24)

## Why A comes first

The dashboard is live on `/rc/`, but it was built without review and its own notes list stubs. Before
adding anything (sub-projects B–E), what is there must work at every width, keep what the singer
does, and undo honestly. A adds no new music features.

## Decisions Philip made

1. **Mid widths (768–1399 px): buttons plus slide-over.** The arrangement stays full width. A
   **Sounds** and a **Shape** button in the arrangement header slide each panel over it. Picking a
   lane or clip also opens Shape. From 1120 px Sounds keeps its column, so its button hides there.
   From 1400 px both panels are columns and both buttons hide.
2. **The drawn energy curve is saved with the project and carried in share links**, like tempo and
   key. Older projects open with the curve seeded from what Aura measures, as today.

## Defects found while reading the code (all fixed in A)

| # | Defect | Where |
|---|---|---|
| D1 | 768–1119 px: nothing visible opens Sounds; its toggle is in the tab bar the dashboard hides | layout |
| D2 | 1120–1399 px: Shape opens only from a lane click; no button | layout |
| D3 | The drawn curve and the per-section Intensity/Warmth/Movement/Space live only in memory and are lost on reload | `dash.energyTarget`, `dash.energyParams` |
| D4 | Preview writes the reverb and the chords channel straight into project state with no snapshot, so any autosave during a preview keeps the previewed values | `applyEnergyToSection(true)` |
| D5 | "One-step undo" is a second undo system. It restores five channels, reverb and the curve, but not the chord-style change Apply can make or the voice reverb, and the app's normal Undo does not know about it | `dash.energyUndo`, `undoEnergy()` |
| D6 | Drawing on the energy lane stores a plain array in `dash.energyUndo`; One-step undo then says "Reverted" and reverts nothing | `dashEnergyPointer()` |

## Design

### A1. Panels at mid widths (D1, D2)

- Add a slim bar at the top of `#studioArr` holding two buttons, **Sounds** and **Shape**, each with
  `aria-expanded` and `aria-controls`. Sounds shows at 768–1119 px, Shape at 768–1399 px.
- Sounds toggles `#browser.open`; Shape toggles Customize through the existing `setInspect()`, so the
  one open/closed state and its storage are reused, not duplicated.
- The panels slide over the arrangement as they already do at these widths. Shape keeps the ✕ added
  in 67822a6; Sounds gets the same ✕ at 768–1119 px. Escape closes whichever overlay is open.
- Lane and clip selection keep opening Shape (`selectDashTrack`), unchanged.
- Phones (≤767 px) are untouched: classic shell, as fixed in 67822a6.

### A2. Energy saved with the project (D3)

- New optional compact key **`en`** in `serialize()`:
  `en: { t:[32 integers 0–100], p:{ "<section>":[intensity,warmth,movement,space] } }`.
  It is written **only when the singer has drawn or applied energy**; a project that never touched
  energy writes no `en` and is byte-identical in meaning to today. A flag `dash.energyTouched` marks it.
- `READ_MAP` gains `en:'energy'` so a saved `.aura` file keeps it on the round trip (the file's own
  comment records the bug this prevents: an unmapped key is written and silently dropped on read).
- `requiredSchema()` counts `en`, so a file carrying a drawn curve declares schema 3 and an older
  reader refuses it instead of opening it and dropping the curve.
- `applyState()` reads `en`: sets the curve and section values and `energyTouched`; without `en` it
  clears both so the curve is re-seeded from measurement, as today.
- Share links carry the compact state, so they carry `en` with no extra work.
- Because undo snapshots are `serialize()`, drawing and applying energy become undoable with the
  app's normal Undo for free.
- `INTERNAL_STATE_VERSION` stays 13: the key is additive and optional, like `lo`, `gv` and `pi`.

### A3. One undo system and an honest preview (D4, D5, D6)

- **Remove `dash.energyUndo` and `undoEnergy()`'s partial restore.** Apply already runs inside
  `oneCheckpoint()`, which takes one normal history entry. "One-step undo" becomes the app's
  `undo()`, enabled only while the newest history entry is that Apply (Aura records the history
  length at Apply and compares). After any other edit the button disables itself with the title
  "Use Undo (Cmd+Z) now". This fixes D5 and D6 together.
- A drawn stroke on the energy lane autosaves once on pointer-up (already `autosaveSoon`), so one
  stroke is one Undo.
- **Preview never touches saved state.** Preview snapshots the fields it changes (reverb and the
  chords channel today), applies them live, and restores them on: Apply (which then writes for
  real inside the checkpoint), Stop, pressing Preview again, or selecting another section. While
  previewing, `serialize()` writes the snapshot values rather than the live
  ones, so an autosave mid-preview cannot capture them.

### A4. Check every claim the dashboard makes

Drive the dashboard at 1440×900 and 1280×800 in the built-in browser against the claims in
`docs/DASHBOARD-IMPLEMENTATION-NOTES.md`: lanes and clips derived from the song, clip drag, resize
and Alt-split, mute and solo, selection sync (lane, mixer channel, rail), shared playhead, featured
presets, feel filters, sound search, lower editor tabs (Mixer, Piano roll, Lyrics, Vocal coach,
Perform), Energy Preview/Apply/Undo, the Preserve locks, header Key/Meter/Pos/Loop, "Saved on this
device". Record pass or fail per claim. Fix a failure in A only if it is a layout, save or undo
defect; everything else is logged for B–E with the evidence.

## Out of scope for A

Energy that changes density and accents (C), audio clip trim and fade, loops and automation (D),
drum group expansion and dB meters (E), completing selection sync (B). Guided mode is unchanged.

## Verification

No test files ship in this repo (the fixtures its comments name are absent), so each check is a
scripted run in the built-in browser against a local copy, RED on the current build first, then
GREEN:

- **A1:** at 1024×768 and 1280×800, the Sounds and Shape buttons are visible and 44 px, each opens its
  panel on screen with a working ✕, Escape closes it, no sideways scroll; at 1440 both buttons are
  hidden; at 375 nothing changes (page 375 px, classic tabs).
- **A2:** draw a curve and set section values, reload: they come back. Save a `.aura` file through
  the save path and reopen it: they come back. Build a share link, clear this origin's storage and open the link:
  they come back. A project with no energy edits serialises with no `en` key. `requiredSchema` is 3
  with `en` and unchanged without it.
- **A3:** Apply then One-step undo restores the full prior state, compared as `serialize()` JSON before
  and after. Apply, another edit, then One-step undo is disabled. Draw a stroke, then Cmd+Z reverts
  exactly that stroke. Start Preview, trigger an autosave with another control, Stop: the saved
  project has the pre-preview reverb and chords values.
- **A4:** the pass/fail table above, with measurements.
- Network law: `fetch(` stays 1 in `rc/app.js`, inside `loadSampleUrl`.

**What these checks do not establish:** real touch on tablets (clicks are emulated), Safari, how
anything sounds, and whether an older Aura build refuses a schema-3 file in practice (only the code
path is read, not an old build run).

## Release

`APP_VERSION` 13.8.0-rc.2 → 13.8.0-rc.3. One commit on `wt/rc-fixes`, pushed to `main`, verified live
on `/rc/` by SHA-256 at 375, 1024, 1280 and 1440. Root stays 13.6.0-rc.3.
