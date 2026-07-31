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

- **15 one-tap vibes** (Reggaetón Moody/Classic, Latin Pop, R&B Chill, Soul Chopped,
  808 Midnight, Soul Chipmunk, 808 Pulse, Gospel Sunday, Tehrán Noir, Urbano Polished,
  Atmosphérico, Drill Noir, Houston Melodic, R&B Silk) — each locks key, chords, beat, tempo, swing and sounds in one tap.
- **Six sonic families** (Soul Blueprint, Stadium Ascension, Maximal Opus, Living Draft,
  Confessional Minimal, Future Monolith) — complete systems rather than presets: a tempo, a key,
  a chord vocabulary, a drum behaviour, a bass behaviour and **five named controls of their own**.
  Every one of those thirty controls writes real project data, so a move saves, exports and undoes
  as one step. See [STYLE-REFERENCES.md](STYLE-REFERENCES.md).
- **Piano roll** — draw melodies, leads and basslines on a C3–B5 grid, one per section.
  Click to draw, drag to move, drag the edge for length, right-click for velocity.
  **Stay in key** snaps every note to your scale, and melodies transpose with the key.
  6 voices (lead, pluck, keys, pad, bell, 808 bass), its own mixer channel, in the export.
- **Import & remix your own audio** — drop a WAV/MP3/M4A into the Sample tab. Aura detects
  tempo and key, syncs it tape-style, and proposes an editable **remix plan** (half-time it,
  match the key, cut the low end for the 808, load a boom-bap kit, duck it under the kick).
  Your audio stays on your device.
- **Three named import paths** — when you bring a recording in, you choose what happens to it:
  **Analyze only** (Aura tells you what it hears and writes nothing — it renders no Apply button
  at all), **Rebuild with Aura** (an editable reconstruction you approve part by part), or
  **Adjust the original** (keep the recording, change how it sits). You also decide the tempo —
  detected, keep yours, half, double, or type one — *before* anything is applied.
- **An original low-end part** — Aura works out where the recording's low end holds notes, then
  writes **its own** bass line following the detected harmony, rhythm and section energy, in
  Aura's own bass sound. Every generated note is a chip you can tap to drop. It is not the
  original bassline and Aura says so.
- **Versions** — apply any reconstruction as a **new version** instead of over your work. Switch
  between them, promote one to main, rename or delete. Each version stores only the parts it
  actually changes, so it is a small block in your project rather than a second copy of it.
- **Perform** — a live surface for playing your arrangement: transport, section launch, mutes,
  the blend between your recording and Aura, section energy, sampler pads, undo/redo. Hit record
  and it captures what you did as a take you can listen to before deciding to keep it. Kept moves
  become part of the song and land in the export.
- **DJ / MIDI controller support** — connect any Web MIDI controller and map it to those same 22
  actions with **MIDI Learn**. Generic first, with no vendor hard-coding. Mappings live in your
  browser, never in your project file, and nothing about the hardware is stored or sent.
- **Ask Aura** — a guide that reads your actual project and takes you to the control you want.
  It is a fixed set of answers about controls Aura really has, **not** a generative AI model, and
  it says so rather than inventing something. Anything that would change your project is
  previewed and confirmed first, and lands as one undo step. Conversations are not saved.
- **Guided Mode** — a Welcome panel and a 6-step rail for anyone who has never produced before,
  with a Guided/Studio switch that keeps all your work.
- **MIDI export** — melody and chords as a type-1 MIDI file for any other DAW.
- **Studio shell** — fixed transport with a **Project** menu (Save · Save As… · Open · New),
  Browser of vibe tiles, five workspace tabs (**Beat · Melody · Arrange · Vocals · Mix**),
  Inspector and a docked mixer that expands or takes the whole workspace in MIX.
