---
id: task-016-project-header-version-identity-and-role-view
type: task
title: "Project header version identity and role view"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-005-snapshot-fingerprint-misses-a-same-size-rewrite-within-one-mtime-tick"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-006-wingfoil-version-range-and-capabilities", "task-009-identity-and-role-views", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-014-add-project-modal", "task-015-project-switcher", "task-019-dna-directives-and-team-views", "task-020-documentation-index-and-links"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project header: WingFoil version with the range state and missing capabilities, read-only notices (out of range, not in team, no identity, duplicates), the identity badge and the role view selector remembered per project.

**Backlog items:** US-S-08, US-S-09, US-S-12, US-S-13, US-S-14, US-S-15, US-S-22

- US-S-08 — As Alex, I want to see the project's WingFoil version and the capabilities it lacks when I add it, so that I know up front what I cannot do yet
- US-S-09 — As Alex, I want a project whose WingFoil version is outside the supported range opened read-only with the reason, so that I never act through a CLI the UI was not tested with
- US-S-12 — As a member, I want to be recognised from my `git config user.email` matched against `dna.team.members`, with my name and roles shown in the shell, so that I never log in
- US-S-13 — As Riley, I want a "not in team" badge and every view read-only when my git email is not in the team, so that I explore safely
- US-S-14 — As a member with no git email configured, I want the project read-only with a "no identity" notice that says how to set it, so that I know why I cannot act
- US-S-15 — As a member whose git email matches several team members, I want the project read-only with a warning naming them, so that no action is taken under the wrong identity
- US-S-22 — As Alex, I want to switch role view (e.g. approver → developer) in the shell, so that the screens show what that role needs

## Acceptance Criteria

- **US-S-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-08.1 Show the version on add, nothing missing; S-08.2 Use the CLI on the PATH when the project pins none
- **US-S-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-09.1 Open a project with a newer, untested CLI read-only; S-09.2 Open a project with an older CLI read-only
- **US-S-12** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-12.1 Recognise a single-role member; S-12.2 Match the email regardless of letter case; S-12.3 Follow a change of git email
- **US-S-13** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-13.1 Mark a user who is not in the team; S-13.3 Mark a member removed from the team
- **US-S-14** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-14.1 Open read-only when git has no email; S-14.2 Use the global git email when the repository sets none
- **US-S-15** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-15.1 Open read-only when the email matches two members; S-15.3 Recognise the member once the DNA is fixed
- **US-S-22** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/identity.feature`: S-22.1 Switch role view; S-22.2 Offer only the roles the member holds; S-22.3 Keep the role view per project

- **bug-005-snapshot-fingerprint-misses-a-same-size-rewrite-within-one-mtime-tick** (absorbed, dl-045; decided by the user 2026-10-10): `test/server/snapshot/fingerprint.test.ts` › "reads a file again only when its lstat changed" passes deterministically (the change it makes is visible to `lstat`: different size or an explicit later mtime); 20 consecutive isolated runs green.

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `adr-001` D3; `spec-001` §6; `spec-004` §3 (`/api/p/:pid`, `role-view`); `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-10)

