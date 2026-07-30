# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand

| | |
|---|---|
| Branch | `v13.2-import-rebuild` |
| HEAD | `b8e7482` — *six sonic families, and a correction to the layout audit's method* |
| Working tree | clean |
| `APP_VERSION` | `13.2.0` |
| `SCHEMA_VERSION` | `2` (unchanged, and must stay 2) |
| Release status | **in progress** — not a release candidate yet |

### Commit chain on this branch

```
b8e7482  six sonic families, and a correction to the layout audit's method
fb3a918  vocal balance, layout audit, separation decision, optional engine
46e3e36  sampler: make a sound, chop it, build a section
6d95f86  tooling: repository-local server, durable state file
8e76719  v13.2.0 import & rebuild: measured percussion, one panel, safe applies
834deee  v13.2 import: local reconstruction engine — Path 1 foundation      [approved, do not rewrite]
df20bbd  v13.1 singer: Phase 4 — phone singer workflow                      [approved, do not rewrite]
dc505db  v13.1 singer: Aura visual identity and browser-icon family         [approved, do not rewrite]
```

Frozen and untouched: `main` / `origin/main` at `eda8f69`, tag `v13.0.3`, `v14-dev`, `v14-experimental`,
the live deployment. Nothing has been pushed, merged, tagged or deployed.

---

## How to run anything

Everything is repository-local. **Never edit a file outside this repository to run the tests.**

```bash
python3 serve.py            # http://127.0.0.1:8791, serves this repo, loopback only
```

| What | Where | Expected |
|---|---|---|
| App | `/index.html` | mounts, zero console output |
| Reconstruction engine suite | `/fixtures/import-qa.html` | timing F **0.909**, lane recall **0.865**, mislabel **0**, 15/19 fixtures |
| Apply / undo / discard suite | `/fixtures/apply-safety.html` | **21/21** |
| Responsive layout | `/fixtures/layout-audit.html` | 12 widths x 6 views + Vibes panel |
| Optional engine | `python3 aura-engine/server.py` | health reports `shipsWeights:false` |
| Schema | `python3 fixtures/validate.py` | **12/12** |
| Schema, real export | `python3 fixtures/validate.py RT-schema-final.aura` | PASS |

`.claude/launch.json` in this repo points at `serve.py`. The Browser-pane `preview_start` tool resolves
`launch.json` from the PARENT directory, not this one, so it cannot use it — start `serve.py` and open
`http://127.0.0.1:8791/` as a URL instead. Do not "fix" this by editing the parent config.

---

## Completed and verified

**Reconstruction engine** (`8e76719`) — timing and instrument identity measured separately; six emitted
lanes over the existing six drum ids; broad Percussion basin with *Needs review* and one-tap
reassignment; per-band presence tests with thresholds read off measured distributions; groove-window
voting; kit-presence gate so a drumless recording produces nothing. Measured against 19 generated
fixtures: onset timing F 0.909 (P 0.835, R 0.997) at ±35 ms, lane recall 0.865 (160/185), confident
mislabels 0 of 44, soft-vs-loud bit-identical, 15/19 fixtures fully passing, slowest analysis 664 ms.

**Panel hierarchy** — one title. `Vibes` → description → *Start with a vibe* / *Import a song* →
`Start here` → `All vibes` → `Your recording` (only when a file exists).

**Imported reference card** — name, duration, format, channels, rate, size, waveform, play-as-recorded
on its own un-warped `BufferSource`, level, include-in-track, replace, re-analyse, compare, balance,
remove. No control on it is ever disabled.

**A/B compare** — Your recording / Aura's version / Both, as a live multiplier on existing group gains,
never written into `mix[]`. Level-matched against one bar rendered through the export graph.

**Quick balance** — six rows over existing groups, two of them macros writing proportionally into real
`mix[].vol`. No new schema field.

**Apply safety** — Replace clears every lane and accent; Fill Empty destroys nothing; one Apply is one
undo checkpoint via `oneCheckpoint()`; Discard leaves the project byte-identical. 21/21 verified.

**Export privacy** — the imported recording is **muted on arrival** (`mix.sample.mute=1`), because
`scheduleSample()` renders into the offline export graph as well as the live one.

---

## Next task

