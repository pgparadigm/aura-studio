# Aura Studio v13.0.0 — browser test report

Commit under test: **`51900bf`** (tagged `v13.0.0`)
Engine: Chromium (Claude Browser pane) + Google Chrome
Server: `python3 -m http.server` over the repo root
Date: 2026-07-24

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

`RT-schema-final.aura`, exported from `51900bf`, 5187 bytes,
`sha256 92edba017defc277087213225eb7a83de7110fd90635491a020bf7330d277944`

Verified against the **bytes on disk** (not an in-memory object):

```
schemaVersion 2 · appVersion "13.0.0" · capabilities boolean object
all 8 symmetrical content flags · mediaPersistence · encoding · encoding.schemaRef
project.internalStateVersion 13 · no project.stateVersion · no top-level stateVersion
projectId 674f861f-7093-4e96-8c25-49a83a68946b (UUID v4)
```

Schema validation of the file on disk against `aura-project.schema.json`: **PASS**
(both validators — `fixtures/validate.py` headless and `fixtures/test.html` in-browser —
also agree 12/12 on the fixture corpus).

Reopened through the app's file input and re-saved:

| Check | Result |
|---|---|
| Save preserves `projectId` | ✅ `674f861f-…` |
| Save preserves `createdAt` | ✅ |
| Save advances `updatedAt` | ✅ |
| Save As mints a new `projectId` | ✅ `d1bbd06b-…` (UUID v4) |
| Save As mints a new `createdAt` | ✅ |

## 4. Not covered by automation — needs a human

These steps could not be driven from this environment. **The download itself is real browser
behaviour and is expected to work; it simply cannot be asserted from here.**

- **Chrome's `prompt()` for the project name.** `javascript_tool` executes in an *isolated
  world*, so `window.prompt` cannot be stubbed in Chrome, and a native JS dialog cannot be
  typed into (Chrome is read-only tier for screen control). In a background tab Chrome
  suppresses the dialog and blocks the download; in a focused tab the dialog blocks the
  renderer. Rather than leave a modal stuck in a real browser, this was not forced.
- **The native file-chooser** opened by *Open Project…* (OS-level dialog).
- **Safari** (desktop and iOS) — no drivable instance available here.

## 5. Open defect — transport at phone widths (not fixed)

At **390 × 844** the transport needs **822px** of content in a **372px** viewport. Eight controls
render off-screen, including **Project** and the **⋯ overflow menu itself**, so Save / Open /
Export cannot be reached on a phone. The measured hierarchy collapses the six actions and the
three sliders, but the wordmark, bar·beat readout, Guided/Studio switch and undo/redo are never
collapsed, and alone they exceed the width.

This is outside the 1180–1920 range the transport was certified for. The fix would extend the
existing collapse ladder to the controls not on the "always visible" list (readout,
Guided/Studio, undo/redo) — a visual change, so it is left for an explicit decision.

Everything else at 390px is correct: sidebars collapse to `0px 358px 0px`, the workspace fills
the width, there is no horizontal page overflow, the bottom tab bar is on screen, and the
sequencer scrolls horizontally as intended for touch.

### Manual checklist

**Still outstanding — manual release checks (not yet completed):**
Safari desktop · iPhone (iOS Safari) · Android · native browser download · real-touch
interaction (44px targets, long-press accents, horizontal sequencer scrolling). None of these
can be driven from this environment; all remain open.

1. Open the app, click **Project → Save**, type `RT-schema-final`, press OK.
2. Confirm `RT-schema-final.aura` appears in Downloads with the `.aura` extension.
3. **Project → Open Project…**, choose that file; confirm it loads (90 BPM, A minor).
4. **Project → Save** again; open both files and confirm `projectId` and `createdAt` match
   and `updatedAt` is later.
5. **Project → Save As…**; confirm the new file has a different `projectId` and `createdAt`.
6. Repeat 1–5 in Safari (desktop), and the download/reopen flow on iOS Safari.

Validate any file with:

```bash
python3 fixtures/validate.py ~/Downloads/RT-schema-final.aura
```
