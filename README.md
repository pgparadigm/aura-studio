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

- **12 one-tap vibes** (Reggaetón Moody/Classic, Latin Pop, R&B Chill, Kanye Soul/808s,
  Soul Chipmunk, 808 Heartbreak, Gospel Sunday, Tehrán Noir, Urbano Polished,
  Atmosphérico) — each locks key, chords, beat, tempo, swing and sounds in one tap.
- **Piano roll** — draw melodies, leads and basslines on a C3–B5 grid, one per section.
  Click to draw, drag to move, drag the edge for length, right-click for velocity.
  **Stay in key** snaps every note to your scale, and melodies transpose with the key.
  6 voices (lead, pluck, keys, pad, bell, 808 bass), its own mixer channel, in the export.
- **Mixer** — 7 channels (kick, snare+clap, hats+perc, bass, chords, melody, vocals) with
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
