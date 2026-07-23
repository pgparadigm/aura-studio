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
│ MIXER  10 strips + master · effects drawer                   │  collapsible
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
| <768 | Guided Mode default; one view at a time; bottom nav (Beat · Melody · Song · Voice · Export); 44px targets |

## 8. Accessibility contract

- Text contrast ≥ 4.5:1 on `--surface-1/2/3` (silver on surface-2 measures ≈ 12:1).
- Never colour alone: active steps also change **elevation and inner mark**; solo/mute carry letters; root notes carry a **left tick** as well as gold.
- `:focus-visible` = 2px `--active-purple` ring + 1px dark offset, on every interactive element.
- Every icon-only control has `aria-label`; grids expose `role="grid"`/`gridcell"` with `aria-selected`.
- Full keyboard path: Tab between regions, arrows within grids, Space = play, R = record.
