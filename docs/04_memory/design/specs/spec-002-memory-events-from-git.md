---
id: spec-002-memory-events-from-git
type: tech-spec
title: "Memory events from git"
status: approved
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
| Updates (S7), Recent activity (T5), Timeline (R6); the action descriptor (spec-003: creator, submitter, last reject, `since`) behind Today (v0.2) and every element list | **one `git log -p`** over the Memory directories, parsed as §3, plus its header-only sha list | 2 git processes per HEAD |

Calling `memory history` for every element would cost one process per element (hundreds on the
large fixture), against REQ-PERF-05; the two `git log` reads are used for the project-wide views.
They are git processes, not CLI processes: a cold Memory list (5 CLI + 5 git reads) stays within
REQ-PERF-05's ≤ 6 CLI processes.

### 3. Project-wide parsing

Memory directories = for each type of `memory.yaml` (spec-001 §4.1), the static prefix of its
`path` up to the first `{` (e.g. `docs/04_memory/planning/`), de-duplicated.

```
git -c log.showSignature=false log --no-color --no-renames --no-ext-diff --no-textconv \
  --unified=0 -p --format=%H%x00%aI%x00%an <%ae>%x00%s%x00%b%x00 \
  <HEAD sha> -- <memory directories…>
git -c log.showSignature=false log --no-renames --format=%H%x00 \
  <HEAD sha> -- <memory directories…>
```

**Framing (NUL, as WingFoil bug-050 / task-086).** Every header field — sha, author date, author,
subject, body — is followed by a NUL, which git refuses in a commit message, so no subject, body
or `--reason` can split or forge a record; the patch follows. Records are split by arity (five
NUL-terminated fields, then the patch up to the next record). The sha must match
`^[0-9a-f]{40}$` (`^[0-9a-f]{64}$` in a SHA-256 repository) and the date must be a valid ISO
8601 author date. A patch can still hold a NUL (a text file with one past git's binary check):
the second, **header-only read** of the same walk (same pathspec and flags, no patch) gives the
**authoritative sha order**, at which the records are resynchronised. Both reads name the view's
HEAD sha as an explicit revision (never the symbolic `HEAD`, which may move between them). A
malformed `wf` record (damaged framing, unreadable date or author) is skipped with a warning and
the others are read; an output that does not match the sha list is refused as a whole, never
guessed at.

For each record:
1. **Subject** must match
   `^wf\((?<type>[^)]+)\): (?<op>add|submit|approve|reject|deprecate) (?<id>\S+)(?: \[(?<from>[^\]]+) → (?<to>[^\]]+)\])?$`;
   any other commit (including `wf(plan): finalize …` and non-`wf` commits) is **not** an event.
2. **Transition:** from the subject when present; otherwise from the patch of the element's file
   (the file whose name is `<id>.md`): `-status: <from>` and `+status: <to>` (`add`: `+status:` only).
   Values are taken without quotes and trailing comments. As in `memory history`, a commit is an
   event of `<id>` **only when its patch touches `<id>.md`**.
3. **Approver / reason:** as WingFoil 0.2.2 reads them (`memory/commit-message.js`): `Approver:` =
   the first non-empty body line when it starts with `Approver: `; the reason = from the first line
   starting with `Reason:` to the end of the body, or to the start of a trailing trailer paragraph
   (e.g. `Co-Authored-By:`), **multi-line**, normalised as `normalizeReason` does (CRLF → LF,
   trailing blanks removed per line, ≥ 3 newlines → 2, leading/trailing newlines and leading blanks
   removed).
4. A record matching the subject but with no `+status:` line in its patch is reported as an event
   with `from`/`to` = `null` and logged as a parse warning (never dropped silently).

### 4. Caching and incremental reads

- Cache key: HEAD only (events are commits; the working tree is irrelevant).
- After a fast-forward from a cached HEAD `old`, only `old..<HEAD sha>` is parsed (both reads)
  and prepended; when `old` is not an ancestor of HEAD — `git rev-list --count HEAD..old` is not 0
  (an allowed read, REQ-INT-06) — the whole log is re-parsed.
- Views read from the parsed list: Updates = last 10, Recent activity = last 5 (REQ-PERF-11),
  Timeline = grouped by local day of `timestamp`, paginated.

### 5. Verification

- **Consistency contract test:** on every fixture and every version of the support matrix, the
  events of §3 for each element equal the `wf` entries of its `memory history` (same sha,
  operation, from, to, approver, reason).
- Unit tests with recorded `git log` outputs: each operation, a subject with and without
  transition, a multi-line reason, a reason followed by a `Co-Authored-By:` trailer, a non-`wf` commit, `wf(plan): finalize` (ignored), a quoted `status:` value, a
  rewritten history.
- Unit tests for the framing: a NUL inside a patch (resync on the sha list), a malformed `wf`
  record (skipped with a warning), a sha or date that fails its check, an output that does not
  match the sha list (refused).
- Performance: on the large fixture (500 elements, 2 000 commits) the first parse runs in two git
  processes (the patch read and the sha list); an incremental parse after one commit reads one
  commit.

## Consequences

- Two git processes per HEAD serve three views and the descriptor; the element panel keeps
  WingFoil's own history.
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
- 2026-10-02 — spec review (step 6): F2 multi-line reasons parsed as the CLI does (the
  reviewer reproduced a two-line reason in `memory history`); F13 ancestry check named, spec-003
  listed as a consumer.
- 2026-10-06 — amended in dev-loop task-012 (Wave 2, plan dev-loop-rel-v0.1-plan): §3 the
  `%x1e`/`%x1f`/`%x1d` format replaced by NUL framing (`%H%x00%aI%x00%an <%ae>%x00%s%x00%b%x00` +
  patch, records split by arity, sha and date validated) as WingFoil bug-050 / task-086; a second
  header-only read (`log --no-renames --format=%H%x00`, same pathspec and flags) gives the
  authoritative sha order to resync after a NUL inside a patch; both reads name the view's HEAD
  explicitly; a malformed `wf` record is skipped with a warning; an event counts only when the
  patch touches `<id>.md`; `--no-textconv --no-ext-diff -c log.showSignature=false`; "one git
  process" → two per HEAD (§2, §5, Consequences; within REQ-PERF-05, which counts CLI
  processes); decided by the user.
