---
id: bug-019-elements-whose-id-is-longer-than-100-characters-cannot-be-opened-or-decided-the-server-answers-404
type: bug
title: "Elements whose id is longer than 100 characters cannot be opened or decided: the server answers 404"
status: open
severity: "medium"           # REQUIRED — critical | high | medium | low
release-origin: "v0.2"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "any (server side)"            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

An element whose id is longer than 100 characters is listed by the console but cannot be opened
or decided: every route with the id as a path parameter (`GET /api/p/:pid/elements/:eid`, its
`/history`, and the `submit`, `approve`, `reject` writes) answers 404 `not-found`. WingFoil builds the
id from the title, with no length limit.

## Steps to Reproduce

1. A project governed by `wingfoil@0.2.2` with an element whose title gives an id over 100
   characters (in this repository: bug-015, 104 characters; bug-017, 139; bug-018, 136).
2. Open the console on it, open the Memory list (or Today) and press the element.
3. Or call `GET /api/p/<pid>/elements/<id>` with a session.

## Expected Behavior

The element panel opens and its gate can be decided, as for any listed element; an id the CLI
lists is always reachable through the API.

## Actual Behavior

The panel shows *not found*; the API answers 404 `{"error":{"code":"not-found"}}` for the detail,
the history and the writes. Ids of 100 characters or fewer work (bug-014, 96; bug-016, 93).

## Evidence

- Found on 2026-10-19 while the approver closed this repository's bugs from the console
  (`e2e-smoke-rel-v0.2-plan` step 4, ES2-1): bug-015 opened as *not found*.
- Against the running console: the elements list includes bug-015 and bug-017; their detail
  answers 404, bug-016's answers 200. The file of bug-015 parses with the server's own reader.
- Fastify's default `maxParamLength` is 100 (`node_modules/fastify/lib/config-validator.js`);
  `server/src` does not set it, so a longer parameter matches no route and the default 404 answers.

## Notes

- Same limit for every route with a path parameter (`:did` of directives too).
- Suspected fix: set `maxParamLength` (top level or `routerOptions`) to at least the longest file
  name an id can have (255 bytes), with tests on a 250-character id for reads, history and writes,
  and an e2e that opens and decides such an element. Fixtures today use short ids only.
- Approver (2026-10-19): fix in release v0.3; a known limitation of v0.2 (user guide, CHANGELOG);
  bug-015, bug-017 and bug-018 of this repository are closed with the CLI.
- The id of this bug is itself 103 characters long.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->
