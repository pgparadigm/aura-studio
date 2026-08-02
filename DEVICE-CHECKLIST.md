# Physical-device sign-off checklist

**For `13.4.0-rc.1`. Nothing on this page has been run.** There is no iPhone, iPad, Android device or
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

## v13.3 — new physical gates, none of them ever run

These cover features added in 13.3. Every one is **OPEN**.

| # | Check | Result |
|---|---|---|
| 50 | A real MIDI controller is offered, connects, and reports its name | ☐ |
| 51 | The browser's MIDI permission prompt appears and is honoured | ☐ |
| 52 | MIDI Learn binds a real knob, and the bound control then moves | ☐ |
| 53 | A real pad triggers a sampler slice with no audible lag | ☐ |
| 54 | Unplugging the controller mid-performance does not break the transport | ☐ |
| 55 | Mappings survive a reload, and survive it on a second controller | ☐ |
| 56 | Perform view is usable one-handed on a phone (44px targets, no mis-hits) | ☐ |
| 57 | Recording a take on a phone captures the moves at the right times | ☐ |
| 58 | Kept moves are audible in a WAV exported on the device | ☐ |
| 59 | Ask Aura opens, traps focus, and closes back to the button on iOS Safari | ☐ |
| 60 | Ask Aura's sheet does not sit under the iOS keyboard when typing | ☐ |
| 61 | **VoiceOver (iOS)** — every new control announces a usable name | ☐ |
| 62 | **VoiceOver (iOS)** — the Guide conversation is announced as it updates | ☐ |
| 63 | **VoiceOver (iOS)** — the destructive confirmation reads as a confirmation | ☐ |
| 64 | **VoiceOver (macOS)** — reading order through Perform and Versions is sane | ☐ |
| 65 | **TalkBack (Android)** — same three checks as 61–63 | ☐ |
| 66 | Reduced Motion actually suppresses animation on the device | ☐ |
| 67 | A `.aura` file saved on desktop opens on the phone with versions intact | ☐ |
| 68 | A schema-3 file is refused by the live 13.2.0-rc.1 with the stated message | ☐ |
| 69 | Two exports of one unchanged project are byte-identical on the device | ☐ |
| 70 | Find a sound: each family audibly differs through the device's own speaker | ☐ |
| 71 | Find a sound: the audition note is not clipped or silent on iOS after the first tap | ☐ |
| 72 | Find a sound: the twelve family tiles reflow without a sideways page scroll | ☐ |
| 73 | Create something: the sheet opens at its title, scrolls internally, and closes to the opener | ☐ |
| 74 | Create something: all four chip rows are reachable one-handed at 375×667 | ☐ |
| 75 | **VoiceOver (iOS)** — a chosen chip announces as chosen, not by colour alone | ☐ |
| 76 | **VoiceOver (iOS)** — a saved sound announces as saved | ☐ |
| 77 | New Project on the device leaves no lyrics, intention or saved sound behind | ☐ |

**No screen reader has been run against this build on any platform.** The 36 automated
accessibility checks in `fixtures/a11y-qa.html` verify structure — names, roles, live regions, focus
behaviour, contrast. They cannot verify what a screen reader *says*, in what order, or whether it
makes sense. Rows 61–65 are the only thing that settles that, and they are open.

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
- 10 low-end fixtures and 19 Path B lifecycle checks.
- 22 virtual-MIDI checks — the message parsing and the action layer, with no hardware present.
- 29 performance-recording checks and 55 Aura Guide checks.
- 43 persistence checks, including sixteen malformed-project cases.
- 36 automated accessibility checks — **structure only, never a screen reader**.

All of that ran in one Chromium build. **None of it is evidence about Safari, iOS or Android**, which
is what this page exists to settle.
