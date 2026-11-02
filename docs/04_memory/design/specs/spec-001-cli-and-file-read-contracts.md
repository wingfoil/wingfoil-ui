---
id: spec-001-cli-and-file-read-contracts
type: tech-spec
title: "CLI and file read contracts"
status: approved
scope: "CLI JSON contract and direct-read file shapes (WingFoil 0.2.2, 0.3.1)"  # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2, 0.3.1"   # optional — for a CLI contract: the WingFoil version the shape was captured from
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
`contracts/` are written from real outputs of that kind, never from memory. The WingFoil 0.3.x shapes (the `--version`
stamp, `workflow list`) were captured on 2026-10-28 from **WingFoil 0.3.1** on the same fixtures
(task-046).

## Specification

### 1. Invocation

- `execFile(process.execPath, [<cli bin script>, '--format', 'json', <command…>, <args…>])`, working
  directory = project root, argument array, no shell (`adr-001` D2, REQ-SEC-05), timeout 30 s
  (REQ-INT-04). The global `--format json` is placed before the command.
- The CLI's environment is the server's with `GIT_OPTIONAL_LOCKS=0` (task-046 D46-5): a read leaves
  `.git/index` as it was — WingFoil 0.3's reads run `git status`, which would rewrite a stale index
  (task-025 AC-5); commits take required locks and are unaffected. Any other spelling of the name is
  removed first (case-insensitive on Windows).
