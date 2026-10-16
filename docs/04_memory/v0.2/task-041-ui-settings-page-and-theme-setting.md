---
id: task-041-ui-settings-page-and-theme-setting
type: task
title: "UI settings page and theme setting"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-C-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit", "task-030-ui-settings-store-and-settings-api", "task-034-auto-sync-scheduler-and-auto-push"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The UI settings page (C4): auto-fetch and its interval, auto-update, auto-push, theme, agent
launch confirmation and the action-log cap, stored per user in the local state (never committed),
applied without a restart; the theme setting overrides `prefers-color-scheme` (X-08.3, attached
here by RP-16 — no v0.2 backlog record carries it; on the session-4 audit checklist, RP-50).

**Backlog items:** US-C-07

- US-C-07 — As a member, I want local, per-user settings — auto-fetch, auto-update, auto-push, theme, agent launch confirmation — kept on my machine and never committed, so that my preferences do not change the project

## Acceptance Criteria

- **US-C-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/ui-settings.feature`: C-07.1 Show the settings with their defaults; C-07.2 Keep a setting across restarts without touching the project; C-07.3 Apply a setting change without a restart
- **X-08.3** (US-X-08, v0.1 story; RP-16) — `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-08.3 Override
  the system with the theme setting.

Also closes C-07.1, C-07.3 of TT-STATE-09 (task-030-ui-settings-store-and-settings-api) and C-07.3 of TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push).
RP-53: Y-02.1, Y-02.3 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44).
RP-15: "Confirm agent launch" is stored and shown with a note that it takes effect from WingFoil
0.3.

