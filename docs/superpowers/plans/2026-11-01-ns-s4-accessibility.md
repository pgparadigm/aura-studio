# S4 — accessibility (13.8.0-rc.20) — task plan and record

**Shipped in rc.20:** names, focus rings, contrast. **Waiting for Philip:** the 32 px desktop target size (58-70
controls under it in Studio, 10-21 in Guided, almost all in regions S6/S7/S10/S12 redesign; recommendation: each
redesign stage brings its own region to 32 px, the check covering every redesigned region and the whole app by S17).

## Measured on rc.19 and fixed

- **Names** (`n4ControlsNamed`, 1920/1440/1280 with the right drawer open/390): the nine right-panel sliders were the
  only unnamed controls (131-145 checked per desktop width): each `<label>` wraps an `<output>` first, and an output is
  labelable, so the label named it. Fix: `aria-label` with the plain name on each slider.
- **Focus rings** (`n4FocusRings`, a real-keyboard walk of 220 Tab presses recorded by the runner's new `focusWalk`
  step; Chromium reaches all 189 focusable controls at 1440, WebKit only form fields as Safari does by default): the
  Project intention box showed no ring in Chromium (its native 1 px ring). Cause: the global `:focus-visible` rule
  listed button, select, input and [tabindex], not textarea (nor links or summary). Fix: added them.
- **Contrast** (`n4Contrast`, solid backgrounds composited; gradients judged against their WORST stop, conservative;
  disabled controls exempt per WCAG 1.4.3): white text on four violet gradients was under 4.5:1 at the lightest stop:
  ▶ Play and the pattern buttons 4.42 (`#8750E8`), Apply 4.14 (`#A54CFF`), the phone's ▶ Play backing 3.18
  (`#A874FF`). Fix: those top stops darkened (`--violet-600`, `--electric-violet`, `#8150DA`).

## Mutants

Slider name removed: caught at every desktop width, both engines. Light Play-backing stop restored: caught at 390,
both engines. Textarea taken out of the focus rule: caught in Chromium (1440, 1280); in WebKit the browser's own
3 px ring still shows (measured), so there is nothing to catch there.

**Not proven:** a screen reader's actual reading; WebKit's tab order beyond form fields; contrast of canvas text and of
states not on screen at load (e.g. Play while playing).
