#!/usr/bin/env python3
"""After a push: point the system record's Aura status line at the new /rc/ version and append a dated release entry.
The record lives outside this repository; its path is an argument. Refuses unless the file is byte-for-byte what was
last read (its SHA-256 prefix equals --expect), so another writer's change is never overwritten blind.

usage: qa/release/handoff-update.py --shard PATH --expect HASH16 --version V --commit C --entry FILE [--check]
       (--check verifies the hash and the status line and writes nothing)
"""
import hashlib, re, sys

STATUS = re.compile(r"^- \*\*Status \(2026-09-26, read the HANDOFF section at the end of this shard first[^\n]*", re.M)

def opt(argv, k):
    return argv[argv.index(k) + 1] if k in argv and argv.index(k) + 1 < len(argv) else None

def main(argv):
    shard, want, ver, commit, entry = (opt(argv, k) for k in ('--shard', '--expect', '--version', '--commit', '--entry'))
    check = '--check' in argv
    if not shard or not want or (not check and not (ver and commit and entry)):
        print(__doc__.strip()); return 2
    b = open(shard, 'rb').read(); h = hashlib.sha256(b).hexdigest()[:16]
    print(f'shard {len(b)} bytes, hash {h}, expected {want}')
    if h != want:
        print('REFUSED: the shard changed since it was last read; re-read it, then retry'); return 1
    s = b.decode('utf-8'); m = STATUS.search(s)
    if not m:
        print('REFUSED: status line not found'); return 1
    if check:
        print('check only: hash matches, status line found at offset', m.start(), '— nothing written'); return 0
    line = (f"- **Status (2026-09-26, read the HANDOFF section at the end of this shard first, then the release entries after it):** "
            f"live — root **13.6.0-rc.3**, `/rc/` **{ver} = `main` `{commit}`** (read from the wire at publish: every `rc/` file identical, "
            f"`APP_VERSION` {ver}). Built from the dev clone `~/Code/aura-studio` and its worktrees in `~/Code/aura-studio-worktrees` (outside iCloud, "
            f"since 13.9.0-rc.3); the iCloud copies under `★ Studio` are not where work happens.")
    s = s[:m.start()] + line + s[m.end():]
    e = open(entry, encoding='utf-8').read()
    s = (s if s.endswith('\n') else s + '\n') + e
    open(shard, 'w', encoding='utf-8').write(s)
    print('written, hash now', hashlib.sha256(s.encode()).hexdigest()[:16]); return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
