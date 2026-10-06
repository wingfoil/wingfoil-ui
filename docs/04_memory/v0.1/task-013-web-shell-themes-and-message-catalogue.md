---
id: task-013-web-shell-themes-and-message-catalogue
type: task
title: "Web shell themes and message catalogue"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness", "task-003-session-token-and-request-guards", "task-008-project-list-api", "task-012-project-read-api"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The web application shell and its mechanisms: React + Vite, TanStack Router/Query, React Aria Components, the session bootstrap from the URL fragment (fragment removed, `POST /api/session`), the theme tokens and theme selection of spec-009, the message catalogue, key-rendering build, lint and extract check of spec-008, the shell warnings of `GET /api/server`, and the start page with the project switcher placeholder and *Add project…*. Themes and strings are proved here by unit tests (token contrast table, catalogue checks); their e2e acceptance over every v0.1 screen closes in task-021.

**Backlog items:** US-S-01

- US-S-01 — As Alex, I want to start the console with `npx wingfoil-ui` and have the browser open on it, so that I use it without installing anything beyond Node 22

## Acceptance Criteria

- **US-S-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/launch.feature`: S-01.1 Start the console with npx; S-01.2 Refuse to start on an unsupported Node.js version; S-01.3 Start without opening a browser when none is available

Screen: `docs/00_reference/ux-reference.md` §1–3, §9 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-008-message-catalogue`, `spec-009-theme-tokens`, `spec-004` §2 (fragment → session), §3 (`GET /api/server`, `GET /api/projects`); `adr-002` (web stack).
- `ux-reference.md` §1–3, §9; prototype `docs/00_reference/prototype/`; directives `accessibility`, `ux-consistency`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-06)

- **depends_on acknowledged (dl-015):** Execution Notes of task-001, 003, 008, 012 read (reviews and
  integrations included), and of 002, 006, 009, 010, 011 (header, identity, events, descriptor).
  Taken from them:
  - 001 — every test under `test/` (web unit tests in `test/web/`, e2e in `test/e2e/`); Playwright
    on Chromium only (`test/harness/playwright-config.test.ts`); `scanThemes(page)`
    (`test/e2e/support/axe.ts`) emulates `prefers-color-scheme`, so the web theme must follow the
    media feature (spec-009 §1 does); `buildFixture`/`copyFixture`/`harnessEnv` isolate home, git
    and XDG; coverage 80 % already includes `web/src/**`.
  - 002 — the server serves `web/dist` (`main.ts` `staticDir`), checked once at `buildApp`
    (`index.html` must exist before the bin starts); Vite's `assets/` is the only 404 prefix, every
    other non-`/api/` GET falls back to `index.html` (client routes may hold dots); the bin is
    driven by `startLauncher(args, env)` (`test/launcher/launcher.ts`); the opener receives the URL
    as one argument (S-01.1 recording opener on the `PATH`). Hand-over: `npm pack` does not ship
    `web/dist` yet (release-publishing) — unchanged here.
  - 003 — `POST /api/session` with `Authorization: Bearer <token>`, no body → 204 + cookie
    `wfui_session_<port>` (401 wrong token, 403 foreign origin); then the cookie only; static files
    need no session; a restarted console invalidates every token and session (X-02.2). X-02.1's
    browser half closes in task-015 — the bootstrap is built here.
  - 008 — `GET /api/projects` `{ projects: [{ id, name, path, remote, availability, command? }] }`,
    refetched on `projects`; refusal codes and `detail` shapes in
    `contracts/api/projects.refusal.schema.json` (`sameRemote` boolean, `not-wingfoil` with
    `{path}` or `{source: "clone"}`).
  - 010/012 — one `EventSource('/api/events')` per page; `repo {pid, state}` → invalidate that
    project's queries **even when `state` is unchanged** (a CLI change publishes `repo` with the
    same state); reconnect → refetch all; read responses carry `X-Repo-State`; `GET /api/server`
    → `ServerInfo {version, range, capabilities, warnings: [{key, args}]}`.
  - 006/009/011/012 — reason codes are data with parameters, rendered from the catalogue
    (`<area>.reason.<code>`); `tone`/`bucket` are server data, never re-derived; REQ-ARC-05 lint
    applies to `web/**` (literals and data keys equal to a fixture type/state name — `open`,
    `closed`, `done`, `active`, `pending`, `ready`, `note`, … — are errors; method names exempt).
