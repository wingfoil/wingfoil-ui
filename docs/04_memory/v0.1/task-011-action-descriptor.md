---
id: task-011-action-descriptor
type: task
title: "Action descriptor"
status: approved
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

The action descriptor of spec-003 computed from `memory.yaml` states for every element: state kind, verbs at 0.2.2, actor, placement, enablement, tone — with no type or state name in code outside `server/src/presets/` (REQ-ARC-05). In v0.1 it drives the read-only views, buckets and tones; no write uses it yet.

**Backlog items:** TT-ARC-06, TT-ARC-05

## Acceptance Criteria

- **TT-ARC-06** (REQ-ARC-06 — Action descriptor derived from the project): [percentage] A table-driven unit test over the elements of the three fixtures yields the expected verbs, reject targets, required role and actor for 100 % of the rows. *Verified by:* unit (table-driven) · e2e.
- **TT-ARC-05** (REQ-ARC-05 — Methodology independence): [boolean] The same build renders and acts on the `kanban`, `custom` and `unknown` fixtures with every scenario of the release passing; a lint rule finds 0 values equal to a type or state name of the three fixtures in `server/` and `web/` — string and expression-free template literals, data keys (object-literal properties, class fields, interface and type-literal property signatures, enum members) and regular-expression words; method, getter and setter names are exempt by design; the only exempt path is `server/src/presets/**` (`test/` and `contracts/` are outside the rule; spec-005 §5). v0.1 (read-only): the same build renders the three fixtures with every `@v0.1` scenario passing. *Verified by:* e2e on the three fixtures · lint.
  Scenarios (`@v0.1`): S-28.1, S-28.2, M-02.1, M-02.2, M-02.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-017-memory-list-and-live-refresh: S-28.1, S-28.2, M-02.1, M-02.2, M-02.3.

## Implementation Notes

- `spec-003-action-descriptor` (whole); REQ-ARC-05 lint (lint scope of `spec-005` §5: only `server/src/presets/**` exempt; method/getter/setter names exempt).
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
  by email, REQ-STATE-05); `actor.members` lists names; the fallback actor carries `fallback:
  "author-not-in-team"` (named `note` until review round 1); `rejection` is set when the last event is a reject into the current
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

### red / green / refactor (2026-10-05)

- **Red** (`2ba9b68`): `test/server/descriptor/{descriptor,placement}.test.ts` and
  `test/contracts/descriptor-contract.test.ts` failed on the missing module (`Cannot find module
  '…/server/src/descriptor/descriptor.js'`); `test/lint/methodology-literals.test.ts` failed on
  every planted literal (no such rule: 45 failed, 10 passed — the "accepts"/"does not apply" cases).
- **Green** (`2fc8114`):
  - `contracts/src/descriptor.ts` — the §8 types (`ActionDescriptor`, `StateKind`, `Tone`,
    `DescriptorVerb`, `DescriptorActor`, `DescriptorRejection`, `DisabledReason`), exported by the
    package index (one block added).
  - `server/src/descriptor/descriptor.ts` — `stateKind`, `toneOf`, `bucketOf`,
    `describeElement(element, events, project)`, `describeElements(elements, eventsOf, project)`;
    inputs `DescriptorEvent` (spec-002 §1 subset, oldest first), `Enablement`, `CopyState`,
    `DescriptorProject`. Verbs use task-005's `transitionTarget`, so they cannot drift from
    WingFoil's resolution; transitions into the archived set are not offered.
  - `server/src/descriptor/placement.ts` — `placement(d, user, roleView)`,
    `compareRequiresYou`, `offeredVerbs(d, roles)`.
  - `server/src/presets/wingfoil.ts` — `BUILT_IN_STATES`, `DEPRECATED`, `ARCHIVED_STATES`,
    `ArchivedStatus`, the `approver`/`tech-lead`/`reviewer` roles, moved out of `reads/`
    (re-exported from `memory-yaml.ts` / `project-reads.ts`, no caller changed);
    `server/src/presets/descriptor.ts` — the kind→tone and kind→bucket tables and the `archived`
    kind (see deviation 2).
  - `lint/methodology-literals.js` + one block in `eslint.config.js` — rule
    `wfui/no-methodology-literal` on `server/**` and `web/**` (as first built: ignoring
    `**/presets/**`, `*.test.*`, `*.spec.*`; string and expression-free template literals, which
    covers literal types and quoted keys but not unquoted keys or regexes — both fixed in review
    round 1, below) equal to a name of the fixtures; module specifiers are not checked. The names
    (39) are read from `test/contracts/samples/wingfoil-*/<fixture>/files/memory.yaml` (types,
    sequence, gates, reject targets, waiting) and `memory-search.json` (statuses, e.g. `on-hold`),
    plus `deprecated`.
