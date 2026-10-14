---
id: task-035-how-to-join-panel
type: task
title: "How to join panel"
status: in-review
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-C-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The *How to join* panel (C2), opened from the "not in team" badge of the project header: the tech
leads declared in the DNA and the exact `wingfoil dna add team.members …` command for the user's
git email, with a copy button; when the DNA declares no tech lead or no member, it says so and
still gives the command. Reads the v0.1 identity and DNA only, so it can run in wave 1.

**Backlog items:** US-C-08, US-C-09

- US-C-08 — As Riley, I want a How to join panel naming the tech lead and the exact `wingfoil dna add team.members …` command for my email, so that I know the next step to become a member
- US-C-09 — As Riley, on a project whose DNA declares no tech lead, I want How to join to say so and still give the command, so that I can ask any member to run it

## Acceptance Criteria

- **US-C-08** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/how-to-join.feature`: C-08.1 Name the tech leads and give the command; C-08.2 Copy the command
- **US-C-09** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/how-to-join.feature`: C-09.1 Say that no tech lead is declared; C-09.2 Explain an empty team

C-08.2 asserts the copied command with the clipboard helper of task-027-e2e-suite-on-firefox-and-webkit
(AC-1b). These scenarios are also cited by TT-SEC-08 (task-033-git-copy-state-repository-status-and-transport-routes).

