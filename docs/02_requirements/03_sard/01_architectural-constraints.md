# SARD — 1. Architectural Constraints

**Version:** 0.9 · **Date:** 2026-10-12 (0.2: coherence audit fixes — session 6; 0.3: page title, REQ-ARC-10 — initial-design session 2; 0.4: REQ-ARC-04 allow-list of direct reads — initial-design session 5; 0.5: REQ-ARC-06 last non-archived state — initial-design session 6; 0.6: REQ-ARC-07 moved to v0.3 — release-planning v0.1 session 2; 0.7: REQ-ARC-05, REQ-ARC-10 v0.1 scope — release-planning v0.1 session 4 (audit A4); 0.8: REQ-ARC-05 lint scope — dev-loop task-011; REQ-ARC-04 hash-only reads for the state key — dev-loop task-010; 0.9: REQ-ARC-03 write class (c) includes the automatic update's local `merge --ff-only` — release-planning v0.2 session 2, RP-41) · **Status:** Draft — specification-downcast session 4

Shell and conventions: `00_sard.md`.

---

### REQ-ARC-01 — Local server on Node.js, run with npx

| Field | |
|-------|--|
| Release | v0.1 |
| Description | WingFoil UI is a local Node.js server that serves the browser UI, distributed as the npm package `wingfoil-ui` with a `bin`, run with `npx wingfoil-ui`; it needs only Node.js ≥ 22.12, git and the observed project's `wingfoil`. |
| Rationale | Same runtime and registry as WingFoil; zero install for its users (Q1, `07_sequencer.md`); a browser cannot run the CLI or read the repository (ADR draft). |
| Traceability | US-S-01, US-S-02 · S-01.1, S-01.2, S-01.3, S-02.1 · S1 · `07_sequencer.md` Q1 |
| Fit criterion | [boolean] On a machine with only Node.js 22.12 and git installed, `npx wingfoil-ui` serves the UI on 127.0.0.1; with Node.js 20.x it exits with a non-zero status and opens no port. |
| Verified by | e2e-smoke `launch` |

### REQ-ARC-02 — The observed project's own CLI

| Field | |
|-------|--|
| Release | v0.1 |
| Description | For each project the server runs the `wingfoil` that the project pins (`node_modules/.bin/wingfoil`), else the one on the PATH; it never bundles or runs a copy of its own. With none found the project is not opened. |
| Rationale | Commits identical to the team's; one behaviour per project version (`02_product-vision.md`, *Which CLI runs*). |
| Traceability | US-S-08, US-S-10 · S-08.1, S-08.2, S-10.1, S-10.2 · S1, S3 · directive `cli-only-writes` |
| Fit criterion | [boolean] With a fixture pinning 0.2.2 and `wingfoil` 0.2.1 on the PATH, 100 % of the CLI processes the server starts for that fixture run the pinned binary (process audit); the package `wingfoil-ui` declares no dependency on `wingfoil`. |
| Verified by | e2e (process audit) · package.json review |

### REQ-ARC-03 — Four write classes, nothing else

| Field | |
|-------|--|
| Release | v0.1 (clone only) · v0.2 onward |
| Description | The server writes only through: (a) governed changes, by invoking the CLI (`wf(…)` commits); (b) `.wingfoil/ui.yaml`, schema-validated, one `chore(ui): …` commit touching only that file; (c) git transport — `clone` into a new, empty folder, fetch, `pull --ff-only` (and, for the automatic update, a local `merge --ff-only` to the fetched upstream, REQ-INT-06), push; (d) repository files after v1.0 (L4). It never writes `.wingfoil/` files (except `ui.yaml`), Memory element files or plans. The UI's own local state (REQ-ARC-08) lives outside every repository. |
| Rationale | WingFoil is the only writer of governed state; the one exception is explicit and testable (`02_product-vision.md`, *Write classes*; MVP canvas metric *No divergence*). |
| Traceability | US-G-04, US-G-10, US-G-15, US-C-02, US-Y-05, US-Y-07, US-S-04 · G-04.1, G-10.1, G-15.1, C-02.1, C-02.2, Y-05.1, Y-07.1, S-04.3 · S1, C1, Y3, Y4 · directive `cli-only-writes` |
| Fit criterion | [percentage] After the full e2e suite, 100 % of the commits created in each fixture are `wf(…)` commits made by a CLI process or `chore(ui)` commits changing exactly `.wingfoil/ui.yaml`; the server process opens 0 files for writing under `.wingfoil/` (other than `ui.yaml`) or under a Memory path (file-system audit); in v0.1 the only write is a clone into a new, empty folder (0 endpoints write an existing repository). |
| Verified by | e2e-smoke `drive-browser` (git log check) · file-system audit |

### REQ-ARC-04 — Reads through the CLI, direct reads on an allow-list

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Governed state is read through CLI JSON output wherever the CLI exposes it (DNA, paths, workflows, Memory list and history, directive list). What the pinned CLI does not expose is read **directly, read-only, from a closed allow-list**, until WingFoil provides a read verb: `.wingfoil/memory.yaml` (type definitions: `id_pattern`, `path`, required fields, `states`), the Memory element files at the `path` given by `memory search`, and the directive files at the `path` given by `directives list`. Each directly read shape has a JSON schema in `contracts/` per supported WingFoil version, and an element's `status` read from its file must equal the one `memory search` returns (otherwise: read error). When the CLI of the project provides the read verb (capability detection), the direct read is not used. Git is read directly only for HEAD, branches, ahead/behind, working-tree status, `git log` and the working-tree files shown in Files. The server writes none of these files. **Exception:** hash-only reads of the changed and untracked entries listed by `git status --porcelain`, for the repository state key (REQ-STATE-02); their content is neither kept nor exposed. |
| Rationale | One interpretation of the schema: WingFoil's, wherever the CLI exposes it. WingFoil 0.2.2 has no verb for type definitions, element content or directive bodies (checked 2026-10-02, initial-design session 5), yet the action descriptor, the element panel and the Directives view need them; a closed, schema-checked, read-only list keeps the drift visible and temporary. |
| Traceability | US-S-25, US-M-01, US-R-05, US-S-27 · S-25.1, M-01.1, R-05.1, S-27.1 · S1, S8 |
| Fit criterion | [boolean] A unit test with a file-system spy over every read endpoint records — excluding the hash-only reads of changed and untracked entries for the state key (REQ-STATE-02, spec-001 §4.4) — 0 direct reads of `.wingfoil/*.yaml` other than `ui.yaml` and `memory.yaml`, 0 reads of Memory or directive files at a path not returned by the CLI, and 0 writes to any of them; every allow-listed shape has a schema and a passing contract test per supported version; a fixture whose element file `status` differs from `memory search` shows a read error for that element. |
| Verified by | unit (fs spy) |

### REQ-ARC-05 — Methodology independence

| Field | |
|-------|--|
| Release | v0.1 (renders) · v0.2 (acts) |
| Description | Types, states, gates, roles and workflows come from each project; the UI hard-codes none of them outside the `ui.yaml` presets and the tests. |
| Rationale | Project-agnostic pillar; MVP canvas metric *Methodology independence*. |
| Traceability | US-S-28, US-M-02, US-T-05, US-G-05 · S-28.1, S-28.2, M-02.1, M-02.2, M-02.3, T-05.1, G-05.3 · S9, M1 |
| Fit criterion | [boolean] The same build renders and acts on the `kanban`, `custom` and `unknown` fixtures with every scenario of the release passing; a lint rule finds 0 values equal to a type or state name of the three fixtures in `server/` and `web/` — string and expression-free template literals, data keys (object-literal properties, class fields, interface and type-literal property signatures, enum members) and regular-expression words; method, getter and setter names are exempt by design; the only exempt path is `server/src/presets/**` (`test/` and `contracts/` are outside the rule; spec-005 §5). v0.1 (read-only): the same build renders the three fixtures with every `@v0.1` scenario passing. |
| Verified by | e2e on the three fixtures · lint |

### REQ-ARC-06 — Action descriptor derived from the project

| Field | |
|-------|--|
| Release | v0.1 (read) · v0.2 (actions) |
| Description | For each element the server derives, from `memory.yaml` (`sequence`, `gates`, `waiting`), the workflows and the CLI version: the verbs available, the reject targets, the role required (0.2.2: `approver` for every gate), who must act (first state → creator; after a reject → submitter, listed first; `waiting:` → workflow engine; last non-archived state → no one (archived: `deprecated`, `superseded`; spec-003); undeclared state → `tech-lead`, "Action required"; a state both gate and `waiting:` → workflow engine, reject only; gate states listed in *Requires you* of the reviewer and approver views only for members holding `approver`, in *Waiting on others* for the others). The UI shows only what the descriptor allows. |
| Rationale | Basis of Today, gate footers and Memory buckets on any methodology (S9; `02_bdd/00_conventions.md`). Specified as a tech-spec in `initial-design`. |
| Traceability | US-T-02, US-T-03, US-T-04, US-T-05, US-T-06, US-T-11, US-S-24, US-G-05, US-G-09 · T-02.1, T-03.1, T-04.1, T-05.1, T-05.2, T-06.1, T-11.1, T-11.2, S-24.1, S-24.2, S-24.3, S-24.4, G-05.1, G-05.3, G-09.1 · S9 |
| Fit criterion | [percentage] A table-driven unit test over the elements of the three fixtures yields the expected verbs, reject targets, required role and actor for 100 % of the rows. |
| Verified by | unit (table-driven) · e2e |

### REQ-ARC-07 — `ui.yaml`: the UI's only file

| Field | |
|-------|--|
| Release | v0.3 (read, inferred defaults, presets) — no `@v0.1` scenario reads `ui.yaml`; v0.1 opens a project whatever its `ui.yaml` (release-planning v0.1) |
| Description | `.wingfoil/ui.yaml` holds the UI's conventions (`version`, `taxonomy`, `progress`, `artifacts`) and nothing else — no permissions (they are WingFoil's, L6), no secrets. It has a JSON schema in `contracts/`. Without it, or when it fails the schema, the UI uses inferred defaults and warns. A preset (Kanban, Scrum, `sw-life-cycle`) is offered only when the file does not exist, refused when it maps a type the project does not declare, and validated before writing. `progress.scope` declares a type only; the current element is derived. |
| Rationale | One versioned home for the UI's conventions, invisible to WingFoil's loaders (W-11); decisions of sessions 3 (permissions, scope). |
| Traceability | US-C-01, US-C-02, US-C-03, US-C-04, US-T-12 · C-01.1, C-01.2, C-01.3, C-02.1, C-02.3, C-02.5, C-03.1, C-03.2, C-04.1, C-04.2, T-12.1, T-12.4, T-12.5 · C1, T2 |
| Fit criterion | [boolean] Each shipped preset validates against the schema and matches its fixture; the schema rejects a `permissions` key; every scenario listed passes. |
| Verified by | unit (schema) · e2e |

