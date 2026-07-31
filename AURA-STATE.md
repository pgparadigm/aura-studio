# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand

| | |
|---|---|
| Branch | `v13.3-complete-studio` (new work) |
| HEAD | `c430394` — *editable low-end reconstruction* |
| Working tree | clean |
| `APP_VERSION` | `13.2.0-rc.1` (not yet bumped for 13.3) |
| `SCHEMA_VERSION` | `2` — unchanged. `serialize()` is now **26 keys**: the v13.2 twenty-five plus `lo` |
| Release status | **in progress** — 2 of 11 planned commits done |

### LIVE, and not to be touched by this work

`main` `e20155f` serves https://pgparadigm.github.io/aura-studio/ at `13.2.0-rc.1`.
Source of that release: `v13.2-import-rebuild` `3c4759b`, tag `v13.2.0-rc.1`.
**No deployment is authorised during this pass.** The previous RC stays online as-is.

### Commit chain on v13.3-complete-studio

```
c430394  editable low-end reconstruction, generated from the analysis
6b73976  import paths named, and a tempo decision before Apply
3c4759b  <- branched from the frozen 13.2.0-rc.1 source
```

---

## What is DONE in this pass

1. **Three named import paths** — Analyze only / Rebuild with Aura / Adjust the original.
   Rebuild is the default. Analyze renders **zero** Apply buttons and mutates nothing.
2. **Tempo decided before Apply** — detected / keep / half / double / another. Every Apply calls
   `applyChosenTempo()` first, inside the same checkpoint. Fixed the live defect where analysis
   read 100 BPM and the reconstruction applied at a stale 140.
3. **Low-end analysis + original bass part** — `detectLowEnd()`, section-aware generation, editable
   note chips, `lo` schema key. 10/10 low-end fixtures, 19/19 Path B lifecycle.

## What is NOT done — the remaining 9 commits

3. **Add as variation** — the third Apply mode. Does not exist yet (`grep variation` = 0 hits).
   Needs: named variations, compare/switch/promote/delete, per-part apply, one-op-one-undo,
   backwards-compatible schema.
4. Path B lifecycle + export polish
5. **DJ controller** — Web MIDI (confirmed available, secure context), capability states,
   MIDI Learn, local mappings with import/export, virtual-MIDI QA harness
6. **Perform view** + live-arrangement recording
7. **Aura Guide** — offline rules-based, context-aware, action cards, confirmation safety.
   Must NOT be called generative AI. Optional AI layer documented as unavailable.
8. Guide action safety + confirmation
9. Responsive (11 viewports) + accessibility on all new UI
10. Persistence + schema migration fixtures
11. QA, documentation, release-candidate artefacts

---

## Test commands for this branch

```bash
python3 serve.py
```

| Suite | Expected |
|---|---|
| `/fixtures/pathb-qa.html` | **10/10 low-end fixtures, 19/19 lifecycle** |
| `/fixtures/import-qa.html` | timing F **0.9091**, lane recall **0.8649**, mislabels **0**, 15/19 |
| `/fixtures/apply-safety.html` | **21/21** |
| `/fixtures/endtoend-qa.html` | 38/38 (key check now expects 26) |
| `python3 fixtures/validate.py` | 12/12 |

---

## Traps that cost real time in this pass — do not rediscover them

- **Aura's own boot pushes 2 undo checkpoints.** `hist.past.length===0` never means "fresh".
  `histBaseline` is captured at the end of init; measure against that.
- **The live app keeps autosaving.** Clearing `localStorage` while it runs is overwritten, and the
  reload restores the old project. Blank the frame, THEN clear, THEN load.
- **`rbapply` means "writes to the project".** `Find melody ideas` is analysis and uses `rbfind`.
- **Bass lives in `sub` (30-120 Hz), not `sub`+`low`.** A pad's bottom notes are 120-180 and will
  register as bass if you include that band.
- **Sustain must be a ratio, not time-above-half-the-rise.** Under a kick the rise is the kick.
- A `const` name that already exists in a harness function is a silent parse failure: the whole
  script never runs and the page just sits at "not run" with an empty console.

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
6. Attempt archive.org snapshots for the dead primaries (Concrete Loop, RWD, Reuters).

Four Saint Pablo revision-timeline rows carry no outlet anywhere in the table and are marked
`[Unverified - excluded]` rather than given an invented attribution. Leave them that way.

---

## Decisions that must not be reopened

- `.aura` stays at `SCHEMA_VERSION` 2. `serialize()` grew from the v13.2 twenty-five keys by
  ADDITIVE, backwards-compatible fields only — `lo` (13.3 low end) and `var` (13.3 variations).
  Absence of either is normal and means the pre-13.3 behaviour. No analysis result, no media byte,
  ever reaches a project file, a share link or `localStorage`.
- Timing confidence and instrument confidence are never averaged into one number.
- One Aura pattern is one bar. A multi-bar progression takes one chord per section slot.
- Band energies are mean magnitude per bin, not sums — the bands differ in width by ~40×.
- `famPresent` thresholds came from measured distributions. Re-measure before changing a band edge.
- The imported recording is muted on arrival and only an explicit control includes it in the export.
- `MIN_MEDIA_SECONDS` exists because `decodeAudioData` returns 2 ms for a truncated file and calls it
  success. Do not remove it.
- The vocal mask uses the **real part** of `L·conj(R)`. The magnitude cannot tell +1 from -1, so
  anti-phase material scored as dead centre and was destroyed. Do not revert to the magnitude.
- Every named family control must change real project data. `endtoend-qa.html` enforces it.
- No control is disabled at rest; render it when it can act, remove it when it cannot.
- No separation claim in user-visible copy. The promise is: *Aura creates an editable reconstruction
  from what it can hear. Review and adjust the result.*
- `window.__auraRebuild`, `__auraMediaProbe`, `__auraVocal`, `__auraSuite` and `__auraSettleNow` are
  deliberate frozen read-only QA surfaces. There is no Node here; removing them silently disables the
  only way to measure the shipped build.
- The browser app must stay fully usable with no local engine installed.
- **Aura ships no model weights.** Demucs' own author excluded its weights from MIT. No licence-clean
  lead/backing model exists. See `aura-engine/MODEL-LICENSES.md`.
- **Never implement REPET** — US9093056B2 is active until 2033 and its reference implementation is
  MIT-licensed, which grants copyright and not patents.
- **Freeze transitions before measuring layout**, and force `__auraSettleNow` rather than waiting on
  `rAF` — a throttled or mid-transition frame invents bugs that do not exist.
- No artist, album or song name in anything a user can see, **or in any shipped runtime file**.
- External configuration is clean: `Projects/.claude/launch.json` restored to its original 525 bytes.
