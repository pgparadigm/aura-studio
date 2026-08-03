# Phase B RC1 baseline — the frozen 13.6.0-rc.1 checkpoint

Recorded before `v13.6-capcut-workflow-complete` was created. (The tree reads "dirty" to a
naive check only because this file is itself being written; nothing else is modified.) Every value below was measured
from the repository, not carried forward from a previous report.

## Source

| | |
|---|---|
| Branch | `v13.5-capcut-workflow-complete` |
| Clean administrative HEAD | `7665dfe40d2fe8f48f77147c76e38d5226dc7926` |
| **Reproducible source commit** | `72900aad3d7f1fc38f4498b4b34a4627b11ff43c` |
| Working tree | clean apart from this file — 0 other change(s) |

### Which commit actually produced the artefacts — proven, not assumed

The report named `7665dfe` as the clean administrative state. **It is not the source commit.**
`make-release.py` stamps every archive entry with the *commit's* date, so the archive itself
carries the identity of the commit that built it. Read back from
`aura-studio-13.6.0-rc.1.zip`:

    archive entry stamp: (2026, 8, 3, 14, 31, 44)

| commit | commit date (UTC) | stamps this archive? |
|---|---|---|
| `9bd8bb2` | 2026-08-03 14:19:13 | no |
| `72900aa` | 2026-08-03 14:31:45 | **YES** |
| `7f7ce93` | 2026-08-03 14:38:16 | no |
| `7665dfe` | 2026-08-03 14:39:16 | no |

ZIP stores seconds at two-second resolution, so an odd commit second reads back one lower —
comparing raw seconds makes every candidate look wrong, which is what a first pass did.
Corrected for that, exactly one commit matches: **`72900aa`**, whose own manifest records
`tree: CLEAN`. No other commit can reproduce these bytes, because no other commit has that
timestamp.

### Administrative commits after the source commit

Two, and they are documentation and release-record only:

- `7665dfe AURA-STATE: 13.6.0-rc.1 verified and frozen`
- `7f7ce93 13.6.0-rc.1 frozen — and a release record that a branch point had un-written`

Files they touch:

- `AURA-STATE.md`
- `release/frozen/13.4.0-rc.1/README.md`
- `release/frozen/13.4.0-rc.1/SHA256SUMS.txt`
- `release/frozen/13.5.0-rc.1/README.md`
- `release/frozen/13.5.0-rc.1/SHA256SUMS.txt`
- `release/frozen/13.6.0-rc.1/README.md`
- `release/frozen/13.6.0-rc.1/SHA256SUMS.txt`

**All 21 runtime files hash identically at `72900aa` and at HEAD**, so the artefacts
describe the runtime at HEAD exactly.

## 13.6.0-rc.1 artefacts

| artefact | bytes | sha256 |
|---|---|---|
| `aura-studio-13.6.0-rc.1.zip` | 703,507 | `ea466916f9c2b01ddca2a8a3a13af975106b6008ada0553e4929f406bb7cc21b` |
| `aura-studio-13.6.0-rc.1-public-source.zip` | 993,162 | `05dc5d7d0c59ac029da0141bd7ef362bab619e67f248df2f1b82a638858317c5` |
| `aura-studio-13.6.0-rc.1-source.zip` | 18,493,646 | `029f4bca69051c56fe0e8f9987da4af95c1a009a9fdfb90352cb86a2e62fce9c` |
| `aura-studio-13.6.0-rc.1-manifest.txt` | 7,780 | `dfc246b732d1a1114afd1bbe23851547be85c43986e132b5491cab73866d13ec` |
| `RELEASE-NOTES-13.6.0-rc.1.md` | 6,716 | `6095ce666f1e2d8f87397dc2e1b3e1d826f83e51731af21a6b6287d40a00ab2a` |

Preserved read-only in `release/frozen/13.6.0-rc.1/artefacts/`; the **copies** were verified
against the same `SHA256SUMS.txt` and pass.

## All four frozen records — by authoritative exit code

| record | `shasum -a 256 -c` exit | verdict |
|---|---|---|
| `13.3.0-rc.1` | 0 | VERIFIED |
| `13.4.0-rc.1` | 0 | VERIFIED |
| `13.5.0-rc.1` | 0 | VERIFIED |
| `13.6.0-rc.1` | 0 | VERIFIED |

Exit code, not a grep count: an earlier pass counted matching lines and reported 3/5 and
0/5 for records that were in fact intact or simply absent from the branch. The exit code
cannot be miscounted.

Full digests for every record are in `release/frozen/<version>/SHA256SUMS.txt`.

## Git state that must not move

| | |
|---|---|
| `main` | `2d70dde4b9cd747d5532e8aa1bf9e3d9e68a6ade` |
| `origin/main` | `2d70dde4b9cd747d5532e8aa1bf9e3d9e68a6ade` |
| tag `v13.3.0-rc.1` | `fc668f9f814d8c839710e3d582d562a264fa1fde` |
| tags present | v10-mixer v12-live v13.0.0 v13.0.1 v13.0.2 v13.0.3 v13.2.0-rc.1 v13.3.0-rc.1 v9-live |
| pushed | nothing — `origin/main` equals `main` |
| deployed | nothing since 13.3.0-rc.1 |

## Verification carried forward

Sequential `run-all`: **PASS — 18/18 at recorded baseline**. `validate.py` **13/13**.
take-qa **56/56** · export-qa **28/28** · design-13.4-qa **186/186** ·
layout-audit **17 viewports / 0 findings** · a11y **37/37** (structure only) ·
music-knowledge **95/95** · persistence **43/43**.

The product artefact was extracted, served under a real `/aura-studio/` subpath and driven:
**7 requests, all local, zero external**.

## What this checkpoint is NOT

A verified **intermediate** candidate. The 18/18 sequential result proves the *implemented*
surface is stable across suites. It does **not** prove the whole requested Phase B scope
exists. The principles have reached the take and the arrangement; they have **not** reached
the imported reference or the Sound workspace, and other systems from the approved scope
remain unimplemented.