- **depends_on acknowledged (dl-015):** Execution Notes of task-006, 009, 012, 013, 014, 015, 019,
  020 read, plus the hand-overs of task-004, 007 and 010 toward this task. Taken from them:
  - 006 — `wingfoil {text, version, state, inRange, source}`; header text "WingFoil <version ??
    text>" plus "(from PATH)" when `source === 'path'`; out of range → "read-only: supported <min>
    to <max>"; capability keys `capability.<id>`, reason codes `unsupported-version {range{min,max}}`,
    `not-released`, `needs-version {minVersion}`; `missing.length === 0` → "Every capability of
    this release is available" (with the matrix of one, `missing` is always empty in v0.1).
  - 009 — `identity` = `member {email, name, roles}` · `not-in-team {email}` · `no-identity` ·
    `ambiguous {email, members}`; `roleViews` (DNA order) and `roleView` (fallback applied on read,
    `null` without a member); selector only when `roleViews.length > 1`; `PUT role-view {role}` →
    204, 403 `not-in-team`, 400 for a role not held; then re-read `GET /api/p/:pid`; notices: the
    no-identity command `git config user.email <your email>`, ambiguous "<email> matches N
    members: <names>".
  - 012 — `ProjectHeader` (`readOnly: [{code: 'not-in-team'} | {code: 'version-unsupported',
    range: '<min> to <max>'}]`, identity first), `dnaError` when `dna show` failed (the identity is
    then matched against no member); the identity is the watched one (a git email change is seen
    once the watcher moved the state); warm `GET /api/p/:pid` / `PUT role-view` start 0 processes.
  - 010 — `repo` events for a `user.email` change (S-12.3) and DNA changes (S-13.3, S-15.3);
    the web invalidates `['p', pid]` on `repo`.
  - 013 — the header slot is `ProjectLayout`, above `<Outlet/>`; catalogue/ErrorText rules.
  - 014 — the Add project dialog closes on any navigation and opens the new project when available
    (S-08.1 goes through it); `web/src/shell/availability.ts`.
  - 015 — the project name is in the switcher trigger ("Projects: <name>"), not repeated here.
  - 019 — `projectHeaderQuery(pid)` (`['p', pid, 'header']`) is the only header query; the current
    role is `roleView ?? roleViews[0]`; the "you" badge and *only mine* read the identity; the
    server computes `directives[].mine` from the **stored** role view (`project-routes.ts`
    `directivesForRoleView(…, roleView)`), so a role-view change must also refresh
    `['p', pid, 'directives', …]` (see W4-20).
  - 020 — nothing in the header.
  - 004 / 007 — S-08.1, S-08.2 and S-22.3 screens close here (PATH install helper:
    `installGlobally` + `withPathFirst` of `test/server/cli/fake-cli.ts`, `envWithoutWingfoil`).
- **Specs:** `adr-001` D3, spec-001 §6, spec-004 §3 (`GET /api/p/:pid`, `PUT …/role-view`),
  ux-reference 0.9 §3 (*Current user*: initials, name + role when single-role, "not in team" badge;
  *Role view*: dropdown only with several roles), the prototype's header (logo · switcher · crumb
  · ⌘K · *View <role> ▾* · bell · avatar with initials, name + role only for a single role, badge
  *non nel team*); directives `ux-consistency`, `accessibility`.
- **Prototype gaps:** the prototype shows no WingFoil version, no version notice and no read-only
  notice (out of range, no identity, ambiguous); its role views are personas ("Tech lead") over
  the member's roles, while the v0.1 API's role views are the member's roles themselves.
