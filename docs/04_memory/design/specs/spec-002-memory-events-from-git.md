---
id: spec-002-memory-events-from-git
type: tech-spec
title: "Memory events from git"
status: draft
scope: "Memory events: parsing wf(…) commits for Timeline, Recent activity and Updates"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2"   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Several views show what happened to Memory elements: the element panel's history (G1, v0.1), the
bell's *Updates* (S7, v0.2, last 10 events), Recent activity (T5, v0.3, last 5 events) and the
Timeline time axis (R6, v0.3, events per day) — REQ-INT-06, REQ-PERF-11.

WingFoil records every governed change as one `wf(<type>): <operation> <id>` commit. Only
`approve`, `reject` and `deprecate` subjects carry the transition `[from → to]`; `add` and `submit`
subjects do not (W-15). The SARD left the source of a submit's transition open: `git log -p` on the
element file, or `memory history <id>` (REQ-INT-06).

Checked on WingFoil 0.2.2 (2026-10-02, this repository and a Kanban fixture):
- `memory history <id>` returns every operation with `from`/`to` (submit included), `approver`
  and `reason` — but for **one element per process**;
- the commit body of `approve` / `reject` carries `Approver: <Name> <email> (role)` and
  `Reason: <text>`, of `deprecate` only `Reason:`;
- the diff of every `wf(…)` commit changes the element file's `status:` line
  (`-status: <from>` / `+status: <to>`; `add` has only `+status: <initial>`).

## Specification

### 1. Event

`{sha, timestamp, author, operation, type, id, from, to, approver, reason}` — `timestamp` = author
date (ISO 8601), `author` = `Name <email>`, `operation` ∈ `add`, `submit`, `approve`, `reject`,
`deprecate`; `from` is `null` for `add`; `approver` and `reason` are `null` when absent.

### 2. Sources

| View | Source | Processes |
|------|--------|-----------|
| Element panel history (G1) | `memory history <id>` (spec-001 §3) — the CLI's own reconstruction; non-`wf` commits touching the file (`operation: null`) are shown as "edited outside a WingFoil verb" | 1 per opened element and repository state |
| Updates (S7), Recent activity (T5), Timeline (R6) | **one `git log`** over the Memory directories, parsed as §3 | 1 per repository state |

Calling `memory history` for every element would cost one process per element (hundreds on the
large fixture), against REQ-PERF-05; the single `git log` is used for the project-wide views.

### 3. Project-wide parsing

Memory directories = for each type of `memory.yaml` (spec-001 §4.1), the static prefix of its
`path` up to the first `{` (e.g. `docs/04_memory/planning/`), de-duplicated.

```
git log --no-color --no-renames --no-ext-diff --unified=0 -p \
  --format=%x1e%H%x1f%aI%x1f%an <%ae>%x1f%s%x1f%b%x1d \
  [<old>..HEAD] -- <memory directories…>
```

For each record (`%x1e`-separated; header fields `%x1f`-separated, body ended by `%x1d`, then the patch):
1. **Subject** must match
   `^wf\((?<type>[^)]+)\): (?<op>add|submit|approve|reject|deprecate) (?<id>\S+)(?: \[(?<from>[^\]]+) → (?<to>[^\]]+)\])?$`;
   any other commit (including `wf(plan): finalize …` and non-`wf` commits) is **not** an event.
2. **Transition:** from the subject when present; otherwise from the patch of the element's file
   (the file whose name is `<id>.md`): `-status: <from>` and `+status: <to>` (`add`: `+status:` only).
   Values are taken without quotes and trailing comments.
3. **Approver / reason:** the body trailers `Approver:` and `Reason:` (first occurrence each).
4. A record matching the subject but with no `+status:` line in its patch is reported as an event
   with `from`/`to` = `null` and logged as a parse warning (never dropped silently).

### 4. Caching and incremental reads

- Cache key: HEAD only (events are commits; the working tree is irrelevant).
- After a fast-forward from a cached HEAD `old`, only `old..HEAD` is parsed and prepended; when
  `old` is not an ancestor of HEAD (rewritten history), the whole log is re-parsed.
- Views read from the parsed list: Updates = last 10, Recent activity = last 5 (REQ-PERF-11),
  Timeline = grouped by local day of `timestamp`, paginated.

### 5. Verification

- **Consistency contract test:** on every fixture and every version of the support matrix, the
  events of §3 for each element equal the `wf` entries of its `memory history` (same sha,
  operation, from, to, approver, reason).
- Unit tests with recorded `git log` outputs: each operation, a subject with and without
  transition, a non-`wf` commit, `wf(plan): finalize` (ignored), a quoted `status:` value, a
  rewritten history.
- Performance: on the large fixture (500 elements, 2 000 commits) the first parse runs in one git
  process; an incremental parse after one commit reads one commit.

## Consequences

- One git process serves three views; the element panel keeps WingFoil's own history.
- The project-wide parser depends on WingFoil's commit format (subject, trailers, `status:` line):
  the consistency test catches a format change against `memory history`.
- If WingFoil adds the transition to `add`/`submit` subjects, step 3.2 falls back on the subject
  with no change.

## Process Notes

- 2026-10-02 — drafted in initial-design session 5a; resolves the open source of REQ-INT-06
  (SARD v0.4 points to this spec). Submitted after the independent spec review (plan step 6).
- 2026-10-02 — evidence: a throwaway prototype of §3 (not committed) reproduced `memory history`
  exactly — this repository 17 elements / 30 events, the Kanban fixture 3 elements / 10 events
  (every operation, a reject with a reason and a deprecate), 0 mismatches.
