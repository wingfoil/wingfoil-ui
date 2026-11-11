---
id: spec-003-action-descriptor
type: tech-spec
title: "Action descriptor"
status: approved
scope: "action descriptor: verbs, actor and tone per element"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: "0.2.2, 0.3.1"   # optional — for a CLI contract: the WingFoil version the shape was captured from
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
from anywhere (not offered by the UI in the MVP). WingFoil 0.3.x keeps these rules (directive
`wingfoil-cli` W-20) and adds `park`, from a state that is a `returns` key to its target, and the
type's `limits` (`{<state>: N}`): a move into a state that already holds N elements of the type is
refused (0.3.1 `dist/memory/state-machine.js`, `dist/core/memory-transition.js`). The UI does not
offer `park` (like `deprecate`); it reads `limits` for enablement (§6). The actor rules were fixed
by the scenarios (`02_bdd/00_conventions.md`, *Identity and roles in steps*;
`features/s/action-descriptor.feature`, `features/t/requires-you.feature`,
`features/t/waiting-on-others.feature`, `features/g/gate-footer.feature`). This spec makes the
derivation exact.

## Specification

### 1. Inputs

| Input | Source |
|-------|--------|
| Resolved states per type (`sequence`, `gates{state: {reject}}`, `waiting[]`, `limits{state: N}`) | `memory.yaml`, spec-001 §4.1 |
| Held gates per type and gate state (v0.3) | `holds` of the effective `ui.yaml` or its preset, spec-005 §1, §4a |
| The elements referencing an element (v0.3, for `when-references-done`) | the reference index of spec-012 §1 (frontmatter values of every non-archived element), shared with the project-state views |
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

### 3. Verbs per kind (WingFoil 0.2.2 and 0.3.x)

| Kind | Verbs offered | Role required (0.2.2, 0.3.x) |
|------|---------------|-----------------------|
| `first`, `work` | `submit` → next state of `seq` | none (any identified team member) |
| `gate` | `approve` → next state of `seq` (not offered while the gate is held, below); `reject` → `gates[s].reject` | `approver` for both (W-13) |
| `gate-waiting` | `reject` → `gates[s].reject` only; the advance is the workflow engine's (a configuration that declares a gate `waiting`, e.g. the pre-packs `custom` fixture on 0.2.2) | `approver` |
| `waiting` | none — "Waiting for the workflow engine (state: `s`)" | — |
| `last`, `off-sequence`, `archived` | none — final (WingFoil allows no verb but `deprecate` from them); exception: a `last` state that is also a gate offers its `reject` (WingFoil accepts it) | `approver` for that `reject` |
| `undeclared` | none — *Open* only; "Action required — state `s` is not declared for `T`" | — |

With WingFoil 0.3 (v0.4) the engine verbs (`workflow start/next`) are added from the capability
table; this table does not change.

