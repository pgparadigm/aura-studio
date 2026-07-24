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
