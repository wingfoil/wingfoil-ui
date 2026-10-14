---
id: spec-008-message-catalogue
type: tech-spec
title: "Message catalogue"
status: approved
scope: "UI message catalogue: files, key scheme, message syntax, key-rendering build, server-side texts"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

REQ-ARC-09 and X2 require every UI string to come from a message catalogue (English only in the
MVP) while project data stays untranslated; `adr-002` picks FormatJS (`react-intl`). The
scenarios X-09.1/X-09.2 test it with a build that renders keys instead of messages. Every web
task adds strings: without one key scheme, one file layout and one rule for server-produced
texts, catalogues fork per screen and the key-rendering test cannot be written once.
Identified by `release-planning` v0.1 (`identify-specs`).

## Specification

### 1. Files

```
web/src/i18n/en.json        # the web catalogue: { "<key>": "<ICU message>", ... }, keys sorted
web/src/i18n/index.tsx      # loads the catalogue, creates the IntlProvider (locale "en")
server/src/i18n/en.json     # the server catalogue (launcher texts, §5)
```

English is the source and only locale in the MVP; a later locale adds `<locale>.json` with the
same keys. Catalogues are JSON, one flat object, UTF-8, sorted by key (checked).

### 2. Keys

- Explicit, human-readable ids — never generated hashes: `<area>[.<place>].<item>[.<variant>]`,
  each segment lowerCamelCase, e.g. `memory.list.filter.allTypes`,
  `projects.add.title`, `shell.roleView.label`, `a11y.skipToContent`.
- `<area>` is one of: `shell`, `projects`, `memory`, `element`, `dna`, `directives`, `team`,
  `docs`, `title` (page title), `error` (API error codes, §4), `state` (warnings about the local
  state, spec-006 §4), `a11y` (texts only for assistive technology), `common` (reused verbs such
  as `common.action.cancel`); `launcher` exists only in the server catalogue (§5). Later releases add areas
  (`today`, `workflow`, …) the same way.
- A key keeps its meaning forever: a changed meaning gets a new key; an unused key is deleted.
- Accessible names, `aria-label`s, live-region announcements, tooltips, placeholders and the
  page title are catalogue messages like any visible text.

### 3. Messages

- ICU MessageFormat: arguments (`{name}`), plurals (`{count, plural, one {# element} other {#
  elements}}`), `select`; rich-text tags for emphasis inside a sentence. Never build a sentence
  by concatenating messages or messages and data.
- Project data — element titles, ids, type and state names, role names, member names, paths,
  directive and document text — is passed as an argument and shown as written (X-09.2,
  REQ-ARC-09). The catalogue never holds a type or state name (REQ-ARC-05). The bucket labels of
  the Memory list (*To approve*, *In progress*, *Waiting/drafts/closed*, *Done*, header of
  `features/m/memory-list.feature`) are the UI's closed vocabulary, not state names, even where
  a project's state is spelled the same.
- The page title (US-X-10) is composed by messages:
  `title.projectView` = `{project} · {view} — WingFoil UI`,
  `title.projectElement` = `{project} · {element} — WingFoil UI`,
  `title.projects` = `Projects — WingFoil UI`, `title.app` = `WingFoil UI` (written into
  `web/index.html` at build time and used until a page sets its title); a documentation
  document and a directive page use `title.projectView` with the document path or the directive
  id (project data) as `{view}`; the state segment adds
  `title.projectCompletionView` = `{project} · {completion} % · {view} — WingFoil UI` (v0.3,
  X-10.4) and `title.projectPhaseView` = `{project} · {phase} · {view} — WingFoil UI` (v0.4,
  X-10.5; the phase name is project data).

### 4. Texts coming from the server

- API errors are rendered from `error.` + the `code` in lowerCamelCase (`folder-not-found` →
  `error.folderNotFound`, `cli-not-found` → `error.cliNotFound`; codes of spec-004 §4–§5 and the
  project-list codes of spec-006 §3),
  with `detail` as the arguments — e.g. `error.folderNotFound` =
  `Folder not found: {path}`. The envelope's `message` is not shown, except:
- **tool output** — the CLI's refusal (`cli-refused`) and git's error (`git-refused`) — is shown
  verbatim inside a catalogue frame (`error.cliRefused` = `WingFoil refused the action:` + the
  verbatim block): it is the tool's text, treated like project data.
- **Reason codes** of the action descriptor (spec-003 §6, e.g. `local-changes`,
  `version-unsupported {range}`) and of the capability table (spec-001 §6, e.g. `not-released`,
  `needs-version {minVersion}`) are rendered from the catalogue as `<area>.reason.` + the code
  (segments lowerCamelCase, §2), with the parameters as the arguments. The descriptor reason
  `version-unsupported` (`{range}` label), the capability reason `unsupported-version`
  (`{range: {min, max}}`, spec-001 §6) and the API error code `unsupported-version` (spec-004 §4)
  are distinct keys of different areas, by design.

### 5. Server catalogue

The launcher's terminal lines (spec-007 — Node.js refusal, URL line, port in use, stop) live in
`server/src/i18n/en.json`, same key scheme (`launcher.*`), formatted with `@formatjs/intl` (no
React) — except the Node.js check, which substitutes its arguments itself (spec-007 §2). Texts
shown in the browser are never in the server catalogue: the server sends a key of the web
catalogue and its arguments (`warnings: [{ key, args }]` of `GET /api/server`, spec-006 §4;
`state.*` keys).

### 6. Key-rendering build and checks

