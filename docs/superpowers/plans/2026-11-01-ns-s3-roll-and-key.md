# S3 + the header Key (13.8.0-rc.19) — task plan and record

**Goal:** the piano roll fills its panel at every width (Philip, 2026-10-31: empty space both sides at 1920 too);
overflow and Ask Aura guards; the Studio header's Key painted from ONE place every key change goes through, project
restore included (Philip, 2026-11-01), so it cannot go stale again.

## Measured on rc.18 (both engines) — the reds

- `n3RollFills`: the roll stayed 640 px (16 × 40) and centred: equal empty space 212 px either side at 1920×1113, 53 at
  1440, 123 at 1280. **Cause:** its fit measured `.prwrap`, which is sized to its own content, so it could never grow;
  a 56 px cap; `.prscroll{width:max-content;margin-inline:auto}`; and no refit when Studio's editor switches to it.
- `n3Key*` (first visit, fresh, restored, after a vibe, after the selects): the header said "C major" in every case.
  **Cause:** the header was painted once (when the Studio top bar is built) and then only when the playhead moved;
  nine places assigned `keyRoot`/`keyMode` directly. `n3KeyOnePlace`: no setter existed.

## Code

- `fitRoll()`: column width = (scroller width − keys) / 16, at least 26 px, no cap; called at the top of the desktop
  fit path (phones and zoom mode keep 40 px and scroll) and when Studio switches to the roll; the scroller spans its
  panel.
- `setKey(root, mode)`: the only assignment to `keyRoot`/`keyMode`; updates both selects and paints the header. All
  nine call sites (a vibe, restore, a variation, an import, the two selects, a sample, Lift, Tension) go through it.

## Checks (1920×1113 where the roll or overlap is tested; 1440×900, 1280×800, 390×844; both engines)

`n3RollFills` (desktop: no gap either side, grid to the scroller's edge, no sideways scroll in the roll; phone: the page
never scrolls sideways), `n3NoOverflow` (guard; every view, editor tab and drawer, Studio and Guided, at 1920, 1440,
1280, 1024, 768, 390), `n3AskClearBelow1400` (guard; 1280, 1024, 768, 390), `n3KeyFirstVisit`, `n3KeyFresh`,
`n3KeyRestored`, `n3KeyAfterVibe`, `n3KeyAfterSelect` (1440, 1280), `n3KeyOnePlace` (reads the app.js the page loaded:
fails if anything outside `setKey` assigns the key).

Mutants, all caught: `setKey` without the header paint (10/11 per engine); restore bypassing `setKey` (caught ONLY by
`n3KeyOnePlace` — restore also sets the mode through `setKey`, which repaints the header, so the path checks pass; the
reason the guard exists); the 56 px cap back, the shrink-wrapped scroller back, no refit on the editor switch (3/4
each: the phone case is untouched by design).

**Not proven:** the roll's feel at very large widths (columns of 66 px at 1920); Ask Aura over the right panel at 1400
and up is S6's.
