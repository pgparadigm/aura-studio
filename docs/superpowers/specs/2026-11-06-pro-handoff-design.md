# rc.17: the pro hand-off (design)

Philip, 2026-11-06: "build the pro hand-off before more aura trap-beat work: lossless recording, dry takes in the
export, and comping." His answer to the first design question: **"Option 1 only: the comped take, dry. One file per
vocal track, from bar 1, 24-bit at the song rate, no processing. Drop it into FL or Pro Tools and it lines up."**
Then: "Build the design for rc.17 exactly as scoped: lossless recording first, then dry takes in the export, then
comping. Gate it, publish only when the live site carries it and the checks pass."

Classified **architectural**: a new capture path, a stored-format change (schema 6) and new export files. One gated
release, built in his order. File-based FL → Aura → FL / Pro Tools only; no live sync.

## What exists (rc.16, read from `rc/app.js` at e17f315)

- Capture: `startRecording` → `MediaRecorder(micStream, pickMime())`: Opus in Chromium, AAC in Safari. Stop → Blob →
  `acceptRecording(blob, musicZeroTime - recStartTime, target)` → `decodeAudioData` → `voxMono` → the take. Lossy.
- The microphone is opened raw (`echoCancellation`, `noiseSuppression`, `autoGainControl` off, one channel) and
  `micSource = ac.createMediaStreamSource(micStream)` already feeds the meter and the monitor.
- Storage: every take is written as a **16-bit** PCM WAV to IndexedDB and, base64, into `.aura`
  (`media.vocalTakes[].wav`), by `takeWavBytes` (page and worker). `SCHEMA_VERSION = 5`.
- A track is one buffer and a clip list `{id, from, to, at, gain, fadeIn, fadeOut, rate?, env?}`. A punch-in appends
  the new recording to the buffer (`voxAppend`) and lays a clip over the stretch it covers (`takePunchOut`, 10 ms of
  the old audio left under each edge, crossfaded by `takeCrossfades`). The old audio stays in the buffer, unused.
- Save everything (`exportCompleteProject`): `project.aura`, `master.wav` (16-bit), `stem-*.wav` (32-bit float,
  each channel after its own processing, before the master) and `take-*.wav`: each track's **whole buffer**, 16-bit,
  every punch pass end to end. Not laid out on the song, so not a hand-off.

## Measured before designing (throwaway page, both engines, 2026-11-06)

1. A source started between two samples is **interpolated** in an OfflineAudioContext (Chromium 153 and WebKit 26.6
   alike): at a quarter-sample offset the output differs from the recording by up to 0.49 of full scale, at a half
   sample it is the average of neighbours. The scheduler places clips at arbitrary seconds, so a render of a take is
   never its recorded samples. The dry files must place every part on a whole sample.
2. A gated tone through a page-made microphone (MediaStreamDestination → MediaStreamSource):
   - an AudioWorklet capture off the source sees it **21.6 ms late** (Chromium) and **47.1 ms late** (WebKit),
     timed by the worklet's own frame counter;
   - MediaRecorder, timed as today (`recStartTime = ac.currentTime` at `start()`), places it 1.9 ms early (Chromium)
     and **56.6 ms early** (WebKit).
   The two paths disagree by 23 ms and 104 ms. Which one is right for a real singer is the real-device timing pass
   (still not done). So the lossless take must not move the timing: it is placed where today's take is placed.

## 1. Lossless recording

**Capture.** When the microphone opens, an AudioWorklet (`aura-capture`, built from a function's own source into a
`blob:` URL, as the meter worklet is: no network request) hangs off `micSource`. It records nothing until Record:
then every render quantum's input frames are kept as Float32 (a quantum with no input channels is kept as silence,
so the timeline never slips), posted to the page in blocks of 4096 frames with the frame number of the first.
MediaRecorder still runs alongside, unchanged.

**Placement (the timing reference).** On Stop both are finished. The recorder's take is decoded as today, giving
today's `head`. The uncompressed capture is aligned to it by cross-correlation: the loudest second of the decoded
take, matched first coarsely (both decimated by 8, lags ±250 ms around the lag the two clocks predict), then to the
sample (±16 samples at full rate). The lossless buffer becomes the take with `head' = head + lag / sampleRate`, so it
sits exactly where the recorder's take sits today. Accepted when the normalised correlation is ≥ 0.6.

**Fallbacks, each said on screen.**
- The worklet cannot load (no AudioWorklet, or it fails): the take is the recorder's, as today; the take line says
  "compressed: this browser could not record uncompressed".
- No reliable correlation on a take with sound in it: the recorder's take is kept (timing proven over audio quality)
  and the line says so.
- A take with nothing in it (below −60 dBFS throughout): the lossless capture is used at the lag the two clocks
  predict; its timing cannot be heard.

**What a take is now.** Mono (as before, `voxMono`), Float32 at the context's rate, from the microphone raw. Imported
vocal files keep their path (`decodeAudioData`).

## 2. Stored at 24-bit (schema 6)

- `takeWavBytes` (page and worker) writes **24-bit PCM**. `takeFromWavBytes` reads 16-bit and 24-bit PCM and 32-bit
  float, so every take stored by rc.12 to rc.16 still opens, on the device and in `.aura` files.
- `SCHEMA_VERSION = 6`; a file carrying takes declares `schemaVersion: max(6, …)`. rc.16 and older refuse it with
  their own "saved by a newer version of Aura" message instead of dropping takes they cannot read. The `note`, the
  schema JSON and `AURA_PROJECT_SCHEMA.md` say 24-bit and name schema 6.
