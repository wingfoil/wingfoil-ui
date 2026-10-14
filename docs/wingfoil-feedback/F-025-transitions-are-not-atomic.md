---
id: F-025
title: "A transition is not atomic: a failed commit leaves the element file rewritten, and a late failure leaves the commit"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-30.

## Observed

WingFoil 0.2.2 from npm, git 2.43, 2026-10-14. `memory submit|approve|reject` writes the element
file, then runs `git add -- <path>` and `git commit --only -- <path>`, then checks the commit's scope
(`dist/core/memory-transition.js`, `dist/storage/commit.js`). Two failure windows:

1. The commit fails after the file was written. Probed with a `pre-commit` hook that exits 1 on
   `memory submit`: exit 1, a JSON error `Command failed: git -C …` that quotes the repository's
   absolute path and the commit command, the element file rewritten **and staged** (`git status`:
   `M  <path>`), no commit. With a stale `.git/index.lock`, `git add` fails instead: the file is
   left rewritten, no commit.
2. The post-commit scope check fails (W-28): the CLI exits 1 but the commit stays on the branch.

## Expected

A transition is all or nothing: on any failure after the write, the element file and the index are
restored and no commit is left; a refusal is reported only when nothing changed.

Suggested kind in WingFoil: bug (write atomicity; see also F-023).
