---
id: task-039-repository-status-and-fetch-in-the-sidebar
type: task
title: "Repository status and fetch in the sidebar"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-Y-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-033-git-copy-state-repository-status-and-transport-routes", "task-034-auto-sync-scheduler-and-auto-push", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The repository status in the sidebar (Y1, Y2): branch, ahead/behind, local changes, detached
HEAD, *Fetch* with *Cancel*, the time of the last successful fetch and the last fetch error; the
sync controls and counts hidden without a remote (`has-remote`) and shown again once one is added;
a capability that does not apply hidden, one my role lacks read-only with the reason (S3).

**Backlog items:** US-Y-01, US-Y-02, US-Y-03, US-Y-04, US-S-11

- US-Y-01 — As a member, I want the branch, ahead/behind counts and local changes in the sidebar, so that I know whether my copy is current
- US-Y-02 — As a member, I want the remote fetched automatically (on by default) and on demand, so that ahead/behind is always fresh
- US-Y-03 — As a member, I want a failed fetch (offline, authentication) shown with the time of the last successful fetch, without blocking reading, so that I know how fresh the status is
- US-Y-04 — As a member of a repository with no remote, I want the sync controls hidden, so that the UI does not offer what cannot apply
- US-S-11 — As a member, I want a capability that applies to the project but that its WingFoil version or my role lacks shown read-only with the reason, and one that does not apply hidden, so that I can tell "not now" from "not here"

## Acceptance Criteria

- **US-Y-01** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-01.1 Show branch, ahead/behind and local changes; Y-01.2 Show an up-to-date copy; Y-01.3 Show a detached HEAD
- **US-Y-02** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-02.1 Fetch automatically; Y-02.2 Fetch on demand; Y-02.3 Do not fetch when auto-fetch is off
- **US-Y-03** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-03.1 Report a failed fetch with the last successful time; Y-03.2 Report a fetch refused for authentication
- **US-Y-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-04.1 Hide sync controls without a remote; Y-04.2 Show the controls once a remote is added
- **US-S-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-11.1 Show a capability my role lacks as read-only with the reason; S-11.2 Hide a capability that does not apply to the project

Also closes Y-01.3 of TT-STATE-04 (task-033-git-copy-state-repository-status-and-transport-routes) and Y-02.1 of TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push).
RP-53: Y-02.1, Y-02.3 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44). S-11.1 uses the informational footer of
task-037-gate-footer-with-every-outcome.

