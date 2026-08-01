# Aura Studio — Design System

The insignia of an elite fictional music house. Nocturnal, luxurious, rebellious, musical.
Not a dark SaaS dashboard, not a game fan page, not a purple reskin.

## 1. Colour tokens

```css
:root{
  /* environment — near-black violet, four depths */
  --void:#07050B;            /* page ground, behind everything */
  --black-violet:#0D0713;    /* app shell */
  --surface-1:#130B1C;       /* panels */
  --surface-2:#1B1027;       /* raised panels, strips */
  --surface-3:#261537;       /* controls, inactive pads */

  /* brand — purple is the unmistakable identity */
  --royal-purple:#54147C;    /* structural brand, borders, deep fills */
  --electric-violet:#8D2BFF; /* primary action, active state */
  --active-purple:#A54CFF;   /* hover / live emphasis */

  /* text */
  --silver:#E9E5EE;          /* primary text */
  --silver-muted:#A39AAE;    /* secondary text */
  --violet-muted:#71667D;    /* tertiary, disabled, ornament */

  /* restricted-use accents */
  --prestige-gold:#D4B26C;   /* ROOT NOTES + selected section + premium guidance ONLY */
  --record-pink:#FF477E;     /* RECORDING + destructive ONLY */
  --success:#57D9A3;
  --warning:#E8B75E;
}
```

### Colour discipline (non-negotiable)

| Colour | Allowed use | Never |
|---|---|---|
| Purple family | Everything structural and active: pads, faders, selection, playhead glow, focus | — |
| `--prestige-gold` | Musical root notes; selected song-section label; a premium hint; hairline ornament | Buttons, panel fills, body text, icons at large size |
| `--record-pink` | The record control, the recording timeline marker, recording status, delete/clear confirm | Any non-destructive control, any decorative use |
| `--success` / `--warning` | Save confirmation, clip warnings | Decoration |

Purple must dominate. Gold, pink and green are punctuation, never a second theme.

## 2. Typography

```css
--font-display:"Arial Narrow","Roboto Condensed","DIN Condensed","Bahnschrift Condensed",
               "Helvetica Neue Condensed",sans-serif;
--font-ui:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--font-num:ui-monospace,"SF Mono",Menlo,Consolas,monospace;  /* tabular readouts */
```

- **Section titles / channel names / transport labels** — display stack, UPPERCASE, `letter-spacing:.08em`, 11–13px.
- **Body, tooltips, inspector labels** — UI stack, sentence case, 12–13px.
- **Numeric readouts** (BPM, bar, time, dB, ms) — `font-variant-numeric:tabular-nums`, never reflow while counting.
- No script or decorative faces anywhere inside production controls. Ornament lives in borders, motifs and the emblem.

## 3. Spacing, radius, elevation

```css
--r-sm:4px;   /* pads, steps */
--r-md:8px;   /* controls */
--r-lg:12px;  /* panels */
--gap:8px;
--pad:12px;
--rail:44px;  /* minimum touch target */
```

Surfaces are **black glass with a violet perimeter light**, not frosted glassmorphism:

```css
--edge:1px solid rgba(141,43,255,.22);      /* violet perimeter */
--edge-silver:1px solid rgba(233,229,238,.10); /* thin silver highlight */
--glow-violet:0 0 22px rgba(141,43,255,.28);
--inset-top:inset 0 1px 0 rgba(233,229,238,.06);
```

Corners: mostly `--r-md`. **Notched/diagonal corners** are reserved for panel headers and the emblem plate — an occasional accent, never on every element.

## 4. Ornament system (original, no third-party marks)

Four devices, all CSS/SVG, all extremely restrained:

1. **Three-petal motif** — an original abstract trefoil, used at **2–4% opacity** as a large watermark in empty panel space. Never repeated on buttons.
2. **Halo arcs** — thin elliptical strokes suggesting a halo/wing, used behind the emblem and at panel-header corners.
3. **City silhouette** — a far-back skyline of simple rectangles, `opacity:.05`, only at the bottom of otherwise-empty panels.
4. **Film grain** — a single tiled SVG turbulence at `opacity:.035`, fixed to the shell.

**All four must vanish or drop below 2% behind production grids** (channel rack, piano roll, playlist, mixer) so steps, notes and meters stay legible.

## 5. The Aura emblem

Original mark, built as inline SVG. Composition:
- A stylised **A** formed by two rising strokes that don't meet — reading as both a letter and a spire.
- The negative space between them resolves into a **three-petal** silhouette.
- Two **wing arcs** sweep outward from the base, asymmetric, clipped.
- A single **halo ellipse** crosses behind the apex.
- Three **frequency lines** of unequal length cross the lower third, suggesting a waveform.

