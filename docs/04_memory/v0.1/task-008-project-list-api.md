---
id: task-008-project-list-api
type: task
title: "Project list API"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-004-cli-adapter-discovery-and-invocation", "task-007-local-state-store", "task-010-snapshot-cache-and-live-updates"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project-list routes of spec-004 §3 (`GET/POST/DELETE /api/projects`, `POST /api/projects/clone`) with the integrity rules and refusal codes of spec-006 §3: add a local folder, clone a remote into a new empty folder (write class (c), git allow-list), duplicates (a known remote refused before cloning), removal, computed `availability` (`ok`, `folder-not-found`, `not-wingfoil`, `cli-not-found`, spec-006 §2), and the `projects` event of spec-004 §6 when the list or an availability changes.

**Backlog items:** TT-STATE-07, TT-INT-06, TT-ARC-03

## Acceptance Criteria

- **TT-STATE-07** (REQ-STATE-07 — Project list integrity): [boolean] Every listed scenario passes; after each refused add the list and the file system are unchanged. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2, S-07.3, S-18.1, S-19.1, S-19.2, S-10.2.
- **TT-INT-06** (REQ-INT-06 — Git interface): [percentage] 100 % of the git processes started during the e2e suite use a subcommand of the allowed list (process audit). *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-04.3, S-07.1.
- **TT-ARC-03** (REQ-ARC-03 — Four write classes, nothing else): [percentage] After the full e2e suite, 100 % of the commits created in each fixture are `wf(…)` commits made by a CLI process or `chore(ui)` commits changing exactly `.wingfoil/ui.yaml`; the server process opens 0 files for writing under `.wingfoil/` (other than `ui.yaml`) or under a Memory path (file-system audit); in v0.1 the only write is a clone into a new, empty folder (0 endpoints write an existing repository). *Verified by:* e2e-smoke `drive-browser` (git log check) · file-system audit.
  Scenarios (`@v0.1`): S-04.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-014-add-project-modal: S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2, S-07.3, S-10.2; task-015-project-switcher: S-18.1, S-19.1, S-19.2.

## Implementation Notes

- `spec-006` §2–3; `spec-004` §3, §5, §6 (`projects` event); `adr-001` D2, D5, D7 (git allow-list); directive `cli-only-writes` (write class (c)).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-06)

- **depends_on acknowledged (dl-015):** Execution Notes of task-003, task-004, task-007, task-010
  read (reviews included), and through them task-001 and task-005. Taken:
  - task-001: run the REQ-SEC-05 probe (`test/harness/security.ts` `SHELL_PAYLOAD`, `pwned()`)
    through `POST /api/projects/clone`.
  - task-003: routes added through `buildApp({ register })` are guarded automatically; their
    401/403 rows go to `test/launcher/local-security.test.ts`; X-04.3's bin check becomes a literal
    200 on `GET /api/projects`.
  - task-004: `discoverCli` rejection → `cli-not-found` (refusal through `cliErrorEnvelope`, 422,
    `detail { path, command }`; availability); git reads through the runner (30 s), transport with
    `timeoutMs: null` + `AbortSignal`, `GIT_TERMINAL_PROMPT=0` (detached children); write-lock key
    never a user path, the lock is not re-entrant; pass exactly the positionals a CLI command expects.
  - task-005: `dna.project.name` is optional in 0.2.2 → the name falls back to the folder's base name.
  - task-007: every add inside `store.transaction(draft => …)` — short, side-effect free (may run
    twice), no store mutation, no clone/CLI/network inside (slow work first, premises re-checked
    inside); `findProjectContaining` for `state-dir-inside-project`; `store.get(pid)` exact string;
    `GET /api/projects` awaits `store.reload()`; the secret scan after the clone tests with a
    credential URL.
  - task-010: `snapshots.open(pid, path)` / `snapshots.close(pid)` on add/remove; `projects {}` on
    the same bus; `open()` of a non-repository rejects with `GitReadError`; `gitEnv` strips
    `GIT_CONFIG_PARAMETERS`/`COUNT`/`KEY_n`/`VALUE_n`, `GIT_CONFIG`, `GIT_CEILING_DIRECTORIES`,
    `GIT_DISCOVERY_ACROSS_FILESYSTEM`: a transport setting is passed as a `-c` argument; the
    clone/transport commands are added to the allow-list in `server/src/git/git.ts`; routes go in
    the one `register` callback of `runLauncher` (role-view route and event stream kept).