- Size: 1.5× rc.16 (8.6 MB per minute of take at 48 kHz on the device; base64 in `.aura`).

## 3. Passes and comping

**Passes.** Each track keeps `take.passes`: `{id, from, to, at, src}`, one per recording, in order: `from`/`to` are
seconds in the track's buffer, `at` is where buffer second `from` was sung on the timeline, `src` is `mic`
(uncompressed), `rec` (the browser's recorder) or `file` (an imported vocal). The first take is pass 1; every
punch-in appends one. Passes are kept with the clips: in the take history (so ↶ of a punch-in removes its pass and
↷ brings it back), on the device, in `.aura` (`media.vocalTakes[].passes`) and through `withTrack`. A take stored
before rc.17 gets pass 1 only where its clips still sit where they were sung (every clip's `at − from` equal, rate 1);
otherwise none, and its old audio offers no choice (safe, never wrong).

**Choosing a take for a part.** A part (clip) belongs to the pass holding its `from`; the moment it was sung is
`s = pass.at + (from − pass.from)`. Another pass is offered when it covers `[s, s + (to − from)]`. Choosing it moves
the clip's `from`/`to` to that pass's audio of the same sung stretch and keeps everything else: where it sits,
length, gain, tape rate, fades, envelope. Where a neighbouring part touches it (within 1 ms), the join gets the
punch-in crossfade: the part is extended 10 ms (`PUNCH_XF`) into the neighbour, from the chosen pass's own audio when
the pass has it, and `takeCrossfades` fades the two across it. One undo step. While playing, the change is heard at
once (the takes are rescheduled from the playhead); stopped, it is heard on Play.

**Where.** The Studio dashboard's clip bar, desktop and phone: a selected vocal part with two or more takes offered
shows "Takes" and one button per take ("1", "2", "3", …), the one playing pressed; the clip's name line says
"Take 2 of 3". Comping to a finer grain is Split here (already there), then a take per part. The Guided take room is
unchanged.

## 4. Dry takes in Save everything

- One file per vocal track with a take: `dry-lead-vocal.wav`, `dry-double-vocal.wav`, `dry-harmony-vocal.wav`.
- **What is in it:** the track's parts exactly as edited (the chosen takes, clip gain, fades, crossfades, envelopes,
  tape rates). **Nothing else:** no channel volume, vocal level, EQ, compression, sends, reverb, delay or master.
- **Placed:** from bar 1 (sample 0 is musical zero, as in `master.wav` and the stems), with the export's own vocal
  shift (`LAT()` and Sync), every part on a whole sample (measurement 1), so a part at gain 1 with no fade is the
  recorded samples.
- **Length:** the song's length as the master and stems have it (the same `dur`), so all the files end together.
- **Format:** 24-bit PCM WAV, mono, at the rate the track was recorded at (the song's rate in Aura: the context's,
  48 kHz on a Mac or an iPhone). No resampling.
- Rendered by the same scheduler as playback and the export (`scheduleTakeClips`, with whole-sample placement),
  into an OfflineAudioContext with no processing, one track at a time.
- `take-*.wav` is **no longer written** ("Option 1 only"): it was every pass end to end, which does not line up. The
  recording itself, every pass, stays inside `project.aura`. The README's STEMS section says what the dry files are.
- The one-tap Export is unchanged.

## Not in this release

The sound recorder (`sndRecorder`, a sampler sound, not a vocal take) stays on MediaRecorder. No zip: Save everything
still writes separate files (on an iPhone that is a download per file; not walked here). The real-device timing pass,
a real voice into a real microphone and listening remain Philip's, as before.

## Verification (each check red first, both engines unless a microphone is needed)

- **h1 lossless:** a known noise signal through the page-made microphone; the stored take equals the source within
  one 24-bit step at the matched lag (the recorder's take misses by orders of magnitude). Red on rc.16.
- **h2 placement unchanged:** a gated burst; the lossless take's onset on the timeline equals the recorder take's
  within one sample.
- **h3 24-bit kept:** content below the 16-bit floor survives the device store and a reload, and a `.aura` round trip;
  a 16-bit take from rc.16 opens; schema 6 is declared and validates.
- **h4 passes:** recorded, kept, undone and redone with their punch-ins, reopened from `.aura`.
- **h5 comp:** three passes of three tones; a part switched to each plays that tone at the right place; the join is
  crossfaded (no step); one ↶ restores; heard while playing.
- **h6 picker:** 1920, 1440, 390 and 360: on screen, whole, ≥ 36 px targets, no overlap, the pressed one right.
- **h7 dry files:** names, 24-bit, rate, length equal to the master's in seconds, sample-exact against the take for an
  unedited part, unchanged by heavy channel EQ/compression/reverb, the comped content from h5, onset within 1 ms of the
  lead stem.
- **h8 the loop with the FL reference beat:** FL's render in, Lead, two punch-ins, a comp, Double, a harmony file,
  the master export (as rc.16 measured it) and Save everything (dry files line up with the master), 1440 and 390.
- Existing checks whose expectation this release changes on purpose (`e12Stems`, `e12LongSetup/Check`: take files and
  sizes) are updated to the new behaviour, red first.
- Mutants for each new rule; the full suite gated against f304607; the live checks after publishing.

**What these checks cannot reach:** a real microphone (every recording check uses a page-made one), Safari's real
recorder timing on a phone, iPhone download behaviour for many files, and listening.
