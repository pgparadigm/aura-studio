# Aura Studio — browser test report

Release: **v13.0.3** (tag `v13.0.3`)
Acceptance baseline: v13.0.2 — commit `c37547ec518bc4de04bed6f82562890210b22da8`
Engine: Chromium (Claude Browser pane) + Google Chrome
Server: `python3 -m http.server` over the repo root
Date: 2026-07-24

**Authoritative release commit.** A tracked file cannot contain the SHA of the commit that
contains it, so the exact SHA is written to `aura-studio-v13-manifest.txt`, which is generated
*after* the release commit is made and tagged. Verify the three agree with:

```bash
git rev-parse HEAD
git rev-list -n 1 v13.0.3
grep '^commit:' aura-studio-v13-manifest.txt
git status --short          # must print nothing
```

---

## 1. Transport overflow — responsive action hierarchy

The single `max-width:1119px` breakpoint was replaced with a **measured** hierarchy driven by
`ResizeObserver`, re-run on `resize`, `visibilitychange`, `load` and `document.fonts.ready`.
It applies steps in order and stops the instant `scrollWidth <= clientWidth`:

1. **Compact** — Tempo / Master volume / Swing drop their labels and narrow their ranges.
2. **Overflow menu (⋯)** — actions move out, lowest priority first:
   Help → Recent projects → Export MIDI → Copy link → Mixer → **Export WAV** (last).
3. **Sliders to menu** — the three sliders move into ⋯ as live rows, so tempo/volume/swing
   stay reachable. (Previously a separate 1181px rule relocated them into the Inspector; the
   two mechanisms competed for the same elements, so the measured hierarchy now owns them.)

**Always visible at every tested width:** Play, Record, Loop/Song, project name, Project menu.

### Assertion: `transport.scrollWidth <= transport.clientWidth`

| Viewport | scrollWidth | clientWidth | Assert | Compact | Export | In ⋯ menu | Sliders in ⋯ |
|---|---|---|---|---|---|---|---|
| 1180 × 800 | 1146 | 1146 | ✅ | yes | 1 click | 6 | 3 |
| 1280 × 800 | 1246 | 1246 | ✅ | yes | 1 click | 6 | 3 |
| 1366 × 768 | 1332 | 1332 | ✅ | yes | 1 click | 6 | 0 |
| 1440 × 900 | 1406 | 1406 | ✅ | yes | 1 click | 6 | 0 |
| 1536 × 864 | 1502 | 1502 | ✅ | yes | **in toolbar** | 4 | 0 |
| 1920 × 1080 | 1886 | 1886 | ✅ | no | **in toolbar** | 0 | 0 |

- **No element rendered outside the viewport** at any size (every visible control's
  `getBoundingClientRect().right <= innerWidth`; measured set was empty at all six).
- **No horizontal toolbar scrolling** — the toolbar never becomes scrollable; content is
  reduced until it fits.
- **Export is never more than one menu click away**, and is a direct row in ⋯ (not nested).

Reference measurements at 1280 (clientWidth 1246), showing why each step is needed:

```
expanded      1768      hide Copy link  1485
compact       1676      hide Mixer      1407
hide Help     1676*     hide Export WAV 1293
hide Recent   1630      sliders → ⋯     1246  ✅ fits
hide MIDI     1584
* unchanged because the ⋯ button appears at this step (+46px, −46px)
```

## 2. Activation — pointer and keyboard

| Control | Pointer | Keyboard | Notes |
|---|---|---|---|
| Project menu | ✅ real click opens | ✅ focusable, `role="menu"`, Esc closes | `aria-haspopup`, `aria-expanded` toggle |
| ⋯ More actions | ✅ real click opens | ✅ focusable, arrow keys cycle rows | menu renders fully on-screen |
| Export WAV | ✅ real click on the ⋯ row activated the real `#export` button | ✅ reachable via arrow keys | activation recorded via a capture listener so a full WAV render was not triggered |
| Copy link | ✅ | ✅ | activation recorded rather than run, to avoid overwriting the clipboard |
| Mixer | ✅ | ✅ | runs for real |

Menu rows initially exposed **empty accessible names**; fixed by adding explicit `aria-label`
to every row in both menus. Verified afterwards in Chrome's accessibility tree:
`menuitem "Save"`, and `Help & shortcuts / Recent projects / Export MIDI / Copy link / Mixer /
Export WAV`.

Keyboard shortcuts are unchanged and unaffected — they call functions directly, and moving a
button between the toolbar and the menu preserves its listeners:
Space, R, M, 1–4, `[` / `]`, Cmd+S (Save), **Shift+Cmd+S (Save As)**, Cmd+Z / Shift+Cmd+Z.

