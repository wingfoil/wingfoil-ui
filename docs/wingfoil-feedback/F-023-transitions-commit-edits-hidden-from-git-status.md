---
id: F-023
title: "A transition commits an edit of the element that git status does not show (assume-unchanged, core.ignoreStat)"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-28.

## Observed

WingFoil 0.2.2 from npm, git 2.43, 2026-10-14, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`, a `task` submitted and pending, the user an
approver. The element file is marked so that git no longer looks at it, then edited:

```
$ git update-index --assume-unchanged -- <the element file>
$ echo "hidden edit" >> <the element file>
$ git status --porcelain
[empty]
$ wingfoil memory approve <id> --reason ok --format json
{"error":"commit <sha> carries more than the change it declares: the body changed although this operation does not own it"}
[exit 1]
$ git show HEAD
… +hidden edit …
```

`memory submit` on a draft marked the same way exits 0 and its commit carries the hidden edit.
`git config core.ignoreStat true` (files added after it) gives the same: `git status` is empty and
the edit is committed. `skip-worktree` makes `git add` fail instead.

The guard before the write (`git status --porcelain -- <path>`) sees nothing; `git add -- <path>`
and `git commit --only -- <path>` take the working-tree content anyway. `approve` and `reject` then
see the extra change in their own post-commit check and exit 1 — but the commit is already made and
stays on the branch, under a subject that declares only the transition.

## Expected

A transition never makes a commit it then reports as refused. The unmodified-target check compares
the blob ids of the file at HEAD, in the index and in the working tree (`git hash-object -- <path>`
applies the same clean filters as `git add`), whatever the index flags say; a refusal happens before
the commit, or the commit is undone.

Suggested kind in WingFoil: bug (write guard; see also W-24 / F-019).
