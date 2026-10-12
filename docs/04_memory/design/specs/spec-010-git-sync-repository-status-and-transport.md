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
no new process): `# branch.head <name> | (detached)`, `# branch.upstream <name>` (when an
upstream is configured) and `# branch.ab +<ahead> -<behind>` (when the upstream's tracking ref
exists; checked on git 2.43.0: without that ref git prints no `branch.ab`). Remotes come from
`git remote` (an allowed read, REQ-INT-06), run with the status in every check of the snapshot.
When the status prints `branch.upstream`, the check also reads `git config --get
branch.<branch>.remote` (an allowed `config` read): the upstream is a **remote upstream** when
that value is a remote `git remote` lists, and its remote is that value — never guessed from the
name's prefix. A local upstream (`branch.<b>.remote = .`) counts as none: sync is with a remote
only.

| `copy` | Condition (first match wins) | Blocks governed writes (spec-004 §4 row 8) |
|--------|------------------------------|---------------------------------------------|
| `detached` | `branch.head (detached)` | yes — descriptor reason `copy-detached` |
| `no-remote` | `git remote` lists none | no |
| `no-upstream` | no remote upstream, or no `branch.ab` (the tracking ref is missing: never fetched, or pruned after the branch was deleted on the remote, §4) | no |
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
Y-04.2's 5 s is met by it, the 10 s periodic check is the fallback. Besides, `repo` is sent with
the unchanged `state` when `sync.fetch.lastError` or `sync.update.lastError` (§3) is set,
changed or cleared; a new `lastSuccessAt` alone sends nothing — it is read by the next `GET`.

### 3. Repository status in `GET /api/p/:pid`

`repository` (schema `contracts/api/repository.schema.json`, referenced by
`project.schema.json`) keeps its v0.1 fields and adds:

```
{ state, head, localChanges,                       # v0.1
  branch: string | null,                           # null when detached
  copy: "in-sync" | "ahead" | "behind" | "diverged" | "detached" | "no-remote" | "no-upstream",
  ahead: integer, behind: integer,                 # 0 when unknown
  upstream: string | null,                         # the remote upstream's name, e.g. "origin/main"
  sync: { fetch: { lastSuccessAt: string | null,  # ISO 8601 UTC, since the server start
                   lastError: { message, at } | null },
          update: { lastError: { code, detail?, message?, at } | null } } }
```

`upstream` is the printed `branch.upstream` whenever it is a remote upstream (§1) — also in
`no-upstream` when only its tracking ref is missing, so the sidebar can name it — and `null`
otherwise. The project conditions that hold (spec-001 §6; v0.2: `has-remote`) are not part of
`repository`: they are the top-level `conditions: string[]` of the project header
(`project.schema.json`).

### 4. Transport commands (write class (c), REQ-ARC-03, REQ-INT-06)

| Operation | Arguments (after the protocol settings) |
|-----------|-----------------------------------------|
| fetch | `fetch --quiet --prune --no-recurse-submodules -- <remote>` |
| update (manual) | `pull --ff-only --no-rebase --no-autostash --no-recurse-submodules --quiet` — the upstream only |
| update (automatic, §6) | `merge --ff-only --no-edit --no-stat --no-autostash --quiet -- @{u}` — local only: fast-forwards to the tracking ref the tick's fetch just updated, no network |
| push | `push --quiet --no-follow-tags --recurse-submodules=no -- <remote> HEAD:<merge ref>` — `<remote>` and `<merge ref>` from `git config --get branch.<branch>.remote` / `.merge`; an explicit refspec without `+`, so configured push refspecs and `push.default` play no part and the push is **never forced** |

- **Fetch target:** the remote upstream's remote (§1, `branch.<branch>.remote`); with no remote
  upstream: the only remote when `git remote` lists exactly one, else `origin` when it is listed;
  otherwise a manual fetch is refused with `no-fetch-target` (§5) and the scheduler skips the
  project. `--prune` removes tracking refs of branches deleted on the remote, so such an upstream
  reads `no-upstream` (§1) and update and push are refused.
