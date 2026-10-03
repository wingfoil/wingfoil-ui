---
id: spec-008-message-catalogue
type: tech-spec
title: "Message catalogue"
status: pending
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
web/src/i18n/index.ts       # loads the catalogue, creates the IntlProvider (locale "en")
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
  REQ-ARC-09). The catalogue never holds a type or state name (REQ-ARC-05).
- The page title (US-X-10) is composed by messages:
  `title.projectView` = `{project} · {view} — WingFoil UI`,
  `title.projectElement` = `{project} · {element} — WingFoil UI`,
  `title.projects` = `Projects — WingFoil UI`; the state segment adds
  `title.projectCompletionView` = `{project} · {completion} % · {view} — WingFoil UI` (v0.3,
  X-10.4) and `title.projectPhaseView` = `{project} · {phase} · {view} — WingFoil UI` (v0.4,
  X-10.5; the phase name is project data).

### 4. Texts coming from the server

- API errors are rendered from `error.` + the `code` in lowerCamelCase (`folder-not-found` →
  `error.folderNotFound`; codes of spec-004 §4–§5 and the project-list codes of spec-006 §3),
  with `detail` as the arguments — e.g. `error.folderNotFound` =
  `Folder not found: {path}`. The envelope's `message` is not shown, except:
- **tool output** — the CLI's refusal (`cli-refused`) and git's error (`git-refused`) — is shown
  verbatim inside a catalogue frame (`error.cliRefused` = `WingFoil refused the action:` + the
  verbatim block): it is the tool's text, treated like project data.

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
  neither a key nor project data.
- ESLint `eslint-plugin-formatjs`: `no-literal-string-in-jsx` (including the `aria-label`,
  `title`, `alt` and `placeholder` attributes), `enforce-placeholders`, `no-multiple-plurals`
  (`enforce-id` is not used: it targets generated hash ids); every message has an explicit `id`
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