Rules: no fleur-de-lis, no religious iconography, no gang or crime imagery. Monochrome silver on violet at small sizes; gold only for a "premium" state.

## 6. Motion

| Element | Duration | Easing |
|---|---|---|
| Control state (hover, active, pad) | 100–160ms | `cubic-bezier(.2,.7,.3,1)` |
| Panel open/close, drawer | 180–240ms | `cubic-bezier(.16,.84,.44,1)` |
| Playhead | continuous, `requestAnimationFrame`, no transition |
| Meters | 60ms attack / 220ms release easing |

No bouncing, no card hover-lift, no ambient pulsing. **Only the recording indicator pulses.**
All of the above collapses to `0ms` under `@media (prefers-reduced-motion:reduce)`.

## 7. Layout shell

```
┌──────────────────────────────────────────────────────────────┐
│ TRANSPORT  emblem · project · saved   ⏮ ▶ ■ ● ↻ 🎵  bar/time │  56px fixed
├────────────┬──────────────────────────────────┬──────────────┤
│ BROWSER    │ WORKSPACE                        │ INSPECTOR    │
│ 248px      │ Rack │ Piano │ Playlist │ Vocals │ 268px        │
│ collapsible│ (tabbed, fills)                  │ contextual   │
├────────────┴──────────────────────────────────┴──────────────┤
│ MIXER  8 channels + Master, 9 strips · effects drawer        │  collapsible
└──────────────────────────────────────────────────────────────┘
```

- Shell is `100dvh`, `display:grid`, no page scroll. Only panel interiors scroll.
- **Guided Mode** hides Browser/Inspector/Mixer chrome and drives one step at a time; same DOM, same state.

### Breakpoints
| Width | Behaviour |
|---|---|
| ≥1280 | Full four-region layout |
| 1024–1279 | Browser and Inspector collapse to icon rails; Mixer becomes a drawer |
| 768–1023 | Browser/Inspector overlay on demand; Mixer drawer |
| <768 | Guided Mode default; one view at a time; bottom nav (Beat · Melody · Arrange · Vocals · Export); 44px targets |

## 8. Accessibility contract

- Text contrast ≥ 4.5:1 on `--surface-1/2/3` (silver on surface-2 measures ≈ 12:1).
- Never colour alone: active steps also change **elevation and inner mark**; solo/mute carry letters; root notes carry a **left tick** as well as gold.
- `:focus-visible` = 2px `--active-purple` ring + 1px dark offset, on every interactive element.
- Every icon-only control has `aria-label`; grids expose `role="grid"`/`gridcell"` with `aria-selected`.
- Full keyboard path: Tab between regions, arrows within grids, Space = play, R = record.
- **`hidden` is honoured, not merely intended.** `[hidden]{display:none!important}` sits above every
  layout rule, because the UA sheet's `[hidden]{display:none}` loses to any rule that sets a display
  and a panel toggled with `el.hidden` will otherwise stay on screen — and stay focusable.
- **A dialog is a dialog.** `role="dialog"` + `aria-modal`, focus moves in on open, is trapped while
  open, and returns to the control that opened it on close. Escape closes.
- **A destructive confirmation names the change**, not just the verb: "Confirm: make the chorus
  bigger" and "Cancel: leave the project as it is". Focus lands on the safe choice.
- **Anything that changes on its own is announced** — import and analysis progress, controller
  connection, recording state, the Guide's own replies.
- **Confidence is a word before it is a colour**: `good` / `fair` / `low` / `Needs review`, and
  `not looked for yet` for a result that has not been computed. Never an empty element.
- Verified by `fixtures/a11y-qa.html` (36 checks). That suite verifies **structure**; it is not a
  screen-reader test and must never be reported as one.

## Import & rebuild (v13.2)

**One panel, one title.** The Browser had three competing headings — panel title *Vibes*, a tab row
*Vibes | Imported Audio*, then a group *Start here*. A panel gets one title. Below it: a description,
two paths, then `Start here`, `All vibes`, and `Your recording` — which does not exist until a file
does. No permanent empty section, ever.

**The recording is a reference until the singer says otherwise.** Aura's export renders through the
same graph as playback, so anything audible is in the WAV. An imported song is therefore muted on
arrival and the card says so in the words that matter to the person: *Off, so your export is Aura's
parts only.* That is a product decision, not a technical one — a singer should never discover
someone else's record inside a file they made.

