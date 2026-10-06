---
id: task-012-project-read-api
type: task
title: "Project read API"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-SEC-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-006-wingfoil-version-range-and-capabilities", "task-007-local-state-store", "task-009-identity-and-role-views", "task-010-snapshot-cache-and-live-updates", "task-011-action-descriptor"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The v0.1 read routes of spec-004 §3 — `GET /api/server`, `/api/p/:pid`, `/config` (without `ui.yaml`, from v0.3), `/elements`, `/elements/:eid`, `/elements/:eid/history`, `/directives`, `/directives/:did`, `/docs`, `/files/tree`, `/files/content` — assembled from the adapter, the snapshot and the descriptor, with confinement of every path to the repository.

**Backlog items:** TT-SEC-06

## Acceptance Criteria

- **TT-SEC-06** (REQ-SEC-06 — Confinement to the repository): [percentage] 100 % of the path-traversal cases of the security suite (`..`, encoded `..`, absolute paths, escaping symlinks) return 404 or the "outside the repository" marker with 0 bytes of the target. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): R-09.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-020-documentation-index-and-links: R-09.3.

Added during the Wave 2 dev-loops (plan `dev-loop-rel-v0.1-plan`, Session 2; decided by the user 2026-10-06):

- **Actor events (spec-002 §3, from task-011):** the project-wide `git log -p` parse of spec-002 §3 that feeds the descriptor's actor events (`describeElements(…, eventsOf, …)`) is implemented here, once per repository state, so the Memory list does not start one `memory history` per element. *Verified by:* unit tests on the fixtures (events equal to `memory history` for every element) + the process audit below.
- **Process audits on the real routes (from task-010):** re-run the TT-PERF-05 audit (cold Memory list ≤ 6 CLI processes, reopened with no change 0) and the TT-INT-09 audit (idle with an open stream: 0 CLI processes) against the real project routes of this task instead of task-010's stand-in routes. *Verified by:* process audit (`test/server/snapshot/process-audit.test.ts` or a successor).
- **Cached identity for governed checks (from task-009, as required by spec-004 §4 "rows 1–6 start no process"):** `PUT /api/p/:pid/role-view` and `GET /api/p/:pid` read the identity from task-010's watched repository state (`view.state.email`) instead of running `git config` / `dna show` per request. *Verified by:* process audit — the PUT starts 0 processes on a warm cache.

## Implementation Notes

- `spec-004` §3 (v0.1 rows), §5; `spec-001` §4 (direct reads); `spec-002` §2 (`memory history` entries for `/history`); `spec-003` §8 (output); `adr-001` D1a, D3 (version and range in `/api/p/:pid`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-06)

