---
id: task-029-npm-publishing-pipeline-and-registry-setup-checklist
type: task
title: "npm publishing pipeline and registry setup checklist"
status: in-progress
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2","governance","publishing"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

npm publishing of `wingfoil-ui`, deferred from v0.1 by dl-004 and placed in the scope of
`minor-v0.2` by `governance-alignment-rel-v0.2-plan` GA-4 (RP-3 (d), RP-42, RP-46): the publish
pipeline that `release-publishing` (`.wingfoil/workflows/custom/release-publishing.yaml` v1.2,
step `publish`) runs for the pushed tag — staged by the pipeline, made live by the approver
(`npm stage approve`, 2FA; RP-54) — and a checklist of the registry-side setup the approver
performs. dl-004 keeps `release: v0.1` and is cited here (RP-6). Governance task
(`module: governance`, `ref: GOV`); may run in any wave before release validation (RP-43); first
candidate to defer with task-042-notification-bell-all-roles-summary-and-empty-today if the
budget runs short (RP-51).

**Backlog items:** GOV (governance — dl-004 Actions, GA-4)

## Acceptance Criteria

- **AC-1 (pipeline, RP-54)** `.github/workflows/publish.yml`, run by a pushed `v*` tag, on the
  model of WingFoil's publish pipeline (`.github/workflows/publish.yml` of the public repository
  `wingfoil/wingfoil`, its header runbook): the repository gates (`typecheck`, `lint`,
  `format:check`, `test:coverage`, `test:smoke`) and a staging smoke on a local registry
  (Verdaccio: publish the packed tarball, install it into an empty folder, run `npx wingfoil-ui
  --version` and a `--no-open` start); then two gates — (1) the GitHub environment `npm-publish`
  (deployments from `v*` tags only; the approver reviews the deployment), (2) `npm stage publish`
  through an npm trusted publisher (OIDC) limited to staging, with no token in the repository or
  the workflow (directive `security-secrets`). The version goes live only when the approver runs
  `npm stage approve` with 2FA; the workflow never publishes live by itself.
- **AC-2 (package)** `package.json` drops `private: true` (root only; the workspaces stay private);
  `test/package/pack.test.ts` and `test/package/allow-list.ts` follow; the tarball's file list is
  unchanged otherwise.
- **AC-3 (local smoke)** The staging smoke runs locally as a script (e.g. `npm run
  test:publish-smoke`), with a recorded run; it never contacts the public registry.
- **AC-4 (approver checklist, RP-46, RP-54)** A checklist in the README's maintainer section or
  `docs/`: package name check on the registry; the GitHub environment `npm-publish` (approver as
  required reviewer, `v*` tags only); 2FA on the approver's npm account; the trusted publisher
  for this repository and workflow, limited to staging (stage-only); the `npm stage approve` step. The task is done
  with AC-1…AC-3 and the checklist; the approver performs the registry-side steps before
  `release-submit`, otherwise v0.2 ships as a tag only and a decision-log records it (as dl-004).
- **AC-5** `release-publishing` `publish` description still matches (no workflow change unless the
  approver asks); docs updated in the same change (directive `documentation`).

## Implementation Notes

- RP-54: two gates as in WingFoil's publish pipeline (public repository `wingfoil/wingfoil`,
  `.github/workflows/publish.yml` header runbook); read it at design for the exact steps.
- dl-004 *Context* (what the publish step presupposes) and *Actions*; GA-4; sequencer Q1
  (`docs/01_vision/07_sequencer.md`: published as `0.x` from the first releases).
- The packaging guard and launch smoke of task-025-installable-package-and-e2e-smoke-gaps (v0.1)
  are the base: reuse `test/smoke/` rather than a second install path.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-17)

