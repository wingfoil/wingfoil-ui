---
id: spec-006-local-state-store
type: tech-spec
title: "Local state store"
status: approved
scope: "local state file: project list, role view per project (v0.1); UI settings, action log (v0.2)"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
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

1. `$WINGFOIL_UI_STATE_DIR` when set and not empty (used by the e2e suite to isolate each run); a
   relative value is resolved against the current directory;
2. Linux and other Unix except macOS: `$XDG_CONFIG_HOME/wingfoil-ui` when that variable holds an
   absolute path, else `~/.config/wingfoil-ui`;
3. macOS: `~/Library/Application Support/wingfoil-ui`;
4. Windows: `%APPDATA%\wingfoil-ui`, or `<home>\AppData\Roaming\wingfoil-ui` when `APPDATA` is
   not set.

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
  "settings": {
    "autoFetch": true,
    "fetchIntervalSeconds": 60,
    "autoUpdate": false,
    "autoPush": false,
    "theme": "system",
    "confirmAgentLaunch": true,
    "actionLogCap": 5000
  },
  "actionLog": [{ "sha": "4c8ead30f976eccb7b48c3ba75a33ded9fd55e34", "at": "2026-10-12T09:30:02Z" }]
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
| `settings` | the UI settings (v0.2, C4, REQ-STATE-09), global to every project; written as `{}` in v0.1. A missing key, or a stored value of the wrong type or out of range, reads as its default (below) — the file is not treated as corrupt — so a v0.1 file needs no migration; an unknown key (e.g. a newer build's) is ignored on read and dropped at the next write |
| `actionLog` | the action log (REQ-SEC-10, v0.2): `{ sha, at }` — the full commit hash and its ISO 8601 UTC time — appended for every commit in `commits[]` of a successful governed write from the UI (spec-004 §5), no other data; holds at most `settings.actionLogCap` entries: an append drops the oldest beyond the cap, and a `PUT /api/settings` that lowers the cap trims the oldest entries in the same write; written as `[]` in v0.1 |

**Settings (v0.2, `contracts/api/settings.schema.json`; REQ-STATE-09, C-07.1):**

| Key | Type | Default | Effect |
|-----|------|---------|--------|
| `autoFetch` | boolean | `true` | fetch every `fetchIntervalSeconds` (spec-010 §6) |
| `fetchIntervalSeconds` | integer, 15–3600 | `60` | interval of the scheduler's ticks (spec-010 §6; REQ-PERF-07's default 60 s) |
| `autoUpdate` | boolean | `false` | fast-forward after a successful automatic fetch (spec-010 §6) |
| `autoPush` | boolean | `false` | push after each governed write from the UI (spec-010 §6) |
| `theme` | `"system"` \| `"light"` \| `"dark"` | `"system"` | overrides `prefers-color-scheme` (spec-009 §1, X-08.3) |
| `confirmAgentLaunch` | boolean | `true` | stored and shown; takes effect from WingFoil 0.3 — capability `agent-launch`, `minVersion` `0.3.0` in `contracts/capabilities.json` (spec-001 §6; RP-15) |
| `actionLogCap` | integer, 100–100 000 | `5000` | most entries kept in `actionLog` (REQ-SEC-10) |

`PUT /api/settings` (spec-004 §3) takes the whole object: every key above, each of its type —
the two integers whole numbers inside their range, `theme` one of its three values; any other
body (a key missing, a wrong type, an out-of-range integer) → **400** `invalid-request`, nothing
stored; the schema has no additional properties, and `GET /api/settings` returns exactly these
keys. It writes under the lock of §4 (with the `actionLog` trim when the cap is lowered) and
sends the `settings` event. A change takes effect without a restart: the scheduler reads the
settings at each tick and re-arms its timer when `autoFetch` or `fetchIntervalSeconds` changes
(spec-010 §6), within the 120 s of REQ-STATE-09. Settings hold no secret (REQ-SEC-09).

Availability (folder found, `.wingfoil/` present, CLI found — REQ-STATE-07, S-10, S-19) is
**computed** on every read of the list, never stored. `GET /api/projects` returns each entry as
`{ id, name, path, remote, availability }` (the switcher shows name and path, `ux-reference.md`
§3; REQ-SEC-04 keeps paths out of URLs, not out of response bodies) with `availability` one of `ok`, `folder-not-found` (S-19.1),
`not-wingfoil` (`.wingfoil/` removed since the add) or `cli-not-found` (S-10.2, with `command`,
the install command). A change of availability or of the
list is notified by the `projects` event (spec-004 §6).

### 3. Operations

