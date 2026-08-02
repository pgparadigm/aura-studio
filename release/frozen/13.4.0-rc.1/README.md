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
