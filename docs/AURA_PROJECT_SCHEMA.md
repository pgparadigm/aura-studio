# Aura Studio project file (`.aura`) — schema reference

A `.aura` file is JSON. The **top level is human-readable**; the nested arrays inside `project` stay **positional**
(compact) for size. This document defines every index, tuple position, channel order, range and bitmask rule. The
machine-checkable version is [`aura-project.schema.json`](aura-project.schema.json) (JSON Schema draft-07), and
`qa/dashboard-n.qa.js` (`n6SchemaValid`) checks that the files the `/rc/` build writes match it.

Restored on 2026-11-03 from the July version (removed from the site root on 2026-07-30) and brought up to schema 5;
schema 6 since 13.9.0-rc.17.
Imported audio is **never** stored in a project file or a share link. Vocal takes are stored in a file only when the
project has them (schema 4; at 24-bit, schema 6); share links never carry audio.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `format` | string | Always `"aura-project"`. Any other value is not an Aura file. |
| `schemaVersion` | integer | The **lowest reader version** that can open the file without losing anything (see below). |
| `appVersion` | string | Semantic version of the Aura build that wrote the file, e.g. `"13.9.0-rc.2"`. Informational. |
| `projectId` | string | Stable project identity: a UUID (`crypto.randomUUID()`) where available, else an `aura_…` id. |
| `name` | string | Display name. |
| `createdAt` | string | ISO-8601. Set once, when the `projectId` is first minted. |
| `updatedAt` | string | ISO-8601. Refreshed on every save. |
| `capabilities` | object | What this build of Aura **supports**: an object of booleans, so new keys are added explicitly. |
| `mediaPersistence` | object | What **this file** embeds (see below). |
| `content` | object | What is actually in **this** project (see below). Symmetrical with `capabilities`. |
| `encoding` | object | Human note describing the compact layouts, plus `schemaRef` (`"aura-project.schema.json"`). |
| `note` | string | Says whether vocal takes are inside; imported audio never is. |
| `media` | object | Only when vocal takes are inside: `vocalTakes`, a list of takes (see below). |
| `project` | object | The song state, with readable field names (see below). |

### Version fields, disambiguated

- **`schemaVersion`**: the on-disk *format*, written as the **minimum** a reader must understand, not the newest the
  writer knows. Aura refuses a file whose number is above the one it reads (5 in the `/rc/` build).

  | Value | Written when the file holds |
  |---|---|
  | 2 | the base song: drums, chords, bass, melody, arrangement, mixer |
  | 3 | any of `lowEnd`, `variations`, `performance`, a changed `groove`, `lyrics`, `intention`, or a drawn `energy` curve |
  | 4 | vocal takes (`media.vocalTakes`) |
  | 5 | a section's own Warmth (`project.energy.w`), since 13.9.0-rc.2 |
  | 6 | vocal takes stored at 24-bit, since 13.9.0-rc.17 (a reader before it cannot read them, so it refuses the file) |

- **`appVersion`**: which Aura *build* wrote the file. Purely informational; never gates loading.
- **`project.internalStateVersion`**: the compact-state migration counter shared with the browser autosave and share
  links. Used only to migrate older state shapes. Files from the earlier schema-2 build used the name `stateVersion`;
  Aura still accepts it on read.

### `mediaPersistence` and `media`

```json
"mediaPersistence": { "vocalTakesEmbedded": true, "importedAudioEmbedded": false }
```

- **`vocalTakesEmbedded`** is `true` exactly when the file carries takes in `media.vocalTakes` (schema 4 and up).
- **`importedAudioEmbedded`** is always `false`: an imported instrumental is a reference that stays on the device.
- **`media.vocalTakes`**: one entry per take: `track` (`vocals` for Lead, `double`, `harmony`), `name`, `sampleRate`,
  `channels` (new takes are mono; old stereo takes still open), `length` (samples per channel), `head` (seconds before
  the song's start), `clips` (the take's clips on the timeline), `seq`, and `wav` (the take as a base64 PCM WAV: 24-bit in schema 6,
  16-bit in the files rc.12 to rc.16 wrote, which still open).

### `content` flags (symmetrical with `capabilities`)

Computed from actual state: `hasDrums`, `hasChords`, `hasBass`, `hasMelody`, `hasArrangement`, `hasMixerOverrides`,
`hasVocalTakes`, `hasImportedAudio`, `hasLowEnd`, `hasVariations`, `hasPerformance`, `hasGroove`, `hasLyrics`,
`hasIntention`, all booleans. `hasImportedAudio` describes the app, not the file: the audio itself is never inside.