**Held gates (v0.3, RP3-14 D5; spec-005 §4a).** A gate that the CLI lets the approver pass at once
may be meant for a later moment of the project's process — in this repository a `release`
`releasing` is approved only after its publication and a `release-line` `active` only when all its
releases are `released` (`.wingfoil/README.md` *Deviations from the packs* R-1, R-2 residuals;
directive `release-conventions`). The project declares it per type and gate state in the `holds`
key of `.wingfoil/ui.yaml` or its preset; spec-005 §4a fixes the values and when a hold applies:
`never` (always held, reason `held-by-config`) and `when-references-done` (held while a
non-archived element referencing it is not done, reason `held-until-references-done {count}`).
While the gate is held, `approve` is not offered: the gate footer shows an informational line with
the reason (`approveHeld`, §8); the gate's `reject` stays offered as above (to `approver` holders);
the element is never in Requires you, is in Waiting on others for every member — approvers
included — with the reason, and is not a pending gate (§5). The descriptor names no type or
state (REQ-ARC-05): the hold comes from the configuration. The count of
`held-until-references-done` is read from the reference index of spec-012 §1 (the elements one of
whose values equals the gate element's id or `version`), so with a `when-references-done` hold in
force every descriptor computation builds that index (spec-012 §1 *Cost*, §8).

### 4. Actor — who must act

| Kind | Actor |
|------|-------|
| `first`, `work` — last event is a `reject` | the **member who made the submit that was rejected** (author of the last `submit` before it), with the reject's `reason` and approver; listed **first** in their Requires you |
| `first` — otherwise | the **creator** (author of the `add` event) |
| `work` — the last move into `s` is an `approve` | the author of the last `submit` before it, the submit that reached the gate (RP3-14 D6: e.g. a task approved into `backlog`, whose start is not the approver's) |
| `work` — otherwise | the author of the last transition into `s` |
| `gate` | the role `approver` (members holding it) |
| `waiting`, `gate-waiting` | the workflow engine (no member) — "Waiting for the workflow engine"; for `gate-waiting` the `reject` verb stays reserved to `approver` (its `role`, §3), as SARD REQ-ARC-06 |
| `undeclared` | the role `tech-lead` |
| `last`, `off-sequence`, `archived` | no one |

The events read here are the moves of the element: every event but an `amend`, which records a
correction and keeps the state (it changes neither the actor, nor the rejection, nor `since`;
task-048 D48-6), and a commit outside a verb only when it changed the state.

A member is matched by the email of the event's author against `dna.team.members[].email`. When
the author is not a member (or the history has no event), the actor falls back to the role
`tech-lead` with "Author not in the team" (output: `actor.fallback: "author-not-in-team"`).

### 5. Placement in the role views

For the current user `U` with role view `R`:

- **Requires you** of view `R` lists an element when:
  - the actor is `U` (member actor) — in **every** role view of `U`; or
  - the kind is `gate`, the gate is not held (§3, `approveHeld` absent), `U`
    holds `approver` and `R ∈ {reviewer, approver}` — action *Review* in the `reviewer` view,
    *Approve* in the `approver` view; or
  - the kind is `undeclared` and `R = tech-lead`; or
  - the actor is the `tech-lead` **fallback** of §4 (author not in the team, or no event) and
    `R = tech-lead` — otherwise such an element would be in no list of a tech-lead.
- **Waiting on others** of `U` lists an element whose actor is another member or a role `U` does
  not hold, with who can act ("Reserved to approver — Morgan, Alex"); `waiting` and
  `gate-waiting` elements show "Waiting for the workflow engine". A held `gate` (§3) is listed for
  **every** member, `approver` holders included, with the hold's reason (`approveHeld.reason`) in
  place of "Reserved to approver — …" (review round 1 F1, decided by the approver). A `waiting` state that is the
  type's `end` is kind `last` (§2) and is in neither list: shown as in force, e.g. `adr` `accepted`
  and `tech-spec` `approved`, left only through a later element's `supersedes:` (RP3-14 D1, N3
  option A).
- `gate-waiting` elements are **not** pending gates: not in Requires you, not counted in *Pending
  gates*; members holding `approver` see their reject outcome in the gate footer (the `reject` is
  offered to `approver` holders only). Nor is a held `gate` element (§3, spec-005 §4a).
- Order in Requires you: rejected work first, then by time in the current state, oldest first.
- **Hand transitions (erratum, 2026-11-03).** Since the packs adoption on WingFoil 0.3.1 every
  transition of this repository has a verb (`.wingfoil/memory.yaml`; directive `wingfoil-cli`
  W-25, W-26 and *Removed entries*): `task` `backlog`, `release` `planning` and `in-development`,
  `bug` `planned` are `submit` states (kind `work`); `bug` `triaged`, `release` `releasing` and
  `release-line` `active` are gates. The one hand transition left is a phase plan's close, `plan`
  `active → done` (W-04), declared `waiting`: the UI shows "Waiting for the workflow engine" there
  and never makes that commit (REQ-ARC-03). On any project, a state its configuration declares
  `waiting` is shown the same way (a configuration of the v0.2 era, before the packs, declared
  `plan` `active`, `task` `backlog`, `release` `planning` and `bug` `triaged` `waiting` — RP-13); WingFoil 0.3.1 accepts a hand-committed `status:`
  without the approver (W-34), which the UI never makes either.

**Today output (v0.2, `GET /api/p/:pid/today?view=<role>`, `contracts/api/today.schema.json`).**

```
{ view: string | null,                          # the role view used; null when there is no role view (not identified, or a member holding no role)
  requiresYou: [Row & { action }] | null,       # null when the user is not identified (T-01.2)
  waitingOnOthers: [Row],
  summary?: [{ role, count }] }                 # v0.2 also had items and more (dropped in v0.3, task-076)
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
  `dna.team.members[].roles`, `{ role, count }`; `count` = the length of Requires you of that role
  view (REQ-PERF-11 v0.3, S-23.4). **Absent** for a member holding one role (S-23.3). *Your roles*
  is one line of role tags with their counts (N1; `ux-reference.md` §4.1 v0.3, S-23.4, S-23.5). The
  v0.2 `items` (the first ≤ 3 rows) and `more` (`count − 3` when positive) were dropped in v0.3
  (task-076, Process Notes).
- The bell's *Updates* are not part of this output: `GET /api/p/:pid/events/memory?limit=10`
  (spec-004 §3, spec-002).

### 6. Enablement

**Role.** A verb whose required role the user does not hold is **not offered**: the footer is
informational — "Reserved to approver — <members> can act" — with no outcome button (G-09.1,
REQ-SEC-07). The role is not an enablement rule.

**Identity first (v0.2, task-037).** A user who is not identified as one member gets no outcome at
all: the footer is a read-only line ("Read-only: <email> is not in the team — How to join", or a
pointer to the header's notice; S-13.2, S-15.2). Rule 1 below then only reaches the server's
re-evaluation (403 `not-in-team`).

An offered verb is **enabled** only when all hold; otherwise it is shown disabled with the first
failing reason (also its accessible description, REQ-ARC-10):

1. the user is identified in the team (REQ-SEC-08) — "Read-only: not in the team";
2. the WingFoil version is in the supported range — "Read-only: supported <range>", the range
   labelled `<min> to <X.Y.x>` as in `adr-001` D3 (e.g. "0.2.2 to 0.3.x" with the support matrix
   [0.2.2, 0.3.1], `contracts/matrix.json`);
3. the element file has no local changes — "Blocked: this element has local changes — commit or
   discard them first" (REQ-STATE-03);
4. the copy is not behind, diverged or on a detached HEAD (REQ-STATE-04);
5. (v0.3, RP3-14 D11) for `submit` and `approve` only (WingFoil checks no limit on a `reject`
   or a `park`), the verb's target state is not at its limit: when the type declares
   `limits: {<to>: N}` and N elements of the type are already in `<to>`, the move is refused by
   WingFoil 0.3.x (Context) — "Blocked: only {limit} {state} at a time". The UI counts the not-archived
   elements of `memory search` (the working tree); this approximates WingFoil's count, which reads
   HEAD and every local and remote-tracking branch that changed an element since its merge-base
   (0.3.1 `dist/core/memory-transition.js` `requireWipSlot`): the two may differ, and the CLI's
   refusal (422 `cli-refused`) stays the authority.

The reason is a **code with parameters**, not a text — `not-in-team`, `version-unsupported
{range}`, `local-changes`, `copy-behind {commits}`, `copy-diverged`, `copy-detached`,
`state-limit {state, limit}` — rendered by the web catalogue (spec-008); the quoted texts above are
the catalogue's English.

The server re-evaluates rules 1–4 on every write request (403 `not-in-team`, 409, spec-004 §4);
the role and the limit are left to the CLI, which is the authority (REQ-SEC-07; a refused limit is
422 `cli-refused`).

### 7. Tone (colour)

`gate`, `gate-waiting` → *human*; `last`, `off-sequence` → *done*; `first`, `waiting` → *neutral*; `work` →
*active*; `undeclared` → *attention*; `archived` → *muted* (`ux-reference.md` §7).

### 8. Output

```
{ id, type, status, kind, tone, bucket?,
  verbs: [{ verb, to, role, enabled, reason? }],
  approveHeld?: { condition, reason },      # v0.3: the hold of a held gate (§3, spec-005 §4a)
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
- `approveHeld` (v0.3, RP3-14 D5) — set on a held `gate` (§3): `condition` the `holds` value,
  `never` or `when-references-done`; `reason` its code with parameters, `{ code: "held-by-config" }`
  or `{ code: "held-until-references-done", count }` (spec-005 §4a), rendered by the web catalogue
  (spec-008) — in English "Approved outside the console (ui.yaml)" and "Waits for {count}
  referencing element(s) to be done" (the implementing task may refine the wording in the
  catalogue); `verbs` then holds no `approve`.
- `actor.basis` (v0.2) — for a member actor, which rule of §4 named them: `submitter` (the
  submit that was rejected, or — v0.3, D6 — the submit that reached the gate an `approve` left),
  `creator` (the `add` event) or `last-transition`; rendered as
  "Jordan (submitter) must act" (T-11.1). Absent for other actor kinds.
- `rejection` is set when the last event is a reject into the current state; `rejection.reason`
  is `null` when the reject commit carries none. `since` is absent when no event is known.

**Vocabulary (REQ-ARC-05).** Some of this spec's own words — the kind `archived`, the tones `done`
and `active`, the bucket codes `in-progress` and `done` — coincide with fixture state names. They
are the UI's closed vocabulary, not a methodology's, but the REQ-ARC-05 lint rule matches by value:
the tables holding them (kind → tone, kind → bucket, the `archived` kind) live in
`server/src/presets/` (the rule's only exemption, spec-005 §5); `web/` uses them as data (e.g.
`tone-${tone}`), never as literals.

Inputs that cannot be read (as `server/src/http/project-routes.ts` does): an unreadable
`memory.yaml` → no descriptor (`typesError`); failed Memory events → descriptors computed without
events (actors, `rejection` and `since` degrade) and `eventsError`; a failed `dna show` → no
member is known, so member actors fall back to `tech-lead` with `author-not-in-team` (§4) — the
element lists carry no error field for it, the project header's `dnaError` (spec-004 §3) does
(v0.3, spec-012 §4, §10).

Computed by `server/` once per repository state (cache, `adr-001` D6) and served with the
element list; `web/` renders it and never re-derives it.

### 9. Verification

- Unit tests per kind and actor rule on the three fixtures' definitions (kanban defaults, custom
  `task`/`bug`/`release`/`adr`, unknown `story`/`note`), including `gate-waiting` (custom `bug`
  `triaged` of the pre-packs governance, `test/harness/fixtures/custom-governance-0.2/`; on the
  packs it is a `gate`), the `work` actor after an `approve` (D6), a held gate of each `holds`
  value (D5), a target at its `limits` (D11), an undeclared state (`note` `on-hold`), a waiting
  state followed only by an archived one (custom `adr` `accepted` → `last`) and a gate on the last
  state (`reject` offered).
