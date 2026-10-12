---
id: task-028-public-text-check-for-paths-outside-the-repository
type: task
title: "Public text check for paths outside the repository"
status: in-progress
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2","governance","public-text"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

dl-006 action 4 (theme T9) and dl-005 *Actions* ("consider a check for local paths and session
names in committed text"), planned at `release-planning` (RP-3 (b), RP-42): a test that fails when
a tracked text file contains an absolute filesystem path outside the repository. Session names
stay an item of the review checklist: no pattern list naming private material is committed
(dl-005). Governance task (`module: governance`, `ref: GOV`).

**Backlog items:** GOV (governance — dl-006 action 4, dl-005)

## Acceptance Criteria

- **AC-1** A test in the default suite (e.g. `test/docs/public-text.test.ts`) reads every tracked
  text file (`git ls-files`, binary files excluded; untracked local files are never listed) and
  fails, naming file and line,
  on an absolute filesystem path outside the repository (POSIX home and root paths, Windows drive
  paths, `~/`-prefixed paths), except an explicit, commented allow-list of fictitious or generic
  example paths (e.g. the spec-006 `/home/alex/projects/kanban` example, `/tmp`, `/dev/null`).
- **AC-2** Negative test: a scratch file holding a real-looking outside path makes the check fail;
  the repository's tracked tree passes on the task's branch.
- **AC-3** The check names no private path, folder or session (dl-005); `test/README.md` lists it.
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` green.

## Implementation Notes

- dl-005 *Decision* (cite only public sources; name no internal session); dl-006 action 4.
- The allow-list lives next to the test, each entry with the reason it is not a real path.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-12)

Read: this task, dl-005, dl-006 (action 4, T9), `release-planning-rel-v0.2-plan` RP-3 (b) and
RP-42, `test/README.md`, `vitest.config.ts`, `test/docs/api-docs.test.ts`,
`test/wingfoil-feedback.test.ts`, `test/harness/temp-workspace.ts`. No `depends_on`; no spec, ADR
or UX element covers this check (governance task, no product code); no tech-spec is missing.

**AC classification**

| AC | Kind | Verified by |
|----|------|-------------|
| AC-1 | automated, default suite | `test/docs/public-text.test.ts` — the tracked tree passes; rule table (detected / not detected) |
| AC-2 | automated, negative | same file — a scratch file in a temporary git repository fails the scan, naming file and line |
| AC-3 | review + automated | the scanner and allow-list name only standard system roots and fictitious examples; `test/README.md` row |
| AC-4 | gates | `typecheck`, `lint`, `format:check`, `test:coverage` |

**File layout** (all under `test/docs/`, next to the `docs.api.*` gate)

- `public-text.ts` — the scanner: `scanText(file, text): Finding[]` (pure, one finding per path:
  file, line, the matched path, its rule) and `scanRepository(root): Promise<Finding[]>`
  (`git ls-files -z` in `root`, binary files skipped, each text file scanned).
- `public-text.allow-list.ts` — `ALLOWED: readonly { pattern: RegExp; reason: string }[]`, each
  entry with a `reason` field and a comment.
- `public-text.test.ts` — the repository check, the rule table, the negative test, the
  allow-list self-checks.
- Not in coverage (`coverage.include` is `server/`, `contracts/`, `web/` only).

**Detection rules** (applied per line; a match is a path up to the first whitespace, quote,
backtick, `)`, `,`, `;` or `]`; a trailing `\` from a JSON/TS escape and a trailing `.` are dropped)

- *POSIX root paths:* `/<top>` followed by `/` or the end of the path, where `<top>` is a
  standard top-level directory of Linux (FHS) or macOS: `home`, `Users`, `root`, `tmp`, `var`,
  `etc`, `opt`, `usr`, `mnt`, `media`, `srv`, `private`, `Volumes`, `run`, `proc`, `dev`,
  `snap`, `bin`, `sbin`, `lib`, `lib64`, `boot`, `sys`, `nix`, `Applications`, `Library`,
  `System`. Only those: any other leading-slash string (`/api/p/:pid`, `/docs/…`, `/assets/…`)
  is a route or a repo-relative path and is not checked.
- *Windows drive paths:* a drive letter, `:`, then `\`, `\\` (escaped in source) or `/`.
- *Home paths:* `~/…`.
- *Not a path* (guards against false positives): the match must not follow a word character,
  `.`, `~`, `-`, `/`, `\`, `>`, `}`, `)`, `]`, `$`, `*` or `@` — so a URL path
  (`https://host/srv/x`), a repo-relative path (`docs/tmp/x`, `../../etc`), a placeholder suffix
  (`<prefix>/bin/wingfoil`, `${dir}/tmp`) and an escaped regex (`\/home\/`) are skipped, while a
  `file://` URL is still checked; a drive letter followed by a single-letter escape (`a:\n` in a
  YAML string) is not a drive path.

