# S0 — release tools that survive (task plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the four release helpers live in the repo and the f304607 baseline lives outside `/tmp` and iCloud, so a
wiped temp folder can no longer take the release procedure with it (it did between 2026-09-26 and 2026-10-20).

**Architecture:** four small command-line tools under `qa/release/`, each failing loudly (non-zero exit, a line
saying what was examined) and each with a check mode that writes nothing. No change to `rc/`, so no release.

**Tech stack:** bash 3.2, Python 3, Node 24 + playwright-core at `~/.local/share/aura-qa/node_modules/playwright-core`.

**Spec:** `docs/superpowers/plans/2026-10-25-aura-north-star.md` (S0).

## Global constraints

- No personal paths and no reference to the private system record in committed files: paths are arguments.
- Every tool is proven both ways: it passes on the real state, and it FAILS on a constructed bad state. A tool that
  has only been seen passing is not trusted (TDD does not fit release tooling run against a live site; this is the
  substitute, said here rather than skipped silently).

### Task 1: the baseline outside /tmp

- [ ] `mkdir -p ~/.local/share/aura-qa/base-f304607 && git archive f304607 rc | tar -x -C ~/.local/share/aura-qa/base-f304607`
- [ ] Verify every file: for each path in `git ls-tree -r --name-only f304607 rc/`, the SHA-256 of
  `git show f304607:<path>` equals the extracted file's. Expected: N examined, N identical, 0 missing.
- [ ] Constructed failure: the same check against `9787568` must report differences.

### Task 2: `qa/release/bump.py OLD NEW [--check]`

- [ ] Counts `OLD` in `rc/index.html` (must be 13) and `rc/app.js` (must be 1, the `APP_VERSION` line); refuses if
  either count is wrong or `NEW` is already present; `--check` reports and writes nothing.
- [ ] Prove: `--check 13.8.0-rc.16 13.8.0-rc.17` → counts 13 and 1, exit 0. Constructed failure:
  `--check 13.8.0-rc.15 13.8.0-rc.17` → exit 1, counts 0.

### Task 3: `qa/release/livehash.sh COMMIT OUTDIR`

- [ ] Every `rc/` file in COMMIT against the live bytes (`rc/.nojekyll` skipped by name: a Pages control file that
  404s by design); a failed fetch counts as different; prints examined/identical/different; exit 1 on any difference.
- [ ] Prove: `9787568` → 21/21 identical, exit 0. Constructed failure: `18771b8` → differences, exit 1.

### Task 4: `qa/release/liveseen.cjs RC_VERSION ROOT_VERSION`

- [ ] A real browser in Chromium and WebKit loads the live `/rc/` and root and reads the `app.js?v=` it asked for
  and the `APP_VERSION` in the bytes it received; exit 1 unless both engines see both expected versions.
- [ ] Prove: `13.8.0-rc.16 13.6.0-rc.3` → exit 0. Constructed failure: `13.8.0-rc.15 13.6.0-rc.3` → exit 1.

### Task 5: `qa/release/handoff-update.py --shard PATH --expect HASH --version V --commit C --entry FILE [--check]`

- [ ] Refuses unless the shard's SHA-256 prefix equals HASH (it changed since it was read) and its status line is
  found; rewrites the status line to V = C and appends the entry; `--check` verifies and writes nothing.
- [ ] Prove: `--check` with the current hash → OK, nothing written (hash unchanged after). Constructed failure: a
  wrong hash → exit 1.

### Task 6: `qa/release/README.md` and commit

- [ ] The release procedure in order, using these tools (no personal paths).
- [ ] Commit locally (`qa/release/`, the north-star spec and roadmap, this file). **Not pushed** until Philip's typed go.