- Every command is prefixed with `CLONE_SETTINGS` (`protocol.allow=never`, then `https`, `http`,
  `ssh`, `git`, `file` allowed — `ext::` and `fd::` refused) and `--no-optional-locks`; argument
  array, no shell (REQ-SEC-05); environment = `gitEnv(…)` plus `GIT_TERMINAL_PROMPT=0` (as
  `projects/clone.ts`): git never prompts, a missing credential fails with git's message.
  When the user has configured no ssh command — neither `GIT_SSH_COMMAND` nor `GIT_SSH` in the
  server's environment, and `git config --get core.sshCommand` (run before the command; exit 1 =
  unset) prints nothing — the environment also gets `GIT_SSH_COMMAND=ssh -o BatchMode=yes`, so a
  passphrase or host-key prompt fails at once and its message reaches the toast (`git-refused`).
  A configured ssh command is used as is. Authentication is the user's git configuration
  (credential helper, ssh agent; REQ-SEC-09). Hooks run as the repository configures them, as for
  the CLI's own commits (the project's own CLI already runs from it, `adr-001` D2).
- The reads this section adds — `git config --get` of `core.sshCommand` and
  `branch.<branch>.remote`/`.merge`, `git log --name-only` of §5 — are of the `config` and `log`
  subcommands that REQ-INT-06 allows (listed in its description since SARD `04` v0.9).
- Every command of the table runs under the per-project write lock (`adr-001` D5), with a
  **fresh** status read inside it. Transport the user started has no fixed timeout (`adr-001` D5). **Cancel** is
  offered for fetch and push: when the page aborts the request, the server kills the process
  group, and the next status read shows where the refs stand. A manual update (`pull --ff-only`) is not
  cancellable and always runs to completion (`GIT_TERMINAL_PROMPT=0` and, unless the user
  configured an ssh command, `BatchMode` keep prompts from holding it). An automatic fetch and
  an auto-push (§6), which no one can cancel, are killed after 60 s, counted from the start of
  the git process (`adr-001` D5, note of 2026-10-12). The automatic update (`merge --ff-only`) is
  local and has no timeout.
- `merge` is used only as listed above, always with `--ff-only`: it never creates a merge commit
  (checked on git 2.43.0 with `merge.ff=false` and `merge.autoStash=true` configured: a
  fast-forward, one parent). `server/src/git/git.ts` `GIT_ALLOWED_SUBCOMMANDS` gains `merge`
  (SARD REQ-INT-06 v0.10 of `04`; the code change belongs to the implementing task).
- Failure → **422 `git-refused`**, git's standard error verbatim (spec-004 §5). A fetch failure is
  also kept as `sync.fetch.lastError` (Y-03.1, Y-03.2), an update failure as
  `sync.update.lastError` with `code: "git-refused"` and the `message` — in memory only, never
  logged (the log gets `{pid, op, exitCode}`) nor stored, since git may echo a URL.
- Success → **200** `{ repository }` (§3), read after the command (`git.response.schema.json`).
  Nothing to do (update with behind = 0, push with ahead = 0) → 200, no process.

### 5. Transport refusals

Evaluated in this order under the write lock, from the fresh status; **409**, no transport
process; rendered from the web catalogue as `error.<code>` (spec-008 §4; every code has a key,
spec-008 §7):

| `code` | `detail` | Applies to | Catalogue text (English) |
|--------|----------|------------|--------------------------|
| `no-remote` | — | fetch, update, push | "This repository has no remote — add one with git in a terminal" (normally unseen: the controls are hidden, §7) |
| `detached-head` | — | update, push | "Blocked: no branch checked out" (Y-01.3) |
| `no-fetch-target` | — | fetch | "Nothing to fetch from: this branch has no upstream and the repository has several remotes, none named origin — set an upstream with git in a terminal" |
| `no-upstream` | — | update, push | "This branch has no upstream on the remote — set one with git in a terminal" |
| `diverged` | — | update | "Cannot fast-forward: your copy and the remote have diverged — run git pull --rebase or git merge in a terminal" (Y-06.1) |
| `local-changes-in-the-way` | `{ files }` | update | "Cannot fast-forward: local changes to {files} are in the way — commit or stash them in a terminal" (Y-06.2) |

