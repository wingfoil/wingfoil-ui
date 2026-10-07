---
id: task-020-documentation-index-and-links
type: task
title: "Documentation index and links"
status: approved
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-R-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-012-project-read-api", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The documentation index under `paths.docs` (without Memory and plan files), the markdown document view (markdown-it + DOMPurify), links to Memory files opening the element panel, and links that leave the repository marked and refused.

**Backlog items:** US-R-08, US-R-09

- US-R-08 — As Riley, I want an index of the documents under `paths.docs`, without the Memory and plan files, rendered as Markdown with links that stay in the UI, so that I read the project's documentation in one place
- US-R-09 — As Riley, I want a document link to a Memory file to open its element panel, and a link that leaves the repository or points nowhere marked as such, so that every link is safe to follow

## Acceptance Criteria

- **US-R-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/documentation.feature`: R-08.1 Index the documents without Memory and plan files; R-08.2 Render a document inside the UI; R-08.3 Follow a link between indexed documents inside the UI
- **US-R-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/documentation.feature`: R-09.1 Open a linked Memory file in the element panel; R-09.2 Mark a link that points nowhere; R-09.3 Mark a link that leaves the repository; R-09.4 Open an external link in a new tab

Screen: `docs/00_reference/ux-reference.md` §4.9 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-004` §3 (`/docs`, `/files/content`); `adr-002` (markdown-it + DOMPurify); `ux-reference.md` §4.9; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-07)

- **depends_on acknowledged (dl-015):** Execution Notes of task-012 and task-018 read (reviews and
  integrations included), and task-013's (view recipe, e2e support). Taken from them:
  - 012 — `GET /docs` → `{roots, documents: [{path}]}` (paths only, no titles; `paths.docs` minus
    the Memory directories, governance, `.git`, `node_modules`; symlinks not followed; empty without
    a readable `memory.yaml`); `GET /files/content?path=` → `{path, size, content}` for a document
    of the scope only (`.md`/`.markdown`, regular, not hard-linked); a refused path → 404
    `not-found` `detail.kind` ∈ `outside` (judged first, lexically then by `realpath`), `missing`,
    `not-allowed`, `too-large`. Hand-over: R-09.3's screen and the Memory-file link (resolved
    against `GET /elements` paths) are this task's.
  - 018 — the element panel is the route `/p/$pid/e/$eid` (an overlay replacing the Outlet); a
    document link to a Memory file navigates there; Close goes back in history (to the document)
    and focuses `<main>` when the focus was lost.
  - 013 — view recipe (`routes/<view>.tsx`, `staticData.nav {group, order: NAV_ORDER.documentation,
    label}`, one line in `PROJECT_ROUTES`, query keys in the route file on `queryKeys.project(pid,
    …)`), `useServerEvent` never starts a stream (not needed here: every key sits under
    `['p', pid]`, a `repo` event refreshes the index and the open document), errors through
    `errorMessage`/`ErrorText`, React Aria links accept concrete paths, keys in `en.json` in the same
    commit; e2e support `consoles.start`/`openConsole`/`fixtures.copy`/`commitFile`, `scanThemes`,
    `expectFocusVisible`.
- **Specs:** spec-004 §3 (`/docs`, `/files/*`), §5 (404 `detail.kind`); adr-002 (markdown-it +
  DOMPurify); REQ-SEC-06 (confinement; links "refused or marked"); ux-reference §2 (Documentation in
  *Rules and context*), §4.9; prototype (numbered index "1 / 1.1", sections → entries with title,
  description, path; reading view: "← Index", path, "Open on GitHub ↗", article); spec-008 (area
  `docs`, `title.projectView`), spec-009 (tokens); directives `accessibility`, `ux-consistency`,
  `code-quality`, `testing`.
- **Layout:**
  ```
  web/src/routes/docs.tsx        docsRoute `/p/$pid/docs` (nav entry, layout) with the children
                                 `/` (index) and `$` (a document: the splat is the repo path);
                                 docsKeys (index, content, probe), queries
  web/src/docs/DocsIndex.tsx     the numbered index (sections = folders)
  web/src/docs/DocumentView.tsx  "← Index", path, the rendered article, link click delegation
  web/src/docs/links.ts          pure: resolve an href against the document path, classify it
  web/src/docs/render.ts         markdown-it → DOMPurify → link/heading/image/table rewrite →
                                 DOMPurify (final) — returns sanitised HTML
  web/src/docs/docs.css          article typography with spec-009 tokens
  ```
  Dependencies (latest, pinned by the lock): `web` — `markdown-it` ^15.0.2, `dompurify` ^3.4.16
  (ships its types); root dev — `@types/markdown-it` ^14.2.0.
- **Rendering and security (recommended options of the decisions below):**
  - markdown-it `default` preset (tables, fenced code), `html: false`, `linkify: true`,
    `typographer: false`, its own `validateLink` kept (javascript:/vbscript:/file:/data: never become
    links). Output parsed by DOMPurify (`RETURN_DOM_FRAGMENT`, allow-list of the tags markdown-it
    emits, no `style` except table cell alignment mapped to a class); then the rewrite on that inert
    fragment (DOM API and `textContent` only), then a final `DOMPurify.sanitize` of the serialised
    result (`ADD_ATTR: ['target']`) before `dangerouslySetInnerHTML` — nothing reaches the page that
    did not go through DOMPurify last.
  - Links (`links.ts`, pure, unit-tested): href trimmed; scheme `http`/`https` → `external`
    (new tab, `rel="noopener noreferrer"`, an "opens in a new tab" text for assistive technology);
    any other scheme, protocol-relative `//host`, a control character or NUL → `unsupported` (marked,
    inert); `#frag` → `anchor` in the same document; else a repository path: query dropped,
    fragment kept, percent-decoding (invalid → `unsupported`), `\` read as `/`, resolved against the
    document's folder (`/x` from the repository root — decision 6), normalised; leaving the root →
    `outside` (never sent to the server); in the docs index → `document` (in-UI route
    `/p/$pid/docs/<path>` with the fragment as hash); equal to an element's `path` of
    `GET /elements` → `element` (`/p/$pid/e/<id>`); otherwise `unknown` → decision 3. Followable
    links keep a real `href` (middle-click, copy) and a click without modifier is handled by the
    router (`router.navigate({ href })`, no reload). Refused links become a `<span>` with the link
    text and a visible mark ("broken link", "outside the repository", …) from the catalogue: nothing
    to select, nothing opens.
  - Headings get `id="doc-<slug>"` (GitHub-like slug, deduplicated, prefixed against DOM
    clobbering); a fragment link scrolls to it and moves the focus there. Tables are wrapped in a
    focusable labelled region (axe `scrollable-region-focusable`); code blocks wrap.
  - After following a link to another document the focus goes to the document's heading line
    when it was lost (as the panel does with `<main>`).
- **Fetches:** index `GET /docs`; document `GET /files/content?path=`; only when the document has
  repository links outside the index: `GET /elements` (same key shape as task-017's
  `queryKeys.project(pid, 'elements', { archived: false })`, so the cache is shared when 017 uses
  it), and the probes of decision 3 — all under `['p', pid]`. No change to the server.
- **Page titles:** `title.projectView` `{project} · {view} — WingFoil UI` (spec-008 §3) with
  view "Documentation" on the index and the document path on a document (X-10 closes in 021).
- **Test plan (red-first: no docs code exists):**
  - unit `test/web/docs/links.test.ts`: relative (`./`, `..`, nested), anchors, query, encoded
    (`%2e%2e%2f`, `%2F`, invalid `%zz`, `%00`), backslash, absolute and root-relative, schemes
    (`HTTPS:`, `mailto:`, `javascript:` variants with case/whitespace/entities, `data:`, `vbscript:`,
    `file:`, `//host`), empty href, index / element / unknown / outside.
  - unit `test/web/docs/render.test.ts`: headings with ids, lists, tables, code; raw HTML shown as
    text; `<script>`, `onerror`, `javascript:` and `data:` payloads never active; external
    `target`/`rel`; internal hrefs encoded; refused marks inert; image placeholder; heading ids
    cannot clobber (`doc-` prefix).
  - component `test/web/docs/docs.test.tsx`: index sections and numbering, empty index, error;
    document: rendered, a document link and an element link navigate client side, marks,
    external link attributes, keyboard (Tab + Enter), every string from the catalogue.
  - e2e `test/e2e/documentation.spec.ts` (real bin, custom fixture; R-09.x on a copy with a
    committed `docs/01_vision/links.md`), one test per scenario, axe 0 serious/critical in both
    themes on the index and a document: R-08.1 … R-09.4.
- **Decisions — reported to the coordinator, waiting (recommended option first):**
  1. *Index entries have no title/description* (API: paths only; ux §4.9/prototype show title,
     description, path, hand-curated): (a) sections = folders (numbered 1, 1.1 as the prototype),
     each entry = the file name as its title + the full path, no description (recommended);
     (b) fetch every document for its first heading (N requests per index); (c) a server-side
     `title` in `GET /docs` (reads every file; spec-004 + schema change).
  2. *Raw HTML inside Markdown:* (a) `html: false` — shown as written text (`<file>` in
     `05_journeys.md` stays visible), DOMPurify still on the output (recommended); (b) `html: true`
     + DOMPurify allow-list (unknown tags such as `<file>` vanish silently).
  3. *A repository link that is neither an indexed document nor an active Memory element:* (a) ask
     the server once per distinct target (`GET /files/content?path=`, cached under `['p', pid]`):
     200 → in-UI document, `outside` → "outside the repository" (e.g. a symlink leaving the
     repository), `missing` → "broken link", `not-allowed`/`too-large` → a fourth mark "not shown
     in the UI" (a source file, a governance file, an archived element) (recommended); (b) client
     only: everything else → "broken link" (wrong for existing files; an escaping symlink would be
     "broken", not "outside").
  4. *Images* (`![alt](src)`; `/files/content` serves Markdown only): (a) never loaded: a marked
     text "Image not shown: {alt}" (no request to the repository or the internet) (recommended);
     (b) load external `https` images (a local tool calling out, tracking).
  5. *Link schemes:* (a) only `http`/`https` are followable (new tab); `mailto:`, `//host` and any
     other scheme marked "link not supported", inert (recommended); (b) also `mailto:`.
  6. *Root-relative links* (`/docs/x.md`): (a) from the repository root, as GitHub resolves them,
     then classified like any repository path (recommended); (b) always "outside the repository".
  7. *"Open on GitHub ↗"* (ux §4.9, prototype; no v0.1 scenario; the web URL would be guessed from
     the git remote): (a) deferred, recorded as a prototype deviation (recommended); (b) built for
     `github.com` remotes only.

### design decisions (2026-10-07)

- Decided by the user 2026-10-07 (coordinator decisions W3-28…W3-34), every point option (a) of the
  design list: W3-28 index sections by folder, numbered as the prototype, entry = file name as title
  + full path, no description; W3-29 markdown-it `html: false`, DOMPurify still last; W3-30 a
  repository target that is neither indexed nor an active element is checked once per distinct
  target with `GET /files/content` (cached under `['p', pid]`): 200 → opened in the UI, `outside` →
  "outside the repository", `missing` → "broken link", `not-allowed`/`too-large` → "not shown in
  the UI"; W3-31 images never loaded, "Image not shown: {alt}"; W3-32 only `http`/`https`
  followable, every other scheme "link not supported"; W3-33 root-relative links resolved from the
  repository root; W3-34 "Open on GitHub ↗" deferred, a prototype deviation.
- Coordination with task-017: the `GET /elements` query is `elementsQuery(pid, archived)`
  in `web/src/api/queries.ts` with the key `queryKeys.project(pid, 'elements', { archived })` (017
  owns it; the merge unifies). `/p/$pid` redirects to the Memory list (W3-22): nothing here assumes
  what `/p/$pid` shows.

### red / green / refactor (2026-10-07)

- **Red** (`22a9be9`): `test/web/docs/links.test.ts` and `render.test.ts` failed on the missing
  modules (`web/src/docs/links.js`, `render.js`); markdown-it ^15.0.2 and DOMPurify ^3.4.16 added to
  `web`, `@types/markdown-it` ^14.2.0 to the root.
- **Green** (`98e6dcd`) as designed, with these deviations:
  - DOMPurify checks **every** attribute value against `ALLOWED_URI_REGEXP`, not only URLs: the final
    pass uses DOMPurify's default shape restricted to `http`/`https` schemes (a strict "starts with
    `/p/`" regex stripped `target`, `tabindex` and `data-doc-anchor`).
  - REQ-ARC-05: the classification state "waiting" is `unresolved` (`pending` is a fixture state);
    the elements query is task-017's `elementsQuery(pid, archived)` in `api/queries.ts` with the key
    `queryKeys.project(pid, 'elements', { archived })` (coordinator decision): the shorthand
    property and a plain `archived` parameter pass the lint, while `archived:` written as a key or
    as a property of a parameter type is refused (`archived` is a fixture state name).
  - Index entry numbers are `aria-hidden` (the accessible name is "<file name> <path>"; inline
    spans join without a space, and a `{' '}` literal is refused by `formatjs/no-literal-string-in-jsx`);
    the title and path are block elements.
  - The visible "↗" after an external link is CSS (`content: ' \2197' / ''`, empty alternative), the
    accessible "(opens in a new tab)" comes from the catalogue.
  - **Deviation (test-after):** the component test `test/web/docs/docs.test.tsx` and the e2e spec
    were written after the components and the routes.
- **e2e** (`206f32f` + the next commit): `test/e2e/documentation.spec.ts`; the R-09 scenarios run on a
  custom copy with `docs/01_vision/links.md` committed. A `beforeAll` builds the worker's custom
  fixture (300 s) before the tests: the lazy build inside a test counted against the 60 s test
  timeout and failed every test at load ≈ 45 (other projects' builds) — the shared support builds
  lazily inside the test body (reported, not changed). The first classification waits up to 30 s
  (cold `GET /elements` runs the CLI).
- `test/README.md` 0.15.
- **Scenario closure (US-R-08, US-R-09):**

  | Scenario | Proved by |
  |----------|-----------|
  | R-08.1 Index the documents without Memory and plan files | `test/e2e/documentation.spec.ts` › "R-08.1 — Index the documents without Memory and plan files": custom fixture, sidebar *Documentation* reached by keyboard (visible focus, Enter) → `/p/<pid>/docs`, title "custom · Documentation — WingFoil UI", the entry "02_product-vision.md docs/01_vision/02_product-vision.md" shown, no listed path under `docs/04_memory/` or `docs/05_plans/`; axe 0 serious/critical in light and dark |
  | R-08.2 Render a document inside the UI (as amended, W3-37) | same spec › "R-08.2 …": `06_features.md` opened from the index renders its headings and tables (the table in a focusable region reached by Tab, visible focus), no Markdown source shown, URL on the console's origin; axe in both themes; the lists on `02_product-vision.md` opened from the index, as the scenario names it after W3-37 |
  | R-08.3 Follow a link between indexed documents inside the UI | same spec › "R-08.3 …": `00_index.md`'s link "Product Vision" (href `/p/<pid>/docs/docs/01_vision/02_product-vision.md`) followed by keyboard renders `02_product-vision.md`; a marker on `window` survives (no reload), title "custom · docs/01_vision/02_product-vision.md — WingFoil UI"; "← Index" goes back |
  | R-09.1 Open a linked Memory file in the element panel | same spec › "R-09.1 …": on a custom copy with `docs/01_vision/links.md`, the link to `../04_memory/design/dls/dl-001-initialise-wingfoil-before-inception.md` points at `/p/<pid>/e/dl-001-…`, selecting it opens the panel (dialog "Initialise WingFoil before inception", id shown); Escape goes back to the document |
  | R-09.2 Mark a link that points nowhere | same spec › "R-09.2 …": `missing-file.md` (server answer `missing`) shows its text with the mark "broken link", is no link, a click leaves the URL unchanged; axe in both themes |
  | R-09.3 Mark a link that leaves the repository | same spec › "R-09.3 …": `../../../etc/hosts` marked "outside the repository", no link, a click opens no page and changes nothing, no request of the page names `etc/hosts` (decided in the page). The API half (TT-SEC-06: 404 `outside`, 0 bytes of the target) stays task-012's `test/server/http/project-routes.test.ts` and `test/launcher/local-security.test.ts` |
  | R-09.4 Open an external link in a new tab | same spec › "R-09.4 …": the link "Guide (opens in a new tab)" has `target="_blank"` and `rel="noopener noreferrer"`; selecting it opens a new page at `https://example.test/guide` (served by a Playwright route) whose `window.opener` is `null`; the console's page stays |

  Unit/component: `test/web/docs/links.test.ts` (resolution and classification, traversal and
  scheme cases), `render.test.ts` (structure, 14 attack payloads never active, raw HTML as text,
  link rewrite, images never loaded), `docs.test.tsx` (index, document, routing, focus, server
  checks, refused documents, key build). "I am Riley" is not set up: a read-only view shows the same
  thing to every identity.
- **Checks** (final code `6ee5f2d`, notes after): typecheck, lint (ESLint + catalogue check),
  format:check clean · `docs:api` OK · `check_tasks.py` OK · `test:e2e` **26/26** (twice: load ≈ 2
  and ≈ 6–20; earlier runs at load 45–60 timed out on fixture builds and cold CLI calls, see above) ·
  `test:coverage`: **every full run (4/4, load 6–40) fails `test/web/element/panel.test.tsx`** ›
  "shows the element…" (sometimes also "shows the sequence unmarked…") — the panel is still
  "Loading the element…" when its first `findByRole` gives up after 1 s; the file passes alone
  (16/16) and `test/web` with coverage passes (297/297, twice). Not a behaviour change (no element
  code touched); likely the extra parallel load of the new suites on a 1 s wait — reported. With
  `--retry=2`: **95 files passed, 1 skipped; 1540 passed / 1 skipped**, coverage 96.16 % statements /
  89.58 % branches / 96.66 % functions / 97.99 % lines (`web/src/docs` 97.65 % / 91.35 %,
  `routes/docs.tsx` 100 % / 97.22 %) · `npm run test:timing` **3/3** at load 8.7 → 6.5: REQ-PERF-03
  20/20, max 928 ms; TypeDoc 8518 ms; REQ-PERF-06 482–809 ms.
- **Prototype deviations (directive `ux-consistency`):** index entries show the file name and path,
  no curated title or description (W3-28); no "Open on GitHub ↗" (W3-34); sections are folders;
  "← Index" is a link (it navigates); refused links are struck through with a mark; images are a
  marked text (W3-31).
- **Hand-overs:**
  - **task-017 (merge):** `elementsQuery(pid, archived)` in `api/queries.ts` with 017's signature and
    key (one definition after the merge); `title.projectView` and `TITLES.projectView` (after
    `projectElement`) with the agreed text; `PROJECT_ROUTES` gains `documentationRoute,`;
    `test/README.md` 0.15 conflicts with 017's 0.15 (resolved at integration).
  - **task-016:** nothing in the header; the Documentation view sets its own title.
  - **task-019:** a directive body is Markdown: reuse `markdownToSafeHtml` + `finishDocument`
    (`docs/render.ts`) with a classification of its own (directive files are governance: links to
    them are "not shown in the UI" here).
  - **task-021:** X-10 titles: index "{project} · Documentation", a document "{project} · <path>"
    (`title.projectView`); the key build covers the docs strings (component test).
  - **Coordinator:** spec-008 §3 has no title for a document (used `title.projectView` with the path).
- **Open points:**
  - e2e support builds the worker fixtures lazily inside the test body: under heavy load a test
    times out on the build (`beforeAll` used here). Proposal: a worker-fixture pre-build in the
    shared support (bug-ingest).
  - `panel.test.tsx` "shows the element…" fails in every full `test:coverage` run on this branch
    (1 s `findByRole`, passes alone): bug-ingest, or a longer wait in that test, to decide before merge.

### review round 1 (2026-10-07)

- Independent review: **FAIL** on one Medium accessibility defect (F1); security **PASS** (about 40
  payloads inert). The `panel.test.tsx` failure under load was judged load-only (task-018's test,
  bug-004, absorbed into task-019): unchanged here. User decisions W3-36 (cap) and W3-37 (R-08.2
  amended on `main` to name `02_product-vision.md` for the lists). Fixed:
  - **F1** (`6cd4611`, tests in `53c5113`) the focus was lost each time the links were classified
    again (index → `GET /elements` → server checks rebuilt the article's HTML). The article's
    content is now set in a layout effect (`replaceContent`): the focused link (`data-doc-link`, a
    key set on every link and on its replacement), heading (id) or table (`data-doc-table`) gets
    the focus back; a link that became refused gives it to the article. Component tests with a
    held-back `GET /elements`: a focused link and the heading of the URL fragment keep the focus, a
    link turned refused leaves it on the article — all three fail without the fix.
  - **F2** (`6cd4611`) an in-page link is the document's URL with the fragment
    (`/p/<pid>/docs/<path>#<fragment>`), routed like a document link: Back works, a copied or
    reloaded URL lands on the heading; the fragment is read as a slug (`#key-decisions`) or as a
    rendered `doc-` id. `data-doc-anchor` is gone.
  - **F3** (`6cd4611`) heading ids take the first free suffix (`A`, `A`, `A-1`, `A` →
    `doc-a`, `doc-a-1`, `doc-a-1-1`, `doc-a-2`); unit test.
  - **F5** (`6cd4611`) `ADD_URI_SAFE_ATTR: ['aria-label']` in the final DOMPurify pass (still the
    last step); unit test of a label with a colon. It also passed before: DOMPurify keeps `aria-*`
    values unchecked, so the option makes that explicit.
  - **F6** (`f25aece`, `53c5113`) `@types/markdown-it` removed (markdown-it 15 ships its types); the
    pages moved to `web/src/docs/pages.tsx`, loaded by `lazyRouteComponent` (the route file keeps the
    routes, keys and queries; the pages read their params through `getRouteApi`). `vite build`:
    entry chunk 699.76 kB (gzip 231.12 kB) → 563.46 kB (176.01 kB) plus a `pages` chunk 140.51 kB
    (57.23 kB) and its CSS 2.86 kB.
  - **F8** (`53c5113`) component test: the server answering `outside` for a link check (an
    escaping symlink) → "outside the repository", no link.
  - **W3-36** (`53c5113`) at most `MAX_LINK_CHECKS` = 100 distinct targets checked per document;
    the rest are "not shown in the UI" without a request. Component test with 101 targets: 100
    requests, the 101st marked.
  - **W3-37** closure table wording (R-08.2 "as amended"); the spec keeps its assertions.
  - Commit granularity: F1, F2, F3 and F5 touch the same render/view code and share one commit; F8
    and the F1 component tests are in the F6/W3-36 commit (same test file).
- **Checks** (HEAD `53c5113`): typecheck, lint (ESLint + catalogue check), format:check clean ·
  `docs:api` OK · `check_tasks.py` OK · `test:e2e` **26/26** (load ≈ 30) · `npm run -s
  test:coverage` **95 files passed, 1 skipped; 1548 passed / 1 skipped** (load 17–22, no retry),
  coverage 96.15 % statements / 89.53 % branches / 96.69 % functions / 98.01 % lines
  (`web/src/docs` 98.02 % / 92 %) · `npm run test:timing` **3/3** at load 9.1 → 8.7: REQ-PERF-03
  20/20, max 1756 ms; TypeDoc 11 539 ms; REQ-PERF-06 631–1322 ms.

### integration (2026-10-07)

- Re-verification of review round 1: **PASS**, one Low finding fixed first:
  - **N1** (`e9aa29b`) selecting the same in-page anchor again did nothing: the URL does not change,
    so no navigation fires the focus effect. The click handler now focuses the heading itself when
    the link's URL is the one shown (no history entry is added). The focus keys escape their
    `data-doc-link`/`data-doc-table` values with `CSS.escape`. Component test (red without the
    fix): the second click puts the focus back on the heading, and the history length is unchanged.
- `main` merged (`26e37fb`, authorised by the coordinator): spec amendments W3 (`76ef2b3`,
  `6a34345` — ux-reference 0.5 §4.9 v0.1, spec-004/spec-008 notes, R-08.2 amended: headings and
  tables on `06_features.md`, lists on `02_product-vision.md`, backlog regenerated), bug-004 and
  status commits. No conflict. The amended R-08.2 matches the e2e test as it was written.
- Gates on the merge: typecheck, lint (ESLint + catalogue check), format:check clean · `docs:api`
  OK · `check_tasks.py` OK · `test:e2e` **26/26** (load ≈ 20–25) · `npm run -s test:coverage` at
  load 19–25: 1548 passed, 1 failed — `test/web/element/panel.test.tsx` "shows the element…"
  (bug-004, absorbed into task-019); that file run alone: **16/16**; the full run with `--retry=2`:
  **95 files passed, 1 skipped; 1549 passed / 1 skipped**, coverage 96.15 % statements / 89.55 %
  branches / 96.69 % functions / 98.01 % lines (`web/src/docs` 98.06 % / 92.17 %) ·
  `npm run test:timing` not re-run (load ≈ 20 > 12): the last run, at `53c5113` + notes (load
  9.1 → 8.7), passed 3/3 (REQ-PERF-03 20/20, max 1756 ms; TypeDoc 11 539 ms; REQ-PERF-06
  631–1322 ms).