### REQ-ARC-08 — Local state outside the repositories

| Field | |
|-------|--|
| Release | v0.1 (project list) · v0.2 (UI settings) |
| Description | The project list, the role view per project, the UI settings and the action log (hash and time of each commit the UI caused, REQ-SEC-10) are stored per user in the operating system's user configuration directory, never in a project repository and never committed. |
| Rationale | Personal preferences must not change the project (C4; `03_is-isnot.md`). |
| Traceability | US-S-17, US-S-22, US-C-07 · S-17.1, S-17.2, S-22.3, C-07.1, C-07.2 · S2, S4, C4 |
| Fit criterion | [boolean] After the full e2e suite, `git status --porcelain` of every fixture prints only the changes the scenarios made on purpose, and the state survives a server restart. |
| Verified by | e2e |

### REQ-ARC-09 — Externalised strings

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Every UI string comes from a message catalogue (English only in the MVP); project data (titles, ids, state names) is never translated. |
| Rationale | A second language must not touch the screens (Q10, L8). |
| Traceability | US-X-09 · X-09.1, X-09.2 · X2 |
| Fit criterion | [percentage] With a build that renders catalogue keys instead of messages, 100 % of the visible non-project text on every screen of the release is a catalogue key. |
| Verified by | e2e (key-rendering build) |