Read: this task; dl-004 (*Context*, *Decision*, *Actions*) and dl-005; plan
`release-planning-rel-v0.2-plan` RP-3 (d), RP-6, RP-7, RP-42, RP-43, RP-46, RP-51, RP-54, RP-55;
`governance-alignment-rel-v0.2-plan` GA-4; `dev-loop-rel-v0.2-plan` (wave table: 029 "any time
before release validation", Session logs); `.wingfoil/workflows/custom/release-publishing.yaml`
v1.2 (`tag`, `publish`, `mark-released`) and `release-submit.yaml` v1.1; `test/README.md` 0.39
(*Layout* › `test/package/`, *Launch smoke*, *Temporary folders*); `package.json`;
`test/package/pack.test.ts`, `allow-list.ts`; `test/smoke/launch.smoke.test.ts`,
`global-setup.ts`, `vitest.smoke.config.ts`; README *Install and run*, *Install from a package*;
directives `security-secrets`, `documentation`, `doc-versioning`, `claim-evidence`,
`wingfoil-cli` (`npm run -s wingfoil -- directives list`). The model pipeline, read from the public
repository `wingfoil/wingfoil` (`main`, 2026-10-17): `.github/workflows/publish.yml` (header
runbook; jobs `gate`, `stage`, `promote`, `release`, `mcp-registry`), `scripts/publish-staging.cjs`
and the `publish:staging` script of its `package.json`; npm's documentation page *Trusted
publishers* (docs.npmjs.com).

**depends_on (task-026, hard gate dl-015).** task-026's Execution Notes (design D26-1…D26-5,
red/green/refactor, reviews) and, through it, task-025 (v0.1: ES-8…ES-13, the allow-list and the
launch smoke). What constrains this task: every temporary folder of the publish smoke lives under
the run's temporary root (`setUpTempRoot()` in the smoke's global setup; a test's own folder named
`wfui-…`, removed in `afterAll`), so a run leaves no `wfui-*` entry; `test:smoke` is a wave gate and
runs whenever packaging, the launcher or the bin changes — this task changes packaging
(`private`, `repository`), so `test:smoke` runs in its checks; ES-12: the install uses the user's
npm cache, `npx --no --` (never a registry fallback), `withoutNpmVars` (no `npm_*`, no
`NODE_ENV=test`); ES-13: the stop by SIGINT to the server process; the packed tarball must stay
exactly the allow-list (AC-2: "file list unchanged").

**State found.**

- No `.github/` folder (`git ls-files .github` empty): no CI of any kind exists, so the repository
  suite has never run on a GitHub runner; the tag run of this pipeline would be the first.
- `https://registry.npmjs.org/wingfoil-ui` answers 404 (curl, 2026-10-17): the name is unused.
- `origin` is `github.com/wingfoil/wingfoil-ui`; `package.json` has no `repository` field. npm's
  *Trusted publishers* page: "your package's `repository.url` field in `package.json` must exactly
  match your GitHub repository"; trusted publishing needs npm ≥ 11.5.1 and Node ≥ 22.14.0;
  `npm stage publish` "is always allowed" for a trusted publisher. The page does **not** say
  whether a trusted publisher can be configured for a name that has never been published
  (unverified — D29-10).
- Local npm is 11.6.2 (`npm --version`): it has no `stage` command (WingFoil's header: staged
  publishing needs npm ≥ 11.15.0, bundled from Node 24.18.0). The promote job can only be exercised
  by a real tag push.
- Verdaccio is not in the local npm cache (`npm view verdaccio@6 version --offline` → ENOTCACHED):
  **any Verdaccio option needs one download** (latest `verdaccio@6.10.5`, MIT, `engines.node
  >=22`, 30 direct dependencies, 1.27 MB unpacked for the package itself — registry metadata).
- WingFoil's staging script installs `verdaccio@6` at run time into its work folder, registers a
  throwaway user and token, proxies the dependencies to npmjs (uplink) and gives the package under
  test no uplink; it listens on the fixed port 4873.
