---
id: F-027
title: "The publish pipeline's staging smoke installs an unpinned Verdaccio at run time, proxies npmjs and uses a fixed port"
kind: request
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Not a CLI behaviour: publish pipeline.

## Observed

Read in WingFoil's repository at `main` `7efff2a0` (2026-11-02): `.github/workflows/publish.yml` (last
changed in `17bb863`) runs, in its `stage` job, `npm run publish:staging`, which is
`scripts/publish-staging.cjs`. Found while this repository built its own publish pipeline on the
same model (task-029; the comparison is in `docs/publishing.md`, *Differences from WingFoil's
pipeline*).

1. The staging registry is installed at run time from a version range with no lockfile:
   `const VERDACCIO_PACKAGE = 'verdaccio@6';` (`scripts/publish-staging.cjs`). The registry that the
   release tarball is published to before it may go live is resolved afresh on every run, and its
   transitive dependencies are neither pinned nor checked against a recorded integrity — a
   supply-chain gap in the job that decides whether a version is promoted.
2. The generated Verdaccio configuration gives the package under test no uplink, but proxies every
   other package to npmjs (`uplinks: npmjs: url: https://registry.npmjs.org/`, `proxy: npmjs`): the
   smoke install resolves the dependency tree from the public registry at run time, so it can differ
   from the lockfile the `gate` job tested, and the job needs network access to npmjs (the script's
   own header says so).
3. The registry listens on the fixed address `localhost:4873` (`STAGING_REGISTRY`, `listen:`): two
   staging runs on one machine — a local run next to another one — refuse each other.

## Expected

1. Verdaccio pinned exactly — a devDependency locked by the lockfile, or an exact version installed
   with its integrity checked — so the staging registry is reproducible.
2. The staging registry seeded from the lockfile's `resolved` tarballs (e.g. from the npm cache, with
   `npm pack <resolved> --offline`) and run with no uplink, and the smoke install made through a proxy
   that cannot reach npmjs, so the smoke proves that the package installs from exactly the tree the
   gate tested. This repository does so in `test/smoke/registry.ts` (`npm run test:publish-smoke`).
3. A free loopback port (listen on port 0, then read the bound address) instead of 4873.

Suggested kind in WingFoil: request (release pipeline hardening).
