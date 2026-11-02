---
id: F-028
title: "Read verbs run git unprotected: they rewrite .git/index, run core.fsmonitor, lazy-fetch on a partial clone and take git from PATH"
kind: defect
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-36 and W-37.

## Observed

WingFoil 0.3.1 from npm (`wingfoil --version` → `0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`),
git 2.43, Linux, 2026-11-02, in a scratch repository made with `wingfoil init --template Kanban
--no-interactive` (a local `user.name` / `user.email`). `<repo>` is that repository.

**1. A read writes `.git/index`.** `workflow list` runs, among its reads,
`git status --porcelain=v1 -z --no-renames --untracked-files=all -- …` (seen with `GIT_TRACE=1`), with
optional locks, so it refreshes and rewrites a stale index:

```
$ touch -d "@$(( $(date +%s) + 5 ))" .wingfoil/dna.yaml     # stat no longer matches the index
$ sha1sum .git/index      → e75e88c9e49d…
$ wingfoil workflow list --format json                       # exit 0
$ sha1sum .git/index      → e8337973a973…                    # rewritten
$ # the same with GIT_OPTIONAL_LOCKS=0                       → unchanged
```

`workflow status`, `workflow next` and `agent list` rewrite it the same way; `dna show`,
`directives list`, `memory search` and `paths` do not.

**2. A read runs the repository's `core.fsmonitor`.** With `git config core.fsmonitor <marker>`
(a script that appends a line to a log and exits 1) and a stale index entry, under
`GIT_OPTIONAL_LOCKS=0`:

```
workflow list    → the marker ran 4 times
workflow status  → the marker ran 4 times
dna show, memory search, directives list → 0
$ GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false wingfoil workflow list → 0
```

A cloned repository's `.git/config` is not committed, but a reader can be pointed at a working copy
someone else prepared (a shared folder, an unpacked archive, a tool that adds a project by path).

**3. A read fetches from a promisor remote.** A partial clone (`git clone --filter=blob:none` of a
`file://` remote with `uploadpack.allowFilter`, sparse checkout of `README.md` only):

```
$ git rev-list --objects --all --missing=print | grep -c '^?'        → 31
$ GIT_NO_LAZY_FETCH=1 wingfoil workflow list --format json
{"error":"E_GIT_READ_FAILED: git cat-file --batch at 8b1921df… failed in <repo>: warning: lazy fetching disabled; some objects may not be available\nfatal: could not fetch c47c8e02… from promisor remote"}
[exit 1]
$ wingfoil workflow list --format json                               # exit 0
$ git rev-list --objects --all --missing=print | grep -c '^?'        → 15
```

The read did network-capable transport (the promisor remote's URL, and for an ssh remote its
`core.sshCommand`, come from the repository's configuration).

**4. git is looked up through `PATH`.** WingFoil starts a bare `git`. With a committed executable
named `git` at the repository root (it logs its arguments and runs the real git) and a relative
`PATH` entry:

```
$ PATH=".:$PATH" wingfoil workflow list --format json   → the repository's git ran 17 times
$ PATH=":$PATH"  wingfoil workflow list --format json   → 17 times (an empty entry is the cwd)
$ PATH=".:$PATH" wingfoil memory search / directives list / dna show → 0
```

Its first call was `-C <repo> rev-parse --verify --quiet HEAD^{commit}`. Not verified here: on
Windows, a program started without a path is also looked up in the current folder before `PATH`
(the `CreateProcess` search order, and Node.js's lookup when no shell is used), which would run a
`git.exe` shipped in the repository without any `PATH` change.

## Expected

A read verb never writes to the repository, never runs a program the repository's configuration
names and never contacts a remote. WingFoil runs its own git reads with `--no-optional-locks` (or
`GIT_OPTIONAL_LOCKS=0`), `-c core.fsmonitor=false`, `GIT_NO_LAZY_FETCH=1` and
`GIT_ALLOW_PROTOCOL=none` (a read on a partial clone then fails with a message naming the fix, e.g.
`git fetch --refetch --no-filter <remote>`), and starts git by an absolute path resolved once from
absolute `PATH` entries only (refusing a `git` inside the project). Writes keep their required locks.

Suggested kind in WingFoil: bug (security; the git wrapper of `dist/core/`).