`local-changes-in-the-way`: the files changed by the incoming commits
(`git log --no-renames --name-only -z --format= HEAD..@{u}`) intersected with the status entries
(changed, staged, untracked); `detail.files` is an array of paths relative to the project (never
absolute). The web renders the `{files}` argument as one string: the base names joined with the
locale's conjunction list format (FormatJS `formatList`, e.g. "a.md, b.md and c.md"). Local
changes to other files do not refuse (Y-05.3). A refusal of an update — manual or automatic — is
kept as `sync.update.lastError` until the next successful update or a change of the copy state,
so the sidebar shows it (Y-06.1, Y-06.2).

### 6. Scheduler and auto-push (REQ-PERF-07, REQ-STATE-09, C-07.3)

- One timer per server, ticking every `fetchIntervalSeconds` (spec-006 §2: default 60 s, range
  15–3600 s; REQ-PERF-07's 65 s is measured with the default). Each tick reads the settings. A
  change of `autoFetch` or `fetchIntervalSeconds` re-arms the timer: one tick runs at once, then
  every interval — so such a change takes effect within the 120 s of REQ-STATE-09 (C-07.3); any
  other change is read at the next tick.
- Scope: the projects with an open snapshot (opened since the start and still listed), whose
  `has-remote` holds and that have a fetch target (§4). A tick handles them **one at a time**; a
  tick that falls while the previous one still runs is skipped, and a tick skips a project whose
  write lock is busy (it never waits for it).
- `autoFetch` on → fetch (§4), killed after 60 s and recorded as failed; the next tick retries.
  Right after a successful fetch, still under the same write lock: `autoUpdate` on, the user
  identified in the team (RP-14) and copy `behind` → the automatic update (§4: `merge --ff-only`)
  after the §5 checks `detached-head`, `no-upstream`, `diverged` and `local-changes-in-the-way`
  on a fresh status; a refusal or a failed merge is kept as `sync.update.lastError` (Y-05.2).
  `autoFetch` off → the scheduler starts 0 `git fetch` processes (Y-02.3); manual *Fetch* still
  works.
- **Auto-push:** after each successful governed write from the UI, with `autoPush` on and
  `has-remote` holding, a push (§4) runs under the same write lock, killed after 60 s. The `push`
  field of the write response (spec-004 §5, `write.response.schema.json`) is
  `{ status, code?, message? }`: `off` when no push was attempted; `pushed` on success; `failed`
  with git's `message` when git refuses (Y-08.1: the commit stays, the copy is `ahead`); `failed`
  with `code` = the §5 code when refused before git runs (e.g. `no-upstream`); `failed` with
  `code: "push-timeout"` when killed after 60 s (catalogue: "Not pushed: the push did not finish
  within 60 s — use Push to try again"). The toast renders `code` from the catalogue. A failed
  push never fails the write. There is no periodic push.

### 7. Condition `has-remote` and the sync controls (REQ-INT-03, S-11.2, Y-04)

`has-remote` holds when `git remote` lists at least one remote; it is evaluated per repository
state (§2) and listed in the project header's `conditions` (§3). Git sync is not a WingFoil
capability (it does not depend on the WingFoil version), so it has no row in
`contracts/capabilities.json`: the *Fetch*, *Update* and *Push* controls and the ahead/behind
counts are hidden when `has-remote` does not hold — the hidden rule of REQ-INT-03 — and shown
again with the next `repo` event (Y-04.2). The branch and the local changes are always shown
(Y-04.1). *Cancel* is shown for a running fetch or push only (§4).

### 8. Preconditions of the git routes (spec-004 §4)

| Route | Rows of spec-004 §4 | Then |
|-------|---------------------|------|
| `POST …/git/fetch` | 1–4 (no body) | §5 `no-remote`, `no-fetch-target` |
| `POST …/git/update` | 1–5 | §5 |
| `POST …/git/push` | 1–5 | §5 |

Fetch is allowed to an unidentified user (RP-14: it changes only remote-tracking refs, no branch
and no file); update and push are refused with 403 `not-in-team` and start 0 processes — the
scope of REQ-SEC-08's fit criterion (SARD `05` v0.6), which excludes fetch and the per-user local
settings. Row 6 (`unsupported-version`) does not apply: transport runs no `wingfoil` process.
Rows 7–9 do not apply (no element).

### 9. Verification

- Unit: copy state per row of §1 from recorded porcelain outputs (local upstream, upstream
  without a tracking ref); fetch target per case of §4; the key changes on `branch.ab`, upstream
  and remote-list changes, not on a re-read of the same state; argument arrays of §4 (no `+`,
  `--ff-only`, `--prune`, `--no-recurse-submodules`, protocol settings, `GIT_TERMINAL_PROMPT=0`;
  `GIT_SSH_COMMAND` set only when no ssh command is configured); the automatic fetch and the
  auto-push killed at 60 s of process time; the automatic update's `merge --ff-only` argument
  list and its §5 checks; a tick skipping a project whose write lock is busy; the timer re-armed
  only on an `autoFetch` or `fetchIntervalSeconds` change.
- API: every row of §5 and §8 (status, `code`, 0 transport processes); every `push` outcome.
- e2e (fixtures with a local bare remote): `features/y/*.feature`, G-12.1…G-12.3, G-13.1/G-13.2,
  S-11.2, C-07.3; REQ-PERF-07 with the default interval (10 of 10 within 65 s; 0 `git fetch` in
  120 s when off); REQ-INT-06 process audit.

## Consequences

- One status process per check gives copy state, local changes and the key; `git remote` adds one
  git process per check, and `git config --get branch.<branch>.remote` one more when an upstream
  is configured (no CLI process: REQ-PERF-05 is unchanged).
- The UI never creates a merge commit, rebases, stashes or forces: every case it cannot
  fast-forward ends in a catalogue text that names the terminal command.
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
- 2026-10-12 — independent spec review round 1 (FAIL) fixed. Decided by the approver
  (release-planning-rel-v0.2-plan session 2): auto-push killed after 60 s → `failed` with
  `code: "push-timeout"` (RP-33); REQ-SEC-08's fit criterion scoped to governed writes, update and
  push (RP-34, §8); fetch with `--prune`, a deleted upstream reads `no-upstream` (RP-35); fetch
  target rule (RP-36); *Cancel* for fetch and push only, update runs to completion (RP-37); an
  immediate tick only on an `autoFetch` or `fetchIntervalSeconds` change, projects fetched one at
  a time, the 60 s counted from the process start, `repo` only on copy-state or sync-error
  changes, `lastSuccessAt` read by `GET` (RP-40). Drafting details (review mechanical fixes):
  `push.code`; `conditions` on the project header only; a git-refused update kept as
  `sync.update.lastError`; `upstream` named in `no-upstream` when only its tracking ref is
  missing; a local upstream counts as none; `no-remote` catalogue text; `--no-recurse-submodules`
  on fetch and pull; the added `config`/`log` reads covered by REQ-INT-06; `{files}` rendered as
  a list of base names; §5 renamed "Transport refusals"; the "git leaves the repository as it
  was" claim removed for pull.
- 2026-10-12 — independent spec review round 2 (release-planning v0.2 session 2). Decided by the
  approver (RP-41): the automatic update is a local `merge --ff-only --no-edit --no-stat
  --no-autostash --quiet -- @{u}` run right after the tick's successful fetch, with the §5 checks,
  no timeout; the manual update stays `pull --ff-only`; a tick skips a project whose write lock is
  busy; `merge` joins the git allow-list (SARD REQ-INT-06). Checked on git 2.43.0 in a scratch
  repository: behind → exit 0, fast-forward; behind with an unrelated local edit → exit 0, edit
  kept; local edit to an incoming file → exit 1, HEAD and edit unchanged; diverged → exit 128,
  HEAD unchanged; in sync → exit 0, no-op. Drafting details: `no-fetch-target` (a fetch with no
  target) separate from `no-upstream`; the upstream's remote read from `branch.<branch>.remote`,
  never from the name's prefix (§1, §3, §4); the "waiting for the write lock" clause removed.
