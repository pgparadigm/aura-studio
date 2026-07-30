# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand

| | |
|---|---|
| Branch | `v13.2-import-rebuild` |
| HEAD | `1a1f7f8` — *tooling: repository-local server, durable state file* |
| Working tree | clean |
| `APP_VERSION` | `13.2.0` |
| `SCHEMA_VERSION` | `2` (unchanged, and must stay 2) |
| Release status | **in progress** — not a release candidate yet |

### Commit chain on this branch

```
1a1f7f8  tooling: repository-local server, durable state file
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

Continue the plan in section 20 of the standing brief, in order. Item 1 is this commit.

---

## Open gates

| Gate | State |
|---|---|
| Ye production research dossier | running — `research/YE-PRODUCTION-RESEARCH.md` not yet written |
| Six original sonic families | not started — depends on the research translation |
| From-scratch sampler workflow | not started |
| Separation model + licence audit | running — `research/AURA-SEPARATION-DECISION.md` not yet written |
| Optional local engine `aura-engine/` | not started — blocked on the licence decision |
| Lead-vs-backing / adlib workflow | not started — blocked on the licence decision |
| Responsive audit at 320px | not run since the card and balance surfaces were added |
| Media decode matrix | not built |
| Physical devices (Safari, iOS, Android, touch, screen readers) | never run, no hardware |

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
