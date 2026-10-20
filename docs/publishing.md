# Publishing to npm

**Version:** 0.3 · **Date:** 2026-10-20 (0.1: the publish pipeline, the approver's checklist, the
local staging smoke, the differences from WingFoil's pipeline — task-029; 0.2: review round 1 — a
dispatch never promotes, the guard's limit, the dev-only audit findings, what is not verified yet;
0.3: release v0.2.0 — the first version by hand, `stage` verified on Node 22.12.0, the GitHub
Release of v0.2.0 by hand)

How `wingfoil-ui` reaches the npm registry: the pipeline `.github/workflows/publish.yml`, the
registry-side setup the **approver** performs once, the steps of every release, and the staging
smoke that runs the same check locally. Planned by `release-planning-rel-v0.2-plan` RP-3 (d),
RP-46, RP-54 and `governance-alignment-rel-v0.2-plan` GA-4; v0.1 was released as a git tag only
(dl-004). Release v0.2 is the first version on npm, `wingfoil-ui@0.2.0`: npmjs.com offers no
trusted publisher for a name with no version, so the approver published it by hand from the tag
run's smoked tarball (checklist step 4; no provenance statement for that version). Later versions
go through the pipeline below.

Agents never configure the registry, never hold an npm credential and never approve: every step
marked *approver* is a human act (CLAUDE.md, *Working with the WingFoil CLI*).

## The pipeline

`.github/workflows/publish.yml`, run by a pushed tag `vX.Y.Z` (release-publishing `tag`):

