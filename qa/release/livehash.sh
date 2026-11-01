#!/bin/bash
# Every rc/ file in COMMIT against the bytes GitHub Pages serves at /rc/. Prints each difference and a count of what
# was examined. Fails loudly: a fetch that fails or returns anything but 200 counts as different. rc/.nojekyll is a
# Pages control file that 404s by design and is skipped by name.
#   usage: qa/release/livehash.sh COMMIT OUTDIR      (OUTDIR receives the live bytes under OUTDIR/rc/)
#   exit 0 only when every file is identical
C="$1"; OUT="$2"
[ -n "$C" ] && [ -n "$OUT" ] || { echo "usage: $0 COMMIT OUTDIR"; exit 2; }
SITE="${AURA_SITE:-https://pgparadigm.github.io/aura-studio}"
REPO="$(cd "$(dirname "$0")" && git rev-parse --show-toplevel)" || { echo "NOT IN A GIT CHECKOUT"; exit 2; }
git -C "$REPO" rev-parse --verify -q "$C^{commit}" >/dev/null || { echo "NO SUCH COMMIT: $C"; exit 2; }
mkdir -p "$OUT" || { echo "CANNOT CREATE $OUT"; exit 2; }
n=0; same=0; bad=0; skipped=0
while IFS= read -r f; do
  n=$((n+1)); rel="${f#rc/}"
  if [ "$rel" = ".nojekyll" ]; then skipped=$((skipped+1)); continue; fi
  want=$(git -C "$REPO" show "$C:$f" | shasum -a 256 | cut -c1-64)
  mkdir -p "$OUT/rc/$(dirname "$rel")"
  code=$(curl -s -m 30 -o "$OUT/rc/$rel" -w '%{http_code}' "$SITE/rc/$rel?nocache=$RANDOM$RANDOM")
  got=$(shasum -a 256 "$OUT/rc/$rel" | cut -c1-64)
  if [ "$code" = "200" ] && [ "$want" = "$got" ]; then same=$((same+1)); else bad=$((bad+1)); echo "DIFF $f http=$code"; fi
done < <(git -C "$REPO" ls-tree -r --name-only "$C" rc/)
echo "examined $n files in $C:rc/ against $SITE/rc/ — identical $same, different $bad, skipped $skipped (.nojekyll)"
[ "$n" -gt 0 ] || { echo "EXAMINED NOTHING: not a pass"; exit 1; }
[ "$bad" = 0 ]
