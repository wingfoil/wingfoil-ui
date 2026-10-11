---
id: bug-007-packed-package-cannot-start-and-would-ship-private-and-development-files
type: bug
title: "Packed package cannot start and would ship private and development files"
status: in-review
severity: "medium"           # REQUIRED — critical | high | medium | low
release-origin: "v0.1"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: "S1"            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

`npm pack` of the repository produces a package that cannot start with `npx wingfoil-ui`
(US-S-01, TT-ARC-01) and would carry private and development files: the built `server/dist`,
`web/dist`, `contracts/dist` are missing, the runtime dependencies are not declared at the root,
and the git-ignored `export/`, `export1/`, `.idea/` plus `test/`, `docs/`, `.mcp.json` are included.

## Steps to Reproduce

1. On `main` (`3a74e9c`), with a built checkout: `npm pack --dry-run --json`.
2. Look at the file list: 707 files, ~2.2 MB; no path under `server/dist/`, `web/dist/` or
   `contracts/dist/`; `export/` (8 files), `export1/` (7), `.idea/` (3), `test/` (267),
   `docs/` (163), `.mcp.json` listed.
3. `package.json` (root): no `files` field, no `.npmignore` (npm then applies `.gitignore`, which
   ignores every `dist/`), no `dependencies` (the runtime ones — `fastify`, `@fastify/static`,
   `@formatjs/intl`, `ajv`, `pino`, `yaml` — are in `server/package.json`), and `server/dist` imports
   the workspace package `@wingfoil-ui/contracts` (`private`, not packed).

## Expected Behavior

The packed tarball, installed in an empty folder, starts with `npx wingfoil-ui --no-open`, prints
the URL and serves the UI on localhost (US-S-01, TT-ARC-01, spec-007 §2); it contains only what
the app needs at runtime (bin, built server/web/contracts, catalogues, LICENSE, README, CHANGELOG)
and nothing git-ignored or development-only.

## Actual Behavior

- Installed from the tarball, the bin finds no `server/dist/main.js` → `launcher.unexpected`,
  exit 70 (derived from the file list; not run end to end).
- Runtime dependencies and `@wingfoil-ui/contracts` would not be installed.
- `export/`, `export1/` (the user's material, excluded from git by `.git/info/exclude`) and
  `.idea/` would be published if `private: true` were removed.

## Evidence

- Found on 2026-10-11 while mapping the `e2e-smoke` `launch` step (plan
  `e2e-smoke-rel-v0.1-plan`, release validation of minor-v0.1): `npm pack --dry-run --json`.
- The e2e suite and `test/launcher/` start `node bin/wingfoil-ui.cjs` inside the checkout, so no
  test exercised the installed package.

## Notes

- Not published: `private: true` blocks `npm publish`, and v0.1 ships as a git tag only (RV-8).
- Fix direction (approver, 2026-10-11): a `files` allow-list, runtime dependencies at the root
  (or a bundled server), `@wingfoil-ui/contracts` resolved inside the package, `prepack: npm run
  build`; a packaged-launch smoke (pack → install in a temp folder → `npx wingfoil-ui --no-open`
  → UI reachable) and a test that fails when the tarball holds a path outside the allow-list.
  Absorbed into task-025 (dl-045 pattern).

## Triage & Execution Notes
- triage (2026-10-11): approved by the user as **medium** severity (release validation of
  minor-v0.1, plan `e2e-smoke-rel-v0.1-plan` ES-1).
- fix: **absorbed into task-025-installable-package-and-e2e-smoke-gaps** (dl-045 pattern; `bug:`
  list + AC-1…AC-3). `triaged → planned` set by hand (no CLI verb).
- start (2026-10-11): task-025 started → `planned → in-progress` by hand (bug.sync_state; no CLI
  verb); it is submitted together with task-025.
- fix (2026-10-11, task-025): `package.json` gets a `files` allow-list (bin, `server/dist/**/*.js`,
  `server/src/i18n/en.json`, `web/dist/`, the contracts' JSON, README, LICENSE, CHANGELOG), root
  `dependencies` equal to the server's, `prepack` = clean build (`scripts/clean-build.mjs`) + build;
  `@wingfoil-ui/contracts` stays type-only (ES-8); bin mode 100755. Tarball 120 files, 513 788 B
  (was 707 files, ~2.2 MB, no `dist/`). Guard `test/package/pack.test.ts` (default suite: exact
  allow-list, forbidden paths, one `server/dist` module per source, production build, dependencies);
  launch smoke `npm run test:smoke` (pack → install in a temp folder → `npx wingfoil-ui`). Independent
  review: round 1 FAIL (2 minor: dev React build packed; stale outputs not caught), round 2 PASS.
