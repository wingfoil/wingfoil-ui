---
id: spec-005-ui-configuration-file-and-presets
type: tech-spec
title: "UI configuration file and presets"
status: pending
scope: ".wingfoil/ui.yaml schema, inferred defaults and UI presets"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2"   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
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

`contracts/files/ui-yaml.schema.json`; unknown keys are **errors** at every level (so
`permissions` is refused, REQ-ARC-07).

| Key | Type | Rule |
|-----|------|------|
| `version` | integer | required, `1` |
| `taxonomy.categories` | map type → category | category ∈ `work`, `defect`, `decision`, `spec`, `requirement`, `feature`, `release`, `external` |
| `taxonomy.patterns` | list of `{match, category}` | `match`: ECMAScript regular expression, ≤ 200 characters, compiles; `category` as above |
| `taxonomy.requires` | map type → list of categories | categories as above |
| `progress.mode` | `sequence` \| `flow` | `sequence`: progress follows the current element of `scope`; `flow`: no current element, figures are project-wide |
| `progress.scope` | `{type}` | a type only — never an id |
| `progress.phases` | list of strings | the phases shown in order (with WingFoil 0.3, matched to `workflow status`) |
| `progress.iterates` | type | the type counted as iterated work ("tasks 1/4") |
| `progress.defects` | type | the type counted as open defects |
| `artifacts` | list of `{path, phase}` | `path`: repository path or `https://` URL with `{version}`/`{release}` placeholders |

Semantic checks, against the project (after the schema): every type named in `categories`,
`requires`, `scope`, `iterates`, `defects` is declared in `memory.yaml` — otherwise "type `<t>` is not
declared in memory.yaml".

### 2. Loading

- No file → **inferred** values (§3); every value is shown "inferred".
- A file that is not YAML, fails the schema or a semantic check → it is **ignored as a whole**,
  inferred values are used, and a warning names the first failure
  ("ui.yaml ignored: progress.mode must be sequence or flow (found spiral)", C-04.1/C-04.2).
- A valid file → its values are "declared"; keys it omits fall back to inferred values, shown
  "inferred". The current element of `scope` is shown "derived".

### 3. Inferred values (no or ignored file)

The inference table lives in `server/presets/` with the presets — the only place where type names
may appear in code (REQ-ARC-05).


- `taxonomy.categories`: by type name — `task` → work, `bug` → defect, `adr` and `decision-log` →
  decision, `tech-spec` → spec, `release` and `release-line` → release, `service` → external; any
  other type has none ("No category — not counted in progress figures").
- `taxonomy.patterns`, `taxonomy.requires`, `artifacts`: empty.
- `progress`: `mode: flow`; `iterates` = the type with category `work` if exactly one, `defects` =
  the type with category `defect` if exactly one; no `scope`, no `phases`.

### 4. References and computations

- **Reference:** a string value (scalar or list item) of any frontmatter field other than `id`,
  `type`, `title`, `status`, `tags`, `rejection_reason`, which equals the id of another Memory
  element (its category is that element type's) or matches a `taxonomy.patterns` entry (that
  entry's category). An element is **linked** to each of its references.
- **Done:** an element of spec-003 kind `last` (the last non-archived state of its `sequence`);
  archived elements are excluded from every figure.
- **Current element** of `progress.scope` (mode `sequence`): with WingFoil 0.3 the element
  `workflow status` reports; before it, among the elements of that type not in the first state of
  their `sequence` nor of spec-003 kind `last` or `archived` (`end`), the one in the most advanced state, ties broken by the lowest
  `version` field, then id; none → "No current <type>" and project-wide figures (REQ-STATE-08).
- **In scope:** an element belongs to the current element when one of its frontmatter values
  equals the current element's id or its `version` field (e.g. a task's `release: v0.1` and the
  release `minor-v0.1` with `version: v0.1`); with no current element, every element is in scope.
- **Figures:** reference completion = done linked elements / linked elements, over the elements
  in scope; project completion = unweighted mean of the completion of `requirement` and `feature`
  references with ≥ 1 linked element in scope (Q8); iterated = done / all `iterates` elements in
  scope; open defects = `defects` elements not done
  (project-wide); pending gates = elements of kind `gate` (spec-003; `gate-waiting` excluded), project-wide;
  coverage = elements carrying every `requires` category / elements whose type has `requires`
  (project-wide).

The custom fixture with the sw-life-cycle preset must give exactly the figures of the BDD
conventions (project completion 25 %, tasks 1/4, open bugs 1, pending gates 3, coverage 3/5).

### 5. UI presets (`dl-003`)

Shipped in `server/presets/` (the only place where type names may appear in code, REQ-ARC-05):

| Preset | Made for | Content |
|--------|----------|---------|
| Kanban | `wingfoil init --template Kanban` | categories of the 7 template types (§3 names); `patterns: []`, `requires: {}`, `artifacts: []` (written explicitly, so every value shows "declared", C-02.1); `progress: {mode: flow, phases: [plan, build, review, deliver], iterates: task, defects: bug}` |
| Scrum | `wingfoil init --template Scrum` | as Kanban (empty lists and maps written explicitly), with `progress: {mode: sequence, scope: {type: release}, phases: [plan, build, review, deliver], iterates: task, defects: bug}` |
| WingFoil `sw-life-cycle` | the WingFoil repository and projects copying its configuration | `ux-reference.md` §6 with `scope: {type: release}`, patterns `^(REQ\|US)-` → requirement, `^(P\d\|Journey)` → feature, `^(minor\|patch)-v\|^rl-` → release, `requires` for `task`, `adr`, `tech-spec` → requirement, categories including `service` |

**Apply** (`POST /api/p/:pid/ui-config/preset`, spec-004): *Use preset* is **hidden** when
`.wingfoil/ui.yaml` exists (C-02.3) or the user is not identified in the team (C-02.5), and
**disabled with the reason** when the copy is behind, diverged or detached ("Blocked: your copy is
1 commit behind the remote — Update", C-02.4); the server enforces the same (spec-004 §4). The server
renders the preset, validates it against the schema **and** the semantic checks (refusal →
"ui.yaml not written: <first failure>", nothing written, C-03.1/C-03.2), writes the file, then runs
`git add -- .wingfoil/ui.yaml` and `git commit -m "chore(ui): apply the <Preset> preset" --
.wingfoil/ui.yaml` (other staged changes stay staged, C-02.2), under the write lock.

### 6. Verification

- Each shipped preset validates and passes the semantic checks on its own template's fixture;
  the sw-life-cycle preset is refused on the Kanban fixture (`service`).
- The schema rejects `permissions`, an unknown category, a regular expression that does not
  compile, and `scope.id`.
- The figures of §4 on the custom fixture with the preset equal the conventions' numbers.
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
