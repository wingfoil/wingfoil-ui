---
id: task-028-public-text-check-for-paths-outside-the-repository
type: task
title: "Public text check for paths outside the repository"
status: in-review
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

### red / green / refactor (2026-10-12)

- **Red:** `test/docs/public-text.test.ts` committed first (`5f98297`): the module did not exist,
  so the file failed to load.
- **Green:** `test/docs/public-text.ts` (scanner), `test/docs/public-text.allow-list.ts` (20
  entries, each with its reason and a comment per group), `test/README.md` 0.25 (listing).
  31 tests in the file: 12 detection cases, 11 guard cases and line numbering of `findPaths`, three allow-list
  self-checks, the negative test (two tests) and the tracked tree (two tests).
- **Deviations from the design:**
  - The negative test does not use `os.homedir()`. The scratch file in the temporary
    repository holds one path per rule, built at run time from segments, so the result
    depends on no home or temporary folder of the machine (task-026 moves the temporary
    root). It also covers a tracked symbolic link (git stores its target as text: reported),
    a tracked file deleted from the working tree, a binary file and an untracked file (none
    read).
  - A POSIX or `~/` path ends at its first backslash, because in source text a backslash
    starts an escape (`'#!/bin/sh\necho'`). A bare `~/` (the notation, or a regex such as
    `~/\.config`) is not reported.
  - The allow-list has two kinds of entry. `entry()` allows a path and everything below it.
    `exact()` allows only the path itself: `/dev/null`, `/etc/hosts`, `/proc/loadavg`, the
    program locations, and a top-level directory named alone. This keeps the "no whole
    root" self-check true for `/etc`, `/proc`, `/bin` and `/tmp`.
  - A stale entry's failure message gives the entry's pattern and reason and says to delete
    it from the allow-list.
- **Run time:** `scanRepository` on the full tree (737 tracked files at the time of measurement, 0 binary, about 6 MB) took
  0.53 to 0.71 s over five runs at load 10.3. A first version without the per-line substring
  pre-filter took 0.95 to 1.42 s at load 10.9. The scan runs one `git ls-files -z`, then one
  `lstat` and one read per file.
- **Gates** (worktree, 2026-10-12):
  - `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run docs:api`: all
    green.
  - `python3 docs/03_backlog/X_tools/check_tasks.py v0.2`: "17 tasks · 46 backlog items · 46
    listed", OK.
  - `npm run test:coverage`: 119 files passed, 1 skipped; 1980 tests passed, 1 skipped;
    360 s at load 30.1 to 31.6. Coverage: statements 96.67 %, branches 90.97 %, functions
    97.22 %, lines 98.33 %. The new files are under `test/` and outside the coverage
    include.
  - `test:e2e` was not run because no UI changed. `test:timing` was skipped because the load
    was above 12.

### review (round 1, 2026-10-13)

Verdict FAIL: 1 major, 1 minor, 6 nits. Each finding and the change made:

