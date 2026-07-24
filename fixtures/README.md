# Aura regression fixtures

Two ways to use this corpus:

## 1. Automated schema tests (`test.html`)

Serve the repo and open `fixtures/test.html`. It validates every fixture against
[`aura-project.schema.json`](../aura-project.schema.json) using the dependency-free validator
in `schema-validate.js`, and reports PASS/FAIL per case. The page title shows the summary
(`PASS 11/11 …`) and `window.__RESULTS` holds the machine-readable outcome.

```bash
# any static server works, e.g.
python3 -m http.server 8791
# then open http://localhost:8791/fixtures/test.html
```

| Fixture | Exercises | Against strict schema |
|---|---|---|
| `complete.aura` | full project (drums, chords, bass, melody, arrangement, mixer, effects) — the RT.aura / demo shape | **pass** |
| `empty.aura` | empty project; every content flag false | **pass** |
| `unknown-fields.aura` | unknown optional fields at top level and in `project` | **pass** (ignored) |
| `future-schema.aura` | `schemaVersion` newer than 2 | **fail** |
| `malformed.aura` | not valid JSON | **fail** |
| `oob-tempo.aura` | `tempo` out of range (300) | **fail** |
| `invalid-mode.aura` | `mode` not in the allowed set | **fail** |
| `bad-section-count.aura` | 5 pattern sections instead of 6 | **fail** |
| `bad-arrangement-length.aura` | arrangement length 16 instead of 32 | **fail** |
| `invalid-note-tuple.aura` | melody note pitch out of range | **fail** |
| `legacy-v12.aura` | schema-1 bare compact state | **fail** (opened by the lenient in-app loader, not this strict schema) |

## 2. In-app behaviour

Load each fixture through the ↥ Open button (or Browser → Imported Audio → Open). The in-app
loader is deliberately **lenient** — it clamps out-of-range numbers, ignores unknown/future
keys, and rejects only files it can't parse or that carry no song data, always with a
readable message and no half-applied state.

| File | In-app result |
|---|---|
| `complete.aura` | Opens; A minor, 92 BPM, four-on-the-floor beat + melody. Identity preserved. |
| `empty.aura` | Opens; grid clear; 92 BPM; content flags all false. |
| `malformed.aura` | Rejected: "not valid JSON"; studio untouched. |
| `unknown-fields.aura` | Opens; unknown keys ignored; kick on step 1. |
| `future-schema.aura` | Rejected: "newer version" message; studio untouched. |
| `oob-tempo.aura` | Opens; tempo clamped into range. |
| `legacy-v12.aura` | Opens; A minor, 90 BPM, dembow beat (bare compact v12 state). |

`RT.aura` and `Gate Test.aura` are user-provided regression fixtures kept out of this repo;
`complete.aura` stands in for them in the automated suite.
