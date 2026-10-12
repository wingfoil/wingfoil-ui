---
id: spec-010-git-sync-repository-status-and-transport
type: tech-spec
title: "Git sync, repository status and transport"
status: draft
scope: "copy state, repository status, git transport (fetch, fast-forward update, push) and the auto-sync scheduler"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.2"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

v0.2 adds the sync features Y1–Y4 (US-Y-01…08), the blocked-on-a-stale-copy rule (US-G-12,
REQ-STATE-04), the push outcome of a UI write (US-G-13, US-Y-08) and the auto-fetch, auto-update
and auto-push settings (US-C-07, REQ-PERF-07, REQ-STATE-09). spec-004 names the routes
(`POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push`) and the `git-refused` code; `adr-001`
D5/D7 fix the write classes and the process model; `server/src/git/git.ts` already allows `fetch`,
`pull` and `push` (`GIT_ALLOWED_SUBCOMMANDS`). Nothing fixes the copy state, its place in the
repository-state key, the arguments and environment of transport, the update refusals or the
scheduler — and v0.1 reads only `# branch.oid` from the status (`parseStatus`), so the key and the
`repo` event do not move on a fetch or a `git remote add` (checked: `parseStatus` skips every
`# ` header other than `branch.oid`). Identified by `release-planning` v0.2 (`identify-specs`,
RP-10).

## Specification

### 1. Copy state (REQ-STATE-04, Y-01.1…Y-01.3)

Read from the existing status read (`git status --porcelain=v2 --branch`, `GIT_READ_ARGS.status`;
no new process): `# branch.head <name> | (detached)`, `# branch.upstream <remote>/<branch>` (when
an upstream is configured) and `# branch.ab +<ahead> -<behind>` (when the upstream's tracking ref
exists; checked on git 2.43.0: without that ref git prints no `branch.ab`). Remotes come from
`git remote` (an allowed read, REQ-INT-06), run with the status in every check of the snapshot.

| `copy` | Condition (first match wins) | Blocks governed writes (spec-004 §4 row 8) |
|--------|------------------------------|---------------------------------------------|
| `detached` | `branch.head (detached)` | yes — descriptor reason `copy-detached` |
| `no-remote` | `git remote` lists none | no |
| `no-upstream` | no `branch.upstream`, or no `branch.ab` | no |
| `diverged` | ahead > 0 and behind > 0 | yes — `copy-diverged` |
| `behind` | behind > 0 | yes — `copy-behind {commits}` |
| `ahead` | ahead > 0 | no (REQ-STATE-04: only ahead does not block) |
| `in-sync` | otherwise | no |

Ahead/behind are relative to the **last fetched** state of the upstream. A repository without
commits (`# branch.oid (initial)`) is read as above with ahead = behind = 0.

### 2. Repository-state key and `repo` event (REQ-STATE-02)

The status hash of the key `<HEAD sha>.<status hash>` (spec-004 §5) also covers the
`branch.head`, `branch.upstream` and `branch.ab` lines and the sorted list of remote names; the
key format is unchanged. Hence a fetch that moves the tracking ref, a branch switch, an upstream
change and a `git remote add`/`remove` change the key and send `repo {pid, state}` (spec-004 §6):
the repository watcher already watches `refs/` and the git directory's `config` (`watcher.ts`);
Y-04.2's 5 s is met by it, the 10 s periodic check is the fallback. A change of the sync status of
§3 (a fetch or update result) sends `repo` with the unchanged `state`, so pages refetch the header.

### 3. Repository status in `GET /api/p/:pid`

`repository` (schema `contracts/api/repository.schema.json`, referenced by `project.schema.json`)
keeps its v0.1 fields and adds:

```
{ state, head, localChanges,                       # v0.1
  branch: string | null,                           # null when detached
  copy: "in-sync" | "ahead" | "behind" | "diverged" | "detached" | "no-remote" | "no-upstream",
  ahead: integer, behind: integer,                 # 0 when unknown
  upstream: string | null,                         # e.g. "origin/main"
  sync: { fetch: { lastSuccessAt: string | null,  # ISO 8601 UTC, since the server start
                   lastError: { message, at } | null },
          update: { lastError: { code, detail?, message?, at } | null } } }
```

The project header also carries `conditions: string[]`, the project conditions that hold
(spec-001 §6; v0.2: `has-remote`).

### 4. Transport commands (write class (c), REQ-ARC-03, REQ-INT-06)