- Contract check: for every verb the descriptor enables on a fixture, the CLI accepts it, unless it
  refuses the element's content (an empty required field — e.g. `submit` of custom
  `adr-001-local-server` with an empty `sard_ref`, W-01); for every
  `submit`/`approve`/`reject` the CLI accepts, the descriptor offered it — except transitions into
  the archived set (`superseded`), which the UI does not offer in the MVP, like `deprecate`, and an
  `approve` of a held gate (§3). WingFoil 0.3.x's `park` and `amend` are accepted and
  never offered.
- The scenarios cited by REQ-ARC-06 pass.

## Consequences

- One derivation feeds every view; no type or state name is hard-coded (REQ-ARC-05 lint rule).
- Actor rules need each element's events: the project-wide parse of spec-002 serves them in the
  same git process.
- `work` states (e.g. custom `task` `in-progress`) get `submit` and a member actor — a rule the
  scenarios did not state; it follows WingFoil's `submit` legality (checked on a fixture:
  `submit` from the waiting state `backlog` is refused, as the table says — on the pre-packs
  governance; on the packs `backlog` is a `work` state and `submit` is accepted).

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
  rows, no `summary`); an unidentified user's `?view=` → 400. Decided by the approver. Same day,
  review round 1 (F1): the shape block's `view` comment aligned ("null when there is no role
  view").
