---
id: task-008-project-list-api
type: task
title: "Project list API"
status: approved
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
    `projects.item` (renamed at review from `project`, which is task-012's header schema),
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
  ~~`availability.ts`~~ (corrected at review: the availability lives in `project-list.ts`),
  `clone.ts` (as built: `git -c protocol.allow=never -c protocol.<https|http|ssh|git|file>.allow=always
  clone --quiet -- <url> <dir>` — the `-c` settings before the subcommand; review item 7)
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

### red / green / refactor (2026-10-06)

- **Red** (`f2f1e60`): `test/server/http/projects.test.ts`, `test/server/projects/remote.test.ts`,
  `test/contracts/api-projects-schema.test.ts` failed on the missing modules / schema files
  (`Cannot find module '…/server/src/http/projects.js'`, `ENOENT …/contracts/api/project.schema.json`);
  `test/launcher/local-security.test.ts` failed on 404 where 200 (X-04.3 literal, `GET /api/projects`)
  and 400 (the two `POST`s past the guards) were expected — the right reasons.
- **Green** (`70baf46`): as designed. `contracts/api/{project,projects.list.response,
  projects.add.request,projects.clone.request}.schema.json`, `contracts/src/projects.ts` (exported
  by the index); `server/src/projects/{remote,clone,project-list}.ts`; `server/src/http/projects.ts`;
  `server/src/git/git.ts` — `GIT_READ_ARGS.origin` (`remote get-url origin`, exit 2 = no `origin`),
  `GitReads.origin()`, `cloneArgs()` (`-c protocol.ext.allow=never clone --quiet -- <url> <dir>`),
  `GIT_ALLOWED_SUBCOMMANDS` (REQ-INT-06), `gitSubcommand()`; `runLauncher` — one `ProjectList` with
  one `InProcessWriteLock`, the routes in the same `register` callback (role view and event stream
  kept), `projects.start()` once listening, `projects.stop()` in the streams stop hook. All new
  tests green on the first run.
- **Refactor:** the periodic check cannot re-arm itself after `stop()` while a check is in flight;
  response bodies validated against the `contracts/api/` schemas inside the route tests; three more
  route tests (S-27.1 refused `dna show` → folder name, exit 2 → 500 `internal`, client gone during
  a hanging HTTP clone → git killed, nothing left); `test/README.md` 0.11.
- **AC → tests** (`test/server/http/projects.test.ts` unless noted):
  - TT-STATE-07 — S-03.2 (missing path and a file → `folder-not-found {path}`), S-04.3 (+ S-04.2,
    default `~/projects/<repo>`, existing empty folder), S-05.1, S-05.2 (`{source:"clone"}`, clone and
    the `~/projects` it created removed), S-06.1 (also via a symlink and a trailing `/`), S-06.2 (second
    clone of the remote), S-07.1 (`https://git.invalid/…` → `git-refused`, git's message), S-07.2
    (`directory-not-empty`, 0 git processes), S-07.3 (local HTTP remote answering 401 → git's
    "could not read Username … terminal prompts disabled", no hang), S-10.2 (CLI removed →
    `cli-not-found` + command, `projects` event), S-18.1 (204, snapshot closed, fixture tree and
    `git log` unchanged), S-19.1/S-19.2 (moved folder → `folder-not-found`, the other entry `ok`;
    moved back → `ok`; one `projects` event per change); every refusal compares a tree listing of
    the whole test folder (state directory included) before/after. Units: `remote.test.ts`
    (spec-006 §6 table). Plus S-10.1, `state-dir-inside-project`, not-a-repository, 400 rows,
    another console's add, the periodic check.
  - TT-INT-06 — the last test of the file: every git process of the file (one `AuditedRunner`)
    has its subcommand in `GIT_ALLOWED_SUBCOMMANDS`, in v0.1 within `clone`/`config`/`remote`/
    `rev-parse`/`status`; the only CLI command run is `dna show`.
  - TT-ARC-03 — characterization: a clone's `git log` equals the remote's, status clean, no new
    commit; add/list/refused add/check/remove leave the fixture's files and history unchanged. The
    full-suite `drive-browser` git-log check stays with the e2e-smoke (task-014/015 screens).
  - REQ-SEC-05 probe — remote and working directory with `SHELL_PAYLOAD` cloned literally through
    the route, `pwned()` false. REQ-SEC-09 — clone of `http://alex:<secret>@127.0.0.1:<port>/…`
    (dumb-HTTP remote with Basic auth): the answer and `state.json` hold the URL without userinfo,
    `scanForSecrets([stateDir], [secret])` empty; the same remote typed differently is refused.
  - local-security (`test/launcher/local-security.test.ts`) — the four routes: 401 without a
    session, 403 for a foreign Origin, a foreign Host and `Sec-Fetch-Site: same-site`; past the
    guards 200 `{projects: []}`, 400, 400, 404; X-04.3 now also asserts the literal 200.
  - Schemas — `test/contracts/api-projects-schema.test.ts` (items of each availability, `command`
    exactly with `cli-not-found`, no userinfo, request bodies).
- **Deviations (honest):**
  - The tests were all green at the first green run (no implementation iteration to report).
  - TT-STATE-07 / TT-INT-06 are "e2e": proved through the real `buildApp` with the real store,
    git, CLI and snapshots (light-my-request), plus the bin for the guards — not through a browser;
    the screens close in task-014/015 as the task states.
  - The availability check's `projects` event comes from a periodic file check (10 s) and from
    each list read, not from file watching: an availability change is published within ≈ 10 s.
  - A clone cancelled by the stop sequence answers 500 `internal` (untested: it would stop the
    shared runner).
- **Checks** (worktree, load 12.5 → 21.0 on 12 cores, `/proc/loadavg`): `npm run -s typecheck`,
  `lint` clean · `format:check` "All matched files use Prettier code style!" · `npm run -s
  test:coverage` **68 files passed, 1 skipped; 1017 passed / 1 skipped**, 142 s, coverage
  **96 %** statements / **89.24 %** branches / 96.04 % functions / 97.98 % lines
  (`server/src/projects` 94.82 %, `http/projects.ts` 92 % statements) · `docs:api` OK · `test:e2e`
  3/3 · `check_tasks.py` OK. `test/server/http/projects.test.ts` alone: 46/46 in ≈ 27 s.
  `npm run test:timing` not run (load > 12).
- **Hand-overs:**
  - **task-012 (read routes):** `snapshots.open(pid, path)` is already called at add/clone; after
    a restart the listed projects are not open — open on first read as planned. spec-006 §2 says
    `name` and `remote` are "refreshed on every successful open": not done here (no open route) —
    `store.update(pid, { name, remote })` from `GET /api/p/:pid`, and the list's `projects` event
    follows from the next check. `local-security.test.ts`'s header comment still says no project
    route exists: update it when merging.
  - **task-014 (modal):** bodies and codes as in the design note; `detail.path` is the path as
    typed (`~` kept); `not-wingfoil` from a clone has `{ source: "clone" }`; `git-refused` has no
    `detail` (git's message in `message`); a clone has no timeout — the modal's cancel is closing
    the request (the server kills git and removes the folder).
  - **task-015 (switcher):** `GET /api/projects` → `{ projects: [{ id, name, path, remote,
    availability, command? }] }`; refetch on `projects`; `DELETE` → 204.
  - **Coordinator — open points** (design note): not-a-repository folder → `git-refused`;
    clone without a CLI → `cli-not-found` and the clone removed; the `clone` write-lock key; 201 /
    204 answers. Run `npm run test:timing` on a quiet machine before merging.

### review round 1 fixes (2026-10-06)

- Review: **FAIL** (2 major, minors, nits). Items 3 and 6 and the open point on the clone without a
  CLI wait for the user (not implemented). Fixed:
  - **1 (merge)** `contracts/api/project.schema.json` → `projects.item.schema.json` (`$id`, `$ref`
    of the list schema, types' TSDoc, tests); `registerProjectRoutes`/`ProjectRoutesOptions` →
    `registerProjectListRoutes`/`ProjectListRoutesOptions` (task-012 uses the old names).
  - **2** `CloneTarget.discard()` removes the working directory recursively, then each created
    ancestor with `rmdir` (no recursion), deepest first, stopping at the first that is not empty —
    a sibling created during the clone stays. Unit `test/server/projects/clone.test.ts`; route test
    with a slow dumb-HTTP remote: `~/projects/sibling.txt` written while git runs survives the
    refused clone of `~/projects/deep/plain` (with the old code `~/projects` was removed).
  - **4** running clones are tracked (`cloning` set of working directories); an add of, or inside,
    such a folder waits on the `clone` queue and is then judged as the folder is (re-checked once
    more just before the append); a clone refused `already-listed` by its **path** keeps the clone
    (a local add listed it); a clone into the folder of a listed project that went missing is
    refused `already-listed` before cloning. Tests: two concurrent adds of one folder (201 + 422,
    one entry); two queued clones into one folder (201 + 422); two queued clones of one remote
    (201 + `already-listed`, one folder); an add during the clone of that folder (waits, then
    `already-listed` with the clone's pid, folder kept); a remove during a clone (204 while git
    still runs, the clone then 201); the missing-folder case.
  - **5** `repoName` ignores a URL's `?query`/`#fragment` and returns `undefined` for an empty,
    `.` or `..` name → 400 when no `directory` is given (`https://h/.`, `https://h/..`, `file:///`);
    `cloneSourceProblem`: a value starting with `-` or a relative local path (`kanban.git`,
    `./x`, `../x`) → 400. Units and route rows.
  - **7** `CLONE_SETTINGS`: `-c protocol.allow=never` plus `protocol.{https,http,ssh,git,file}.allow
    =always`. Route tests: `ext::sh -c touch% /tmp/pwned` and `fd::17` → 422 `git-refused` (git:
    "transport '…' not allowed"), `pwned()` false, file system unchanged.
  - **8** REQ-SEC-09: the route tests capture the application's log stream; a clone with
    `http://alex:<wrong secret>@…` (401) → 422, the secret absent from the body, the log and the
    state directory; the successful credential clone's log holds no secret either.
  - **9** `normaliseRemote` TSDoc: a port stays part of the host; a local path remote has an empty
    host and equals the same path as `file://`; path case kept; relative local remotes refused by
    the clone.
  - **11** the TT-INT-06 audit test makes its own add, clone and list first: it passes alone
    (`-t TT-INT-06`: 1 passed, 59 skipped) and still audits every process of the file in a full run.
  - **12** design note corrected (no `availability.ts`; the clone's argument order). Launcher test
    `test/server/launcher/project-check.test.ts`: `runLauncher` calls `ProjectList.start()` once
    listening and `stop()` in the stop sequence (spies; in-process, < 1 s).
- **Hand-over addition (task-014, item 10):** a clone runs in its own process group; if the server
  is killed with SIGKILL (no stop sequence), git goes on and finishes (or fails) with nobody to
  undo it — a retry into the same folder is then refused `directory-not-empty`, and the user
  removes the folder by hand. The modal can say so for `directory-not-empty`.
- **Checks** (load 2.5–4.4 on 12 cores): `npx tsc -b`, `tsc -p test`, `eslint .` clean ·
  `prettier --check .` clean · `docs:api` OK · affected suites (`test/server/http`,
  `test/server/projects`, `test/contracts/api-projects-schema.test.ts`, `test/server/launcher`,
  `test/launcher`, `test/server/git`, `test/server/process`) **24 files, 361/361** ·
  `test/server/http/projects.test.ts` 60/60 · **`npm run test:timing` 3/3 at load 4.1 → 3.5**:
  REQ-PERF-03 20/20, max 387 ms; TypeDoc build 3018 ms; REQ-PERF-06 255–345 ms.


### review round 2 follow-ups (2026-10-06)

- Review round 2: **PASS with follow-ups**, fixed here:
  - **M1** the clone resolves its working directory once with `realpathLoose` (now exported by
    `server/src/state/location.ts`) and uses that real path for the listed-path checks, the
    `cloning` set and the target; an add checks `inClone` on its real path (or `realpathLoose` of a
    missing one). A clone refused `already-listed` by path keeps its folder only when that entry
    was added during the clone (ids listed under the queue before `runClone`). Tests (symlinked
    parent `alias` → the test folder): a clone typed through it into the folder of a missing listed
    project → 422 `already-listed` before cloning, nothing created, the entry still
    `folder-not-found`; an add of the real folder while a clone typed through the alias writes it
    → waits, then `already-listed`, the clone kept.
  - **N2** `test/README.md`: the TT-INT-06 audit is self-contained; `clone.test.ts` and
    `test/server/launcher/project-check.test.ts` listed.
  - **N3** `cloneSourceProblem(url, platform)`: drive-letter and UNC paths are absolute on
    `win32` only (POSIX → 400); unit rows for both platforms.
- Checks: see the coordinator report of this round.

### open points decided by the user 2026-10-06

- **Kept as built:** (20) a folder with `.wingfoil/` that is not a git repository → 422
  `git-refused`; (22) clones queued on the write-lock key `clone`; (23) 201 with the item, `DELETE`
  204, `detail.path` as typed, `~` = home, default `~/projects/<repo>`, a refused `dna show` at add →
  folder name. The coordinator writes the spec-004 §3 / spec-006 §3 addendum on `main`.
- **Changed** — red first (`b71c434`: the no-CLI clone answered 422 `cli-not-found`, the vendored
  `node_modules/wingfoil` of a clone ran and wrote its marker, the five nested targets answered
  `git-refused` after a git attempt), then green:
  - (21) a clone whose project has no CLI is **kept** and listed: 201, `availability:
    "cli-not-found"` with the install command.
  - (28) at clone time **no CLI of the cloned repository runs** (no discovery-and-run, no `dna
    show`): the item is named after its folder; the availability is computed from files only. Test:
    a remote committing `node_modules/wingfoil/{package.json,bin.js}` whose script writes a marker
    → after the clone, a list and a check, no marker; name = the folder (`board-x`).
  - (27) a clone target inside a listed project's path → 422 `directory-inside-project {path}`;
    inside the state directory → 422 `inside-state-dir {path}`; both on the real path (nearest
    existing ancestor, `realpathLoose`), before any git process, re-checked in the clone queue.
    Tests: inside a listed project's `.wingfoil/`, its `docs/`, through a symlinked parent; inside
    the state directory, directly and through a symlinked parent — 0 git processes, tree unchanged.
  - Contracts: `contracts/api/projects.refusal.schema.json` (the 422 envelope with every
    spec-006 §3 code and its `detail`, the two new codes included; `git-refused` without `detail`),
    types `ProjectRefusalCode`, `ProjectRefusalBody` (`contracts/src/projects.ts`, exported); the
    route tests validate every refusal body against it; contract rows in
    `test/contracts/api-projects-schema.test.ts`.
- **Hand-over (task-012):** a cloned project's `name` is its folder name until the first open:
  `GET /api/p/:pid` must `store.update(pid, { name, remote })` from `dna show` / `origin`
  (spec-006 §2 "refreshed on every successful open") — then the next check publishes `projects`.
  **task-014:** catalogue keys `error.directoryInsideProject`, `error.insideStateDir` (`{path}`).
- **Checks** (quiet machine, load 2.8 at start → 17 during the run, `/proc/loadavg`): `tsc -b`,
  `tsc -p test`, `eslint .`, `prettier --check .` clean · `docs:api` OK · `npm run -s
  test:coverage` **70 files passed, 1 skipped; 1071 passed / 1 skipped**, 99 s, coverage
  95.95 % statements / 89.18 % branches / 95.95 % functions / 98.02 % lines (`server/src/projects`
  94.64 %).

### verification of decisions 21/27/28 — follow-up (2026-10-06)

- Finding: a relative `core.hooksPath` in the user's global or system git configuration
  (`.githooks`, `.husky`) is resolved against the new working tree, so `git clone` ran the remote's
  committed `post-checkout` hook (git 2.43) — against decision 28. Red `2c7b5cc`: a source repository
  committing `.githooks/post-checkout` (writes a marker), the world's `GIT_CONFIG_GLOBAL` with
  `core.hooksPath = .githooks` → the marker existed after the clone.
- Fix: `cloneArgs(url, directory, hooksDir)` adds `-c core.hooksPath=<hooksDir>`; `noHooksDir()`
  (`server/src/projects/clone.ts`) creates one empty folder per process with `mkdtemp` under the OS
  temporary directory (mode 0700, works on Windows), removed at process exit, never persisted. The
  route test passes: no marker after the clone, a list and a check (skipped on Windows: the hook is
  a shell script).
- Checks (load ≈ 10): `tsc -b`, `tsc -p test`, `eslint .`, `prettier --check .` clean · `docs:api`
  OK · affected suites (`test/server/http`, `test/server/projects`, `test/server/git`,
  `test/contracts/api-projects-schema.test.ts`, `test/server/launcher`, `test/launcher`) 21 files,
  359/359.

### integration (2026-10-06)

- `main` (tasks 006, 009, 010, 011 done; Wave 2 spec amendments incl. spec-006 §3 points 20–28;
  bugs 001/002 closed, bug-003) merged into the branch with no conflict.
- Full gates on the merge, load 5–10: typecheck, lint (REQ-ARC-05 rule included), format:check
  clean; `test:coverage` 1072 passed, 1 skipped, coverage 95.84 % statements / 89.07 % branches;
  `docs:api` OK; `test:e2e` 3/3; `check_tasks.py` OK; `test:timing` 3/3 (REQ-PERF-03 max 353 ms,
  REQ-PERF-06 254–278 ms, TypeDoc 3090 ms) at load 7.5–9.6.
- Reviews: round 1 FAIL (3 major: merge collision, clone undo, clone target), round 2 PASS with a
  symlink follow-up, round 3 PASS; user decisions 20–23, 27, 28 implemented and verified (one
  follow-up: `core.hooksPath` neutralised at clone time).