Screen: `docs/00_reference/ux-reference.md` §3 (*Current user*, "not in team" badge), §4.11 *Identity* and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-004` §3 (`GET /api/p/:pid` identity, `GET /api/p/:pid/config` DNA); `identity.schema.json`;
  `spec-008` (the command is data, not a catalogue text: its placeholders are translated, the
  command words are not).
- Copy to clipboard: Firefox and WebKit grant no clipboard permission in Playwright — assert the
  copied text with the cross-engine clipboard helper of task-027-e2e-suite-on-firefox-and-webkit
  (its AC-1b).
- RP-55: the append-only rule of RP-43 also covers the web shell layout; in wave 1 this task
  merges after task-030 and task-031 (task-number order), rebased on `main` before its merge.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-13)

Read: this task; task-027 Execution Notes (design, decisions
D27-1…D27-4, red/green/refactor, reviews); `release-planning-rel-v0.2-plan` RP-43, RP-53, RP-55
(and session 4: T-01.2 and S-13.2 show *How to join*); `dev-loop-rel-v0.2-plan` session 1 (W0-1…
W0-10, hand-overs to Wave 1); `how-to-join.feature`, `identity.feature` S-13.1/S-13.2,
`requires-you.feature` T-01.2; story map §9.4, journey 6 (step 3 is marked **GAP**: no panel in
the UX reference); SARD REQ-SEC-08 description; spec-003 §4 (the `tech-lead` role), spec-004 §3
(`GET /api/p/:pid` identity, `GET /api/p/:pid/config`), `identity.schema.json`,
`config.schema.json` → `cli/dna-show.schema.json` (`team.members[]`: `name`, optional `email`,
`roles`; `team.roles[]`), spec-008 (§2 keys, §3 messages, §6 key build and X-09.1), spec-009
(tokens); ux-reference 1.0 §3 (*Current user*), §4.11 (*Identity*), §5 (modal dismissal); the
prototype (badge *non nel team*, Configuration › Identity rows; **no How to join panel**);
task-016 Execution Notes (W4-16…W4-22) and `web/src/project/ProjectHeader.tsx`, `model.ts`;
`web/src/routes/project.tsx`, `web/src/shell/Shell.tsx`, `add-project.tsx` (provider pattern),
`RemoveProjectDialog.tsx`, `web/src/api/queries.ts`, `query-keys.ts`, `web/src/team/model.ts`;
`server/src/presets/wingfoil.ts` (`TECH_LEAD_ROLE`); `test/README.md` 0.27;
`test/e2e/support/` (`screens.ts`, `strings.ts`, `clipboard.ts`, `identity.ts`, `events.ts`,
`axe.ts`, `keyboard.ts`), `test/e2e/project-header.spec.ts` S-13.1;
`lint/methodology-literals.js`.

**depends_on — task-027 (dl-015 gate).** Binding here: (1) C-08.2 asserts the copied text with
`test/e2e/support/clipboard.ts` — `allowClipboard(context, browserName)` in a `beforeEach`, then
`copiedBy(page, () => copyButton.click())` (sentinel + polled `readText()`, D27-3/W0-6), never a
spy on the page; (2) inner loop per W0-9: `npm run test:e2e:chromium` plus this task's own spec
files on the three engines with `npm run test:e2e -- how-to-join.spec.ts accessibility.spec.ts
project-header.spec.ts`; no engine branch in the spec (an engine difference would go into
`test/e2e/support/`); (3) a list filled by two queries is asserted with retrying expects, first
reads with `COLD_READ_MS` (bug-009): the panel reads the header **and** the configuration, so
every assertion on the leads and on the command retries with `COLD_READ_MS`; (4) temporary
folders per `test/README.md` *Temporary folders*; scratch names prefixed `task-035-`.

**CLI probe (2026-10-13, pinned `wingfoil@0.2.2`, scratch Kanban project, removed afterwards).**
`dna add --help` confirms `wingfoil dna add team.members --value <name> --entry-email <email>
--entry-roles <roles>` (comma-separated roles: `--entry-roles "developer, reviewer"` stores
`[developer, reviewer]`); a role not in `team.roles` is refused (`E_VALIDATION … references
undefined role`); `init --template Kanban` gives `team.members: []` and `dna show team` answers
it (an empty team is a valid DNA, so C-09.2 is reachable with `dna remove team.members`);
`dna update team.members --value Morgan --entry-roles approver` drops a role (C-09.1 setup). Each
verb commits (`wf(dna): …`).

#### AC classification

| AC | kind | red-first / check |
|----|------|-------------------|
| US-C-08 C-08.1 | **red-first** | component: the panel names the tech leads in DNA order and shows the command; e2e `how-to-join.spec.ts` › "C-08.1 …" fails today (the badge is a `<span>`, no panel) |
| US-C-08 C-08.2 | **red-first** | component: *Copy command* writes the builder's string (mocked `navigator.clipboard`), announces "Command copied"; a refusal shows the copy-failed text. e2e › "C-08.2 …" with `copiedBy` on the three engines |
| US-C-09 C-09.1 | **red-first** | model: no member holding `tech-lead` → `noLead`; e2e › "C-09.1 …" on a kanban copy where Morgan and Alex lose `tech-lead` (`cli(… dna update …)` before the console starts) |
| US-C-09 C-09.2 | **red-first** | model: `team.members: []` → `noMember`; e2e › "C-09.2 …" on a copy whose five members are removed with `dna remove` |
| accessibility bar | red-first + checks | keyboard: Tab reaches the badge button, Enter opens, focus moves into the dialog (visible ring), Tab reaches *Copy command* and *Close*, Escape closes and returns focus to the opener (`tabUntil`, `expectFocusVisible`); `scanThemes` on the open panel in each scenario (light + dark) |
| SCREENS / X-06.4 / X-09.1 | red-first | a new `SCREENS` entry "how to join panel" (D35-5) → X-06.4 axe and X-09.1 key build cover it; X-09.1 fails on the command until D35-3 is applied |
| REQ-INT-08 | check | own spec files on the three engines (W0-9) |

#### Component and file layout

- `web/src/project/join.ts` (pure, new) — `TECH_LEAD_ROLE` (D35-4); `joinView(header, config)`
  → `{ kind: 'leads', leads: {name, email?}[] } | { kind: 'noLead' } | { kind: 'noMember' }`
  plus `email` and `roles` (`team.roles[].name`, D35-6) — or `undefined` when the user is not
  `not-in-team` (D35-8); `joinCommand({ name, email, roles })` → the command string, the email
  quoted for a POSIX shell only when it holds a character outside `[A-Za-z0-9@%+=:,./_-]`
  (D35-7); the name in double quotes as the scenario writes it.
- `web/src/project/HowToJoin.tsx` (new) — `HowToJoinProvider` (holds the dialog's state, renders
  the dialog; keyed by `pid` inside, so nothing of one project's panel reaches another — task-016
  R1) and `useHowToJoin()` → `{ show(): void }` (D35-1; the hook 036 and 037 will call); the dialog:
  React Aria `ModalOverlay`/`Modal`/`Dialog` with `.modal`/`.dialog` classes of `base.css`,
  heading, Close (`common.action.close`) and Escape only (ux-reference §5), focus returned to the
  opener. Content: intro with the email; the leads list, or the no-lead / no-member sentence; the
  command in `<pre><code translate="no" class="cli-command">`; *Copy command*
  (`navigator.clipboard.writeText(joinCommand(…))`, then a polite status "Command copied"; a
  rejection → a `role="alert"` text "select it and copy it yourself"; no `execCommand` fallback);
  the roles hint (D35-6). A DNA read error (`config.dna.error`) shows `ErrorText` in place of the
  leads; the command is still shown (it needs only the email). Loading: one `role="status"` line
  until both queries answered.
- `web/src/project/how-to-join.css` (new) — the command block (`--font-mono`,
  `--color-surface-2`, tokens of spec-009 only; contrast checked by axe in both themes) and the
  badge-as-button (keeps `.current-user-badge` look plus focus ring and hover). No `base.css`
  change.
- `web/src/project/ProjectHeader.tsx` (task-016's component) — the *not in team* badge becomes a
  `Button` (`.current-user-badge`, accessible name `shell.howToJoin.badgeLabel`) calling
  `useHowToJoin().show()`; the not-in-team notice gets a *How to join* button (D35-2).
- `web/src/routes/project.tsx` (shell layout, RP-55) — the layout's fragment `<>…</>` becomes
  `<HowToJoinProvider pid={pid}>…</HowToJoinProvider>`: two changed lines and one import, the
  children keep their lines and indentation (append-only spirit: nothing reordered or reformatted).
- No route, no nav entry, no page title (the panel is a dialog over the current view).

#### Data read — no server change

Existing endpoints and shared queries only: `projectHeaderQuery(pid)` (`GET /api/p/:pid`,
`identity.kind === 'not-in-team'`, `email`, `dnaError`) and `projectConfigQuery(pid)`
(`GET /api/p/:pid/config`, `dna.data.team.members` and `team.roles`). Both are already read on
every project page (header) or by the DNA, Team and Memory views; the config read starts when the
panel opens (no extra CLI call on pages that do not open it; TT-PERF-05 and the process audits
are unaffected). Both keys are under `['p', pid]`, so a `repo` event refreshes the open panel
(D35-9). **No new query, no new query key, no contract change, no server task involved.**

#### Catalogue keys (all new, `shell.howToJoin.*`, inserted sorted — RP-43)

`badgeLabel` "Not in team — how to join", `open` "How to join", `title` "How to join this
project", `intro` "{email} is not in the team of this project. A team member adds you to the DNA
with this command:", `leads` "Ask a tech lead to run it:", `lead` "{name} '<'{email}'>'"
(apostrophe-quoted `<`, as task-016's `shell.header.notice.noIdentity`), `leadNoEmail` "{name}",
`noLead` "This project declares no tech lead — ask any member to run the command", `noMember`
"This project declares no team member — anyone with write access to the repository can run the
command", `commandLabel` "Command to add you to the team", `placeholderName` "'<Your Name>'",
`placeholderRoles` "'<roles>'", `roles` "Roles this project declares: {roles}" (D35-6), `copy`
"Copy command", `copied` "Command copied", `copyFailed` "The command could not be copied: select
it and copy it yourself.", `loading` "Reading the team…", `nowMember` "You are now a member of
this team." (D35-9). Existing `common.action.close` reused. The command words are **not** in the
catalogue (task Implementation Notes; D35-3); the placeholders are.

#### Test plan

- Vitest (jsdom), `test/web/project/`: `join.test.ts` — `joinView` (leads in DNA order; a lead
  without email; no lead; empty team; member / no-identity / ambiguous / `dnaError` → none),
  `joinCommand` (the scenario's string byte for byte; quoting of an email with a space, `$`, `'`;
  placeholders passed in), `TECH_LEAD_ROLE` equals `server/src/presets/wingfoil.ts`'s (D35-4);
  `how-to-join.test.tsx` — dialog opened by the badge and by the notice button, the texts of the
  three cases, copy success (status) and refusal (alert) with a mocked clipboard, Close/Escape
  return focus to the opener, a DNA read error, the panel following a refetch (D35-9), keyed by
  pid; `project-header.test.tsx` — the badge is a button only for `notInTeam` (not for
  `teamUnknown`, D35-8).