1. Re-run the responsive sweep at 834-1440 under the corrected (transition-frozen) method and clear
   the 5 remaining findings at 768: a 803px-wide element pushing the page, the inspector toggle
   pushed off, a 22px-wide control, an 11px label, and a clipped vibe tile with the panel open.
   NOTE: the harness stalls after 3-4 widths in one page — run them in batches of three with a fresh
   page each, and close the previous AudioContext (already done in __auraLayoutPrepare).
3. Media decode matrix; analysis cancellation and Worker-failure handling.
4. Then: docs refresh, release-candidate version, SHA-256 artifacts.

---

## Open gates

| Gate | State |
|---|---|
| Ye dossier | **complete** — 6 studies, 138-row source table, 611 labelled claims, all 42 audit corrections applied |
| Ye dossier: 6 open research actions | **carried forward** — see below; each needs web access, none blocks the product |
| Responsive sweep | 320-640 report **zero**; 768 has 5 minor findings, 834-1440 not re-run under the corrected method |
| Media decode matrix | not built |
| Analysis cancellation / Worker failure | not built |
| Lead-vs-backing via a model | **blocked by licensing** — no licence-clean model exists; the DSP tier ships instead |
| Physical devices (Safari, iOS, Android, touch, screen readers) | never run, no hardware |

---

## Open research actions (dossier)

Six audit corrections were applied with a stated limitation because the assembly pass ran with no web
access. Each is flagged inline in `research/YE-PRODUCTION-RESEARCH.md` and listed in its OPEN ACTIONS
section. None blocks the product; all are traceability, not substance.

1. Recover the *Electronic Musician* (2004, Ken Micallef) print interview — the varispeed quote is
   currently reached only through a gear-journalism page that returned HTTP 403.
2. Recover the offline Concrete Loop interview (Oct 2007) from a web archive — it is the origin of
   nearly every first-person claim about CS-2's drum and synth strategy.
3. Recover the canonical *Complex* URL for the BULLY credits; currently read via a Yahoo syndication
   mirror, and the 2026-06-19 deluxe credits have not been examined at all.
4. Recover the *Rolling Stone* byline for the CS-5 listening-party report.
5. Re-read the Ken Lewis / Studio Talks source: one characterisation was published and propagated,
   with the 2026-07-28 page date recorded as a scrape artefact, but the re-read was not performed.
6. Attempt archive.org snapshots for the dead primaries (Concrete Loop, RWD, Reuters); those rows
   currently read "no snapshot retrieved" rather than guessing.

Four Saint Pablo revision-timeline rows carry no outlet anywhere in the table and are marked
`[Unverified - excluded]` rather than given an invented attribution. Leave them that way unless a
source is found.

---

## Decisions that must not be reopened

- `.aura` stays at `SCHEMA_VERSION` 2 and `serialize()` returns exactly its 25 keys. No analysis
  result, no media byte, ever reaches a project file, a share link or `localStorage`.
- Timing confidence and instrument confidence are never averaged into one number.
- One Aura pattern is one bar. A multi-bar progression takes one chord per section slot.
- Band energies are mean magnitude per bin, not sums — the bands differ in width by ~40×.
- `famPresent` thresholds came from measured distributions. Re-measure before changing a band edge.
- The imported recording is muted on arrival and only an explicit control includes it in the export.
- No control is disabled at rest; render it when it can act, remove it when it cannot.
- No separation claim in user-visible copy. The promise is: *Aura creates an editable reconstruction
  from what it can hear. Review and adjust the result.*
- `window.__auraRebuild` is a deliberate frozen read-only QA surface. Removing it silently disables the
  only way to measure the shipped engine.
- The browser app must stay fully usable with no local engine installed.
- **Aura ships no model weights.** Demucs' own author excluded its weights from MIT. No licence-clean
  lead/backing model exists. See `aura-engine/MODEL-LICENSES.md`.
- **Never implement REPET** — US9093056B2 is active until 2033 and its reference implementation is
  MIT-licensed, which grants copyright and not patents.
- **Freeze transitions before measuring layout.** A throttled or mid-transition frame reports a
  transform's START value and will invent bugs that do not exist; `fixtures/layout-audit.html` injects
  `transition:none !important` for exactly this reason.
- No artist, album or song name in anything a user can see.
- External configuration is clean: `Projects/.claude/launch.json` restored to its original 525 bytes.