- **depends_on acknowledged (dl-015):** Execution Notes of task-006, 007, 009, 010, 011 read, reviews
  and integrations included, and of task-003 and task-005 (through them, 002/004). Taken from them:
  - 003 — every route through the one `buildApp({ register })` callback of `runLauncher` is guarded
    automatically (Host/Origin/`Sec-Fetch-Site` 403, session 401); each new route adds its 401/403
    rows to `test/launcher/local-security.test.ts`; once a `GET` route exists X-04.3's bin check
    becomes the literal 200 (here: `GET /api/server`, which needs no project).
  - 005 — routes over the read facade; `DirectReadError` → 502 `read-error` `detail {file, kind}`
    with `file` relative to the project (directive and `memory.yaml` paths are relative to
    `.wingfoil/`: prefixed), scoped to the element/directive, lists never fail whole, an unreadable
    `memory.yaml` degrades only type-dependent features (descriptor, required fields, resolved
    types); never log `DirectReadError.message` — `{kind, file}` only, `outside` at warn;
    `dna.project.name` optional (fallback: the list entry's name); schemas follow 0.2.2's optional
    fields (DNA without `project`, stacks, member `email`).
  - 006 — one server-wide `VersionCache`; `cache.detect(cli)` → `DetectedVersion`;
    `evaluateCapabilities(detected, supportedRange(), {conditions})`; only `{min, max}` of the range
    is sent; a rejected `detect` → `cliErrorEnvelope`; out of range = `!detected.inRange`.
  - 007 — `GET /api/server` returns `warnings: store.warnings()`; `store.get(pid)` exact lookup →
    404 for unknown ids; route tests with `createMemoryStateStore()`.
  - 009 — `GET /api/p/:pid` embeds the `IdentityView` (`contracts/api/identity.schema.json`,
    `$ref`'d); read-only whenever `identity.kind !== 'member'`; one identity source shared by the
    role-view `PUT` and the header — switched here to the watched state (`view.state.email` +
    `view.dna()`), so neither runs `git config`/`dna show` per request.
  - 010 — per request `snapshots.open(pid, entry.path)` → `snapshot.view()`, read only through the
    view, `X-Repo-State` from `repoStateHeader(view.state)`; the launcher's `snapshots`; git reads
    only through `server/src/git/git.ts` (`GitReads`, `gitEnv`, `resolveGit`); re-run the TT-PERF-05
    and TT-INT-09 audits on the real routes.
  - 011 — `describeElements(matches, eventsOf, {memoryYaml, members, enablement})` once per
    repository state; `eventsOf` backed by this task's spec-002 §3 parse (oldest first,
    `DescriptorEvent`); `bucket` comes with the descriptor; REQ-ARC-05 lint (no fixture state/type
    name as literal or data key outside `server/src/presets/`).
- **Specs:** spec-004 §3 (v0.1 rows, identity addendum), §4 (rows 1–5a for the role-view `PUT`), §5
  (envelope, `read-error`, `X-Repo-State`); spec-001 §4 (direct reads); spec-002 §2/§3/§4/§5;
  spec-003 §8; `adr-001` D1a/D3/D6; REQ-ARC-04 ("git … and the working-tree files shown in Files"
  are read directly), REQ-INT-06 (`log` is on the git read list), REQ-SEC-06; `documentation.feature`
  (R-08.1 index of `paths.docs` without Memory and plan files, R-09.3). No approved spec fixes the
  **response bodies** of these routes beyond their purpose: spec-004 §3 says "every request and
  response body has a schema in `contracts/api/`" — the schemas are written here (as task-009 did for
  the identity), listed below; decisions taken within the spec's wording, reported to the
  coordinator:
  1. `GET /api/server` → `{version, range{min,max}, capabilities: <capabilities.json entries>,
     warnings}` (`server.schema.json`).
  2. `GET /api/p/:pid` → `{id, name, wingfoil{text, version, state, inRange, source},
     capabilities{capabilities, missing}, identity, roleViews, roleView, readOnly: DisabledReason[]
     (empty → writable: `not-in-team` when `identity.kind !== 'member'`, `version-unsupported`
     {range} when out of range), repository{state, head, localChanges: <count>}, dnaError?}`
     (`project.schema.json`). A failing `dna show` does not fail the header (S-27.1: the rest of the
     UI stays usable): the identity is matched against no member and `dnaError` carries the
     envelope's `error`.
  3. `GET /config` → one section per view, each `{data, warnings?}` or `{error}`: `dna`, `paths`,
     `workflows`, `types` (`memory.yaml` with every type's states **resolved**, spec-001 §4.1 rule)
     — a failed read stays confined to its section (S-27.1).
  4. `GET /elements[?archived=true]` → `{elements: [match + localChanges + descriptor?], warnings,
     message?, typesError?}`; `archived=true` adds the `deprecated`/`superseded` elements (lazy
     `--status` searches). Without a readable `memory.yaml` the elements come without descriptor and
     `typesError` says why.
  5. `GET /elements/:eid` → `{element, frontmatter, body, descriptor?, required?: [{field,
     missing}]}` (the type's `template.frontmatter.required`: G-01.3 "references, missing required
     ones flagged"); its read error → 502 `read-error`. `/history` → the `memory history` output.
  6. `GET /directives` → `{entries (each + mine: boolean for the current role view,
     `directivesForRoleView`), warnings}`; `/directives/:did` → `{entry, frontmatter, body}`.
  7. `GET /docs` → `{roots: paths.docs, documents: [{path}]}`: Markdown files under `paths.docs`,
     confined, minus the Memory directories (spec-002 §3 rule: the static prefixes of
     `memory.yaml` paths — custom `docs/04_memory/`, `docs/05_plans/` = the plan files), `.git`,
     `.wingfoil`, `node_modules`; symlinks not followed; bounded (`MAX_DOC_ENTRIES`).
  8. `GET /files/tree?path=` → one directory level `{path, entries: [{name, path, kind}]}`
     (names only, `.git` hidden), confined to the repository; `GET /files/content?path=` →
     `{path, size, content}`, in v0.1 only for a file of the documentation scope (row "v0.1
     (docs)"; REQ-ARC-04: never a Memory, `.wingfoil/` or `.git` file). Every traversal case
     (`..`, encoded `..`, absolute, NUL, escaping symlink) → **404 `not-found` with `detail
     {kind: "outside"}`** — the "outside the repository" marker of REQ-SEC-06 — and 0 bytes of the
     target read (realpath checked before any read); a missing file → 404 `{kind: "missing"}`;
     a repository file outside the v0.1 scope → 404 `{kind: "not-allowed"}`; a non-regular file
     (directory, FIFO) is never opened. spec-004 §5 has no code for a refused path: the 404
     `not-found` envelope with a `detail` keeps the table unchanged (open point for the
     coordinator: a dedicated `outside` code).
- **Actor events (spec-002 §3):** `GitReads.memoryLog(dirs)` runs the spec's `git log -p` (one
  process, allow-listed `log`), `parseMemoryLog` (pure) implements rules 1–4 (`wf(…)` subject regex,
  transition from the brackets or the `-status:`/`+status:` lines of `<id>.md`'s patch, `Approver:`
  first body line, multi-line `Reason:` block up to a trailing trailer paragraph, normalised as
  WingFoil's `normalizeReason`; no `+status:` → `from`/`to` `null` + a parse warning). Cached per
  HEAD in the `ProjectSnapshot` (spec-002 §4 key: HEAD only); an unborn HEAD has no events. The
  incremental `old..HEAD` read of §4 is **deferred** (v0.2 Updates/Timeline need the long log; v0.1
  re-parses once per HEAD) — reported.
- **Version:** the `Snapshots` registry owns one server-wide `VersionCache`; `SnapshotView.detected()`
  = `versions.detect(cli)` of the view's CLI generation (one `--version` per CLI resolution).
- **Descriptors:** memoised per view state (`SnapshotView.derived(name, compute)`), inputs from the
  same view: `memoryTypes()`, `dna()` members (none when it fails), `identified` (watched email ×
  members), `version {supported: inRange, range: "<min>–<max>"}`, `localChanges` (ids of marked
  matches).
- **Where:** `server/src/http/project-routes.ts` and `server/src/http/server-route.ts` (the
  routes), `server/src/reads/working-tree.ts` (docs index, tree, confined content),
  `server/src/git/memory-log.ts` (parse),
  `server/src/identity/snapshot-identity.ts` (watched identity source), `contracts/api/*.schema.json`
  + `contracts/src/api.ts` types; `runLauncher` registers the routes in the same `register`
  callback with the shared `snapshots`, store, identity source and UI version.
- **AC classification (T1):**
  - TT-SEC-06 / R-09.3 (API half) — **red-first**: unit (`test/server/reads/working-tree.test.ts`,
    recording read port):
    `..`, `%2e%2e`, `%2E%2E%2F`, absolute, `/etc/hosts`, NUL, a symlink to a file and to a folder
    outside → 404 `{kind:"outside"}`, the target never opened; bin (`local-security.test.ts`, custom
    fixture seeded): 100 % of the cases 404/outside with 0 bytes of the target in the body.
  - Actor events — **red-first**: unit on recorded logs (`test/server/git/memory-log.test.ts`: each
    operation, with and without brackets, multi-line reason, reason + `Co-Authored-By:`, non-`wf`,
    `wf(plan): finalize`, quoted `status:` value, missing `+status:`); fixture consistency
    (`test/server/snapshot/memory-events.test.ts`): on kanban, custom, unknown, events of §3 =
    the `wf` entries of `memory history` for **every** element (sha, operation, from, to, approver,
    reason).
  - Process audits — **red-first** (the real routes do not exist): `process-audit.test.ts` over the
    real routes: cold Memory list ≤ 6 CLI (expected 5 + 1 `git log`), reopened 0; 60 s idle with a
    stream 0 CLI.
  - Cached identity — **red-first**: `PUT role-view` on a warm cache → 0 processes;
    `GET /api/p/:pid` warm → 0 processes.
  - Route rows (spec-004 §3 v0.1): **red-first** route tests (`project-routes.test.ts`) on kanban/
    custom copies: shapes validate against `contracts/api/*`, 404 unknown pid/eid/did, 502
    `read-error` scoped to the element, `X-Repo-State` on every read, degraded `memory.yaml`,
    S-27.1 confined DNA failure.

### red / green / refactor (2026-10-06)

- **Red** (`ca8dab5`): `test/server/git/memory-log.test.ts`, `test/server/reads/working-tree.test.ts`,
  `test/server/http/project-routes.test.ts`, `test/server/snapshot/memory-events.test.ts`, the
  process audit and the timing test moved to the real routes (`test/server/http/read-console.ts`,
  the successor of task-010's `stand-in-app.ts`), new rows in `test/launcher/local-security.test.ts`.
  Failed for the expected reasons: missing modules `git/memory-log`, `reads/working-tree`,
  `http/project-routes`; `view.events is not a function`.
- **Green** (`c143cbb`), as designed:
  - `server/src/git/memory-log.ts` (`parseMemoryLog`, `eventsByElement`, `memoryDirectories`,
    `normalizeReason`) + `GitReads.memoryLog(dirs)` / `GIT_READ_ARGS.memoryLog` (spec-002 §3 command
    plus `--no-optional-locks -c core.quotePath=false`). Hunk lines are counted from the `@@` header,
    so content looking like a `+++` header is never read as one. The subject bracket also accepts
    the ASCII `->` WingFoil's audit reads (spec writes `→` only).
  - `ProjectSnapshot`: Memory events cached per HEAD + Memory directories (spec-002 §4), unborn HEAD
    → none, a parse warning logged `{pid, sha}`; `SnapshotView.events()`, `detected()` (the
    registry's server-wide `VersionCache`, `Snapshots.versions`), `derived(name, compute)`
    (per-state memo of computed bodies: descriptors, docs index).
  - `server/src/reads/working-tree.ts` (`documentationScope`, `documentationIndex`,
    `listDirectory`, `readWorkingTreeFile`, `TreeFs`, `WorkingTreeError` kinds `outside | missing |
    not-allowed | too-large`); `server/src/identity/snapshot-identity.ts`
    (`createSnapshotIdentitySource`, `identityOf`); `server/src/http/server-route.ts`,
    `server/src/http/project-routes.ts`; `server/src/presets/api.ts` (`ARCHIVED_QUERY`: the query
    name `archived` is a fixture state name, REQ-ARC-05); 13 schemas in `contracts/api/` and their
    types in `contracts/src/api.ts` (exported by the index).
  - `runLauncher`: the same `register` callback registers `GET /api/server`, the project routes,
    the role-view `PUT` (now with the snapshot identity source) and the event stream.
- **AC → tests:**
  - TT-SEC-06 — `working-tree.test.ts` (12 traversal cases, recording read port: 0 reads of any
    target; not-allowed for Memory, plan, `.wingfoil/`, `.git`, `node_modules`, non-doc files) and
    the bin (`local-security.test.ts`, custom fixture seeded, symlinks to a file and a folder
    outside): **20/20 = 100 %** of the cases (10 paths × `files/content` and `files/tree`) → 404
    `not-found` `detail.kind: "outside"`, the body without a byte of the target. R-09.3's screen
    closes in task-020.
  - Actor events — `memory-log.test.ts` (15) + `memory-events.test.ts`: on kanban, custom and
    unknown, the §3 events equal the `wf` entries of `memory history` for every element (sha,
    operation, from, to, approver, reason); one git process; a working-tree edit does not re-parse,
    a commit does.
  - Process audits on the real routes — `process-audit.test.ts`: cold Memory list **5 CLI**
    (`--version`, `dna show`, `paths`, `workflow list`, `memory search`) + **4 git** (rev-parse,
    status, user.email, the one `git log -p`), reopened twice **0 processes**; 60 s idle with a
    stream **0 CLI** (12 git: the periodic check).
  - Cached identity — `project-routes.test.ts`: on a warm cache `GET /api/p/:pid` and
    `PUT role-view` start **0 processes**, and the PUT is seen by the next header.
  - Routes — `project-routes.test.ts` (28): every body validated against its `contracts/api/`
    schema, `X-Repo-State` on every read, 404 for unknown pid (incl. `../..`, case variant) on all
    10 routes with 0 processes, unknown eid/did, 502 `read-error` scoped to one element (file over
    5 MiB → `shape`), unreadable `memory.yaml` → elements without descriptor + `typesError`, S-27.1
    (invalid `dna.yaml`: header 200 with `dnaError`, config section error, elements listed),
    not-in-team read-only, local-changes marker disabling the verbs, M-01.1/M-01.2 counts and
    buckets, R-08.1 docs index on custom. Bin: X-04.1 rows (401/403 Origin/403 `Sec-Fetch-Site`/404)
    for every read route and `GET /api/server`; X-04.3 now the literal **200** on `GET /api/server`
    (127.0.0.1 and `::1`).
- **Deviations (honest):**
  - Response bodies are decided here (design 1–8) — spec-004 §3 names the purpose of each route,
    not its body; the schemas in `contracts/api/` are now the contract. To confirm by the
    coordinator.
  - A refused working-tree path answers 404 `not-found` with `detail.kind` (spec-004 §5 has no
    `outside` code) — open point.
  - `test/launcher/role-view.test.ts` S-22.2 now polls (≤ 20 s) after a `git config user.email`
    change: the identity is the watched one, so the change is seen once the watcher moved the state
    (REQ-PERF-03 ≤ 5 s), not on the very next request — the intended effect of the AC.
  - spec-002 §4 incremental `old..HEAD` parse not implemented (whole log re-parsed once per HEAD);
    needed for the large fixture's Updates/Timeline (v0.2).
  - Without a readable `memory.yaml` the Memory directories are unknown: the docs index is empty
    and `/files/content` serves nothing (conservative for REQ-ARC-04).
  - A git read failure when opening a project (folder gone, not a repository) is a 500 `internal`
    (availability is task-008's).
  - `createLocalIdentitySource` (task-009) is no longer used by the launcher; kept with its tests.
- **Hand-overs:**
  - **task-008:** register the project-list routes in the same `register` callback of
    `runLauncher` (next to `registerServerRoute`/`registerProjectRoutes`); `local-security.test.ts`
    X-04.3 already checks the 200 on `GET /api/server` — add `GET /api/projects` beside it.
  - **task-016:** header = `GET /api/p/:pid` (`ProjectHeader`): `wingfoil.version ?? text`,
    "(from PATH)" when `source === 'path'`, `readOnly` reasons, `capabilities.missing`,
    `dnaError`; `PUT role-view` then refetch. `range` label in `version-unsupported` is
    `<min>–<max>`.
  - **task-017/018:** `GET /elements` → `elements[].descriptor` (bucket included) and
    `localChanges`; `typesError` → no buckets; resolved states in `GET /config` `types.data`;
    element panel: `GET /elements/:eid` (`required[]` for G-01.3, 502 `read-error` → error of that
    element), `/history`.
  - **task-019:** `GET /config` sections (DNA view shows `dna.error.message` — the CLI's text);
    `GET /directives` `entries[].mine` for "only mine"; `/directives/:did` body.
  - **task-020:** `GET /docs` (paths only, no titles), `GET /files/content?path=` (404
    `detail.kind`: `outside` → "outside the repository", `missing` → "broken link", `not-allowed`
    → a Memory/governance file: resolve it against `GET /elements` paths to open the panel, R-09.1).
- **Checks** (worktree, load 8–15 on 12 cores): `npm run -s typecheck`, `lint` clean ·
  `format:check` clean · `docs:api` OK · `npm run -s test:coverage` **69 files passed, 1 skipped;
  1042 passed / 1 skipped**, coverage **95.96 %** statements / 89.07 % branches / 96.42 % functions
  / 98.07 % lines (`server/src/http` 96.31 %, `memory-log.ts` 96.69 %, `working-tree.ts` 88.34 %) ·
  `test:e2e` 3/3 · `check_tasks.py` OK · `npm run test:timing` 3/3 at load 10.6 → 8.3:
  REQ-PERF-03 20/20, max 687 ms (now on the real routes); REQ-PERF-06 339–503 ms; TypeDoc 4573 ms.

### review round 1 (2026-10-06)

- Independent review: **FAIL** (1 major, minors, nits). Finding 2 (name collision with task-008)
  solved on 008's side; finding 9 (`confine.ts` read window, task-005 code) left to the
  coordinator. Fixed test-first — red `18b7a27` (36 failing for the expected reasons: the old
  framing parsed nothing of the NUL-framed records, `MemoryLogFormatError` missing, `docs/hard.md`
  in the index, `listDirectory` without scope, `eventsError` absent / a 500 on a failed `git log`):
  - **1 (major, security) framing.** A `--reason` holding `\x1e`/`\x1f`/`\x1d` could forge a whole
    event or a diff block. Now as WingFoil bug-050 / task-086: `MEMORY_LOG_FORMAT =
    '%H%x00%aI%x00%an <%ae>%x00%s%x00%b%x00'` (git refuses a NUL in a commit message), records
    recovered by arity, the patch = the piece after the body up to the next record's sha
    (`\n<sha>$`), every sha (`^[0-9a-f]{40}$`, or 64 for SHA-256 repositories) and date validated; an
    output of another shape → `MemoryLogFormatError` (the parse fails as a whole, never guessed).
    Tests: whole-event forgery in a reason, a `\x1d`-injected diff/status block in a body (ignored,
    also when the real patch has no status), several records, malformed outputs. **Pending spec
    amendment:** spec-002 §3 still prescribes the `%x1e`/`%x1f`/`%x1d` format literally (the
    coordinator proposes the amendment to the user). Residual: a text file with a NUL beyond git's
    8000-byte binary check would put a NUL in the patch — the arity/sha/date validation then
    refuses the output (eventsError), it cannot forge an event silently.
  - **3** `/files/content` serves only documents (`.md`, `.markdown`, `inDocumentationScope`); a
    trailing `/` and a hard-linked file (`nlink > 1`, `TreeFs.links`) → `not-allowed`; also with
    `paths.docs: ['.']` (`package.json` refused). Hard-linked files are left out of the index too.
  - **4** `/files/tree` lists only documentation folders (`inDocumentationFolder`: under a docs root,
    not Memory/governance/`.git`/`node_modules`), entries filtered to documentation folders and
    documents; elsewhere (the root included, unless `paths.docs` has `.`) → `not-allowed` until v0.3.
    Confinement (`outside`) is judged before the scope, so TT-SEC-06 is unchanged (20/20 on the bin).
  - **5** the events are read outside the per-state memo and settled: a failed or overflowing
    `git log` (or a refused shape) gives descriptors computed without events plus `eventsError`
    (`internal`, logged `{kind}` at warn) on `/elements` and `/elements/:eid` — no 500, not kept for
    the state. Schemas `elements`/`element` gain `eventsError`. Test with a runner whose `git log`
    ends `overflow`.
  - **6** an event counts only when the commit's patch touches `<id>.md` (as `memory history`):
    otherwise excluded. Test.
  - **7** the log read adds `-c log.showSignature=false` and `--no-textconv` (`--no-ext-diff` kept).
  - **8** `paths.governance` folders (plus `.wingfoil`) are governance in the scope; folder names
    compared in NFC.
  - **10** the docs index is walked per request (no longer memoised per state: a git-ignored
    document does not move the state); git-ignored documents are listed — documented in the module
    comment (no git command needed, REQ-INT-06 has no `check-ignore`).
  - **11** design-note file names corrected (`files.ts` → `reads/working-tree.ts`, tests).
- Checks (load 7–10): typecheck, lint, format:check clean · `docs:api` OK · affected files
  (`test/server/http/project-routes.test.ts`, `test/server/git`, `test/server/reads`,
  `memory-events.test.ts`) 177/177 · `process-audit.test.ts`, `local-security.test.ts`,
  `role-view.test.ts` 71/71 (cold Memory list 5 CLI + 4 git, warm 0; 60 s idle 0 CLI; TT-SEC-06
  20/20). Full `test:coverage` (load 3.4 → 14.3): 1063 passed, 1 skipped, coverage 96.03 % /
  89.31 % branches.