- **Specs:** spec-006 §2–§3 (shape of the list entries, availability values, operations, refusal
  table), spec-004 §3 (routes), §4 rows 1–4, §5 (envelope, `git-refused`), §6 (`projects`),
  spec-008 §4 (`detail` = catalogue arguments, git's message verbatim), adr-001 D2, D5, D7,
  REQ-STATE-07, REQ-INT-06, REQ-ARC-03, directive `cli-only-writes` (class (c)), `ux-reference` §3
  (local folder = absolute path; remote → working directory auto-filled `~/projects/<repo>`).
  Details the specs leave open, decided here without changing a spec'd interface (to confirm at
  review):
  - Bodies (spec-004 §3: "every request and response body has a schema in `contracts/api/`"):
    `projects.list.response` `{ projects: [{ id, name, path, remote, availability, command? }] }`
    (`command` only with `cli-not-found`), `projects.add.request` `{ path }`,
    `projects.clone.request` `{ url, directory? }`, the add and clone answer **201** with the new
    list item; `DELETE` answers **204** without a body. Types in `contracts/src/projects.ts`.
  - A leading `~` (`~` or `~/…`) is the user's home directory (the auto-filled `~/projects/<repo>`);
    after that the path must be absolute, else 400 `invalid-request`. `detail.path` is the path as
    the user gave it (trimmed), so the modal repeats what was typed (S-03.2, S-07.2); the stored
    `path` is the realpath.
  - `directory` absent → `~/projects/<repo>`, `<repo>` the last path segment of the URL without
    `.git`.
  - A folder with `.wingfoil/` that is not a git repository (`git remote get-url origin` exits 128):
    422 `git-refused` with git's message — **open point** for the coordinator (spec-006 §3 has no
    code; alternative: accept it with `remote: ""`, but the snapshot cannot open it).
  - A clone whose project has no CLI (a fresh clone has no `node_modules`; none on the PATH): 422
    `cli-not-found` and the clone removed (REQ-STATE-07 "a failed add or clone leaves nothing", the
    code is in the table of both routes) — **open point**: the alternative (keep the clone, list it
    as `cli-not-found`) lets the user run `npm install` there.
  - `dna show` refused or with output failing its schema at add (S-27.1): the add goes on, the name
    falls back to the base name; a CLI timeout or internal error is the refusal of spec-004 §5.
  - Clones are queued on one write-lock key `clone` (not a project id, never a user path): two clones
    into the same folder or of the same remote cannot race.
  - The `projects` event: published after an add or a remove, and by an **availability check**
    (file-system reads only — `stat` of the folder and `.wingfoil/`, `discoverCli` — plus
    `store.reload()`, no process) that runs on every `GET /api/projects` and periodically (10 s,
    like the snapshot fallback; stopped in the stop sequence), publishing when the list (another
    console) or an availability differs from the last one seen.
- **Design:** `server/src/projects/` — `remote.ts` (`normaliseRemote`: scp-like → `ssh://`,
  userinfo removed, host lower-cased, trailing `/` and `.git` removed, host + path compared),
  `availability.ts`, `clone.ts` (`git clone --quiet -c protocol.ext.allow=never -- <url> <dir>`
  through the runner, `timeoutMs: null`, the client's `AbortSignal`, `GIT_TERMINAL_PROMPT=0`; the
  folders it created removed on any refusal, a pre-existing empty folder emptied again),
  `project-list.ts` (the domain service: add, clone, remove, list, refusals as `ProjectRefusal
  { code, detail }`); `server/src/http/projects.ts` (the four routes). `server/src/git/git.ts`
  gains `git remote get-url origin` (read) and the clone command, and exports the REQ-INT-06
  subcommand allow-list used by the process audit. Wiring in `runLauncher`: the routes in the same
  `register` callback, one `InProcessWriteLock`, the check stopped by a stop hook.
- **AC classification (T1)** — all **red-first** (no route exists; today `/api/projects` → 404):
  - TT-STATE-07 — API tests (`buildApp` + real store on a temp state dir, real git, the pinned CLI
    on the kanban fixture): S-03.2, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1 (unreachable
    `https://git.invalid/…`), S-07.2, S-07.3 (a `file://` remote path that git cannot read →
    git's message; an `http` remote refusing credentials is not available offline — see
    deviations at green), S-10.2 (CLI removed → `cli-not-found` with the command), S-18.1, S-19.1,
    S-19.2, S-04.3; after each refusal the state file and the file system (tree listing of the
    temp root) are unchanged. Units: remote normalisation table (spec-006 §6), duplicate checks
    (same path, symlinked path, same remote with/without `.git`, host case, scp-like vs https),
    a known remote refused before any clone starts (0 git processes).
  - TT-INT-06 — process audit over the whole project-list suite: every git process's subcommand
    is in the allow-list (read + `clone`).
  - TT-ARC-03 — characterization: across the suite the fixture's `git log`, `git status
    --porcelain` and file tree are unchanged; a clone's commits equal the remote's (no new commit);
    `DELETE` touches no file (S-18.1).
  - REQ-SEC-05 probe (task-001 hand-over) — characterization: a remote and a directory whose
    paths hold `SHELL_PAYLOAD` cloned literally through the route, `pwned()` false; then the
    secret scan over the state directory after a clone with a credential URL.
  - local-security rows (task-003 hand-over) — the four routes' 401/403 rows on the bin; X-04.3 →
    literal 200 on `GET /api/projects`.