- **Built for phones too** — below 768px the transport becomes a compact top bar
  (emblem · project name · Play · Record · **More**) with a five-item bottom navigation
  (Beat · Melody · Arrange · Vocals · **Export**). Everything else — New, Open, Save,
  Save As, Recent, Mix, Browser, Inspector, Guided/Studio, tempo, swing, master volume,
  metronome, undo/redo, copy link, MIDI export and help — lives one tap away in the More
  sheet. 44px touch targets throughout; the sequencer scrolls inside its own panel so the
  page never scrolls sideways.
- **Undo / redo**, named projects saved to a portable `.aura` file (Save, or Save As a
  distinct copy), metronome, keyboard shortcuts (Space, R, M, 1–4, [ / ], Cmd+S,
  Shift+Cmd+S, Cmd+Z).
- **Nameable sections** — Intro, Verse, Chorus… shown on every bar of the playlist.
- **Mixer** — nine strips: eight channels (kick, snare+clap, hats+perc, bass, chords, melody,
  vocals, sample) plus **Master**, with live meters,
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

Three static files — `index.html`, `styles.css`, `app.js` (cache-busted `?v=13`).
Zero dependencies, zero build step, no server. All sounds are synthesized live with the
Web Audio API; export renders through an `OfflineAudioContext`.

Run it locally by opening `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8791
```

## Where the sounds come from

Aura's sonic families came out of a research programme into how a small number of very different
records were actually made. What crossed over is **technique** — where the weight sits in a bar, how
a section opens, what gets taken away, how a chord bed makes room for a voice.

What did not cross over, and never will, is any recording, melody, arrangement, lyric, sample, name,
likeness or association. **No artist, album or song name appears anywhere a user can see it**, and
none appears in the shipped `app.js`, `index.html` or `styles.css` either. Aura generates every sound
it plays from oscillators and noise; it ships no sample content whatsoever.

The translation from technique to system is documented in
[STYLE-REFERENCES.md](STYLE-REFERENCES.md). The underlying study is an internal engineering
document under `research/`, and is not part of the product.

## Project files & sharing

`.aura` project files use schema v2 (independent of app version): readable field names,
a project id, created/updated timestamps, and separate `capabilities` (what Aura supports,
as an object) and `content` (what's actually in this project) blocks, plus an `encoding`
block that documents the compact nested arrays. A `mediaPersistence` block states the format's
standing guarantee that recorded audio is never embedded. Every field, index, tuple position,
channel order, range and the bitmask rule are specified in
[AURA_PROJECT_SCHEMA.md](AURA_PROJECT_SCHEMA.md); the machine-checkable contract is
[aura-project.schema.json](aura-project.schema.json), exercised by the fixtures in
[fixtures/](fixtures/) — run `python3 fixtures/validate.py`, or open `fixtures/test.html`.
Use the **Project** menu in the transport for Save, **Save As…**, Open and New. **Save** keeps a
project's identity and only moves `updatedAt`; **Save As** (Shift+Cmd+S) mints a fresh id and
`createdAt` for a distinct copy. **Vocal takes and imported audio are never stored** in a
project file or a share link — they stay on your device.

Supported browsers: current Chrome, Edge, Safari and Firefox (desktop and mobile).
Recording needs microphone permission on a secure (https) page.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Import a song and rebuild it

Drop an audio or video file into the Vibes panel. Aura decodes it on your device, finds the tempo and
key, and works out an **editable reconstruction** — the drums, the parts of the song, the chords, and
optionally a melody line. Every result carries its own confidence, nothing is written into your track
until you press its Apply, and Discard leaves your project exactly as it was.

Your recording stays on your device. It is never uploaded, never put in a share link, never written
into a `.aura` file, and it is **muted on arrival** so your exported WAV contains Aura's parts only
until you choose to include it.

Aura creates an editable reconstruction from what it can hear. Review and adjust the result. It does
not separate stems, remove vocals, or recover the original session — a stereo mix does not contain
that information.

Test suites (serve the repo root with `python3 -m http.server 8791`):

- `/fixtures/import-qa.html` — the reconstruction engine against 19 generated fixtures
- `/fixtures/apply-safety.html` — Replace / Fill Empty / undo / Discard against the real runtime
