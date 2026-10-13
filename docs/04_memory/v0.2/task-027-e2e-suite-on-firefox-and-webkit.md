---
id: task-027-e2e-suite-on-firefox-and-webkit
type: task
title: "E2e suite on Firefox and WebKit"
status: in-progress
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2","governance","e2e"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-009-memory-list-e2e-reads-the-filter-names-once-and-fails-under-load"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-INT-08 (*Supported browsers*) is staged: v0.1 runs the e2e suite on Chromium only, v0.2 on
Chromium, Firefox and WebKit (SARD `04` REQ-INT-08 Release field; `minor-v0.2` *Scope*
"Browsers"; `playwright.config.ts` comment). No v0.2 backlog record carries the extension
(TT-INT-08 is a v0.1 record, done in task-001-workspace-tooling-and-e2e-harness of v0.1), so it is
this governance task, run early so that every later web task's e2e runs on the three engines
(RP-42, RP-44). On the session-4 audit checklist (RP-50).

**Backlog items:** GOV (governance — REQ-INT-08 v0.2 extension; serves TT-INT-08, X1)

## Acceptance Criteria

- **AC-1** `playwright.config.ts` declares the projects `chromium`, `firefox` and `webkit` (the
  engines of the pinned Playwright); REQ-INT-08 fit criterion: [percentage] 100 % of the e2e
  scenarios pass on each of the three engines — the whole v0.1 suite, unchanged in what it asserts.
  An engine-specific difference is handled in `test/e2e/support/`; a scenario skipped on an engine needs the approver's
  decision, recorded in this task.
- **AC-1b (clipboard, m7)** A cross-engine clipboard helper in `test/e2e/support/` (Playwright
  grants clipboard permissions on Chromium only): it returns the text a *Copy* button wrote, on
  each of the three engines, with a self-test in `test/e2e/harness/`; task-035-how-to-join-panel
  (C-08.2) uses it.
- **AC-2 (RP-44)** Timing and perf runs stay on Chromium only: `playwright.timing.config.ts` and
  the `@perf` runs are not multiplied by engine.
- **AC-3 (RP-44)** The browser setup is documented in `test/README.md` (and the README's developer
  setup): `npx playwright install firefox webkit` and the WebKit system dependencies
  `npx playwright install-deps` (sudo — performed by the approver on the development machine; the
  task stops and asks when they are missing). The e2e run time per engine is recorded.
- **AC-5 (bug-009)** Every comparison of filter names in `test/e2e/memory-list.spec.ts`
  (`filterNames`) retries until the list shows what the user reads (`expect.poll` or a retrying
  locator assertion): no single-shot read of a list that is still rendering, on any of the three
  engines; the spec passes in the full `test:e2e` run, not only alone.
- **AC-4** `test/README.md` (`npm run test:e2e` row, *Layout*) and the `playwright.config.ts`
  comment updated; `typecheck`, `lint`, `format:check`, `test:coverage`, `test:e2e` (three
  engines) green.

## Implementation Notes

- SARD `04` REQ-INT-08 (Release v0.1 Chromium · v0.2 three engines; verified by e2e-smoke
  `drive-browser`); release-planning v0.1 session 2 (REQ-INT-08 staged).
- Three engines multiply the e2e load (bug-004): keep `fullyParallel` and the cold-read budget of
  `test/e2e/support/cold-read.ts`; measure before changing workers.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-13)

Read: this task, bug-009, task-026 Execution Notes (design, decisions, red/green/refactor,
reviews), `release-planning-rel-v0.2-plan` RP-44, RP-50, RP-53, SARD `04` REQ-INT-08,
`test/README.md` (0.26), `README.md` (developer setup), `playwright.config.ts`,
`playwright.timing.config.ts`, `test/e2e/support/*` (`axe.ts`, `cold-read.ts`, `fixtures.ts`,
`global-setup.ts`, `keyboard.ts`, `perf.ts`), `test/e2e/harness/axe.spec.ts`,
`test/e2e/memory-list.spec.ts`, `test/e2e/performance.spec.ts`, `web/src/memory/MemoryList.tsx`
and `model.ts` (`typeFilters`), task-035 (the clipboard consumer, C-08.2).

