---
id: task-025-installable-package-and-e2e-smoke-gaps
type: task
title: "Installable package and e2e-smoke gaps"
status: in-progress
release: "v0.1"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.1","governance","e2e-smoke"]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-007-packed-package-cannot-start-and-would-ship-private-and-development-files"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness", "task-002-launcher-and-http-server-skeleton", "task-021-accessibility-page-title-and-performance-pass"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.1, phase `e2e-smoke` (plan `e2e-smoke-rel-v0.1-plan`, decisions
RV-3 and ES-1…ES-7): close the gaps the mapping of `.wingfoil/workflows/custom/e2e-smoke.yaml` onto
the existing suites found.

- **launch** — the packed package cannot start and would ship private and development files
  (bug-007, absorbed here, dl-045 pattern). US-S-01 ("start the console with `npx wingfoil-ui`") and
  TT-ARC-01 are v0.1 items (covered by task-002), but every test starts `node bin/wingfoil-ui.cjs`
  inside the checkout; nothing exercises the installed package.
- **fixture-project** — the fixtures run `wingfoil init --template Kanban` only; the pinned CLI
  (0.2.2) also offers `Scrum`, never opened by the console in a test.
- **drive-browser** — the check "every commit is a CLI `wf(…)` commit or a `chore(ui)` commit
  touching only `.wingfoil/ui.yaml`" has no test; in v0.1 the UI makes no governed write, so the
  check is "a console session leaves the observed repository's history unchanged".

Governance task (`module: governance`, `ref: GOV`) because `check_tasks.py` requires every backlog
item to be listed by exactly one task and US-S-01 / TT-ARC-01 already belong to task-002; it is
run through the full dev-loop (worktree, TDD, independent review until PASS, approver gates).
The package stays `private: true` and is not published (RV-8).

**Backlog items:** GOV (governance — release validation; serves US-S-01, TT-ARC-01, X1 via the e2e-smoke gate)

## Acceptance Criteria

- **AC-1 (bug-007, packaging)** `npm pack` produces a tarball whose file list is an explicit
  allow-list: `bin/wingfoil-ui.cjs`, the built server, web and contracts code the runtime needs,
  the message catalogues the bin and server read, `package.json`, `LICENSE`, `README.md`,
  `CHANGELOG.md`; nothing git-ignored or development-only (`export*/`, `.idea/`, `.mcp.json`,
  `test/`, `docs/`, sources not needed at runtime, `node_modules/` of the workspaces). The runtime
  dependencies are declared so that an install of the tarball resolves them, including
  `@wingfoil-ui/contracts` (bundled, inlined or otherwise resolvable — decided at design);
  `prepack` builds. `private: true` and version are unchanged by this task.
- **AC-2 (packaging guard)** A Vitest test runs `npm pack --dry-run --json` (or equivalent) and
  fails when the tarball holds a path outside the allow-list or misses a required runtime file.
- **AC-3 (launch smoke)** A smoke test packs the repository, installs the tarball into an empty
  temporary folder (offline-capable where possible, e.g. `--prefer-offline`), runs
  `npx wingfoil-ui --no-open` there with an isolated `WINGFOIL_UI_STATE_DIR` and home, asserts the
  URL line with the token, an authenticated `GET` of the UI and of one API route, and a clean stop
  (SIGINT → exit 0, no process left). Also `npx wingfoil-ui --version` and `--help` exit 0.
  It runs in an explicit script (e.g. `npm run test:smoke`), not in the default suite if it needs
  network or more than a few minutes; its run time is recorded.
- **AC-4 (Scrum fixture)** The fixture builder offers a `scrum` kind (`wingfoil init --template
  Scrum` with the pinned CLI, a few elements in different states); an e2e test opens it in the
  console: the Memory list renders its elements, the element panel opens one, and axe reports 0
  serious/critical violations in both themes.
- **AC-5 (no commit)** An e2e test drives the read views of a fixture (Memory list, element panel,
  DNA, Directives, Team, Documentation, switcher) and asserts the fixture's `HEAD`, refs and
  working tree are unchanged afterwards (`git rev-parse`, `git status --porcelain`).