**Binary files:** a file whose first 8 000 bytes hold a NUL byte is binary (git's own heuristic)
and skipped. The tracked tree holds no binary file today; the rule keeps a future image out.
Untracked and ignored files are never read: the list comes from `git ls-files` only.

**Allow-list:** global entries, each a regex anchored at the start of the matched path and ending
on a segment boundary, with its reason — fictitious identities (`/home/alex`, `/home/test`,
`/Users/alex`, `C:\Users\alex`, …), the product's default clone folders (`~/projects/`, BDD
`~/work/`), the documented state locations (`~/.config/wingfoil-ui`,
`~/Library/Application Support/wingfoil-ui`), generic system files (`/dev/null`, `/dev/zero`,
`/etc/hosts`, `/etc/passwd`, `/proc/…`, `/usr/bin/env`, `/bin/sh`, …), fictitious remotes
(`/srv/…`, `C:\remotes`), and named fictitious temporary folders (`/tmp/wfui-*`, `/tmp/pwned`,
`/tmp/does-not-exist`, …). Self-checks: every entry has a non-empty reason and matches at least
one path of the tracked tree (a stale entry fails), and no entry allows a whole root
(`/home/`, `/tmp/`, `~/`).

**Negative test (AC-2):** in a `TempWorkspace` (`wfui-` prefix), `git init` with the harness git
environment, a tracked scratch file holding a path built at run time from `os.homedir()` (plus a
second one built from segments), and an untracked file with the same text → `scanRepository`
reports the tracked file with its line and does not list the untracked one. Nothing is written
to the checkout; the literal never appears in committed text. The rule table adds `scanText`
cases for each rule and each false-positive guard.

**Dry scan of the tracked tree** (`main` f3f214d, throwaway script, 736 files, 0 binary): 390
POSIX, 19 Windows and 233 `~/` matches. Every one is a fictitious example, a generic system path,
a placeholder or a product default (the `~/projects/<repo>` clone folder); no real private path
of a person or a session was found. One match is the name of a past run's temporary folder
(`/tmp/wfui-rev-…` in task-010's notes): real but neither private nor identifying, covered by the
`/tmp/wfui-` entry. The draft rules produced one false positive (`/data:` in task-020, from a
`data:` URL), so `data` is not a checked top-level directory.

**Test plan:** rule table (`it.each`) for detection and guards; allow-list self-checks; negative
test in a temporary repository; the repository check last, its failure message listing every
`file:line: path`. `test/README.md` lists the suite (version line bumped).

**Decisions (approver, 2026-10-12):** all as recommended — D28-1 (b), D28-2 (a), D28-3 (b),
D28-4 (a), D28-5 (a), D28-6 (a), D28-7 (a). With them: a stale allow-list entry's failure names
the entry to delete (another task may remove an example's last occurrence); the test depends on
no particular system temporary path (task-026 points `TMPDIR`/`TMP`/`TEMP` at a run-owned
`wfui-*` root); the scanner's run time on the full tree is recorded below.

**Open decisions as asked** (recommendation ★):

- D28-1 — which absolute POSIX paths are checked: (a) home roots only; ★ (b) the standard
  top-level directories listed above; (c) any absolute path with two or more segments.
- D28-2 — allow-list granularity: ★ (a) global anchored patterns, each used at least once;
  (b) one entry per file and path; (c) per-folder exclusions.
- D28-3 — breadth of `/tmp` and `~/`: (a) both allowed wholesale; ★ (b) `~/projects/` and
  `~/work/` wholesale, `/tmp` only for named fictitious folders and `/tmp/wfui-*`; (c) every
  literal enumerated.
- D28-4 — the past run's temporary folder name in task-010's notes: ★ (a) leave it, covered by
  `/tmp/wfui-*`; (b) rewrite it in the done v0.1 task; (c) a file-specific entry.
- D28-5 — UNC paths (`\\server\share`): ★ (a) out of scope (AC-1 names drive paths); (b) checked.
- D28-6 — negative test: ★ (a) a temporary git repository (tracked and untracked scratch file)
  plus the `scanText` rule table; (b) `scanText` on a temporary file only.
- D28-7 — temporary folder: ★ (a) `TempWorkspace` with the `wfui-` prefix now, aligned with
  task-026's convention by whichever task merges second; (b) wait for task-026.