- **Specs:** spec-008 (whole), spec-009 (whole), spec-004 §1–§3, §5, §6, spec-006 §4 (shell
  warnings), spec-007 (S-01.x lines), adr-002 (web stack), `ux-reference.md` §1–3, §9, the
  prototype (header 56 px: logo · switcher · crumb · ⌘K · role view · bell · user; sidebar 220 px;
  surface `#F5F7FA`; Geist), directives `accessibility`, `ux-consistency`. Missing or ambiguous
  points are listed under **Decisions** (reported to the coordinator, not edited).
- **Layout (`web/`):**
  ```
  web/index.html                  lang="en", inline theme script (spec-009 §1), #root
  web/vite.config.ts              React plugin; mode "keys" swaps the catalogue (spec-008 §6)
  web/tsconfig.json               composite + noEmit (tsc type-checks; Vite emits web/dist)
  web/scripts/check-catalogue.mjs extract check: ids used vs en.json, sorted, id pattern, areas
  web/src/main.tsx                bootstrapSession() → render <App/>
  web/src/app.tsx                 providers: Intl, Query, Router (+ RAC RouterProvider)
  web/src/session/session.ts      fragment → replaceState → POST /api/session; session-lost store
  web/src/api/client.ts           apiRequest/apiGet, ApiError (spec-004 §5), X-Repo-State, 401
  web/src/api/query-keys.ts       key factories (convention below)
  web/src/api/queries.ts          serverQuery(), projectsQuery() (queryOptions)
  web/src/api/events.ts           the single EventSource wrapper
  web/src/api/error-message.ts    error code → catalogue key + arguments (spec-008 §4)
  web/src/i18n/en.json            the catalogue (flat, sorted)
  web/src/i18n/index.ts           AppIntlProvider, MessageId (typed ids), formatters
  web/src/i18n/key-catalogue.ts   en.json → key catalogue (pure; used by vite.config.ts)
  web/src/theme/tokens.css        spec-009 §2 tokens on :root[data-theme=light|dark]
  web/src/theme/base.css          reset, focus ring, spacing/radius scales, layout
  web/src/theme/theme.ts          followSystemTheme() (same logic as the inline script, tested)
  web/src/fonts.ts                Geist / Geist Mono woff2 (latin 400/500/600), self-hosted
  web/src/shell/                  Shell (skip link, header, warnings, <main>), ProjectSwitcher,
                                  AddProjectDialog, ShellWarnings, SessionLost, usePageTitle
  web/src/routes/                 root.tsx, start.tsx, project.tsx, tree.ts (route registration)
  ```
- **Router (TanStack Router, code-based, no generated route tree):** `rootRoute`
  (`createRootRouteWithContext<{ queryClient }>()`, component = Shell) → `startRoute` (`/`, the
  project list page, title `title.projects`) and `projectRoute` (`/p/$pid`, layout: sidebar +
  `<Outlet/>`; slot for the task-016 header). **Registration pattern for later tasks:** a view
  task adds `web/src/routes/<view>.tsx` exporting
  `createRoute({ getParentRoute: () => projectRoute, path: '<view>', component, loader? })`, adds it
  to `PROJECT_ROUTES` in `routes/tree.ts`, and adds its sidebar entry to `PROJECT_NAV` (group,
  catalogue key, `to`) in `routes/project.tsx` — groups follow ux-reference §2 (Work · Rules and
  context · Repository), an empty group is not rendered. `declare module '@tanstack/react-router'
  { interface Register { router } }` keeps links typed. The element panel (task-018) is a child
  route `/p/$pid/e/$eid` registered the same way. React Aria's `RouterProvider` is wired to the
  router's `navigate` so RAC links/menu items navigate client-side.
