# Frozen digests — 13.5.0-rc.1

`release/` is in `.gitignore`, so the artefacts themselves are not committed. This directory is
force-added past that rule because a hash record is only worth anything if it was written before the
thing it describes could change.

`SHA256SUMS.txt` is written by a writer that computes every digest twice with two independent
implementations (`hashlib` and `shasum`) and **refuses to emit** on disagreement or a zero-byte read.

Reproducible from commit `921ac5d`, verified by running `make-release.py` twice and comparing all
three archive digests across both passes.

    cd release && shasum -a 256 -c frozen/13.5.0-rc.1/SHA256SUMS.txt

## The rule this release learned twice

**A digest is only true if nothing is edited after it is taken.** The 13.4 record was wrong twice
for that reason — once because it was taken from a dirty tree, and once because the release notes
were edited after their hash was recorded. Both were caught by *running the check* rather than
trusting it, and both are written up in `../13.4.0-rc.1/README.md`.

For 13.5 the digests were recorded as the final action, after every hashed file had stopped
changing. `shasum -c` was then run against all three records — 13.3, 13.4 and 13.5 — and all
fifteen entries verified OK.
