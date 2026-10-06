# SARD — 3. State & Context

**Version:** 0.5 · **Date:** 2026-10-06 (0.2: coherence audit fixes — session 6; 0.3: REQ-STATE-08 last non-archived state — initial-design session 6; 0.4: REQ-STATE-06 v0.1 scope — release-planning v0.1 session 4 (audit A4); 0.5: REQ-STATE-02 content fingerprint in the state key — dev-loop task-010) · **Status:** Draft — specification-downcast session 4

Shell and conventions: `00_sard.md`.

---

### REQ-STATE-01 — Working-tree snapshot and *local changes*

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The UI shows the project as the CLI reads it — the working tree. An element whose file differs from HEAD (modified or untracked) carries the marker *local changes* in every view. |
| Rationale | `memory search` reads the working tree (external review R5). |
| Traceability | US-S-25, US-R-10 · S-25.1, S-25.2, S-25.3, R-10.2 · S8, R8 |
| Fit criterion | [boolean] For every element file listed by `git status --porcelain`, the element carries the marker; for every other element it does not. |
| Verified by | unit · e2e |

### REQ-STATE-02 — Cache keyed on HEAD and working-tree status

| Field | |
|-------|--|
| Release | v0.1 |
| Description | Cached CLI and git reads are keyed on the commit of HEAD **and** a hash of `git status --porcelain` combined with a fingerprint of the working-tree content of each changed and untracked entry (computed by the server, no extra git command); a change of either invalidates them, so a second edit of a file that is already modified changes the state too. The effective `user.email` (repository and global git configuration) is watched too and re-evaluates the identity. Changes are detected by file watching, with a periodic check as a fallback. |
| Rationale | Correct with uncommitted edits, cheap otherwise (ADR draft). |
| Traceability | US-S-26 · S-26.1, S-26.3 · S8 |
| Fit criterion | [boolean] A unit test shows a cache miss after a commit and after a working-tree edit, a cache hit when neither changed, and a new identity after a change of `user.email`. |
| Verified by | unit |

### REQ-STATE-03 — Governed actions refused on local changes

| Field | |
|-------|--|
| Release | v0.2 |
| Description | The server refuses a submit, approve, reject or ingestion step on an element whose file has local changes, with the reason; the UI disables the action. A change to another file does not block. |
| Rationale | `memory submit` commits the target's uncommitted edits — a UI action must never commit someone's local work. |
| Traceability | US-G-11, US-X-07 · G-11.1, G-11.2, G-11.3, X-07.3 · G2, G3, S8 |
| Fit criterion | [percentage] 100 % of governed-action requests on an element with local changes get HTTP 409 and start 0 CLI processes, including requests sent directly to the API. |
| Verified by | e2e · API test |

### REQ-STATE-04 — Governed actions refused on a stale or ambiguous copy

| Field | |
|-------|--|
| Release | v0.2 |
| Description | Governed actions and `ui.yaml` writes are refused while the copy is behind its fetched remote, has diverged from it, or has a detached HEAD; being only ahead does not block. *Update* is a fast-forward only. |
| Rationale | Never act on a stale copy; the UI never merges or rebases (`03_is-isnot.md`). |
| Traceability | US-G-12, US-Y-05, US-Y-06, US-Y-01, US-G-15, US-C-02 · G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2, Y-01.3, G-15.4, C-02.4 · Y4, G2, G3, C1 |
| Fit criterion | [percentage] 100 % of governed-action and `ui.yaml` write requests in those states get HTTP 409; after a successful fast-forward the same requests succeed. |
| Verified by | e2e · API test |

### REQ-STATE-05 — Identity from git

| Field | |
|-------|--|
| Release | v0.1 |
| Description | The user is the effective `git config user.email` of the project (repository, else global), matched case-insensitively to `dna.team.members[].email`. Not in the team, no email, or an email matching several members → read-only, with the reason. Re-evaluated on change of the git configuration or the DNA. |
| Rationale | No accounts; same identity as the CLI (ADR draft, S4). |
| Traceability | US-S-12, US-S-13, US-S-14, US-S-15 · S-12.1, S-12.2, S-12.3, S-13.1, S-13.3, S-14.1, S-14.2, S-15.1, S-15.3 · S4 |
| Fit criterion | [boolean] Every listed scenario passes; the identity shown always equals the member whose email matches `git config user.email` of the fixture. |
| Verified by | unit · e2e |

