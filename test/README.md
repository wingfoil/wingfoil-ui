# Tests

**Version:** 0.41 · **Date:** 2026-10-17 (0.1: workspace tooling and e2e harness — task-001; 0.2: `test/launcher/`, `test/server/` — task-002; 0.3: `test/contracts/`, local state isolation, secret scan — task-007; 0.4: `local-security` suite — task-003; 0.5: process runner fake, hand-made CLI packages, stub after global options — task-004; 0.6: CLI contract tests, captured samples, `test:contract` — task-005; 0.7: action descriptor tests, REQ-ARC-05 lint rule — task-011; 0.8: matrix builds of `cliBuildFor`, capability table and README checks — task-006; 0.9: identity tests, bin with a seeded state — task-009; 0.10: timing suite `test:timing`, `TempWorkspace`, snapshot audits and stand-ins — task-010 / bug-001; 0.11: project-list route tests, a dumb-HTTP git remote — task-008; 0.12: read routes, the read console replacing the stand-ins, spec-002 §3 event parse, confinement — task-012; 0.13: `test/web/` component tests, the shared e2e support of Wave 3, the shell e2e — task-013; 0.14: `test/web/element/` and the element panel e2e `element-panel.spec.ts` — task-018; 0.15: `test/web/docs/` and the documentation e2e `documentation.spec.ts` — task-020; 0.16: `test/web/memory/` and the Memory list e2e `memory-list.spec.ts` — task-017; 0.17: `test/web/dna/`, `directives/`, `team/`, the e2e `dna`, `directives`, `team` specs and G-02 in `element-panel.spec.ts`; load-independent waits, prebuilt fixtures and the console reaper of the e2e support, `test/harness/load.ts` — task-019 / bug-004; 0.18: the Playwright part of `test:timing` (strict live refresh) — task-019, W3-47; 0.19: `wingfoil-feedback.test.ts`, the WingFoil feedback inbox and the `wingfoil-cli` *Note* column — task-023; 0.20: the project switcher e2e `projects.spec.ts`, `stateDir` of the e2e console, `test/web/shell/project-switcher`, `switch-target`, `test/web/api/projects` — task-015; 0.21: the Add project e2e `add-project.spec.ts`, `support/switcher.ts`, `support/git-http.ts`, `test/web/shell/add-project`, `add-project-fields`, `working-directory` — task-014; 0.22: the project header e2e `project-header.spec.ts`, `test/web/project/`, `test/web/api/role-view` — task-016; 0.23: the e2e-smoke `accessibility` spec `accessibility.spec.ts`, `performance.spec.ts` (`@perf`, TT-PERF-04) and the large fixture `test/harness/fixtures/large.ts`, `support/screens.ts`, `strings.ts`, `perf.ts`, `focusRing`/`tabUntil`, `test/web/shell/page-title` — task-021; 0.24: the packaging guard `test/package/`, the launch smoke `test/smoke/` and `test:smoke`, the `scrum` fixture and `scrum.spec.ts`, `test/harness/repo-state.ts` and `no-commit.spec.ts`; the Vitest global setup builds `web/dist` too — task-025 / bug-007; 0.25: *Temporary folders* (the run's temporary root `harness/temp-root.ts`, the clone hooks path, `launcher/clone-hooks.test.ts`), fresh-read preconditions, `test:smoke` as a wave gate — task-026 / bug-008; 0.26: the public-text check `test/docs/public-text.test.ts` — task-028; 0.27: the e2e suite on Chromium, Firefox and WebKit, `test:e2e:chromium`, *Browsers*, `support/clipboard.ts` — task-027 / bug-009; 0.28: the UI settings tests `server/state/settings`, `server/http/settings` (with its process audit), `launcher/settings`, `contracts/api-settings-schema` — task-030; 0.29: `test/server/http/today-routes.test.ts`, `test/server/descriptor/today.test.ts`, the Today process audit — task-031; 0.30: the How to join e2e `how-to-join.spec.ts`, a third `SCREENS` project (Riley), the X-09.1 rule for a CLI command shown as data, `test/web/project/join`, `how-to-join` — task-035; 0.31: the governed-write suites, `test/server/writes/`, `test/scripts/` — task-032; 0.32: the Today e2e `today.spec.ts` (with TT-PERF-09), TT-PERF-01 in `performance.spec.ts`, two `SCREENS` entries, `test/web/today/`; X-06.4 and X-09.1 one test per screen — task-036 / bug-011; 0.33: the git-route suites `server/http/git-routes`, `repository-status` and their console `git-console.ts`, `server/git/` copy, transport, redaction and local-remote tests, the transport characterization, `launcher/git-routes` — task-033 / bug-010, bug-012, bug-013; 0.34: the gate footer e2e `gate-footer.spec.ts`, `lastCommitSubject` in `support/events.ts`, three `SCREENS` entries, the X-09.1 rule for the References field names (D37-13), `test/web/element/footer`, `gate-footer`, `test/web/api/writes` — task-037; 0.35: the auto-sync suites `server/sync/` (scheduler, automatic fetch and update), `server/http/auto-push`, `launcher/auto-sync`, TT-PERF-07 in `timing/auto-sync.timing.test.ts`, the bug-014 and D34 characterization rows, `autoPush` of `git-console.ts`, the runner's drain after exit (`server/process/runner.test.ts`) — task-034 / bug-014; 0.36: the notification bell e2e `notification-bell.spec.ts` (S-21.x, S-23.x, T-07.x), the *notification panel* `SCREENS` entry, `test/web/shell/notification-bell`, `notifications`, `test/web/today/summary`; the X-09.1 recorder of bug-015 — task-042; 0.37: `submit-footer.spec.ts`, the toasts unit suites, `ConsoleOptions.settings`, `support/remote.ts`, TT-PERF-02 in the perf run — task-038; 0.38: the git status e2e `git-status.spec.ts` (Y-01.x … Y-04.x, S-11.x, Cancel; Y-02.1 and Y-04.2 `@live-refresh`), `settings` of the e2e console, `support/remote.ts` `remoteCommit`/`setRemoteUrl`, a fourth `SCREENS` project and the *git status — fetch failed* entry, the X-09.1 time-only rendering, `test/web/repository/`, `test/web/api/git` — task-039; 0.39: the UI settings e2e `ui-settings.spec.ts` (C-07.1 … C-07.3, X-08.3), `ConsoleOptions.settings`, the *configuration — UI settings* `SCREENS` entry, C-07.3 in `timing/ui-settings.timing.test.ts`, `test/web/settings/`, `test/web/api/settings` — task-041; 0.41: the Update and Push e2e `update-push.spec.ts` (Y-05.x … Y-08.x, G-12.x, Push's Cancel; Y-05.2 `@live-refresh`), G-13.2's sidebar step, bug-016 in `shell.spec.ts`, `support/remote.ts` `fetchCopy`/`remoteHook`, a fifth `SCREENS` project and its entry, `test/web/repository/update-push`, `session` `watchFragmentToken` — task-040 / bug-016)

Every test lives under `test/` (DNA `paths.tests`); sources stay in `server/src`, `web/src`,
`contracts/src`.

| Command | What it runs |
|---------|--------------|
| `npm test` | Vitest: every `test/**/*.test.ts` (unit, contract, harness, gates) except the timing suite |
| `npm run test:coverage` | the same with v8 coverage of `server/`, `contracts/`, `web/` (threshold 80 %, dev-loop `refactor`) |
| `npm run test:contract` | the contract tests of `test/contracts/` (e2e-smoke `contract`, spec-001 §7) |
| `npm run test:timing` | the timing suite: `test/timing/**/*.timing.test.ts`, one file at a time, each measurement printed with the load average — on a quiet machine only (see *Timing suite*) |
| `npm run test:e2e` | Playwright: `test/e2e/**/*.spec.ts` on the three projects `chromium`, `firefox`, `webkit` (REQ-INT-08; `@perf` on Chromium only) — the gate at the end of every wave and at release validation; `npm run test:e2e -- <spec files>` runs only those files on the three engines (see *Browsers*) |
| `npm run test:e2e:chromium` | the same suite on the `chromium` project only — the inner development loop; `-- <spec files>` narrows it too |
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
    `settings` (task-038) writes UI settings (e.g. `autoPush: true`) into the seeded `state.json`,
    and throws when given with a raw `stateFile` or a `stateDir` that already holds a `state.json`;
  - `support/fixtures.ts`: the Playwright `test` with worker-scoped `fixtures.get(kind)` (built once
    per worker) / `fixtures.copy(kind)` (a copy to mutate) and test-scoped `consoles.start()`,
    stopped after the test;
  - `support/events.ts`: `recordServerEvents(page)` (wraps the page's `EventSource` from an init
    script, test side only), `mutateAndWait(page, mutation, { event, pid? })` — no fixed sleeps —,
    `commitFile(fixture, file, content, message)`, `cli(fixture, args)`;
  - `support/remote.ts` (task-038): `remoteHead(fixture, branch?)` — the commit the copy's bare
    remote points at; `remoteCommit`, `setRemoteUrl` (task-039); `fetchCopy(fixture)` and
    `remoteHook(fixture, script)` — the remote's `pre-receive` hook, to decline or hold a push
    (task-040);
  - `support/keyboard.ts`: `expectFocusVisible(locator)`; `focusRing(page)` (the focused element's
    outline and its contrast against the backdrop, TT-ARC-10) and `tabUntil(page, target, seen)`
    (Tab / Shift+Tab until `target` has the focus, each ring on the way given to `seen`) — task-021;
  - `support/screens.ts` (task-021): `SCREENS`, every v0.1 screen reached by URL and structure (no
    English text), shared by the axe scan of X-06.4 and the key-build check of X-09.1 — one test
    per screen (titled with the scenario id and the screen name) on one screens console per worker
    (bug-011, task-036);
    `startScreensConsole` (kanban + custom, Morgan; a kanban copy as Riley, `pids[2]`, for the
    *How to join* panel — task-035), `expectSettled(page)` (no loading status);
  - `support/strings.ts` (task-021): `recordApiData(page)` and `textsOutsideCatalogue(page, data)` —
    the X-09.1 check: every text node and accessible name is a key-catalogue text or project data
    from the API answers the page read (React Aria's "Dismiss" the one library exception); a
    `code.cli-command[translate="no"]` passes only as the *How to join* command rebuilt from a
    string value read (the email) and the placeholder keys (spec-008 §6, task-035 D35-3); the
    recorder follows each API request from its sending and waits for its answer (`COLD_READ_MS` at
    most), a failed body read or a hung answer is reported with what the check flags, and
    `screenTextsOutsideCatalogue` (used by `accessibility.spec.ts`) repeats the check only while new
    answers were learnt, within `COLD_READ_MS`; `reset({ untilNavigation: true })` also forgets what
    the page being left reads until the next navigation, named as a cause when something is flagged
    (bug-015, task-042);
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
  - `support/clipboard.ts` (task-027, AC-1b): `allowClipboard(context, browserName)` grants each
    engine the clipboard permissions it needs (Chromium read + write, WebKit read, Firefox none —
    it rejects both) and `copiedBy(page, action)` returns the text a *Copy* button wrote: a unique
    sentinel goes on the clipboard first, the action runs, the clipboard is polled until it no
    longer holds the sentinel — a stale value never passes, nothing copied fails
    (`harness/clipboard.spec.ts`);
  - `support/git-http.ts` (task-014): `startGitHttpRemote(base, { credentials?, hold? })` — a dumb-HTTP
    git remote on 127.0.0.1 (Basic auth refusals, answers held until `release()`) — and
    `bareRepository(base, name, files, env)`; remotes stay offline.
  `harness/` holds the self-tests of the support (axe helper, console + SSE helper, the X-09.1
  check, the focus ring helper and the clipboard helper), run on the three engines like every
  spec. `test/harness/fixtures/large.ts` builds the SARD large fixture (custom + 500 generated
  elements + 2 000 commits through `git fast-import`) for `performance.spec.ts` only.
  task-025 (e2e-smoke gaps): `scrum.spec.ts` opens the `scrum` fixture (Memory list, element panel,
  DNA, axe in both themes, AC-4); `no-commit.spec.ts` walks `SCREENS`, picks a role view and
  switches project, then checks with `harness/repo-state.ts` that both repositories are unchanged
  (AC-5). task-035: `how-to-join.spec.ts` (C-08.1 … C-09.2; the copy through
  `support/clipboard.ts`; DNA variants made with the pinned CLI on the copy before the console
  starts); `no-commit.spec.ts` observes the Riley copy too. task-036: `today.spec.ts` (T-01.1 …
  T-11.3, T-03.2 and T-04.2 tagged `@live-refresh`; TT-PERF-09 compares, per fixture, member and
  role view, the rows on screen with `requiresYou` of `GET …/today`); `SCREENS` gains *today* and
  *today — not in team*. task-037: `gate-footer.spec.ts` (G-04.1 … G-09.3, S-24.1 … S-24.4,
  S-13.2, S-15.2, X-06.2; each decision on a fixture copy of its own, its `wf(…)` commit read with
  `lastCommitSubject`; G-04.1 counts the clicks since Today was shown, TT-PERF-10); `SCREENS` gains
  *element panel — gate footer, reason empty*, *element panel — waiting for the workflow engine*
  and *element panel — read-only, not in team*. task-042: `notification-bell.spec.ts` (S-21.1 …
  S-21.3, S-23.1 … S-23.4, T-07.1, T-07.2; element states moved with the pinned CLI on the copy
  before the console starts, approvals made from Today through the gate footer); `SCREENS` gains
  *notification panel* (the existing *today* screen shows Morgan's all-roles summary).
  task-038: `submit-footer.spec.ts` (G-10.1 … G-10.3, G-11.1 … G-11.3, G-13.1, G-13.2, G-14.1, G-14.2,
  X-07.1 … X-07.3, a keyboard-only Submit; G-13.1 seeds `autoPush: true` and reads the remote with
  `remoteHead`; G-14.2 holds the page's re-reads with `page.route` until the click, so the real
  server answers 409 `element-changed`); `gate-footer.spec.ts` G-04.1 and `notification-bell.spec.ts`
  read the result from the toast; `SCREENS` gains *element panel — submit footer*.
  task-039: `git-status.spec.ts` (Y-01.1 … Y-04.2, S-11.1, S-11.2 and Fetch's Cancel; every console
  seeds `settings: { autoFetch: false }` through `ConsoleOptions.settings` except Y-02.1, which runs
  the scheduler at 15 s (RP-53); the remote moved from another clone with `remoteCommit` of
  `support/remote.ts`, an unreachable or authenticating remote set with `setRemoteUrl`; Y-02.3 counts
  `git fetch` in the bin's `GIT_TRACE` file after two intervals); `SCREENS` gains a fourth project
  (`offlineCopy`: a kanban copy whose `origin` cannot be reached, `no-commit.spec.ts` observes it
  too) and *git status — fetch failed*.
  task-041: `ui-settings.spec.ts` (C-07.1 … C-07.3, X-08.3, another tab following a change, the
  keyboard walk, a refused fetch interval; every console its own, so a forced theme never reaches a
  shared console); C-07.3 seeds `fetchIntervalSeconds` 15 with `ConsoleOptions.settings` (RP-53)
  and counts `git fetch` in the bin's `GIT_TRACE` file after a tick has ended; `SCREENS` gains
  *configuration — UI settings* (opened only, no setting changed).
  task-040: `update-push.spec.ts` (Y-05.1 … Y-08.2, G-12.1 … G-12.3, Push's Cancel and a keyboard
  walk; every console seeds `autoFetch: false` except Y-05.2 — 15 s with Auto-update, RP-53 — and
  Y-07.2, whose settings were never changed; Y-08.2 and the cancel test decline or hold the push
  with a `pre-receive` hook of the copy's bare remote, Y-08.2 checking the redaction of git's text
  end to end); `submit-footer.spec.ts` G-13.2 asserts the sidebar's "1 commit to push" (RP-52);
  `shell.spec.ts` reproduces bug-016 (a token pasted into an open tab); `SCREENS` gains a fifth
  project (`behindCopy`: one commit behind its fetched remote, `no-commit.spec.ts` observes it
  too) and *git status — behind, Update in the sidebar and the footer*.
- `test/web/` — unit and component tests of `web/src` (Vitest; `// @vitest-environment jsdom` per
  file, Testing Library): `shell/render.tsx` renders the whole application on a memory history with
  a stubbed `fetch` (`stubApi`) — optionally with the key catalogue; theme tokens and contrast pairs
  (`theme/`), catalogue check and key catalogue (`i18n/`), API client, event stream, error renderer
  and session bootstrap; `element/` the element panel (its pure helpers and the route rendered on the
  stubbed API); `docs/` the Documentation view (link resolution and classification, the Markdown
  rendering and its sanitising with attack payloads, the index and document pages); `dna/`,
  `directives/`, `team/` the *Rules and context* views (shared fake answers in `dna/data.ts`).
  `repository/` the sidebar's git status and its layout (task-039; `api/git` its fetch mutation),
  *Update*, *Push* and the footer's *Update* link (task-040).
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
- `test/server/http/today-routes.test.ts` — `GET /api/p/:pid/today` and `/events/memory`
  (task-031) on copies of the three fixtures: each member (`git config user.email` in the copy,
  then a state check) and each role view against the descriptors of `GET /elements`, the
  refusals, no partial Today; `test/server/descriptor/today.test.ts` — the pure Today output on the
  captured samples. The Today/events process audit is in `snapshot/process-audit.test.ts`.
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
- `test/docs/public-text.test.ts` (task-028, dl-006 action 4, dl-005) — the public-text check:
  every tracked text file (`git ls-files`; untracked files are never read, a file with a NUL byte
  in its first 8 000 bytes is binary and skipped) is scanned by `public-text.ts` for absolute
  paths outside the repository — a POSIX path under a standard top-level directory of Linux or
  macOS, a Windows drive path, a `~/` path — and a path not on `public-text.allow-list.ts` fails
  the test as `file:line: path`. Each allow-list entry is a fictitious or generic example with
  its reason; none allows a whole root, and an entry no tracked path uses any more fails the test
  with its pattern (delete it). The negative test scans a temporary git repository holding a
  real-looking path per rule in a tracked file (reported) and an untracked one (not read). A new
  example path goes on the allow-list only when it is fictitious or generic; session names stay
  an item of the review checklist (no pattern list is committed, dl-005).

## Browsers

REQ-INT-08 (task-027): the e2e suite runs on the three engines of the pinned Playwright — the
projects `chromium` (Desktop Chrome), `firefox` (Desktop Firefox) and `webkit` (Desktop Safari) of
`playwright.config.ts`, every scenario on each, 100 % passing on each engine. Setup, once per
machine: `npx playwright install chromium firefox webkit` (the browser builds, no administrator
rights) and, for WebKit on Linux, its system libraries `sudo npx playwright install-deps` (done by
the approver on the development machine; a missing library makes every `webkit` test fail at
launch — stop and ask). An engine difference is handled in `test/e2e/support/`, never in a spec
(the clipboard grants of `support/clipboard.ts` are the only one so far); a scenario skipped on an
engine needs the approver's decision, recorded in the task. The `@perf` tests (TT-PERF-04) run on
Chromium only (`grepInvert` of the other two projects) and the timing suite's Playwright part
(`playwright.timing.config.ts`) is Chromium only (RP-44); `test/harness/playwright-config.test.ts`
checks both configs and the scripts.

Which run when (task-027 D27-4, the approver's "hybrid"):

- **Inner loop (each task, before handing work back):** `npm run test:e2e:chromium` (the whole
  suite on Chromium) plus the task's own spec files on the three engines,
  `npm run test:e2e -- test/e2e/<own>.spec.ts …` (the global setup builds as for a full run).
- **Gate at the end of every wave and at release validation:** `npm run test:e2e` — the whole
  suite on the three engines; AC-1 of task-027 (100 % on each engine) is proved there.

Note for a narrower run: `--project` takes several values, so `--project chromium <files>` reads
the files as project names; write `--project=chromium` (as the script does).

Run time, measured on 2026-10-13 (default workers — 6 on 12 cores —, `fullyParallel`, other
checkouts running; loads in task-027's Execution Notes): `npm run test:e2e`, 385 tests on the three
engines, **28.5 min** at load 20 → 19 (sum of test durations: Chromium 21 min, Firefox 25 min,
WebKit 19 min); `npm run test:e2e:chromium`, 133 tests, **8.3 min** at load 14.5 → 16.2. Each
engine alone, before task-027's own specs: Chromium 8.2 min, Firefox 14.0 min, WebKit 8.8 min.

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

`npm run test:timing` also runs a Playwright part (`playwright.timing.config.ts`, W3-47; Chromium
only, task-027): the live-refresh scenarios S-25.2, S-26.1, S-26.2 and S-27.2 (tag `@live-refresh`)
on the real bin, one at a time, with `WFUI_STRICT_REFRESH=1`: the screen must change within 5 s of
the mutation (the commit, the file write or the CLI verb that commits — watcher, event stream,
refetch and render included), and each time is printed with the load (`refreshClock()` of
`test/e2e/support/cold-read.ts`). The same tests in `npm run test:e2e` check the behaviour only (the
screen changes by itself, without a reload) with the cold-read budget, at any load. It also runs
TT-PERF-04 (tag `@perf`, `performance.spec.ts`, task-021): each other view reached by in-app
navigation on the large fixture, 1 warm-up + 20 runs, p95 ≤ 1.0 s asserted and printed with the
load; `npm run test:e2e` runs the same spec with 2 runs and no budget. TT-PERF-01 (task-036, same
spec and tag): Today reached by opening the project — since task-042 (D42-9) a run starts on the
start page `/` (no project, so no notification bell reading Today), opens the project switcher and
presses Enter on the project's row, so the measured path includes opening the project (the header
read) and is not directly comparable with task-036's numbers —, the first open after the start
≤ 5.0 s and 20 warm runs p95 ≤ 2.0 s; the RP-9 "after one commit" runs (an empty commit before each, on a copy of the
large fixture) are printed with the load, not asserted. TT-PERF-02 (task-038, same spec and tag):
on a copy of the large fixture, approvals of distinct `pending` tasks and submits of distinct
`draft` tasks, each timed from the click to the toast showing its commit line, 1 warm-up + 20 runs
per series, p95 ≤ 3.0 s.

TT-PERF-07 (task-034, `auto-sync.timing.test.ts`): on the bin with the default interval (60 s), a
commit pushed to the fixture's remote shows one more commit behind in `GET /api/p/:pid` within 65 s
in 10 out of 10 trials, and with `autoFetch` off the bin's `GIT_TRACE` file records no `git fetch`
in 120 s (about 13 minutes in all).
Y-02.1 (task-039, `git-status.spec.ts`, tag `@live-refresh`) runs there with the default 60 s
interval: the sidebar shows "1 behind" within 65 s of the remote commit, printed with the load
(once; the 10-of-10 trials are the API-side test above). Y-04.2 (same spec) is a 5 s live refresh.
Y-05.2 (task-040, `update-push.spec.ts`, tag `@live-refresh`) runs there with the default 60 s
interval and Auto-update on: the copy's HEAD is at the remote's commit within 65 s of it, printed
with the load.

C-07.3 (task-041, `ui-settings.timing.test.ts`): on the bin with the default interval, `autoFetch`
turned off with `PUT /api/settings` right after an automatic fetch ended → no `git fetch` in the
`GIT_TRACE` file for 120 s (about 4 minutes).

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

UI settings (task-030): a seeded `state.json` may keep `settings: {}` (it reads as the defaults of
spec-006 §2); an `actionLog` entry must be `{ sha, at }` (40 or 64 hex, ISO 8601 UTC) or the file
is kept aside as corrupt. Route tests use the in-memory store and an `InProcessEventBus`; the bin
test `launcher/settings.test.ts` gives every console its own state directory. An e2e console
seeds its settings with `ConsoleOptions.settings` (`support/console.ts`, Wave 5 C2): the given keys
are written into the seeded `state.json`, the others read as their defaults.

Governed writes (task-032): `server/http/element-writes.test.ts` runs the three write routes on
kanban copies with the real snapshot registry over an `AuditedRunner`; a test that asserts "0
processes" for rows 5–6 first reads the project in its current state (`warm()`, as the page does,
D32-3) and changes the copy afterwards for the fresh row-7 and row-9 checks.
`server/cli/governed-verbs.test.ts` characterises the pinned CLI's verbs (W-24, W-28, W-29);
`launcher/element-writes.test.ts` makes one write through the bin. `test/scripts/` tests the
repository's scripts (`action-log-ratio.mjs`, TT-SEC-10).

Git sync (task-033): `server/http/git-routes.test.ts` and `repository-status.test.ts` start a
console with `server/http/git-console.ts` on a kanban copy (`copyFixture` gives each copy its own
bare `origin`); `remoteCommit()` moves the remote from another clone, so the copy is behind once
fetched. The watcher is off: a change made with git is seen after `check()` or under the write
lock (the fresh state). Process counts separate `transport` (fetch, pull, push) from the reads.
`server/git/transport-facts.test.ts` characterises the git of the machine (`GIT_ALLOW_PROTOCOL`,
automatic maintenance, a local upstream, `pull --ff-only` on a diverged copy; task-034: a merge
commit or a staged squash behind `--ff-only`, tags and branches pruned by `--prune`, the hooks and
askpass programs of unattended runs, a merge under a stopped `git am` — each reproduced with git's
defaults, then held by the arguments used).

Auto-sync (task-034): `server/sync/scheduler.test.ts` drives the timer with fake timers over a
recording work port; `server/sync/auto-sync.test.ts` runs ticks (`SyncScheduler.tick()`) on
`git-console.ts` copies with the settings put in the memory store; `server/http/auto-push.test.ts`
starts the console with `autoPush` (an optional lower time limit for the held-remote cases).
`launcher/auto-sync.test.ts` runs the bin with `fetchIntervalSeconds` = 15 seeded in its state
(RP-53): the console's real bin also fetches by itself every 60 s by default, which a test that
counts git processes over time must account for (seed `autoFetch: false`).

`secret-scan.ts` is the REQ-SEC-09 scan: `scanForSecrets(paths, values)` searches files and
directories for the given values (the printed token, a planted environment value) and for
credential shapes (URL userinfo, bearer headers, GitHub/GitLab/AWS tokens, session cookies).

`security.ts` holds the REQ-SEC-05 probe (`SHELL_PAYLOAD`, `pwned()`) for every test that passes
user input to a process.

WingFoil 0.2.2 quirks the builder works around: `memory add` always writes `draft` (W-21, the
`unknown` fixture amends the add commit to the first declared state); task transitions after a
waiting state are hand-written `wf(…)` commits (W-20).
