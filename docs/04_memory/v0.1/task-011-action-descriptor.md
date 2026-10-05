---
id: task-011-action-descriptor
type: task
title: "Action descriptor"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The action descriptor of spec-003 computed from `memory.yaml` states for every element: state kind, verbs at 0.2.2, actor, placement, enablement, tone — with no type or state name in code outside `server/presets/` (REQ-ARC-05). In v0.1 it drives the read-only views, buckets and tones; no write uses it yet.

**Backlog items:** TT-ARC-06, TT-ARC-05

## Acceptance Criteria

- **TT-ARC-06** (REQ-ARC-06 — Action descriptor derived from the project): [percentage] A table-driven unit test over the elements of the three fixtures yields the expected verbs, reject targets, required role and actor for 100 % of the rows. *Verified by:* unit (table-driven) · e2e.
- **TT-ARC-05** (REQ-ARC-05 — Methodology independence): [boolean] The same build renders and acts on the `kanban`, `custom` and `unknown` fixtures with every scenario of the release passing; a lint rule finds 0 string literals equal to a type or state name of the three fixtures in `server/` and `web/` outside `presets/` and tests. v0.1 (read-only): the same build renders the three fixtures with every `@v0.1` scenario passing. *Verified by:* e2e on the three fixtures · lint.
  Scenarios (`@v0.1`): S-28.1, S-28.2, M-02.1, M-02.2, M-02.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-017-memory-list-and-live-refresh: S-28.1, S-28.2, M-02.1, M-02.2, M-02.3.

## Implementation Notes

- `spec-003-action-descriptor` (whole); REQ-ARC-05 lint (no type/state literal outside `presets/` and tests).
- `dl-002` (permissions left to WingFoil): the descriptor computes no UI-side permission; the role a gate requires is WingFoil's.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged (dl-015):** task-005 Execution Notes read, review included. Taken from
  them: `readMemoryYaml` / `resolveStates` / `transitionTarget` (WingFoil 0.2.2's
  `resolveTransitionTarget`, already checked against every transition the CLI recorded on the
  three fixtures) are the descriptor's state-machine inputs; `id_pattern` is optional and merge
  keys are resolved (nothing here reads `id_pattern`); `DnaMember.email` is optional in 0.2.2 (a
  member without email is never matched as an event author); `HistoryEntry` of `memory history`
  carries `operation`/`from`/`to`/`approver`/`reason` per event (spec-002 §1 shape minus
  `type`/`id`, plus `subject`); `operation: null` entries are commits outside a WingFoil verb (not
  events); the archived searches (`deprecated`, `superseded`) are lazy; never log
  `DirectReadError.message`; schemas follow 0.2.2's own (spec-001 errata on `main`).
- **Specs:** spec-003 (whole) covers kind, verbs, actor, placement, enablement, tone and the §8
  output; spec-002 §1 the event shape; spec-005 §3/§5 and the SARD fit criterion of REQ-ARC-05
  the "presets only" rule; `memory-list.feature` (header) the four buckets. Directives
  `cli-only-writes`, `determinism`, `traceability`, `doc-versioning`. No missing tech-spec for
  the descriptor itself. Gaps found, reported to the coordinator (not edited here):
  1. **No v0.1 task owns spec-002 §3** (the project-wide `git log -p` parse that spec-003 §1 names
     as the source of the actor's events): task-012 only uses `memory history` for `/history`,
     task-010 batches CLI reads. Without it the actor of every element needs one `memory history`
     process per element (against TT-PERF-05, ≤ 6 processes on a cold Memory list). This task
     keeps the descriptor **pure**: events come in as input (any object with spec-002 §1's
     `timestamp, author, operation, from, to, approver, reason` — `HistoryEntry` and a spec-002
     event both fit), so either source plugs in. Options: (a) add spec-002 §3 to task-010 or
     task-012; (b) a new small task before task-012; (c) accept `memory history` per element in
     v0.1 and relax TT-PERF-05.
  2. **Buckets are not in spec-003 §8.** The four Memory buckets come from `memory-list.feature`
     (by kind: `gate` → To approve; `work`, `undeclared` → In progress; `first`, `waiting`,
     `gate-waiting`, `off-sequence` → Waiting/drafts/closed; `last` → Done; `archived` → none).
     Exported here as `bucketOf(kind)`; proposal: add `bucket` to the §8 output (erratum) so
     `web/` does not derive it — until decided, task-012 attaches it.
  3. **`presets/` location.** spec-005 says `server/presets/`; the server's `rootDir` is
     `server/src`. WingFoil 0.2.2's own vocabulary (built-in machine, archived set, the
     `approver`/`tech-lead`/`reviewer` roles of W-13/spec-003) moves to `server/src/presets/` —
     the lint exemption is any `presets/` folder under `server/` or `web/`, as the SARD fit
     criterion words it.
  4. **One non-methodology literal equal to a fixture state:** `'open'`, the macOS program in
     `server/src/launcher/opener.ts`. Kept with an inline, justified `eslint-disable-next-line`
     (the rule is about methodology names; renaming a program is not possible).
