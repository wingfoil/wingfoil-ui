---
id: spec-001-cli-and-file-read-contracts
type: tech-spec
title: "CLI and file read contracts"
status: approved
scope: "CLI JSON contract and direct-read file shapes (WingFoil 0.2.2)"  # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2"   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

The server reads and writes every WingFoil project through the project's own CLI (`adr-001` D1),
and reads directly, from a closed allow-list, what WingFoil 0.2.2 does not expose (`adr-001` D1a,
REQ-ARC-04). Both are an API the UI depends on: this spec fixes **which commands and files are
consumed, how they are invoked, and the shapes they return**, so that `contracts/` can hold one
JSON Schema per shape and a contract test per supported version (`adr-001` D4, REQ-INT-01).

Every shape below was captured on 2026-10-02 from **WingFoil 0.2.2** — this repository and a
throwaway `wingfoil init --template Kanban` fixture with one member, a task taken through
add → submit → reject → submit → approve, and a bug added and deprecated. The schemas in
`contracts/` are written from real outputs of that kind, never from memory.

## Specification

### 1. Invocation

- `execFile(process.execPath, [<cli bin script>, '--format', 'json', <command…>, <args…>])`, working
  directory = project root, argument array, no shell (`adr-001` D2, REQ-SEC-05), timeout 30 s
  (REQ-INT-04). The global `--format json` is placed before the command.
- User input (titles, reasons, ids) is always one argument of its own; values never start with
  `-` unless the CLI option expects it (`--reason=<text>` form when the text starts with `-`).
- Writes are serialised per project (`adr-001` D5).

### 2. Result classification

| Exit | stdout | stderr | The server reports |
|------|--------|--------|--------------------|
| 0 | JSON, validated against the command's schema | free text: warnings (e.g. `unknown field(s) ignored`, W-12) | the data; stderr lines as project **warnings** (diagnostics), never as errors |
| 0 | JSON failing the schema | — | **read error** "unexpected output of `<command>`" — never guessed at |
| 1 | empty | JSON `{"error": "<message>"}` | **refusal**: the CLI's message verbatim (red toast, REQ-INT-04) |
| 2 | empty | plain text (`error: unknown option …`) | **internal error**: a defect of the adapter; logged with the command line (token-free) |
| other / timeout / killed | — | — | **process error** with the reason (timeout: "WingFoil did not answer within 30 s") |

### 3. Consumed commands

Only these commands are invoked (static list of the CLI adapter). `[]` = optional.

