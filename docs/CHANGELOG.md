# Changelog — Aura Studio `/rc/`

The `/rc/` build only (`https://pgparadigm.github.io/aura-studio/rc/`). The root build stays 13.6.0-rc.3. Every
release here passed the full regression in Chromium and WebKit from a frozen copy, with the export and saved state
matching f304607. Plan: `docs/superpowers/plans/2026-10-25-aura-north-star.md`.

## Unreleased (branch `wt/open-items`, not published) — the core path

- **Your song at the desk:** after Import audio in Studio, the editor opens **Your song** with the song's card (play,
  Include it in my track) and Rebuild with Aura (tempo, Apply the key and chords, the beat). Before, both lived in
  Guided's song room, which Studio hides, so an import left nothing on screen to match Aura to the song. A Your song
  tab is there while a song is imported.
- **Preserve is real:** with Melody on (the default), Architect's room for vocals and the Transitions leave the melody
  alone; off, they change it as before. Voice is a badge: no Aura change reaches the voice.
- **Start with a vibe** gives the vibe tiles the whole Sounds column (they had a strip as short as 36 px at 1280x800);
  the column's close or Escape brings Sounds back.
- **Clear melody** on a section with no melody says so instead of doing nothing.
- **Project-file schema** restored into `docs/` and brought up to schema 5.
- Checks: every visible Studio control pressed once and none does nothing (`n6NoDeadControls`, 131 controls); the
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