- 2026-10-15 — amended in dev-loop task-037 (minor-v0.2 Wave 3, plan dev-loop-rel-v0.2-plan,
  D37-5, D37-6): §6 rule 1 for the gate footer — a user not identified as one member (identity
  `not-in-team`, `no-identity`, `ambiguous`) is offered no outcome at all, only a read-only line
  ("Read-only: <email> is not in the team — How to join", or a pointer to the header's notice;
  S-13.2, S-15.2), rather than outcomes disabled with `not-in-team`; the role rule is applied after
  it (informational footer); a `gate-waiting` state shown to a member without `approver` reads
  "Reserved to approver" without names (its actor is the engine) with "Waiting for the workflow
  engine to advance". Decided by the approver.
- 2026-11-02 — amended in dev-loop task-048 (bug-026, D48-6 approved by the approver): §4 the
  events read are the moves — an `amend` of WingFoil 0.3.x is not one; `start`, `finalize`, `sync`
  and `park` are, like the five verbs.
- 2026-11-02 — task-048 review round 1 (n-3): `wingfoil_version` names 0.3.1 too.
- 2026-11-03 — amended in `release-planning` v0.3 (step 5, RP3-14; the erratum listed by
  `governance-alignment-rel-v0.3-plan` Session 4), decided by the approver: Context, §1 the verb
  rules hold on WingFoil 0.3.x, which adds `park` (never offered) and `limits` (an input); §3 the
  title and role column name 0.3.x, `gate-waiting` is a configuration of the pre-packs kind, and
  the approve conditions of `ui.yaml` and its presets (D5, spec-005): no Approve, an informational
  line, not in Requires you, not a pending gate (§5, `approveHeld` in §8); §4 after an `approve`
  the actor of a `work` state is the author of the submit that reached the gate (D6, R-6); §5 a
  `waiting` state that is `end` is `last`, in neither list (D1, N3 option A, already the rule) and
  the hand-transition erratum (W-04 only; W-20, W-25, W-26 superseded by the packs, W-34); §6 rule
  5 `state-limit` (D11) and the range example on the matrix [0.2.2, 0.3.1]; §9 W-02 removed from
  the citations, the fixtures' pre-packs scope, `park`/`amend` never offered; Consequences
  qualified for the packs. Aligned the same day with spec-005 §1 and §4a: the held gates come
  from `ui.yaml`'s `holds` per type and gate state, `approveHeld` is `{condition: never |
  when-references-done, reason: held-by-config | held-until-references-done {count}}`; §5 the
  summary's `items` and `more` kept but unused in v0.3 (N1, S-23.4, S-23.5). Review round 1
  (decided by the approver): §3, §5 a held gate is in Waiting on others for every member,
  approvers included, with its reason (F1; S-24.5, S-24.6); §6 rule 5 for `submit` and `approve`
  only, the UI's count an approximation of `requireWipSlot` (F4; S-24.7); §5 the four pre-packs
  `waiting` states named. Round 2 (P3, decided by the approver): the catalogue's English of
  `state-limit` and of the two hold reasons; S-23.5 cited for N1.
- 2026-11-03 — aligned with spec-012 (release-planning v0.3 step 5c, decided by the approver,
  "TQ-1…TQ-6, X1 e K1–K3 come consigliato"): §1 and §3 the `when-references-done` hold reads
  spec-012 §1's shared reference index; §8 what a failed input does to the descriptor, `dnaError`
  as the code has it (on the project header only). No rule changes.
- 2026-11-11 — amended in task-076 (minor-v0.3 Wave 2, plan `backlog-item-rel-v0.3-plan` W2-7;
  task-061's Q2 (a), decided by the approver): §5 the summary's `items` and `more` dropped from the
  output — a line is `{ role, count }` (`contracts/api/today.schema.json`), REQ-PERF-11 v0.3's "one
  tag per role with its count and no item"; it supersedes the 2026-11-03 note's "kept but unused".