- **Scope boundaries:** here — `contracts/src/descriptor.ts` (the §8 output types), the
  descriptor in `server/src/descriptor/` (kind, verbs, actor, rejection, `since`, enablement,
  tone, placement, Requires-you order, bucket), `server/src/presets/wingfoil.ts` (WingFoil
  vocabulary moved out of `reads/`), the REQ-ARC-05 lint rule (`eslint.config.js`, names read
  from the three fixtures' captured `memory.yaml` and `memory search` samples). **task-012:** the
  inputs at run time (memory.yaml, `memory search`, `dna show`, events, identity, version range,
  local changes) and serving the descriptor with `/elements`. **task-009:** identity and role
  view (placement takes them as input). **task-010:** cache per repository state, local-changes
  set. Copy behind/diverged/detached (REQ-STATE-04) is v0.2: an optional input here.
- **Output decisions (within §8):** `verbs[].role` is `null` for `submit`; `reason` is a code with
  parameters (`not-in-team`, `version-unsupported {range}`, `local-changes`, `copy-behind
  {commits}`, `copy-diverged`, `copy-detached`), since browser texts come from the web catalogue
  (spec-008), not from the server; `actor.member` is `{name, email}` (placement matches the user
  by email, REQ-STATE-05); `actor.members` lists names; the fallback actor carries `note:
  "author-not-in-team"`; `rejection` is set when the last event is a reject into the current
  state; `since` is absent when no event led into the current state.
- **AC classification** — all **red-first** (no descriptor, no lint rule exist):
  - TT-ARC-06 — `test/server/descriptor/descriptor.test.ts`: table-driven over the 18 standard
    elements of the three fixtures (definitions from the captured `memory.yaml`, histories from
    the captured `memory history`, team from `dna show`): expected kind, verbs, reject targets,
    required role, actor, rejection, tone, bucket per row, oracle written from
    `00_conventions.md` (100 % of the rows); plus the §9 synthetic rows (custom `bug` `triaged`
    gate-waiting, `task` `in-progress` work, `adr` `accepted` last, a gate on the last state, an
    off-sequence reject target, `deprecated`, an undeclared type, an author not in the team, no
    history), enablement order (§6) and placement (§5). e2e half:
    `test/contracts/descriptor-contract.test.ts` — the three fixtures built with the pinned CLI,
    inputs read through `ProjectReads`, the same table holds; §9 contract check: every
    `submit`/`approve`/`reject` on every element run on a copy — accepted ⇔ offered.
  - TT-ARC-05 — `test/lint/methodology-literals.test.ts`: the rule reports a planted type/state
    literal in `server/` and `web/` (string, template, type literal), not in `presets/` or tests;
    `eslint .` finds 0. Scenarios S-28.1, S-28.2, M-02.1–M-02.3 at API/unit level on the built
    fixtures (type list and counts, sequence chips and current state, state filters, buckets) in
    the contract test; their screens close in task-017.
