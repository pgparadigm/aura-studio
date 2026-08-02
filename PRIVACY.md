# Aura Studio — privacy

**Verified 2026-08-02 against `13.5.0-rc.1`.** Every claim below is either a property of the source
that can be checked with `grep`, or a measurement produced by a suite in `fixtures/`. Where something
is a design intention rather than a measured fact, it says so.

Re-verified for this release rather than carried forward: `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, `EventSource` and `serviceWorker` each appear **zero** times in the runtime, and there
are **zero** absolute `http(s)://` URLs once comments are stripped. `fetch(` appears twice and both
are comments explaining why it is not used — it fails on `file://`, and Aura has to work after being
downloaded. The Ask Aura conversation gained a context header and a history disclosure in 13.4; both
are built at render time from the open project and neither is persisted, so the "memory only / never
leaves" row below is unchanged and still asserted by `fixtures/guide-qa.html`.

**13.5 adds take editing and adds nothing to this page.** Shaping a take produces an edit list —
where each part starts and ends, its level, its fades, its speed. That list describes positions
inside a recording that is itself memory-only, so it is kept in memory beside it and is never
written to a project file. `fixtures/take-qa.html` asserts that no clip data appears in
`serialize()` or in a saved `.aura` file, and that the recording's own samples are byte-for-byte
unchanged after editing. The table below therefore gains one row and loses none.

---

## The short version

Your recordings, your imported songs and your projects stay on your device. Aura has no account, no
server, no analytics and no network calls of any kind. It cannot send your music anywhere because it
never asks the network for anything.

---

## What is stored, and where

| What | Where it lives | Survives a reload? | Ever leaves the device? |
|---|---|---|---|
| The project (patterns, chords, melodies, arrangement, mixer) | `localStorage`, and `.aura` files you save | yes | only if **you** save or share a file |
| A recorded vocal take | memory only (`vocalBuffer`) | **no** | never |
| An imported song or video | memory only (`smp.buf`) | **no** | never |
| A sound you recorded or generated in the Sound tab | memory only | **no** | never |
| The reconstruction Aura maps from an import (`imp`) | memory only | **no** | never |
| Which mode you last used, recent project names | `localStorage` | yes | never |
| Your controller mappings (which knob does what) | `localStorage`, key `aura-midi-maps` | yes | never |
| Kept performance moves | inside the project, as normalised Aura actions | yes | only if **you** save or share |
| An Ask Aura conversation | memory only | **no** | never |
| How you shaped a take (parts, fades, levels, speed) | memory only, beside the recording | **no** | never |
| Your lyrics and performance notes | inside the project, as text | yes | only if **you** save or share |
| Project intention | inside the project, as six short strings | yes | only if **you** save or share |
| Groove settings and the Idea Code | inside the project | yes | only if **you** save or share |
| Rights & Sources manifest | written into a complete export, on your disk | yes | **never transmitted** |

**Audio is never written to storage.** Not to `localStorage`, not to a `.aura` file, not to a share
link, not to a project export. There is no IndexedDB. This is asserted three ways:

- `serialize()` returns exactly **31 keys** and none of them is an audio key. Checked by
  `fixtures/endtoend-qa.html`. The three added in 13.3 — `lo`, `var`, `perf` — hold generated
  notes, alternate musical states and normalised action names. The three added by the music-knowledge
  work — `gv`, `ly`, `pi` — hold control values, the words you typed, and six short strings about
  what the record is trying to be. No sample, no buffer, no bytes.
- The `.aura` format carries a `mediaPersistence` block whose two flags are both false, and
  `fixtures/validate.py` **fails** a file that embeds media (`embedded-media.aura`, expect=fail).
- `fixtures/endtoend-qa.html` imports a file, then searches the project, the recent-projects list,
  the autosave and a project export for any trace of it. Result: none.

Closing the tab discards every recording and every import. That is the cost of never storing them,
and it is deliberate.

---

## The export

The imported reference is **muted the moment it arrives** (`mix.sample.mute = 1`). This is not
cosmetic. `scheduleSample()` renders into the *offline export graph* as well as the live one, so
anything audible is inside the WAV a singer exports. An import that arrived audible would put someone
else's copyrighted recording into a file the singer believes is theirs.

Measured, not asserted: `fixtures/endtoend-qa.html` imports a 1234.5 Hz tone — a frequency none of
Aura's synth voices can produce — and renders through the real export graph.

| Export | Energy at the probe frequency |
|---|---|
| Aura-only, reference as it arrives | `8.96e-6` (export RMS `0.344`) — absent |
| Reference deliberately included | rises by orders of magnitude — present, as asked |
| After the reference is removed | `4.01e-5` — absent |

Turning it **on** is tested as well as turning it off. A control that cannot include the reference
would be a different lie, and would stop a singer making the track they asked for.

---

## Network

Aura makes **no network requests**. There is no CDN, no external font, no telemetry endpoint, no
model download, no error reporter.

```bash
grep -nE "https?://" app.js index.html styles.css   # no absolute URLs in any runtime file
```

There is no service worker on the shipping line. "Offline" here means **no network calls and no
account**. It does *not* mean the app survives a hard reload with no connection — say it precisely.

---

## What Aura never does

- No account, no sign-in, no email address.
- No analytics, no telemetry, no crash reporting, no fingerprinting.
- No audio fingerprint of your import is computed, stored or transmitted.
- Your media is never used to train anything.
- No cloud processing of any kind is approved or implemented.

### Specifically, from the features added in 13.3

- **Ask Aura is not a generative AI model** and is never described as one. It is a fixed set of
  answers about controls Aura actually has, running on your device. Nothing you type is sent
  anywhere, because there is nowhere to send it. The conversation is held in memory, is **not**
  written to `localStorage` by default, and never enters a `.aura` file. Closing the sheet or the
  tab discards it.
- **A controller tells Aura nothing about itself that Aura keeps.** Mappings record the message
  Aura should listen for — type, number, channel — and the Aura action it runs. No manufacturer,
  no model, no serial number, no device id, no permission state is stored, and none of it goes
  into your project file. Raw MIDI is never recorded; a kept take stores normalised action names.
- **Performance recording captures what you did, not what you played it on.** `perf` holds
  `[time, action, value]` triples for Aura's own 22 actions. Three of those actions — record, undo
  and redo — are never captured and never replayed, because replaying `record` would arm the
  microphone from a shared project.
- **Rights & Sources never leaves your machine.** The manifest is written into a complete export as
  a local file. Aura has no endpoint to send it to and makes no network request of any kind.
- **The complete export excludes the imported reference by default.** You can deliberately include
  a reference you hold rights to; the default is exclusion, and the README in the bundle says so.

---

## The optional local engine

`aura-engine/` is **optional, removable, and not installed by default**. The browser app is fully
functional without it and never checks for it unless you ask.

- Binds `127.0.0.1` only — never `0.0.0.0`. It is not reachable from another device on the network.
- No account, no key, no telemetry.
- Ships **no model weights**. See `aura-engine/MODEL-LICENSES.md`.
- Temporary job files are erased when the job ends.

See `LOCAL-ENGINE-SECURITY.md` for the boundary in full.

---

## Verifying any of this yourself

```bash
python3 serve.py
```

Then open `/fixtures/endtoend-qa.html` and press the button. It imports a file and then goes looking
for it in every place a leak could occur. You do not have to take this document's word for it.
