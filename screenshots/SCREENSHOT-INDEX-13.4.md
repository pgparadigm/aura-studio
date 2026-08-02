# Screenshot evidence — Aura Studio 13.4

Twenty named states, photographed from the shipped runtime. The "before" set is the **deployed**
13.3 (`main` at `2d70dde`, `APP_VERSION='13.3.0-rc.1'`), served from a detached worktree so `main`
itself is never checked out anywhere writable. The "after" set is this branch at three viewports.

    screenshots/13.4/
      before/                 public 13.3 at 1440x900          19 frames
      after/desktop/          13.4 at 1440x900                 20 frames
      after/phone-390/        13.4 at 390x844  (iPhone 12-15)  20 frames
      after/phone-320/        13.4 at 320x568  (smallest)      20 frames
      contact-sheets/         one sheet per target, HTML + PNG

**79 frames.** All 60 on the 13.4 side reached the state they name. Sixteen of the twenty did on
13.3; the other four have no 13.3 counterpart and are listed with the evidence below.

## How they were taken

`fixtures/shot.html` is a capture stage: an iframe pinned at 0,0 at exactly the requested size, so
the PNG is the app pixel for pixel with none of the stage in it. Each state is a recipe that drives
the **shipped** app the way a person would — it presses the Song Architect's own button, clicks a
sound family, clicks slots to clear bars. Headless Chrome photographs the stage and dumps its DOM
in the same run; the stage writes a verdict into `<title>`, so every frame carries the harness's own
report of whether it actually reached the state.

Reproduce with the driver in the session scratchpad, or by hand:

```bash
python3 serve.py 8793
```

Two things in that pipeline are worth knowing before changing it:

- The stage uses **plain `setTimeout`**, deliberately unlike every other file in `fixtures/`. Those
  use Worker-backed timers because a hidden interactive tab throttles chained timeouts. This page
  runs under `--virtual-time-budget`, which fast-forwards `setTimeout` but does **not** advance a
  Worker's timers — with the Worker version the budget expired during the first sleep and every
  frame photographed the Welcome screen instead of the state it was named for.
- Chrome does not exit reliably after `--screenshot` here, so each run is backgrounded and reaped
  on a fixed budget, and each gets its own `--user-data-dir`. A shared profile makes concurrent
  instances fight over the lock and silently serialise.

## What the verdicts mean

`reached` is the harness saying the recipe got to the state. It is **not** a judgement about the
design, and `not captured` is **not** a claim that something is missing from the product.

The distinction matters because it was got wrong once here. The first pass captioned every failed
13.3 capture "did not exist in 13.3". Four of those states do exist in 13.3 — `welcome`,
`beat-playing`, `balance` and `find-a-sound` all came back MISSING from a build that plainly has
them, on transient failures — and shipping that caption would have put a false claim under a real
screenshot. Absence is now asserted only from the 13.3 source, in `contact-sheets/build.py`:

| state | why 13.3 has no counterpart |
|---|---|
| `song-timeline` | no `#songTimeline` in 13.3's `app.js` or `index.html` |
| `song-empty` | the empty state belongs to `#songTimeline`, which 13.3 does not have |
| `guide-quick` | 13.3 has `.guidesheet` but zero occurrences of the quick layer |
| `vocals-take` | 13.3 has no `body.has-take` — a take existed, but no state was signalled |

`before/10-vocals-take.png` is absent on purpose. The capture produced Chrome's broken-page
placeholder rather than the app, and a 6 KB grey rectangle is not evidence of anything. The contact
sheet enumerates the canonical twenty rather than the directory listing, so that row still appears
with its reason instead of the sheet quietly shrinking to nineteen tiles and looking complete.

One "before" frame is a deliberate near-miss rather than a match: `perform`. 13.3 contains every
`#perf*` id but not one occurrence of `performing` — Perform was a **card** there, and 13.4 makes
it a **mode**. Requiring `body.performing` reported the room missing from a build that has the
controls, so the recipe falls back to photographing 13.3's card. That pair is the comparison, not a
failure.

## The twenty states

| # | state | what it shows |
|---|---|---|
| 01 | `welcome` | the one question a singer is asked first |
| 02 | `vibes` | the emotional doors |
| 03 | `beat-ready` | a built backing track, at rest |
| 04 | `beat-playing` | the same room while it plays |
| 05 | `song-empty` | the arrangement with nothing in it |
| 06 | `song-timeline` | the song as a shape, after the Architect |
| 07 | `melody` | the piano roll |
| 08 | `vocals-empty` | the singer's room before a take |
| 09 | `vocals-armed` | recording — the state pink is reserved for |
| 10 | `vocals-take` | a take exists and is the thing to listen to |
| 11 | `lyrics` | the words |
| 12 | `coach` | the vocal coach's reading |
| 13 | `balance` | the mixer, Mix Check, Rights, Finish |
| 14 | `sound` | the sampler |
| 15 | `find-a-sound` | a family auditioned, with its nudges |
| 16 | `perform` | the stage (13.3: the card) |
| 17 | `finish` | where each stage of the record stands |
| 18 | `guide-quick` | Ask Aura at its shallowest depth |
| 19 | `guide-full` | the full conversation, with context and history |
| 20 | `export` | what leaves the room |

## What these do not establish

- **No physical device was used.** Every frame is headless Chrome on macOS at a set viewport. iOS
  Safari, Android Chrome and real touch remain untested, as they have been throughout.
- **They are not a design verdict.** They record what the app looked like; whether it looks *right*
  is the judgement in the commit history and `AURA-STATE.md`, not something a PNG can assert.
- **`vocals-armed` is driven by the class the recorder sets**, not by a granted microphone — no
  fixture can be given one. The styling is real; the take is not.
- **The 13.3 set is the deployed build, not the 13.3 tag.** `main` (`2d70dde`) is what a singer
  would have loaded; the tag `v13.3.0-rc.1` (`fc668f9`) is the RC freeze and is a different commit.