- `npm run build:keys -w web` builds the application with a catalogue in which every message is
  replaced by its key followed by the message's argument placeholders
  (`{ "memory.list.title": "memory.list.title", "error.folderNotFound": "error.folderNotFound
  {path}" }`; a plural or select argument becomes `{<argument name>}`; the key build renders select and
  plural argument values as given, and X-09.1 treats them like project data), so that project data passed as an
  argument is still rendered (X-09.2). X-09.1 runs the release's screens on this build and fails on any visible text that is
  neither a key nor project data. The key build is written to `web/dist-keys` and served to the
  e2e page by Playwright route interception; the bin serves `web/dist` only.
- X-09.1 checks visible text **and accessible names** (`aria-label`, `alt`, `title`,
  `placeholder`); project data is recognised from the API responses the page read (with its
  English rendering of dates, relative ages and lists). React Aria runs under
  `I18nProvider locale="en"` (the catalogue's locale); its own strings — the visually hidden
  "Dismiss" button of a popover — are the one documented exception: library strings outside the
  catalogue, to be localised with the library's locale when a second catalogue arrives.
- A **CLI command shown as data** (v0.2, task-035 D35-3) — the *How to join* command
  `wingfoil dna add team.members --value "<Your Name>" --entry-email <email> --entry-roles <roles>`
  — is not a catalogue message: its words are WingFoil's command line and are never translated;
  only its placeholders (`<Your Name>`, `<roles>`) are catalogue messages and the email is data.
  It is rendered in a `code.cli-command` with `translate="no"`, built by one function of the web
  (`joinCommand`, `web/src/project/join.ts`), which is also what *Copy command* copies. X-09.1
  accepts the text of such an element only when it equals that function's output for a string
  value the page read from the API (the user's email is one) and the key texts of the two
  placeholders; any other text there is reported.
- ESLint `eslint-plugin-formatjs`: `no-literal-string-in-jsx` (including the `aria-label`,
  `title`, `alt` and `placeholder` attributes), `no-multiple-plurals` (`enforce-id` is not used: it
  targets generated hash ids); placeholders are checked by the project rule
  `wfui/catalogue-placeholders` (`lint/catalogue-placeholders.js`): the `values` of each message
  against the arguments of its `en.json` text, and a `defaultMessage` in code is refused
  (formatjs's `enforce-placeholders` needs a `defaultMessage` in code, which §1 and the
  Consequences rule out); every message has an explicit `id`
  matching `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$`, checked by the script; a check script compares the ids used in code
  (`@formatjs/cli extract`) with the catalogue: no missing key, no unused key, sorted file.

### 7. Verification

- e2e: X-09.1, X-09.2 on the key-rendering build (REQ-ARC-09 fit criterion: 100 %).
- Lint and the extract check in CI and in every `dev-loop` review of a `web` task.
- Unit: the error renderer maps every `code` of spec-004 §4–§5 and spec-006 §3 to a key.

## Consequences

- Every `web` task adds its keys to `en.json` in the same commit as the component.
- Changing an English text is a catalogue edit, not a component edit.
- Server error codes become part of the UI contract: adding a code means adding its key.

## Process Notes

- 2026-10-03 — identified by `release-planning` v0.1 (`identify-specs`, plan session 2) at the
  user's request: `adr-002` named FormatJS, no spec fixed keys, layout or server texts.
- 2026-10-03 — independent spec review (plan session 2): F7 example key; F8 `state` and
  `launcher` areas, browser texts only in the web catalogue; F10 key build keeps argument
  placeholders; F14 completion and phase title keys; F15 no `enforce-id`, id pattern checked by
  script; F16 code → key mapping.
- 2026-10-03 — re-verification (plan session 2): N2 optional `<place>` segment; N3 select/plural
  arguments in the key build.
- 2026-10-04 — release-planning audit (plan session 4, A5): `error.cliNotFound` example.
- 2026-10-06 — audit follow-up of the Wave 2 amendments (dev-loop tasks 006, 011, plan
  dev-loop-rel-v0.1-plan): §4 reason codes of the descriptor and of the capability table rendered
  as `<area>.reason.` + code with parameters as arguments; `version-unsupported` (descriptor) and
  `unsupported-version` (capability table; API) are distinct keys by design; decided by the user.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan): §6 placeholders checked by
  `wfui/catalogue-placeholders` instead of `enforce-placeholders` (W3-3); the key build in
  `web/dist-keys`, served to e2e by Playwright route interception, no server change (W3-4);
  decided by the user.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan, independent review): erratum §1 `index.tsx`
  (the file holds the provider component).
- 2026-10-07 — amended in dev-loop task-018 (Wave 3, plan dev-loop-rel-v0.1-plan): history lines name the verb, not
  the state ("created by", "submitted by", "signed off by", "rejected by", "marked obsolete by",
  "edited outside a WingFoil verb by" + `{name}`), the transition `{from} → {to}` is data (§3,
  W3-20; "marked obsolete by" W3-21); decided by the user.
- 2026-10-07 — amended in dev-loop task-017 (Wave 3, plan dev-loop-rel-v0.1-plan): §3 bucket labels are the UI's
  closed vocabulary (W3-27); decided by the user.
- 2026-10-10 — amended in dev-loop task-021 (Wave 5, plan dev-loop-rel-v0.1-plan): §3
  `title.app` and the titles of a document and a directive page (W5-2, W5-5); §6 X-09.1 covers
  accessible names, project data from the API responses, React Aria library strings as the
  documented exception under `I18nProvider locale="en"` (W5-1, W5-3); decided by the user.
- 2026-10-13 — amended in dev-loop task-035 (minor-v0.2, Wave 1, plan dev-loop-rel-v0.2-plan):
  §6 a CLI command shown as data (the *How to join* command): words from code, placeholders from
  the catalogue, `code.cli-command[translate="no"]`, X-09.1 rebuilds it from the page's data
  (D35-3); decided by the approver. Review round 1 (F5, 2026-10-14): the wording says "a string
  value the page read" (the check rebuilds the command for each one), not "an email".
