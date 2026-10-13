---
id: spec-003-action-descriptor
type: tech-spec
title: "Action descriptor"
status: approved
scope: "action descriptor: verbs, actor and tone per element"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2"   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Every screen that offers or explains an action — Requires you (T1), Waiting on others (T4), the
all-roles summary (S5), the element panel and its footers (G1–G3), the bell (S7), traceability
(R5) — asks the same question: *for this element, now, what can be done, by whom?* The answer must
come from the project's own definitions, never from type or state names in the UI code
(REQ-ARC-05, REQ-ARC-06), and must match what the CLI accepts.

The verb rules are WingFoil 0.2.2's own (`memory/state-machine.js`, `resolveTransitionTarget`):
`submit` from a state in `sequence` that is neither a gate nor waiting and has a next state;
`approve` from a gate not also waiting; `reject` from any gate, to its `reject` target; `deprecate`
from anywhere (not offered by the UI in the MVP). The actor rules were fixed by the scenarios (`02_bdd/00_conventions.md`, *Identity and roles in steps*;
`features/s/action-descriptor.feature`, `features/t/requires-you.feature`,
`features/t/waiting-on-others.feature`, `features/g/gate-footer.feature`). This spec makes the
derivation exact.

## Specification

### 1. Inputs

| Input | Source |
|-------|--------|
| Resolved states per type (`sequence`, `gates{state: {reject}}`, `waiting[]`) | `memory.yaml`, spec-001 §4.1 |
| Elements (`id`, `type`, `status`) | `memory search`, spec-001 §3 (archived elements, fetched lazily, are final) |
| Events per element (creator, last transition, last reject, submitters) | spec-002 §3 (project-wide parse) |
| Team (`members[{name, email, roles}]`, `agents`) | `dna show` |
| Current user and role view | REQ-STATE-05, STATE-06 |
| WingFoil version and capabilities | `adr-001` D3, `contracts/capabilities.json` |
| Local changes, copy behind/diverged/detached | REQ-STATE-01…04 |

### 2. State kind

For an element of type `T` in state `s`, with `seq = states(T).sequence` and `end` = the last state
of `seq` that is not archived (`deprecated`, `superseded` — WingFoil's archived set; e.g. `accepted`
for custom `adr`, whose `seq` ends with `superseded`):

