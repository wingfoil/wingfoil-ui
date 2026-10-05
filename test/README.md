# Tests

**Version:** 0.3 · **Date:** 2026-10-05 (0.1: workspace tooling and e2e harness — task-001; 0.2: `test/launcher/`, `test/server/` — task-002; 0.3: process runner fake, hand-made CLI packages, stub after global options — task-004)

Every test lives under `test/` (DNA `paths.tests`); sources stay in `server/src`, `web/src`,
`contracts/src`.

| Command | What it runs |
|---------|--------------|
| `npm test` | Vitest: every `test/**/*.test.ts` (unit, contract, harness, gates) |
| `npm run test:coverage` | the same with v8 coverage of `server/`, `contracts/`, `web/` (threshold 80 %, dev-loop `refactor`) |
| `npm run test:e2e` | Playwright: `test/e2e/**/*.spec.ts`, Chromium only in v0.1 (REQ-INT-08 staged) |
| `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run docs:api` | ESLint (with the REQ-SEC-05 no-shell rule on `server/`), Prettier, `tsc`, TypeDoc of `server/` and `contracts/` |

## Layout

- `test/harness/` — the e2e harness: process runner (`run.ts`, `execFile` only), the pinned CLI
  (`cli.ts`), and the fixture builder (`fixtures/`).
- `test/e2e/` — Playwright specs; `support/axe.ts` scans a screen in the light and the dark theme
  (X-06.4).
- `test/launcher/` — the `wingfoil-ui` bin driven as a child process (`launcher.ts`:
  `startLauncher(args, env)` waits for the running line and returns port, token and stop helpers;
  later e2e suites start the console with it).
- `test/server/` — unit tests of `server/src`, mirroring its folders. `process/fake-runner.ts` is the
  in-memory fake of the process runner port (adr-002); `cli/fake-cli.ts` writes hand-made `wingfoil`
  packages (a marking or sleeping CLI) and installs a package globally (`<prefix>/bin/wingfoil` →
  `<prefix>/lib/node_modules/wingfoil/…`) for the discovery tests.
- `test/lint/`, `test/docs/` — the dev-loop gates `lint.clean`, `docs.api.*`.

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

`security.ts` holds the REQ-SEC-05 probe (`SHELL_PAYLOAD`, `pwned()`) for every test that passes
user input to a process.

WingFoil 0.2.2 quirks the builder works around: `memory add` always writes `draft` (W-21, the
`unknown` fixture amends the add commit to the first declared state); task transitions after a
waiting state are hand-written `wf(…)` commits (W-20).
