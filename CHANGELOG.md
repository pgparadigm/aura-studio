# Changelog

## v8.1 — 2026-07-23

**Kanye study pack** — built from a verified deep study of Kanye West's production
(five eras, 43 fact-checked claims); the full reference lives in KANYE-CODEX.md.

- New scale: **Harmonic Minor (gospel)** — the raised leading tone makes V a true
  dominant, so the Soul (Rhodes) voice's auto-7ths produce a real V7 pull
  (the Ultralight Beam chord physics). III is voiced major per gospel practice.
- New vibes:
  - **Soul · Chipmunk** — E♭ minor, 88 BPM, boom-bap, Rhodes 7ths, MPC-58% swing
    (the College Dropout pocket: era-median BPM, era home key).
  - **808 · Heartbreak** — C♯ minor, 120 BPM, four-on-the-floor 808 pulse with the
    backbeat deleted, i–iv piano vamp (the Love Lockdown template; the sidechained
    808 bass carries the chord roots).
  - **Gospel · Sunday** — C harmonic minor, 74 BPM, near-silent drums (kick + one clap),
    i–III–VI–V7, heavy reverb, swing 33 to approximate the 12/8 lean.
- New beat presets: **Heartbeat (no snare)** and **Gospel pulse (near-silent)**.
- New progressions (vibe-driven): i–iv lockdown vamp, i–III–VI–V7 gospel,
  i–♭VII–♭VI–♭VII soul flip.

## v8 — 2026-07-19

**Groove engine**
- Breathing sub-bass: every kick now sidechain-ducks the bass bus (~5 dB, fast recovery),
  so the low end pumps around the kick — the promise on the tin is now in the code.
- Auto-fill: in Song arrangements, the last bar before any section change automatically
  clears the tops and plays a rising 3-hit snare build capped with an open hat; exports also
  get an ending fill on the final bar. Loop-mode playback and pattern-only exports are never
  touched, and a muted snare disables the build entirely (the pattern plays as programmed).
  Toggle in the toolbar; on by default.

**Arrangement**
- Sections: 4 → 6. Song grid: 16 → 32 bars. Enough for intro / verse / pre / chorus / bridge.
- Playback and export now stop at the last used bar — empty trailing slots no longer add
  silence to the loop or the WAV (this also fixes the pre-existing silent tail after the
  default 8-bar seed).
- Old share links and autosaves load unchanged (state format v8, backward compatible).

**Vocals**
- New vocal channel on playback and export: 80 Hz high-pass + gentle 3:1 compression,
  so takes sit level and forward of the instrumental's presence scoop.
- Vocal volume slider now works live while a take is playing.

**Vibes**
- Urbano · Polished — clean, tight, radio-bright (J Balvin lane): F minor, 95 BPM,
  reggaetón-pop beat, nylon pluck.
- Atmosphérico — washed pads, dark and spacious (Feid lane): G# minor, 88 BPM,
  moody reggaetón beat, heavy reverb.
- Renamed the Persian lane: Zedbazi · Persian → Tehrán · Noir (vibes are named for the
  sound, not the artist).

**Copy / meta**
- Outcome-first tagline ("Tap a vibe → sing → export … under 60 seconds"), meta description,
  version badge.

## v6–v7

- Initial public release: 16-step sequencer, 7 vibes, 4 sections, 16-bar song mode,
  vocal recording with count-in and sync nudge, offline WAV export with peak-normalize
  safety, mix bus (presence scoop, glue compressor, air shelf, limiter, synthesized reverb),
  localStorage autosave, shareable URL state.