- **Session bootstrap (spec-004 §2):** before the first render: read `#token=` from
  `location.hash` (`URLSearchParams`), `history.replaceState` without the fragment (keeps path and
  query), `POST /api/session` with the Bearer token (`credentials: 'same-origin'`, no body). No
  token (reload, new tab of the same browser session) → no POST, the cookie is used. A 401 (from
  the POST, any API call or the event stream) marks the session **lost**: the shell shows a
  full-page notice (`shell.session.lost.*`: "This page is no longer connected to the console —
  open the URL printed in the terminal") and stops the event stream.
- **Fetch client:** relative same-origin URLs under `/api/` only, `credentials: 'same-origin'`,
  `Accept: application/json`; `apiRequest<T>(method, path, body?)` → `{ data, status, repoState }`
  (`repoState` = `X-Repo-State` or `null`); `apiGet<T>(path)` → `data` for query functions;
  non-2xx → `ApiError { status, code, message, detail }` parsed from the envelope (a non-envelope
  body → `code: 'internal'`); 204 → `data: undefined`. `errorMessage(error)` →
  `{ id: 'error.<lowerCamel code>', values: detail }`; `cli-refused`/`git-refused` render
  `message` verbatim inside the catalogue frame (spec-008 §4).
- **Event stream (`api/events.ts`):** `startEventStream(queryClient, { url = '/api/events',
  EventSourceImpl })` creates the page's only `EventSource` (a second call returns the same
  stream); built-in rules: `repo` → `invalidateQueries({ queryKey: queryKeys.project(pid) })`,
  `projects` → `invalidateQueries({ queryKey: queryKeys.projects() })`, every `open` after the
  first (reconnect) → `invalidateQueries()` (everything). `stream.on(event, handler)` →
  unsubscribe, for later events (`write`, `settings`) and screens. Native reconnect is used while
  the browser retries; when the source ends `CLOSED` (e.g. the console restarted) it is re-created
  with backoff (1 s doubling to 30 s), unless the session is lost. No polling anywhere.
- **Query keys:** `queryKeys.server()` = `['server']`, `queryKeys.projects()` = `['projects']`,
  `queryKeys.project(pid)` = `['p', pid]`; **every project-scoped key starts with `['p', pid]`**
  (`queryKeys.project(pid, 'header')`, `(pid, 'elements', {…})`, …) so that one `repo` event
  invalidates exactly that project. Factories live in `api/query-keys.ts`; later tasks add theirs
  there.
- **Catalogue (spec-008):** `web/src/i18n/en.json` flat and sorted; ids typed through react-intl's
  global `FormatjsIntl.Message.ids = keyof typeof en` (an unknown id is a type error); strings via
  `<FormattedMessage id>` / `intl.formatMessage({ id }, values)` — **no `defaultMessage` in code**
  (spec-008 Consequences: a text change is a catalogue edit). Key build: `npm run build:keys -w
  web` = `vite build --mode keys --outDir dist-keys`; `keyCatalogue(en)` maps each message to
  `<key>` + ` {arg}` for every argument (plural/select included, rich-text tags dropped). Lint
  (`web/**/*.tsx`): `formatjs/no-literal-string-in-jsx` (children plus `aria-label`, `title`,
  `alt`, `placeholder`), `formatjs/no-multiple-plurals`, and the placeholder check of decision 3.
  Check script `web/scripts/check-catalogue.mjs` (run by `npm run lint` after ESLint and by a
  Vitest test): `@formatjs/cli` extract of `web/src/**/*.{ts,tsx}` vs `en.json` — no missing id,
  no unused id, file sorted, every id matches `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$` with
  an `<area>` of spec-008 §2. Keys added here: `shell.*`, `projects.switcher.*`,
  `projects.add.*` (dialog frame), `state.corruptKept`, `state.newerVersion`, `title.projects`,
  `a11y.skipToContent`, `common.action.*`, `error.*` (decision 5).
- **Theme (spec-009):** `tokens.css` holds exactly the §2 table on `:root[data-theme="light"]` /
  `[data-theme="dark"]` plus `color-scheme`; the inline script in `index.html` sets `data-theme`
  from `matchMedia('(prefers-color-scheme: dark)')` before the first paint and follows its
  `change` event (X-08.1/X-08.2 without reload); `theme.ts` exports the same logic for tests and
  for the v0.2 setting. `base.css`: `--focus-ring` on `:focus-visible` (RAC `data-focus-visible`),
  spacing (`--space-1…8`, 4 px steps) and radius (`--radius-sm/md/lg` 6/8/12 px) scales from the
  prototype; no colour literal outside `tokens.css`. `prefers-reduced-motion` disables transitions.
  Fonts from `@fontsource/geist` / `@fontsource/geist-mono` (OFL, woff2 bundled by Vite, offline).
