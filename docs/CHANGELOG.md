# Changelog — Aura Studio `/rc/`

The `/rc/` build only (`https://pgparadigm.github.io/aura-studio/rc/`). The root build stays 13.6.0-rc.3. Every
release here passed the full regression in Chromium and WebKit from a frozen copy, with the export and saved state
matching f304607. Plan: `docs/superpowers/plans/2026-10-25-aura-north-star.md`.

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
  the export itself was not at fault), and a new check holds that through a forced collection.

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