- The lockfile's runtime tarballs are in the npm cache after `npm ci`: `npm pack
  <lockfile resolved URL> --offline` packed `yaml-2.9.1.tgz` in 0.2 s with no network (probe in the
  session scratchpad). This makes a fully offline local registry possible (D29-2 (b)).
- Engines in the lockfile (`package-lock.json`): the production closure accepts 22.12.0 (the
  `engines` floor); the dev toolchain does not — `jsdom` declares `^22.22.2 || ^24.15.0 || >=26`,
  `undici` (dev) `>=22.19.0`, `eslint` `^22.13.0`. The local Node is 22.21.0 (below jsdom's floor;
  no `engine-strict`, the suite runs — noted, not this task's).
- `package-lock.json` root entry has no `private` key: dropping `private` does not change the
  lockfile; adding a devDependency does.
- Prettier ignores `*.yml` (`.prettierignore`); ESLint covers `scripts/*.mjs`.

#### AC classification

| AC | kind | verified locally | verified only in CI / by the approver |
|----|------|------------------|---------------------------------------|
| AC-1 pipeline | config + static guard (red-first) | `test/package/publish-workflow.test.ts` (default suite) parses `.github/workflows/publish.yml` with `yaml`: trigger `v*` tags (+ D29-4), top-level `permissions: contents: read`, `id-token: write` only on promote, `environment: npm-publish` on promote, the five gates in order, the staging smoke on the gate's tarball, `npm stage publish` and never a live `npm publish`, no `secrets.`/`NPM_TOKEN`/`NODE_AUTH_TOKEN`/`.npmrc` write, every `uses:` pinned to a 40-hex SHA, `persist-credentials: false`, `set +x` first in the promote step. Red first: written before the YAML. The gate's tag checks: `scripts/check-release-tag.mjs` + `test/scripts/check-release-tag.test.ts` (red first). The gate and stage commands are the same npm scripts run locally. | the OIDC trusted publisher, the `npm-publish` approval, `npm stage publish`, provenance: only at the first real tag push (release-publishing `publish`). |
| AC-2 package | red-first | `pack.test.ts`: root `private` absent, every workspace `private: true`, `repository.url` = the GitHub repository; tarball list unchanged (existing allow-list assertions); `npm run test:smoke`. | — |
| AC-3 local smoke | red-first + recorded run | `npm run test:publish-smoke` (heavy gate, slot), run recorded here with durations; "never contacts the public registry" shown by running every npm and Verdaccio process with a dead proxy (`npm_config_proxy`/`https_proxy` and `HTTP(S)_PROXY` to a closed loopback port, `noproxy` loopback only): any request outside loopback fails the run. | the same smoke is the pipeline's `stage` job. |
| AC-4 checklist | documentation | review of `docs/publishing.md` against the workflow and the RP-54 steps | performed by the approver before `release-submit`. |
| AC-5 workflow text / docs | documentation | `release-publishing` `publish` re-read: still matches (no edit, proposals below); docs in the same change. | — |

#### File layout (planned, recommended options)

- `.github/workflows/publish.yml` (new): header runbook (short; points to `docs/publishing.md`),
  jobs `gate` (tag checks; `npm ci`; `typecheck`, `lint`, `format:check`, `test:coverage`,
  `test:smoke`; `npm pack` once → artifact), `stage` (downloads that tarball; `npm ci`; `npm run
  test:publish-smoke` with `WFUI_PUBLISH_TARBALL`), `promote` (`environment: npm-publish`,
  `id-token: write`, Node 24, `npm stage publish <the tarball> --provenance --access public`).
  Actions pinned to the SHAs WingFoil's public pipeline uses (same releases, comment with the tag).
- `scripts/check-release-tag.mjs` (new): the tag equals `v` + root and workspace versions, is
  annotated, and its commit is on `origin/main` (release-publishing `tag`); `--on-main`,
  `--annotated` modes as WingFoil's. Unit tests `test/scripts/check-release-tag.test.ts` on scratch
  repositories (TempWorkspace).
- `scripts/publish-guard.mjs` (new, D29-8): `prepublishOnly` refusing every `npm publish` run from
  a checkout. Test in `test/scripts/publish-guard.test.ts`.
- `test/smoke/support.ts` (new): the helpers of `launch.smoke.test.ts` moved there unchanged
  (`withoutNpmVars`, `timed`, `npxArgs`, `processes`, `group`, `serverProcess`, `expectGroupGone`,
  `start`); `launch.smoke.test.ts` imports them (behaviour unchanged).
- `test/smoke/registry.ts` (new): the local registry — Verdaccio from `node_modules` on a free
  loopback port, a config with no uplink, anonymous publish, storage in the test's own `wfui-`
  folder; seeding of the runtime closure (D29-2 (b)); stop (SIGTERM, then SIGKILL of its process
  group) in `afterAll` whatever happened.
- `test/smoke/staging.publish.test.ts` (new) with `vitest.publish-smoke.config.ts` (global setup =
  `test/smoke/global-setup.ts`, the run's temporary root) and the script `test:publish-smoke`: pack
  (or take `WFUI_PUBLISH_TARBALL`), start the registry, `npm publish <tgz> --registry <local>
  --provenance=false`, `npm view` answers the version and the tarball's integrity, `npm install
  wingfoil-ui@<version> --registry <local>` into an empty folder, `npx --no -- wingfoil-ui
  --version` (= the version), a `--no-open` start (URL line, `GET /api/server` 200 with the token),
  stop by SIGINT, no process left, registry stopped, no `wfui-*` left.
- `test/package/publish-workflow.test.ts` (new), `test/package/pack.test.ts` and
  `test/package/allow-list.ts` (`private`, `repository`).
- `docs/publishing.md` (new, D29-11): the pipeline, the approver's checklist (AC-4), the per-release
  runbook (`npm stage list/view/approve`, reject, deprecate instead of unpublish), the local smoke,
  what is verified only at the first tag.
- Shared files: listed in the report (version lines assigned by the coordinator).

#### Test plan

Default suite (no slot): `publish-workflow.test.ts`, `check-release-tag.test.ts`,
`publish-guard.test.ts`, `pack.test.ts`. Heavy gates (slot, one at a time): `test:coverage`,
`test:smoke` (packaging changed), `test:publish-smoke` (recorded: durations, tarball size, count of
`wfui-*` entries before/after, `pgrep -af verdaccio` empty after). No Playwright run: no UI change,
no BDD scenario (`e2e closure`: none). `check_tasks.py v0.2`. Negative checks: each static guard
broken once in a scratch copy of the YAML (a `secrets.` reference, an unpinned `uses:`, a live
`npm publish`) to see it fail; the dead proxy removed once to show the smoke would otherwise pass
through it (recorded in *red / green / refactor*).

#### Spec / DL gaps

- No tech-spec covers the pipeline (RP-7: one only if `identify-specs` found the need; it did
  not). Proposed: the workflow header + `docs/publishing.md` + these notes (D29-14).
- AC-3 "never contacts the public registry" holds literally only with D29-2 (b); (a) needs the AC
  reworded by the approver.
- The first publish of a new name through a stage-only trusted publisher is not documented by npm
  (D29-10); the checklist makes it the approver's first check.
- `release-publishing` `publish` (v1.2) still matches: "through this project's publish pipeline,
  with the approver's approval"; its "Until the pipeline exists, the step is skipped" sentence
  becomes historical. No `.wingfoil/` edit (AC-5); a wording proposal for the next alignment is in
  the report.

#### Open decisions (reported to the coordinator, awaiting the approver)

D29-1 … D29-14 in the report of 2026-10-17; nothing that depends on them is implemented before the
answer.

#### Decisions (approver, 2026-10-17)

"All as recommended": D29-1 (a) — the one-off download of `verdaccio@6.10.5` as an exact-pinned
devDependency approved — D29-2 (b), D29-3 (a), D29-4 (b), D29-5 (a), D29-6 (a), D29-7 (a),
D29-8 (a), D29-9 (a), D29-10 (a), D29-11 (a), D29-12 (a), D29-13 (a), D29-14 (a). Added by the
approver: `CLAUDE.md` checks line "`npm run test:publish-smoke` when packaging or
`.github/workflows/publish.yml` changes"; a section *Differences from WingFoil's pipeline* in
`docs/publishing.md`, referenced from the workflow header. Coordinator: this task merges before
task-040; `test/README.md` 0.40 is this task's.

### red / green / refactor (2026-10-17)

- **Red** — `7bda929`: `test/package/publish-workflow.test.ts` (the workflow file did not exist:
  the file failed to load), `test/scripts/check-release-tag.test.ts` (7 failing: no script),
  `test/scripts/publish-guard.test.ts` (3 failing: no `prepublishOnly`, no script; the dry-run
  publish timed out against the closed registry port), `pack.test.ts` (2 failing: `private` still
  set, no `repository`), and `test/smoke/staging.publish.test.ts` (fails to load: no
  `test/smoke/registry.ts`). The launch smoke's helpers moved unchanged to `test/smoke/support.ts`
  in the same commit (D29-3).
- **Green** — `619e7b5`: `.github/workflows/publish.yml`, `scripts/check-release-tag.mjs`,
  `scripts/publish-guard.mjs`, `test/smoke/registry.ts`, `vitest.publish-smoke.config.ts`;
  `package.json` (no `private`; `repository`, `homepage`, `bugs`; `prepublishOnly`;
  `test:publish-smoke`; `verdaccio` 6.10.5 exact). `package-lock.json`: 296 entries added, none
  removed or changed in version or `dev` flag (compared with a script against `HEAD~`'s lockfile).
  One fix during green: the workflow header said "no .npmrc is written", which the credential
  check (no `.npmrc` anywhere in the file) refused — reworded "no npm user config".
- **Negative checks** (guards removed or broken once, then restored):
  `publish-workflow.test.ts` failed for each of a `secrets.` reference in promote, an unpinned
  `actions/checkout@v7`, an added `npm publish` line, `id-token: read`, and another environment
  name (1 failed / 10 passed each). The staging smoke with `...deadProxyEnv()` removed from the
  npm environment: the AC-3 test failed (`npm view yaml --registry https://registry.npmjs.org/`
  succeeded, exit 0) — the dead proxy is what keeps npm off the public registry.
- **Docs** — `7f44f81`: `docs/publishing.md` 0.1 (pipeline, approver checklist, release runbook,
  local staging smoke, *Differences from WingFoil's pipeline*), README (install text no longer
  says `private`; documentation and script rows), `CHANGELOG.md` *Unreleased* (Added: the
  pipeline; Changed: the package is publishable), `CLAUDE.md` 0.5, `test/README.md` 0.40 (*Publish
  smoke*, layout lines).
- **Differences from WingFoil's pipeline** (approver's addition): compared against the public
  repository `wingfoil/wingfoil`, `main` at `07292cf` (2026-10-17; `publish.yml` last changed in
  `17bb863`): 14 rows in `docs/publishing.md` — triggers, release line, tag checks, gate content,
  staging registry, staging install and check, staging implementation, Node versions, dist-tag,
  after-stage jobs, `prepublishOnly`, `publishConfig`, first publish, action pins. The workflow
  header points to that section (`publish-workflow.test.ts` checks it). Candidates for WingFoil
  feedback are in the report (not written: a separate decision).
- Not done, by design: no `act` run (no Docker run here; `workflow_dispatch` is the dry run), no
  Playwright run (nothing the e2e suite runs changed: no `server/`, `web/`, `bin/` file).

### checks (2026-10-17, code at `7f44f81`)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run test:coverage` | 169 files passed, 1 skipped; **3068 passed / 1 skipped**; statements 96.53 %, branches 91.24 %, functions 97.2 %, lines 98.29 % | 7.29 → 12.80 |
| `npm run docs:api` | OK | — |
| `npm run test:smoke` | **4/4 passed**; pack 11.4 s, install 1.7 s, `--version` 0.8 s, start 0.8 s, clone 73 ms; tarball 145 files, 577 683 B packed, 1 625 509 B unpacked | 4.73 → 5.96 |
| `npm run test:publish-smoke` | **5/5 passed**; pack 12.3 s, registry start 1.6 s, seed 10.6 s (75 run-time dependencies), publish 0.7 s, install from the local registry with a fresh cache 19.1 s, `--version` 1.2 s, start 1.3 s | 9.51 → 8.86 |
| `test:e2e:chromium` | not run: no file the e2e suite runs changed | — |
| `check_tasks.py v0.2` | OK (17 tasks · 46 backlog items) | — |
| `npm run test:timing` | not run: no timing-relevant change | — |

Every heavy gate ran through the machine-free slot. `wfui-*` entries in the system temporary
directory: 0 before; after, only the `wfui-e2e-run-*` / `wfui-run-*` roots of task-040's Playwright
run going on in its own worktree (owner pid of that run) — none of this task's. No Verdaccio
process left (`ps -eo pid,args | grep verdaccio`: nothing).