**depends_on — task-026 (dl-015 gate).** Its rules bind this task: (1) every runner's temporary
folders land under the run's root `wfui-run-*` (`test/harness/temp-root.ts`); the Firefox and
WebKit profiles Playwright creates under `os.tmpdir()` do too, and the global teardown removes them
with the root — checked by counting `wfui-*` entries in the system temporary directory before and
after each three-engine run (probes below: 1 before, the pre-existing `wfui-no-hooks-*` of an earlier
run, 1 after; no `wfui-run-*` root and no console left). (2) Fresh reads: an assertion on a list
that a refetch or a second query fills must retry until the screen shows it (AC-5 is exactly this);
no new measured read is added. (3) Load independence (bug-004): no load-adaptive branch;
`COLD_READ_MS` and the 180 s test timeout stay; a timeout under load is re-run alone and reported.

#### AC classification

| AC | kind | red-first / check |
|----|------|-------------------|
| AC-1 | configuration + characterization | red: `npx playwright test --project firefox` / `webkit` fails today (no such project). The probe below is the characterization; the one WebKit failure is fixed test-side (D27-1). |
| AC-1b | **red-first** | `test/e2e/harness/clipboard.spec.ts` (runs on the three projects): a routed `http://localhost/` page with a *Copy* button calling `navigator.clipboard.writeText`; the helper returns that text; a second case shows a click that writes nothing fails (sentinel kept), so a stale clipboard cannot pass. Fails today: no helper. |
| AC-2 | **red-first** | `test/harness/playwright-config.test.ts` (Vitest, imports the two configs): `playwright.timing.config.ts` has exactly one project, `chromium`; in `playwright.config.ts` the `firefox` and `webkit` projects exclude `@perf` (D27-2) and every project includes `@live-refresh`. Fails today on the projects list. |
| AC-3 | documentation | `test/README.md`, `README.md`; per-engine time recorded below and again after green. |
| AC-5 (bug-009) | **red-first by fault injection** | a one-off run (not committed) with `GET /api/…/config` held back by `page.route` until the rows show: the current single-shot `filterNames` comparisons fail (S-28.1, M-01.x state filter, M-02.1); with `expect.poll` they pass. Recorded in *red / green / refactor*. |
| AC-4 | gates | — |

#### Probe (2026-10-13, Playwright 1.63.0: Chromium 153.0, Firefox 155.0, WebKit 26.6)

Each engine alone, the whole suite (129 tests) with the current specs, a temporary config adding
the projects (not committed), default workers (6 on 12 cores), the coordinator's full gate running
in another checkout at the same time:

| Engine | Result | Wall time | Sum of test durations | Load start → end |
|--------|--------|-----------|-----------------------|------------------|
| Chromium | **129/129 passed** | 8.2 min | 938 s | 12.7 → 16.1 |
| Firefox | **129/129 passed** | 14.0 min | 1 913 s | 16.1 → 14.9 |
| WebKit | **128/129 passed**, 1 failed | 8.8 min | 1 175 s | 11.6 → 19.2 |

Failure inventory:

1. WebKit — `test/e2e/harness/axe.spec.ts` › "reports nothing for an accessible page in both
   themes": axe `color-contrast` (serious) on the static page's `<button>` in the dark theme. Cause:
   WebKit's user-agent style for a button under `color-scheme: dark` is white text on
   `rgb(192, 192, 192)` (≈ 1.8:1); Chromium gives white on `rgb(107, 107, 107)`, Firefox
   `rgb(251, 251, 254)` on `rgb(43, 42, 51)`. The page is the self-test's own fixture with no
   button style. **Not a product defect**: every product screen's axe scan passed on WebKit in both
   themes (`accessibility.spec.ts` X-06.4 over `SCREENS`, and each spec's `scanThemes`) — the
   console styles its buttons. Plan: D27-1.

No other failure on any engine: keyboard walks (`tabUntil`, `expectFocusVisible` — WebKit included),
focus-ring contrast, the event stream, `recordServerEvents`, the X-09.1 key build, the clone
flows and the `@live-refresh` tests (behaviour mode) all pass. bug-009 did not reproduce in these
runs (load ≤ 19); its cause is understood (below), so the fix does not wait for a reproduction.

#### Plan per item

- **Projects (AC-1)** — `playwright.config.ts`: `chromium` (`Desktop Chrome`), `firefox`
  (`Desktop Firefox`), `webkit` (`Desktop Safari`); comment rewritten (REQ-INT-08 v0.2: three
  engines). No engine branch in any spec; an engine difference goes into `test/e2e/support/` (the
  clipboard grant is the only one found).
- **D27-1** — the axe self-test fixture (below).
- **Clipboard helper (AC-1b)** — `test/e2e/support/clipboard.ts`. Probe on the three engines with
  the pinned Playwright: Chromium denies `writeText` and `readText` unless the context is granted
  `clipboard-read` + `clipboard-write`; Firefox writes and reads with no grant, and
  `grantPermissions(['clipboard-read'])` **throws** "Unknown permission"; WebKit writes with no
  grant, needs `clipboard-read` to read, and throws on `clipboard-write`. A page's `writeText`
  outside a user gesture works on all three once granted (checked). Design (D27-3 ★):
  `allowClipboard(context, browserName)` grants per engine (Chromium read+write, WebKit read,
  Firefox nothing); `copiedBy(page, action)` writes a unique sentinel to the clipboard, runs the
  action (the click on *Copy*), then `expect.poll` reads `navigator.clipboard.readText()` until it
  differs from the sentinel and returns it — so the test asserts what the browser's clipboard holds,
  never a stale value. Self-test in `test/e2e/harness/clipboard.spec.ts`. Contexts of one browser
  share its clipboard, but tests of one worker run one at a time and every worker has its own
  browser process, so parallel tests do not interfere.
- **Timing and perf on Chromium only (AC-2, RP-44, RP-53)** — `playwright.timing.config.ts` sets
  `projects` to the `chromium` project only (it spreads the base config today, so it would inherit
  three). In `npm run test:e2e`, `@perf` (`performance.spec.ts`, TT-PERF-04, 2 runs without a
  budget, the large fixture built once per worker) is excluded from `firefox` and `webkit` with a
  project `grepInvert` (D27-2 ★). It is a measurement, not a BDD scenario: the functional
  scenarios it times (M-01.1, G-01.1, R-05.1 … R-08.1) run on the three engines in their own specs.
  `@live-refresh` tests are scenarios: in `test:e2e` they run on the three engines (behaviour,
  cold-read budget); the strict 5 s and the RP-53 60/65/120 s budgets only in `test:timing` on
  Chromium.
- **Workers and parallelism (bug-004)** — keep `fullyParallel`, `COLD_READ_MS`, the 180 s
  timeout, default workers. One `playwright test` run with three projects (D27-4 ★): the same
  worker pool runs the 129 × 3 − 14 tests (the 7 `@perf` tests run once); Playwright binds a worker
  to one project, so each engine's workers build their own fixtures (the `prebuild` worker fixture,
  300 s, is unchanged). Expected wall time ≈ the sum of the three probes (~30 min at this load);
  measured in green, at least once alone (load recorded), before any change to workers.
  `npx playwright test --project <engine>` runs one engine (documented).
- **bug-009 (AC-5)** — cause: the type filters are `typeFilters(memory.yaml types, elements)`
  (`web/src/memory/model.ts`): the declared types come from `GET /config`, the counts and any
  undeclared type from `GET /elements`. `openList` waits for the first row (the elements read);
  if `/config` has not answered yet, the filter row shows only the types present among the elements
  (S-28.1 kanban: 2 of 7), then the full list once `/config` lands. The UI converges (no product
  defect); the test reads too early. Fix: the four `filterNames` comparisons of
  `memory-list.spec.ts` (lines 128, 185, 198 — already polled — and 376) become
  `await expect.poll(() => filterNames(…), { timeout: COLD_READ_MS })…` (the first one after a
  cold read; COLD_READ_MS so a slow `/config` under load is waited for, as every first read).
  Other single-shot list reads in the suite (`team`, `directives`, `dna`, `documentation`,
  `element-panel`, `listed()` in `memory-list`) were checked: each reads a list filled by one
  query after a wait on it (a count or the first item), so they do not have this two-query race;
  left unchanged.
