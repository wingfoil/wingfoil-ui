---
id: spec-006-local-state-store
type: tech-spec
title: "Local state store"
status: approved
scope: "local state file: project list, role view per project (v0.1); UI settings, action log (reserved)"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`adr-001` D10 and REQ-ARC-08 put the UI's own state — the project list, the role view per
project, later the UI settings and the action log — in the operating system's user configuration
directory, never in a repository. They do not fix the file: where exactly it lives, its shape, how
project ids are issued, and what happens when it is missing, corrupt, written by a newer build or
by two consoles at once. The project-list stories (S2: US-S-03…07, S-16…19), the role view
(US-S-22), opaque ids (US-X-05, REQ-SEC-04), list integrity (REQ-STATE-07) and no secrets
(REQ-SEC-09) all depend on one definition; without it each task would invent its own file.
Identified by `release-planning` v0.1 (`identify-specs`).

## Specification

### 1. Location

The state directory is, in this order:

1. `$WINGFOIL_UI_STATE_DIR` when set (absolute path; used by the e2e suite to isolate each run);
2. Linux and other Unix except macOS: `$XDG_CONFIG_HOME/wingfoil-ui`, else `~/.config/wingfoil-ui`;
3. macOS: `~/Library/Application Support/wingfoil-ui`;
4. Windows: `%APPDATA%\wingfoil-ui`.

The directory is created on first write with mode `0700` (POSIX). It holds `state.json` (mode
`0600`) and nothing the user must edit. The state directory must never lie inside a project's
working tree (REQ-ARC-08): adding a project whose working tree contains it is refused
(`state-dir-inside-project`, §3); a list that already has such an entry (e.g. the variable changed
since) stops the start with a message naming both paths (spec-007 §6, exit 4).

### 2. File `state.json` (schema `contracts/state/state.schema.json`)

```json
{
  "version": 1,
  "projects": [
    {
      "id": "p_7kq2m9x4r1tz",
      "path": "/home/alex/projects/kanban",
      "name": "kanban",
      "remote": "https://github.com/acme/kanban.git",
      "addedAt": "2026-10-03T09:12:44Z",
      "roleView": "developer"
    }
  ],
  "settings": {},
  "actionLog": []
}
```

| Field | Rule |
|-------|------|
| `version` | integer, `1` for this spec |
| `projects[]` | ordered by insertion; the project switcher shows this order (S-17.1) |
| `id` | `p_` + 12 characters of base32 (Crockford, lower case) from 60 random bits, drawn at add time; unique in the file; never derived from the path (REQ-SEC-04) |
| `path` | absolute, `realpath` of the working directory at add time |
| `name` | `dna.project.name` read at add time and refreshed on every successful open; shown while the folder is unavailable (S-19.1) |
| `remote` | URL of `origin` at add time, refreshed on every open, `""` when there is none; **userinfo removed** (`https://user:token@host/x.git` → `https://host/x.git`, REQ-SEC-09) |
| `addedAt` | ISO 8601 UTC |
| `roleView` | last role view chosen for this project (S-22.3); `""` = the shell's default (the member's first role) |
| `settings` | reserved for the UI settings (v0.2, C4, REQ-ARC-11 setting); written as `{}` in v0.1 |
| `actionLog` | reserved for the action log (REQ-SEC-10, from the first governed write); written as `[]` in v0.1 |

Availability (folder found, `.wingfoil/` present, CLI found — REQ-STATE-07, S-10, S-19) is
**computed** on every read of the list, never stored.

### 3. Operations

- **Add** (local folder, or a remote): rejected — the file unchanged — when the `realpath`
  equals a listed `path`, or the candidate's normalised remote equals a listed `remote` (S-06.1,
  S-06.2). For a remote the URL typed by the user is compared **before cloning**; a local folder
  is compared on its `origin`. Remote normalisation: the scp-like form `user@host:owner/repo` is
  read as `ssh://host/owner/repo`; userinfo removed; host lower-cased; trailing `/` and `.git`
  removed; then **host + path** are compared, whatever the scheme. The entry is appended.