- **Shell (this task's screens):** skip link; header (banner) with the logo (WingFoil mark, `alt`
  from the catalogue) and the **project switcher** — a RAC `MenuTrigger` ("Projects ▾" when no
  project is open) whose menu holds, in v0.1 of this task, only **Add project…** (task-015 adds the
  project items above a separator); shell warnings from `GET /api/server` under the header
  (dismissible per page, `role="status"` region; `state.corruptKept {file}`,
  `state.newerVersion`); the **start page** `/`: `<h1>` "Projects", a short explanation and an
  **Add project…** button. Both actions open the **Add project dialog frame** (RAC `Modal` +
  `Dialog`, heading, Close; focus trapped and restored) that task-014 fills (decision 2). Page title
  via `usePageTitle(id, values)` (`title.projects` here; X-10.x close in task-021).
- **e2e support (`test/e2e/support/`, built here for Wave 3):**
  - `global-setup.ts` (Playwright `globalSetup`): `tsc -b` (server, contracts, web type-check),
    `vite build` and `vite build --mode keys` once per run.
  - `console.ts` — `startConsole({ projects?: Fixture[], stateFile?, opener?, args?, env? })`:
    isolated root (`mkdtemp`), `harnessEnv`, `WINGFOIL_UI_STATE_DIR` = `<root>/state` seeded with
    `state.json` for the given fixtures (opaque ids returned), `--no-open` unless an opener is
    asked (`'recording'` → a fake `xdg-open`/`open` on the `PATH` recording its argument, `'none'`
    → none on the `PATH`); returns `{ url, port, token, pids, stateDir, root, opened(), stop() }`
    (wraps `startLauncher`). `openConsole(page, console, { path?, build?: 'normal' | 'keys' })` →
    `page.goto(<url><path>#token=…)` and waits for the shell (banner landmark); `build: 'keys'`
    serves `web/dist-keys` through `page.route` (decision 4).
  - `fixtures.ts` — Playwright `test` extended with worker-scoped `kanban`/`custom`/`unknown`
    builds (built once per worker, lazily) and a test-scoped `console` fixture with teardown;
    `copyOf(fixture)` for tests that mutate.
  - `events.ts` — `recordServerEvents(page)` (init script wrapping `window.EventSource`, test side
    only: no hook in the production code) and `mutateAndWait(page, mutation, { event, pid? })`:
    runs a git/CLI mutation (`commitFile(fixture, path, content, message)`, `cli(fixture, args,
    as)` through the harness `git()`/`run()` with `fixture.env`), then waits for that SSE event to
    reach the page (`page.waitForFunction`, no fixed sleep); the caller then asserts what the user
    sees with Playwright's auto-waiting `expect`.
  - `axe.ts` (task-001) unchanged; `keyboard.ts` — `expectFocusVisible(locator)` (focus ring
    computed style present).
  - A self-test spec `test/e2e/harness/support.spec.ts` proves the support (seeded project listed
    by `GET /api/projects`, a commit on a copy of kanban → `repo` event recorded by the page).
- **REQ-ARC-05:** no methodology word as a literal or data key in `web/` — renames where the
  libraries suggest one (`isPending` not `status === 'pending'`, session states `connecting` /
  `connected` / `lost`, no `role="note"`); `npm run lint` on the whole tree after each step.
  Catalogue messages hold no type or state name (spec-008 §3).
