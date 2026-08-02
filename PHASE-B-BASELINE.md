# Phase B baseline — the exact state 13.5 branches from

Recorded before `v13.5-capcut-music-workflow` was created. Nothing below may be altered by Phase B
unless a compatibility test proves a genuine defect in the shared source.

## Source

| | |
|---|---|
| Final 13.4 source commit (runtime) | `1c7f2068affb52ff5e1f59196e6b68b1b23c6e28` — what the manifest names |
| Reproducible build commit | `24cd42fd6d226e297b630f80c330f56168b46a75` — first CLEAN commit that rebuilds the artefacts |
| Branch head at freeze | `a968816912e36d27f6f1c447100cd8201b5e9c3f` |
| Branch | `v13.4-futuristic-design` |
| Branch-only commits | 93 |

The manifest names `1c7f206` but records `tree: DIRTY — 1 file(s)`, so that commit alone cannot
rebuild the archives. Every runtime file — `index.html`, `styles.css`, `app.js`, the five
`knowledge/*.js` modules and `site.webmanifest` — is **byte-identical** across `1c7f206`,
`ba08c06` and `24cd42f`. **Phase B branches from `a968816`**, which carries that
identical runtime plus the verifiable frozen record.

## 13.4.0-rc.1 artefacts

| artefact | bytes | sha256 |
|---|---|---|
| `aura-studio-13.4.0-rc.1.zip` | 682004 | `e7b274cfa479f17d2d68e3dbe87ccd14c2efcb1ce4c17e098f66b015e97b2ff1` |
| `aura-studio-13.4.0-rc.1-public-source.zip` | 956727 | `2a0d7cd67c0877737e51de752b3c80e43cabc10917b81e4c964a197360ce8e12` |
| `aura-studio-13.4.0-rc.1-source.zip` | 18452884 | `5b02760300ccbf4fbce072b531a095f784f4fdbdbba16d03fd81884a80566bd3` |
| `aura-studio-13.4.0-rc.1-manifest.txt` | 6863 | `5bfb32dc46e31ef941f2c89e44a1282da101969e6e8c3888cc7a40db5eaf789e` |
| `RELEASE-NOTES-13.4.0-rc.1.md` | 10309 | `dfb5e9aa3d9fa770e14db72a6d319e087ef3a628faf59e73e45b7ea17b5fcd4e` |

Verified with `shasum -a 256 -c release/frozen/13.4.0-rc.1/SHA256SUMS.txt` → all five OK.

## Frozen 13.3 assets — must remain byte-identical

    c2187a53c82ab220e9ba3a7157830caa5cd3f684a3ea4242d81c9e26461ecf15  aura-studio-13.3.0-rc.1.zip
    2018b5dfd528cec1980d5fdf833d5946e9d9cb2acf79cd8feedfe58b87f408db  aura-studio-13.3.0-rc.1-public-source.zip
    d2b36a8a6fbeca206b2a87b8002a74fac9e0ce7cada9bae4953f2c07a28808ab  aura-studio-13.3.0-rc.1-source.zip
    33eec2d9aae58af8b22c52a58bb14c3b2842f921131e3dff5120c4add14a2888  aura-studio-13.3.0-rc.1-manifest.txt
    8248626eaefe26fccc667768c6728057426fd2f661657dda82171e3c035e3130  RELEASE-NOTES-13.3.0-rc.1.md

## Git state that must not move

| | |
|---|---|
| `main` | `2d70dde4b9cd747d5532e8aa1bf9e3d9e68a6ade` |
| `origin/main` | `2d70dde4b9cd747d5532e8aa1bf9e3d9e68a6ade` |
| tag `v13.3.0-rc.1` | `fc668f9f814d8c839710e3d582d562a264fa1fde` |
| tags present | v10-mixer v12-live v13.0.0 v13.0.1 v13.0.2 v13.0.3 v13.2.0-rc.1 v13.3.0-rc.1 v9-live  |
| deployed | `main` = 13.3.0-rc.1. 13.4.0-rc.1 is NOT deployed. |

## Verification carried forward

Sequential `run-all`: **17/17 at recorded baseline**. `validate.py` **13/13**.
design-13.4-qa **186/186** · layout **17 viewports / 0 findings** · a11y **37/37** (structure only).
