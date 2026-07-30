# Physical-device sign-off checklist

**For `13.2.0-rc.1`. Nothing on this page has been run.** There is no iPhone, iPad, Android device or
Safari installation available to this work, so every row below is **open**, not passing.

The standing statement for the one thing that *was* exercised, to be used verbatim and not softened:

> Scroll-versus-note arbitration passed under simulated pointer events. Native browser panning,
> momentum scrolling and physical-touch behaviour remain unverified pending real-device testing.

Everything else here is untested rather than partially tested. A row is only ticked by someone
holding the hardware.

---

## How to run it

```bash
python3 serve.py
```

Then reach `http://<your-mac-lan-ip>:8791/` from the device — note that `serve.py` binds `127.0.0.1`
by design, so for device testing you will need to serve it another way deliberately, and should stop
doing so afterwards. Alternatively open the built artefact from a local file share.

Record for each row: device, OS version, browser version, pass/fail, and what you actually observed.
"Seems fine" is not a result.

---

## iPhone Safari

| # | Check | Result |
|---|---|---|
| 1 | App mounts, no blank screen, no console error | ☐ |
| 2 | Play starts audio after the first tap (autoplay unlock) | ☐ |
| 3 | Microphone permission prompt appears and is honoured | ☐ |
| 4 | Recording captures audio, and the take plays back | ☐ |
| 5 | Recorded take is in the exported WAV, aligned | ☐ |
| 6 | Audio import (WAV / MP3 / M4A) decodes | ☐ |
| 7 | Video import (MP4 / MOV) — audio read, or the exact refusal message shown | ☐ |
| 8 | Reference plays, pauses, and its level control works | ☐ |
| 9 | Analysis can be cancelled by removing the reference mid-run | ☐ |
| 10 | Approximate vocal balance runs without freezing the tab | ☐ |
| 11 | Sampler: record → find slices → tap pads → build a section | ☐ |
| 12 | Physical note dragging in the piano roll | ☐ |
| 13 | Grid panning with one finger, without dropping notes | ☐ |
| 14 | Momentum scrolling in long panels | ☐ |
| 15 | Sampler actions scroll clear of the bottom navigation | ☐ |
| 16 | Save, close the tab, reopen from Recents | ☐ |
| 17 | WAV export downloads and opens | ☐ |
| 18 | MIDI export downloads and opens | ☐ |
| 19 | Add to Home Screen — icon, name, standalone launch | ☐ |
| 20 | Landscape orientation, including a notched device's safe areas | ☐ |
| 21 | VoiceOver: every control reachable and announced | ☐ |
| 22 | Ringer-silent switch does not silence playback unexpectedly | ☐ |
| 23 | An incoming call interrupts and the app recovers | ☐ |

## iPad Safari

| # | Check | Result |
|---|---|---|
| 24 | Studio layout at 834×1194 portrait | ☐ |
| 25 | Studio layout at 1024×768 landscape | ☐ |
| 26 | Split View and Slide Over do not break the shell | ☐ |
| 27 | Apple Pencil note drawing | ☐ |
| 28 | External keyboard shortcuts | ☐ |
| 29 | VoiceOver | ☐ |

## Android Chrome

| # | Check | Result |
|---|---|---|
| 30 | App mounts, no console error | ☐ |
| 31 | Microphone permission and recording | ☐ |
| 32 | Audio import decodes | ☐ |
| 33 | Video import — audio read, or the exact refusal shown | ☐ |
| 34 | **OGG decode** — untested anywhere so far, see below | ☐ |
| 35 | Physical note dragging | ☐ |
| 36 | Grid panning and momentum scrolling | ☐ |
| 37 | Save and reopen | ☐ |
| 38 | WAV export | ☐ |
| 39 | MIDI export | ☐ |
| 40 | Install to home screen | ☐ |
| 41 | Landscape orientation | ☐ |
| 42 | TalkBack: every control reachable and announced | ☐ |
| 43 | Back-gesture does not destroy unsaved work without warning | ☐ |

## Desktop Safari

| # | Check | Result |
|---|---|---|
| 44 | App mounts; Web Audio graph builds | ☐ |
| 45 | Import decode matrix — Safari's decoders differ from Chrome's | ☐ |
| 46 | **OGG decode** | ☐ |
| 47 | Export renders through `OfflineAudioContext` without truncation | ☐ |
| 48 | `@container` queries in the Vibes column (used by the tile layout) | ☐ |
| 49 | Responsive sweep at the desktop widths | ☐ |

---

## Known gap carried in from the automated runs

**OGG is not covered by the media decode matrix and is not claimed to be.** The matrix records it as
*not generated* rather than passing: the browser used for that run cannot record OGG, and no encoder
on the build machine can write one. Chrome and Firefox both decode OGG, so this is a fixture gap
rather than a known failure — but it is untested, and rows 34 and 46 are where it gets settled.

---

## What automated testing already covers, so you need not repeat it

- 17 viewports from 320×568 to 1920×1080, including a landscape phone: **zero findings**.
- 14 media fixtures through the real import path: 13 as specified, OGG not generatable.
- 13 cancellation and failure-injection paths: project byte-identical in every one.
- 14 vocal-balance mixes, measured.
- 38 end-to-end checks including export privacy.
- 19 reconstruction fixtures: timing F 0.9091, lane recall 0.8649, 0 confident mislabels.

All of that ran in one Chromium build. **None of it is evidence about Safari, iOS or Android**, which
is what this page exists to settle.
