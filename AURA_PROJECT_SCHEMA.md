# Aura Studio project file (`.aura`) — schema reference

A `.aura` file is JSON. The **top level is human-readable**; the nested arrays inside
`project` stay **positional** (compact) for size. This document defines every index, tuple
position, channel order, range and bitmask rule. The machine-checkable version is
[`aura-project.schema.json`](aura-project.schema.json) (JSON Schema draft-07).

Vocal takes and imported audio are **never** stored in a project file or a share link — they
stay on the device.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `format` | string | Always `"aura-project"`. Any other value is not an Aura file. |
| `schemaVersion` | integer | **File-format** version, independent of the app. This doc describes **2**. A higher number = a newer format Aura can't open. |
| `appVersion` | string | Semantic version of the Aura build that wrote the file, e.g. `"13.0.3"`. Informational. |
| `projectId` | string | Stable project identity — a UUID (`crypto.randomUUID()`) where available, else an `aura_…` id. |
| `name` | string | Display name. |
| `createdAt` | string | ISO-8601. Set once, when the `projectId` is first minted. |
| `updatedAt` | string | ISO-8601. Refreshed on every save. |
| `capabilities` | object | What this build of Aura **supports** — an **object** of booleans (not an array) so new keys can be added explicitly and stay forward-compatible. |
| `mediaPersistence` | object | What the **format** embeds (see below). Always `false` / `false`. |
| `content` | object | What is actually in **this** project (see below). Symmetrical with `capabilities`. |
| `encoding` | object | Human note describing the compact layouts, plus `schemaRef`. |
| `note` | string | Reminder that vocals/imported audio are not embedded. |
| `project` | object | The song state, with readable field names (see below). |

### Version fields, disambiguated

- **`schemaVersion`** — the on-disk *format*. Bump only when the file layout changes. Aura
  refuses to open a file whose `schemaVersion` exceeds the one it understands (2).
- **`appVersion`** — which Aura *build* wrote the file. Purely informational; never gates loading.
- **`project.internalStateVersion`** — the compact-state migration counter shared with the
  browser autosave and share links (13). Used only to migrate older state shapes; not needed
  to read a current file. Files written by the earlier schema-2 build used the name
  `stateVersion`; Aura still accepts that name on read.

### `mediaPersistence` vs `content` — schema capability vs current project

These answer two different questions and must not be conflated:

```json
"mediaPersistence": { "vocalTakesEmbedded": false, "importedAudioEmbedded": false }
```

- **`mediaPersistence`** describes the **schema**: whether this *file format* is capable of
  embedding recorded audio. It is a fixed guarantee — both flags are always `false`, in every
  Aura project file ever written, and the JSON Schema pins them with `const: false`. A file
  claiming `true` is not a valid Aura project. Read this to know what a `.aura` file *can*
  contain before you open it.
- **`content.hasVocalTakes` / `content.hasImportedAudio`** describe **this project**: whether
  the user currently has vocal takes or an imported instrumental loaded *in the app*. Because
  the format never embeds audio, these are `false` in a saved file too — but they are computed
  per project, not fixed by the format.

In short: `mediaPersistence` is a property of the format, `content` is a property of the
project. The first never varies; the second is recomputed on every save.

### `content` flags (symmetrical with `capabilities`)

Computed from actual state, not assumed:

`hasDrums`, `hasChords`, `hasBass`, `hasMelody`, `hasArrangement`, `hasMixerOverrides`,
`hasVocalTakes`, `hasImportedAudio` — all booleans. `hasVocalTakes` and `hasImportedAudio`
are always `false` in a file (that content is never embedded).

## `project` — song state

Scalars:

| Field | Type | Range / values |
|---|---|---|
| `keyIndex` | integer | `0`–`11` (semitone, C=0) |
| `mode` | string | `major` · `minor` · `dorian` · `phrygian` · `harmonicMinor` |
| `tempo` | number | `60`–`160` BPM |
| `swing` | number | `0`–`60` |
| `reverb` | number | `0`–`100` |
| `chordSound` | string | `pad` · `piano` · `soul` · `pluck` |
| `bassSound` | string | `sub` · `808` |
| `melodySound` | string | `lead` · `pluck` · `keys` · `pad` · `bell` · `b808` |
| `chordVolume` `bassVolume` `masterVolume` `melodyVolume` | number | `0`–`100` |
| `countIn` `autoFill` | integer | `0` or `1` |
| `currentSection` | integer | `0`–`5` |
| `sectionNames` | string[] | ≤ 6 names, ≤ 14 chars each |
| `drumVolumes` | integer[] | 6 values, per-drum bus volume × 100 |
| `mutes` | object | `{ id: 1 }` for muted buses |

### The bitmask rule (patterns & accents)

A step lane is a **16-bit integer**. Bit *s* (value `1 << s`) set = step *s* is active,
for `s = 0 … 15`. Examples: `1` = step 0 only; `4369` = `0x1111` = steps 0,4,8,12
(four-on-the-floor); `65535` = all 16 steps.

### `patterns` — `[6 sections][13 lanes]` of masks

Exactly **6** sections. Each section is **13** lane masks, in this order:

```
index:  0     1      2     3     4        5       6     7     8     9    10    11    12
lane:   kick  snare  clap  hat   openhat  shaker  deg0  deg1  deg2  deg3 deg4  deg5  deg6
        └──────────── 6 drums ────────────┘        └──────── 7 chord degrees ────────┘
```

### `accents` — `[6 sections][6 drums]` of masks

Exactly **6** sections. Each is **6** drum masks `[kick, snare, clap, hat, openhat, shaker]`.
A set bit marks that step as accented (louder). Optional.

### `melodies` — `[6 sections][notes]` of tuples

Exactly **6** sections. Each is a list of note tuples. A tuple has **exactly 4** entries:

```
[ pitch, start, length, velocity ]
   │       │       │        └ velocity %, 30–130
   │       │       └ length in steps, 1–16
   │       └ start step, 0–15
   └ pitch (MIDI), 48–83  (C3–B5)
```

### `mixer` — `[≤8 channels]` of strips

Channel order `[kick, snare, hats, bass, chords, melody, vocals, sample]`. Each strip is
**9** numbers:

```
[ vol, pan, mute, solo, lo, mid, hi, rev, dly ]
   │    │    │     │     │   │    │    │    └ delay send 0–100
   │    │    │     │     │   │    │    └ reverb send 0–100
   │    │    │     │     └───┴────┴ EQ low/mid/high, −12…+12 dB
   │    │    │     └ solo 0/1
   │    │    └ mute 0/1
   │    └ pan −100…+100
   └ volume 0–140
```

### `effects` — 4 numbers

```
[ delayTimeMs (60–700), delayFeedback% (0–70), reverbSize% (0–100), compression% (0–100) ]
```

### `arrangement` — 32 slots

Exactly **32** bars. Each slot is a section index `0`–`5`, or `null` for an empty bar.

## Loading behaviour

Aura loads defensively: unknown/future keys are ignored, out-of-range numbers are clamped,
and a file that fails to parse or is missing its song data is rejected with a readable
message — the current project is never left half-changed. The strict schema above is the
*correctness contract* used by tooling and the fixture tests; the in-app loader is the more
lenient real-world reader.

See [`fixtures/`](fixtures/) for the regression corpus and the in-browser validator.
