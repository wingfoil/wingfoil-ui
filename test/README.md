# Tests

**Version:** 0.8 · **Date:** 2026-10-06 (0.1: workspace tooling and e2e harness — task-001; 0.2: `test/launcher/`, `test/server/` — task-002; 0.3: `test/contracts/`, local state isolation, secret scan — task-007; 0.4: `local-security` suite — task-003; 0.5: process runner fake, hand-made CLI packages, stub after global options — task-004; 0.6: CLI contract tests, captured samples, `test:contract` — task-005; 0.7: action descriptor tests, REQ-ARC-05 lint rule — task-011; 0.8: matrix builds of `cliBuildFor`, capability table and README checks — task-006; 0.9: identity tests, bin with a seeded state — task-009)

Every test lives under `test/` (DNA `paths.tests`); sources stay in `server/src`, `web/src`,
`contracts/src`.

| Command | What it runs |
|---------|--------------|
| `npm test` | Vitest: every `test/**/*.test.ts` (unit, contract, harness, gates) |
| `npm run test:coverage` | the same with v8 coverage of `server/`, `contracts/`, `web/` (threshold 80 %, dev-loop `refactor`) |
| `npm run test:contract` | the contract tests of `test/contracts/` (e2e-smoke `contract`, spec-001 §7) |
| `npm run test:e2e` | Playwright: `test/e2e/**/*.spec.ts`, Chromium only in v0.1 (REQ-INT-08 staged) |
| `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run docs:api` | ESLint (with the REQ-SEC-05 no-shell rule on `server/`), Prettier, `tsc`, TypeDoc of `server/` and `contracts/` |

## Layout

- `test/harness/` — the e2e harness: process runner (`run.ts`, `execFile` only), the pinned CLI
  (`cli.ts`), and the fixture builder (`fixtures/`).
- `test/e2e/` — Playwright specs; `support/axe.ts` scans a screen in the light and the dark theme
  (X-06.4).
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

## Fixtures

`buildFixture(kind, { root, now?, cli?, cliVersion? })` builds the `kanban`, `custom` or `unknown`
fixture of `docs/02_requirements/02_bdd/00_conventions.md` with the pinned CLI (or another build,
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