- **Add** (local folder, or a remote): rejected — the file unchanged — when the `realpath`
  equals a listed `path`, or the candidate's normalised remote equals a listed `remote` (S-06.1,
  S-06.2). For a remote the URL typed by the user is compared **before cloning**; a local folder
  is compared on its `origin`. Remote normalisation: the scp-like form `user@host:owner/repo` is
  read as `ssh://host/owner/repo`; userinfo removed; host lower-cased; trailing `/` and `.git`
  removed; then **host + path** are compared, whatever the scheme. The entry is appended.
- **Paths as typed:** a leading `~` is the user's home directory; `detail.path` of a refusal is
  the path **as typed** (never the resolved real path). The default clone directory is
  `~/projects/<repo>` (the last path segment of the URL without `.git`, S-04.1).
- **Name:** for a local folder, `dna.project.name` read by `dna show`; a refused or invalid
  `dna show` (S-27.1) does not stop the add — the name is the folder's base name. **At clone
  time no CLI of the cloned repository runs** (no discovery-and-run, no `dna show`): the name is
  the folder's base name until the first open refreshes it (§2 `name`, "refreshed on every
  successful open"). Security note (`adr-001` D2, REQ-ARC-02): the project's own CLI comes first
  in discovery, so a freshly cloned repository could ship its own `node_modules/wingfoil`; it is
  run only when the user opens the project, never as a side effect of the clone.
- **Clone without a CLI:** a clone whose project has no CLI (pinned or on the `PATH`) is **kept**
  and listed with availability `cli-not-found` (S-10.2, with the install command); the
  `cli-not-found` refusal below applies to adding a local folder only.
- **Clones are serialised** on the write-lock key `clone` (`adr-001` D5) — never a project id or a
  user path — so two clones into the same folder cannot race; the premises (listed remote,
  empty target) are re-checked inside it.