## 3. `.aura` export and identity

`RT-schema-final.aura` — **regenerated from the final v13.0.3 build**, through the app's real
Save path (Project menu → Save → project-name dialog), replacing the earlier export that was
produced from `51900bf` and carried `appVersion "13.0.0"`.

5187 bytes · `sha256 76847b3d8daabc660d747a0838d103adcdbc8dc2ea8eda8a98e7cf1448ec4bdc`

Verified against the **bytes on disk**, not an in-memory object:

```
schemaVersion 2 · appVersion "13.0.3" · capabilities boolean object
all 8 symmetrical content flags · mediaPersistence · encoding · encoding.schemaRef
project.internalStateVersion 13 · no project.stateVersion
projectId 6b2c9b1f-5649-4994-b2bc-e804c0948919 (UUID v4)
```

Both validators pass on the file read back from disk:

| Validator | Result |
|---|---|
| `fixtures/validate.py` (headless) | PASS |
| `fixtures/schema-validate.js` (browser) | PASS, 0 errors |

Identity rules, exercised through the dialog:

| Check | Result |
|---|---|
| Save preserves `projectId` | ✅ |
| Save preserves `createdAt` | ✅ |
| Save advances `updatedAt` | ✅ |
| Save As mints a new `projectId` | ✅ `4212a43f-fd92-4290-80af-b6d5f165c50d` |
| Save As mints a new `createdAt` | ✅ |

## 4. Manual release checks — STILL OUTSTANDING

None of the following can be driven from this environment. They are **not verified** and
remain open until someone runs them on real hardware.

| Check | Status |
|---|---|
| Safari (desktop) — full pass | ☐ not run |
| iPhone / iOS Safari — layout, touch, download | ☐ not run |
| Android / Chrome — layout, touch, download | ☐ not run |
| Native download lands in Downloads with `.aura` | ☐ not run |
| OS file-chooser round trip via *Open Project…* | ☐ not run |
| Real-touch: long-press accents, drag, pinch | ☐ not run (simulated `TouchEvent`s pass) |

Notes on why:

- The **OS file-chooser** opened by *Open Project…* is browser chrome and cannot be automated.
- **Safari/iOS/Android** — no drivable instance is available from this environment.
- **Touch** is simulated with synthetic `TouchEvent`s, which exercise the handlers but not real
  finger input, hit slop or momentum scrolling.
- Since v13.0.3 the project name is collected by an **in-page dialog**, not `window.prompt`, so
  saving no longer depends on a native dialog. The download itself is ordinary browser
  behaviour and is expected to work; it simply is not asserted here.

### Manual checklist

1. Open the app, click **Project → Save**, type a name, press Enter.
2. Confirm the file appears in Downloads with the `.aura` extension.
3. **Project → Open Project…**, choose that file; confirm it loads.
4. **Project → Save** again; confirm `projectId` and `createdAt` match and `updatedAt` is later.
5. **Project → Save As…**; confirm a different `projectId` and `createdAt`.
6. On a phone: confirm the top bar, the five-item bottom navigation and the More sheet; export
   from the bottom nav; long-press a pad to accent it.
7. Repeat 1–5 in Safari (desktop) and on iOS Safari.

Validate any file with:

```bash
python3 fixtures/validate.py ~/Downloads/YourProject.aura
```

## 5. Mobile navigation (<768px) — v13.0.3

The transport previously needed **822px inside a 372px viewport**, leaving Project and the
overflow menu off-screen, so Save, Open and Export were unreachable on a phone. Phones now get
a dedicated structure: a compact top bar (emblem · truncated project name · Play · Record ·
**More**) and a five-item bottom navigation (Beat · Melody · Arrange · Vocals · **Export**),
with everything else one tap away in the More sheet.