| Operation | Arguments (after the protocol settings) |
|-----------|-----------------------------------------|
| fetch | `fetch --quiet` — git's default remote (the upstream's remote, else `origin`) |
| update | `pull --ff-only --no-rebase --no-autostash --quiet` — the upstream only |
| push | `push --quiet --no-follow-tags --recurse-submodules=no -- <remote> HEAD:<merge ref>` — `<remote>` and `<merge ref>` from `git config --get branch.<branch>.remote` / `.merge`; an explicit refspec without `+`, so configured push refspecs and `push.default` play no part and the push is **never forced** |

- Every command is prefixed with `CLONE_SETTINGS` (`protocol.allow=never`, then `https`, `http`,
  `ssh`, `git`, `file` allowed — `ext::` and `fd::` refused) and `--no-optional-locks`; argument
  array, no shell (REQ-SEC-05); environment = `gitEnv(…)` plus `GIT_TERMINAL_PROMPT=0` (as
  `projects/clone.ts`): git never prompts, a missing credential fails with git's message.
  When the user has configured no ssh command — neither `GIT_SSH_COMMAND` nor `GIT_SSH` in the
  server's environment, and `git config --get core.sshCommand` (an allowed read, run before the
  command; exit 1 = unset) prints nothing — the environment also gets
  `GIT_SSH_COMMAND=ssh -o BatchMode=yes`, so a passphrase or host-key prompt fails at once and its
  message reaches the toast (`git-refused`). A configured ssh command is used as is.
  Authentication is the user's git configuration (credential helper, ssh agent; REQ-SEC-09).
  Hooks run as the repository configures them, as for the CLI's own commits (the project's own
  CLI already runs from it, `adr-001` D2).
- All three run under the per-project write lock (`adr-001` D5), with a **fresh** status read
  inside it. Transport the user started has no fixed timeout (`adr-001` D5): when the page aborts the request (the UI's
  *Cancel*), the server kills the process group; git leaves the repository as it was. An
  automatic fetch (§6), which no one can cancel, is killed after 60 s and recorded as failed; the
  next tick retries (`adr-001` D5, note of 2026-10-12).
- Failure → **422 `git-refused`**, git's standard error verbatim (spec-004 §5); a fetch failure is
  also kept as `sync.fetch.lastError` (Y-03.1, Y-03.2) — in memory only, never logged (the log
  gets `{pid, op, exitCode}`) nor stored, since git may echo a URL.
- Success → **200** `{ repository }` (§3), read after the command (`git.response.schema.json`).
  Nothing to do (update with behind = 0, push with ahead = 0) → 200, no process.

### 5. Update and push refusals

Evaluated in this order under the write lock, from the fresh status; **409**, no transport
process; rendered from the web catalogue as `error.<code>` (spec-008 §4):

| `code` | `detail` | Applies to | Catalogue text (English) |
|--------|----------|------------|--------------------------|
| `no-remote` | — | fetch, update, push | — (the controls are hidden, §7) |
| `detached-head` | — | update, push | "Blocked: no branch checked out" (Y-01.3) |
| `no-upstream` | — | update, push | "This branch has no upstream — set one with git in a terminal" |
| `diverged` | — | update | "Cannot fast-forward: your copy and the remote have diverged — run git pull --rebase or git merge in a terminal" (Y-06.1) |
| `local-changes-in-the-way` | `{ files }` | update | "Cannot fast-forward: local changes to {files} are in the way — commit or stash them in a terminal" (Y-06.2) |

`local-changes-in-the-way`: the files changed by the incoming commits
(`git log --no-renames --name-only -z --format= HEAD..@{u}`, an allowed read) intersected with
the status entries (changed, staged, untracked); `detail.files` are paths relative to the project
(never absolute), shown by their base name. Local changes to other files do not refuse (Y-05.3).
A refusal of an update — manual or automatic — is kept as `sync.update.lastError` until the next
successful update or a change of the copy state, so the sidebar shows it (Y-06.1, Y-06.2).

### 6. Scheduler (REQ-PERF-07, REQ-STATE-09, C-07.3)