| Kind | Condition (first match wins) |
|------|------------------------------|
| `archived` | `s ∈ {deprecated, superseded}` (WingFoil's archived set) |
| `off-sequence` | `s ∉ seq` but `s` is a `gates.<g>.reject` target (declared, outside the sequence) |
| `undeclared` | `s ∉ seq` otherwise |
| `last` | `s = end` — final even when also listed in `waiting` (its only forward edge leads into the archived set) |
| `gate-waiting` | `s ∈ gates` and `s ∈ waiting` |
| `gate` | `s ∈ gates` |
| `waiting` | `s ∈ waiting` |
| `first` | `s = seq[0]` |
| `work` | otherwise (an intermediate state that is neither gate nor waiting) |

### 3. Verbs per kind (WingFoil 0.2.2)

| Kind | Verbs offered | Role required (0.2.2) |
|------|---------------|-----------------------|
| `first`, `work` | `submit` → next state of `seq` | none (any identified team member) |
| `gate` | `approve` → next state of `seq`; `reject` → `gates[s].reject` | `approver` for both (W-13) |
| `gate-waiting` | `reject` → `gates[s].reject` only; the advance is the workflow engine's | `approver` |
| `waiting` | none — "Waiting for the workflow engine (state: `s`)" | — |
| `last`, `off-sequence`, `archived` | none — final (WingFoil allows no verb but `deprecate` from them); exception: a `last` state that is also a gate offers its `reject` (WingFoil accepts it) | `approver` for that `reject` |
| `undeclared` | none — *Open* only; "Action required — state `s` is not declared for `T`" | — |

With WingFoil 0.3 (v0.4) the engine verbs (`workflow start/next`) are added from the capability
table; this table does not change.

### 4. Actor — who must act

| Kind | Actor |
|------|-------|
| `first`, `work` — last event is a `reject` | the **member who made the submit that was rejected** (author of the last `submit` before it), with the reject's `reason` and approver; listed **first** in their Requires you |
| `first` — otherwise | the **creator** (author of the `add` event) |
| `work` — otherwise | the author of the last transition into `s` |
| `gate` | the role `approver` (members holding it) |
| `waiting`, `gate-waiting` | the workflow engine (no member) — "Waiting for the workflow engine"; for `gate-waiting` the `reject` verb stays reserved to `approver` (its `role`, §3), as SARD REQ-ARC-06 |
| `undeclared` | the role `tech-lead` |
| `last`, `off-sequence`, `archived` | no one |

A member is matched by the email of the event's author against `dna.team.members[].email`. When
the author is not a member (or the history has no event), the actor falls back to the role
`tech-lead` with "Author not in the team" (output: `actor.fallback: "author-not-in-team"`).

### 5. Placement in the role views

For the current user `U` with role view `R`:

- **Requires you** of view `R` lists an element when:
  - the actor is `U` (member actor) — in **every** role view of `U`; or
  - the kind is `gate` and `U` holds `approver` and `R ∈ {reviewer, approver}` — action *Review*
    in the `reviewer` view, *Approve* in the `approver` view; or
  - the kind is `undeclared` and `R = tech-lead`; or
  - the actor is the `tech-lead` **fallback** of §4 (author not in the team, or no event) and
    `R = tech-lead` — otherwise such an element would be in no list of a tech-lead.
- **Waiting on others** of `U` lists an element whose actor is another member or a role `U` does
  not hold, with who can act ("Reserved to approver — Morgan, Alex"); `waiting` and
  `gate-waiting` elements show "Waiting for the workflow engine".
- `gate-waiting` elements are **not** pending gates: not in Requires you, not counted in *Pending
  gates*; members holding `approver` see their reject outcome in the gate footer (the `reject` is
  offered to `approver` holders only).
- Order in Requires you: rejected work first, then by time in the current state, oldest first.
- **Hand transitions (v0.2 limitation, RP-13).** A state that WingFoil 0.2.2 leaves only by a
  hand-edited commit (directive `wingfoil-cli` W-04, W-20, W-25, W-26 — in this repository e.g.
  `plan` `active`, `task` `backlog`, `release` `planning`, `bug` `triaged`) is declared `waiting`
  (kind `waiting` or `gate-waiting`): the UI shows "Waiting for the workflow engine" there and
  never makes those commits (REQ-ARC-03); spec-002 is not extended for them.

**Today output (v0.2, `GET /api/p/:pid/today?view=<role>`, `contracts/api/today.schema.json`).**

```
{ view: string | null,                          # the role view used; null when not identified
  requiresYou: [Row & { action }] | null,       # null when the user is not identified (T-01.2)
  waitingOnOthers: [Row],
  summary?: [{ role, count, items: [Row & { action }], more }] }
Row = { element: { id, type, title, status, localChanges }, descriptor }   # descriptor: §8
```

- `requiresYou` lists the elements placed in Requires you of `view`, in the order above; `action`
  is `submit`, `rework`, `review`, `approve` or `resolve` (`undeclared`). The row's button label
  (web catalogue): `submit` and `rework` → "Submit" (T-03.1; a `rework` row also shows the
  rejection), `review` → "Review" (T-04.1), `approve` → "Approve" (T-02.1), `resolve` → "Open"
  (T-05.1: the element panel opens, no verb is run). Its length is the
  greeting's count and the bell's *To unblock* count (S-21.1, T-01.1); the bell's *To unblock*
  list is the same rows.
- `waitingOnOthers` lists the elements placed in Waiting on others of the user, an element of
  `requiresYou` excluded (T-11.3), in the order of Requires you (rejected first, then by time in
  the current state, oldest first, then by id). For a user not identified in the team (identity
  kinds `not-in-team`, `no-identity`, `ambiguous`), `view` and `requiresYou` are `null` and
  `waitingOnOthers` is computed as for a member holding no role; there is no `summary`; any
  `?view=` is refused (400 `invalid-request`: there is no role view to choose). A member whose
  DNA entry holds no role has no role view: `view` is `null`, `requiresYou` lists the elements
  whose member actor is them (an array: they are identified), and there is no `summary`.
- No partial Today: when one of its inputs cannot be read, the route answers that read's refusal
  (spec-004 §5) instead of lists computed without it — 502 `read-error` for `memory.yaml`, the CLI
  envelope for `memory search` or `dna show`, 500 `internal` for the Memory events (without
  events every actor would fall back to `tech-lead`; without the DNA the user would look
  unidentified).
- `summary` — the all-roles summary (S5): one line per role the member holds, in the order of
  `dna.team.members[].roles`; `count` = the length of Requires you of that role view, `items` its
  first ≤ 3 rows, `more` = `count − 3` when positive, else 0 (REQ-PERF-11, S-23.4). **Absent**
  for a member holding one role (S-23.3).
- The bell's *Updates* are not part of this output: `GET /api/p/:pid/events/memory?limit=10`
  (spec-004 §3, spec-002).

### 6. Enablement

**Role.** A verb whose required role the user does not hold is **not offered**: the footer is
informational — "Reserved to approver — <members> can act" — with no outcome button (G-09.1,
REQ-SEC-07). The role is not an enablement rule.

An offered verb is **enabled** only when all hold; otherwise it is shown disabled with the first
failing reason (also its accessible description, REQ-ARC-10):

1. the user is identified in the team (REQ-SEC-08) — "Read-only: not in the team";
2. the WingFoil version is in the supported range — "Read-only: supported <range>", the range
   labelled `<min> to <X.Y.x>` as in `adr-001` D3 (e.g. "0.2.2 to 0.2.x");
3. the element file has no local changes — "Blocked: this element has local changes — commit or
   discard them first" (REQ-STATE-03);
4. the copy is not behind, diverged or on a detached HEAD (REQ-STATE-04).

The reason is a **code with parameters**, not a text — `not-in-team`, `version-unsupported
{range}`, `local-changes`, `copy-behind {commits}`, `copy-diverged`, `copy-detached` — rendered by
the web catalogue (spec-008); the quoted texts above are the catalogue's English.

The server re-evaluates the four rules on every write request (403 `not-in-team`, 409, spec-004
§4); the role is left to the CLI, which is the authority (REQ-SEC-07).

### 7. Tone (colour)

`gate`, `gate-waiting` → *human*; `last`, `off-sequence` → *done*; `first`, `waiting` → *neutral*; `work` →
*active*; `undeclared` → *attention*; `archived` → *muted* (`ux-reference.md` §7).

### 8. Output

```
{ id, type, status, kind, tone, bucket?,
  verbs: [{ verb, to, role, enabled, reason? }],
  actor: { kind: "member" | "role" | "engine" | "none", member?, role?, members?, fallback?,
           basis? },
  rejection?: { by, reason, at },
  since? }                                 # time of the last event into the current state
```

- `bucket` — the Memory list bucket with *All types* (`memory-list.feature`), by kind:
  `to-approve` (`gate`), `in-progress` (`work`, `undeclared`), `waiting` (`first`, `waiting`,
  `gate-waiting`, `off-sequence`), `done` (`last`, the last non-archived state of `sequence`, e.g.
  custom `adr` `accepted`); absent for `archived` (e.g. `superseded`).
- `verbs[].role` is `null` for `submit` (no role required); `reason` is the code of §6.
- `actor.member` is `{ name, email }`; `actor.members` lists names; `actor.fallback` is
  `"author-not-in-team"` on the `tech-lead` fallback of §4.
- `actor.basis` (v0.2) — for a member actor, which rule of §4 named them: `submitter` (the
  submit that was rejected), `creator` (the `add` event) or `last-transition`; rendered as
  "Jordan (submitter) must act" (T-11.1). Absent for other actor kinds.
- `rejection` is set when the last event is a reject into the current state; `rejection.reason`
  is `null` when the reject commit carries none. `since` is absent when no event is known.

**Vocabulary (REQ-ARC-05).** Some of this spec's own words — the kind `archived`, the tones `done`
and `active`, the bucket codes `in-progress` and `done` — coincide with fixture state names. They
are the UI's closed vocabulary, not a methodology's, but the REQ-ARC-05 lint rule matches by value:
the tables holding them (kind → tone, kind → bucket, the `archived` kind) live in
`server/src/presets/` (the rule's only exemption, spec-005 §5); `web/` uses them as data (e.g.
`tone-${tone}`), never as literals.

Computed by `server/` once per repository state (cache, `adr-001` D6) and served with the
element list; `web/` renders it and never re-derives it.

### 9. Verification

- Unit tests per kind and actor rule on the three fixtures' definitions (kanban defaults, custom
  `task`/`bug`/`release`/`adr`, unknown `story`/`note`), including `gate-waiting` (custom `bug`
  `triaged`), an undeclared state (`note` `on-hold`), a waiting state followed only by an archived
  one (custom `adr` `accepted` → `last`) and a gate on the last state (`reject` offered).