- **Responses:** `POST /api/projects` and `POST /api/projects/clone` → **201** with the new item
  (`contracts/api/projects.item.schema.json`, as an entry of `GET /api/projects`);
  `DELETE /api/projects/:pid` → **204** with no body.
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
| `cli-not-found` | `{ path, command: "npm install --save-dev wingfoil" }` (local folder only) | S-10.1 |
| `state-dir-inside-project` | `{ path, stateDir }` | §1 (no scenario) |
| `directory-inside-project` | `{ path }` — the clone target lies inside a listed project | (no scenario) |
| `inside-state-dir` | `{ path }` — the clone target lies inside the state directory | §1 (no scenario) |
| `credentials-in-url` | — : the clone URL carries credentials: an http(s), ftp(s) or `git://` URL with any userinfo (a user name, a token or a password), or an `ssh://` URL or scp-like address whose userinfo holds a password (`user:pass@`, a percent-encoded `:` included). A clone URL holding a control character (U+0000–U+001F, U+007F) is a malformed source: 400 `invalid-request` (spec-004 §5), nothing run, the URL not echoed. The address is judged as git uses it: every leading `<transport>::` prefix removed, leading whitespace trimmed, any number of `/` or `\` after `<scheme>:`. Checked right after the source validation, before any file-system, state or git work; nothing is cloned and the URL is never written to a command line, a file, the state or a log (REQ-SEC-09, bug-006). A plain login — `ssh://user@host/…`, scp-like `user@host:…` — is allowed | (no scenario) |
| `git-refused` | — (`message` = git's message verbatim, spec-004 §5): a failed clone, or a folder with `.wingfoil/` that is not a git repository | S-07.1, S-07.3 |

### 4. Reads and writes

- Read once at start, before every mutation (re-read, modify, write) and when the list is served
  (`reload`), so that two consoles on different ports (spec-004 §2) see and keep each other's
  additions; a mutation of the same entry by both is last-writer-wins.
- **Lock between consoles:** every re-read → write runs under `state.json.lock` in the state
  directory, created exclusively (`wx`) and holding `<hostname> <pid> <nonce>`. The holder
  refreshes its modification time every quarter of the stale age (10 s); a lock is stale when
  not refreshed for 10 s, or when its host is this machine's and its pid is dead. A waiter
  retries with a short backoff and gives up after 15 s (the mutation fails). The lock is removed
  only by the console whose nonce it holds. A transaction is short: no clone, CLI or network
  call inside it (slow work first, then its premises are re-checked under the lock).
- Every write is atomic: write a temporary file unique to the writer in the same directory
  (`state.json.tmp-<pid>-<n>`, created exclusively, mode `0600`), `fsync`, rename over
  `state.json`; temporary files of dead processes are removed on open. Mutations inside one
  server are serialised by an in-process lock. A mutation that changes nothing creates no
  directory or file.
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
- 2026-10-04 — release-planning audit (plan session 4, A5): `cli-not-found` refusal; `availability`
  values of `GET /api/projects`; `projects` event.
- 2026-10-04 — re-verification of the release-planning audit (N4): `GET /api/projects` returns
  `path` and `remote` for the switcher (ux-reference §3); paths stay out of URLs only.
- 2026-10-05 — amended in dev-loop task-007 (independent review, three passes), decided by the
  user: §4 lock protocol between consoles (`state.json.lock`: host, pid, nonce, heartbeat, 10 s
  staleness, 15 s give-up, short transactions), temporary file `state.json.tmp-<pid>-<n>` with the
  sweep of dead processes' files, `reload` when the list is served, no directory for a no-op. The
  lock is an interface between consoles and builds: a build that skips it brings lost updates back.
- 2026-10-06 — amended in dev-loop task-008 (Wave 2, plan dev-loop-rel-v0.1-plan): §3 a folder
  with `.wingfoil/` that is not a git repository → 422 `git-refused`; a clone without a CLI is
  kept and listed `cli-not-found`; clones serialised on the write-lock key `clone`; responses 201
  with the item (`projects.item.schema.json`) / 204; `detail.path` as typed, leading `~` = home,
  default clone directory `~/projects/<repo>`; a refused or invalid `dna show` → the folder name;
  new refusals `directory-inside-project` and `inside-state-dir` (`{path}`); no CLI of the
  cloned repository runs at clone time (name = folder base name until the first open), with the
  security note; decided by the user.
- 2026-10-10 — amended in dev-loop task-021 (Wave 5, plan dev-loop-rel-v0.1-plan; absorbs
  bug-006, option (c)): §3 new refusal `credentials-in-url` (no `detail`) for http(s)/ftp(s) clone
  URLs carrying any userinfo — a token in the user-name position is a credential too — because
  git would keep it in the clone's `.git/config` and expose it on the command line; `ssh://user@`
  and scp-like URLs stay allowed; the web text suggests SSH or a git credential helper
  (`error.credentialsInUrl`) (W5-14, W5-15); decided by the user.
- 2026-10-11 — amended in dev-loop task-021 (Wave 5, independent review rounds 1–2): §3
  `credentials-in-url` judges the address as git uses it (`<transport>::` prefixes, leading
  whitespace, any number of slashes after the scheme) and also refuses a password in `ssh://` and
  scp-like userinfo, plain logins allowed (W5-18); decided by the user.
- 2026-10-11 — amended in dev-loop task-021 (Wave 5, independent review round 3): §3
  `credentials-in-url` also refuses any userinfo in a `git://` URL — the git protocol has no
  authentication and git's error would echo the password (W5-19); decided by the user.
  Same round: a percent-encoded `:` counts as a password; a control character in a clone URL
  is a malformed source (400 `invalid-request`).
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-11, RP-15; UD-7 of
  `user-docs-rel-v0.1-plan`): §1 aligned with the v0.1 code (`server/src/state/location.ts`) — a
  relative `WINGFOIL_UI_STATE_DIR` resolved against the current directory, `XDG_CONFIG_HOME` used
  only when absolute, the Windows fallback `<home>\AppData\Roaming` without `APPDATA`; §2
  `settings` keys, types and defaults (REQ-STATE-09; `confirmAgentLaunch` effective from WingFoil
  0.3) and `actionLog` entries `{sha, at}`; missing or invalid stored settings read as defaults,
  unknown keys kept. Decided by the approver at checkpoint 2.
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-19, RP-26, RP-28, RP-29):
  §2 settings `fetchIntervalSeconds` (integer 15–3600, default 60) and `actionLogCap` (integer
  100–100 000, default 5 000; lowering it trims the oldest entries at the next append);
  `PUT /api/settings` takes the whole object, an invalid or out-of-range value → 400
  `invalid-request`; §1 `XDG_CONFIG_HOME` rule as in the code confirmed. Decided by the approver.
- 2026-10-12 — independent spec review round 1 (release-planning v0.2 session 2). Decided by the
  approver: a `PUT` that lowers `actionLogCap` trims the log in the same write (RP-38); ranges
  15–3600 s and 100–100 000 confirmed, a stored invalid value reads as its default, unknown
  settings keys dropped — `GET` returns only the known keys, the schema has no additional
  properties (RP-39). Drafting detail: `confirmAgentLaunch` cites the `agent-launch` capability
  (`minVersion` `0.3.0`) instead of W-06.