- One timer per server, ticking every `fetchIntervalSeconds` (spec-006 §2: default 60 s, 15–3600 s;
  REQ-PERF-07's 65 s is measured with the default). Each tick reads the settings. A settings change
  (`settings` event) re-arms the timer: one tick runs at once, then every new interval — so any
  change, including `autoFetch` turned on with a long interval, takes effect within the 120 s of
  REQ-STATE-09 (C-07.3).
- Scope: the projects with an open snapshot (opened since the start and still listed), whose
  `has-remote` holds. A tick skips a project whose previous automatic fetch still runs (possible
  with an interval below the 60 s kill of §4).
- `autoFetch` on → fetch (§4). After a successful fetch, `autoUpdate` on, the user identified in
  the team (RP-14) and copy `behind` → update (§4–§5) (Y-05.2).
- Auto-push: after each successful governed write from the UI, with `autoPush` on and
  `has-remote` holding, a push (§4) runs under the same write lock. The `push` field of the write
  response (spec-004 §5) is `off` when no push was attempted, `pushed` on success, `failed` with
  git's `message` when git refuses (Y-08.1: the commit stays, the copy is `ahead`) and `failed`
  without `message` on a §5 refusal (e.g. `no-upstream`), the toast then showing that code's
  catalogue text. A failed push never fails the write.
  There is no periodic push.
- `autoFetch` off → the scheduler starts 0 `git fetch` processes (Y-02.3); manual *Fetch* still
  works.

### 7. Condition `has-remote` and the sync controls (REQ-INT-03, S-11.2, Y-04)

`has-remote` holds when `git remote` lists at least one remote; it is evaluated per repository
state (§2) and listed in `conditions` (§3). Git sync is not a WingFoil capability (it does not
depend on the WingFoil version), so it has no row in `contracts/capabilities.json`: the *Fetch*,
*Update* and *Push* controls and the ahead/behind counts are hidden when `has-remote` does not
hold — the hidden rule of REQ-INT-03 — and shown again with the next `repo` event (Y-04.2). The
branch and the local changes are always shown (Y-04.1).

### 8. Preconditions of the git routes (spec-004 §4)

| Route | Rows of spec-004 §4 | Then |
|-------|---------------------|------|
| `POST …/git/fetch` | 1–4 (no body) | §5 `no-remote` |
| `POST …/git/update` | 1–5 | §5 |
| `POST …/git/push` | 1–5 | §5 |

Fetch is allowed to an unidentified user (RP-14: it changes no branch and no file); update and
push are refused with 403 `not-in-team` (TT-SEC-08). Row 6 (`unsupported-version`) does not apply:
transport runs no `wingfoil` process. Rows 7–9 do not apply (no element).

### 9. Verification

- Unit: copy state per row of §1 from recorded porcelain outputs; the key changes on `branch.ab`,
  upstream and remote-list changes, not on a re-read of the same state; argument arrays of §4
  (no `+`, `--ff-only`, protocol settings, `GIT_TERMINAL_PROMPT=0`; `GIT_SSH_COMMAND` set only
  when no ssh command is configured); the automatic fetch killed at 60 s; timer re-armed on a
  settings change.
- API: every row of §5 and §8 (status, `code`, 0 transport processes); push outcome values.
- e2e (fixtures with a local bare remote): `features/y/*.feature`, G-12.1…G-12.3, G-13.1/G-13.2,
  S-11.2, C-07.3; REQ-PERF-07 with the default interval (10 of 10 within 65 s; 0 `git fetch` in
  120 s when off);
  REQ-INT-06 process audit.

## Consequences

- One status process per check gives copy state, local changes and the key; `git remote` adds one
  git process per check (no CLI process: REQ-PERF-05 is unchanged).
- The UI never merges, rebases, stashes or forces: every case it cannot fast-forward ends in a
  catalogue text that names the terminal command.
- spec-004 §3–§6 and spec-006 §2 carry the v0.2 shapes this spec relies on (`push` outcome,
  settings keys); a change of the copy-state list changes `repository.schema.json` and the
  descriptor reasons of spec-003 §6.

## Process Notes

- 2026-10-12 — identified by `release-planning` v0.2 (`identify-specs`, plan session 2), RP-10;
  proactive, from the read-only survey of the v0.2 scope against spec-001…009 and the v0.1 code.
  RP-14 (fetch allowed to unidentified users) stated in §8.
- 2026-10-12 — open points of the draft decided by the approver (RP-18…RP-32,
  release-planning-rel-v0.2-plan session 2): scheduler scope = open snapshots (RP-18); interval =
  setting `fetchIntervalSeconds`, timer re-armed on a settings change (RP-19); automatic fetch
  killed after 60 s, a tick skips a project whose automatic fetch still runs (RP-20, recorded in
  `adr-001`); fetch under the write lock (RP-21); auto-push without upstream → `failed` (RP-22);
  hooks as configured (RP-23); `GIT_SSH_COMMAND=ssh -o BatchMode=yes` when no ssh command is
  configured (RP-24); `has-remote` without a capability row (RP-25); a configured upstream with
  no tracking ref = `no-upstream` (RP-32).