- **New dependencies** (latest at design, pinned by the lock file): `web` — `react` 19.3.0,
  `react-dom` 19.3.0, `react-aria-components` 1.21.1, `@tanstack/react-router` 1.170.41,
  `@tanstack/react-query` 5.104.1, `react-intl` 12.1.4, `@fontsource/geist` 5.3.0,
  `@fontsource/geist-mono` 5.3.0; root dev — `vite` 8.3.x (already present through Vitest
  8.3.2), `@vitejs/plugin-react` 6.1.2, `@types/react` / `@types/react-dom` 19.3.0,
  `@formatjs/cli` 6.16.33, `eslint-plugin-formatjs` 8.1.1, `eslint-plugin-react-hooks` 7.1.1,
  `@testing-library/react` 16.3.3, `@testing-library/dom` 10.x, `@testing-library/user-event`
  14.6.7, `jsdom` 30.1.2. Scripts: root `build` = `tsc -b && npm run build -w web`; `lint` =
  `eslint . && node web/scripts/check-catalogue.mjs`; web `build`, `build:keys`, `i18n:check`.
- **Test plan (T1 — all red-first, no web code exists):**
  - Unit/component (`test/web/`, Vitest, `@vitest-environment jsdom` per file):
    `theme/contrast.test.ts` (parse `tokens.css`, every spec-009 §3 pair in both themes ≥ bar;
    every §2 token present with its value), `theme/no-colour-literals.test.ts` (no hex/`rgb()`/
    `hsl()` in `web/src` outside `tokens.css`), `theme/theme.test.ts` (follows `matchMedia` and
    its change), `i18n/catalogue.test.ts` (the check script on the repository: 0 problems; and on
    planted defects: missing, unused, unsorted, bad id, bad area), `i18n/key-catalogue.test.ts`
    (arguments, plural/select, tags), `i18n/placeholders.test.ts` (the lint rule of decision 3),
    `api/client.test.ts` (envelope, 204, `X-Repo-State`, 401 → lost, same-origin),
    `api/events.test.ts` (fake EventSource: one stream, `repo` → only that project invalidated —
    also with an unchanged state —, `projects`, reconnect → all, `CLOSED` → re-created with
    backoff, stopped when lost), `api/error-message.test.ts` (every code of spec-004 §4–§5 and
    spec-006 §3 → an existing key; tool output verbatim), `session/session.test.ts` (fragment read
    and removed, POST with Bearer, no token → no POST, 401 → lost), `shell/*.test.tsx` (start
    page, switcher menu by keyboard, dialog focus trap/restore, warnings + dismiss, session-lost
    page, page title, every visible string from the catalogue via a key-catalogue render).
  - e2e (`test/e2e/shell.spec.ts`, one test per scenario, real bin, `scanThemes` in both themes):
    - **S-01.1** — bin with the recording opener: the printed URL starts with
      `http://127.0.0.1:`, the opener received exactly that URL, the page opened at it shows the
      project switcher whose menu has "Add project…" (keyboard: Tab to it, Enter, arrow), the
      fragment is gone from the address bar; axe 0 serious/critical in light and dark.
    - **S-01.3** — no opener on the `PATH`: "Open this URL in your browser: <url>" printed, the
      server keeps serving: the page opened at that URL shows the switcher.
    - **S-01.2** — no screen exists for a refused start (the bin exits before any port opens):
      stays the launcher test `test/launcher/launcher.test.ts` "S-01.2 — refuse an unsupported
      Node.js version" (task-002), referenced in the closure table.
    - Shell mechanisms (not scenarios of this task, they close in 015/021): session bootstrap
      (reload keeps the session; a wrong token → session-lost page), shell warning of a corrupt
      `state.json` (file name shown, dismiss), theme follows a `prefers-color-scheme` change
      without reload, the key build shows only keys on the start page.