- **How the ACs are proved:**
  - TT-ARC-06 — `descriptor.test.ts`: the 18 standard elements (captured `memory.yaml`, `memory
    history`, `dna show`) against the hand-written table `test/server/descriptor/standard.ts`
    (kind, verbs with targets and roles, actor, rejection, tone, bucket): **18/18 = 100 %**; the
    table is checked complete against `memory search`. §9 synthetic rows: custom `bug` `triaged`
    (gate-waiting, reject only), `task` `in-progress` (work, submit, last mover), work after a
    reject (submitter + reason), `adr` `accepted` and `tech-spec` `approved` (last), a gate on the
    last state (reject offered), an off-sequence reject target, `superseded`/`deprecated`
    (archived), an undeclared type, author not in the team / no event / member without email
    (tech-lead fallback), reject with no earlier submit, reject without reason, an edit after a
    reject. Enablement order (§6) and "role is not a rule". `placement.test.ts`: §5 on the three
    fixtures for Jordan, Morgan, Sam, Alex in several views; order; `offeredVerbs`.
    e2e half — `descriptor-contract.test.ts` on fixtures built with the pinned CLI, inputs through
    `ProjectReads`: the same table holds on the three fixtures (100 %); §9 contract check: every
    `submit`/`approve`/`reject` of every element (18 × 3 = 54 tries, a fresh copy after each
    accepted move) — accepted ⇔ offered, same target, **0 mismatches**, with one listed content
    refusal (deviation 3).
  - TT-ARC-05 — `methodology-literals.test.ts`: each of the 39 names is reported in `server/`,
    plus a template literal, a literal type, an object key, a comparison and a `web/` file; not
    reported: another word, a longer string, a template with an expression, an import path, and
    files under `presets/`, tests, `contracts/`. On the repository with inline disables ignored, the
    rule finds exactly one literal: `"open"` in `server/src/launcher/opener.ts` (deviation 1);
    `eslint .` is clean. Scenarios at API level in the contract test: S-28.1 (type lists of the
    three fixtures exactly as the scenario, every element with its own state), S-28.2 / M-02.3
    (`story` sequence `idea, shaping, ready-to-build, shipped`, `story-001-onboarding` in
    `shaping`), M-02.1 (`story` 2, `note` 2), M-02.2 (To approve `story-001-onboarding`; In
    progress `note-002-retro`; Waiting `story-002-billing`, `note-001-kickoff`; Done none) and
    M-01.2 (kanban To approve `task-001-login-form`, `bug-001-crash-on-save`). Screens: task-017.