- Playwright `test/e2e/how-to-join.spec.ts` (`prebuild: ['kanban']`, user Riley via `actAs`):

  | Scenario | spec file › test |
  |----------|------------------|
  | C-08.1 | `how-to-join.spec.ts` › "C-08.1 — Name the tech leads and give the command" (leads `Morgan <morgan@example.test>`, `Alex <alex@example.test>`; the command text; accessible names; keyboard path; `scanThemes` 0) |
  | C-08.2 | `how-to-join.spec.ts` › "C-08.2 — Copy the command" (`allowClipboard` + `copiedBy` → equals the shown command and contains `riley@example.test`; "Command copied" visible) |
  | C-09.1 | `how-to-join.spec.ts` › "C-09.1 — Say that no tech lead is declared" (setup `dna update` of Morgan and Alex; the sentence; command with the email; `scanThemes` 0) |
  | C-09.2 | `how-to-join.spec.ts` › "C-09.2 — Explain an empty team" (setup `dna remove` ×5; the sentence; `scanThemes` 0) |

  `test/e2e/project-header.spec.ts` S-13.1 updated for the notice's *How to join* button (D35-2);
  `test/e2e/support/screens.ts` new screen (D35-5) → `accessibility.spec.ts` X-06.4 and X-09.1;
  `test/e2e/support/strings.ts` command rule (D35-3) with a self-test case in
  `test/e2e/harness/a11y-support.spec.ts`.
