---
id: spec-003-action-descriptor
type: tech-spec
title: "Action descriptor"
status: draft
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

For an element of type `T` in state `s`, with `seq = states(T).sequence`:

| Kind | Condition (first match wins) |
|------|------------------------------|
| `deprecated` | `s = deprecated` (WingFoil's implicit retirement state) |
| `off-sequence` | `s ∉ seq` but `s` is a `gates.<g>.reject` target (declared, outside the sequence) |
| `undeclared` | `s ∉ seq` otherwise |
| `last` | `s = seq[-1]` |
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
| `last`, `off-sequence`, `deprecated` | none — final (WingFoil allows no verb but `deprecate` from them) | — |
| `undeclared` | none — *Open* only; "Action required — state `s` is not declared for `T`" | — |

With WingFoil 0.3 (v0.4) the engine verbs (`workflow start/next`) are added from the capability
table; this table does not change.

### 4. Actor — who must act

| Kind | Actor |
|------|-------|
| `first`, `work` — last event is a `reject` | the **member who made the submit that was rejected** (author of the last `submit` before it), with the reject's `reason` and approver; listed **first** in their Requires you |
| `first` — otherwise | the **creator** (author of the `add` event) |
| `work` — otherwise | the author of the last transition into `s` |
| `gate`, `gate-waiting` | the role `approver` (members holding it) |
| `waiting` | the workflow engine (no member) |
| `undeclared` | the role `tech-lead` |
| `last`, `off-sequence`, `deprecated` | no one |

A member is matched by the email of the event's author against `dna.team.members[].email`. When
the author is not a member (or the history has no event), the actor falls back to the role
`tech-lead` with "Author not in the team".

### 5. Placement in the role views

For the current user `U` with role view `R`:

- **Requires you** of view `R` lists an element when:
  - the actor is `U` (member actor) — in **every** role view of `U`; or
  - the kind is `gate` and `U` holds `approver` and `R ∈ {reviewer, approver}` — action *Review*
    in the `reviewer` view, *Approve* in the `approver` view; or
  - the kind is `undeclared` and `R = tech-lead`.
- **Waiting on others** of `U` lists an element whose actor is another member or a role `U` does
  not hold, with who can act ("Reserved to approver — Morgan, Alex"); `waiting` elements show
  "Waiting for the workflow engine".
- `gate-waiting` elements are **not** pending gates: not in Requires you, not counted in *Pending
  gates*; members holding `approver` see their reject outcome in the gate footer.
- Order in Requires you: rejected work first, then by time in the current state, oldest first.

### 6. Enablement

An offered verb is **enabled** only when all hold; otherwise it is shown disabled with the first
failing reason (also its accessible description, REQ-ARC-10):

1. the user is identified in the team (REQ-SEC-08) — "Read-only: not in the team";
2. the WingFoil version is in the supported range — "Read-only: supported <range>";
3. the user holds the required role — "Reserved to approver — <members>";
4. the element file has no local changes — "Blocked: this element has local changes — commit or
   discard them first" (REQ-STATE-03);
5. the copy is not behind, diverged or on a detached HEAD (REQ-STATE-04).

The server re-evaluates 1, 2, 4 and 5 on every write request (401/403/409, spec-004); rule 3 is
left to the CLI, which is the authority (REQ-SEC-07).

### 7. Tone (colour)

`gate`, `gate-waiting` → *human*; `last`, `off-sequence` → *done*; `first`, `waiting` → *neutral*; `work` →
*active*; `undeclared` → *attention*; `deprecated` → *muted* (`ux-reference.md` §7).

### 8. Output

```
{ id, type, status, kind, tone,
  verbs: [{ verb, to, role, enabled, reason? }],
  actor: { kind: "member" | "role" | "engine" | "none", member?, role?, members? },
  rejection?: { by, reason, at },
  since }                                  # time of the last event into the current state
```

Computed by `server/` once per repository state (cache, `adr-001` D6) and served with the
element list; `web/` renders it and never re-derives it.

### 9. Verification

- Unit tests per kind and actor rule on the three fixtures' definitions (kanban defaults, custom
  `task`/`bug`/`release`, unknown `story`/`note`), including `gate-waiting` (custom `bug` `triaged`)
  and an undeclared state (`note` `on-hold`).
- Contract check: for every verb the descriptor enables on a fixture, the CLI accepts it; for every
  `submit`/`approve`/`reject` the CLI accepts, the descriptor offered it.
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
  additions to them: the `work` and `off-sequence` kinds, `deprecated` as final (not "Action required"),
  the fallback when an author is not in the team, the order of Requires you. Submitted after the
  independent spec review (plan step 6).
