---
id: task-020-documentation-index-and-links
type: task
title: "Documentation index and links"
status: in-progress
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
- Coordination with task-017: the `GET /elements` query is `projectElementsQuery(pid, {archived})`
  in `web/src/api/queries.ts` with the key `queryKeys.project(pid, 'elements', { archived })` (017
  owns it; the merge unifies). `/p/$pid` redirects to the Memory list (W3-22): nothing here assumes
  what `/p/$pid` shows.