### REQ-STATE-06 — Role views

| Field | |
|-------|--|
| Release | v0.1 (selector, directives filter) · v0.2 (Today) |
| Description | A member with several roles switches role view among the roles they hold; the default is their first role in the DNA; the choice is kept per project. Role views filter content only — capabilities follow all the member's roles as WingFoil evaluates them. |
| Rationale | Same screens, content per role (`ux-reference.md` §5). |
| Traceability | US-S-22, US-S-23, US-T-02 · S-22.1, S-22.2, S-22.3, S-23.2, T-02.3 · S4, S5 |
| Fit criterion | [boolean] The role view selector lists exactly the member's roles; switching changes Today's list as the action descriptor computes it for that role. v0.1 (no Today): switching changes the Directives view filtered on "only mine" (S-22.1) and is kept per project (S-22.3). |
| Verified by | e2e |

### REQ-STATE-07 — Project list integrity

| Field | |
|-------|--|
| Release | v0.1 |
| Description | A repository is in the list at most once (same path, same remote, or a working copy of a listed remote); only folders with `.wingfoil/` are added; a failed add or clone leaves nothing; a missing folder or CLI marks the entry unavailable without blocking the others. |
| Rationale | Q3; one project never shows twice (worktrees: L10). |
| Traceability | US-S-03, US-S-04, US-S-05, US-S-06, US-S-07, US-S-10, US-S-18, US-S-19 · S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2, S-07.3, S-18.1, S-19.1, S-19.2, S-10.2 · S2 |
| Fit criterion | [boolean] Every listed scenario passes; after each refused add the list and the file system are unchanged. |
| Verified by | e2e |

### REQ-STATE-08 — Progress scope and computations

| Field | |
|-------|--|
| Release | v0.3 |
| Description | Completion and iterated figures cover the current element of the `progress.scope` type: with WingFoil 0.3 the one `workflow status` reports; before it, the most advanced element not in its first or last non-archived state (ties: lowest version); none → whole project. Reference completion = done linked elements / linked elements; project completion = unweighted mean over references with ≥ 1 linked element (Q8); coverage = elements carrying all `requires` categories / elements whose type has `requires`, project-wide. Open bugs and pending gates are project-wide; a state both gate and `waiting:` is not a pending gate. |
| Rationale | `ux-reference.md` §7; session 3 decision (scope type only). |
| Traceability | US-T-12, US-T-13, US-T-14, US-R-01, US-M-03 · T-12.1, T-12.2, T-12.4, T-12.5, T-13.1, T-13.2, T-14.1, R-01.1, M-03.1 · T2, R5, M2 |
| Fit criterion | [boolean] On the custom fixture with the `sw-life-cycle` preset the UI shows exactly: scope `minor-v0.1`, project completion 25 %, tasks 1/4, open bugs 1, pending gates 3, coverage 3/5 — and pending gates 2 after `bug-001-toast-overlap` is approved to `triaged`. |
| Verified by | unit · e2e |

### REQ-STATE-09 — UI settings defaults

| Field | |
|-------|--|
| Release | v0.2 |
| Description | Local per-user settings with defaults: auto-fetch on (every 60 s), auto-update off, auto-push off, theme *System*, confirm agent launch on; a change applies without a restart. |
| Rationale | C4, Q4 (session 3 of inception): fetch is safe, pushing is a deliberate act. |
| Traceability | US-C-07, US-Y-07 · C-07.1, C-07.3, Y-07.2 · C4 |
| Fit criterion | [boolean] A first start shows exactly these defaults; changing one takes effect within 120 s without a restart. |
| Verified by | e2e |

## Process Notes

- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): REQ-STATE-02
  state key = hash of `git status --porcelain` plus a server-computed fingerprint of the
  working-tree content of each changed and untracked entry (no extra git command), so a second
  edit of an already-modified file changes the state; decided by the user.
