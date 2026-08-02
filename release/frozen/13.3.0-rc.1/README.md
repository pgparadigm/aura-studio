# Frozen 13.3.0-rc.1 artefact hashes

Recorded before v13.4 touched `APP_VERSION`, because `make-release.py` names every artefact from
that constant: building at a v13.4 HEAD while it still said `13.3.0-rc.1` would have written v13.4
source into archives named 13.3.0-rc.1 and overwritten the deployed release's artefacts.

`SHA256SUMS.txt` is the authority. Verify from `release/`:

```bash
shasum -a 256 -c frozen/13.3.0-rc.1/SHA256SUMS.txt
```

Source of truth for the release itself: tag `v13.3.0-rc.1` → commit `fc668f9`.
Both archives are byte-reproducible from that commit.

## Read this before trusting any hash you compute here

The first attempt at this file recorded TWO of the five hashes as
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` — which is the SHA-256 of
**empty input** — for files that `ls` simultaneously reported as 641 KB and 1.1 MB. Three
independent tools (`shasum`, `openssl dgst`, Python `hashlib`) then agreed on the real values, and
the fault did not reproduce across a controlled retry with and without a preceding write and with
and without `tee`. So it was a transient bad read, not a property of any particular command shape.

It would have been invisible: a plausible-looking 64-hex string in a file nobody re-derives.

**Therefore every hash written for a release here is computed twice, by two implementations, and
the writer refuses to emit the file if the two disagree or if any input reads as zero bytes.** That
guard is what caught this. Apply the same rule to the 13.4 artefacts and to any byte-reproducibility
claim — a hash asserted from one computation is not evidence.