Screen: `docs/00_reference/ux-reference.md` §3 (*Git status* in the sidebar, *Sidebar*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-010` §3 (`repository`, `sync.fetch`), §5 (`no-remote`, `no-fetch-target`), §7
  (`has-remote` hides the controls, branch and local changes always shown); `spec-004` §3
  (`conditions`), §6 (`repo`); `spec-001` §6.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-16)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (hard rules, v0.2 additions, e2e
engines W0-9, lessons of Waves 0–4, the machine-free slot for heavy gates); the Execution Notes of
the three `depends_on` tasks (task-033, task-034, task-037: design, decisions, red/green/refactor,
every review round); `dev-loop-rel-v0.2-plan` Sessions 1–5 and the hand-overs to Wave 5;
`release-planning-rel-v0.2-plan` RP-14, RP-19, RP-25, RP-36, RP-37, RP-40, RP-43, RP-44, RP-52,
RP-53, RP-55; spec-010 (all, with its Process Notes), spec-003 §6, spec-004 §3/§6, spec-008 §4/§6;
`repository-status.feature` (Y-01.x, Y-04.x), `fetch.feature` (Y-02.x, Y-03.x),
`capabilities.feature` S-11.1/S-11.2, `update.feature` and `push.feature` (task-040's wording on
the same sidebar); the task descriptions of task-038, task-040, task-041 (parallel and next
neighbours); ux-reference 1.4 §2, §3 (*Git status*, *Sidebar*); the prototype's sidebar foot (a
block under a divider: status dot + "In sync with git" or "N commits to push" + *Push*, then
`main @ <hash>` in mono; no fetch control in the prototype); code: `web/src/routes/project.tsx`
(`ProjectNav`, layout), `routes/nav.ts`, `web/src/api/{queries,query-keys,writes,client,events,
error-message}.ts`, `web/src/project/ProjectHeader.tsx`, `web/src/element/ElementFooter.tsx`,
`web/src/shell/ErrorText.tsx`, `web/src/theme/base.css` (`.project-nav` is the sticky sidebar),
`contracts/src/git.ts`, `contracts/src/state.ts` (`UiSettings`); tests `test/e2e/support/*`
(`console.ts` seeds `settings: {}`, `git-http.ts` with `credentials` and `hold`, `screens.ts`,
`strings.ts` date renderings, `cold-read.ts` `refreshClock`), `test/e2e/gate-footer.spec.ts`,
`test/server/http/git-console.ts` (`remoteCommit`), `test/timing/auto-sync.timing.test.ts`
(`GIT_TRACE` count).

**depends_on (dl-015 hard gate) — task-033, task-034, task-037, acknowledged.**

- task-033: `GET /api/p/:pid` carries `repository` (`branch`, `copy`, `ahead`, `behind`,
  `upstream`, `localChanges`, `head`, `sync`) and top-level `conditions` (`has-remote`), both
  required (D33-14); the sync controls are hidden by `has-remote`, never by `copy`, and the branch
  and local changes always shown (spec-010 §7). `POST …/git/fetch` takes no body or `{}`; 200
  `{ repository }`; 409 refusals `no-remote`, `no-fetch-target`, `refspec-outside-remotes`,
  `remote-not-owned`, `remote-unreadable` are **not** recorded in `sync.fetch.lastError` (only git
  failures are: 422 `git-refused`, message redacted, ≤ 4 000 characters); a fetch is allowed to an
  unidentified user (RP-14). Cancel: the page aborts the request, the server kills the process
  group; open point still standing — the aborted request answers 500 `internal` to a client that
  has left and nothing is recorded, so the page must treat its own abort as "cancelled", never as
  an error. `repo` is sent when the copy state or a last error changes (RP-40), never for a new
  `lastSuccessAt` alone (read by the next `GET`). Catalogue `error.*` keys of every transport code
  already exist (D33-13, D34-9/10, W4-9, W4-14); `errorMessage` renders `detail.files` as a list.
- task-034: every real-bin console fetches every 60 s (`autoFetch` on by default); a test that
  counts git processes or wants a stable copy seeds `autoFetch: false` through the state file; the
  e2e settings seed helper was left to tasks 039–041 (C5); `fetchIntervalSeconds` minimum 15 (RP-19,
  RP-53); a change of `autoFetch`/interval re-arms the timer with an immediate tick; codes recorded:
  `sync.fetch.lastError.code` `fetch-timeout` / `config-in-worktree` (empty message),
  `sync.update.lastError.code` incl. `merge-not-fast-forward`, `config-in-worktree`, `diverged`,
  `local-changes-in-the-way` (`detail.files`); the 0-fetch count uses the bin's `GIT_TRACE` file,
  which must also hold a `git status` line (not vacuous).
- task-037: the gate footer shows disabled outcomes with the descriptor's reason as visible line and
  accessible description (`element.reason.*`, D37-8); a member without the gate's role gets "Reserved
  to {role} — {members} can act" (G-09.x) — S-11.1 runs on it here; `element.reason.copyDetached`
  reads "Blocked: your copy is on a detached HEAD" while Y-01.3 expects "Blocked: no branch checked
  out" (D39-11); task-040 appends "— Update" to `copyBehind`.

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| Y-01.1, Y-01.2 (branch, "1 ahead", "2 behind", "3 local changes"; "In sync with git") | **red-first** | `test/web/repository/model.test.ts` (pure view of every `copy`), `test/web/repository/git-status.test.tsx`; e2e |
| Y-01.3 sidebar part ("Detached HEAD" + short hash) | **red-first** | same; e2e |
| Y-01.3 "governed actions are blocked with 'Blocked: no branch checked out'" | **characterization** of task-033 row 8 / task-037 footer; **red-first** for the text if D39-11 (a) | e2e on `task-001-login-form` |
| Y-02.1 (auto-fetch → "1 behind" by itself; interval 15 s, RP-53) | **red-first** (UI); the scheduler is **characterization** (task-034) | e2e; timing per D39-10 |
| Y-02.2 (Fetch on demand) | **red-first** | component (request, pending, Cancel), `test/web/api/git.test.ts`; e2e |
| Y-02.3 (auto-fetch off → 0 `git fetch`) | **characterization** (server, task-034) + **red-first** UI part (the sidebar still reads "In sync with git" after a remote commit) | e2e (D39-9) |
| Y-03.1, Y-03.2 (failed fetch with last successful time; git's message) | **red-first** | model + component (time selection, message reachable on hover and focus); e2e (unreachable remote; git-http `credentials`) |
| Y-04.1 (no remote: branch + local changes, no Fetch/Update/Push) | **red-first** with a positive control (a guard-removal check, since nothing renders today) | component; e2e |
| Y-04.2 (Fetch shown once a remote is added, 5 s) | **red-first** UI; refresh path **characterization** (task-033 watcher, `repo`) | e2e `@live-refresh` + `refreshClock` (5 s only in `test:timing`) |
| S-11.1 (Jordan, `dl-002-use-fastify`: "Reserved to approver — Morgan, Alex can act") | **characterization** (task-037 footer) | e2e |
| S-11.2 (no Push/Fetch/Update on Today without a remote) | **red-first** with guard removal | e2e |
| Fetch *Cancel* (description, RP-37) | **red-first** | component (abort → no error shown); e2e with git-http `hold` |
| fetch refusals 409 (not recorded) shown | **red-first** | component |
| `sync.update.lastError` rendered (hand-over) per D39-6 | **red-first** | model + component |
| SCREENS / X-06.4 / X-09.1 (D39-12) | **red-first** | appended screen; own-spec `scanThemes` on the states |
| REQ-INT-08 | check | own spec on the three engines (W0-9) |

e2e closure (planned):

| Scenario | spec file › test |
|----------|------------------|
| Y-01.1, Y-01.2, Y-01.3 (TT-STATE-04 Y-01.3 of task-033) | `test/e2e/git-status.spec.ts` › "Y-01.1 — …", "Y-01.2 — …", "Y-01.3 — …" |
| Y-02.1 (TT-PERF-07 Y-02.1 of task-034), Y-02.2, Y-02.3 | `git-status.spec.ts` › "Y-02.1 — …", "Y-02.2 — …", "Y-02.3 — …" |
| Y-03.1, Y-03.2 | `git-status.spec.ts` › "Y-03.1 — …", "Y-03.2 — …" |
| Y-04.1, Y-04.2 | `git-status.spec.ts` › "Y-04.1 — …", "Y-04.2 — …" (`@live-refresh`) |
| S-11.1, S-11.2 | `git-status.spec.ts` › "S-11.1 — …", "S-11.2 — …" |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` over `SCREENS` › the appended screen (D39-12) |

#### What the sidebar shows (pure, `web/src/repository/model.ts`)

`gitStatusView(repository, conditions)` → `{ head: {branch} | {detached, commit}, commit (7 chars,
none before the first commit), localChanges, sync?: { copy line, fetch: { failed?, lastSuccessAt },
update?: lastError } }` — `sync` absent unless `has-remote` holds (spec-010 §7). Copy line per
`copy` (D39-7): `in-sync` "In sync with git"; `ahead` "{n} ahead"; `behind` "{n} behind";
`diverged` "{a} ahead · {b} behind"; `no-upstream` (upstream named or not); `detached` no counts;
`no-remote` never (has-remote false). Local changes "{n, plural, …} local changes" whenever > 0,
with or without a remote. No methodology literal (REQ-ARC-05): the copy values are compared through
a table keyed by the contract type, not as bare literals where the lint applies.

#### Component and file layout (planned, pending D39-1 … D39-13)

- `web/src/repository/model.ts` (new, pure), `web/src/repository/GitStatus.tsx` (new),
  `web/src/repository/git-status.css` (new; spec-009 tokens only). task-040 extends these with
  *Update* and *Push*.
- `web/src/api/git.ts` (new, **shared** with task-040, D39-2): `postGitOperation(pid, op, signal?)`
  and `useGitOperation()`.
- `web/src/routes/project.tsx` (shell layout, RP-55 append-only): the sidebar foot (D39-1).
- `web/src/theme/base.css`: only if D39-1 (a) (the sticky rule moves to the wrapper).
- `web/src/i18n/en.json`: `shell.git.*` keys inserted sorted; `element.reason.copyDetached` text if
  D39-11 (a).
- `test/e2e/support/console.ts`: `ConsoleOptions.settings` (D39-3, **shared**);
  `test/e2e/support/remote.ts` (new, **shared** with task-040): `remoteCommit(fixture, file,
  content)` (another clone pushing to the copy's bare `origin`), `setRemoteUrl(fixture, url)`;
  `test/e2e/support/screens.ts` (D39-12, append-only); `test/e2e/support/strings.ts` (one appended
  rendering if D39-8 (a)).
- Docs: `docs/user-guide.md` (*Git status in the sidebar*: what is shown, Fetch and Cancel, the
  failure line; the transport statement of spec-010 §4 that task-033 left to the sidebar tasks),
  `docs/00_reference/ux-reference.md` §3 *Git status* v0.2 bullet (`ux-consistency`), `CHANGELOG.md`
  *Unreleased* › Added, `test/README.md` version line + layout lines — version numbers from the
  coordinator.

#### Test plan

- Vitest (jsdom): `test/web/repository/model.test.ts` (every `copy`, has-remote on/off, detached,
  initial commit, local changes 0/1/n, fetch error with and without `code`, `lastSuccessAt` null /
  today / earlier, update error codes); `test/web/repository/git-status.test.tsx` (rendering per
  state; Fetch → `POST …/git/fetch` with no body; pending: Fetch aria-disabled "Fetching…", Cancel
  shown, status region; Cancel aborts and shows no error; 200 → header data updated from the
  response; 409 refusal → alert with the catalogue text, cleared on the next fetch; 422 → header
  re-read; git's message reachable on hover and on keyboard focus and as accessible description;
  keyed by pid: a running fetch of project A never shows in B); `test/web/api/git.test.ts` (path,
  method, signal, cache update / invalidation); `test/web/routes/*` only where the layout test
  needs the foot.
- Playwright `test/e2e/git-status.spec.ts` (`prebuild: ['kanban', 'custom']`), one test per
  scenario, each on its own fixture copy, settings seeded `autoFetch: false` except Y-02.1
  (interval 15 s); `scanThemes` on the sidebar in Y-01.1, Y-01.3, Y-03.1 (tooltip open), Y-04.1;
  the cancel test with `startGitHttpRemote(…, { hold: true })`; Y-03.1 with an `http://127.0.0.1`
  port nothing listens on (git-refused, not `remote-unreadable`); Y-03.2 with git-http
  `credentials` (git: "could not read Username … terminal prompts disabled"); expected times
  computed in the page with the same Intl options from the API's `lastSuccessAt`.
- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `test:e2e:chromium` + own
  specs (`git-status.spec.ts`, `accessibility.spec.ts`, and any spec whose sidebar assertions move)
  on the three engines, `check_tasks.py v0.2`; `test:timing` only at load < 12 — every heavy gate
  through the machine-free slot.

#### Open decisions (STOP: reported to the coordinator as D39-1 … D39-13; nothing depending on
them is built before the answer)