Nineteen assertions per size, including a real **paint hit-test** (`elementFromPoint` at each
control's centre) rather than a style check — this is what caught the clip-path defect below.

| Assertion | 320×568 | 360×800 | 375×812 | 390×844 | 430×932 | 844×390 |
|---|---|---|---|---|---|---|
| Play visible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Record visible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| More visible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Project menu reachable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Save reachable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export reachable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bottom nav painted (hit-tested) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| No page horizontal overflow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transport does not scroll | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sequencer scrolls internally | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 44px touch targets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long-press accent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Browser opens as overlay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inspector opens as overlay | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mixer opens as full view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Guided Mode usable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| More sheet has all 12 commands | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sheet rows ≥44px | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sheet closes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Sequencer cell is 44px at every phone size. The desktop transport above 768px is unchanged
(verified at 1440×900: mobile chrome hidden, Mix tab and Fit 16 present, all 16 steps at 42px,
transport fits).

### Defects found and fixed during this pass

1. **`clip-path` clipped the bottom navigation.** `.work` carries a decorative notched
   `clip-path`; a clip-path on an ancestor clips `position:fixed` descendants. The new nav sat
   at y 787–844, outside `.work`'s 692px clip region, so it had layout but never painted and
   never hit-tested. Disabled on phone layouts. A style-only assertion passed while the nav was
   invisible — the paint hit-test is what exposed it.
2. **Fit 16 clipped the grid on phones.** With 44px cells the grid is wider than the viewport,
   and `body.fit16` kept `overflow-x:hidden`, hiding steps with no way to scroll. Phones now
   drop `fit16` and scroll inside the panel.
3. **TDZ crash.** The new mobile block referenced a `const` declared later in `mountShell`,
   throwing before `oldHeader.remove()` and leaving the shell unmounted.

## 6. Project name dialog and Recent Projects — v13.0.3

`window.prompt` no longer appears anywhere in `app.js` (verified by source scan).

| Requirement | Result |
|---|---|
| Pre-filled name | ✅ `Untitled` / `Untitled copy` for Save As |
| Text pre-selected | ✅ |
| Enter confirms | ✅ |
| Escape cancels | ✅ (name unchanged) |
| Focus trap | ✅ `aria-modal`, Tab cycles inside |
| Focus restoration | ✅ returns to the Project control |
| Empty-name validation | ✅ rejected with an inline error |
| Filename sanitisation | ✅ `My/Song:*?"<>|` → `MySong` |
| 80-character maximum | ✅ 120 chars → 80 |

Recent Projects drawer: name, relative updated time, Open and Remove per row, 44px targets,
Escape closes. The "vocal takes and imported audio were not stored" note is conditional and
appears only for entries saved while such media was loaded.

---

# 13.2.0-rc.1 — release-candidate run (2026-07-30)

Engine: Chromium 148.0.7778.280 (Claude Browser pane, Electron 42.7.0), macOS 15.5 (Darwin 25.5.0).
Server: `python3 serve.py` (repository-local, threaded, 127.0.0.1 only).

**Everything in this section ran in ONE Chromium build.** None of it is evidence about Safari, iOS or
Android; those remain open and are enumerated in `DEVICE-CHECKLIST.md`.

## A. Responsive layout — 17 viewports, zero findings

`/fixtures/layout-audit.html`, six workspace views per viewport plus the Vibes panel open.

| Viewport | Findings | Viewport | Findings |
|---|---|---|---|
| 320x568 | 0 | 834x1194 | 0 |
| 360x800 | 0 | 1024x768 | 0 |
| 375x812 | 0 | 1180x800 | 0 |
| 390x844 | 0 | 1280x800 | 0 |
| 414x896 | 0 | 1366x768 | 0 |
| 430x932 | 0 | 1440x900 | 0 |
| 480x800 | 0 | 1920x1080 | 0 |
| 844x390 (landscape phone) | 0 | | |
| 640x800 | 0 | | |
| 768x1024 | 0 | | |

Defects found and fixed in this pass: `.sub2` was an inline `<span>`, so `text-overflow:ellipsis` did
nothing and the vibe metadata line overflowed by 27px in the overlay and 107px in the desktop column;
six tabs plus two rail buttons measured 803px at a 768px viewport, hanging the inspector toggle off
the edge and scrolling the document sideways; toolbar actions sat at 33px against a 40px desktop
floor; `Tempo` rendered at 10px and the tightest Fit 16 plan put lane labels at 11px.

Accepted exceptions, each with a stated reason rather than a silent skip: six pre-existing sub-12px
labels in frozen layouts, range-input track thickness (a slider is grabbed by its thumb, and the
**draggable** axis is what is now checked, in both orientations), and one ellipsised **secondary**
metadata line. A primary label that ellipsises is still reported as a finding.

Method note: the audit forces the app's two responsive passes synchronously via `__auraSettleNow`
and uses Worker-backed timers, because a hidden tab pauses `requestAnimationFrame` and throttles
chained timers to roughly one per minute — which was silently measuring unfitted layouts.

## B. Media decode matrix

`/fixtures/media-decode.html`, driving the real `loadSampleFile()` — not `decodeAudioData` directly.

| Fixture | Bytes | Expected | Decoded | Duration | Ch/rate | Reason reported |
|---|---|---|---|---|---|---|
| tone.wav | 352,844 | decode | yes | 2.00s | 2 / 44100 | — |
| tone.mp3 | 32,109 | decode | yes | 2.01s | 2 / 44100 | — |
| tone.m4a | 19,953 | decode | yes | 2.02s | 2 / 44100 | — |
| tone.mp4 (audio track) | 19,953 | decode | yes | 2.02s | 2 / 44100 | — |
| webm-audio.webm | 32,174 | decode | yes | 1.98s | 2 / 44100 | — |
| webm-av.webm (video+audio) | 32,392 | decode | yes | 1.98s | 2 / 44100 | — |
| unsupported-codec.wav | 1,068 | unsupported-codec | no | — | — | `unsupported-codec` |
| no-data-chunk.wav | 36 | corrupt | no | — | — | `corrupt` |
| truncated.wav | 444 | too-short | no | — | — | `too-short` |
| empty.wav | 0 | empty | no | — | — | `empty` |
| not-audio.wav | 432 | not-media | no | — | — | `not-media` |
| webm-noaudio.webm | 445 | video, no audio | no | — | — | `video-undecodable` |
| mp4-noaudio.mp4 | 1,043 | video, no audio | no | — | — | `video-no-audio` |
| **ogg** | — | decode | **NOT GENERATED** | — | — | this browser cannot record OGG and no encoder on this machine can write one |

**13 of 14 as specified, 0 wrong.** Every successful import was asserted to arrive **muted**.

**OGG is untested, not passing.** It is a fixture gap, not a known failure — Chrome and Firefox both
decode OGG. It is carried as rows 34 and 46 of `DEVICE-CHECKLIST.md`.

The exact video wording is preserved verbatim: *"Aura could not read the audio in this video. Choose
an audio file instead."*

A real gap was found here: `decodeAudioData` is tolerant, and given a WAV whose header promises two
seconds and whose payload is 400 bytes it returns **2 milliseconds** and reports success. Aura was
accepting that as an import. A decode shorter than 250 ms is now a failure with its own message.

## C. Cancellation and failure isolation

`/fixtures/cancel-safety.html`. Every check compares `JSON.stringify(serialize())` before and after,
plus undo depth and autosave bytes.

| Check | Result |
|---|---|
| cancel before decode starts | pass — project identical, no checkpoint, no autosave change |
| cancel during decode (60s file, cancel won the race) | pass |
| cancel after decode, before analysis | pass |
| cancel during reconstruction | pass |
| reference removed during analysis | pass |
| project replaced during analysis (Open Recent path) | pass |
| second import supersedes the first | pass — one reference, muted |
| failed import: empty file | pass |
| failed import: not a media file | pass |
| failed import: truncated file | pass |
| re-analysis with the decoded buffer gone | pass |
| audio still usable afterwards | pass — AudioContext `running` |
| transport, export and reference controls survive | pass |
| Worker termination | **N/A — the app has no Worker** |
| Worker exception | **N/A — same reason** |
| temporary job deletion / timeout cleanup | **N/A — the browser app creates no temp files or jobs** |

13 pass, 0 fail, 3 not applicable. The three N/A rows are recorded as such rather than as passes,
because the app genuinely has no Worker: analysis is one synchronous pass on the main thread.
Cancellation is cooperative and checked at await boundaries; the worst case to honour a cancel is the
slowest measured analysis, 664 ms.

## D. Approximate vocal balance — measured

`/fixtures/vocal-qa.html`, 14 mixes built from known stems.

| Measurement | Result |
|---|---|
| median lead suppression | **-59.1 dB** |
| median wide-instrumental damage | **-0.0 dB** |
| median centred-instrumental loss | -44.6 dB — expected, see below |
| worst Full-mix recombination error | **-132.5 dBFS** |
| refused for lack of usable width | 2 / 2 |

Weakest results, kept in the report rather than smoothed away: a lead with wide stereo reverb
resists removal at **-7.9 dB**, a lead doubled off-centre at **-25.7 dB**, and a lead buried in a
dense instrumental at **-39.4 dB**.

**The defining limitation:** anything mixed dead centre — bass, kick, a centred piano — leaves with
the lead, about -44 dB. That is what centre-cancellation does, and it is not a defect.

Two defects were found and fixed here: *Keep wider backing vocals and adlibs* was retaining 3-5 dB
**less** backing than *Keep music* (the sharpness term was inverted), and the mask used
`|L·conj(R)|`, whose magnitude cannot distinguish +1 from -1 correlation — so hard anti-phase
content, the widest a mix can hold, scored as "centre" and was destroyed. Using the real part took
wide-instrumental damage from -46.5 dB to -0.0 dB.

## E. End-to-end: reference, sampler, families, persistence, export

`/fixtures/endtoend-qa.html` — **38 checks, 38 pass.**

- `serialize()` returns exactly **25 keys**, `SCHEMA_VERSION` **2**, no audio key.
- Six sonic families present; **all 30 named controls** change real project data.
- Sampler: generate a tone → find slices → build a section → turn it into a song, with undo.
- Imported reference arrives **muted**; export privacy measured (see `PRIVACY.md`).
- Export peak 0.9850 — never clips. Duration correct.
- No media bytes in the project, recents, autosave or a project export.

Four family controls were found doing nothing and were fixed: `layers` (mismapped slider range),
`contrast` and `space` (subtract-only, and inert on a family whose beat has no hat lanes), and
`revision` (a literal no-op).

## F. Regression baselines — unmoved

| Suite | Result |
|---|---|
| `/fixtures/import-qa.html` | timing F **0.9091**, lane recall **0.8649**, mislabels **0/44**, level invariance identical, **15/19** |
| `/fixtures/apply-safety.html` | **21/21** |
| `python3 fixtures/validate.py` | **12/12** |
| `python3 fixtures/validate.py RT-schema-final.aura` | **PASS** |

---

# 13.3.0-rc.1 — release-candidate run (2026-07-31)

Engine: Chromium (Claude Browser pane, Electron), macOS 15.5 (Darwin 25.5.0).
Server: `python3 serve.py` (repository-local, threaded, 127.0.0.1 only).

**Everything below ran in ONE Chromium build.** None of it is evidence about Safari, iOS or Android,
and none of it is a screen-reader test. Those remain open in `DEVICE-CHECKLIST.md` (69 rows).

## Results

| Suite | Result | Notes |
|---|---|---|
| `import-qa.html` | timing F **0.9091**, lane recall **0.8649**, mislabels **0**, 15/19 | unchanged from 13.2 |
| `apply-safety.html` | **21/21** | |
| `endtoend-qa.html` | **38/38** | `SCHEMA_VERSION` expectation updated 2 → 3 |
| `cancel-safety.html` | **13 pass, 3 N/A** | two real defects fixed to get here; see below |
| `vocal-qa.html` | **6/6 gates** | lead −59.1 dB, wide-instrumental −0.0 dB |
| `pathb-qa.html` | **10/10 low end, 19/19 lifecycle** | schema expectation updated |
| `midi-qa.html` | **22/22 virtual** | physical controller matrix OPEN |
| `performance-qa.html` | **29/29** | |
| `guide-qa.html` | **34/34 intents, 21/21 context/safety/privacy** | |
| `media-decode.html` | **13 as specified, 0 wrong, OGG untested** | no encoder here can write an OGG fixture |
| `persistence-qa.html` | **43/43** | includes 16 malformed-project cases |
| `a11y-qa.html` | **36/36** | structure only — NOT a screen-reader test |
| `layout-audit.html` | **17 viewports, 0 findings** | width and height, incl. landscape phone |
| `export-qa.html` | see below | new suite |

## What the cancellation suite caught

`mix.sample.mute` is channel 8 of `mx`, so it is serialised. Muting the Sample channel on import is
a project write, and it happened before all three of `loadSampleFile`'s cancellation checkpoints — a
cancelled import left the project changed and pushed an undo checkpoint. It had been invisible for
as long as the suite inherited a project from whichever suite ran before it: the channel was already
muted, so muting it again changed nothing and the suite reported 13/13 for the wrong reason.

The first fix introduced a worse bug, which the suite then caught: importing a second file while the
first was still in flight left the reference AUDIBLE, because job 1's cleanup ran after job 2 had
legitimately muted and reverted it. `impMuteOwner` makes the restore ownership-aware.

## Export determinism

`getNoise()` and `makeIR()` filled their buffers with `Math.random()`, and both cache per
`AudioContext` while every export builds a fresh `OfflineAudioContext`. One unchanged project
exported to a different file every time — **0.59 dB** of RMS spread across five renders. Both are
now seeded; five renders of an unchanged project are identical to within floating-point residue.

Measured through the shipped `renderExportBuffer()`:

- apply the low end: sub band −17.548 → −16.124 dBFS (**+1.42 dB**)
- one undo: back to **−17.548** dBFS, and the whole serialised project is identical
- redo: −16.114 vs −16.124
- save, reopen, export: −14.040 → **−14.040** dBFS
- a variation exports differently from Main (−14.550 vs −14.040) and switching back returns exactly
- an import is muted on arrival, so it is not in the export by default

## Still open, and not claimed

Safari, iOS, Android, a physical MIDI controller, VoiceOver, TalkBack, OGG decode, and real touch.