- Every git the CLI runs gets `core.fsmonitor=false` (task-046 D46-6, spec-010 §6 W4-5),
  `protocol.allow=never` (D46-7) and `log.showSignature=false` (review round 5: 0.2.2's `memory
  history` would run a configured `gpg.program`): the runner adds them as `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_<n>`/
  `GIT_CONFIG_VALUE_<n>` after dropping the inherited `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>`,
  `GIT_CONFIG_VALUE_<n>` and `GIT_CONFIG_PARAMETERS` (`GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM`
  are kept: they choose the global configuration), for reads and writes alike. Its environment
  also carries `GIT_ALLOW_PROTOCOL=none` (any inherited spelling replaced) and `GIT_NO_LAZY_FETCH=1`:
  `GIT_ALLOW_PROTOCOL` is what git applies before every `protocol.allow` and `protocol.<name>.allow`
  setting of any scope — the repository's own `.git/config` included (review round 3 M1) — so no
  transport starts, whatever git's version; `protocol.allow=never` and `GIT_NO_LAZY_FETCH=1` (honoured
  from git 2.45.1 and some backports) are extra layers. So a repository's fsmonitor program never runs
  on a console read (WingFoil 0.3's `workflow list` runs `git status` on every `GET /config`), nor
  does a promisor remote's `uploadpack`, `ext::` command or `core.sshCommand` on a lazy fetch. No
  CLI verb the server runs fetches or pushes (`GIT_TRACE` of every consumed command on 0.2.2 and
  0.3.1: `add`, `commit`, `config`, `diff`, `log`, `maintenance`, `rev-parse`, `show`, and on 0.3.1
  `cat-file`, `for-each-ref`, `hash-object`, `ls-files`, `ls-tree`, `status`). What the tests show
  (`test/server/cli/adapter.test.ts`, *D46-7*): no promisor program runs on the CLI's reads of a
  partial clone. Expected, not tested: a hook of the user's that a WingFoil write's commit runs
  inherits the same variables, so its own git transport is refused unless the hook changes them; a
  CLI read that needs an object a partial clone has not fetched fails instead of fetching it.
- The environment of every process the process runner starts — the CLI, git, and what they start —
  has the absolute `PATH` entries only (task-046 D46-8): an empty or relative entry would be resolved
  in the working directory, the project, where WingFoil runs a bare `git` (0.3.1: every read; 0.2.2:
  `memory history`), so a program the repository ships would run. The launcher's browser opener
  (`launcher/opener.ts`) starts outside the runner, with the inherited `PATH` and not in the project.
  Declared residuals (review round 5): on Windows, Node looks a bare command up in the working
  directory first whatever `PATH` holds, so the project's own `git.exe` could still run there; a
  relative path in another variable of the server's environment (`NODE_OPTIONS`, `NODE_PATH`,
  `XDG_CONFIG_HOME`, `GIT_ASKPASS`, `GIT_PAGER`, `EDITOR`, …) resolves in the project, as it would for
  git or WingFoil started there from a terminal; started through `npx` or `npm run`, the server's
  `PATH` begins with absolute `node_modules/.bin` folders (adr-001 trusts `node_modules`); a freshly
  cloned project runs its committed `node_modules/wingfoil` on its first open (adr-001 D2: the
  project's own CLI first), never at clone time.
- User input (titles, reasons, ids) is always one argument of its own; values never start with
  `-` unless the CLI option expects it (`--reason=<text>` form when the text starts with `-`).
- Writes are serialised per project (`adr-001` D5).

### 2. Result classification

| Exit | stdout | stderr | The server reports |
|------|--------|--------|--------------------|
| 0 | JSON, validated against the command's schema | free text: warnings (e.g. `unknown field(s) ignored`, W-12); WingFoil 0.3 writes one JSON line `{"warning": "<text>"}` per warning | the data; stderr lines (the `warning` text of a 0.3 line) as project **warnings** (diagnostics), never as errors — at most 200, then one line `<n> more warnings omitted` |
| 0 | JSON failing the schema | — | **read error** "unexpected output of `<command>`" — never guessed at |
| 1 | empty | JSON `{"error": "<message>"}` (on 0.3 possibly after JSON warning lines) | **refusal**: the `error` of the whole text or of its last line only, otherwise the text as written (red toast, REQ-INT-04) |
| 2 | empty | 0.2.2: plain text (`error: unknown option …`) or, for a missing argument, JSON (W-22); 0.3.x: JSON `{"error": "unknown option '--bogus'"}` | **internal error**: a defect of the adapter; logged with the command line (token-free) and the message's kind only |
| other / timeout / killed | — | — | **process error** with the reason (timeout: "WingFoil did not answer within 30 s") |

### 3. Consumed commands

Only these commands are invoked (static list of the CLI adapter). `[]` = optional.

| Command | Used by | Since | Output (exit 0) |
|---------|---------|-------|-----------------|
| `--version` | S3, `adr-001` D3 | v0.1 | **plain text** (not JSON, even with `--format json`): one line, a semantic version, e.g. `0.2.2`; from WingFoil 0.3 followed by the build stamp ` (<commit>)` — 7–64 lowercase hex digits or `unknown` — e.g. `0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`; any other text is unrecognised |
| `dna show` | S4, R1, R3, C2, T1 | v0.1 | the whole `dna.yaml`: `version` (positive number), `project {name?, description?, methodology?}?`, `modules[]`, `stacks {technologies[]?, methodologies[]?}`, `team {members[{name, email?, roles[]}], roles[{name, description?}], agents[{name, executes_as[], approval_authority?}]?}`, `paths {<category>: string[]}` |
| `paths` | R4, R8 | v0.1 | `{<category>: string[]}` — same as `dna.paths` |
| `directives list` | R2, G1 | v0.1 | `{entries[{path, frontmatter{id, name, type, kind, title, tags[]?, ref[]?}, roles[], global, assignment}], warnings[]}` — `path` is relative to `.wingfoil/`; **no body**; `warnings` is tool text: the server passes on at most 200, sanitised like the `stderr` warnings, then one line counting the rest (task-046) |
| `workflow list` | W1, W2, G5, S9 | v0.1 | 0.2.x: `{manifest{version?, include[]}, workflows[{name, kind, description?, version?, element?, phases[{name, description?, role?, optional, actions[]?, produces[]?, checks{pre[]?, post[]?}?, approval{by_role}?, fallback{step}?, include?, iterate_over?, where?}]}]}`. 0.3.x: `{baseline{rev: "HEAD", commit}, workflows[{name, startable, includable, description (string or null), executableNow}], message?, diagnostics[{code, severity, file, path, message}]}` — the workflows executable now, as committed at HEAD, without phases; `diagnostics` sanitised by the server like the `stderr` warnings, at most 200 passed on, the rest counted in `diagnosticsOmitted` (added by the server) |
| `memory search` | M1, T1, T4, S5, R5 | v0.1 | `{query, matches[{path, id, title, type, status, tags[]}], message?}` — **excludes archived elements** (`deprecated`, `superseded` — WingFoil's archived set) (W-19); `message` present when `matches` is empty |
| `memory search --status deprecated`, `memory search --status superseded` | M1 (state filter), G1 links | v0.1 | same shape; the only way to list archived elements — called **lazily**, when a view needs archived elements (never for Today) |
| `memory history <id>` | G1 | v0.1 | `{id, path, entries[{sha, author, timestamp, operation, from, to, approver, reason, subject}]}` — 0.2.x: `operation` ∈ `add`, `submit`, `approve`, `reject`, `deprecate`, or `null` for any other commit touching the file. 0.3.x: each entry also carries `wingfoil` (the commit's `WingFoil-Version:` trailer, or `null`), and `operation` ∈ those five, `start`, `finalize`, `sync`, `amend`, `park`, `assign`, or `null` for a subject outside them (a verbless hand transition, `start-fix`, a plain subject); a phase plan closed by hand (W-04) is `finalize`. The schema has one entry definition per version line, told apart by `wingfoil`; the server passes on the entry's fields above only (task-048). `from`/`to` set for every operation (submit included); `author` = `Name <email>`; `approver` = `Name <email> (role)` |
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

`matrix.json` is `{ min, pinned, versions }`: `min` the declared lowest supported version (the
range's lower bound, adr-001 D3), `pinned` the version the repository's own fixtures and samples
use, `versions` every WingFoil version the contract tests run against (the highest gives the
range's caret line).

Each schema records the WingFoil version it was captured from (`$comment: "wingfoil 0.2.2"`); a
shape that changes in a later version gets a versioned variant: a branch of the command's schema
per version line (`definitions` `v0.2`, `v0.3`, … under a top-level `oneOf`), the branches written
to exclude each other, so that an output matches exactly one — selected by its shape, not by the
detected version (an out-of-range or unrecognised project still reads its configuration). The
contract tests check that each matrix version matches its own branch.
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
`element-content`, `directive-body`, `gate-decision` (`minVersion` `0.2.2`); `workflow-position`,
`workflow-next-step`, `workflow-start` (the former "Workflow position, next step, start" row,
split in three; S-08.3 names "Next workflow step" alone) and `agent-launch` (`minVersion`
`0.3.0`); `field-editing` (`null`). `minVersion` is required on every row: **`null` means the
capability is in no released WingFoil version** (`field-editing` today); it is always read-only
or hidden according to its rule, with reason `not-released` (REQ-INT-03: `null` counts as a
declared minimum). **`via: null` means this release has no source for the capability** (it does
not use it yet): it is never enabled and never listed as missing; below its `minVersion` it is
read-only `needs-version`, at or above it read-only with the reason `not-in-release` (amendment
of task-046: the workflow capabilities and the agent launch of WingFoil 0.3.0, used from v0.4).

**Project conditions (v0.2, RP-11).** A condition id names a fact of the project the server
evaluates per repository state and passes to the capability evaluation; the ids that hold are
listed in `conditions` of `GET /api/p/:pid` (spec-004 §3). Ids:

| Id | Holds when | Since |
|----|------------|-------|
| `has-remote` | `git remote` lists at least one remote (spec-010 §7) | v0.2 |

No row of the table above uses a condition in v0.2: git sync is not a WingFoil capability, and
its controls follow `has-remote` directly (spec-010 §7). A new id is added to this table with the
spec that evaluates it.

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
  user. Audit follow-up of the Wave 2 amendments: §6 `minVersion` per id made unambiguous; §5
  names the `min`, `pinned`, `versions` keys of `matrix.json`.
- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): §4.4
  exception to the direct-read allow-list — hash-only reads of changed and untracked entries for
  the repository state key (REQ-STATE-02); content is neither kept nor exposed; decided by the
  user as part of #18.
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-10, RP-11): §6 project
  condition ids (`has-remote`, evaluated by spec-010 §7) and their exposure in `GET /api/p/:pid`;
  no capability row changes. Decided by the approver at checkpoint 2.
- 2026-10-28 — amended in dev-loop task-046 (`governance-alignment-rel-v0.3-plan` step 2b, GA3-9;
  decisions D46-2, D46-3 by the approver): §3 `--version` with WingFoil 0.3's build stamp and the
  `workflow list` shape of 0.3.x (captured from `wingfoil@0.3.1`); §5 the versioned variant is a
  `oneOf` branch of the command's schema, exclusive, selected by shape; §6 `via: null` = not used by
  this release (never enabled, never missing, reason `not-in-release` from its minimum version);
  §2 a 0.3 `stderr` warning is the `warning` text of its JSON line; §1 every WingFoil process runs
  with `GIT_OPTIONAL_LOCKS=0` (D46-5, see the next entry). The support matrix is now [0.2.2, 0.3.1],
  pinned 0.3.1.
- 2026-10-29 — amended in dev-loop task-046 (approver, after the step's open point and review round
  1): §1 every WingFoil process runs with `GIT_OPTIONAL_LOCKS=0` (D46-5: 0.3.1's `workflow list`
  rewrote a stale `.git/index`) and every git it runs with `core.fsmonitor=false` (D46-6, review M1: a
  configured fsmonitor ran on a console read); §2 exit 2 is JSON on 0.3.x (review c1), a refusal's
  `error` is read from the last JSON line that has one, at most 200 warnings; §3 at most 200
  `workflow list` diagnostics, `diagnosticsOmitted` (review m1); `scope` and `wingfoil_version` name
  0.2.2 and 0.3.1. Review round 2 (M2): §1 `protocol.allow=never` and `GIT_NO_LAZY_FETCH=1` for every
  git the CLI runs (D46-7); the dropped variables named; §2 the CLI's error is its whole text or its
  last line (n5, n6); `diagnosticsOmitted` is never taken from the CLI (n4); §3 the `warnings` of
  `directives list` sanitised and capped like the `stderr` warnings (d1).
- 2026-10-29 — amended in dev-loop task-046 review round 3 (M1, c7; decided by the approver): §1 the
  CLI's environment carries `GIT_ALLOW_PROTOCOL=none`, which also overrides the repository's
  `protocol.<name>.allow` and an inherited allowed list (D46-7 was bypassed by them on a git that
  ignores `GIT_NO_LAZY_FETCH`); §2 the exit-1 row states the last-line rule of round 2.
- 2026-10-29 — amended in dev-loop task-046 review round 4 (MAJOR-2, n-d; decided by the approver):
  §1 every child of the server gets the absolute `PATH` entries only (D46-8); a user hook a WingFoil
  commit runs can use no transport; a CLI read on a partial clone does not fetch a missing object.
- 2026-10-29 — amended in dev-loop task-046 review round 5 (decided by the approver): §1
  `log.showSignature=false` for every WingFoil process (s-minor-1); what the D46-7 tests show and what
  is expected (c-minor-1); "every process the process runner starts", the opener named (c-minor-2);
  the residuals of D46-8 — Windows' working-directory lookup, relative paths in other variables,
  `npx`/`npm run`, a clone's first open (s-nit-1 … 3, c-nit-3).
- 2026-11-02 — amended in dev-loop task-048 (bug-026, D48-1 and D48-8 approved by the approver): §3
  the `memory history` row gives 0.3.x's eleven operations and its `wingfoil` field; the schema's
  entry has one definition per version line (§5's variant by shape, per entry, so that an empty
  history validates); the API passes on the contract's fields only.