- Contract check: for every verb the descriptor enables on a fixture, the CLI accepts it, unless it
  refuses the element's content (an empty required field — e.g. `submit` of custom
  `adr-001-local-server` with an empty `sard_ref`, W-01/W-02); for every
  `submit`/`approve`/`reject` the CLI accepts, the descriptor offered it — except transitions into
  the archived set (`superseded`), which the UI does not offer in the MVP, like `deprecate`.
- The scenarios cited by REQ-ARC-06 pass.

## Consequences

- One derivation feeds every view; no type or state name is hard-coded (REQ-ARC-05 lint rule).
- Actor rules need each element's events: the project-wide parse of spec-002 serves them in the
  same git process.
- `work` states (e.g. custom `task` `in-progress`) get `submit` and a member actor — a rule the
  scenarios did not state; it follows WingFoil's `submit` legality (checked on a fixture:
  `submit` from the waiting state `backlog` is refused, as the table says).

## Process Notes

- 2026-10-02 — drafted in initial-design session 5b from the BDD conventions and scenarios;
  additions to them: the `work` and `off-sequence` kinds, archived states as final (not "Action required"),
  the fallback when an author is not in the team, the order of Requires you. Submitted after the
  independent spec review (plan step 6).
- 2026-10-02 — spec review (step 6): F1 the role is no longer an enablement rule (informational
  footer, G-09.1); F6 `end` excludes archived states, so `accepted` ADRs and `approved` specs are
  final and done; F10 a gate on the last state offers `reject`; kind `deprecated` → `archived`.