- Gates (dev-loop `refactor`): typecheck, lint, format:check, `test:coverage`,
  `docs:api`, `test:e2e:chromium` + own specs on three engines, `check_tasks.py v0.2`,
  `test:timing` only at load < 12.

#### Documentation to update with the behaviour

`docs/user-guide.md` (*How to join*), ux-reference §3 *Current user* (the decided panel, version
bump — journey 6 step 3 GAP closed), spec-008 §6 (D35-3 if (a)), `CHANGELOG.md` *Unreleased* ›
Added, `test/README.md` 0.28 (layout lines; version line), `CLAUDE.md` only if the shipped
surface list is touched at release time (not here).

#### Shared / append-only files touched (RP-43, RP-55)

| File | Change |
|------|--------|
| `web/src/i18n/en.json` | ~20 new `shell.howToJoin.*` keys, inserted in sorted place; no existing key changed |
| `web/src/routes/project.tsx` (shell layout) | fragment → `HowToJoinProvider` (2 lines) + 1 import |
| `test/e2e/support/screens.ts` (`SCREENS`) | one appended screen; `startScreensConsole` gains a third project (D35-5) |
| `test/e2e/support/strings.ts` | one added rule (D35-3) |
| `test/README.md` | version line 0.28 + layout lines |
| `CHANGELOG.md` | one *Unreleased* › Added line |
| `web/src/project/ProjectHeader.tsx`, `project-header.css` | badge button, notice button (task-016's files, not on the RP-43 list) |

Not touched: `queries.ts`, `query-keys.ts`, `projects.ts`, `PROJECT_ROUTES`/`tree.ts`, `nav.ts`,
`page-title.ts`, `base.css`, server `app.ts`, `local-security.test.ts`. **New shared function:**
`HowToJoinProvider` + `useHowToJoin()` (`web/src/project/HowToJoin.tsx`) — the opener task-036
(T-01.2) and task-037 (S-13.2) call; checkpoint requested (D35-1). No new shared query or key.

#### Tech-spec / UX gaps

- The UX reference and the prototype have no *How to join* panel (journey 6 step 3 **GAP**):
  form and entry points → D35-1, D35-2; contents beyond the scenarios → D35-6.
- spec-008 §6 X-09.1 accepts only key texts and project data; a command whose words are code (the
  task's Implementation Notes) fails it → D35-3 (spec-008 amendment needed for (a)).
- The role name `tech-lead` is WingFoil vocabulary held in `server/src/presets/wingfoil.ts`; the
  web has no presets → D35-4.
- `SCREENS` runs as Morgan, who has no *not in team* badge → D35-5.
- The scenarios write `wingfoil …`; a project whose CLI is project-local runs it as `npx
  wingfoil …` (`wingfoil.source`). Followed as written (the command a member runs in their shell);
  noted, no decision asked.

#### Open decisions (STOP: nothing depending on them is built before the answer)

- **D35-1 — panel form and opener.** ★ (a) a modal dialog (as *Add project*: title, Close,
  Escape, focus trapped and returned) rendered by a `HowToJoinProvider` in the project layout,
  opened through `useHowToJoin().show()` — one panel for the badge now and for Today (036) and the
  element panel (037) later; (b) a popover anchored to the badge (cannot be opened from Today or
  from the drawer without a second copy); (c) a route `/p/$pid/join` (a page, not a panel; leaves
  the view the user was on; adds a `PROJECT_ROUTES` row and a page title).
- **D35-2 — entry points in this task.** ★ (a) the badge (a button) **and** a *How to join*
  button after the not-in-team notice of the header strip (new key; the existing notice message is
  unchanged; S-13.1's exact-text assertion updated) — the badge alone does not look actionable;
  (b) the badge only, as the AC states; (c) the notice button only, the badge stays a label.
- **D35-3 — the command's words and X-09.1.** ★ (a) the command is built in code by
  `joinCommand` (words not translated, placeholders from the catalogue, as the task's
  Implementation Notes say) and shown in `code.cli-command[translate=no]`; `strings.ts` accepts
  that element's text only when it equals `joinCommand` rebuilt from data (the email) and the key
  texts of the two placeholders; spec-008 §6 amended with this one exception; (b) the whole
  command as one ICU message `wingfoil dna add team.members --value "{name}" --entry-email
  {email} --entry-roles {roles}` with a translator description (task-016's `git config` precedent;
  no checker change, but the command words become translatable text, against the Implementation
  Notes); (c) the server returns the command (data by construction; a contract change no task owns).
- **D35-4 — where the web reads the role name `tech-lead`.** ★ (a) a web constant in
  `web/src/project/join.ts` documented as WingFoil vocabulary (spec-003 §4), with a unit test
  pinning it equal to `server/src/presets/wingfoil.ts` `TECH_LEAD_ROLE`; (b) a runtime export in
  `@wingfoil-ui/contracts` used by both (the package exports only types today: build change);
  (c) a server field (e.g. `techLeads` in the header) — a contract change in a web task.
- **D35-5 — SCREENS coverage.** ★ (a) `startScreensConsole` adds a third project, a kanban copy
  where the user is Riley (`pids[2]`), and one appended screen "how to join panel" opens it there
  (the switcher screens then list three rows; nothing else changes); (b) the screen switches the
  identity of `pids[0]` with `git config` and restores it (order-dependent, slow: watcher refresh);
  (c) no `SCREENS` entry, the axe and key checks only in `how-to-join.spec.ts` (against the AC).
- **D35-6 — contents beyond the scenarios.** ★ (a) also list the roles the DNA declares
  (`team.roles`, "Roles this project declares: …") under the command — the CLI refuses a role not
  declared (probe), so `<roles>` is fillable; with an empty team only the no-member sentence
  (not also the no-lead one); (b) only what the scenarios state; (c) (a) plus a link to the Team
  view for "ask any member".
- **D35-7 — quoting the email in the command.** ★ (a) bare when it holds only
  `[A-Za-z0-9@%+=:,./_-]` (the scenario's form), else POSIX single quotes — a git email is free
  text and the command is pasted into a shell; (b) always bare (an email with a space or `$(…)`
  yields a broken or surprising command); (c) always quoted (breaks the scenario's text).
- **D35-8 — which identities get the panel.** ★ (a) `not-in-team` with a readable DNA only (the
  badge *not in team*); *team unknown* (DNA unreadable), *No identity* (no email for the command)
  and *Ambiguous* (already a member) get none; (b) also *team unknown*, with the command and no
  lead list.
- **D35-9 — the panel open while the repository changes** (`repo` event refreshes both queries).
  ★ (a) the panel follows the data; if the user becomes a member it shows "You are now a member of
  this team." with Close (focus not moved); (b) it closes itself when the identity is no longer
  `not-in-team` (focus returns to a badge that no longer exists).

#### Decisions (approver, 2026-10-13)

"As recommended": **D35-1 (a)** modal dialog, `HowToJoinProvider` + `useHowToJoin().show()` in the
project layout (fixed as the shared opener for task-036 and task-037); **D35-2 (a)** badge button
and a *How to join* button after the not-in-team notice (S-13.1's assertion updated);
**D35-3 (a)** the command built in code, `code.cli-command[translate=no]`, an X-09.1 rule in
`strings.ts`, spec-008 §6 amended in place with a dated Process Note; **D35-4 (a)** a web
constant pinned to the server preset by a unit test; **D35-5 (a)** a third screens-console
project (Riley) and one appended screen; **D35-6 (a)** the declared roles listed, only the
no-member sentence for an empty team; **D35-7 (a)** POSIX quoting only when needed; **D35-8 (a)**
only *not in team* with a readable DNA; **D35-9 (a)** the panel follows the data. Also: a short
*How to join* paragraph in the UX reference (`docs/00_reference/ux-reference.md`, version bump),
closing journey 6 step 3's GAP; shell layout `routes/project.tsx`: the minimal change only.

- **D35-10 (a)** (approver, 2026-10-14) — the X-09.1 check (`test/e2e/support/strings.ts`) accepts
  the no-initials glyph `?` only inside the current user's avatar (`.current-user-avatar`,
  aria-hidden): one rule plus self-test cases in `harness/a11y-support.spec.ts` (`?` in that
  avatar passes; `?` elsewhere, `?` in a member card's initials and another text in that avatar
  are flagged). No product change.

### red / green / refactor (2026-10-13)

- **Pure part (`2796012`)** — red first: `test/web/project/join.test.ts` failed to load (no
  module); green: `web/src/project/join.ts` (`TECH_LEAD_ROLE` pinned to the server preset,
  `joinEmail`, `joinTeam`, `shellWord`, `joinCommand`), 10/10.
- **Panel (`2796012`)** — red first: `test/web/project/how-to-join.test.tsx` 13 of 14 failed (no
  badge button, no dialog; the one passing case asserts an absence). Green:
  `web/src/project/HowToJoin.tsx` (`HowToJoinProvider`, `useHowToJoin`), `how-to-join.css`, the
  badge button and the notice button in `ProjectHeader.tsx`, the provider in
  `routes/project.tsx` (2 lines + 1 import), 18 `shell.howToJoin.*` keys. Deviations from the
  design: `commandLabel` dropped (an `aria-label` on a `<pre>` is a prohibited ARIA attribute; the
  intro sentence "…with this command:" labels it visibly), `leadsLabel` added (the leads list's
  accessible name "Tech leads"). Focus return asserted with `waitFor` (React Aria restores it
  asynchronously), from the keyboard.
- **e2e (`afaf666`)** — `how-to-join.spec.ts` C-08.1 … C-09.2; `support/strings.ts` command rule
  with three negative self-test cases in `harness/a11y-support.spec.ts` (English placeholder, an
  email not read, an unmarked element: all flagged); `support/screens.ts` third project (Riley) and
  the screen *how to join panel*; `no-commit.spec.ts` builds the same three repositories and checks
  the Riley copy is unchanged too; `project-header.spec.ts` S-13.1 and S-13.3 assert the notice's
  sentence (`p`) — S-13.1 also the notice button and the badge button. First Chromium run of the
  spec: 7/7 (with the self-tests).
- **X-09.1 finding of the new screen** (full Chromium run, below): (1) the declared roles rendered
  as one `formatList` argument ("developer, reviewer, …") failed the key-text check (a word with
  its comma is not data) — fixed in `beaf52f`: the roles are role chips (`RoleChips` of the DNA
  view), each one data, `shell.howToJoin.roles` without arguments; (2) **`span.current-user-avatar:
  ?`** — the v0.1 avatar of a user who is not one member (`NO_INITIALS = '?'`,
  `web/src/project/model.ts`, task-016), never scanned before because `SCREENS` ran as Morgan
  only. Reported to the coordinator as **D35-10** (options: ★ (a) the X-09.1 check accepts `?`
  in an avatar — aria-hidden, language-neutral; (b) a catalogue key for it; (c) an icon). Not
  fixed pending the decision: X-09.1 is red on the three engines for this one text.
- **Docs (`3571950`)** — spec-008 §6 amended in place + dated Process Note (specs carry no
  Version line; the Process Note is the record); ux-reference 1.1 §3 *How to join* row (closes
  journey 6 step 3's GAP); `docs/user-guide.md` 0.5 (*How to join*, marked v0.2 not released);
  `CHANGELOG.md` *Unreleased* › Added; `test/README.md` 0.28.

### checks (2026-10-13, HEAD `beaf52f` + this note)

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | 15.8 |
| `npm run test:coverage` (on `3571950`) | 123 files passed, 1 skipped; **2057 passed / 1 skipped**; statements 96.69 %, branches 90.96 %, functions 97.44 %, lines 98.32 % (`HowToJoin.tsx` 84 % statements: the header-error and header-loading branches are reachable only from the later openers of task-036/037) | 15.1 → 41.2 |
| `npm run docs:api` | OK | — |
| `check_tasks.py v0.2` | OK (17 tasks · 46 items) | — |
| `test/docs/public-text.test.ts` | 67 passed | — |
| `npm run test:e2e:chromium` (on `3571950`) | **136 passed, 1 failed** (X-09.1: the two texts above); 18.0 min | 41.0 → 34.7 |
| `npm run test:e2e -- how-to-join.spec.ts project-header.spec.ts accessibility.spec.ts no-commit.spec.ts harness/a11y-support.spec.ts` (three engines, on `beaf52f`) | **102 passed, 3 failed** — X-09.1 on each engine, only `span.current-user-avatar: ?` (D35-10); every How to join scenario, axe in both themes (C-08.1, C-09.1, C-09.2, X-06.4 over `SCREENS`), the clipboard copy and `no-commit` pass on Chromium, Firefox and WebKit; 8.2 min | 17.1 → 23.6 |
| `npm run test:timing` | **skipped**: load ≥ 12 throughout | — |

No console left after the runs (`pgrep -af bin/wingfoil-ui.cjs`); `wfui-*` entries in the system
temporary directory: 4 before, 2 after (other checkouts' runs share the machine; none from this
worktree).

e2e closure (scenario → spec file:test):

| Scenario | spec file › test |
|----------|------------------|
| C-08.1 | `test/e2e/how-to-join.spec.ts` › "C-08.1 — Name the tech leads and give the command" |
| C-08.2 | `test/e2e/how-to-join.spec.ts` › "with the clipboard" › "C-08.2 — Copy the command" |
| C-09.1 | `test/e2e/how-to-join.spec.ts` › "C-09.1 — Say that no tech lead is declared" |
| C-09.2 | `test/e2e/how-to-join.spec.ts` › "C-09.2 — Explain an empty team" |
| X-06.4 / X-09.1 coverage | `test/e2e/accessibility.spec.ts` over `SCREENS` › screen "how to join panel" |

### checks after D35-10 (2026-10-14, HEAD `991c698`)

- D35-10 red by fault injection (not committed): with the new rule commented out, the X-09.1
  self-test (`harness/a11y-support.spec.ts`) fails on the expected `span.current-user-avatar: ?`;
  restored → 3/3 on Chromium.

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | 13.7 |
| `check_tasks.py v0.2` | OK | — |
| `test/docs/public-text.test.ts` | 67 passed | — |
| `npm run test:e2e -- accessibility.spec.ts how-to-join.spec.ts project-header.spec.ts no-commit.spec.ts harness/a11y-support.spec.ts` (three engines) | **105 passed**, 0 failed (X-09.1 and X-06.4 over `SCREENS` incl. *how to join panel*, C-08.1 … C-09.2 with axe in both themes, the clipboard copy, `no-commit`); 8.1 min | 14.3 → 19.8 |
| `npm run test:e2e:chromium` (whole suite) | **137 passed**, 0 failed; 6.6 min | → 17.2 |
| `npm run test:timing` | **skipped**: load ≥ 12 | — |
| `npm run test:coverage` | not re-run: the change since the run above (`3571950`, 2057 passed) is test support only (`test/e2e/`), outside Vitest and coverage | — |

No console left (`pgrep -af bin/wingfoil-ui.cjs`). Ready for review; `main` (task-030, task-031)
to be merged into the branch by the coordinator before submit (RP-55).

### review (round 1, 2026-10-14)

Independent review: **FAIL** (2 minor, 5 nits). Verified as correct: the command against the
pinned CLI, D35-7 quoting (bash probes), shown == copied, catalogue sorted, both `strings.ts`
rules narrow with failing self-tests, the minimal shell change, docs, dl-005. Changes (`2dedc34`):

- **F1 (minor)** — an open panel whose identity changed to something other than `member` showed
  only title and Close. Change: *You are now a member of this team.* also for `ambiguous` (the
  email matches members, D35-8); any other identity without a panel (`no-identity`,
  `not-in-team` with an unreadable DNA) shows the new `shell.howToJoin.notApplicable` ("How to
  join no longer applies to you: the notice above the view says why this project is
  read-only."). One component test per transition (member, ambiguous, no identity, DNA
  unreadable).
- **F2 (minor)** — the swap was not announced. Change: the sentence is rendered in an
  always-present `role="status"` region of the panel (empty: `position: absolute`, out of the flex
  flow, still in the accessibility tree); the tests assert the region exists before the change
  and the sentence's closest `[role="status"]`.
- **F3 (nit)** — closing after the opener unmounted (the badge of a new member) left the focus on
  `<body>`. Change: the provider records the opener at `show()`; after closing, when the opener
  is no longer connected, `#main` (tabIndex -1) takes the focus. Test "gives the focus to the main
  region when the opener has gone"; fault injection (not committed): the focus line commented →
  that test fails, restored → passes.
- **F4 (nit)** — the name placeholder (a catalogue text) went into double quotes unescaped.
  Change: `doubleQuoted` escapes `\`, `"`, `$` and the backtick; unit tests for it and for a
  `joinCommand` with `N" $(x)`. The scenario's `"<Your Name>"` is unchanged.
- **F5 (nit)** — spec-008 §6 said "an email the page read" while the check rebuilds the command
  for every string value read. Change: the spec, the `strings.ts` comment and `test/README.md` say
  "a string value the page read (the email is one)"; the 2026-10-13 Process Note records it (F5).
- **F6 (nit)** — `NO_INITIALS` is exported from `web/src/project/model.ts` and imported by
  `test/e2e/support/strings.ts` (no copy).
- **F7 (nit)** — a D35-8 component case for *No identity* (no badge button, no *How to join*);
  the dialog has `aria-describedby` on the intro sentence (asserted). `rules.css` stays imported
  by `HowToJoin.tsx`: `RoleChips` is the DNA view's component and its styles live there; moving
  them to a shared file would touch task-019's CSS for no behaviour change.

Checks after the fixes (HEAD `2dedc34`):

| Gate | Result | Load |
|------|--------|------|
| `test/web/project/` | 71 passed | — |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `check_tasks.py v0.2`; public-text check | OK; 67 passed | — |
| `npm run test:coverage` | 123 files passed, 1 skipped; **2064 passed / 1 skipped**; statements 96.72 %, branches 91.06 %, functions 97.45 %, lines 98.38 % (`HowToJoin.tsx` 91.8 % / 84.9 %) | 4.6 → 22.7 |
| `npm run test:e2e -- how-to-join.spec.ts accessibility.spec.ts harness/a11y-support.spec.ts` (three engines) | **51 passed**, 0 failed; 4.4 min | 17.4 → 21.3 |
| `npm run test:e2e:chromium` (whole suite) | **137 passed**, 0 failed; 7.8 min | → 18.5 |
| `npm run test:timing` | skipped (load ≥ 12) | — |

### review (round 2, 2026-10-14)

Independent review: **PASS** (F1–F7 verified, the UX reference row matches). Three non-blocking
nits fixed (`e06bdc2`):

- **N1** — `!` cannot be escaped inside double quotes under bash history expansion. Change: the
  translator description of `shell.howToJoin.placeholderName` (in `defineMessages`, the
  mechanism task-016 uses) says the text must not contain `!`; `doubleQuoted`'s comment says so
  too; a unit test checks that the English placeholder holds no `!`.
- **N2** — `aria-describedby` pointed at a missing intro once the panel showed *now a member* /
  *no longer applies*. Change: the provider sets it only while the intro is rendered (the same
  condition, `joinEmail` of the cached header); the member-transition test asserts the attribute
  is gone. Fault injection (not committed): attribute always set → that test fails.
- **N3** — a mouse click that does not focus its button (WebKit) records `body` as the opener, so
  closing left the focus on `<body>`. Change: the `#main` fallback also applies when the recorded
  opener is `document.body`; test "gives the focus to the main region when a click focused no
  opener" (`fireEvent.click`, no focus move). Fault injection: condition removed → that test
  fails.

Checks (HEAD `e06bdc2`): `test/web/project/` 73 passed; typecheck, lint, format:check clean;
public-text 67 passed; `check_tasks.py v0.2` OK; `npm run test:e2e -- how-to-join.spec.ts
harness/a11y-support.spec.ts` on the three engines **21 passed** (1.0 min, load 5.6 → 12.4).
- `main` with task-030 and task-031 merged into the branch before submit (`3962fd2`): one
  conflict, the `test/README.md` version line (0.30 after 0.28 task-030, 0.29 task-031). On the
  merged branch: typecheck, lint, format:check clean; `check_tasks.py v0.2` OK; `test:coverage`
  2249 passed, 1 skipped (129 files), statements 96.78 %, branches 91.16 % (load 2.4 → 15);
  `npm run test:e2e -- how-to-join.spec.ts project-header.spec.ts accessibility.spec.ts
  no-commit.spec.ts harness/a11y-support.spec.ts` on three engines 105 passed in 8.1 min (load 15 → 23).
