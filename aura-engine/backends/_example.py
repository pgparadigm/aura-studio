"""Aura engine backend — the interface, and a worked example that does nothing.

Copy this file, name it after your model, and fill in `available()` and `separate()`.

Aura ships NO weights and downloads none. `available()` must return False unless the weights are
actually present on this machine, because the browser uses that flag to decide whether to offer the
feature at all — and offering a control that cannot work is worse than not offering it.

Read ../MODEL-LICENSES.md before you point this at anything. In particular: the field's default model
has weights its own author excluded from its MIT licence, and there is no licence-clean model for
separating a lead vocal from backing vocals. You are responsible for having the right to use whatever
you install here.
"""

NAME = "example"
DESCRIPTION = "Interface example. Never available; does nothing."
LICENCE_NOTE = "Ships nothing. See ../MODEL-LICENSES.md before installing any model."


def available() -> bool:
    """True only when this backend can actually run right now.

    Check BOTH the runtime dependency and the weight file. Returning True without weights makes the
    browser offer a control that then fails, which is the failure mode this flag exists to prevent.
    """
    return False


def separate(job, in_path, want):
    """Write the requested stems into job.dir as WAV files and record them in job.stems.

    job     - has .dir, .cancel (threading.Event), .progress (0..1) and .message
    in_path - the singer's audio, already on disk inside job.dir
    want    - list of stem names from the closed set in server.py: instrumental, lead, backing,
              drums, bass, other, full

    Contract:
      * check `job.cancel.is_set()` regularly and return promptly when it is set
      * update `job.progress` and `job.message` so the browser can show real progress
      * write ONLY inside job.dir — the server erases that directory and nothing else
      * do not phone home, do not write outside the job directory, do not keep the input
    """
    raise NotImplementedError("example backend does nothing by design")
