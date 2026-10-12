# Tests

**Version:** 0.25 · **Date:** 2026-10-12 (0.1: workspace tooling and e2e harness — task-001; 0.2: `test/launcher/`, `test/server/` — task-002; 0.3: `test/contracts/`, local state isolation, secret scan — task-007; 0.4: `local-security` suite — task-003; 0.5: process runner fake, hand-made CLI packages, stub after global options — task-004; 0.6: CLI contract tests, captured samples, `test:contract` — task-005; 0.7: action descriptor tests, REQ-ARC-05 lint rule — task-011; 0.8: matrix builds of `cliBuildFor`, capability table and README checks — task-006; 0.9: identity tests, bin with a seeded state — task-009; 0.10: timing suite `test:timing`, `TempWorkspace`, snapshot audits and stand-ins — task-010 / bug-001; 0.11: project-list route tests, a dumb-HTTP git remote — task-008; 0.12: read routes, the read console replacing the stand-ins, spec-002 §3 event parse, confinement — task-012; 0.13: `test/web/` component tests, the shared e2e support of Wave 3, the shell e2e — task-013; 0.14: `test/web/element/` and the element panel e2e `element-panel.spec.ts` — task-018; 0.15: `test/web/docs/` and the documentation e2e `documentation.spec.ts` — task-020; 0.16: `test/web/memory/` and the Memory list e2e `memory-list.spec.ts` — task-017; 0.17: `test/web/dna/`, `directives/`, `team/`, the e2e `dna`, `directives`, `team` specs and G-02 in `element-panel.spec.ts`; load-independent waits, prebuilt fixtures and the console reaper of the e2e support, `test/harness/load.ts` — task-019 / bug-004; 0.18: the Playwright part of `test:timing` (strict live refresh) — task-019, W3-47; 0.19: `wingfoil-feedback.test.ts`, the WingFoil feedback inbox and the `wingfoil-cli` *Note* column — task-023; 0.20: the project switcher e2e `projects.spec.ts`, `stateDir` of the e2e console, `test/web/shell/project-switcher`, `switch-target`, `test/web/api/projects` — task-015; 0.21: the Add project e2e `add-project.spec.ts`, `support/switcher.ts`, `support/git-http.ts`, `test/web/shell/add-project`, `add-project-fields`, `working-directory` — task-014; 0.22: the project header e2e `project-header.spec.ts`, `test/web/project/`, `test/web/api/role-view` — task-016; 0.23: the e2e-smoke `accessibility` spec `accessibility.spec.ts`, `performance.spec.ts` (`@perf`, TT-PERF-04) and the large fixture `test/harness/fixtures/large.ts`, `support/screens.ts`, `strings.ts`, `perf.ts`, `focusRing`/`tabUntil`, `test/web/shell/page-title` — task-021; 0.24: the packaging guard `test/package/`, the launch smoke `test/smoke/` and `test:smoke`, the `scrum` fixture and `scrum.spec.ts`, `test/harness/repo-state.ts` and `no-commit.spec.ts`; the Vitest global setup builds `web/dist` too — task-025 / bug-007; 0.25: *Temporary folders* (the run's temporary root `harness/temp-root.ts`, the clone hooks path, `launcher/clone-hooks.test.ts`), fresh-read preconditions, `test:smoke` as a wave gate — task-026 / bug-008)

Every test lives under `test/` (DNA `paths.tests`); sources stay in `server/src`, `web/src`,
`contracts/src`.

| Command | What it runs |
|---------|--------------|
| `npm test` | Vitest: every `test/**/*.test.ts` (unit, contract, harness, gates) except the timing suite |
| `npm run test:coverage` | the same with v8 coverage of `server/`, `contracts/`, `web/` (threshold 80 %, dev-loop `refactor`) |
| `npm run test:contract` | the contract tests of `test/contracts/` (e2e-smoke `contract`, spec-001 §7) |
| `npm run test:timing` | the timing suite: `test/timing/**/*.timing.test.ts`, one file at a time, each measurement printed with the load average — on a quiet machine only (see *Timing suite*) |
| `npm run test:e2e` | Playwright: `test/e2e/**/*.spec.ts`, Chromium only in v0.1 (REQ-INT-08 staged) |
| `npm run test:smoke` | the launch smoke (e2e-smoke `launch`): `test/smoke/**/*.smoke.test.ts` — packs the repository (`prepack` builds), installs the tarball into a temporary folder and runs `npx wingfoil-ui` there (see *Launch smoke*) |
| `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run docs:api` | ESLint (with the REQ-SEC-05 no-shell rule on `server/`), Prettier, `tsc`, TypeDoc of `server/` and `contracts/` |

## Layout

- `test/harness/` — the e2e harness: process runner (`run.ts`, `execFile` only), the pinned CLI
  (`cli.ts`), and the fixture builder (`fixtures/`). `repo-state.ts` (task-025, AC-5):
  `snapshotRepo(dir, env)` — HEAD, refs, stash, `git status --porcelain --untracked-files=all
  --ignored`, hashes of `.git/index` and `.git/config`, read without optional locks — and
  `diffRepo(dir, env, before, after)`, the differences with any new commit listed
  (`repo-state.test.ts` proves each kind of change is seen).
- `test/package/` (task-025, bug-007) — the package contract: `allow-list.ts` (the paths the
  tarball may hold, those it must hold, the bare imports of `server/dist`, `npm` run with this
  Node.js) and the packaging guard `pack.test.ts` (`npm pack --dry-run --json --ignore-scripts`,
  no build: every path on the allow-list, every run-time file packed, the bin packed 755, the root
  `dependencies` equal to `server/package.json`'s and covering every bare import of
  `server/dist`, no run-time import of `@wingfoil-ui/*`, `prepack`, `private`; the packed
  `server/dist` is exactly one module per `server/src` module — a stale output fails it — and
  `web/dist` holds no React development bundle). The Vitest global setup builds `server/dist` and
  `web/dist` for it, the latter without Vitest's `NODE_ENV=test` (a production bundle).
- `test/e2e/` — Playwright specs on the real bin, one spec per task, one test per scenario titled
  with its id (`S-01.1 …`), assertions on what the user sees, `scanThemes` (`support/axe.ts`, X-06.4)
  on each screen in the light and the dark theme. Shared support (task-013), used by every web task:
  - `support/global-setup.ts` (Playwright `globalSetup`): `tsc -b`, `vite build` and the
    key-rendering build `web/dist-keys` (spec-008 §6), once per run;
  - `support/console.ts`: `startConsole({ projects?, stateFile?, opener?, args?, env? })` — the bin
    with an isolated home and `WINGFOIL_UI_STATE_DIR` seeded with fixture projects (opaque ids in
    `pids`), `opener: 'recording' | 'none'` for S-01.1/S-01.3 (default `--no-open`);
    `openConsole(page, console, { path?, build?: 'keys' })` opens the page with the token in the
    fragment and waits for the shell; `build: 'keys'` serves `web/dist-keys` by route interception;
  - `support/fixtures.ts`: the Playwright `test` with worker-scoped `fixtures.get(kind)` (built once
    per worker) / `fixtures.copy(kind)` (a copy to mutate) and test-scoped `consoles.start()`,
    stopped after the test;
  - `support/events.ts`: `recordServerEvents(page)` (wraps the page's `EventSource` from an init
    script, test side only), `mutateAndWait(page, mutation, { event, pid? })` — no fixed sleeps —,
    `commitFile(fixture, file, content, message)`, `cli(fixture, args)`;
  - `support/keyboard.ts`: `expectFocusVisible(locator)`; `focusRing(page)` (the focused element's
    outline and its contrast against the backdrop, TT-ARC-10) and `tabUntil(page, target, seen)`
    (Tab / Shift+Tab until `target` has the focus, each ring on the way given to `seen`) — task-021;
  - `support/screens.ts` (task-021): `SCREENS`, every v0.1 screen reached by URL and structure (no
    English text), shared by the axe scan of X-06.4 and the key-build check of X-09.1;
    `startScreensConsole` (kanban + custom, Morgan), `expectSettled(page)` (no loading status);
  - `support/strings.ts` (task-021): `recordApiData(page)` and `textsOutsideCatalogue(page, data)` —
    the X-09.1 check: every text node and accessible name is a key-catalogue text or project data
    from the API answers the page read (React Aria's "Dismiss" the one library exception);
  - `support/perf.ts` (task-021): `timeNavigation(page, target, ready)` (Enter → view rendered,
    measured in the page), `percentile`, `reportRuns`; 20 runs and the 1.0 s p95 budget in
    `test:timing`, 2 runs without a budget in `test:e2e`;
  - `support/cold-read.ts` (bug-004): `COLD_READ_MS` and `expectFirstLoad(locator)` /
    `expectLoaded(scope)` — every spec waits for its first, cold read with them (the CLI behind the
    API is slow under external load), later assertions keep Playwright's default; `refreshClock()`
    for a live refresh (behaviour by default, the strict 5 s in `test:timing`, W3-47);
  - `fixtures.ts` option `prebuild` (bug-004): `test.use({ prebuild: ['kanban'] })` builds the
    spec's fixtures before its first test body (worker fixture, 300 s), not inside a test;
  - `support/reaper.ts` + `support/global-teardown.ts` (bug-004): each console runs in its own
    process group, recorded in the run's directory; it is killed when its test ends, when its worker
    ends (also on the worker's `exit`, SIGTERM, SIGINT) and by the global teardown, which fails the
    run naming any console that survived (`test/harness/e2e-reaper.test.ts`);
  - `support/identity.ts`: `actAs(fixture, name)` — "I am <member>" by `git config user.email`;
  - `support/switcher.ts` (task-015/014): the switcher's trigger, popover and rows,
    `openSwitcher(page)` returning the list read its opening sent, `expectListed`, `expectMemoryList`;
  - `support/git-http.ts` (task-014): `startGitHttpRemote(base, { credentials?, hold? })` — a dumb-HTTP
    git remote on 127.0.0.1 (Basic auth refusals, answers held until `release()`) — and
    `bareRepository(base, name, files, env)`; remotes stay offline.
  `harness/` holds the self-tests of the support (axe helper, console + SSE helper, the X-09.1 check
  and the focus ring helper). `test/harness/fixtures/large.ts` builds the SARD large fixture (custom +
  500 generated elements + 2 000 commits through `git fast-import`) for `performance.spec.ts` only.
  task-025 (e2e-smoke gaps): `scrum.spec.ts` opens the `scrum` fixture (Memory list, element panel,
  DNA, axe in both themes, AC-4); `no-commit.spec.ts` walks `SCREENS`, picks a role view and
  switches project, then checks with `harness/repo-state.ts` that both repositories are unchanged
  (AC-5).
- `test/web/` — unit and component tests of `web/src` (Vitest; `// @vitest-environment jsdom` per
  file, Testing Library): `shell/render.tsx` renders the whole application on a memory history with
  a stubbed `fetch` (`stubApi`) — optionally with the key catalogue; theme tokens and contrast pairs
  (`theme/`), catalogue check and key catalogue (`i18n/`), API client, event stream, error renderer
  and session bootstrap; `element/` the element panel (its pure helpers and the route rendered on the
  stubbed API); `docs/` the Documentation view (link resolution and classification, the Markdown
  rendering and its sanitising with attack payloads, the index and document pages); `dna/`,
  `directives/`, `team/` the *Rules and context* views (shared fake answers in `dna/data.ts`).
  `setup.ts` (Vitest `setupFiles`) raises Testing Library's async wait to 10 s (bug-004).
- `test/wingfoil-feedback.test.ts` — the WingFoil feedback inbox `docs/wingfoil-feedback/` (WingFoil
  dl-163 R4: the six fields and their values, ids matching file names, the first line, Observed and
  Expected, the README ledger equal to the notes) and the *Note* column of the `wingfoil-cli`
  directive pointing to existing notes.
- `test/harness/load.ts` — the timeouts of the process-spawning and whole-repository tests, sized
  for the worst measured external load (bug-004).
  `test/lint/catalogue-placeholders.test.ts` covers the spec-008 placeholder rule.
- `test/launcher/` — the `wingfoil-ui` bin driven as a child process (`launcher.ts`:
  `startLauncher(args, env)` waits for the running line and returns port, token and stop helpers;
  later e2e suites start the console with it). `local-security.test.ts` is the e2e-smoke
  `local-security` suite (REQ-SEC-02/03): raw `http` requests, since `fetch` cannot set `Host`
  or `Origin`; every new `/api/` route adds its rows there. Every `/api/` request needs
  `Authorization: Bearer <token>` (or the `wfui_session_<port>` cookie from `POST /api/session`).
- `test/server/` — unit tests of `server/src`, mirroring its folders. `process/fake-runner.ts` is the
  in-memory fake of the process runner port (adr-002); `cli/fake-cli.ts` writes hand-made `wingfoil`
  packages (a marking or sleeping CLI) and installs a package globally (`<prefix>/bin/wingfoil` →
  `<prefix>/lib/node_modules/wingfoil/…`) for the discovery tests.
  `reads/project-reads.test.ts` is the REQ-ARC-04 file-system spy: `vi.mock('node:fs/promises')`
  and `vi.mock('node:fs')` record every call while the read facade runs on real fixtures.
- `test/server/snapshot/` — the snapshot cache, the marker and the watcher on real fixtures.
  `support.ts`: `AuditedRunner` (counts `wingfoil` and git processes, the process audit) and
  `auditedSnapshots(env)`. `memory-events.test.ts` is the spec-002 §5 consistency check (the
  project-wide `git log -p` events equal every element's `memory history`).
  `test/server/http/read-console.ts`: the real read routes (task-012) over a given snapshot
  registry, next to the real `GET /api/events`, on a loopback listener, with the projects in an
  in-memory store — the process audits and the refresh measurement run on it (it replaced
  task-010's stand-ins). `test/server/http/project-routes.test.ts` checks every read route's body
  against its schema in `contracts/api/`. `test/server/http/sse-client.ts` reads an event stream
  over raw `http`.
- `test/server/http/projects.test.ts` — the project-list routes (task-008) on copies of the kanban
  fixture with the file store in a temporary state directory: every refusal compared with a tree
  listing (paths + content hashes, links not followed) taken before it; a local git "dumb HTTP"
  server (`httpRemote`: optional Basic credentials, or never answering) for the authentication,
  credential-URL and cancellation cases; the pinned CLI installed globally on the `PATH` (a fresh
  clone has no `node_modules`). Its TT-INT-06 process audit covers every process of the file (one
  `AuditedRunner`) and makes its own add and clone, so it also passes alone.
  `test/server/projects/` — remote normalisation (`remote.test.ts`) and the undo of a refused clone
  (`clone.test.ts`); `test/server/launcher/project-check.test.ts` — `runLauncher` starts and stops
  the periodic availability check.
- `test/contracts/` — the JSON Schemas of `contracts/` (e.g. `state/state.schema.json`) and the CLI
  contract tests (spec-001 §7, adr-001 D4): `cli-contract.test.ts` builds the three fixtures with
  the CLI of every version of `contracts/matrix.json` (`support.ts`: `cliBuildFor(version)`), runs
  every command of the adapter's static list (`server/src/cli/commands.ts`) through the adapter —
  reads on the fixtures, writes and the archived searches on copies — and every direct reader on
  every file the CLI points at, and checks the §4.1 state resolution against the transitions the
  CLI reports. `schemas.test.ts` validates the samples of `samples/wingfoil-<version>/<fixture>/`:
  real CLI output (`<command>.json`, `memory-history/<id>.json`, `version.txt`) and the
  allow-listed files as found (`files/`), captured with
  `WFUI_CAPTURE_SAMPLES=1 npx vitest run test/contracts/capture-samples.test.ts` (skipped
  otherwise; Prettier leaves `samples/` as captured). A matrix advance re-captures them;
  `cliBuildFor` installs a matrix version other than the pinned one once (`npm install` from the
  registry) into `node_modules/.cache/wingfoil-ui-matrix/<version>` and reuses it.
  `capabilities.test.ts` checks `capabilities.json` against its schema and the package README's
  "Supported WingFoil versions" section against `matrix.json` and `capabilities.json`.
  `descriptor-contract.test.ts` checks the action descriptor (spec-003 §9) on the built fixtures:
  every `submit`/`approve`/`reject` of every element, run on a copy, is accepted exactly when the
  descriptor offers it. Its oracle, shared with `test/server/descriptor/`, is
  `test/server/descriptor/standard.ts` (hand-written from the BDD conventions).
- `test/lint/`, `test/docs/` — the dev-loop gates `lint.clean`, `docs.api.*`, and the lint rules'
  own tests (REQ-SEC-05 `no-shell`, REQ-ARC-05 `methodology-literals`: the rule of
  `lint/methodology-literals.js` reads the fixtures' type and state names from the captured samples,
  so a re-capture updates it).

## Launch smoke

`npm run test:smoke` (`vitest.smoke.config.ts`, task-025 AC-3, e2e-smoke `launch`) — excluded
from `npm test` and `test:coverage`, because its `npm pack` runs `prepack`
(`scripts/clean-build.mjs`, which removes `server/dist`, `contracts/dist`, `web/dist` and their
`tsbuildinfo`, then `npm run build`), which rewrites the builds under the bin tests. The smoke
runs `npm` without Vitest's `NODE_ENV=test` (else Vite builds React's development bundle) and
asserts the packed `server/dist` set and a production web bundle. `test/smoke/launch.smoke.test.ts`:
`npm pack --pack-destination <tmp>`, then `npm install <tarball> --prefer-offline` into an empty
folder with the user's npm cache (no network when the cache holds the packages and their
metadata; a cold cache fetches what is missing), then `npx --no -- wingfoil-ui` there (`--no` and
`--`: never a registry fallback) with an isolated home and `WINGFOIL_UI_STATE_DIR`: `--version`,
`--help`, a `--no-open` start (URL line, `GET /` and its script, `GET /api/server` 401 without and
200 with the token), a stop by SIGINT to the server process (`npx` exits 0) and a Ctrl-C (SIGINT
to the process group: `npx` ends by the signal, as npm does), no process left after either. Each
phase's duration is printed; measured on 2026-10-11 at load 5.1: pack (clean build included)
10.9 s, install 1.6 s, `--version` 0.9 s, start 1.0 s, the whole file ~17 s; tarball 120 files,
514 kB packed, 1.38 MB unpacked.

`npm run test:smoke` is a **gate of every wave** (task-026, AC-3; bug-007 was found only at
release validation): run it at the end of each dev-loop wave, after the wave's tasks are
integrated, besides release validation and any task that touches packaging, the launcher or the
bin. The smoke also clones a repository with a committed hook through the installed console
(bug-008): the hooks path of the packed `server/dist` is a regular file and no hook runs.

Do not run `npm test` / `test:coverage`, `test:e2e` and `test:smoke` at the same time in one
checkout: each rebuilds `web/dist` (and `server/dist`) in place — the Vitest and Playwright global
setups, and `prepack` — so one could read a build the other is rewriting.

## Timing suite

A test whose verdict depends on elapsed time — a performance budget (REQ-PERF-03, REQ-PERF-06) or
a heavy build racing the test timeout (the TypeDoc build) — fails on a loaded machine although the
code meets its budget (bug-001). Such tests are named `*.timing.test.ts`, live in `test/timing/`
and run only with `npm run test:timing` (`vitest.timing.config.ts`): files sequentially, the load
average printed at the start and with every measurement (`report(label, value)` of
`test/timing/load.ts`, `/proc/loadavg` on Linux). `npm test` and `npm run test:coverage` exclude
them. Run the timing suite on a quiet machine (load average well below the core count) and record
the printed load with the result; a failure under load is re-run, not "fixed". Counting tests
(processes, events) are not timing tests and stay in the default suite.

`npm run test:timing` also runs a Playwright part (`playwright.timing.config.ts`, W3-47): the
live-refresh scenarios S-25.2, S-26.1, S-26.2 and S-27.2 (tag `@live-refresh`) on the real bin, one
at a time, with `WFUI_STRICT_REFRESH=1`: the screen must change within 5 s of the mutation (the
commit, the file write or the CLI verb that commits — watcher, event stream, refetch and render
included), and each time is printed with the load (`refreshClock()` of
`test/e2e/support/cold-read.ts`). The same tests in `npm run test:e2e` check the behaviour only (the
screen changes by itself, without a reload) with the cold-read budget, at any load. It also runs
TT-PERF-04 (tag `@perf`, `performance.spec.ts`, task-021): each other view reached by in-app
navigation on the large fixture, 1 warm-up + 20 runs, p95 ≤ 1.0 s asserted and printed with the
load; `npm run test:e2e` runs the same spec with 2 runs and no budget.

A test that runs a long process in a temporary folder uses `TempWorkspace`
(`test/harness/temp-workspace.ts`): `dispose()` in `afterAll` kills the processes still running
(after a test timeout), waits for them, then removes the folder — nothing is left in the temporary
directory.

## Temporary folders

One convention for every temporary folder of the tests and of the console (task-026, bug-008);
a run leaves no `wfui-*` entry in the system temporary directory:

- **The run's temporary root** (`test/harness/temp-root.ts`). The global setup of every runner —
  `test/global-setup.ts` (`npm test`, `test:coverage`, and `test:timing` through
  `test/timing/global-setup.ts`), `test/smoke/global-setup.ts` (`test:smoke`),
  `test/e2e/support/global-setup.ts` (`test:e2e` and the Playwright part of `test:timing`) —
  creates `<system tmp>/wfui-run-<pid>-<time>-<random>/` with an `owner` file (made under a
  staging name, then renamed) and points `TMPDIR`, `TMP` and `TEMP` at its `tmp/` folder
  (`WFUI_TEMP_ROOT` names the root). Every `os.tmpdir()` of the run lands there: test files,
  workers, fixtures, consoles, git, the browsers. The global teardown removes the root its
  process owns, never another one; the next start removes the roots whose owner process is gone
  (a run killed before its teardown) and leaves those of concurrent runs (other checkouts) alone
  (`harness/temp-root.test.ts`).
- **A test's own folder:** `TempWorkspace.create('wfui-<name>-')` (`test/harness/temp-workspace.ts`)
  in `beforeAll`, `dispose()` in `afterAll` — the convention for new tests, required when the
  test runs a process in the folder. Older files with `mkdtemp(path.join(tmpdir(), 'wfui-…'))` and
  `rm` in `afterAll` are kept: they are under the run's root too. A Playwright worker fixture
  removes its folder in `finally` (`support/fixtures.ts`, `performance.spec.ts`).
- **The console** creates no temporary folder: the hooks path of a clone is a regular file of the
  console's own installation (`server/src/projects/clone.ts` `NO_HOOKS_PATH`; git finds no hook
  below a file), so a console killed by SIGKILL leaves nothing behind
  (`test/launcher/clone-hooks.test.ts`: the bin with its own `TMPDIR`, a clone, SIGKILL, restart).
- **Checking a run:** count the `wfui-*` entries of the system temporary directory before and
  after (`ls -d "${TMPDIR:-/tmp}"/wfui-* | wc -l`); entries of runs in other checkouts that are
  still going are theirs.

Fresh reads (task-026, AC-2; bug-005, task-021 F2): a test that measures or compares a read first
asserts the state it depends on — the `lstat` change or sameness in `fingerprint.test.ts`, the
expected state absent before the change in `live-refresh.timing.test.ts` and in the
`@live-refresh` e2e tests, the view's own read sent after the key press and answered with a 2xx
status in `performance.spec.ts`.

## Fixtures

`buildFixture(kind, { root, now?, cli?, cliVersion? })` builds the `kanban`, `custom` or `unknown`
fixture of `docs/02_requirements/02_bdd/00_conventions.md` (`FIXTURE_KINDS`, type
`BddFixtureKind`) or the `scrum` fixture (task-025 AC-4: `wingfoil init --template Scrum`, the
standard team; tasks pending, draft, approved and deprecated, a bug rejected back to draft, an
approved decision-log; not in `FIXTURE_KINDS`, so no contract samples or descriptor rows) with the
pinned CLI (or another build,
for contract tests across the support matrix): a git repository `<root>/<kind>` with the standard
team and elements, its `package.json` pinning `wingfoil`, `node_modules/wingfoil` linked to the
CLI package, and a bare remote `<root>/remotes/<kind>.git` (`origin`, `main` pushed). Setup
commits are dated 4 days before `now`; element commits 1 s apart in the 10 minutes up to
`now − 3 days` (no two commits share a timestamp). Alex is the current identity. Run every
process with `fixture.env`: it isolates git from the user's configuration (no inherited `GIT_*`)
and points `HOME`, `USERPROFILE`, `APPDATA` and the XDG directories into `fixture.home` (the
default clone folder `~/projects` and the OS state directory land there). The npm cache moves
there too: a test that runs `npm`/`npx` with `fixture.env` sets `npm_config_cache` to the real
cache (or runs `node` directly) to stay offline and fast.

A build takes ~10 s: build once per test file and use `copyFixture(fixture, otherRoot)` for a
fresh copy per test.

Variants (they change only the untracked `node_modules/wingfoil`):

- `installCliStub(fx, { failures })` — the CLI stub: the listed commands fail with the given
  status and stderr, everything else is delegated to the real CLI;
- `installCliStub(fx, { version })` — the version-fake variant: `node_modules/wingfoil` declares
  and answers the fake version, the fixture's own `package.json` pin is left as built;
- `removeCli(fx)` and `envWithoutWingfoil(env, binDir)` — the no-CLI variant (`binDir` keeps
  `git` and `node` on the `PATH`).

A failure is matched on the command's positional words before its first option
(`['memory', 'approve']`), after any global option placed before the command (`--format json`, as
the server invokes the CLI); installing a stub again replaces the previous one.

## Local state

A bin test that needs listed projects before the project-list routes exist seeds
`<WINGFOIL_UI_STATE_DIR>/state.json` with the fixtures' entries (`test/launcher/role-view.test.ts`);
identity tests change `git config user.email` (repository or `--global`, i.e. the harness's
`.gitconfig`) and the team with the pinned CLI (`dna remove` / `dna add team.members`) on a copy.

No test reads or writes the developer's own state directory (spec-006 §1). A test that starts
the console or opens a file store gives it a temporary directory: `WINGFOIL_UI_STATE_DIR`, the
`stateDir` of `LauncherIo`, `openFileStateStore({ dir })`, or the isolated home of `harnessEnv`
(the XDG location under `<root>/home`). Domain and route tests use the in-memory fake
`createMemoryStateStore()`.

`secret-scan.ts` is the REQ-SEC-09 scan: `scanForSecrets(paths, values)` searches files and
directories for the given values (the printed token, a planted environment value) and for
credential shapes (URL userinfo, bearer headers, GitHub/GitLab/AWS tokens, session cookies).

`security.ts` holds the REQ-SEC-05 probe (`SHELL_PAYLOAD`, `pwned()`) for every test that passes
user input to a process.

WingFoil 0.2.2 quirks the builder works around: `memory add` always writes `draft` (W-21, the
`unknown` fixture amends the add commit to the first declared state); task transitions after a
waiting state are hand-written `wf(…)` commits (W-20).
