# Tests

**Version:** 0.1 · **Date:** 2026-10-05 (0.1: workspace tooling and e2e harness — task-001)

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
- `test/lint/`, `test/docs/` — the dev-loop gates `lint.clean`, `docs.api.*`.

## Fixtures

`buildFixture(kind, { root, now?, cli?, cliVersion? })` builds the `kanban`, `custom` or `unknown`
fixture of `docs/02_requirements/02_bdd/00_conventions.md` with the pinned CLI (or another build,
for contract tests across the support matrix): a git repository `<root>/<kind>` with the standard
team and elements, its `package.json` pinning `wingfoil`, `node_modules/wingfoil` linked to the
CLI package, and a bare remote `<root>/remotes/<kind>.git` (`origin`, `main` pushed). Element
commits are dated 3 days before `now`; Alex is the current identity. Every process gets
`fixture.env`, which isolates git from the user's configuration.

A build takes ~10 s: build once per test file and use `copyFixture(fixture, otherRoot)` for a
fresh copy per test.

Variants (they change only the untracked `node_modules/wingfoil`):

- `installCliStub(fx, { failures })` — the CLI stub: the listed commands fail with the given
  status and stderr, everything else is delegated to the real CLI;
- `installCliStub(fx, { version })` — the version-fake variant;
- `removeCli(fx)` and `envWithoutWingfoil(env)` — the no-CLI variant.

WingFoil 0.2.2 quirks the builder works around: `memory add` always writes `draft` (W-21, the
`unknown` fixture amends the add commit to the first declared state); task transitions after a
waiting state are hand-written `wf(…)` commits (W-20).
