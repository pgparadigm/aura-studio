# AURA-STATE

Durable handoff for the next session. Operational, not a diary. Update after every commit.

---

## Where things stand

| | |
|---|---|
| Branch | `v13.2-import-rebuild` |
| HEAD | `26e3abc` — *export-privacy gates measured against the export* (see chain below) |
| Working tree | clean |
| `APP_VERSION` | `13.2.0-rc.1` |
| Cache-busters | all eight unified to `?v=13.2.0-rc.1` |
| `SCHEMA_VERSION` | `2` (unchanged, and must stay 2) |
| `serialize()` | exactly **25 keys** |
| Release status | **locally complete release candidate** — physical devices are the only open gate |

### Commit chain on this branch

```
26e3abc  export-privacy gates measured against the export, not a neighbouring bin
a3d1fa1  docs, reports and the 13.2.0-rc.1 freeze
a09e984  end-to-end suite: four family controls that did nothing, and an export privacy proof
2217572  approximate vocal balance, measured — and two real defects it found
2d5ed92  cancellation and failure isolation: nothing an interruption leaves behind
2a3368f  media decode matrix: fourteen fixtures through the real import path
d107103  responsive audit at 17 viewports, and no artist name in the shipped app
e3f2e88  state: carry the dossier's six open research actions forward
a42bdfb  Ye production research dossier, and layout fixes at 768 and above
b8e7482  six sonic families, and a correction to the layout audit's method
fb3a918  vocal balance, layout audit, separation decision, optional engine
46e3e36  sampler: make a sound, chop it, build a section
6d95f86  tooling: repository-local server, durable state file
8e76719  v13.2.0 import & rebuild: measured percussion, one panel, safe applies
834deee  v13.2 import: local reconstruction engine — Path 1 foundation   [approved, do not rewrite]
df20bbd  v13.1 singer: Phase 4 — phone singer workflow                   [approved, do not rewrite]
dc505db  v13.1 singer: Aura visual identity and browser-icon family      [approved, do not rewrite]
```

Frozen and untouched: `main` / `origin/main` at `eda8f69`, tag `v13.0.3`, `v14-dev`,
`v14-experimental`, the live deployment. **Nothing has been pushed, merged, tagged or deployed.**

---

## How to run anything

Everything is repository-local. **Never edit a file outside this repository to run the tests.**

```bash
python3 serve.py            # http://127.0.0.1:8791, serves this repo, loopback only, threaded
```

| What | Where | Expected |
|---|---|---|
| App | `/index.html` | mounts, zero console output |
| Reconstruction engine | `/fixtures/import-qa.html` | timing F **0.9091**, lane recall **0.8649**, mislabel **0**, 15/19 |
| Apply / undo / discard | `/fixtures/apply-safety.html` | **21/21** |
| Responsive layout | `/fixtures/layout-audit.html` | **17 viewports, 0 findings** (`__auraLayoutSweep(4)`) |
| Media decode | `/fixtures/media-decode.html` | **13 of 14 as specified**, OGG not generatable |
| Cancellation | `/fixtures/cancel-safety.html` | **13 pass, 3 N/A** |
| Vocal balance | `/fixtures/vocal-qa.html` | **all 6 gates pass** |
| End to end | `/fixtures/endtoend-qa.html` | **38/38** |
| Release artefacts | `python3 make-release.py` | writes `release/`, refuses on a tracked secret/weight or an artist name in a shipped file |
| Schema | `python3 fixtures/validate.py` | **12/12** |
| Schema, real export | `python3 fixtures/validate.py RT-schema-final.aura` | PASS |
| Media fixtures | `python3 fixtures/make-media-fixtures.py` | writes 9 files to `fixtures/media/` |
| Optional engine | `python3 aura-engine/server.py` | health reports `shipsWeights:false` |

**Do not replace the suites' Worker-backed timers with `setTimeout`.** A hidden tab pauses `rAF` and
throttles chained timers to ~1/minute after five minutes; that measured unfitted layouts and produced
one spurious apply-safety failure before it was understood.

---

## Completed and verified in this pass

- **No artist, album or song name in the shipped runtime.** Two vibe tiles were labelled with an
  artist's name and a third with an album title; ten `app.js` comments named albums and songs.
  `grep -Ei "kanye|yeezy|..." app.js index.html styles.css` returns nothing. `KANYE-CODEX.md` moved
  to `research/PRODUCTION-CODEX-2025.md`, marked pre-audit and superseded.
- **Responsive: 17 viewports, zero findings**, width and height, including a landscape phone.
- **Media decode differentiated by content**, not by filename regex. Eight distinct failure reasons.
- **Cancellation**: `impJob` generation counter checked at every await; 13 paths byte-identical.
- **Vocal balance measured**: lead suppression -59.1 dB median, wide-instrumental damage -0.0 dB,
  Full-mix recombination -132.5 dBFS, mono and low-width both refused.
- **All 30 family controls write real project data** — four did not and were fixed.
- **Export privacy measured**, not asserted: a 1234.5 Hz probe tone is absent from an Aura-only
  export and present when deliberately included.

---

## Next task

The locally achievable work is finished. What remains needs hardware:

1. Work `DEVICE-CHECKLIST.md` on a real iPhone, iPad, Android device and desktop Safari.
   **49 rows, none of them run.** Rows 34 and 46 settle OGG, the one format the automated matrix
   could not generate.
2. Only after that: tag and deploy, which needs explicit approval and the word `SHIP`.

---

## Open gates

| Gate | State |
|---|---|
| Physical devices (iPhone, iPad, Android, desktop Safari, VoiceOver, TalkBack) | **open — never run, no hardware.** `DEVICE-CHECKLIST.md` |
| OGG decode | **untested** — not generatable in this browser, no encoder on this machine. Not a known failure |
| Lead-vs-backing via a model | **blocked by licensing** — no licence-clean model exists; the DSP tier ships instead |
| Ye dossier: 6 open research actions | carried forward, each needs web access, none blocks the product |
| Deployment | not done, not approved |

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

- `.aura` stays at `SCHEMA_VERSION` 2 and `serialize()` returns exactly its 25 keys. No analysis
  result, no media byte, ever reaches a project file, a share link or `localStorage`.
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