- **Docs (AC-3, AC-4)** — `test/README.md` 0.27: `npm run test:e2e` row (three engines;
  `--project`), *Layout* (`support/clipboard.ts`, `harness/clipboard.spec.ts`), a *Browsers*
  paragraph (`npx playwright install chromium firefox webkit`; WebKit system dependencies
  `npx playwright install-deps`, sudo, done by the approver; the per-engine run time), *Timing
  suite* (Chromium only); `README.md` developer setup (browser line, `test:e2e` row);
  `playwright.config.ts` comment; `CHANGELOG.md` *Unreleased* › Changed (the e2e suite runs on
  Chromium, Firefox and WebKit, REQ-INT-08). SARD REQ-INT-08 already states the v0.2 staging: no
  change.

#### Test plan

Vitest: `test/harness/playwright-config.test.ts` (AC-2). Playwright: `harness/clipboard.spec.ts`
(AC-1b, three engines), `harness/axe.spec.ts` (D27-1), `memory-list.spec.ts` (AC-5); the whole
suite on the three projects (AC-1). Negative checks: AC-5 fault injection (above); the clipboard
self-test's "nothing copied" case; the axe self-test's two violation cases unchanged on the three
engines. e2e closure: this task closes no BDD scenario (it runs all of them on two more engines).

#### Open decisions

