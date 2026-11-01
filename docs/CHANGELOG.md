# Changelog — Aura Studio `/rc/`

The `/rc/` build only (`https://pgparadigm.github.io/aura-studio/rc/`). The root build stays 13.6.0-rc.3. Every
release here passed the full regression in Chromium and WebKit from a frozen copy, with the export and saved state
matching f304607. Plan: `docs/superpowers/plans/2026-10-25-aura-north-star.md`.

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
