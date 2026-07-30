# Local engine — security boundary

**Audited 2026-07-30 against `aura-engine/server.py` (409 lines) at `13.2.0-rc.1`.**

`aura-engine/` is an **optional, removable** helper for people who want to run a separation model on
their own machine. It is **not installed, not started and not contacted by default**. Delete the
directory and Aura Studio is unchanged in every respect.

This document states the boundary precisely, because a local HTTP server is the one component in this
project that could plausibly become an attack surface.

---

## What it is, and what it is not

| | |
|---|---|
| Ships model weights | **No.** None. See `aura-engine/MODEL-LICENSES.md` |
| Downloads anything | **No.** It never fetches, and has no package manager step |
| Requires an account, key or licence | **No** |
| Sends telemetry | **No** |
| Reachable from another device | **No** — see binding, below |
| Required for the browser app | **No.** The app is fully functional without it |
| Approved for cloud use | **No.** Cloud processing is explicitly not approved |

---

## The controls, and where each is enforced

**1. Loopback only.** The listener binds `("127.0.0.1", port)` — never `0.0.0.0`, never a LAN address
(`server.py:402`). Another machine on the same network cannot reach it. This is the single most
important control and it is a one-line, checkable fact:

```bash
grep -n '0\.0\.0\.0' aura-engine/server.py    # expected: no matches
```

**2. Origin checking.** CORS is answered only for a loopback origin (`server.py:256`): the check is
`host in ("127.0.0.1", "localhost")`. A page on the open internet cannot drive the engine from a
visitor's browser, because its origin will not match.

**3. Temporary jobs are erased.** Each job gets its own directory under the system temp root, and it
is removed with `shutil.rmtree` when the job ends (`server.py:92`) and again when the server shuts
down (`server.py:237`). Nothing a singer submits is left behind after the job that used it.

**4. No execution of submitted data.** There is no `eval`, no `exec`, and no shell invocation of
user-supplied strings. The server moves bytes into a temp directory, hands them to a backend module
you chose, and moves the result back.

**5. You supply the model.** `aura-engine/backends/_example.py` is a 43-line template showing the
interface. Aura does not download a model, does not bundle one, does not verify one, and cannot grant
you any rights to one. If you place a model there, satisfying yourself on its licence — code, weights
*and* training data, which are three separate questions — is your responsibility.
`aura-engine/MODEL-LICENSES.md` records the audit that found **no licence-clean lead-versus-backing
model exists**, so that a future session does not repeat the search and reach a different answer by
being less careful.

---

## Residual risks, stated plainly

- **Any process on your own machine can reach a loopback port.** Loopback binding stops the network;
  it does not stop other software running as you. This is inherent to a local helper and is the
  reason it is opt-in and removable rather than always-on.
- **A backend you install runs with your privileges.** Aura does not sandbox it. Treat a model
  backend the way you would treat any other code you choose to run.
- **The engine has not been penetration-tested.** It has been read and audited against the controls
  above. That is not the same thing, and it is not claimed to be.

---

## What is NOT tested here

The cancellation suite (`fixtures/cancel-safety.html`) records three checks as **not applicable**
rather than passed, because claiming otherwise would be false: the browser app has no Worker, and
creates no temporary files or jobs. Worker termination, Worker exception and temp-job cleanup belong
to this engine, and the engine's own teardown path is verified by reading the two `rmtree` call sites
above — not by an automated test. An automated test of the engine would need a model to drive it, and
there is no licence-clean model to ship.