- **Deviations (honest):**
  1. One inline `eslint-disable-next-line wfui/no-methodology-literal` for the macOS program
     `'open'` (`opener.ts`), justified in a comment; the lint test pins it as the only hit.
  2. **Spec conflict (for the coordinator):** spec-003's own words `archived` (kind), `done` and
     `active` (tones) — and the bucket codes `in-progress`, `done` — equal fixture state names, so
     the literal rule of REQ-ARC-05 flags them. Interim: the tables holding them live in
     `server/src/presets/descriptor.ts` (contracts/ is outside the rule's scope). Options: (a)
     accept this placement (record it in spec-005 §5 / spec-003); (b) rename the descriptor
     vocabulary (e.g. tone `complete`/`current`, kind `retired`) in spec-003; (c) narrow the fit
     criterion to methodology names compared against element data.
  3. §9's "every verb the descriptor enables is accepted" does not hold for content: `memory
     submit adr-001-local-server` is refused for the empty required `sard_ref` (W-01). The
     descriptor still offers it, as `action-feedback.feature` (red toast with the CLI message) and
     G-01.3 require; the contract test lists it as a content refusal (a refusal naming a
     `required` field of the type) and asserts it is the only one. Proposed spec-003 §9 wording:
     "…the CLI accepts it, unless it refuses the element's content (an empty required field)".
  4. Placement: the tech-lead **fallback** actor (author not in the team / no event) is put in
     *Requires you* of the `tech-lead` view, like an undeclared state; spec-003 §5 lists only
     `undeclared` there, which would leave such elements in no list of a tech-lead. Requires-you
     action codes (`submit`, `rework`, `review`, `approve`, `resolve`) are mine.
  5. `DisabledReason` is a code with parameters, not a text (browser texts are the web
     catalogue's, spec-008); `rejection.reason` is `null` when the commit has none; `verbs[].role`
     is `null` for `submit`.
- **Hand-over to task-012** (the API):
  - Per repository state, call `describeElements(matches, eventsOf, { memoryYaml, members,
    enablement })` with `matches` of `ProjectReads.elements()` (archived ones when
    `?archived=true`), `memoryYaml` of `memoryTypes()` (when it throws a `DirectReadError`, spec-004 §5
    degrades only type-dependent features: serve the elements without descriptor), `members`
    of `dna().data.team.members`, `enablement` = `{ identified` (task-009), `version: { supported,
    range }` (task-006), `localChanges` (set of element ids, task-010) `}`; `copy` is v0.2.
  - `eventsOf(id)`: **open point 1 of the design** (no owner for spec-002 §3). Interim source:
    `ProjectReads.history(id).data.entries` (fits `DescriptorEvent`, oldest first) — one process
    per element, against TT-PERF-05.
  - Serve `bucketOf(d.kind)` next to each descriptor until spec-003 §8 decides (design gap 2).
  - Placement/order/offered verbs are for Today (v0.2) and the footers; nothing in v0.1 needs
    them over HTTP.
- **Hand-over to task-017/018/web:** render `kind`, `tone`, `verbs`, `actor`, `rejection`,
  `since`; map `DisabledReason.code` and `actor.fallback` to catalogue keys; use tone values as data
  (`tone-${tone}`) — a `web/` literal equal to `done`/`active`/`archived` fails REQ-ARC-05.
- **Merge note:** sibling tasks adding a literal (or, since review round 1, a data key: unquoted
  object property, interface property signature, class field, enum member, or a regex word) equal
  to a fixture state or type name in `server/` or `web/` (e.g. `'open'`, `'active'`, `'done'`,
  `'pending'`, `'task'`) fail the new rule after merge; method names are exempt (round 3). The
  only expected hits after merge: task-010's `server/src/snapshot/snapshot.ts:273` literals
  `'deprecated'` / `'superseded'` (→ `ARCHIVED_STATES` of `server/src/presets/wingfoil.ts`) and
  task-010's `server/src/snapshot/watcher.ts:71` `private closed = false;` (a class field equal to
  the custom `bug` state `closed`; task-010 is renaming it).
- **Hand-over to task-017/018 (web):** props, state fields, interface property signatures and
  other data keys equal to a fixture name (`open`, `active`, `closed`, `done`, `ready`, `pending`,
  `release`, `plan`, `service`, `note`, …) are reported by REQ-ARC-05 — expect renames or justified
  inline disables. Method, getter and setter names are not reported.
- **Checks (refactor, 2026-10-05, load average 54–96 on 12 cores from another project):**
  typecheck, lint, format:check clean · `docs:api` OK · `test:e2e` 3/3 · `check_tasks.py` OK ·
  `npx vitest run --coverage --coverage.reportOnFailure`: 45 files, **659 passed / 2 failed / 1
  skipped** in 517 s — the two failures are the known timing tests of bug-001 (REQ-PERF-06 start,
  TypeDoc build > 30 s) at load ≈ 60; coverage **96.63 %** statements / **90.73 %** branches /
  96.59 % functions / 98.26 % lines (`server/src/descriptor` 99.2 % / 94.02 %). The descriptor
  contract test: first run 9/10 in 496 s (the custom §9 check found the `sard_ref` content
  refusal, deviation 3), then that test alone passed (442 s, mostly the three builds); all 10 pass
  in the coverage run.

### review round 1 (2026-10-05)

Coordinator review: **FAIL** on the lint rule (descriptor logic accepted). Fixed:
- **1 (major) keys and regexes:** the rule now also checks keys written as bare identifiers —
  non-shorthand properties of object literals, `TSPropertySignature` (interface and type-literal
  members), class properties (`PropertyDefinition`, abstract too), enum members — and the
  standalone words of a regex literal (bounded by `^`, `$`, `(`, `(?:`, `)`, `|` or `\b`; an
  unanchored `/done/` too). Plain identifiers, member access, shorthand properties and computed
  keys are not checked. New cases: unquoted object key, type-literal key, interface member, enum
  member, class property, anchored alternation, non-capturing group, `\b` word (reported);
  identifiers/member access, shorthand, computed key, `/^task-\d+$/` (accepted). The residual risk
  (concatenation, `${''}done`, case variants, JSX text, other regex shapes, destructuring) is
  documented in the `eslint.config.js` block, as SEC-05's is.
  The wider rule found four generic words in existing code: renamed `Running.done` → `settled`
  (`process/runner.ts`, internal), `InProcessWriteLock.pending` → `queued` (private), and this
  task's `actor.note` → `actor.fallback` (contracts type); `LauncherCommand.open` (spec-007
  `--no-open`, used by `start.ts`) keeps its name with a justified inline disable, like
  `opener.ts`'s `'open'`. The repository check now pins exactly these two `open`s.
- **3 (minor) exemption narrowed** to `server/src/presets/**`: `web/src/presets/` and
  `server/**/*.test.*` are now reported (tests asserting it); nothing needed the old exemptions.
- **5** names: 39, not 40 (the test now asserts 39). **6** only directories under
  `test/contracts/samples/` are read. **7** `compareRequiresYou`: an unparsable `since` sorts last
  like an absent one (test with both orders).
- **Round 2 (2026-10-06):** class and interface method names (`MethodDefinition`, abstract too,
  `TSMethodSignature`) are checked as well, with tests; an unanchored `/done/` is pinned by a test;
  `new RegExp('…')` string arguments and JSX attribute names added to the residual risk; merge
  note (task-010 `watcher.ts` `closed`) and web hand-over added.
- **Round 3 (2026-10-06, coordinator decision):** method names are behaviour, not methodology
  data, and checking them hit sibling APIs (task-006 `get resolved()`, task-010 `open()`,
  `archived()`): class methods, getters and setters, abstract methods, interface methods and
  object-literal methods/getters/setters are now **exempt** (tests assert they are accepted);
  data keys, literals and regex words are still reported. Comment, merge note and web hand-over
  updated.
- Not changed here (coordinator's): task-010's `snapshot.ts` hit (named in the merge note), the
  gate-waiting actor and the bucket wording (escalated to the user).

### open points — decided by the user 2026-10-06

All option (a). Code changed here:
- **Gate-waiting actor** (custom `bug` `triaged`): the actor is the **workflow engine**, as for
  `waiting`; the `reject` verb stays reserved to `approver` (its `role`). Placement follows: such
  an element is in *Waiting on others* of every member ("Waiting for the workflow engine"), never in
  *Requires you*; `offeredVerbs` offers its reject only to `approver` holders. Tests:
  `descriptor.test.ts` (triaged row, by hand from the rule), `placement.test.ts` (Morgan/Alex/Sam/
  Jordan in several views, reject offered to Morgan only). No standard element is gate-waiting, so
  `standard.ts` rows are unchanged.
- **`bucket` in the descriptor output** (spec-003 §8): `ActionDescriptor.bucket?: Bucket`
  (`Bucket` moved to `contracts/src/descriptor.ts`, exported by the index), absent for archived
  elements; `bucketOf(kind)` stays exported. Rule: `last` (last non-archived state) → `done`, e.g.
  custom `adr` `accepted` → Done, `superseded` → none (tested). The table oracle and the contract
  test now read `d.bucket`.
No code change (accepted as built): tables in `server/src/presets/` (10, 13), the §9 erratum (11),
my minor choices (14).
- **Hand-over to task-012 (updated):** the project-wide `git log -p` event parse of spec-002 §3 is
  **task-012's** (decision 9). The descriptor keeps events as an input: give `describeElements` an
  `eventsOf(id)` backed by that parse (oldest first, `DescriptorEvent` shape); `memory history` is
  only the element panel's source. `bucket` now comes with each descriptor — no need to attach it.
- **Checks (2026-10-06, load ≈ 3–5):** typecheck, `eslint .`, format:check clean · `docs:api` OK ·
  `vitest run test/server/descriptor test/lint` 160/160 · `descriptor-contract.test.ts` 10/10
  (29 s).

### integration (2026-10-06)

- `main` (90d4f81: Wave 2 spec amendments, bug-002, task-010/012 AC updates) merged into the
  branch with no conflict. Full gates on the merge, load 15–22: typecheck, lint, format:check
  clean; `test:coverage` 680 passed, 1 skipped, coverage 96.64 % statements / 90.88 % branches;
  `docs:api` OK; `test:e2e` 3/3; `check_tasks.py` OK.
- Reviews: round 1 FAIL (lint rule coverage), round 2 FAIL (merge note), round 3 FAIL (method
  names on sibling APIs → method names exempt by coordinator decision), round 4 PASS; user
  decisions 17 and 12 re-verified PASS.
