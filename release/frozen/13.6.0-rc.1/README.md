# Frozen digests — 13.6.0-rc.1

`release/` is in `.gitignore`. This directory is force-added past that rule because a hash record is
only worth anything if it was written before the thing it describes could change.

Reproducible from commit `72900aa`, verified by running `make-release.py` twice and comparing all
three archive digests across both passes.

    cd release && shasum -a 256 -c frozen/13.6.0-rc.1/SHA256SUMS.txt

`artefacts/` holds a read-only copy of the five files, taken after the digests and verified against
the same record.

## The rule, applied

**A digest is only true if nothing is edited after it is taken.** The 13.4 record was wrong twice
for that reason — once from a dirty tree, once because the release notes were edited after their
hash was recorded. For 13.6 the notes were written and committed FIRST, and the digests were the
final action.

`shasum -a 256 -c` was then run against all four records — 13.3, 13.4, 13.5 and 13.6 — before this
file was written.

## A branch point can revert a release record

This branch was cut from `921ac5d`, which PREDATES the commits that wrote the 13.5 record and
corrected the 13.4 one. Those files are tracked (force-added past `.gitignore`), so checking out the
earlier commit **removed the 13.5 record and reverted the 13.4 one** — `shasum -c` then reported
13.5 as *no such file* and 13.4 as 3/5.

Nothing was lost. The artefacts themselves are untracked, so they survived untouched, and the
records were restored from `v13.5-capcut-music-workflow`. But it is worth knowing: **branching from
an earlier commit can silently un-write a release record**, and the only reason this was caught is
that the check was run rather than assumed.
