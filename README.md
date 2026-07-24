# Aura Studio

**Tap a vibe → sing → export a real track. Under 60 seconds, free, offline, no account.**

Live app: **https://pgparadigm.github.io/aura-studio/**

Aura Studio is a browser-based backing-track studio for singers. It generates authentic
reggaetón, hip-hop, R&B and Latin instrumentals you can sing over, records your voice
with a count-in, and exports everything as one mixed WAV.

## Why it sounds right

The groove engine is built on genre rules, not random loops:

- **Kick on the floor** — four-on-the-floor kick (steps 1, 5, 9, 13), the reggaetón foundation.
- **Dembow snare** — snare on the 3-3-2 tresillo accents, the bounce that makes it move.
- **Breathing sub-bass** — every kick sidechain-ducks the bass bus, so the low end pumps
  around the kick instead of masking it.
- **Chords locked to key** — every progression is diatonic to your chosen key and mode.
  Nothing you tap can sound wrong.
- **Groove velocity** — downbeat emphasis, kick/snare-coupled hat accents, and deterministic
  micro-variation so patterns never sound robotic.
- **A real mix bus** — presence scoop for vocal space, glue compression, air shelf,
  brickwall limiter, and a synthesized stereo reverb.

## Features

- **15 one-tap vibes** (Reggaetón Moody/Classic, Latin Pop, R&B Chill, Kanye Soul/808s,
  Soul Chipmunk, 808 Heartbreak, Gospel Sunday, Tehrán Noir, Urbano Polished,
  Atmosphérico, Drill Noir, Houston Melodic, R&B Silk) — each locks key, chords, beat, tempo, swing and sounds in one tap.
- **Piano roll** — draw melodies, leads and basslines on a C3–B5 grid, one per section.
  Click to draw, drag to move, drag the edge for length, right-click for velocity.
  **Stay in key** snaps every note to your scale, and melodies transpose with the key.
  6 voices (lead, pluck, keys, pad, bell, 808 bass), its own mixer channel, in the export.
- **Import & remix your own audio** — drop a WAV/MP3/M4A into the Sample tab. Aura detects
  tempo and key, syncs it tape-style, and proposes an editable **remix plan** (half-time it,
  match the key, cut the low end for the 808, load a boom-bap kit, duck it under the kick).
  Your audio stays on your device.
- **Guided Mode** — a Welcome panel and a 6-step rail for anyone who has never produced before,
  with a Guided/Studio switch that keeps all your work.
- **MIDI export** — melody and chords as a type-1 MIDI file for any other DAW.
- **Studio shell** — fixed transport, Browser of vibe tiles, tabbed workspace
  (Channel Rack · Piano Roll · Playlist · Vocals), Inspector and a docked mixer.
- **Undo / redo**, named projects saved to a portable `.aura` file, metronome,
  keyboard shortcuts (Space, R, M, 1–4, [ / ], Cmd+S, Cmd+Z).
- **Nameable sections** — Intro, Verse, Chorus… shown on every bar of the playlist.
- **Mixer** — 8 channels incl. Master (kick, snare+clap, hats+perc, bass, chords, melody, vocals) with live meters,
  volume, pan, 3-band EQ, reverb and delay sends, mute and solo, plus global reverb size,
  delay time/feedback and compression. Post-fader sends, and it applies to the export too.
- **16-step sequencer** with 6 sections, per-hit accents (right-click), per-track volume
  and mutes.
- **Song mode** — arrange sections across 32 bars; **Auto-fill** drops a snare build into
  the last bar before every section change.
- **Vocal recording** — count-in, input meter, monitor toggle, sync nudge, and a dedicated
  vocal channel (high-pass + compression) so your voice sits on top of the mix.
- **Export WAV** — offline-rendered, peak-safe, vocals included.
- **Offline-first** — no server, no account. Auto-saves in your browser; **Copy link**
  serializes the whole song into a shareable URL.

## Tech

One `index.html`. Zero dependencies, zero build step. All sounds are synthesized live
with the Web Audio API; export renders through an `OfflineAudioContext`.

Run it locally by opening `index.html` in any modern browser.

## Production references

The Kanye-derived vibes (Soul Chipmunk, 808 Heartbreak, Gospel Sunday) are built from
a verified study of Kanye West's production across all five eras — see
[KANYE-CODEX.md](KANYE-CODEX.md) for the craft laws, BPM/key data sheet, and the
ranked build list driving the roadmap.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