### REQ-ARC-10 — Accessibility WCAG 2.1 AA

| Field | |
|-------|--|
| Release | v0.1 (v0.1 screens, X-06, X-10.1–X-10.3) · v0.2 onward (gate actions, live regions, title state) |
| Description | Every MVP screen meets WCAG 2.1 AA: keyboard operation with a visible focus, outcomes announced to screen readers, the reason of a blocked action exposed as its accessible description, text alternatives for images, a page title naming the project, its state and the current view or element (SC 2.4.2). |
| Rationale | Q10, directive `accessibility`; MVP canvas metric *Accessibility*. |
| Traceability | US-X-06, US-X-07, US-X-10, US-T-14, US-X-01, US-G-04 · X-06.1, X-06.2, X-06.3, X-06.4, X-07.1, X-07.2, X-07.3, X-10.1, X-10.2, X-10.3, X-10.4, X-10.5, T-14.2, X-01.3 · X1 |
| Fit criterion | [numeric] axe-core reports 0 violations of impact serious or critical on every screen of the release in both themes; focus indicators have a contrast ratio ≥ 3:1; every gate action is completed with the keyboard alone; scenarios X-07.1, X-07.2, X-07.3 (live regions, accessible descriptions) and X-10.1 … X-10.5 (page title) pass. v0.1 (no gate action): axe and focus contrast on the v0.1 screens, X-06.1, X-06.3, X-06.4 and X-10.1 … X-10.3 pass. |
| Verified by | e2e-smoke `accessibility` |