| Job | What it does | Gate it adds |
|-----|--------------|--------------|
| `gate` | `scripts/check-release-tag.mjs <tag> <sha>`: the tag is annotated, equals `v` + the version of the root and of every workspace `package.json` and of `package-lock.json` (its `version`, `packages[""]` and each workspace entry), points at the commit built (`<sha>` peeled to its commit), and that commit is on `origin/main`. Then `npm ci`, `typecheck`, `lint`, `format:check`, `test:coverage`, `test:smoke`, and `npm pack` **once** (its `prepack` builds from a clean tree); the tarball is the run's artifact. | the repository gates |
| `stage` | `npm run test:publish-smoke` on **that** tarball, on Node 22.12.0 (the `engines` floor): see [Local staging smoke](#local-staging-smoke). | the package installs from a registry and starts |
| `promote` | Only for a tag, in the GitHub environment `npm-publish`: waits until the approver approves the deployment, then `npm stage publish ./dist-pack/*.tgz --provenance --access public` through the npm trusted publisher (GitHub OIDC, `id-token: write`, permission limited to staging). | (1) the `npm-publish` approval; (2) the npm stage queue |

The staged version is **not live**: it goes live only when the approver runs `npm stage approve`
with 2FA. The workflow holds no credential — no secret, no token variable, no npm user config, no
`registry-url`. A plain `npm publish` from a checkout stops at the root `prepublishOnly`
(`scripts/publish-guard.mjs`): a guard against mistakes, which `npm publish --ignore-scripts`
skips — the control is on the registry: the trusted publisher limited to staging and "disallow
tokens" (checklist steps 5 and 6). `test/package/publish-workflow.test.ts` (default suite) freezes these
invariants: triggers, permissions, the job chain and environment, the gates in order, the staging
smoke on the gate tarball, `npm stage publish` with `set +x` first, no live publish, no
credential, every action pinned to a commit SHA.

**Dry run before tagging.** *Actions → publish → Run workflow* (`workflow_dispatch`) runs `gate`
and `stage` only, on whatever ref it is started on — `main`, another branch or a tag: the gates on
a GitHub runner and the smoked tarball as an artifact. A dispatch **never promotes**: `promote`
requires `github.event_name == 'push'` (a manual run on a tag ref has `ref_type == 'tag'` too),
and the environment admits `v*` tags only. On a branch the tag checks are skipped.

**Only a real tag push proves** the OIDC trusted publisher, the `npm-publish` approval,
`npm stage publish` and the provenance statement: the local npm (11.6.2 on 2026-10-17) has no
`stage` command, and none of these exist outside GitHub Actions and npmjs.com.

**Verified on a runner:** `gate` (Node 22.22.2) and `stage` (Node 22.12.0), by the third
`workflow_dispatch` dry run on `main` (run `39451186680`, 2026-10-20: `test:coverage`, `test:smoke`
4/4, `test:publish-smoke` 11/11; the first two dry runs found bug-020, bug-021, bug-022). **Not
verified yet:** the trusted publisher, `npm stage publish`, the `npm-publish` approval of a real
promote and the provenance statement — `0.2.0` was published by hand, so the first release after
it is their first run.

## Approver checklist (registry-side setup, once)

Done by the approver **before `release-submit`** of the first release published to npm (when step 4
applies, steps 5–6 come right after that first version). If a step is missing then, the release
ships as a git tag only and a decision-log records it, as dl-004 did for v0.1 (RP-46).

1. **Package name.** `npm view wingfoil-ui` answers `E404` (the name is free; `curl -s -o /dev/null
   -w '%{http_code}' https://registry.npmjs.org/wingfoil-ui` printed `404` on 2026-10-17). If it
   answers a package, stop: the name is taken.
2. **2FA on the approver's npm account** (npmjs.com → account → Two-Factor Authentication). Staged
   publishing requires it: approving a staged version prompts for it.
3. **GitHub environment `npm-publish`** (repository Settings → Environments → New environment):
   *Required reviewers* = the approver; *Deployment branches and tags* = *Selected branches and
   tags* with one rule, ref type **Tag**, pattern `v*`. Without it GitHub creates the environment
   unprotected on the first run and `promote` would not wait.
4. **First publish of a new name (check this first on npmjs.com).** npm's documentation does not say
   whether a trusted publisher can be configured for a name that has no version yet (unverified on
   2026-10-17; answered on 2026-10-19 — see the end of this step). If npmjs.com offers *Trusted
   publishing* for `wingfoil-ui` before a first version, go to step 5. If it does not, the approver
   publishes the **first** version by hand, with 2FA, from the tarball the pipeline built and smoked
   — download the `wingfoil-ui-tarball` artifact of the tag run (or of a dry run on the tagged
   commit), check its name and version, then `npm publish wingfoil-ui-<version>.tgz --access
   public`. That one version has no provenance; no token is created at any time. Then do step 5 for
   every later release. For `wingfoil-ui` (2026-10-19) npmjs.com offered no trusted publishing
   before a first version: `0.2.0` follows this path, with the tag run's `promote` deployment
   rejected.
5. **Trusted publisher** (npmjs.com → package `wingfoil-ui` → Settings → Trusted publishing →
   GitHub Actions): organization `wingfoil`, repository `wingfoil-ui`, workflow `publish.yml`,
   environment `npm-publish`, permission **limited to staging (stage only)**. It is keyed on the
   repository and the file name: a rename or transfer of either must be mirrored there.
   `package.json` `repository.url` matches this repository, as npm requires
   (`test/package/pack.test.ts`).
6. **Publishing access** (package Settings → Publishing access): *Require two-factor
   authentication and disallow tokens*, so no token of any kind can publish `wingfoil-ui`.

## Every release

1. `release-submit` makes the release commit (versions `X.Y.Z` in every `package.json` and the
   lockfile, CHANGELOG section) on `main`; optionally run the dry run above on it.
2. `release-publishing` `tag`: the annotated tag `vX.Y.Z` on `main`; pushing it needs the
   approver's OK. `gate` and `stage` run unattended.
3. **Approver:** review the `promote` deployment of the run (*Review deployments* → `npm-publish`
   → Approve). Rejecting it ends the run with nothing staged. `promote` prints the stage id.
4. **Approver:** inspect, then approve on npm (npm ≥ 11.15.0; without a global upgrade run each
   through `npx -y npm@11.19.0 …`):

   ```bash
   npm stage list wingfoil-ui          # the stage id; no other version should be pending
   npm stage view <stage-id>           # what is staged and its tag (`latest`)
   npm stage approve <stage-id>        # 2FA prompt — the version goes live
   npm view wingfoil-ui dist-tags      # after: `latest` names this version
   ```

   On npmjs.com the stage queue is under the account menu → *Staged Packages*; a freshly staged
   version may first show an automated review, during which *Approve* is not available (WingFoil's
   runbook, v0.2.2). A bad staged version is discarded with `npm stage reject <stage-id>`: it never
   goes live.
5. `release-publishing` `publish` post-check: `npm view wingfoil-ui@X.Y.Z version` answers the
   version; then `mark-released`.

**At release validation** (before `release-submit`), re-check the dependency audit: `npm audit
--omit=dev` must report 0 vulnerabilities (what the published package installs), and `npm audit`
is compared with the accepted dev-only findings of the local registry (see
[Local staging smoke](#local-staging-smoke)); a new finding outside that list is a decision for the
approver.

**A failed gate or stage** stages nothing (`promote` needs `stage`). Fix on `main`; the approver
decides whether the same version is tagged again on the fixed commit (nothing was published) or a
patch version follows. **A bad version that went live** is never unpublished (npm's policy, and
others may depend on it): the approver runs `npm deprecate wingfoil-ui@X.Y.Z "broken: <reason> —
upgrade to X.Y.Z+1"` and the fix ships as a patch release through the same tag flow.

**GitHub Release.** The pipeline creates none (see the table below). For `v0.2.0` the approver asked
for one: once `npm view wingfoil-ui@0.2.0 version` answers, it is created by hand on the approver's
OK — `gh release create v0.2.0 --verify-tag --title v0.2.0`, the CHANGELOG section `[0.2.0]` as its
notes, the published tarball and the coverage reports of the release commit's local run as assets.
An automatic `release` job like WingFoil's (after `promote`, once the version is live; the gate's
test reports as assets) is planned for v0.3.

## Local staging smoke

`npm run test:publish-smoke` (`vitest.publish-smoke.config.ts`, `test/smoke/staging.publish.test.ts`,
`test/smoke/registry.ts`) — the `stage` job, run locally (AC-3). It is a heavy gate: run it when
packaging or `.github/workflows/publish.yml` changes (CLAUDE.md, *Checks*).

1. The tarball: `WFUI_PUBLISH_TARBALL` when set (the pipeline passes the gate's), otherwise
   `npm pack` (its `prepack` builds).
2. A local Verdaccio — the exact-pinned devDependency `verdaccio@6.10.5` — on a free loopback port,
   its config, storage and user file in the test's own `wfui-publish-smoke-*` folder under the
   run's temporary root, with **no uplink**. It is seeded with the run-time dependency closure of
   `package-lock.json` (from the root's `dependencies`), packed offline from the npm cache
   (`npm pack <resolved URL> --offline`), each tarball checked against the lockfile's integrity.
   A throwaway user is registered for the run; its token lives only in a user config of that
   folder.
3. `npm publish <tarball>` to it; `npm view wingfoil-ui@<version> dist.integrity` equals the
   tarball's.
4. `npm install wingfoil-ui@<version>` into an empty folder with a fresh npm cache: every installed
   package's `resolved` URL is the local registry's.
5. `npx --no -- wingfoil-ui --version` prints the version; a `--no-open` start answers `GET /` and
   `GET /api/server` with the token; SIGINT stops it with exit status 0 and no process left; the
   registry stops and its port no longer answers.

It never contacts the public registry: every npm process runs with a dead proxy for anything
outside the loopback (`npm_config_proxy`, `npm_config_https_proxy` and the usual proxy variables
pointing at a closed loopback port, `noproxy` = the loopback), and the test shows both that a
request to `https://registry.npmjs.org/` fails in that environment and that a package nobody seeded
is unknown to the local registry. It needs a warm npm cache holding the lockfile's tarballs — what
`npm ci` leaves.

**Audit findings of the registry (dev-only).** `verdaccio@6.10.5` brings 9 `npm audit` findings
(3 critical, 6 high on 2026-10-17): `handlebars` (through `@verdaccio/hooks`), `braces`,
`micromatch`, `fast-glob`, `globby` (through `@verdaccio/local-storage-legacy`) and `compression`.
`npm audit --omit=dev` reports 0: none reaches the published package. The exposure is a
devDependency running only during the smoke, bound to the loopback, with no uplink, for about a
minute, serving packages the smoke itself put there. Status: **accepted risk (the approver,
2026-10-17)** (task-029 review round 1, R2); re-checked at release validation.

The run leaves no `wfui-*` entry and no Verdaccio process ([`test/README.md`](../test/README.md),
*Publish smoke*, *Temporary folders*).

## Differences from WingFoil's pipeline

Compared against the public repository `wingfoil/wingfoil`, branch `main` at commit `07292cf`
(2026-10-17; `.github/workflows/publish.yml` last changed in `17bb863`, 2026-10-16), its
`.github/workflows/publish.yml` (header runbook and jobs) and `scripts/publish-staging.cjs`. The two
gates of RP-54 — the `npm-publish` environment and `npm stage publish` through a stage-only trusted
publisher, made live by the approver's `npm stage approve` with 2FA — are the same.

| Topic | WingFoil | WingFoil UI | Why |
|-------|----------|-------------|-----|
| Triggers | `vX.Y.Z` tag push only; local runs with `act` (`if: !env.ACT` guards) | tag push, plus `workflow_dispatch` running `gate` and `stage` only, on any ref (promote needs a `push` event); no `act` guards | this repository has no other CI: without a manual run the tag would be the suite's first run on a GitHub runner (D29-4); `promote` needs a tag, so a local `act` run cannot stage either |
| Release line | the tag's commit on `main` or on `release/X.Y` of its own X.Y | on `origin/main` only | release-publishing tags on `main`; no maintenance branches yet |
| Tag checks | `check-release-tag.cjs` in three steps, also `server.json` versions | `check-release-tag.mjs`, one step: annotated, `v` + root, workspace and lockfile versions (a glob workspace entry is refused), the commit built (peeled), on `origin/main` | no `server.json`; the workspaces carry the version (release-submit `release-commit`) (D29-13) |
| Gate content | `build`, `test:report` (Jest with coverage and JSON), `lint`, a test-results summary, `npm publish --dry-run`, `npm pack --ignore-scripts`; test reports uploaded | `typecheck`, `lint`, `format:check`, `test:coverage`, `test:smoke`, `npm pack` with `prepack` (clean build); no test reports | the gates named by task-029 AC-1; the reports exist in WingFoil to be attached to a GitHub Release, which this pipeline does not create yet |
| Stage job install | no `npm ci`: the staging script installs Verdaccio itself into its work folder | a full `npm ci` (dev dependencies included) before the smoke | the smoke is a Vitest file, the pinned Verdaccio comes from the lockfile, and the npm cache it fills is what the registry is seeded from offline |
| Staging registry | `verdaccio@6` installed at run time into the work folder, fixed port 4873, an uplink to npmjs for the dependencies (none for the package under test) | `verdaccio@6.10.5` as an exact-pinned devDependency, a free loopback port, **no uplink**: seeded offline with the lockfile's run-time closure; npm behind a dead proxy | AC-3: the smoke never contacts the public registry; the lockfile pins Verdaccio and its dependencies by integrity; worktrees run concurrently (D29-1, D29-2) |
| Staging install and check | `npm install -g`, then `wingfoil --version` must be `<version> (<commit>)` — `--expect-commit "$GITHUB_SHA"` ties the installed tarball to the tagged commit — plus an init smoke | `npm install wingfoil-ui@<version>` into an empty folder, `npx wingfoil-ui --version` = the version, a `--no-open` start with an authenticated API read, SIGINT stop; the published tarball's integrity equals the gate's | the README's install path is a local install and `npx`; the launcher prints no commit, so nothing ties the tarball to `$GITHUB_SHA` beyond the gate's tag checks and the artifact hand-over |
| Staging implementation | a standalone script (`npm run publish:staging`) with its own signal handling and teardown | a Vitest file reusing the launch smoke's helpers (`test/smoke/support.ts`), teardown in `afterAll`, folders under the run's temporary root | task-029 Implementation Notes: reuse `test/smoke/`; the temp-folder convention of task-026 (D29-3) |
| Node versions | `gate` and `stage` 22.12.0, `promote` 24.21.0 | `gate` 22.22.2, `stage` 22.12.0, `promote` 24.21.0 | the dev toolchain declares more than the runtime floor (`jsdom` `^22.22.2`); the installed package still starts on the `engines` floor in `stage` (D29-5) |
| dist-tag | explicit `--tag`: `latest`, or `latest-X.Y` for a patch of an older line (`npm-dist-tag.cjs`) | no `--tag`: npm applies `latest` and refuses a version lower than the current `latest` | one release line; WingFoil's header notes that an explicit tag switches npm's guard off (D29-6) |
| After the stage | `release` job (GitHub Release with the CHANGELOG section and the test reports, once the version is live) and `mcp-registry` job | none; the GitHub Release of `v0.2.0` made by hand ([Every release](#every-release)) | dl-004: no GitHub Release unless the approver asks — the approver asked for v0.2.0, the job is planned for v0.3; WingFoil UI is not an MCP server (D29-7) |
| `prepublishOnly` | build, test with coverage, lint (the gate of a publish from a checkout) | stops a plain `npm publish` from a checkout (`scripts/publish-guard.mjs`; `--ignore-scripts` skips it) | the pipeline is the only way to publish, enforced on the registry (checklist steps 5, 6); the staged tarball runs no lifecycle script (D29-8) |
| `publishConfig` | `registry`, `access: public`, `provenance: true` in `package.json` | none: `--provenance --access public` on the `npm stage publish` line | keeps the local registry's publish free of provenance without an override flag in `package.json` |
| First publish | the runbook records a stage-only token, revoked once the trusted publisher existed | no token at any time: if npm requires an existing package for a trusted publisher, the approver publishes the first version by hand from the pipeline's smoked tarball | task-029 AC-1: no token in the repository or the workflow (D29-10) |
| Action pins | the same SHA-pinned releases; a test freezes the SHA ↔ tag table | the same SHAs; a test checks every `uses:` is a 40-hex SHA with a release-tag comment | the table is checked by hand (`git ls-remote`) when a pin changes |

WingFoil is the reference, not a dependency: a change there is mirrored here by a later task, and a
difference that looks like something WingFoil should change is reported as feedback
(`docs/wingfoil-feedback/`), not edited here.
