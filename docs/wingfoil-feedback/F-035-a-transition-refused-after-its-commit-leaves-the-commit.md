---
id: F-035
title: "A transition refused by its post-commit scope check still leaves its commit on the branch"
kind: defect
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-30.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in scratch repositories made with `wingfoil init --template Kanban --no-interactive`,
one member holding `developer` and `approver`, tasks added and submitted with the CLI. This is the
part of F-025 that WingFoil bug-217 (`memory add` leaves its document staged when its commit
fails) does not name.

**A failing commit is now atomic for `submit`, `approve` and `reject`.** With a `pre-commit` hook
that exits 1 (run on `submit`, `approve` and `reject`), a `commit-msg` hook that exits 1 (`submit`)
or a stale `.git/index.lock` (`submit`, `approve`), the verb exits 1 with `E_COMMIT_FAILED: git did
not commit <path>: … — nothing was committed, and the working tree and the index are as they were`
(the `index.lock` case quotes git's message), and indeed `HEAD` is unchanged, `git status
--porcelain` is empty and the element keeps its state. (A failing `post-commit` hook does not fail
the verb: exit 0, the commit made.)

**A refusal after the commit is not.** WingFoil checks the commit's scope after making it, and when
the check fails it exits 1 but leaves the commit. Two triggers, neither needing anything unusual
from the user:

1. A `pre-commit` hook that edits the element file and stages it (a formatter, a header updater) —
   no index flag involved:

   ```
   $ cat .git/hooks/pre-commit
   #!/bin/sh
   f=docs/memory/task/task-001-login-form.md
   echo "hook edit" >> "$f"
   git add -- "$f"
   $ git rev-parse --short HEAD        → 0fcbeac
   $ wingfoil memory approve task-001-login-form --reason ok --format json
   {"error":"commit 45c064b5309cafabaf38783fe2d2960597aaaccd carries more than the change it declares: the body changed although this operation does not own it"}
   [exit 1]
   $ git rev-parse --short HEAD        → 45c064b
   $ git log -1 --format=%s            → wf(task): approve task-001-login-form [pending → approved]
   $ git show HEAD -- docs/memory/task/task-001-login-form.md   → -status: pending, +status: approved, +hook edit
   $ git status --porcelain            → MM docs/memory/task/task-001-login-form.md
   ```

   The commit carries the hook's edit; the index is left without it (`git diff --cached`:
   `-hook edit`) and the working tree with it (`git diff`: `+hook edit`).

2. An edit `git status` does not show (`git update-index --assume-unchanged`, or `core.ignoreStat`):

   ```
   $ git update-index --assume-unchanged -- docs/memory/task/task-002-t-b.md
   $ echo "hidden edit" >> docs/memory/task/task-002-t-b.md
   $ git rev-parse --short HEAD        → fb2ce03
   $ wingfoil memory approve task-002-t-b --reason ok --format json
   {"error":"commit d7ff7ec1dd06f18fc8a70bd6c71db9fdefc4c975 carries more than the change it declares: the body changed although this operation does not own it"}
   [exit 1]
   $ git rev-parse --short HEAD        → d7ff7ec
   $ git log -1 --format=%s            → wf(task): approve task-002-t-b [pending → approved]
   $ grep -m1 '^status:' docs/memory/task/task-002-t-b.md   → status: approved
   ```

   This is the trigger of F-023 (W-28), which reports the hidden edit being committed. F-035 is
   related to it, not a duplicate: it reports the broader late refusal that is not atomic, whatever
   made the commit carry more than declared.

In both cases the verb reports a refusal (exit 1) while its commit — an approval, with the extra
change in it — stays on the branch, and the element is `approved`. A client that trusts the exit
code shows the approval as not made, and `git push` publishes it.

## Expected

A transition is all or nothing in this window too: the scope is checked before the commit (the
staged blob against the declared change), or a refused commit is undone (`git reset --soft HEAD~1`
and the index and working tree restored to the state before the verb) before the verb exits 1 —
and the error says which of the two happened.

Suggested kind in WingFoil: bug (write atomicity; next to bug-217; related to F-023, which reports
the hidden edit itself).
