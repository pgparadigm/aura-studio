#!/usr/bin/env python3
"""
Aura Studio — atomic deploy to GitHub via the Git Data API.

Pushes index.html, styles.css, app.js, README.md and CHANGELOG.md in ONE commit,
directly to a branch. No paste, no web editor, no build step. Reliable because it
uses the same API GitHub Desktop and `gh` use under the hood.

USAGE
  1. Create a fine-grained Personal Access Token at
     https://github.com/settings/tokens?type=beta
     - Repository access: only pgparadigm/aura-studio
     - Permissions: Contents -> Read and write
  2. Run:
     GH_TOKEN=github_pat_xxx python3 deploy.py
     (add  --branch deploy-v13  to open a PR branch instead of pushing to main)

It verifies each file's SHA-256 after upload and prints the new commit hash.
"""
import base64, hashlib, json, os, sys, urllib.request

REPO   = "pgparadigm/aura-studio"
FILES  = ["index.html", "styles.css", "app.js", "README.md", "CHANGELOG.md"]
MSG    = "v13: spatial hierarchy, Aura Datafield, split into index/styles/app + release-gate hardening"
API    = "https://api.github.com"

def die(m): print("ERROR:", m); sys.exit(1)

tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
if not tok: die("set GH_TOKEN (a fine-grained PAT with Contents:read+write on the repo)")

branch = "main"
if "--branch" in sys.argv: branch = sys.argv[sys.argv.index("--branch")+1]

def req(method, path, body=None):
    url = path if path.startswith("http") else API+path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer "+tok, "Accept": "application/vnd.github+json",
        "User-Agent": "aura-deploy", "X-GitHub-Api-Version": "2022-11-28"})
    try:
        with urllib.request.urlopen(r) as resp: return json.load(resp)
    except urllib.error.HTTPError as e:
        die(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}")

here = os.path.dirname(os.path.abspath(__file__))
local = {}
for f in FILES:
    with open(os.path.join(here, f), "rb") as fh: local[f] = fh.read()

# 1. base commit + tree of the target branch
ref  = req("GET", f"/repos/{REPO}/git/ref/heads/{branch}") if branch=="main" else None
if branch != "main":
    main_ref = req("GET", f"/repos/{REPO}/git/ref/heads/main")
    base_sha = main_ref["object"]["sha"]
    # create branch if missing
    try: req("POST", f"/repos/{REPO}/git/refs", {"ref": f"refs/heads/{branch}", "sha": base_sha})
    except SystemExit: pass
    ref = req("GET", f"/repos/{REPO}/git/ref/heads/{branch}")
base_commit_sha = ref["object"]["sha"]
base_commit = req("GET", f"/repos/{REPO}/git/commits/{base_commit_sha}")
base_tree = base_commit["tree"]["sha"]

# 2. blobs
tree = []
for f in FILES:
    blob = req("POST", f"/repos/{REPO}/git/blobs",
               {"content": base64.b64encode(local[f]).decode(), "encoding": "base64"})
    tree.append({"path": f, "mode": "100644", "type": "blob", "sha": blob["sha"]})

# 3. tree -> commit -> move ref
new_tree = req("POST", f"/repos/{REPO}/git/trees", {"base_tree": base_tree, "tree": tree})
commit   = req("POST", f"/repos/{REPO}/git/commits",
               {"message": MSG, "tree": new_tree["sha"], "parents": [base_commit_sha]})
req("PATCH", f"/repos/{REPO}/git/refs/heads/{branch}", {"sha": commit["sha"], "force": False})

print("Pushed commit:", commit["sha"])
print("Branch:", branch)

# 4. verify each file's content hash on the remote
print("\nVerifying remote content:")
ok = True
for f in FILES:
    meta = req("GET", f"/repos/{REPO}/contents/{f}?ref={branch}")
    remote = base64.b64decode(meta["content"])
    a, b = hashlib.sha256(remote).hexdigest(), hashlib.sha256(local[f]).hexdigest()
    match = a == b
    ok = ok and match
    print(f"  {'OK ' if match else 'BAD'} {f}  {a[:16]}")
print("\nAll files verified." if ok else "\nMISMATCH — investigate before trusting the deploy.")
if branch != "main":
    print(f"\nOpen a PR: https://github.com/{REPO}/compare/main...{branch}")
else:
    print(f"\nLive shortly at: https://pgparadigm.github.io/{REPO.split('/')[1]}/")
