---
id: task-007-local-state-store
type: task
title: "Local state store"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-002-launcher-and-http-server-skeleton"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The local state file of spec-006: location per platform and `WINGFOIL_UI_STATE_DIR`, `state.json` schema, opaque project ids, atomic writes, corrupt and newer-version handling, warnings in `GET /api/server`, no secrets.

**Backlog items:** TT-ARC-08, TT-SEC-04, TT-SEC-09

## Acceptance Criteria

- **TT-ARC-08** (REQ-ARC-08 — Local state outside the repositories): [boolean] After the full e2e suite, `git status --porcelain` of every fixture prints only the changes the scenarios made on purpose, and the state survives a server restart. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-17.1, S-17.2, S-22.3.
- **TT-SEC-04** (REQ-SEC-04 — Opaque project ids): [boolean] Across the e2e suite, 0 requested URLs contain a fixture's absolute path; a request for the id `../../etc` gets 404. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-05.1, X-05.2.
- **TT-SEC-09** (REQ-SEC-09 — No secrets stored): [boolean] A secret scan over `ui.yaml`, the local state directory and the logs after the e2e suite reports 0 findings. *Verified by:* e2e (secret scan).
  Scenarios (`@v0.1`): X-02.1.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-015-project-switcher: S-17.1, S-17.2, X-05.1, X-05.2, X-02.1; task-016-project-header-version-identity-and-role-view: S-22.3.

## Implementation Notes

- `spec-006-local-state-store` (whole); `adr-001` D10; `spec-004` §3 (`GET /api/server` warnings).
- `dl-002` (permissions left to WingFoil): the state file holds no permission or role grant.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-002 Execution Notes read — `runLauncher` start
  sequence (options → token → `buildApp` → `listenLoopback` → running line), §3.2 slots in after
  the option parsing and before `buildApp`; `EXIT.stateDirInsideProject` (4) and `EXIT.unexpected`
  (70) exist; launcher texts only in `server/src/i18n/en.json` (`launcher.*`), browser texts are
  web-catalogue keys; `onStop` hooks; `buildApp({ register })` for later routes; in-process
  `test/server/launcher/start.test.ts` plus the bin black-box `test/launcher/` (`startLauncher`,
  already run with `WINGFOIL_UI_STATE_DIR` under a temp root). task-001 notes read (via task-002's
  dependency) — `harnessEnv` isolates `HOME`/`USERPROFILE`/`APPDATA`/XDG, tests under `test/`,
  TypeDoc `notDocumented` on `server/src` and `contracts/src`, coverage ≥ 80 %.
- **Specs:** no gap. spec-006 §1, §2, §4, §5 are implemented whole; spec-007 §3.2/§6 (read before
  listening, exit 4); spec-008 §5 (`state.corruptKept`, `state.newerVersion` are web-catalogue
  keys sent as `{ key, args }`; the exit-4 line is a server `launcher.*` message). Details the spec
  leaves open, decided here (no interface change): the corrupt-copy timestamp is ISO 8601 basic
  UTC (`state.json.corrupt-20261005T101530Z`, no `:` so it is a valid Windows name, `-<n>`
  appended on a clash); a relative `WINGFOIL_UI_STATE_DIR` is resolved against the working
  directory; a `version` > 1 file is never renamed (even when its known fields do not validate:
  the state is then empty and read-only) so a newer build's list is never moved aside.
- **Layout:** the schema lives where spec-006 §2 puts it, `contracts/state/state.schema.json`;
  the matching TypeScript types in `contracts/src/state.ts` (hand-written — no generator exists
  yet, adr-002 — and checked against the schema by a test). The server reads the schema JSON at
  run time (like the catalogue) and validates it with Ajv (declared in `server/package.json`).
  `server/src/state/`: `location.ts` (directory per platform), `ids.ts` (`p_` + 12 Crockford
  base32), `store.ts` (the port, adr-002), `file-store.ts` (adapter: atomic write, modes, corrupt
  and newer handling), `memory-store.ts` (in-memory fake).
- **Scope boundaries:**
  - task-007 owns the store: location, file shape, ids, read/write rules, warnings, no secrets
    (remote userinfo stripped on every write, rejected by the schema), the exit-4 start check and a
    reusable "state dir inside this path" predicate.
  - task-008 owns the project-list routes and spec-006 §3 refusals (duplicate detection, remote
    normalisation, `state-dir-inside-project` at add, availability, `projects` event): it uses the
    store's `transaction` (re-read → check → write under the lock) so a refusal leaves the file
    unchanged.
  - task-012 owns `GET /api/server`: it returns `store.warnings()` as `warnings`. task-009/016 own
    the role-view route and the fallback of a role no longer held; the store only keeps
    `roleView`. Routes with `:pid` (404 for `../../etc`) are task-008/012; the store's lookup is an
    exact string compare and is unit-tested with `../../etc`.
- **AC classification (T1)** — all **red-first** (no state code exists):
  - TT-ARC-08 (S-17.1, S-17.2, S-22.3): unit — round-trip, order kept, role view per project kept
    across a re-open (restart); bin black-box — a console started twice on the same state
    directory leaves `state.json` byte-identical and the kanban fixture's `git status --porcelain`
    empty; exit 4 when the state directory lies inside a listed project.
  - TT-SEC-04 (X-05.1, X-05.2): unit — id format, 60 random bits, uniqueness, never derived from
    the path; lookup of `../../etc`, a path or a case variant finds nothing.
  - TT-SEC-09 (X-02.1): unit — a remote with credentials is stored without them, the schema
    refuses a userinfo remote, a secret scan helper (`test/harness/secret-scan.ts`) over the state
    directory finds no token / credential / environment value after store operations and a
    console run.
  - spec-006 §6 units: location per platform and with `WINGFOIL_UI_STATE_DIR`; schema round-trip;
    corrupt file kept and replaced (+ warning); newer version read-only (+ warning, no write);
    atomic write (a failed write leaves the previous file whole); modes 0700/0600 (POSIX).