Screen: `docs/00_reference/ux-reference.md` §4.11 (*Configuration*, UI settings part only) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-006` §2 (settings table, ranges, defaults), `spec-004` §3 (`PUT` takes the whole object),
  §6 (`settings` event: other tabs follow); `spec-009` §1 (theme selection), RP-19, RP-26.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-16)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (all sections, the machine-free
slot of Wave 5 included); the Execution Notes of the three `depends_on` tasks — task-027 (design,
D27-1 … D27-4, the engine rule W0-9), task-030 (design, D30-1 … D30-5, the shared shapes, both
review rounds), task-034 (design, D34-1 … D34-11, the four security rounds, W4-1 … W4-16, *For the
retrospective*, the hand-over to this task); `dev-loop-rel-v0.2-plan` Sessions 1–5 and the
hand-overs to Wave 5; `release-planning-rel-v0.2-plan` RP-15, RP-16, RP-19, RP-26, RP-38 … RP-40,
RP-43, RP-44, RP-50, RP-53, RP-55; spec-006 §2 (settings table), spec-004 §3, §6, spec-009 (all),
spec-008 §3, §6; `ui-settings.feature` (C-07.1 … C-07.3), `themes-and-strings.feature` (X-08.x);
`ux-reference.md` 1.4 §2, §3, §4.11, §5 and the prototype's *Configurazione* screen (a sub-tab row;
the *WingFoil* tab's grouped cards, one row per setting with label, hint, a switch or a segmented
control; no UI-settings tab and no theme in the prototype); task-038 and task-039 (the Wave 5
siblings: toasts, sidebar git status); code: `web/index.html` (theme script), `web/src/main.tsx`,
`app.tsx`, `api/` (`client.ts`, `queries.ts`, `query-keys.ts`, `events.ts`, `projects.ts`),
`routes/` (`tree.ts`, `nav.ts`, `project.tsx`, `team.tsx`), `shell/` (`Shell.tsx`, `page-title.ts`,
`add-project.tsx` segmented radio group), `theme/base.css`; tests `test/web/theme/theme-script.test.ts`,
`test/e2e/support/` (`console.ts`, `screens.ts`, `axe.ts`), `test/e2e/accessibility.spec.ts`
(X-08.1, X-08.2), `test/e2e/no-commit.spec.ts`, `test/timing/auto-sync.timing.test.ts`,
`test/launcher/auto-sync.test.ts`; `docs/user-guide.md` 0.11 (*Automatic sync with the remote*,
*Before you turn Auto-update on*, *Themes*), `CHANGELOG.md` *Unreleased*.

**depends_on (dl-015 hard gate) — task-027, task-030, task-034, acknowledged.**

- task-027: the task's own e2e spec runs on Chromium, Firefox and WebKit (`npm run test:e2e --
  <spec>`), the whole suite on Chromium in the inner loop (W0-9); no engine branch in a spec; the
  WebKit dark-theme default button colours (D27-1) mean every control of the page is styled with
  the tokens (axe in both themes on WebKit).
- task-030: `GET /api/settings` re-reads the state file (D30-3) and returns the 7 keys;
  `PUT /api/settings` takes the **whole** object (RP-28), strict (a wrong type, an out-of-range or
  non-integer number → 400 `invalid-request`, nothing stored, no event), answers 200 with the
  stored settings and publishes one `settings` event with an empty payload; a `PUT` on a newer
  build's state answers 200 for this run only (D30-5; the shell already shows `state.newerVersion`);
  lowering `actionLogCap` trims the log in the same write (RP-38); the web query key `['settings']`
  and `settingsQuery` were left to this task (proposed there so that task-040 and task-042 do not
  pick other keys). No server or contract change is needed here.
- task-034: the scheduler reads the settings at each tick (`store.reload()`), re-arms only on an
  `autoFetch` / `fetchIntervalSeconds` change (RP-40), reads `autoFetch` again before each group;
  `autoPush` is read at each governed write. The declared residual of `autoUpdate` (W4-16) is shown
  next to the setting (approver's decision below). Every real-bin console fetches every 60 s by
  default: an e2e that counts git processes seeds `autoFetch: false` or its own interval; the
  settings seed of e2e consoles is left to tasks 039–041 (Wave 4 C5). `fetchIntervalSeconds` 15
  for the interval-bound scenarios in `test:e2e` (RP-53); real budgets only in `test:timing`
  (Chromium, RP-44). Counting `git fetch` processes: the bin's `GIT_TRACE` file (`built-in: git
  fetch`), as task-034's timing test.

**Approver's decision (given, not open):** next to the *Auto-update* setting the page shows, from
the catalogue, exactly: "Auto-update does what `git pull` does, on a timer: incoming commits can
run commands your own git configuration points at (filter drivers, credential helpers, aliases).
Leave it off if your configuration runs scripts from your projects." plus a pointer to the user
guide section *Before you turn Auto-update on* (`docs/user-guide.md`). Only its rendering and
association are proposed here (D41-8).

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| C-07.1 the page shows the 7 settings with the spec-006 §2 defaults (Auto-fetch on, Auto-update off, Auto-push off, Theme System, Confirm agent launch on; interval 60, cap 5 000) | **red-first** | `test/web/settings/ui-settings.test.tsx` (rendered from a `GET` answer of `{…defaults}`; role `switch` checked states, radio *System* checked, field values); e2e `test/e2e/ui-settings.spec.ts` › C-07.1 |
| C-07.2 a change survives a restart; the project is untouched | **red-first** (the page) | e2e › C-07.2 (test-owned `stateDir`, a second console, `git status --porcelain` empty and HEAD unchanged); the store side is task-030's (`test/launcher/settings.test.ts`) |
| C-07.3 a change applies without a restart (Auto-fetch off → no `git fetch`) | **red-first** (the page's `PUT`) + characterization (scheduler, task-034) | e2e › C-07.3 at 15 s (D41-10); `test/timing/ui-settings.timing.test.ts` at 60 s / 120 s (D41-11) |
| X-08.3 the Theme setting overrides `prefers-color-scheme` | **red-first** | `test/web/theme/theme-script.test.ts` (appended rows: the setting attribute wins over the media query, follows its changes, `system` follows the media again); `test/web/settings/theme-setting.test.tsx`; e2e › X-08.3 (emulated dark, *Light* chosen → light tokens on `body`, kept after a reload and after a media change; *System* → dark again) |
| PUT takes the whole object; only valid values are sent | **red-first** | `test/web/api/settings.test.tsx` (body = the cached settings with the one change, every key; the serialized scope; a 400 / unreachable → cache rolled back, alert); `test/web/settings/model.test.ts` (field validation 15–3600, 100–100 000, whole numbers) |
| other tabs follow (`settings` event, spec-004 §6) | **red-first** | `test/web/api/events.test.ts` (appended row: `settings` invalidates `['settings']`); e2e › "another tab follows" |
| RP-15 "Confirm agent launch" stored, shown with the WingFoil 0.3 note | **red-first** | unit (the note is the switch's accessible description); e2e › C-07.1 |
| declared residual next to Auto-update | **red-first** | unit + e2e (`toHaveAccessibleDescription` of the *Auto-update* switch holds the text; the pointer is visible) |
| accessibility bar: keyboard, visible focus, axe both themes, X-09.1 | **red-first** | e2e › keyboard walk (`tabUntil`, `expectFocusVisible`, Space toggles a switch, arrows move the theme radio) and `scanThemes`; a `SCREENS` entry (X-06.4 axe, X-09.1 key build, `no-commit.spec.ts`) |
| sidebar *Configuration* pinned at the bottom (ux-reference §2) | **red-first** | `test/web/routes/nav.test.ts` (appended: the heading-less `pinned` group comes last); e2e › C-07.1 reaches the page from the sidebar |

#### Flow

- **Route** (D41-1): `/p/$pid/configuration` (sidebar entry, D41-2) redirects to
  `/p/$pid/configuration/ui-settings`. The page: `h1` *Configuration*, a sub-tab row of links
  (`nav` labelled *Configuration sections*, `aria-current="page"`; one link in v0.2, *UI
  settings*), then the UI settings: one intro sentence (kept on this computer, for every project,
  never committed) and cards by purpose — *Sync with the remote* (Auto-fetch, Fetch interval,
  Auto-update with the residual, Auto-push), *Appearance* (Theme: *System* / *Light* / *Dark*,
  the segmented radio group of the add-project dialog), *Agents* (Confirm agent launch with the
  RP-15 note), *Action log* (entries kept; "lowering it removes the oldest entries at once").
  Settings are global: the same page under every project.
- **Read:** `settingsQuery()` (`GET /api/settings`, key `['settings']`, D41-7); loading line
  `role="status"` and a read error with the catalogue text (as the other views).
- **Write** (D41-3, D41-4, D41-9): each control saves on its own — a switch or the theme radio on
  change, a number field on blur or Enter once valid (a whole number in range; otherwise a field
  error from the catalogue and nothing sent). The body is the whole object: the cached settings
  with the change (RP-28). Mutations share one scope (TanStack Query `scope: { id: 'settings' }`,
  run one after the other, each body built when it runs); optimistic cache update; on 200 the cache
  takes the answer; on a failure the cache is read again and an alert (outside the cards) names the
  setting and the catalogue error text, cleared by the next successful save; a polite status region
  says "Saved".
- **Theme** (D41-5, D41-6): a `ThemeSetting` component, mounted once in `App`, follows
  `settingsQuery` and writes `data-theme-setting` on `<html>` (`light` / `dark`; removed for
  `system`). The inline script of `index.html` stays the only writer of `data-theme`: the setting
  attribute when it is `light` or `dark`, else the media query; re-applied on a media change and on
  a change of the attribute (MutationObserver). Before the settings answer, the system theme applies.
- **Other tabs:** the `settings` event invalidates `['settings']` (D41-7); this tab's own `PUT`
  echoes one refetch. A second console on the same state directory is seen at the next read
  (D30-3), no event.

#### File layout (planned)

- New: `web/src/routes/configuration.tsx` (the three routes, nav entry, titles); `web/src/settings/`
  — `UiSettingsView.tsx`, `model.ts` (fields, validation, `withChange`), `ThemeSetting.tsx`,
  `settings.css`; `web/src/api/settings.ts` (`putSettings`, `useSaveSettings`).
- Shared, append-only (listed in the report): `web/src/api/queries.ts` (`settingsQuery`),
  `web/src/api/query-keys.ts` (`settings`), `web/src/api/events.ts` (one built-in branch),
  `web/src/app.tsx` (`<ThemeSetting />`), `web/src/routes/tree.ts` (one `PROJECT_ROUTES` line),
  `web/src/routes/nav.ts` (`pinned` group, `NAV_ORDER.configuration`), `web/src/routes/project.tsx`
  and `web/src/theme/base.css` (the pinned group at the bottom of the sidebar — shape shared with
  task-039's git status), `web/index.html` (theme script; only this task), `web/src/i18n/en.json`
  (`settings.*`, `shell.nav.configuration`, inserted in sorted place), `test/e2e/support/screens.ts`
  (one entry), `test/e2e/support/console.ts` (settings seed, D41-12), `test/README.md` (version line,
  suites), `docs/user-guide.md` (version line; a *UI settings* section; *Automatic sync* and
  *Themes* no longer say "not shipped yet"; *Before you turn Auto-update on* becomes a heading so the
  pointer names a section), `CHANGELOG.md` *Unreleased* › *Added*, `docs/00_reference/ux-reference.md`
  (§4.11 *UI settings* in v0.2, §2 pinned entry; version line), spec-009 §1 dated Process Note
  (`data-theme-setting`, D41-5/D41-6). No server, contract or `local-security` change.

#### Test plan (scenario → file)

| Suite | File | What |
|-------|------|------|
| unit | `test/web/theme/theme-script.test.ts` (appended) | X-08.3 script side: attribute `light`/`dark` wins over either media value; media change while forced → unchanged; attribute removed → media again |
| unit | `test/web/settings/model.test.ts` (new) | number validation (15, 3600, 14, 3601, 60.5, "", "1e3"; 100, 100000, 99, 100001); `withChange` keeps every key |
| unit | `test/web/settings/ui-settings.test.tsx` (new) | C-07.1 defaults; each control sends the whole object once; invalid field → error, no request; failure → alert + rollback, cleared on next save; "Saved" status; the residual and RP-15 note as accessible descriptions; loading and read error |
| unit | `test/web/settings/theme-setting.test.tsx` (new) | `data-theme-setting` follows the query (light, dark, system removes it) |
| unit | `test/web/api/settings.test.tsx` (new), `events.test.ts` (appended), `queries.test.ts` (appended) | `PUT` path/body, serialized scope, cache on 200; `settings` event invalidates `['settings']`; the key |
| unit | `test/web/routes/nav.test.ts` (appended) | the `pinned` group last, heading-less |
| e2e | `test/e2e/ui-settings.spec.ts` (new, three engines) | `C-07.1 …` (from the sidebar, defaults, residual and note visible and as descriptions); `C-07.2 …` (Auto-push on, console stopped and started on the same `stateDir`, still on, `git status --porcelain` empty, HEAD unchanged); `C-07.3 …` (D41-10); `X-08.3 …`; another tab follows a change; keyboard walk with visible focus; invalid interval shows the error and keeps the stored value; axe in both themes (`scanThemes`, theme *System*) |
| e2e | `test/e2e/support/screens.ts` (appended) | `configuration — UI settings` (opens the page only; never changes a setting: the screens console is shared) |
| timing | `test/timing/ui-settings.timing.test.ts` (new, D41-11) | C-07.3 at the default 60 s: after a fetch, `PUT` `autoFetch: false` → 0 `git fetch` in 120 s (`GIT_TRACE`), the load printed |

e2e closure (this task's scenarios, filled at green with `spec file:test`):

| Scenario | Spec file: test |
|----------|-----------------|
| C-07.1 | `test/e2e/ui-settings.spec.ts`: C-07.1 — Show the settings with their defaults |
| C-07.2 | `test/e2e/ui-settings.spec.ts`: C-07.2 — Keep a setting across restarts without touching the project |
| C-07.3 | `test/e2e/ui-settings.spec.ts`: C-07.3 — Apply a setting change without a restart (15 s, RP-53); 120 s in `test:timing` |
| X-08.3 | `test/e2e/ui-settings.spec.ts`: X-08.3 — Override the system with the theme setting |

Tech-spec check: spec-006 §2 and spec-004 §3/§6 cover the data and the API; spec-009 §1 says the
setting overrides the system but not how the script and the application share `data-theme` — a
dated Process Note after D41-5/D41-6. ux-reference §4.11 has no *UI settings* tab and §2 no rule
for a pinned entry's markup: recorded as v0.2 additions after D41-1/D41-2 (directive
`ux-consistency`).

#### Open decisions — listed in the report to the coordinator as D41-1 … D41-13

- **D41-1** — route `/p/$pid/configuration` (→ `/p/$pid/configuration/ui-settings`), sub-tab row of links. Options: (a) ★; (b) a global `/settings`; (c) both.
- **D41-2** — *Configuration* in a heading-less `pinned` nav group, last, pushed to the bottom of the nav. (b) in *Repository*; (c) a hand-written link.
- **D41-3** — every control saves on its own, whole object, serialized optimistic mutations, rollback and alert on failure. (b) Save/Cancel form; (c) not optimistic.
- **D41-4** — number fields as a TextField with catalogue errors, an invalid value never sent. (b) NumberField (clamps, library strings); (c) presets.
- **D41-5** — the inline script is the only writer of `data-theme`; React writes `data-theme-setting`. (b) React writes `data-theme`; (c) server-rendered.
- **D41-6** — the setting applies when the settings query answers. (b) prefetch before the first render; (c) localStorage cache.
- **D41-7** — `settingsQuery` / `queryKeys.settings()` = `['settings']`, a built-in `settings` rule in `events.ts`, `web/src/api/settings.ts`. (b) local subscription; (c) private to the page.
- **D41-8** — the residual as the *Auto-update* switch's description (`aria-describedby`), `git pull` as code, a text pointer to the user guide (no link); the guide's paragraph becomes a heading. (b) external link; (c) collapsed disclosure.
- **D41-9** — no toast: a polite "Saved" status and an alert for a failed save. (b) task-038's toasts; (c) failure alert only.
- **D41-10** — C-07.3 e2e at 15 s: after a fetch has ended, turn Auto-fetch off, then 35 s with no `git fetch`. (b) count from the `PUT` alone; (c) 120 s at 15 s.
- **D41-11** — C-07.3 at 60 s / 120 s in a Vitest timing test. (b) Playwright timing; (c) none.
- **D41-12** — e2e seed `ConsoleOptions.settings?: Partial<UiSettings>`. (b) `seedState` helper; (c) raw `stateFile`.
- **D41-13** — "Confirm agent launch": a fixed note "takes effect from WingFoil 0.3" as its description. (b) per capability; (c) disabled.

#### Decisions (approver, 2026-10-16)

"All as recommended": D41-1 … D41-13 (a). Coordinator's Wave 5 shared shapes: C1 merge order
038 → 039 → 041; C2 `ConsoleOptions.settings` owned by task-038 — an identical copy carried here
until it merges; C3 task-039 owns the `.project-sidebar` wrapper and `.sidebar-foot` in
`routes/project.tsx` — this task does not touch that file, it adds the `pinned` group in `nav.ts` and
the CSS that pushes it to the bottom of the nav; C4 no toast here; C5 this task owns `settingsQuery`,
`queryKeys.settings()`, the `settings` rule of `events.ts` and `web/src/api/settings.ts`; C6
catalogue: sorted in-place inserts only; C7 `test/README.md` 0.39, `docs/user-guide.md` 0.14,
ux-reference 1.7, one CHANGELOG entry; C9 the `SCREENS` entry appended after 038's and 039's, no
shared console stores a forced theme; C10 no `contracts/` or `server/` change.
