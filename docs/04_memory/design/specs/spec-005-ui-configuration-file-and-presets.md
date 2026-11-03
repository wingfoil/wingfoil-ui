---
id: spec-005-ui-configuration-file-and-presets
type: tech-spec
title: "UI configuration file and presets"
status: approved
scope: ".wingfoil/ui.yaml schema, inferred defaults and UI presets"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2, 0.3.1"   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.3"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`.wingfoil/ui.yaml` is the only file the UI owns (REQ-ARC-03 class b, REQ-ARC-07, directive
`cli-only-writes`): the conventions WingFoil itself does not describe — which Memory types are
work, defects, decisions…; which values are references; how progress is computed. Its draft is
`docs/00_reference/ux-reference.md` §6, amended by the specification: no `permissions` key
(`dl-002`), `progress.scope` declares a type only and the current element is derived (session 3).
`dl-003` limits **UI presets** to contents of this file.

## Specification

### 1. Schema (version 1)

`contracts/files/ui-yaml.schema.json` (JSON Schema draft-07, as the other schemas of
`contracts/files/`; its `$comment` names the file version, `ui.yaml version 1` — the shape is the
UI's, not a WingFoil capture, spec-001 §5), written by the task that first reads the file (C1a);
unknown keys are **errors** at every level (so `permissions` is refused, REQ-ARC-07). The schema
holds the key structure and the closed values below; the checks it cannot express are the
semantic checks that follow.

| Key | Type | Rule |
|-----|------|------|
| `version` | integer | required, `1` |
| `taxonomy.categories` | map type → category | category ∈ `work`, `defect`, `decision`, `spec`, `requirement`, `feature`, `release`, `external` |
| `taxonomy.patterns` | list of `{match, category}` | `match`: a string of 1 to 200 characters, a regular expression of the safe subset below; `category` as above |
| `taxonomy.requires` | map type → list of categories | categories as above |
| `progress.mode` | `sequence` \| `flow` | `sequence`: progress follows the current element of `scope`; `flow`: no current element, figures are project-wide |
| `progress.scope` | `{type}` | a type only — never an id |
| `progress.phases` | list of strings | the phases shown in order; matched to `workflow status` from v0.4 only (§4, RP3-14 D2) |
| `progress.iterates` | type | the type counted as iterated work ("tasks 1/4") |
| `progress.defects` | type | the type counted as open defects |
| `holds` | map type → map state → `{approve}` | `approve`: `never` \| `when-references-done` — the gate's *Approve* is not offered by the console (§4a, RP3-14 D5) |
| `artifacts` | list of `{path, phase}` | `path`: repository path or `https://` URL with `{version}`/`{release}` placeholders |

Semantic checks, against the project (after the schema), in this order; the first failure is the
one reported (§2, §5):

1. every type named in `categories`, `requires`, `scope`, `iterates`, `defects` and `holds` is
   declared in `memory.yaml` — otherwise "type `<t>` is not declared in memory.yaml";
2. every state named under `holds.<t>` is a declared state of `<t>` (spec-001 §4.1) — otherwise
   "state `<s>` is not declared for `<t>`"; a hold on a declared state that is not a gate of `<t>`
   has no effect (so one preset serves the 0.2.2 and the packs' states of a type);
3. every `taxonomy.patterns[<i>].match` compiles as an ECMAScript regular expression with the `u`
   flag and stays inside the **safe subset** — otherwise "taxonomy.patterns[<i>].match: <reason>".

**Safe subset of `match` (slow-pattern safety).** The server tests every pattern against
frontmatter values of every element on each repository state, and `ui.yaml` is repository content
anyone with push access writes: a pattern must not be able to stall the server (catastrophic
backtracking). A pattern is accepted only when:

- every top-level alternative starts with `^` (one anchored attempt per value, not one per
  position);
- it holds no backreference (`\1`, `\k<name>`) and no lookahead or lookbehind;
- it holds at most 2 quantifiers (`?`, `*`, `+`, `{n}`, `{n,}`, `{n,m}`), each applied to a single
  atom — a character, an escape, a character class or `.` — never to a group, and `{n,m}` has
  `m ≤ 100`.

A value longer than 256 characters is never tested against a pattern (it is not a reference
unless it equals an element id, §4). With these bounds one test costs at most a number of steps
quadratic in the value's length. The shipped presets' patterns hold no quantifier (§5). Reasons,
rendered as written: "must start with ^", "backreferences are not allowed", "lookaround is not
allowed", "at most 2 quantifiers", "a quantifier on a group is not allowed", "{n,m} above 100",
"does not compile: <engine message>".

### 2. Loading

The file is read from the **working tree** at `.wingfoil/ui.yaml`, as every view shows the working
tree (`adr-001` D6), on each repository state, by a direct read: REQ-ARC-04's fit criterion already
names `ui.yaml` among the files that may be read, and spec-001 §4.5 lists it. **The file exists** when the working tree holds any
entry at that path — a regular file, a symbolic link or a directory, tracked or not.

- An entry that is not a regular file (a symbolic link, never followed, or a directory), or a file
  above 64 KiB → ignored as a whole, with the warning "ui.yaml ignored: not a regular file" or
  "ui.yaml ignored: larger than 64 KiB".
- The YAML is parsed with aliases and custom tags refused (an alias is a parse failure: no
  expansion of a small file into a large tree) and duplicate keys refused.
- No file → **inferred** values (§3); every value is shown "inferred".
- A file that is not YAML, fails the schema or a semantic check → it is **ignored as a whole**,
  inferred values are used, and a warning names the first failure
  ("ui.yaml ignored: progress.mode must be sequence or flow (found spiral)", C-04.1/C-04.2).
- A valid file → its values are "declared"; keys it omits fall back to inferred values, shown
  "inferred". The current element of `scope` is shown "derived". A type the declared
  `categories` map leaves out has no category, and that absence is "declared" too ("No category —
  not counted in progress figures").
- The warning, when there is one, travels with the effective configuration (`GET
  /api/p/:pid/config`, spec-004 §3) and with the progress figures, where Today shows it (C-04.1);
  their shapes are the project-state views spec's (RP3-14, step 5c).

### 3. Inferred values (no or ignored file)

The inference table lives in `server/src/presets/` with the presets — the only place where type
names may appear in code (REQ-ARC-05).


- `taxonomy.categories`: by type name — `task` → work, `bug` → defect, `adr` and `decision-log` →
  decision, `tech-spec` → spec, `release` and `release-line` → release, `service` → external; any
  other type has none ("No category — not counted in progress figures").
- `taxonomy.patterns`, `taxonomy.requires`, `holds`, `artifacts`: empty — without a file the
  console offers every *Approve* WingFoil allows (spec-003).
- `progress`: `mode: flow`; `iterates` = the type with category `work` if exactly one, `defects` =
  the type with category `defect` if exactly one; no `scope`, no `phases`.

### 4. References and computations

- **Reference:** a string value (scalar or list item) of any frontmatter field other than `id`,
  `type`, `title`, `status`, `tags`, `rejection_reason`, which equals the id of another Memory
  element (its category is that element type's) or matches a `taxonomy.patterns` entry (that
  entry's category). An element is **linked** to each of its references. A reference that matches
  a pattern and is no element's id is shown **by its id only** in v0.3 — no title, description or
  source document (RP3-14 D9; WingFoil names a project's chain in prose only, so a source needs a
  machine-readable chain first, a WingFoil feedback note).
- **Done:** an element of spec-003 kind `last` (the last non-archived state of its `sequence`);
  archived elements are excluded from every figure.
- **Current element** of `progress.scope` (mode `sequence`), on **every** WingFoil version in v0.3
  (RP3-14 D2): among the elements of that type not in the first state of their `sequence` nor of
  spec-003 kind `last` or `archived` (`end`), the one in the most advanced state, ties broken by
  the lowest `version` field, then id; none → "No current <type>" and project-wide figures
  (REQ-STATE-08). From v0.4, on WingFoil 0.3 or later, the element `workflow status` reports
  (REQ-INT-07; the command is not consumed in v0.3, spec-001 §3).
- **Phase figures** (phase, phase completion; `ux-reference.md` §4.1, §7) follow the capability
  `workflow-position` (spec-001 §6): below WingFoil 0.3.0 read-only with the reason
  `needs-version` ("Phase — needs WingFoil 0.3 (this project: 0.2.2)", T-15.1, T-15.2); from
  0.3.0 read-only with the reason `not-in-release`, until v0.4 consumes `workflow status`. The
  other figures are shown on every version.
- **In scope:** an element belongs to the current element when one of its frontmatter values
  equals the current element's id or its `version` field (e.g. a task's `release: v0.1` and the
  release `minor-v0.1` with `version: v0.1`); with no current element, every element is in scope.
- **Figures:** reference completion = done linked elements / linked elements, over the elements
  in scope; project completion = unweighted mean of the completion of `requirement` and `feature`
  references with ≥ 1 linked element in scope (Q8); iterated = done / all `iterates` elements in
  scope; open defects = `defects` elements not done
  (project-wide); pending gates = elements of kind `gate` (spec-003; `gate-waiting` excluded)
  whose *Approve* is not held (§4a), project-wide;
  coverage = elements carrying every `requires` category / elements whose type has `requires`
  (project-wide).

The custom fixture with the sw-life-cycle preset must give exactly the figures of the BDD
conventions (project completion 25 %, tasks 1/4, open bugs 1, pending gates 3, coverage 3/5); no
element of that fixture sits in a held state, so the holds of the preset change none of them.

### 4a. Held gates (`holds`, RP3-14 D5)

A project declares, per type and gate state, that the console never offers that gate's
*Approve* — the approval belongs to a step the console does not run, or waits for other elements.
The UI stays methodology-independent: the rule names no type or state; the project's `ui.yaml`
(or the preset it applied) does (REQ-ARC-05).

| `approve` | *Approve* not offered | Reason (code, parameters) |
|-----------|-----------------------|---------------------------|
| `never` | ever, in that state | `held-by-config` — the approval is made outside the console; "Approved outside the console (ui.yaml)" |
| `when-references-done` | while at least one non-archived element **references** the element and is not done — a frontmatter value of it equals the element's id or its `version` field (the in-scope rule of §4), done = spec-003 kind `last` | `held-until-references-done {count}` — the number of such elements; "Waits for {count} referencing element(s) to be done" |

- The hold withdraws *Approve* only: the gate's *Reject* stays as spec-003 offers it, and the
  CLI is untouched (a `memory approve` from a terminal still works — the hold is the console's,
  not WingFoil's).
- Where *Approve* is withdrawn the gate footer shows an informational line with the reason (a
  member holding `approver` keeps each *Reject*); on Today the element is never in *Requires you*
  and is in *Waiting on others* for every member, approvers included, with the reason in place of
  "Reserved to approver — …" (spec-003 §5; review round 1 F1, decided by the approver). The
  descriptor's mechanism — how a hold enters the verbs, the actor and the placement, the
  `approveHeld` output — is spec-003's (§3, §5, §8); this section fixes the key, its values and
  when a hold applies.
- Evaluated by the server on each repository state with the descriptor (spec-003 §8), from the
  effective `ui.yaml` (an ignored file holds nothing).
- A held gate is not a *pending gate* (§4): the console offers no decision on it.

Examples (the sw-life-cycle preset, §5): a `release` in `releasing` is approved at the
publication's last step, `mark-released`, after the package is published (`release-conventions`
1.2), never from the console (A-1); a `release-line` in `active` is approved at the line's end,
when every release of it is released (A-2; its releases reference it by `release-line: "v1"`, its
`version`).

### 5. UI presets (`dl-003`)

Shipped in `server/src/presets/` (the only place where type names may appear in code, REQ-ARC-05;
under `server/src/` because the server compiles only `server/src`):

| Preset | Made for | Content |
|--------|----------|---------|
| Kanban | `wingfoil init --template Kanban` | categories of the 7 categorised template types (§3 names; the `plan` type of the 0.3.1 template has none, §2); `patterns: []`, `requires: {}`, `holds: {}`, `artifacts: []` (written explicitly, so every value shows "declared", C-02.1); `progress: {mode: flow, phases: [plan, build, review, deliver], iterates: task, defects: bug}` |
| Scrum | `wingfoil init --template Scrum` | as Kanban (empty lists and maps written explicitly), with `progress: {mode: sequence, scope: {type: release}, phases: [plan, build, review, deliver], iterates: task, defects: bug}` |
| WingFoil `sw-life-cycle` | the WingFoil repository and projects copying its configuration (the packs `base`, `software`, `methodology/scrum`) | `ux-reference.md` §6 with `scope: {type: release}`, patterns `^(REQ\|US)-` → requirement, `^(P\d\|Journey)` → feature, `^(minor\|patch)-v\|^rl-` → release, `requires` for `task`, `adr`, `tech-spec` → requirement, categories including `service`; `phases: [sprint-planning, development, plan-release, release, sprint-review, retrospective, close]` (the phases of the packs' `sprint` workflow, which carries a release from its planning to its publication) as §6's example since `ux-reference.md` 1.12 (review round 1 F6), no removed procedure; `artifacts` as §6, every `phase: release`; `holds: {release: {releasing: {approve: never}}, release-line: {active: {approve: when-references-done}}}` (§4a) |

**Re-checked on WingFoil 0.3.1 (RP3-14).** `init --template Kanban` declares 8 types — `adr`,
`bug`, `decision-log`, `plan`, `release`, `release-line`, `task`, `tech-spec` — with the default
states `draft → pending → approved` (gate `pending`) on all but `plan` (`draft → active → done`,
`waiting: [active]`); 0.2.2's declares the same 7 types without `plan`
(`test/contracts/samples/wingfoil-0.2.2/kanban/files/memory.yaml`,
`test/contracts/samples/wingfoil-0.3.1/kanban/files/memory.yaml`). `init --template Scrum` on
0.3.1 declares the same types and states as Kanban, and the delivery workflows of the two
templates (`kanban-delivery`, `scrum-delivery`) still have the phases `plan`, `build`, `review`,
`deliver` (both templates initialised with the pinned CLI in throwaway repositories, 2026-11-03).
So the Kanban and Scrum presets pass the semantic checks unchanged on the templates of 0.3.1 (and
Kanban's on 0.2.2's); `plan` reads "No category". The sw-life-cycle preset's `holds` name states declared for `release` and
`release-line` on the custom fixture with both its state sets (with the pre-packs states they
are not gates: no effect, §1 check 2).

**Apply** (`POST /api/p/:pid/ui-config/preset` `{preset}`, `preset` ∈ `kanban`, `scrum`,
`sw-life-cycle`, spec-004 §3): *Use preset* is **hidden** when `.wingfoil/ui.yaml` exists (§2;
C-02.3) or the user is not identified in the team (C-02.5), and **disabled with the reason** when
the copy is behind, diverged or detached ("Blocked: your copy is 1 commit behind the remote —
Update", C-02.4) or the WingFoil version is outside the range (the reason of spec-003 §6 rule 2).
The server enforces the same, in the order of spec-004 §4:

| spec-004 §4 row | Applies | Refusal |
|-----------------|---------|---------|
| 1–4 (origin, session, project, body) | yes | as spec-004 §4 (an unknown `preset` fails the body schema: 400 `invalid-request`) |
| 5 (identified in the team) | yes | 403 `not-in-team` |
| 6 (WingFoil version in range) | yes — an out-of-range project is read-only | 409 `unsupported-version` |
| 7 (element file has local changes) | replaced: `.wingfoil/ui.yaml` must exist **nowhere** — not in the working tree (any entry), not in the index, not at HEAD — checked fresh under the write lock | 409 `ui-config-exists` |
| 8 (copy behind, diverged, detached) | yes, fresh under the write lock | 409 `stale-copy` |
| 9 (`expectedStatus`) | no (no element) | — |

Then, under the same write lock: the server renders the preset (no user text enters it), reads
`memory.yaml` (unreadable → 502 `read-error`, spec-004 §5), validates the content against the
schema **and** the semantic checks — a failure → **422 `ui-config-invalid`** with
`detail.failure` = the first failure ("missing required key version", "type service is not
declared in memory.yaml"), nothing written, the toast "ui.yaml not written: <failure>"
(C-03.1/C-03.2) —, creates the file exclusively (it never overwrites an entry that appeared
meanwhile: 409 `ui-config-exists`), then runs `git add -- .wingfoil/ui.yaml` and `git commit
--only -m "chore(ui): apply the <Preset> preset" -- .wingfoil/ui.yaml` (REQ-INT-06; other staged
changes stay staged, C-02.2), with the git environment of the CLI's writes (spec-001 §1: no
transport can start). The commit runs the repository's hooks, as a CLI write's does.

- **Success** → 200 `write.response.schema.json` (spec-004 §5): `result` `{ file:
  ".wingfoil/ui.yaml", preset }`; `commits` the one first-parent commit made since the fresh HEAD
  whose subject is the preset's and which changes `.wingfoil/ui.yaml` only, holding the file
  written; `push` as after a governed write — the commit is appended to the action log
  (spec-006 §2, REQ-SEC-10: every commit the UI causes), auto-pushed when *Auto-push* is on
  (spec-010 §6), and announced by the `write` event `{pid, commit}` without `eid` (spec-004 §6).
- **`git add` fails** → 422 `git-refused` (git's message, redacted as spec-004 §5); the file the
  server created is removed — nothing else had it.
- **`git commit` fails, or no single commit is found** → 500 `write-incomplete` with
  `detail.file: ".wingfoil/ui.yaml"` (and `detail.commit` when a commit is found), the file left
  as it is (staged), nothing restored, logged, pushed or announced (spec-004 §5).

**`server/src/presets/` also holds** WingFoil 0.2.2's own vocabulary (built-in state machine,
archived set `deprecated`/`superseded`, the roles `approver`, `tech-lead`, `reviewer`) and the
tables of spec-003's own vocabulary that coincide with fixture state names (the kind `archived`,
the tones `done` and `active`, the bucket codes `in-progress` and `done`; spec-003 §8).

**Lint scope (REQ-ARC-05, rule `wfui/no-methodology-literal`).** On `server/**` and `web/**` the
rule reports a value equal to a type or state name of the three fixtures in: string and
expression-free template literals (literal types and quoted keys included), data keys written as
identifiers (object-literal properties, class fields, interface and type-literal property
signatures, enum members) and the standalone words of a regular-expression literal. Method,
getter and setter names are **exempt by design** (behaviour, not methodology data). The only
exempt path is `server/src/presets/**` (test files and any `presets/` folder elsewhere under
`server/` or `web/` are checked; `test/` and `contracts/` are outside the rule's scope); a
remaining non-methodology hit needs a justified inline disable.

### 6. Verification

- Each shipped preset validates and passes the semantic checks on its own template's fixture;
  the sw-life-cycle preset is refused on the Kanban fixture (`service`).
- The schema rejects `permissions`, an unknown category, an unknown `holds.<t>.<s>.approve` value
  and `scope.id`; the semantic checks reject a regular expression that does not compile, each
  rule of the safe subset (one case per reason), an undeclared type or state under `holds`.
- A pattern of the safe subset at its bounds, tested on a 256-character value built to make it
  backtrack, answers within 10 ms (unit).
- Loading: a symbolic link, a directory, a file above 64 KiB, a YAML alias and a duplicate key
  each give the inferred values and their warning.
- The figures of §4 on the custom fixture with the preset equal the conventions' numbers; on
  WingFoil 0.3.1 the current element is the 0.2.2 derivation's and the phase figure is read-only
  `not-in-release`.
- Holds: on the custom fixture with the preset, a `release` moved to `releasing` offers *Reject*
  and no *Approve*, with `held-by-config`, and is not a pending gate; a `release-line` in `active`
  with one referencing release not done gives `held-until-references-done {count: 1}`, and
  *Approve* once it is done.
- The preset write: an API test per row of the table of §5 (status, `code`, nothing written, no
  git process before the checks pass), the `git add` and `git commit` failures, and the success
  body, action-log entry, auto-push and `write` event.
- The scenarios of `features/c/ui-yaml.feature` and those cited by REQ-ARC-07 and REQ-STATE-08 pass.

## Consequences

- A project renders with sensible defaults on day one, and a preset makes its conventions
  explicit and versioned in one reviewable commit.
- An invalid file never half-applies: it is ignored with one explicit warning.
- References are recognised by value, not by field name, at the price of recognising only Memory
  ids and declared patterns; the only field name the rules use is `version` (in-scope rule and
  tie-break).

## Process Notes

- 2026-10-02 — drafted in initial-design session 5b from `ux-reference.md` §6–7, the BDD
  conventions, REQ-ARC-07, REQ-STATE-08, `dl-002` and `dl-003`; additions: the reference rule by
  value, the in-scope rule (id or `version`, checked against the conventions' figures), inferred `mode: flow`, the Kanban/Scrum preset contents (from the 0.2.2 templates' types
  and delivery phases), ties broken by id. Submitted after the independent spec review (plan step 6).
- 2026-10-02 — spec review (step 6): F6 done = kind `last` (archived excluded); F7 presets write
  empty lists/maps explicitly; F8 inference table in `server/presets/`, `version` named; F9 pending
  gates project-wide; F11 hidden vs disabled for *Use preset*.
- 2026-10-03 — release-planning v0.1 session 2: implementation release v0.1 → v0.3 (REQ-ARC-07
  moved to v0.3, SARD `01` v0.6; no `@v0.1` scenario reads `ui.yaml`).
- 2026-10-06 — amended in dev-loop task-011 (Wave 2, plan dev-loop-rel-v0.1-plan): presets in
  `server/src/presets/` (not `server/presets/`: the server compiles only `server/src`), which also
  holds WingFoil's vocabulary and spec-003's vocabulary tables that coincide with fixture state
  names; §5 lint scope of REQ-ARC-05 (literals, data keys, class fields, interface property
  signatures, enum members and regex words checked; method/getter/setter names exempt; only
  `server/src/presets/**` exempt); decided by the user (option 10a, with the
  method/getter/setter-name exemption).
- 2026-11-03 — amended in release-planning v0.3 (plan release-planning-rel-v0.3-plan step 5, RP3-14
  D2, D5, D9; decided by the approver): §4 the current element by the 0.2.2 derivation on every
  WingFoil version in v0.3, `workflow status` from v0.4, the phase figures read-only
  (`needs-version` below 0.3.0, `not-in-release` from it) — D2; §1 and §4a the `holds` key (per
  type and gate state, `approve: never | when-references-done`; *Approve* not offered, an
  informational line with the reason) — D5; §4
  pattern references shown by id only in v0.3 — D9. With them, to make C1 complete for
  implementation (step 5 survey; for the approver's OK on the step's draft): §4a *Reject* kept on
  a held gate and a held gate not a pending gate (this step's reading of D5); §1 the schema file named
  and what it holds, the semantic checks ordered, the safe subset of `taxonomy.patterns` against
  slow patterns; §2 the read source (working tree), "exists" defined, non-regular, oversized and
  aliased files ignored with a warning, where the warning travels; §3 `holds` empty when inferred;
  §5 the presets re-checked on WingFoil 0.3.1's `init` templates (`plan` without a category), the
  sw-life-cycle preset's `phases` (the packs' `sprint` phases, no removed procedure), `artifacts`
  phases and `holds`; the preset write against the rows of spec-004 §4, the codes
  `ui-config-exists` and `ui-config-invalid`, the success body, action log, auto-push and `write`
  event, the git failures; §6 their verification. Aligned the same day in the specs that own them: spec-001 §4
  (the `ui.yaml` read), spec-003 (the hold in the descriptor and its two reason codes), spec-004
  §3–§6 (the route's request schema, the two codes, the `write` event without `eid`), spec-006 §2
  (the action log), spec-010 §6 (auto-push after this write), REQ-ARC-07 (the `holds` key).
  Review round 1 (decided by the approver): §2 cites spec-001 §4.5; §4a a held gate is in
  *Waiting on others* for every member with the reason, never in *Requires you*, its footer keeping
  *Reject* for `approver` holders (F1); §5 the sw-life-cycle row matches `ux-reference.md` §6 (F6).
  Round 2 (P3): the English texts of the two reasons in §4a (the implementing task may refine the
  wording in the catalogue, spec-008).