- 2026-10-06 — amended in dev-loop task-011 (Wave 2, plan dev-loop-rel-v0.1-plan): §4
  `gate-waiting` actor = the workflow engine, `reject` still reserved to `approver` (SARD
  REQ-ARC-06); §5 `gate-waiting` in Waiting on others with the engine text, its reject offered
  to `approver` holders only; §5 the `tech-lead` fallback actor in Requires you of the `tech-lead`
  view; §6 the
  disabled reason is a code with parameters rendered by the web catalogue; §8 `bucket` in the
  output (Done = last non-archived state of `sequence`), `verbs[].role` `null` for `submit`,
  `rejection.reason` may be `null`, `actor.fallback`; §6 the `version-unsupported` range label
  `<min> to <X.Y.x>` (task-012); §8 vocabulary note (tables in
  `server/src/presets/`, REQ-ARC-05); §9 erratum (the CLI may refuse an offered move for the
  element's content); decided by the user.
- 2026-10-07 — amended in dev-loop task-018 (Wave 3, plan dev-loop-rel-v0.1-plan): panel use of the descriptor in
  v0.1: a current state outside `sequence` (off-sequence, undeclared, archived) is drawn as its own
  chip after the unmarked sequence chips, coloured by `tone` (W3-15); decided by the user.
- 2026-10-07 — amended in dev-loop task-019 (Wave 3, plan dev-loop-rel-v0.1-plan): the Team
  view's pending gates per member are counted in the web from the descriptors of `GET /elements`
  (`kind: gate` whose `actor.members` lists the member; `gate-waiting` excluded) — an aggregation
  of descriptor data, not a re-derivation (§8); no server change (W3-39); decided by the user.
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-11, RP-13): §5 the Today
  output of `GET /api/p/:pid/today` (Requires you with its action, Waiting on others, all-roles
  summary absent for single-role members, greeting count = bell *To unblock*, the shape for
  unidentified users) and the hand-transition limitation of this repository (W-04, W-20, W-25,
  W-26: "Waiting for the workflow engine", no hand commit from the UI); §8 `actor.basis`
  (`submitter`, `creator`, `last-transition`) for T-11.1. Decided by the approver at checkpoint 2.
- 2026-10-12 — independent spec review round 1 (release-planning v0.2 session 2, drafting
  detail): §5 the Requires you `action` → button label mapping (`resolve` → "Open", T-05.1).
- 2026-10-13 — amended in dev-loop task-031 (minor-v0.2 Wave 1, plan dev-loop-rel-v0.2-plan,
  D31-3 … D31-5): §5 Today output — Waiting on others in the order of Requires you; no partial
  Today on a failed input (the read's refusal); a member with no role (`view` `null`, their own
  rows, no `summary`); an unidentified user's `?view=` → 400. Decided by the approver.
