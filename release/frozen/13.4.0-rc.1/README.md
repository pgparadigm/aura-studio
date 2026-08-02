# Frozen digests — 13.4.0-rc.1

`release/` is in `.gitignore`, so the artefacts themselves are not committed. This directory is
force-added past that rule for one reason: **a hash record is only worth anything if it was written
before the thing it describes could change.**

`SHA256SUMS.txt` was written immediately after the artefacts were built and verified, by a writer
that computes every digest twice with two independent implementations (`hashlib` and `shasum`) and
**refuses to emit** on disagreement or a zero-byte read. That guard is not theoretical: a plain
`shasum | tee` once produced `e3b0c442…` — the SHA-256 of empty input — for two files that `ls`
showed as 641 KB and 1.1 MB, and it was not reproducible on retry.

Byte reproducibility was verified by running `make-release.py` twice and comparing all three
archive digests across both passes. They were identical.

To check the artefacts later:

    cd release && shasum -a 256 -c frozen/13.4.0-rc.1/SHA256SUMS.txt

The 13.3.0-rc.1 record in the sibling directory is unchanged, and was re-verified twice during this
release — once before the version identifiers moved, and once after the 13.4 build completed.

## Correction — these digests replace an earlier set

The first record was taken from a build whose tree was **DIRTY**; the manifest of that build says so
itself (`tree: DIRTY — 1 file(s)`). Every archive entry is stamped with the *commit's* date rather
than the clock, precisely so one commit rebuilds to one set of bytes — which means a dirty-tree
build could never be reproduced from any commit at all. The record looked authoritative and was not
verifiable.

Rebuilt from the clean commit `24cd42f`, verified reproducible by two consecutive builds, and
re-recorded. **The product did not change:** all 21 entries inside the product archive were checked
byte-identical to the runtime files that passed the 17/17 sequential regression. What moved is the
wrapper's embedded timestamp, not the app.

Reproduce with:

    git switch --detach 24cd42f && python3 make-release.py
    cd release && shasum -a 256 -c frozen/13.4.0-rc.1/SHA256SUMS.txt
