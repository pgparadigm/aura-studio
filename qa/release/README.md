# Releasing a /rc/ build

The procedure every `/rc/` release follows. The root build (`index.html`, `app.js`, `styles.css` at the repository
root, 13.6.0-rc.3) is never touched. Each tool prints what it examined and exits non-zero on anything unexpected.

1. **Baseline, once per machine:** the f304607 build, outside any temporary folder:
   `mkdir -p ~/.local/share/aura-qa/base-f304607 && git archive f304607 rc | tar -x -C ~/.local/share/aura-qa/base-f304607`
2. **Tests first:** the stage's new tests fail on the current build in both engines; a mutant that puts the bug back
   fails them again after the fix.
3. **Full regression from a frozen copy:**
   `node qa/run.cjs --snapshot --base-root ~/.local/share/aura-qa/base-f304607 --out <file>.json > <file>.txt`
   The bar: zero failures and zero errors in Chromium and WebKit; the only allowed NOT RUN is `e12RealRecord` in
   WebKit (no synthetic microphone). `e2ExportGraph`, `e1Saved` and `e2ExportJitter` must pass.
4. **Version:** `qa/release/bump.py OLD NEW --check`, then without `--check`; commit; `git push origin HEAD:main`.
5. **Live files:** `qa/release/livehash.sh <commit> <dir>` until every `rc/` file is identical (Pages takes ~30 s).
6. **Live load:** `node qa/release/liveseen.cjs <new rc version> 13.6.0-rc.3`.
7. **Live tests:** `node qa/run.cjs --base https://pgparadigm.github.io/aura-studio --jobs <suite> --only <stage>`;
   audio on the live bytes: `node qa/run.cjs --rc-root <dir from step 5> --base-root ~/.local/share/aura-qa/base-f304607 --jobs e --only e2ExportJitter`.
8. **Record:** a `docs/CHANGELOG.md` entry, and the handoff entry in the project's system record (kept outside this
   repository): `qa/release/handoff-update.py --shard <path> --expect <hash read just before> --version V --commit C --entry <file>`.

On any failure at any step: revert the release and stop.