## `project` — song state

Scalars:

| Field | Type | Range / values |
|---|---|---|
| `keyIndex` | integer | `0`–`11` (semitone, C=0) |
| `mode` | string | `major` · `minor` · `dorian` · `phrygian` · `harmonicMinor` |
| `tempo` | number | `60`–`160` BPM |
| `swing` | number | `0`–`60` |
| `reverb` | number | `0`–`100` |
| `chordSound` | string | `pad` · `piano` · `soul` · `pluck` (the track card's Sound menu: Pad, E-Piano, Soft Rhodes, Nylon) |
| `bassSound` | string | `sub` · `808` |
| `melodySound` | string | `lead` · `pluck` · `keys` · `pad` · `bell` · `b808` |
| `chordVolume` `bassVolume` `masterVolume` `melodyVolume` | number | `0`–`100` |
| `countIn` `autoFill` | integer | `0` or `1` |
| `currentSection` | integer | `0`–`5` |
| `sectionNames` | string[] | ≤ 6 names, ≤ 14 chars each |
| `drumVolumes` | integer[] | 6 values, per-drum bus volume × 100 |
| `mutes` | object | `{ id: 1 }` for muted buses |

### The bitmask rule (patterns & accents)

A step lane is a **16-bit integer**. Bit *s* (value `1 << s`) set = step *s* is active, for `s = 0 … 15`. Examples:
`1` = step 0 only; `4369` = `0x1111` = steps 0, 4, 8, 12 (four on the floor); `65535` = all 16 steps.

### `patterns` — `[6 sections][13 lanes]` of masks

Exactly **6** sections. Each section is **13** lane masks, in this order:

```
index:  0     1      2     3     4        5       6     7     8     9    10    11    12
lane:   kick  snare  clap  hat   openhat  shaker  deg0  deg1  deg2  deg3 deg4  deg5  deg6
        └──────────── 6 drums ────────────┘        └──────── 7 chord degrees ────────┘
```

### `accents` — `[6 sections][6 drums]` of masks

Exactly **6** sections. Each is **6** drum masks `[kick, snare, clap, hat, openhat, shaker]`. A set bit marks that
step as accented (louder). Optional.

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

Channel order `[kick, snare, hats, bass, chords, melody, vocals, sample]`. Each strip is **9** numbers:

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

### Blocks added after schema 2

| Field | Shape | Notes |
|---|---|---|
| `lowEnd` | array, one entry per section | The editable low-end reconstruction. Schema 3 when any section has one. |
| `variations` | `{ activeId, main, items }` | Alternate versions of the song. Schema 3 when any exist. |
| `performance` | `{ events, enabled }` | Recorded performance events and whether they play. Schema 3 when any exist. |
| `groove` | `{ c, s, sf }` | Groove controls, seed and source. Schema 3 when changed from the defaults. |
| `lyrics` | `{ t, n }` | The singer's words (`t`) and notes (`n`) per section. Text only. Schema 3 when any. |
| `intention` | object of strings | What the record is trying to be (`feeling`, `subject`, `motif`, …). Schema 3 when any is set. |
| `energy` | `{ t, p, s, w }` | The dashboard's energy intent, written only once the singer has used it (see below). |

### `energy` — `{ t, p, s, w }`

- **`t`**: the drawn target curve, one value per bar, `0`–`100`.
- **`p`**: per section index, its Shape values `[intensity, warmth, movement, space]`, each `0`–`100`. The warmth slot
  is not read since 13.9.0-rc.2 (see `w`).
- **`s`**: song-wide `[warmth, room, echo]`, each `0`–`100`. Room and echo have had no control since 13.9.0-rc.2; they
  are kept as written.
- **`w`** (schema 5): per section index, that section's own Warmth, `0`–`100`, **only where it differs from `s[0]`**.
  A section without one plays the song's Warmth, which is how a file from before 13.9.0-rc.2 opens with its Warmth in
  every section. From each such section's first bar, the chords channel's high and low shelves lean away from the
  mixer's setting by 0.16 dB and 0.1 dB a point.

## Loading behaviour

Aura loads defensively: unknown or future keys are ignored, out-of-range numbers are clamped, and a file that fails to
parse or is missing its song data is rejected with a readable message; the current project is never left half
changed. The schema is the *correctness contract* used by tooling and the checks; the in-app loader is the more lenient
real-world reader.
