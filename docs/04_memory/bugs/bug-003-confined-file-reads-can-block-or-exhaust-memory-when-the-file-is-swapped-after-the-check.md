---
id: bug-003-confined-file-reads-can-block-or-exhaust-memory-when-the-file-is-swapped-after-the-check
type: bug
title: "Confined file reads can block or exhaust memory when the file is swapped after the check"
status: in-review
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"       # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

`server/src/reads/confine.ts` checks a confined file (kind, size, real path) and then reads it by
path with no size bound, so a local writer that swaps the file between the check and the read can
make the request hang or exhaust memory.

## Steps to Reproduce

1. A listed project (any fixture, WingFoil 0.2.2) with a document or element file served by a
   direct read (task-005 reads, task-012 `/files/content`).
2. Between the server's `lstat`/size check and its `readFile`, replace the file with a FIFO, or
   with a symlink to `/dev/zero` (a local process racing the request).
3. Request the file.

## Expected Behavior

The read is bounded and refers to the object that was checked: a swapped file is refused
(`not-allowed`/`outside`) or read up to the size limit; the request never blocks.

## Actual Behavior

`readFile` follows the path again: a FIFO blocks the request, `/dev/zero` grows the buffer until
memory runs out. The second confinement check refuses the result afterwards, so no byte reaches
the client — the defect is availability, not disclosure.

## Evidence

- task-012 review (2026-10-06, finding 9): `server/src/reads/confine.ts:85-96` — check, then
  unbounded `readFile` on the path.

## Notes

- Fix: open with `O_NOFOLLOW` (and `O_NONBLOCK` for FIFOs), `fstat` the descriptor, refuse anything
  that is not a regular file, read at most MAX + 1 bytes from the descriptor.
- Found in the Wave 2 dev-loop review of task-012 (plan `dev-loop-rel-v0.1-plan`, Session 2);
  the code belongs to task-005 (done), hence this bug (user rule). To be absorbed into task-012,
  decided by the user 2026-10-06.

## Triage & Execution Notes

- triage (2026-10-06): approved by the user as **low** severity.
- fix: **absorbed into task-012-project-read-api** (dl-045); `triaged → planned` by hand.
- start (2026-10-06): task-012 already in progress → `planned → in-progress` by hand.
- submit (2026-10-06): task-012 submitted after its integration (reviews PASS; `test:coverage` 1236 passed, `test:timing` 3/3) → `in-progress → in-review` (dev-loop `bug.sync_state`).