- **Decisions for the user (W4-16 … W4-22)** — reported to the coordinator; nothing depending on
  them is built before the answer (the bug-005 fix does not depend on them and is done):
  - **W4-16 placement.** (a) one *project bar* at the top of the content column (inside `<main>`,
    above the view): version line left, identity + role view right, notices below; (b)
    **recommended** — split as the prototype: identity and role view at the right end of the
    global header (rendered by `ProjectLayout` through a portal into a slot of `Shell`'s header,
    so the component stays in the project layout and disappears outside a project), the version
    line and the read-only notices in a *project header* strip above `<Outlet/>`; (c) everything
    in the global header (no room for the notices at narrow widths).
  - **W4-17 current user.** (a) **recommended** — initials avatar + the name always visible, + the
    role when single-role (multi-role: the role is in the selector); `not-in-team` → the email +
    badge "not in team"; `no-identity` → "No identity"; `ambiguous` → "Ambiguous identity" (the
    scenarios' texts); the group's accessible name e.g. "Current user: Jordan, developer"; (b) the
    prototype exactly: initials only for a multi-role member, the name in the accessible name and
    a tooltip (S-12.3 "shows the current user Morgan" then not visible).
  - **W4-18 version line and notice.** (a) **recommended** — always visible: "WingFoil 0.2.2
    (from PATH)" then, in muted text, "Every capability of this release is available" (or the list
    "<capability> — needs WingFoil <min>" when `missing` is not empty); out of range the line is
    "WingFoil 0.4.0 — read-only: supported 0.2.2 to 0.2.x" (min/max from the capability reasons,
    catalogue wording, not the server's English label) with no capability notice; an unrecognised
    version shows the `--version` text or "an unknown version"; (b) the version is a button opening
    a popover with the notice and the capability table; (c) as (a) but the notice only when
    something is missing.
  - **W4-19 read-only notices.** (a) **recommended** — a persistent, non-dismissible notice per
    reason in the project header strip (warning tone, icon + text, never colour alone):
    not in team "Read-only: riley@example.test is not in the team of this project."; no identity
    "Read-only: git has no user.email for this project. Set it with: `git config user.email <your
    email>`"; ambiguous "Read-only: shared@example.test matches 2 members: Jordan, Sam. Give each
    member an email of their own in the DNA."; out of range: the version line itself (W4-18). The
    strip is a polite live region, so a notice appearing or going after a live identity change is
    announced; (b) only the badge in the header, details in a popover; (c) notices as a dismissible
    banner (dismissal remembered per session).
  - **W4-20 role view selector and its mutation (shared API checkpoint).** (a) **recommended** — a
    React Aria `Select` labelled "Role view" (button "Role view <role> ▾", listbox of the role ids
    as WingFoil names them, DNA order, the current one selected; prototype hint "You hold several
    roles: choose the view" as the popover's heading); new shared functions in
    `web/src/api/projects.ts`: `setRoleView(pid, role, signal?)` (`PUT /api/p/:pid/role-view`) and
    `useSetRoleView(pid)` — on success invalidate `projectHeaderQuery(pid)` **and** the
    `['p', pid, 'directives']` prefix (server-computed `mine`); the select is disabled while the
    request runs and shows the old value until the header is read again; a refusal shows
    `ErrorText` next to it and re-reads the header; (b) the same widget, invalidating the whole
    `['p', pid]` prefix (as a `repo` event: simpler, re-reads elements/config too); (c) a menu with
    radio items (`MenuTrigger` + `Menu selectionMode="single"`).
  - **W4-21 S-09.1 "no action button is enabled on any screen".** v0.1 renders no governed action
    (verbs and gate footers arrive in v0.2). (a) **recommended** — the spec visits every view
    (Memory list, element panel, DNA, Directives, Team, Documentation) and asserts the version line
    and that no governed-action control is rendered (`[data-action]`/action footer count 0), plus
    every element descriptor of `GET /elements` disabled with `version-unsupported`; (b) only the
    header line + the API descriptors; (c) defer the "any screen" half to v0.2 with a note.
  - **W4-22 unreadable DNA (`dnaError`).** The identity is then matched against no member, so a
    member would read "not in team". (a) **recommended** — with `dnaError` the chip shows the email
    with the badge "team unknown" and the notice "Read-only: the DNA could not be read, so the team
    is unknown." (the DNA view keeps the CLI's message, S-27.1); (b) show "not in team" as the API
    says; (c) hide the identity part entirely.
- **Design (assuming the recommended options; adjusted to the answers):**
  - `web/src/shell/header-slot.tsx` — `HeaderSlotProvider` (context holding the DOM node of an
    empty `div.shell-header-end` in `Shell`'s header) and `HeaderEnd` (portal into it).
  - `web/src/project/ProjectHeader.tsx` — `ProjectHeader({ pid })` reads `projectHeaderQuery(pid)`:
    the strip (`section` labelled "Project header": version line, version notice, read-only notices
    in a polite live region; loading status; `ErrorText` on a failed read) and, through `HeaderEnd`,
    `CurrentUser` (chip + badge) and `RoleViewSelect` (only when `roleViews.length > 1`).
    `web/src/project/model.ts` — pure helpers: `versionLine(header)`, `readOnlyNotices(header)`,
    `initials(name)`, `unsupportedRange(header)`. `web/src/project/project-header.css` with the
    shared tokens. `routes/project.tsx` renders `<ProjectHeader pid>` above `<Outlet/>`.
  - Catalogue (en.json, sorted, same commits): `header.*` (version, fromPath, readOnlyVersion,
    unknownVersion, allCapabilities, missing, user.*, badge.notInTeam, notice.*, roleView.*),
    `capability.<id>` for the 9 table ids if absent.
  - Freshness: the header follows `repo` (already `['p', pid]`); no polling.
- **Tech specs:** none missing; ux-reference §3 needs the amendment for the decisions (W4-16…22).
- **Test plan:**
  - Unit (`test/web/project/project-header.test.tsx`, `test/web/project/model.test.ts`,
    `test/web/api/role-view.test.tsx`): each identity state (chip text, badge, accessible name,
    notice), version line in range / from PATH / above / below / unrecognised, missing list,
    selector hidden for one role and for non-members, options = roleViews, selecting → `PUT` with
    `{role}`, header and directives invalidated, pending disabled, refusal → `ErrorText`, keys only
    from the catalogue.
  - e2e `test/e2e/project-header.spec.ts` (real bin; kanban/custom copies; `actAs`; axe
    `scanThemes` on the header in each identity state and with the selector open; keyboard for the
    selector), one test per scenario: S-08.1 (through the Add project dialog), S-08.2 (`removeCli`
    + a PATH install), S-09.1, S-09.2 (`installCliStub({ version })`), S-12.1, S-12.2, S-12.3,
    S-13.1, S-13.3, S-14.1 (repository and global email unset), S-14.2 (global email only),
    S-15.1, S-15.3, S-22.1, S-22.2, S-22.3. Live scenarios (S-12.3, S-13.3, S-15.3) use
    `refreshClock` (COLD_READ_MS by default, `@live-refresh` for `test:timing`). Every first read
    with `expectFirstLoad`; after the role-view PUT the test waits for the `GET /api/p/:pid` that
    follows and asserts its body before the retrying expects.

### bug-005 (2026-10-10)

- `test/server/snapshot/fingerprint.test.ts` › "reads a file again only when its lstat changed
  (review R2)": both files get an explicit mtime (`utimes`, 1 700 000 000 s) after the first
  write, and the same-size rewrite (`one` → `ONE`) gets an explicit later one (+10 s), so the
  change is always visible to `lstat`; the `LATER` clock still disables the racy rule on purpose.
  Product code unchanged. 20 consecutive isolated runs (`npx vitest run
  test/server/snapshot/fingerprint.test.ts`): **20/20 green** (load 22.75). Commit `ada377a`.

### design decisions (2026-10-10)

- Decided by the user (through the coordinator), each option (a)/(b) as recommended:
  - **W4-16 (b)** identity and role view at the right end of the global header, rendered by
    `ProjectLayout` through a portal into an empty slot of `Shell`'s header (only inside a
    project); the version line and the read-only notices in a "Project header" strip above
    `<Outlet/>`.
  - **W4-17 (a)** initials + name always visible; a single-role member also shows the role;
    not in team → the email + badge "not in team"; "No identity"; "Ambiguous identity"; accessible
    name e.g. "Current user: Jordan, developer".
  - **W4-18 (a)** always-visible version line ("(from PATH)" when so), "Every capability of this
    release is available" or the missing list; out of range "WingFoil 0.4.0 — read-only: supported
    0.2.2 to 0.2.x" from catalogue wording; an unknown version handled.
  - **W4-19 (a)** one persistent, non-dismissible notice per reason (warning tone + icon) in a polite
    live region, texts as proposed.
  - **W4-20 (a)** React Aria `Select` "Role view", roles in DNA order; shared
    `setRoleView(pid, role, signal?)` + `useSetRoleView(pid)` in `web/src/api/projects.ts`
    **confirmed**; on success `projectHeaderQuery(pid)` and the `['p', pid, 'directives']` prefix
    are invalidated; disabled while pending; a refusal → `ErrorText` + the header read again.
  - **W4-21 (a)** S-09.1 visits every view: no governed-action control rendered, and every
    `GET /elements` descriptor disabled with `version-unsupported`.
  - **W4-22 (a)** with `dnaError`: badge "team unknown" and notice "Read-only: the DNA could not be
    read, so the team is unknown."
  - The coordinator amends ux-reference §3 (1.0) on `main`.