- **D27-1 — WebKit: the axe self-test's fixture page fails `color-contrast` in the dark theme**
  (the engine's default button colours; test fixture only, no product screen affected).
  ★ (a) give the self-test's static page a button style from its own tokens (`color: var(--fg);
  background: var(--bg); border: 1px solid var(--fg)`), so the page is accessible on every engine;
  the assertion ("nothing reported for an accessible page") and the two violation cases stay as
  they are; (b) skip that one self-test on WebKit (an approver's skip, recorded here);
  (c) drop the button from `THEMED` and build `NAMELESS_BUTTON` by adding one.
- **D27-2 — `@perf` in `npm run test:e2e`.** ★ (a) Chromium only: `grepInvert: /@perf/` on the
  `firefox` and `webkit` projects (AC-2 "not multiplied by engine"; TT-PERF-04 is a measurement,
  its scenarios run on every engine in their own specs); (b) run the 2-run `@perf` smoke on the
  three engines in `test:e2e` and keep only `test:timing` on Chromium (~+2 min per engine, three
  large-fixture builds); (c) `test.skip(browserName !== 'chromium')` in `performance.spec.ts`
  (an engine branch in a spec, against AC-1's "in `test/e2e/support/`").
- **D27-3 — clipboard helper mechanism (new shared support function).** ★ (a) the real clipboard:
  per-engine grant + sentinel + polled `navigator.clipboard.readText()` (above);
  (b) an init-script spy on `navigator.clipboard.writeText` (no grant needed, but it proves the
  page called the API, not that the clipboard holds the text, and misses `execCommand('copy')`);
  (c) paste with Ctrl/Cmd+V into a scratch `<textarea>` injected into the page (works on the three
  engines with the same grants, but changes the DOM of the screen under test and its focus).
- **D27-4 — how `test:e2e` runs the three engines.** ★ (a) one `playwright test` run, three
  projects, default workers, `fullyParallel` (bug-004: measure before changing workers);
  (b) three sequential runs in the npm script (`--project chromium && … firefox && … webkit`):
  same total, but a failure on the first engine hides the others and the build runs three times;
  (c) (a) with `workers` raised to use the cores Firefox leaves idle — only after measuring (a).

#### Decisions (approver, 2026-10-13)

- **D27-1 (a)** — the axe self-test's static page gets a button style from its own tokens.
- **D27-2 (a)** — `@perf` runs on Chromium only (`grepInvert` on the `firefox` and `webkit`
  projects).
- **D27-3 (a)** — the real clipboard: per-engine grant, sentinel, polled `readText()`.
- **D27-4 (C, "hybrid", a new option)** — `npm run test:e2e` runs the three engines (one run,
  three projects, default workers, `fullyParallel`; measure before touching workers): it is the
  gate at the end of every wave and at release validation, and AC-1 (100 % on each engine) is
  proved there. A second script runs the whole suite on Chromium only for the inner dev loop, and
  a documented command runs a task's own spec files on the three engines. Developer agents run the
  Chromium suite plus their own specs on the three engines. Rationale (the coordinator's cost
  estimate): about 43 e2e runs are left in v0.2; three engines on every run ≈ 25 h of machine time
  and +6–7 h on the critical path, the hybrid ≈ 13–14 h.

### red / green / refactor (2026-10-13)

- **Projects, timing, scripts (AC-1, AC-2, D27-2, D27-4 C)** — `8204bf6`, `5ee1f55`. Red first:
  `test/harness/playwright-config.test.ts` (it held the v0.1 "exactly one project, chromium"
  check) rewritten: three projects on their own engines (`defaultBrowserType` of the device),
  `fullyParallel`, no `workers`; `@perf` excluded on `firefox`/`webkit` and `@live-refresh` on
  none; the timing config one `chromium` project, one worker, both tags; `package.json`
  `test:e2e` and `test:e2e:chromium`. 3 of 4 failed before the change, 4/4 after. The timing
  config is imported with `WFUI_STRICT_REFRESH` restored afterwards (the config sets it).
  Deviation found while running: `--project` is variadic, so `playwright test --project chromium
  <files>` reads the files as project names ("Project(s) … not found"); the script uses
  `--project=chromium`, so `npm run test:e2e:chromium -- <files>` works (documented in
  `test/README.md` *Browsers*).
- **D27-1** — `f6faff4`: the axe self-test page styles its button from its own tokens. Red: the
  WebKit probe failure (design); green on the three engines (the two violation cases unchanged).
- **Clipboard helper (AC-1b, D27-3)** — `f6faff4`: `test/e2e/support/clipboard.ts`
  (`allowClipboard`, `copiedBy`), self-test `test/e2e/harness/clipboard.spec.ts` — Clipboard API,
  `execCommand('copy')`, the same text copied twice, nothing copied fails. Red first: the spec
  failed to load (no module). Green: 12/12 on the three engines. Negative check (not committed):
  with the sentinel write removed, "fails when the action copies nothing" fails on all three
  engines (the helper returns the stale text) — 3 failed, 9 passed.
- **bug-009 (AC-5)** — `5ee1f55`. Red by fault injection (not committed): `openList` with
  `GET /api/p/*/config` held 3 s by `page.route`, current code, Chromium: **5 failed** (M-01.5,
  M-02.1, S-28.1 kanban/custom/unknown — the single-shot `filterNames`), 1 passed (M-02.3, the one
  already polled). Green: every `filterNames` comparison is `expect.poll(…, { timeout:
  COLD_READ_MS })` (the four of the file, M-02.3's included, so a slow `/config` under load is
  waited for like every first read); with the injection still in place **6/6 passed**; injection
  removed, `memory-list.spec.ts` on the three engines **63/63 passed** (5.4 min). The helper's
  comment states why (two queries answer independently).
- **Docs** — `32ce12f`: `test/README.md` 0.27 (commands table, *Layout*, new *Browsers* section
  with the inner-loop / wave-gate rule and the run times, *Timing suite* Chromium only),
  `README.md` (browser requirement, scripts table, browser setup), `CLAUDE.md` 0.4 (the *Checks*
  line follows D27-4 C), `CHANGELOG.md` *Unreleased* › Changed, `playwright.config.ts` and
  `playwright.timing.config.ts` comments.

### checks (2026-10-13, HEAD `32ce12f`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | 10.5 |
| `npm run test:coverage` | 121 files passed, 1 skipped; **2032 passed / 1 skipped**; statements 96.8 %, branches 91.17 %, functions 97.39 %, lines 98.41 % | 9.0 → 21.3 |
| `npm run docs:api` | OK | — |
| `check_tasks.py v0.2` | OK (17 tasks · 46 items) | — |
| `npm run test:e2e` (three engines) | **385 passed** (133 Chromium, 126 Firefox, 126 WebKit — the 7 `@perf` on Chromium only), 0 failed, 0 flaky; wall **28.5 min**; sum of test durations Chromium 1 260 s, Firefox 1 485 s, WebKit 1 134 s | 20.0 → 19.1 (trace 17–22) |
| `npm run test:e2e:chromium` | **133 passed**, 8.3 min | 14.5 → 16.2 |
| `npm run test:e2e -- harness/clipboard.spec.ts harness/axe.spec.ts memory-list.spec.ts` (own specs, three engines) | **84 passed**, 4.8 min | 15.2 → 32.3 |
| `npm run test:smoke` | **4/4 passed** | 30.6 → 24.0 |
| `npm run test:timing` | **skipped**: load 22.7 (≥ 12). AC-2 checked without running it: `playwright test --config playwright.timing.config.ts --list` → 14 tests, all `[chromium]`; `playwright-config.test.ts` green | 22.7 |

AC-1: 100 % of the scenarios pass on each engine (the full run above; no skip, the `@perf`
measurement on Chromium only by D27-2). `wfui-*` entries in the system temporary directory: 1
before (the pre-existing `wfui-no-hooks-*`), 1 after all the runs — 0 new, no `wfui-run-*` root, no
console left (`pgrep -af bin/wingfoil-ui.cjs`).

### review (round 1, 2026-10-13)

Independent review: **FAIL** (2 minor, 2 nits; the rest verified).

- **F1 (minor)** — `playwright-config.test.ts` would miss an engine skip hidden in another
  project key (`testIgnore`, `testMatch`, `grep`) or a widened `grepInvert` (e.g.
  `/@perf|M-01/`). Change: a new test "hides no test from any engine but @perf" — no suite-wide
  `grep`/`grepInvert`/`testIgnore`/`testMatch`; each project's keys exactly `name` + `use` (+
  `grepInvert` on `firefox`/`webkit`); `grepInvert` source and flags exactly `@perf` / `''` on
  `firefox` and `webkit`, none on `chromium`. Red check (not committed): `PERF = /@perf|M-01/` →
  the new test fails (the old ones still passed); `testIgnore: /clipboard/` on `webkit` → fails;
  restored → 5/5.
- **F2 (minor)** — M-01.4 waited for `adr, 0 elements` (a link only `GET /config` gives) with the
  default 5 s: the bug-009 race. Change: `{ timeout: COLD_READ_MS }` with a comment. Sweep of the
  suite for other assertions on something only the configuration shows (declared types or states
  with no element) — a type or state filter that exists among the elements also shows before
  `/config` answers, so only zero-element entries race: `memory-list.spec.ts` M-01.1 (`task, 4`,
  `bug, 1` — elements), M-01.2 (*All types*, the bucket links — elements' descriptors), M-01.5
  (`task, 4`; the state names polled), M-02.1 (`story`, `note` — elements, after the poll), M-02.2
  (bucket links, *Done* with 0 included — descriptor buckets, not configuration), M-02.3
  (`story` — elements); `scrum.spec.ts` (`task, 3`); **`projects.spec.ts` S-16.1 (switch to custom):
  `plan, …` — the custom fixture has no `plan` element, so config-only with 5 s: fixed the same
  way**; `decision-log, …` there has elements. The DNA, directives, team, documentation and header
  views read the configuration as their own first read, waited for with `expectFirstLoad` /
  `COLD_READ_MS` already (single query, no race).
- **F3 (nit)** — `clipboard.spec.ts`: `.rejects.toThrow(/nothing was copied/)` (the helper's
  message).
- **F4 (nit)** — the lines this task added over 100 columns re-wrapped: `test/README.md` (the
  `harness/` paragraph, the *Timing suite* Playwright paragraph), `README.md` (browser
  requirement, browser setup). Longer lines elsewhere in the file predate this task.
- Checks after the fixes: `typecheck`, `lint`, `format:check` clean; `playwright-config.test.ts`
  + `public-text.test.ts` 72 passed; `check_tasks.py v0.2` OK; `npm run test:e2e --
  memory-list.spec.ts harness/clipboard.spec.ts projects.spec.ts` on the three engines **108
  passed** (7.0 min, load 10.3 → 27.8); `wfui-*` entries 1 before, 1 after (the pre-existing one);
  no console left.

### review (round 2, 2026-10-13)

- Independent fresh-context review: round 1 **FAIL** (2 minor, 2 nits), round 2 **PASS** on
  `29b2aca` (no finding): F1 red cases re-derived from the assertions, the F2 sweep claim checked
  against `web/src/memory/model.ts` (only zero-element filter entries depend on `GET /config`),
  the clipboard self-test re-run on the three engines (12/12), the re-wraps changed no words.
- `main` merged into the task branch before submit (`5bf34eb`). The full three-engine `test:e2e`
  (385) predates `29b2aca`; the changed specs were re-run on the three engines (108/108) and the
  wave 0 gate on `main` runs the full suite after the merge.