**Two numbers, never one.** Aura is good at hearing *when* a drum hits and much weaker at hearing
*which* drum it is. Averaging those into a single confidence let a strong grid hide a wrong
instrument. The row shows `timing` and `instruments` separately, and when they disagree the hit still
lands on the right step in the broad Percussion lane, marked *Needs review*.

**A broad right answer beats a specific wrong one.** A rimshot, a conga and a shaker are not reliably
separable from a mix at 11.6 ms frames. Aura puts them in Percussion — the cheapest place in the kit
to be wrong, because a soft band-passed tick cannot fake a downbeat or a backbeat — and one tap moves
them. Confident mislabels are the failure a singer cannot detect for themselves, so the suite weights
them hardest and the release ships at zero.

**Uncertainty degrades, it does not interrogate.** Nothing in the reconstruction asks a blocking
question. An unclear bar phase becomes four tappable choices with the detected one preselected. An
ambiguous tempo becomes *Try twice as fast*. A recording with too little dynamic range to tell a
verse from a chorus gets parts named A, B and C and a sentence explaining why. Every one of these
re-fits the preview and applies nothing.

**Nothing is written until Apply, and Apply is one undo.** Every preview edit lives on the analysis
object, which is never serialised — so a singer can reassign drums, change chords and drag boundaries
with no way to damage their project. *Replace what's there* and *Only fill the gaps* say what they do
in a sentence naming the section number, and Replace names what it will destroy before it does it.

**Language.** No lanes, stems, quantisation, onsets, separation, or transcription in anything a
singer reads. "The drums", "The parts of your song", "The chords". The truthful promise appears once:
*Aura creates an editable reconstruction from what it can hear. Review and adjust the result.*


## Perform, controllers and the Guide (v13.3)

**One action layer, three ways in.** The Perform view, a MIDI controller and the take recorder all
go through the same `runAction(name, value)` dispatch over the same 22 named actions. That is a
design constraint, not an implementation detail: three parallel command paths drift, and the one
nobody tests is the one that breaks. A control that exists on screen is a control a controller can
map and a recorder can capture, automatically.

**A controller is generic until proven otherwise.** No vendor is hard-coded. Aura listens for
messages and you tell it what they mean with MIDI Learn. The mapping stores the message and the
action — never the hardware.

**Ask Aura is not a personality and not a model.** It is a fixed set of answers about controls that
actually exist. It says which, it says when it does not know, and it never guesses. Its shape is
Understand → Preview → Confirm → Apply: it explains what it heard, describes what would change,
waits, and only then makes one undoable change. An assistant that edits your song while you are
still deciding is not helpful, it is startling.

**Versions are alternatives, not backups.** They live beside your work rather than replacing it, and
switching between them is a normal, reversible move — so trying an idea costs nothing.

## Choosing before writing (v13.3)

**Find a sound comes before the melody, not after it.** The craft source is blunt about this: pick
the wrong sound and you write around it, then stack layers trying to fix what was never a writing
problem. So sound selection is its own step, and it is browsed by **feeling** — Warm, Dark, Glassy,
Intimate, Dreamlike — rather than by preset name. A singer does not know what a preset name means
and should not have to.

**The audition is the result.** Choosing a family sets the real melody voice and the real mixer, and
plays a note at that family's register. There is deliberately no preview-only path: a preview that
differs from the result is how someone commits to a sound and is surprised by their export.

**Adjustments accumulate, and the limit is spoken.** Warmer pressed twice is warmer twice. Pressing
the family again is the way back — because otherwise that press does nothing at all, and a control
that silently ignores you is worse than one that is missing. When the underlying value has clamped,
the card says it has gone as far as it goes rather than reporting success while nothing moves. The
message tests the value that actually clamps, not an internal counter that has further to run.

**Create something asks four questions, and only four.** Lane, tempo feeling, mood, starting point —
the four that change the music. Not a project wizard: no title, no folder, no format, nothing
administrative. It writes a complete arrangement, groove and sound as **one** checkpoint, so
rejecting the whole thing is a single undo. And it is reproducible, *Surprise me* included: a result
you cannot get back to is a demo, not a tool.

**Neither becomes a tab.** Find a sound sits at the top of the existing Sound tab; Create opens from
the vibes strip and the welcome, the two places someone already goes to begin. Capability is added
by deepening the places that exist, not by widening the navigation.

**A new project is a new project.** Everything a song carries is cleared when one starts — including
the singer's lyrics, their performance notes and their stated intention for the record. Anything
less means private words follow someone into work they did not write them for, and get saved into
the next file they export.