| Command | Used by | Since | Output (exit 0) |
|---------|---------|-------|-----------------|
| `--version` | S3, `adr-001` D3 | v0.1 | **plain text** (not JSON, even with `--format json`): one line, a semantic version, e.g. `0.2.2` |
| `dna show` | S4, R1, R3, C2, T1 | v0.1 | the whole `dna.yaml`: `version` (positive number), `project {name?, description?, methodology?}?`, `modules[]`, `stacks {technologies[]?, methodologies[]?}`, `team {members[{name, email?, roles[]}], roles[{name, description?}], agents[{name, executes_as[], approval_authority?}]?}`, `paths {<category>: string[]}` |
| `paths` | R4, R8 | v0.1 | `{<category>: string[]}` — same as `dna.paths` |
| `directives list` | R2, G1 | v0.1 | `{entries[{path, frontmatter{id, name, type, kind, title, tags[]?, ref[]?}, roles[], global, assignment}], warnings[]}` — `path` is relative to `.wingfoil/`; **no body** |
| `workflow list` | W1, W2, G5, S9 | v0.1 | `{manifest{version?, include[]}, workflows[{name, kind, description?, version?, element?, phases[{name, description?, role?, optional, actions[]?, produces[]?, checks{pre[]?, post[]?}?, approval{by_role}?, fallback{step}?, include?, iterate_over?, where?}]}]}` |
| `memory search` | M1, T1, T4, S5, R5 | v0.1 | `{query, matches[{path, id, title, type, status, tags[]}], message?}` — **excludes archived elements** (`deprecated`, `superseded` — WingFoil's archived set) (W-19); `message` present when `matches` is empty |
| `memory search --status deprecated`, `memory search --status superseded` | M1 (state filter), G1 links | v0.1 | same shape; the only way to list archived elements — called **lazily**, when a view needs archived elements (never for Today) |
| `memory history <id>` | G1 | v0.1 | `{id, path, entries[{sha, author, timestamp, operation, from, to, approver, reason, subject}]}` — `operation` ∈ `add`, `submit`, `approve`, `reject`, `deprecate`, or `null` for a non-`wf` commit touching the file; `from`/`to` set for every operation (submit included); `author` = `Name <email>`; `approver` = `Name <email> (role)` |
| `memory submit <id>` | G3 | v0.2 | `{id, path, from, to}` |
| `memory approve <id> --reason <text>` | G2 | v0.2 | `{id, path, from, to}` |
| `memory reject <id> --reason <text>` | G2 | v0.2 | `{id, path, from, to, reason}` — the target is the gate's single `reject:` state; the reason is also written to the element as `rejection_reason` |
| `memory add --type <type> --title <title> [--set <k>=<v>…]` | G5 (decision-log ingestion) | v0.3 | `{id, path}` |

`memory search` is called **without filters** (plus, lazily, the two archived calls): views filter the
result, so one process per repository state serves them all (REQ-PERF-05). WingFoil 0.3 verbs
(`workflow status/next/start`, `agent execute`, REQ-INT-07) are added to this table, with their
captured shapes, by v0.4 `release-planning`.

Known refusal messages (exit 1), shown verbatim: `document not found: <id>`, `illegal transition
<from> -> (none) for type '<type>'`; gate refusals for a missing role (W-13).

### 4. Direct reads (allow-list, `adr-001` D1a)

Read-only; any other WingFoil file is out of bounds (REQ-ARC-04 fit criterion).

**4.1 `.wingfoil/memory.yaml`** — only these keys are read; others are ignored:

| Key | Shape | Used for |
|-----|-------|----------|
| `version` | positive number | contract selection |
| `defaults.states` | `{sequence[], gates{<state>: {reject: <state>}}, waiting[]?}` | types without `states` |
| `types.<type>.path` | string with `{id}` and path tokens | Memory directories (`spec-002`), element type of a path |
| `types.<type>.id_pattern` | string with `{n}`, `{slug}` and other tokens (optional) | id rendering, ingestion form |
| `types.<type>.name`, `.description`, `.tags` | strings / string[] (optional) | labels |
| `types.<type>.template.frontmatter.required` | string[] | M2, G5 (REQ-INT-05) |
| `types.<type>.states` | as `defaults.states` (optional) | action descriptor (S9) |

Resolution rule (as WingFoil 0.2.2's `resolveStateMachine`): a type's states are
`types.<type>.states` when present, otherwise `defaults.states`, otherwise WingFoil's built-in
machine `{sequence: [draft, pending, approved], gates: {pending: {reject: draft}}}` — each taken as
a whole (no key-by-key merge). A type's **declared states** are its `sequence`, every
`gates.<state>.reject` target (which may lie outside `sequence`) and the implicit `deprecated`. The contract test checks the rule
against the CLI: on each fixture, every `memory submit` / `approve` / `reject` transition reported
by the CLI must be one the resolved states allow.

**4.2 Memory element files** — only at a `path` returned by `memory search`:
a YAML frontmatter between the first two `---` lines (delimiters as WingFoil's `^---\r?\n…\r?\n---`: CRLF files are read as LF), then a Markdown body. YAML merge keys (`<<`) are resolved, as WingFoil's parser does.
`id`, `type`, `title`, `status` are always present; every other field is type-specific and shown
as read. Trailing `# …` comments in the frontmatter are ignored. Consistency: the file's `id`,
`type` and `status` must equal the `memory search` match; otherwise the element shows a read
error (REQ-ARC-04).

**4.3 Directive files** — only at `.wingfoil/<path>` for a `path` returned by `directives list`:
frontmatter (as in `directives list`) and a Markdown body, rendered in R2.

**4.4 Exception — hash-only reads for the repository state key** (REQ-STATE-02, spec-004 §5): the
server reads each changed and untracked entry listed by `git status --porcelain` only to hash it
— SHA-256 of the content up to 1 MiB, size and modification time beyond that (or beyond the first
1 000 entries), the target of a symbolic link (never followed), or "missing". The content is
neither kept nor exposed; only the combined hash enters the state key. No other use of these
reads is allowed.

### 5. `contracts/` layout

```
contracts/
  cli/<command>.schema.json          # one per row of §3, e.g. memory-search.schema.json
  files/memory-yaml.schema.json      # §4.1 subset
  files/element.schema.json          # §4.2 frontmatter
  files/directive.schema.json        # §4.3 frontmatter
  capabilities.json                  # capability → minimum WingFoil version, conditions (REQ-INT-03)
  capabilities.schema.json           # shape of capabilities.json (§6)
  matrix.json                        # supported WingFoil versions and range minimum (adr-001 D3/D4)
```

Each schema records the WingFoil version it was captured from (`$comment: "wingfoil 0.2.2"`); a
shape that changes in a later version gets a versioned variant, selected by the detected version.
Schemas accept unknown additional properties (a newer CLI may add fields) but require every field
the UI reads.

### 6. Capabilities at 0.2.2 (initial `capabilities.json`)

| Capability | 0.2.2 source | Replaced by |
|------------|--------------|-------------|
| Type definitions | direct read §4.1 | a CLI read verb, when WingFoil adds one |
| Element content | direct read §4.2 | `memory show` (or equivalent), when WingFoil adds one |
| Directive body | direct read §4.3 | `directives show` (or equivalent) |
| Gate decision | `memory approve/reject` | — |
| Workflow position | — (read-only, "needs WingFoil 0.3") | `workflow status` (REQ-INT-07) |
| Next workflow step | — (read-only, "needs WingFoil 0.3") | `workflow next` (REQ-INT-07) |
| Workflow start | — (read-only, "needs WingFoil 0.3") | `workflow start` (REQ-INT-07) |
| Agent launch | — | `agent execute` (0.3+) |
| Field editing | — (read-only, not released) | WingFoil task-127 / task-163 |

**Format (addendum, dev-loop task-006).** `capabilities.json` is `{ capabilities: [...] }`,
validated by `contracts/capabilities.schema.json`; each row is `{ id, name, minVersion, via,
replacedBy?, conditions[] }` — `minVersion` a semantic version or `null`, `via` the 0.2.2 source
(or `null`), `conditions` the project-condition ids that must all hold for the capability to
apply (otherwise it is hidden; none in v0.1). The ids of the table above are `type-definitions`,
`element-content`, `directive-body`, `gate-decision` (`minVersion` `0.2.2`), `workflow-position`,
`workflow-next-step`, `workflow-start` (the former "Workflow position, next step, start" row,
split in three; S-08.3 names "Next workflow step" alone), `agent-launch` (`minVersion` `0.3.0`)
and `field-editing` (`null`). `minVersion` is required on every row: **`null` means the
capability is in no released WingFoil version** (`field-editing` today); it is always read-only
or hidden according to its rule, with reason `not-released` (REQ-INT-03: `null` counts as a
declared minimum).

### 7. Contract tests

For every version in `matrix.json`: build the fixtures with that version's CLI (`e2e-smoke`
fixture builder), run every command of §3 and every reader of §4, validate each output against
its schema, and run the §4.1 resolution check. A failure blocks the matrix advance in
`release-planning`.

## Consequences

- One reviewed list of what the UI depends on; a WingFoil change that breaks a shape fails a
  contract test before any user sees it.
- `memory search` hides archived elements (`deprecated`, `superseded`): they are fetched lazily by
  two more calls when a view needs them; a cold Today needs `--version`, `dna show` and one
  `memory search` — within REQ-PERF-05's budget of 6.
- The direct reads re-implement a small part of WingFoil's parsing (§4.1 resolution, §4.2
  frontmatter); bounded by schemas, the `status` cross-check and §7, and dropped when WingFoil
  provides read verbs.

## Process Notes

- 2026-10-02 — drafted in initial-design session 5a from outputs captured on WingFoil 0.2.2; the
  capture found the missing read verbs (→ REQ-ARC-04 v0.4, `adr-001` D1a) and `memory search`
  excluding archived elements (→ directive `wingfoil-cli` W-19). Session 5b: the archived set
  (`deprecated`, `superseded`) and the built-in default machine read from WingFoil 0.2.2's
  `memory/state-machine.js` and checked on a fixture. Submitted after the
  independent spec review (plan step 6).
- 2026-10-02 — spec review (step 6): F3 `version?` in `workflow list` (absent in Kanban/Scrum
  template workflows, checked by the reviewer); F12 archived calls aligned.
- 2026-10-05 — errata from dev-loop task-005 (independent review), decided by the user: the
  §3 shapes and the §4 fields follow WingFoil 0.2.2's own schemas (`dist/dna/schema.js`,
  `dist/workflow/schema.js`, `dist/memory/schema.js`, the directive schema), not only the captured
  samples — `directives list` `tags[]?`; `dna show` `project?` and its fields, member `email?`,
  `technologies[]?`/`methodologies[]?`, agent `approval_authority?`, `version` a positive number;
  `workflow list` `manifest.version?`, `description?`; `memory.yaml` `id_pattern?`, `version`
  a positive number; §4.2 frontmatter delimiters `\r?\n` and merge keys. "Required" in this spec
  means required by WingFoil's schema and read by the UI.
- 2026-10-06 — amended in dev-loop task-006 (Wave 2, plan dev-loop-rel-v0.1-plan): §5 lists
  `capabilities.schema.json`; §6 format addendum (row shape `{id, name, minVersion, via,
  replacedBy?, conditions[]}`, ids), the "Workflow position, next step, start" row split into
  `workflow-position`, `workflow-next-step`, `workflow-start`, and `minVersion: null` = in no
  released WingFoil version (always read-only or hidden, reason `not-released`); decided by the
  user.
- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): §4.4
  exception to the direct-read allow-list — hash-only reads of changed and untracked entries for
  the repository state key (REQ-STATE-02); content is neither kept nor exposed; decided by the
  user as part of #18.
