# Aura regression fixtures

The public demo is generated in-app — Welcome → "Hear what Aura can make" (or loadDemo()).

Load each fixture through Browser → Imported Audio → Open (.aura), or the ↥ Open button.

| File | Expected result |
|---|---|
| `empty.aura` | Opens; grid clear; BPM 92. Content flags all false. |
| `malformed.aura` | Rejected with "not valid JSON"; studio untouched. |
| `unknown-fields.aura` | Opens; unknown keys ignored; kick on step 1. |
| `future-schema.aura` | Rejected with a "newer version" message; studio untouched. |
| `legacy-v12.aura` | Opens; A minor, 90 BPM, dembow beat (bare compact v12 state). |

`Gate Test.aura` is the user-provided regression fixture; keep it out of the public demo.