- **AC-6** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e`, `docs:api`
  green; `check_tasks.py` OK; `test/README.md` and the user docs (README install section,
  `docs/cli-reference.md`) updated where the package or the new scripts change them; bug-007
  follows this task's state (bug.sync_state).

## Implementation Notes

- The launcher resolves `server/dist/main.js` relative to `bin/` and reads
  `server/src/i18n/en.json` (`bin/wingfoil-ui.cjs` `launcherMessage`): the allow-list must keep both
  reachable, or the bin must read the catalogue from the built tree.
- `contracts` exports `./src/index.ts` types; check what `server/dist` imports at runtime.
- `bin/wingfoil-ui.cjs` is mode 100644 in git (UD-8): npm sets the bin link executable on install;
  decide at design whether to set the mode in git too.
- Directive `security-secrets`: nothing from `export*/` may ever be packed.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-11)

- **Read:** this task, bug-007, plan `e2e-smoke-rel-v0.1-plan` (branch `design/e2e-smoke_v0.1`,
  mapping, ES-1…ES-7), the Execution Notes of task-001, task-002 (hand-over "a `files` list, root
  `dependencies` (or a bundle) and an `npm pack` → `npx ./tarball` smoke"), task-021 (`SCREENS`,
  W5-11); spec-007 (§1 synopsis, §2 Node.js check, stop and exit statuses); `test/README.md` v0.23;
  `test/harness/fixtures/`, `test/e2e/support/` (`fixtures.ts`, `screens.ts`, `console.ts`),
  `test/launcher/launcher.ts`, `test/global-setup.ts`, `vitest*.config.ts`; `bin/wingfoil-ui.cjs`;
  `README.md` *Install and run*, `docs/cli-reference.md`, CHANGELOG `[0.1.0]`; the user-docs plan
  UD-8; `.wingfoil/workflows/custom/e2e-smoke.yaml`; directives (`security-secrets`).
- **Findings (measured on this branch, prototype in the session scratchpad — a copy made with
  `git archive`, never the checkout):**
  - `server/dist` has **no runtime import of `@wingfoil-ui/contracts`**: every import from it is
    `import type` (`verbatimModuleSyntax`), and `contracts/src` exports types only. Bare imports of
    the built server: `fastify`, `@fastify/static`, `@formatjs/intl`, `ajv`, `pino`, `yaml` and
    `node:*`. What the server needs from `contracts/` at run time is **JSON data** read relative to
    `import.meta.url`: `contracts/{api,cli,files,state}/*.schema.json`, `capabilities.json`,
    `capabilities.schema.json`, `matrix.json`. Other run-time reads: `../../package.json`
    (version), `../../web/dist/`, `server/src/i18n/en.json` (bin and `i18n/messages.ts`).
  - Prototype allow-list (`files`, recommended options below): **119 files, 511 kB packed,
    1.4 MB unpacked** (today 707 files). npm 11 does not add `CHANGELOG.md` by itself: it must be
    listed. The root `.gitignore` (`dist/`) does not interfere with `files`.
  - Installed from the tarball into an empty folder: `npm install <tgz> --prefer-offline` **2 s**
    (77 packages, same versions as `package-lock.json`); `npx wingfoil-ui --version` → `0.0.0`,
    `--help` → usage, exit 0; `npx wingfoil-ui --no-open` prints the URL line in ~0.8 s; `GET /`
    200 (index.html), `GET /api/server` with the Bearer token 200. Clean build (`npm run build`)
    11 s at load 7.5.
  - Strict `--offline` fails after a plain `npm ci` (ENOTCACHED: `npm ci` caches tarballs, not the
    registry metadata a range install needs); it works on a cache that has the metadata.
  - `npx --no wingfoil-ui --version` prints **npm's** version (`--no` swallows the next word);
    `npx --no -- wingfoil-ui --version` and plain `npx wingfoil-ui --version` reach the bin.
  - Stop through `npx`: SIGINT to the **server process** → it stops, `npx` exits **0**, nothing
    left. SIGINT to the **whole process group** (what Ctrl-C in a terminal does) → the server
    stops cleanly but `npx` (npm + `sh -c`) ends **by SIGINT** (shell status 130): npm's behaviour,
    not the bin's; nothing left in either case.
  - `npm pack` keeps the git mode of the bin: 644 today (npm's bin-links makes the installed file
    executable anyway, verified), 755 after `chmod +x`.
  - The Scrum template of the pinned CLI 0.2.2 differs from Kanban only in `dna.yaml`
    (`methodology: Scrum`, stack) and the delivery sub-workflow (`scrum-delivery.yaml`); the Memory
    schema (types, default state machine draft → pending → approved, `deprecated`) is the same.
  - `FixtureKind` is used as `Record<FixtureKind, …>` by `test/server/descriptor/standard.ts` and
    iterated (`FIXTURE_KINDS`) by the contract sample capture and the descriptor contract test.
  - `test/e2e/support/screens.ts` (`SCREENS`, task-021) already walks the 16 v0.1 screens on a
    kanban + custom console (switcher, add/remove dialogs opened not confirmed, Memory list, panel,
    role view, DNA, Directives, Team, Documentation, …).
- **Decisions — reported to the coordinator, awaiting the go:** ES-8 … ES-17 below. Nothing that
  depends on them is implemented before the answer.

#### Design decisions to approve (recommended option marked ★)

- **ES-8 `@wingfoil-ui/contracts` in the installed package.**
  (a) ★ Keep it **type-only**: nothing of `contracts/src`/`contracts/dist` is packed, only the JSON
  contracts the server reads; a guard test fails if any `server/dist` file imports
  `@wingfoil-ui/*` (or any bare specifier not in the root `dependencies`), so a future value
  export cannot slip through. No build change.
  (b) Bundle `server/` with esbuild into one file (contracts and deps inlined): new devDependency,
  and every `new URL('../../…', import.meta.url)` read (schemas, catalogue, `web/dist`,
  `package.json`) must be reworked for the bundle location.
  (c) Pack `contracts/dist` and declare `@wingfoil-ui/contracts` as a bundled/`file:` dependency:
  fragile with workspaces, ships code nobody loads.
- **ES-9 Runtime dependencies.**
  (a) ★ Root `dependencies` = exactly `server/package.json` `dependencies` (same ranges; the
  server workspace keeps them), lockfile root entry updated; the guard test asserts equality and
  that every bare import of `server/dist` is declared.
  (b) Move them from `server/package.json` to the root only (single source; the server workspace
  then declares none).
  (c) Bundle (ES-8 b): no runtime dependencies.
  Web dependencies stay where they are (Vite bundles them into `web/dist`).
- **ES-10 Allow-list and catalogue.** `files` = `bin/wingfoil-ui.cjs`, `server/dist/**/*.js`,
  `server/src/i18n/en.json`, `web/dist/`, `contracts/{api,cli,files,state}/*.schema.json`,
  `contracts/capabilities.json`, `contracts/capabilities.schema.json`, `contracts/matrix.json`,
  `CHANGELOG.md` (npm adds `package.json`, `README.md`, `LICENSE`); no `.d.ts`, no source maps
  (the `sourceMappingURL` comments stay, harmless), no `contracts/dist`, no `.npmignore`;
  `scripts.prepack = "npm run build"`. The catalogue:
  (a) ★ packed at its source path `server/src/i18n/en.json` (the only file of `server/src`); bin
  and `messages.ts` unchanged.
  (b) Copied to `server/dist/i18n/en.json` by the build; bin and `messages.ts` read it there (a
  checkout then needs a build before the bin can print even the Node.js refusal).
  (c) Inlined into the bin at build time (generated file; the bin is no longer hand-written).
- **ES-11 Packaging guard (AC-2), default suite.** `test/package/pack.test.ts` (Vitest, in `npm
  test` / `test:coverage`): `npm pack --dry-run --json --ignore-scripts` (~1 s, no build), then
  (1) every path matches the allow-list patterns, with explicit messages for `export*/`, `.idea/`,
  `.mcp.json`, `test/`, `docs/`, `node_modules/`, `*.map`, `*.d.ts`, `*.ts`; (2) the required
  files are present: bin, `package.json`, `LICENSE`, `README.md`, `CHANGELOG.md`, the catalogue,
  one `server/dist/**/*.js` per `server/src/**/*.ts` (non-test), every contracts JSON tracked by
  git, `web/dist/index.html` and every asset it references; (3) dependencies (ES-8/9);
  (4) `prepack` builds, `private: true`; (5) the bin is packed with mode 755 (if ES-15 a). Since
  `web/dist` must exist:
  (a) ★ `test/global-setup.ts` also builds `web` (Vite, ~1–2 s) after `tsc -b server`.
  (b) The guard checks the web files only when `web/dist` exists (silently weaker on a fresh
  checkout).
  (c) The guard builds itself (races with the bin tests that read `server/dist`).
- **ES-12 Launch smoke (AC-3): script, offline mode, duration.**
  `test/smoke/launch.smoke.test.ts`, its own `vitest.smoke.config.ts`, script **`npm run
  test:smoke`**, excluded from `test` / `test:coverage` (its `npm pack` runs `prepack` = a full
  build that rewrites `server/dist` under the bin tests running in parallel). Steps: `npm pack
  --pack-destination <tmp> --json` (real `prepack`); install into `<tmp>/app` (a `package.json`
  `{ "private": true }`) with the user's npm cache (`npm config get cache`, read before isolating
  `HOME`); then with `harnessEnv` (isolated home/XDG/git) + `WINGFOIL_UI_STATE_DIR=<tmp>/state`:
  `npx --no -- wingfoil-ui --version` (= `package.json` version, exit 0), `--help` (usage, exit
  0), `--no-open` run (URL line regex; `GET /` 200 with the app's `<script>` asset 200; `GET
  /api/server` 401 without and 200 with the Bearer token, `version` equal to `package.json`);
  installed bin executable; each phase's duration printed (pack, install, start). Expected run
  time **~20–40 s** warm (build 11 s, pack < 1 s, install 2 s, four bin runs ~3 s); `--no` + `--`
  forbids a registry fallback of `npx`. Install mode:
  (a) ★ `--prefer-offline`: no network when the cache has the packages and metadata (this
  machine); on a cold cache npm fetches only the missing metadata/tarballs; the script is
  explicit, so a network need never hits the default gates.
  (b) Strict `--offline`: no network ever, but fails after a plain `npm ci` (metadata not cached),
  so it needs a documented `npm cache add` warm-up step.
  (c) A local registry (e.g. Verdaccio): fully offline and closest to a publish, but a new
  devDependency and ~10 s more.
- **ES-13 Stop in the smoke (AC-3 "SIGINT → exit 0").** `npx` adds npm + `sh -c` around the bin.
  (a) ★ Both: run 1 sends SIGINT to the server process (found as the `node` leaf of the `npx`
  process group) → `npx` exit 0, group empty; run 2 sends SIGINT to the whole group like Ctrl-C →
  `npx` ends by SIGINT (npm), `WingFoil UI stopped` printed, group empty. ~1 s more. The AC wording
  "exit 0" is read as the bin's status; the Ctrl-C status of `npx` is documented (ES-17).
  (b) Only run 1 (literal AC, not what a terminal does).
  (c) Only run 2 and amend AC-3 to "the server stops cleanly, `npx` reports the signal".
- **ES-14 Scrum fixture (AC-4).**
  (a) ★ New kind `scrum` in the builder (`FixtureKind = BddFixtureKind | 'scrum'`); `FIXTURE_KINDS`
  stays the three BDD kinds (typed `BddFixtureKind`, also `STANDARD`), so contract samples and
  descriptor tables are not regenerated. Content (`init --template Scrum`, `dna.project.name`
  `scrum`, standard team, Alex as user): task *Login story* draft; task *Search story* pending;
  task *Export story* approved; bug *Burndown off by one* submitted then rejected (draft with a
  rejection); decision-log *Two-week sprints* approved; task *Obsolete spike* deprecated
  (`memory deprecate`). e2e `test/e2e/scrum.spec.ts`: Memory list shows the six elements with
  their state labels; the element panel opens *Search story* (title, state, history); DNA shows
  the methodology *Scrum*; axe 0 serious/critical on Memory list, panel and DNA in both themes.
  (b) Add `scrum` to `FIXTURE_KINDS`: contract samples and descriptor rows for Scrum too (more
  coverage, regenerates `test/contracts/samples`, larger diff, outside the AC).
  (c) A standalone builder like `large.ts` (not a `FixtureKind`): the e2e worker fixture needs a
  second accessor.
- **ES-15 "No commit" check (AC-5).**
  (a) ★ `test/harness/repo-state.ts`: `snapshotRepo(dir, env)` = `HEAD`, `git for-each-ref`
  (name + object), `git stash list`, `git status --porcelain=v1 --untracked-files=all --ignored`
  (run with `GIT_OPTIONAL_LOCKS=0`), the hash of `.git/index` and `.git/config`; `diffRepo(a, b)`
  lists the differences and any new commit (`git rev-list` + subjects, so v0.2 can turn it into
  the "`wf(…)` / `chore(ui)` only" rule). Unit test `test/harness/repo-state.test.ts` proves each
  kind of change is detected (commit, new ref, untracked file, index write). e2e
  `test/e2e/no-commit.spec.ts`: `startScreensConsole` (kanban + custom, Morgan), snapshot both
  repositories, walk every entry of `SCREENS` (switcher, dialogs opened, Memory list, panel, role
  view, DNA, Directives, Team, Documentation, …), snapshot again: equal; the visible check of each
  screen is the `SCREENS` ready condition.
  (b) An automatic after-each check in `support/fixtures.ts` for every spec: broadest, but specs
  that mutate fixtures on purpose (`mutateAndWait`, `commitFile`, add/clone) need opt-outs.
  (c) A server-side process audit forbidding write-class git/CLI arguments: not a user-level e2e,
  partly exists already.
- **ES-16 Executable bit of `bin/wingfoil-ui.cjs` (UD-8).**
  (a) ★ Set it in git (`git update-index --chmod=+x`, 100755): the tarball carries 755 (guard
  asserts it), `./bin/wingfoil-ui.cjs` works from a checkout; the docs keep `node bin/…` (works on
  every OS); UD-8 closed by this task.
  (b) Keep 100644: npm's bin-links sets the mode on install (verified); the smoke asserts the
  installed file is executable.
  (c) Keep 100644 and set the mode in `prepack` (`chmod`): no git change, but `npm pack` then
  differs from the tree.
- **ES-17 Documentation.**
  (a) ★ README *Install and run*: keep the checkout path, add "Install from a package"
  (`npm pack` in a checkout → `npm install <tarball>` in a folder → `npx wingfoil-ui`, not on npm
  yet, Node 22.12); `docs/cli-reference.md`: `npx wingfoil-ui` form next to `node bin/…`, note that
  Ctrl-C under `npx` reports the signal (status 130) while the console itself stops normally,
  version line bumped; CHANGELOG `[0.1.0]`: the install-from-package line; `test/README.md` 0.24:
  `test:smoke`, `test/package/`, `test/smoke/`, the `scrum` fixture, `repo-state`,
  `scrum.spec.ts`, `no-commit.spec.ts`. No new tech spec: the tests and `files` are the package
  contract (spec-007 already names `npx wingfoil-ui`).
  (b) Only `test/README.md` and `cli-reference.md` (README stays checkout-only).
  (c) As (a) plus a spec-007 §8 "Package contents" (amendment applied by the coordinator on
  `main`).

#### File layout (recommended options)

- `package.json`: `files`, `dependencies`, `scripts.prepack`, `scripts.test:smoke`;
  `package-lock.json` root entry; `bin/wingfoil-ui.cjs` mode 100755 (ES-16 a).
- `test/global-setup.ts` (web build), `vitest.smoke.config.ts`, `test/package/pack.test.ts`,
  `test/package/allow-list.ts` (patterns and required files, shared with the smoke),
  `test/smoke/launch.smoke.test.ts`.
- `test/harness/fixtures/builder.ts` (`scrum`), `test/harness/fixtures.test.ts` (Scrum build),
  `test/server/descriptor/standard.ts` (`BddFixtureKind`), `test/harness/repo-state.ts` + test,
  `test/e2e/scrum.spec.ts`, `test/e2e/no-commit.spec.ts`.
- Docs: `README.md`, `docs/cli-reference.md`, `CHANGELOG.md`, `test/README.md`.
- `tsconfig`/ESLint: `vitest.smoke.config.ts` and `test/smoke/` follow the existing timing-suite
  pattern. Nothing under `server/src`, `web/src`, `contracts/src` changes.

#### Test plan (AC → test file : test)

| AC | Test |
|----|------|
| AC-1 | `test/package/pack.test.ts` : `AC-1 runtime dependencies are declared and no workspace package is imported at run time`, `AC-1 prepack builds and the package stays private`; `test/smoke/launch.smoke.test.ts` (end to end) |
| AC-2 | `test/package/pack.test.ts` : `AC-2 every packed path is on the allow-list`, `AC-2 every runtime file is packed`, `AC-2 the bin is packed executable` |
| AC-3 | `test/smoke/launch.smoke.test.ts` : `AC-3 the installed package prints its version and help`, `AC-3 npx wingfoil-ui --no-open serves the UI and the API with the token`, `AC-3 SIGINT to the server stops it, npx exits 0, no process left`, `AC-3 Ctrl-C (SIGINT to the process group) stops it, no process left` |
| AC-4 | `test/harness/fixtures.test.ts` : `AC-4 the scrum fixture is a Scrum project with elements in every state`; `test/e2e/scrum.spec.ts` : `AC-4.1 Memory list renders the Scrum elements`, `AC-4.2 the element panel opens a Scrum element`, `AC-4.3 DNA shows the Scrum methodology`, `AC-4.4 axe: 0 serious/critical on the Scrum screens in both themes` |
| AC-5 | `test/harness/repo-state.test.ts` : `AC-5 the snapshot detects a commit, a ref, an untracked file and an index write`; `test/e2e/no-commit.spec.ts` : `AC-5.1 a session over every v0.1 screen leaves HEAD, refs, index and working tree unchanged` |
| AC-6 | gates; `check_tasks.py`; docs listed in ES-17 |

No BDD scenario is deferred to this task (no `e2e closure` rows owed); the e2e closure table will
map AC-4/AC-5 to their spec tests.