- **Decisions — reported to the coordinator, awaiting the go (recommended option first):**
  1. *Start page with no project open* is not in the prototype (it always shows a project):
     (a) header with logo + switcher, main with `<h1>` Projects, one sentence and an
     *Add project…* button (recommended); (b) only the header switcher, empty main.
  2. *"Add project…" before task-014*: (a) opens a dialog frame (title, Close, focus handling)
     that 014 fills (recommended); (b) an inert menu item until 014.
  3. *Placeholder lint:* `formatjs/enforce-placeholders` checks `values` against a
     `defaultMessage` in code, which spec-008 rules out (the text lives in `en.json`): (a) a small
     rule `wfui/catalogue-placeholders` checking `values` of `FormattedMessage` /
     `formatMessage` against the arguments of the `en.json` message (recommended); (b)
     `defaultMessage` in code and `en.json` generated by extract (contradicts "a text change is a
     catalogue edit"); (c) no placeholder check.
  4. *Serving the key build to the e2e (X-09.1, task-021)*: the bin serves `web/dist` only:
     (a) `build:keys` → `web/dist-keys`, served to the page by Playwright route interception, no
     server change (recommended); (b) a test-only env var `WINGFOIL_UI_WEB_DIR` (spec-007 change);
     (c) `build:keys` overwrites `web/dist` (races with parallel suites).
  5. *Error keys of spec-006 §3 codes*: (a) all `error.*` keys (spec-004 §4–§5 and spec-006 §3)
     added here, texts from the `projects.feature` scenarios, the spec-008 §7 unit test complete
     now, task-014 renders them (recommended); (b) only the spec-004 codes here, 014 adds the rest
     with its test rows.
  6. *Project layout `/p/$pid` (sidebar, header slot) here* with an empty nav that each view task
     fills (recommended), or left to task-018/017.
  7. *Lost session UX* (no spec text): full-page notice telling to open the URL printed in the
     terminal, event stream stopped (recommended); alternative: a dismissible banner.

### design decisions (2026-10-06)

- Decided by the user 2026-10-06 (coordinator decisions W3-1…W3-7), every point option (a) of the
  design list: W3-1 start page = header with the switcher, `<h1>` Projects, one sentence and an
  *Add project…* button; W3-2 *Add project…* opens a dialog frame that task-014 fills; W3-3 own
  rule `wfui/catalogue-placeholders` checking `values` against the `en.json` arguments; W3-4 key
  build in `web/dist-keys`, served to the e2e page by Playwright route interception (no server
  change); W3-5 every `error.*` key (spec-004 §4–§5 and spec-006 §3) added here; W3-6 the
  `/p/$pid` layout built here; W3-7 full-page lost-session notice. Spec/UX-reference amendments
  are the coordinator's (on `main`).

### red / green / refactor (2026-10-06)

- **Red** (`831f923`): `test/web/**` (theme, i18n, api, session, shell) and
  `test/lint/catalogue-placeholders.test.ts`; 8 of 12 files failed on the missing modules
  (`web/src/api/client.js`, `events.js`, `session/session.js`, `theme/tokens.css`) and the catalogue
  check on 47 unused ids. **Deviation:** the build-time tooling (`web/scripts/catalogue.mjs`, the
  ESLint rule, `index.html`'s theme script) was written with the configuration, before its tests —
  those 4 files passed at red.
- **Green** (`a909bb3`, `16dbe82`) as designed, with these deviations from the design note:
  - the key catalogue, ICU argument walk and catalogue check live in `web/scripts/catalogue.mjs`
    (plain JS, typed by `catalogue.d.mts`), shared by `vite.config.ts`, the ESLint rule and
    `npm run lint` — not in `web/src/i18n/key-catalogue.ts`;
  - no `theme.ts`: the inline script of `index.html` is the only theme code and is tested directly
    (`theme-script.test.ts`);
  - react-intl's global id typing is not used: it would also bind the server's `@formatjs/intl`
    (another catalogue) in `tsc -p test`; ids are checked by the catalogue check (missing/unused) and
    `wfui/catalogue-placeholders` (unknown id, missing/extra values);
  - dynamic ids (error codes, state warnings, nav labels, page titles) go through `defineMessages`
    so that the extract sees them; `FormattedMessage` with a non-literal `id` is refused by
    `formatjs extract --throws` (use the descriptor or `formatMessage(descriptor)`);
  - the Add project dialog is not dismissed by a click outside: React Aria then adds its own
    "Dismiss" button, a text outside the catalogue (X-09.1). Escape and Close close it;
  - React Aria's `RouterProvider` is not wired yet (no React Aria link in the shell);
  - one token beyond the spec-009 table: `--shadow-popover` (decorative shadow; amendment below).
- **Refactor / e2e** (`03adc40`): the shared e2e support (`test/e2e/support/`: `global-setup.ts`,
  `console.ts`, `fixtures.ts`, `events.ts`, `keyboard.ts`) and its self-test
  (`test/e2e/harness/support.spec.ts`: a seeded kanban copy listed, a commit outside the UI → `repo`
  of that pid recorded by the page, an add → `projects`); `test/e2e/shell.spec.ts`; more unit tests
  (queries, `ErrorText`, the default probe); `test/README.md` 0.13. Playwright `globalSetup` and
  `timeout: 60 s` in `playwright.config.ts`; root `build` = `tsc -b && npm run -s build -w web`,
  `lint` = ESLint + the catalogue check; `web/dist-keys/` ignored.
- **Scenario closure (US-S-01):**

  | Scenario | Proved by |
  |----------|-----------|
  | S-01.1 Start the console with npx | `test/e2e/shell.spec.ts` › "S-01.1 — Start the console with npx" — the bin (as `npx` runs it) with a recording opener: printed URL `http://127.0.0.1:<port>/#token=…`, the opener got exactly that URL, the page opened at it shows the project switcher whose menu (keyboard: Tab, visible focus ring, Enter) offers "Add project…", fragment gone, title "Projects — WingFoil UI", axe 0 serious/critical in light and dark (menu open and closed) |
  | S-01.2 Refuse an unsupported Node.js version | `test/launcher/launcher.test.ts` › "S-01.2 — refuse an unsupported Node.js version" (task-002): the bin exits 1 with the catalogue line and opens no port — there is no screen to drive, so no browser test |
  | S-01.3 Start without opening a browser | `test/e2e/shell.spec.ts` › "S-01.3 — Start without opening a browser when none is available" — no opener on the `PATH`: "Open this URL in your browser: <url>" printed, no opener ran, the page at that URL still shows the switcher with "Add project…" |

  Shell mechanisms (same spec, `shell mechanisms`): session (fragment → cookie, reload keeps it,
  wrong token and a forgotten session → lost-session page), corrupt `state.json` warning shown with
  the kept file and dismissed, theme following `prefers-color-scheme` and its change without reload,
  the dialog frame (keyboard, focus trapped and given back, axe), the key build showing only keys.
- **Checks** (worktree, load 15–18 on 12 cores, `/proc/loadavg`): `npm run -s typecheck`, `lint`
  (ESLint + catalogue check) clean · `format:check` "All matched files use Prettier code style!" ·
  `docs:api` OK · `npm run -s test:coverage` **87 files passed, 1 skipped; 1350 passed / 1 skipped**,
  coverage 95.44 % statements / 88.48 % branches / 95.47 % functions / 97.48 % lines (before the last
  three unit tests; `web/src` alone now 96.01 % / 90.59 %) · `test:e2e` **12/12** (and 36/36 with
  `--repeat-each=3`) · `check_tasks.py` OK · `npm run test:timing` **not run** (load > 12).
- **Hand-overs:**
  - **view tasks (017–020):** route + `PROJECT_ROUTES` + `PROJECT_NAV` entry (`routes/project.tsx`
    header comment); query keys under `queryKeys.project(pid, …)`; `apiGet` in query functions;
    `stream.on('write', …)` for other events; ids through `defineMessages` when not literal; every
    new key in `en.json` in the same commit (the lint fails otherwise).
  - **task-014:** fill `AddProjectDialog` (`shell/add-project.tsx`); render refusals with
    `ErrorText` / `errorMessage` (all spec-006 §3 keys exist; texts from `projects.feature`, adjust
    with the scenarios).
  - **task-015:** project items in `ProjectSwitcher` above "Add project…" (`projectsQuery()`, already
    refetched on `projects`); X-02.1's browser half is the bootstrap of `session/session.ts`.
  - **task-016:** header slot in `ProjectLayout`, above `<Outlet/>`.
  - **task-021:** `openConsole(page, c, { build: 'keys' })` for X-09.1/X-09.2; React Aria's popovers
    render a visually hidden "Dismiss" button (its own string): decide how X-09.1 treats it (the
    switcher menu has one); X-08.1/X-08.2 mechanism already e2e-tested here.
  - **Coordinator:** run `npm run test:timing` on a quiet machine.