### REQ-ARC-11 — Light and dark themes

| Field | |
|-------|--|
| Release | v0.1 (system) · v0.2 (setting) |
| Description | Light and dark themes follow `prefers-color-scheme` by default and can be forced in the UI settings; both meet AA contrast. |
| Rationale | X3. |
| Traceability | US-X-08 · X-08.1, X-08.2, X-08.3 · X3, C4 |
| Fit criterion | [numeric] In each theme every text has a contrast ratio ≥ 4.5:1 (≥ 3:1 for large text) against its background, measured by axe-core on every screen of the release. |
| Verified by | e2e-smoke `accessibility` |

## Process Notes

- 2026-10-06 — amended in dev-loop task-011 (Wave 2, plan dev-loop-rel-v0.1-plan): REQ-ARC-05 fit
  criterion aligned with the lint scope of spec-005 §5 — literals, data keys, class fields,
  interface property signatures, enum members and regex words checked; method, getter and setter
  names exempt; only `server/src/presets/**` exempt; `test/` and `contracts/` outside the rule;
  decided by the user (option 10a, with the method/getter/setter-name exemption).
- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): REQ-ARC-04
  exception to the direct-read allow-list (Description and fit criterion) — hash-only reads of
  changed and untracked working-tree entries for the repository state key (REQ-STATE-02); content
  is neither kept nor exposed; decided by the user as part of #18 (REQ-STATE-02 content
  fingerprint). Audit follow-up of the Wave 2 amendments: the exception scoped to the whole
  fs-spy count of the fit criterion (spec-001 §4.4) and moved after "The server writes none of
  these files." in the Description.
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-41): REQ-ARC-03 write
  class (c) names the automatic update's local `merge --ff-only` (spec-010 §4, REQ-INT-06); no
  other write class changes; decided by the approver.