- **e2e closure:** the screens of S-17.1, S-17.2, X-05.1, X-05.2, X-02.1 close in task-015 and
  S-22.3 in task-016, as the task states; the route-level 404 of X-05.2 is proved by task-008/012
  through the store lookup tested here.

### red / green / refactor (2026-10-05)

- **Red:** schema, ids, location, store (both adapters through one `describe.each`), file adapter
  (missing/corrupt/newer, modes, two consoles), atomic write (mocked `rename`/`sync`, and a child
  process SIGKILLed mid-writes), in-process start (exit 4, corrupt at start) and bin tests written
  first; 9 test files failed for the right reason (module or schema file missing).
  `test/harness/secret-scan.ts` and its self-test were written together (test infrastructure,
  characterization). Green on the first full run.
- **Built:** `contracts/state/state.schema.json` (draft-07; ids `p_` + 12 Crockford base32, absolute
  POSIX/Windows paths, remotes without userinfo, `addedAt` UTC, `settings`/`actionLog` open for
  v0.2) and `contracts/src/state.ts` (`ProjectEntry`, `StateFile`, `StateWarning`, exported by
  `@wingfoil-ui/contracts`). `server/src/state/`: `location.ts` (`resolveStateDir`,
  `findProjectContaining`, `isWithin`), `ids.ts`, `schema.ts` (Ajv, unique ids, known fields of a
  newer file), `store.ts` (port `StateStore`, `transaction`, `add`/`remove`/`update`,
  `stripUserinfo`, `openStore` over a backend), `file-store.ts`, `memory-store.ts`.
  `runLauncher` reads the state after the option parsing and before `buildApp`; exit 4 with
  `launcher.stateDirInsideProject` naming both paths; the state warnings are also logged (stderr).
  `LauncherIo.stateDir` (required) is resolved in `main.ts`.
- **Build layout:** `@wingfoil-ui/contracts` exports `types: ./src/index.ts`; `server/tsconfig.json`
  references `../contracts`, so `tsc -b server` builds contracts first. The server imports only
  types from contracts (erased at run time); the schema JSON is read from
  `contracts/state/state.schema.json` relative to the module (same depth from `src` and `dist`).
  `ajv` declared in `server/package.json` (already installed through Fastify; no download).
- **Decisions:** mutations in a read-only (newer-version) store apply in memory for the run and are
  never written ("changes are not saved"); the store re-reads before every mutation except when
  read-only; a transaction that throws writes nothing (task-008's refusals); every write is
  validated against the schema (a relative path or a duplicate id is refused with
  `InvalidStateError`); `remote` userinfo is stripped on every write, the scp-like `user@host:path`
  is kept (no password possible); a corrupt file another console already moved aside is not
  reported twice (re-read on `ENOENT`). The directory is fsynced after the rename (POSIX, best
  effort).
- **Deviations:** none from the ACs. The REQ-SEC-04 route-level 404 and the REQ-ARC-08 /
  REQ-SEC-09 fit criteria over the *full* e2e suite cannot be measured before the routes and
  screens exist; here they are proved on the store and on the bin (below) and close as listed in
  the e2e closure.
- **Checks:** `npm run test:coverage` 236/236 tests, 25 files; coverage 94.85 % statements /
  88.93 % branches / 93.1 % functions / 96.02 % lines (`server/src/state` ≈ 98 % statements) ·
  `npm run test:e2e` 3/3 · typecheck, lint, format:check clean · `docs:api` OK. The killed-write
  test was checked to fail (`Unexpected end of JSON input`) when the adapter writes `state.json`
  in place. No flaky test seen in two full runs.
- **Hand-overs:**
  - **task-008** — use `store.transaction(draft => …)` for every add: the duplicate checks (same
    realpath, normalised remote), `findProjectContaining(stateDir, [candidate])` for
    `state-dir-inside-project`, then `draft.projects.push(draft.create({ path, name, remote }))`;
    throwing inside leaves the file unchanged. `store.get(pid)` is the exact-string lookup for the
    404 of unknown ids (X-05.2 at route level). The store is opened in `runLauncher` (`state`);
    pass it to the routes through `buildApp({ register })`. Run the secret scan
    (`test/harness/secret-scan.ts`) after the clone tests with a credential URL.
  - **task-012** — `GET /api/server` returns `warnings: store.warnings()` (`state.corruptKept`
    `{ file }`, `state.newerVersion` `{}`); route and domain tests can use
    `createMemoryStateStore()`.
  - **task-013** — the web catalogue needs `state.corruptKept` and `state.newerVersion` (spec-006
    §4 text for the latter).
  - **task-009/016** — `store.update(pid, { roleView })` for `PUT /api/p/:pid/role-view`; the
    fallback of a role no longer held is applied on read, not stored.
  - **task-015/016** (e2e closure) — S-17.1/S-17.2/X-05.x/X-02.1 and S-22.3 through the screens;
    the full-suite secret scan of REQ-SEC-09 over the state directory and the logs.