- **Remove**: drops the entry; no file of the project is touched (S-18.1).
- **Role view**: `PUT /api/p/:pid/role-view` (spec-004) sets `roleView`; a role the member no
  longer holds falls back to the default when read.
- An unknown `:pid` is 404 (X-05.2); ids are compared as exact strings, never resolved as paths.
- Refusals of `POST /api/projects` and `POST /api/projects/clone` (spec-004 §3) use the error
  envelope of spec-004 §5, status 422, the file and the file system unchanged (REQ-STATE-07):

| `code` | `detail` | Scenario |
|--------|----------|----------|
| `folder-not-found` | `{ path }` | S-03.2 |
| `not-wingfoil` | `{ path }` or `{ source: "clone" }` (the clone is removed) | S-05.1, S-05.2 |
| `already-listed` | `{ pid, name, sameRemote: boolean }` | S-06.1, S-06.2 |
| `directory-not-empty` | `{ path }` | S-07.2 |
| `state-dir-inside-project` | `{ path, stateDir }` | §1 (no scenario) |
| `git-refused` | — (`message` = git's message verbatim, spec-004 §5) | S-07.1, S-07.3 |

### 4. Reads and writes

- Read once at start and before every mutation (re-read, modify, write), so that two consoles on
  different ports (spec-004 §2) do not silently drop each other's additions; a mutation of the
  same entry by both is last-writer-wins.
- Every write is atomic: write `state.json.tmp-<process id>` in the same directory, `fsync`, rename over
  `state.json`. Mutations inside one server are serialised by an in-process lock.
- Warnings for the shell are returned by `GET /api/server` (spec-004 §3) in
  `warnings: [{ key, args }]` (keys of the web catalogue, spec-008 §5).
- **Missing file** → empty state (first start, S-01.1).
- **Unparsable or schema-invalid file** → renamed to `state.json.corrupt-<UTC timestamp>`, the
  server starts with an empty state, and the shell shows a dismissible warning naming the kept
  file (`state.corruptKept`). The file is never deleted silently.
- **`version` greater than 1** (written by a newer build) → the state is read for the fields this
  version knows, nothing is written back, and the shell warns "Project list saved by a newer
  WingFoil UI — changes are not saved" (`state.newerVersion`).

### 5. What the file never holds

No session token or session id, no git credential, no environment variable value, no content of
a project (REQ-SEC-09). The secret scan of REQ-SEC-09 runs over the state directory.

### 6. Verification

- Unit: location resolution per platform and with `WINGFOIL_UI_STATE_DIR`; schema round-trip;
  id format and uniqueness; userinfo stripping; duplicate detection table (same path, symlinked
  path, same remote with/without `.git`, different case of host, scp-like `git@host:o/r.git` vs
  `https://host/o/r`, a known remote refused before any clone starts); corrupt file kept and replaced;
  newer version read-only; atomic write (no partial file after a killed write).
- e2e: S-03…S-07, S-16…S-19, S-22.3, X-05.1/X-05.2; REQ-ARC-08 fit criterion (`git status
  --porcelain` clean, state survives a restart); REQ-SEC-09 secret scan.

## Consequences

- The e2e suite sets `WINGFOIL_UI_STATE_DIR` per run: no test touches the developer's own list.
- Project URLs stay valid across restarts (stable ids), which bookmarks and the page title rely on.
- v0.2 (settings, action log) extends `settings`/`actionLog` without a version bump; any change
  of an existing field's meaning bumps `version` and adds a migration from 1.

## Process Notes

- 2026-10-03 — identified by `release-planning` v0.1 (`identify-specs`, plan session 2): adr-001
  D10 named the directory but no file; proactive, not discovered by a task.
- 2026-10-03 — independent spec review (plan session 2): F1 `git-refused` text in `message`; F2
  state directory inside a project refused at add and at start; F9 warnings in `GET /api/server`;
  F17 remote compared before cloning, scp-like form; F18 temp file named by process id; F19 macOS.
- 2026-10-03 — re-verification (plan session 2): N4 duplicate cases in §6; N3 `not-wingfoil`
  detail as a string enum.