- **F1 (major):** the look-behind of a path start skipped `*`, `>`, `-`, `$`, `@`, `)`, `]` and
  `_`. As a result, a path in Markdown emphasis, in an HTML cell, after a redirection, glued to
  an option, or after `$` was not seen.
  - The guard now skips only a letter, a digit, `.`, `~`, `/` or `\` (word, relative path, URL,
    escaped regex). It also skips `_` after a letter or a digit, and a `${…}` placeholder.
  - A path right after a one-letter option (`-C`, `-v`) is found.
  - The `<prefix>` placeholders this exposed are now allow-listed: `/bin/wingfoil` (exact) and
    `/lib/node_modules/wingfoil`. `<root>/home` was already allowed as a bare root, and in
    `<port>/private.git` the `.` already ends the root name.
  - Every reviewer input is a row of the "finds" table, built at run time from segments.
- **F2 (minor):** a path now ends before a `:` that starts another path (`:/`, `:~`, `:$`, `:%`).
  `-v /home/alex/x:/…` gives two paths, and the second is checked on its own. `/srv/a:b@c:x`
  stays one path. Table rows added.
- **N1:** a path below `$HOME`, `${HOME}` or `%USERPROFILE%` is a home path, like one below `~`.
  A bare notation is not reported. 0 hits on the tree.
- **N2:** the macOS roots (`Users`, `Volumes`, `Library`, `Applications`, `System`, `private`)
  match in any case. A drive path right after `file:///` is found. The Alex entries accept `/`
  as well as `\` on Windows, and `/Users/alex` was already case-insensitive (it covers
  `test/server/state/location.test.ts:110`).
- **N3:** a match inside a longer one on the same line is reported once, as the longer one: a
  drive path, or a drive-like YAML key before a POSIX path.
- **N4:** `allowedBy` refuses a path with a `..` segment (`..state` is not one). New test.
- **N5:** `afterAll` runs `await workspace?.dispose()`.
- **N6:** the run-time note above names the file count "at the time of measurement".

Run time after the fixes: about 1–2 s depending on load. Measured: 1.0–1.4 s over five runs on
the 739 tracked files at the time of measurement, at load 24. Each rule now tests its first
character before its look-behinds; before that change, the same runs took 1.5–3.0 s at load 27.

Gates (2026-10-13, load about 27):

- `npx vitest run test/docs/public-text.test.ts`: 53 passed.
- `npm run typecheck` and `npm run lint`: 0. `npm run format:check`: clean.
- `check_tasks.py v0.2`: "17 tasks · 46 backlog items · 46 listed", OK.
- `test:coverage` was not re-run. Only `test/docs/public-text*.ts` changed, which is outside
  the coverage include and imported by no other test, so the round-0 run (119 files, 1980
  tests) still covers the rest.

### review (round 2, 2026-10-13)

Verdict FAIL: 1 minor regression and nits. F1, F2 and N1–N6 were verified fixed. Each finding
and the change made:

- **R1 (minor, regression from N3):** an allowed outer match hid a distinct path inside it
  (`~/projects/kanban=` + a home path, `C:/A/-` + a home path, `/home/alex/x@` + a home path,
  and more).
  - Only a POSIX match that is the rest of a drive match (it starts right after the drive
    letter and colon) is now dropped, which is exactly the N3 case. Every other match inside a
    longer one is reported and checked against the allow-list on its own. An allowed outer
    match therefore hides nothing.
  - A match the start guard still skips inside a longer one continues a segment of that path
    (`/home/alex/xhome`); it is not a separate path.
  - The path end now also stops before `=` or `@` followed by `/`, `~`, `$` or `%`
    (`(?![:=@][/~$%])`). `/srv/a:b@c:x` stays one path.
  - Every reviewer input is a row of the "finds" table, built at run time.
- **N-a:** the drive rule no longer fires after `-` or `@` (`/tmp/wfui-a:` + path,
  `/srv/a:b@c:` + path). The POSIX path after the colon is reported instead.
- **N-b:** home paths now also cover:
  - `"${HOME}"` and `"$HOME"`, quoted;
  - `%USERPROFILE%` in any case;
  - PowerShell's `$env:USERPROFILE`.

  `$home` is detected too. PowerShell variable names ignore case, and in a POSIX shell a
  lower-case `$home` followed by a path is still worth a look. This is documented in the
  scanner. There are 0 hits on the tree.
- **N-c:** a path glued to a one-letter option is also found after `(` and `=`
  (`(-C` + path, `opt=-C` + path).
- **N-d:** accepted by the reviewer, no change.
- **N-e:** the run-time note above now reads "about 1–2 s depending on load (measured …)".
  After round 2: 0.57–1.16 s over five runs on the 739 tracked files at the time of
  measurement, at load 11.7.

Gates (2026-10-13, load about 12):

- `npx vitest run test/docs/public-text.test.ts`: 67 passed.
- `npm run typecheck` and `npm run lint`: 0. `npm run format:check`: clean.
- `check_tasks.py v0.2`: "17 tasks · 46 backlog items · 46 listed", OK.
- `test:coverage` was not re-run. Only `test/docs/public-text*.ts` changed, which is outside
  the coverage include and imported by no other test.

### review (round 3, 2026-10-13)

- Independent fresh-context review: round 1 **FAIL** (1 major, 1 minor, 6 nits), round 2
  **FAIL** (1 minor regression from the N3 dedup, 4 nits), round 3 **PASS** on `75b919e` (no
  finding): every round-1/round-2 input re-checked, no regression; the tracked tree scans with 0
  findings (739 files).
- `main` merged into the task branch before submit (`d25bce0`); after the merge the test file
  passes 67/67 and `check_tasks.py v0.2` is OK.
