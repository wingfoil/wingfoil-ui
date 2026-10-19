---
id: task-043-e2e-smoke-gaps-of-v0.2-commit-provenance-and-gate-keyboard-paths
type: task
title: "E2E smoke gaps of v0.2: commit provenance and gate keyboard paths"
status: in-progress
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","e2e-smoke"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-018-cancel-in-the-gate-footer-opened-from-today-moves-the-focus-to-the-main-region-instead-of-the-today-action-that-opened-the-panel"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-034-auto-sync-scheduler-and-auto-push", "task-036-today-requires-you-and-waiting-on-others", "task-037-gate-footer-with-every-outcome", "task-038-submit-footer-action-toasts-and-blocked-actions", "task-040-update-and-push-from-the-sidebar"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2, phase `e2e-smoke` (plan `e2e-smoke-rel-v0.2-plan`, decisions
ES2-2 and ES2-4): close the gaps the mapping of `.wingfoil/workflows/custom/e2e-smoke.yaml` onto
the v0.2 suites found. The task adds tests; a product defect a new test reveals is reported to the
coordinator (bug-ingest). One such defect, bug-018 (found at design, D43-5), is absorbed here (AC-7).

- **G2 — drive-browser, commit provenance.** "Every commit the UI causes is a CLI `wf(…)` commit or
  a `chore(ui)` commit touching only `.wingfoil/ui.yaml`" is proved on the server
  (`test/server/http/element-writes.test.ts`, `test/server/cli/governed-verbs.test.ts`) and, in e2e,
  only by the subject of `HEAD` after each write; no e2e test checks a whole session of UI writes.
  v0.2 makes no `chore(ui)` commit (the console writes no `ui.yaml` before v0.3).
- **G3 — success criterion 1** of the release ("a member holding `approver` passes a gate from
  Today in ≤ 2 clicks, with the `wf(…)` commit shown and pushed") is proved by separate tests: G-04.1
  counts the clicks with auto-push off; G-13.1 shows the commit and *pushed* from the panel.
- **G4 — accessibility, keyboard path of every gate action.** X-06.2 walks Today → Approve by
  keyboard; Reject and Cancel of the gate footer are reached by click only.
- **G5 — actions blocked while the copy is behind.** G-12.x prove it for Approve and Reject in the
  UI; Submit while behind is proved on the server only.

Governance task (`module: governance`, `ref: GOV`), as task-025 in v0.1; run through the full
dev-loop (worktree, red-first, independent review until PASS, the approver's gates).

**Backlog items:** GOV (governance — e2e-smoke gaps of minor-v0.2, ES2-2)

## Acceptance Criteria

- **AC-1 (G2, commit provenance)** A new e2e spec (e.g. `test/e2e/commit-provenance.spec.ts`)
  records the observed repository's state before a session, then drives from the UI a submit, an
  approve and a reject (with a reason), a manual Update after a commit pushed to the remote by the
  test, and a Push; it also changes a UI setting and the role view. Afterwards every commit in
  `<before>..HEAD` that the remote did not bring matches `^wf\((task|bug|[a-z-]+)\): (submit|approve|reject) `
  (the CLI's subject form, checked against `governed-verbs.test.ts`), touches only its element's file
  (`git diff-tree --no-commit-id --name-only -r`), and no other ref, tag, config entry or
  working-tree file changed (`no-commit.spec.ts` helpers); the remote's branch equals `HEAD` after
  the Push. The assertion fails when one extra commit of any other form is added (shown once, by
  hand, in the Execution Notes).
- **AC-2 (G3)** An e2e test (a G-04.1 variant, titled with G-04.1 and the success criterion) seeds
  `autoPush: true`, starts on Today as a member holding `approver`, passes the gate in exactly two
  clicks and asserts what the user sees: the toast's commit line (short sha and `wf(…)` subject
  equal to the repository's `HEAD`) and *pushed*; and the remote's branch head equals that commit.
- **AC-3 (G4)** An e2e test (an X-06.2 variant) reaches **Reject** of the gate footer by keyboard
  only: from Today's action to the element panel, the reason field, the reject outcome, Enter; it
  asserts the `wf(…): reject … [<from> → <to>]` commit and the reason recorded; a second walk
  reaches **Cancel** by keyboard and asserts nothing was written (`HEAD` unchanged) and the focus
  returns as the gate footer specifies (spec-003 §6, UX reference).
- **AC-4 (G5)** An e2e test (G-12.x style, on an element whose Submit is offered) makes the copy
  behind its upstream and asserts in the UI that Submit is disabled with the copy-behind reason
  (catalogue text, accessible description) and that no request is sent; `HEAD` unchanged.
- **AC-5** Each new test passes on Chromium, Firefox and WebKit (`npm run test:e2e -- <files>`);
  axe 0 serious/critical where a new screen state is shown, both themes; new tests are written
  red-first where they can fail on current code, otherwise their guard-removal failure is recorded.
- **AC-7 (bug-018, focus after Cancel)** When the element panel was opened from a Today action and
  is closed with the gate footer's *Cancel*, with Escape or with the panel's close control, the
  focus returns to that Today action; to `#main` only when the action no longer exists (e.g. the
  element left *Requires you*). A failing e2e test is committed before the fix (the AC-3 Cancel
  walk asserts it); the fix mirrors the Memory list's opener handling (X-06.3); a CHANGELOG
  *Fixed* line names bug-018; `docs/00_reference/ux-reference.md` §4.2 states the focus target if
  it does not yet. bug-018 follows this task's state (bug.sync_state).
- **AC-6** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e:chromium`,
  `docs:api` green; `check_tasks.py v0.2` OK; `test/README.md` version line and the e2e closure
  table of this task updated; every heavy gate through the machine-free slot.

## Implementation Notes

- Reuse `test/e2e/support/`: `console.ts` (`ConsoleOptions.settings` for `autoPush`, `stateDir`),
  `events.ts` (`mutateAndWait`, `commitFile`, `cli`, `lastCommitSubject`), `remote.ts`
  (`remoteHead`, `remoteCommit`, `setRemoteUrl`), `identity.ts` (`actAs`), `repo-state.ts` /
  `no-commit.spec.ts`, `cold-read.ts` (`COLD_READ_MS`), `axe.ts` (`scanThemes`), `keyboard.ts`.
- G-04.1 lives in `test/e2e/gate-footer.spec.ts`, X-06.2 there too (line ~384); G-12.x in
  `test/e2e/update-push.spec.ts`; G-13.1 in `test/e2e/submit-footer.spec.ts`.
- Toasts close after 8 s: assert the toast right after the action, before any server-read wait
  (Wave 5 lesson).
- No product change is expected except AC-7 (bug-018, `web/src/today/`); any other spec gap or
  defect → stop and report with options.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-18)

Read: this task; `CLAUDE.md`; the developer rules of the dev-loop (hard rules, dev-loop phases, the
e2e convention, the lessons of Waves 0–6, the machine-free slot for heavy gates);
`e2e-smoke-rel-v0.2-plan` (mapping, ES2-1 … ES2-4); `test/README.md`; spec-003 §6, ux-reference
§4.2 and §5, `gate-footer.feature` (G-04.x), `blocked-actions.feature` (G-12.x),
`action-feedback.feature` G-13.1, `accessibility.feature` X-06.2, X-06.3; tests
`test/server/cli/governed-verbs.test.ts`, `test/server/http/element-writes.test.ts`,
`test/e2e/{gate-footer,submit-footer,update-push,ui-settings,no-commit,today}.spec.ts`,
`test/e2e/support/{console,events,remote,identity,keyboard,cold-read,axe}.ts`,
`test/harness/repo-state.ts`; code `web/src/routes/element.tsx` (`close`, `focusMainWhenLost`),
`web/src/today/TodayView.tsx`, `web/src/memory/MemoryList.tsx` (the row focused again, W3-23).

**depends_on (dl-015 hard gate) — task-034, task-036, task-037, task-038, task-040: Execution Notes
read (design, decisions, red/green/refactor, every review round, before submit).**

- task-034: a real-bin console fetches every 60 s (`autoFetch` on) — every console here seeds
  `autoFetch: false` (as `update-push.spec.ts`); the manual Update is the hardened `pull --ff-only`
  (bug-014: never a merge commit); the auto-push pushes HEAD to the upstream's merge ref; a failed
  push is still a 200 of the write.
- task-036: Today's action is a `Button` named "Approve <id>" (`today.actionLabel`) in
  `li[data-eid]` of the *Requires you* region; per-project components keyed by pid; first reads with
  `COLD_READ_MS`.
- task-037: the footer order is reason · *Approve → x* · each *Reject → y* · *Cancel* (D37-2);
  outcomes are native buttons with `aria-disabled` (D37-3); the default reason is selected on focus,
  an untouched default is cleared when a reject takes the focus (G-06.3) and a typed reason is kept
  (G-06.4); Cancel = the panel's `onClose` (history back); `lastCommitSubject`.
- task-038: the result is a polite toast ("Approved <id>", `.toast-commits li` = 7-char sha +
  subject, `.toast-pushed` "pushed"), removed after 8 s — asserted (and hovered) right after the
  action, before any server-read wait (review R2); `ConsoleOptions.settings` (`autoPush: true`);
  `remoteHead`; a press on an `aria-disabled` button needs `force` (G-11.2).
- task-040: *Update* / *Push* / *Fetch* in the *Git status* region; *Update* only while behind, *Push*
  with "N commits to push" while only ahead (D40-1); the copy-behind reason reads "Blocked: your copy
  is 1 commit behind the remote — Update" with an *Update* link (D40-2); a `page.goto` while a push
  runs ends its request (S2) — no navigation while a push runs; `remoteCommit`, `fetchCopy`.

#### What the CLI commits (the subject forms, AC-1)

`governed-verbs.test.ts` (the pinned `wingfoil@0.2.2`) and `element-writes.test.ts` fix the two
subjects of the governed verbs: `wf(<type>): submit <id>` and `wf(<type>): <approve|reject> <id>
[<from> → <to>]`; each commit carries exactly the element's file (`git commit --only`). The test's
remote commit is made by `remoteCommit` (`outside: <file>`, another clone). The UI setting and the
role view write only `state.json` in the console's state directory (task-030, task-025 AC-5).

#### AC classification

| AC | kind | first test / proof |
|----|------|--------------------|
| AC-1 commit provenance of a whole session | **characterization** (the server proves it per write; nothing in the product should change) | the checker red first in its own self-test (D43-7); the e2e's guard removal: one extra commit of another form made by the test before the final snapshot → the assertion fails (recorded by hand, AC-1) |
| AC-2 G-04.1 with auto-push | **characterization** (G-04.1 + G-13.1 combined) | guard removal: the console started without `autoPush` → no "pushed", remote head unchanged (recorded) |
| AC-3 Reject by keyboard | **characterization** | guard removal: `tabIndex={-1}` on the reject outcomes (not committed) → `tabUntil` never reaches it (recorded) |
| AC-3 Cancel by keyboard, focus | **red-first** if D43-5 (a) (the probe below: the focus lands on `#main`, not on the opener); **characterization** if (b) | — |
| AC-4 Submit while behind | **characterization** (descriptor `copy-behind` + task-038/040 footer) | guard removal: the Submit footer rendered enabled whatever the descriptor says (not committed) → `aria-disabled` missing and a `POST …/submit` sent (recorded) |
| AC-5 three engines, axe | check | `npm run test:e2e -- <own files>` |

#### Probe of the current behaviour (Chromium, scratch spec, removed; through the slot)

On `7de04dd`, `npx playwright test --project=chromium` of a scratch spec (4 passed, 44 s, load at the
end 2.9; no console left):

- Today (Morgan, kanban): the action of `task-001-login-form` is a button named
  "Approve task-001-login-form".
- Gate footer opened from Today by keyboard (Tab, Enter; the reason focused), then *Cancel* by
  keyboard, *Cancel* by click, or Escape: the panel closes, the URL is `/p/<pid>/today`, and the
  focus is on `main#main` in all three (read five times over 1.5 s) — **not** on the Today action
  that opened the panel (input to D43-5).
- Submit while behind (Jordan, `task-004-session-timeout`, `remoteCommit` + `fetchCopy` before the
  start): *Submit → pending* is `aria-disabled="true"`, described by "Blocked: your copy is 1
  commit behind the remote — Update", the footer shows that line, *Submit → pending*, *Cancel* — AC-4
  is a characterization on the current code.

#### Plan per AC (pending the decisions below)

- **AC-1** — new `test/e2e/commit-provenance.spec.ts` (`prebuild: ['kanban']`), one test
  "drive-browser — every commit of a UI session is the CLI's `wf(…)` commit of its element (G2)"
  on a kanban copy as Morgan, console with `{ autoFetch: false }` (auto-push off: the Push is
  manual). Before the console starts: `snapshotRepo` of the copy and the remote's refs
  (`for-each-ref` on the bare remote). Session, in this order (D43-3): the test commits to the
  remote (`remoteCommit`, its sha `R`); *Fetch* in the sidebar → "1 behind"; *Update* → "In sync
  with git"; *Submit → pending* on `task-004-session-timeout`; *Approve → approved* on
  `task-001-login-form` (reason typed); *Reject → draft* on `bug-001-crash-on-save` with a reason;
  theme *Light* on *Configuration › UI settings*; role view *tech-lead* in the header; *Push* →
  "In sync with git". Each step waits for its toast or its sidebar line (what the user sees), as the
  sibling specs. Then `c.stop()`, the after-snapshots, and the checker (D43-7):
  every commit of `git rev-list --reverse <before>..HEAD ^R` matches the full subject forms
  (D43-1), touches only its element's file (`diff-tree --no-commit-id --name-only -r` equal to the
  one tracked `<id>.md`), the list equals the three expected subjects in order, no merge commit in
  `<before>..HEAD`; `<before>..R` is exactly the test's commit and `R` is an ancestor of HEAD
  (D43-2); refs other than `refs/heads/main` and `refs/remotes/origin/main` unchanged (tags, other
  branches, `origin/HEAD`), both of those at HEAD; HEAD still on `main`; stash, `.git/config` hash
  and `git status --porcelain --untracked-files=all --ignored` unchanged (`.git/index` is rewritten
  by every commit: compared through the status, D43-8); the remote's refs: only `refs/heads/main`
  moved, to HEAD. The reject's reason is in its commit body. axe: no new screen state (none).
- **AC-2** — appended to `test/e2e/gate-footer.spec.ts` › US-G-04 (D43-9): "G-04.1 — Approve a gate
  in two clicks from Today, with the commit shown and pushed (success criterion 1)": kanban copy
  as Morgan, `settings: { autoPush: true, autoFetch: false }`, `openToday`, the click counter of
  G-04.1, *Approve task-001-login-form*, *Approve → approved*; right after the click the polite
  toast "Approved task-001-login-form" (hovered), its `.toast-commits li` equal to
  `<HEAD 7 chars> <subject of HEAD>` read with git and equal to
  `wf(task): approve task-001-login-form [pending → approved]`, `.toast-pushed` "pushed"; clicks
  = 2; `remoteHead` = HEAD. axe in both themes on the toast state (the success toast with "pushed"
  over the panel opened from Today is a state of its own).
- **AC-3** — appended to `gate-footer.spec.ts` › US-X-06: "X-06.2 — Reject a gate with the keyboard
  only (G4)": Today → `tabUntil` the action, Enter → the reason focused with the default selected →
  type the reason (replaces the selection) → `tabUntil` *Reject → draft* (passes *Approve*, the typed
  reason kept by G-06.4) → `expectFocusVisible` → Enter → the reject toast, the commit
  `wf(task): reject task-001-login-form [pending → draft]` with the reason in its body, and what the
  user sees: the rejection banner "Rejected by Morgan: <reason>" in the panel. "X-06.2 — Cancel the
  gate footer with the keyboard only (G4)": the same start, `tabUntil` *Cancel*, Enter → the panel
  gone, URL `/p/<pid>/today`, no governed `POST` (`recordWrites`), HEAD unchanged, the focus where
  D43-5 says, with a visible ring if it is a control.
- **AC-4** — appended to `test/e2e/update-push.spec.ts` › US-G-12 (D43-9): "G-12.1 — Block a submit
  while behind (G5)": a kanban copy as Jordan (D43-6), one commit behind its fetched remote
  (`remoteCommit` + `fetchCopy` before the console starts, as G-12.x), panel of
  `task-004-session-timeout`: *Submit → pending* `aria-disabled`, accessible description and the
  `.submit-footer` text "Blocked: your copy is 1 commit behind the remote — Update" (the catalogue
  text, the BEHIND constant of G-12.x), its *Update* link shown; `scanThemes` (new state: the
  submit footer blocked while behind); a forced click and Enter → no `POST` of any kind recorded;
  HEAD unchanged.
- **Shared support** (D43-7): `test/harness/commit-provenance.ts` — `sessionCommits(dir, env, {
  before, remoteBrought })` (sha, subject, body, files, parents) and `provenanceProblems(...)`
  returning readable lines (empty: clean), over `RepoState` of `repo-state.ts` plus the remote's
  refs (`remoteRefs(remoteDir, env)`); self-test `test/harness/commit-provenance.test.ts` (Vitest, a
  scratch repository with a bare remote: a clean session passes; an extra `chore:` commit, a
  `wf(task): submit` commit touching a second file, a subject with a wrong form, a merge commit, a
  new tag, a moved second branch, a `.git/config` change, an untracked file, a remote branch added
  each fail with their line). No other new support; the spec-local helpers of `gate-footer.spec.ts`
  and `update-push.spec.ts` are reused in place.
- **Docs**: `test/README.md` 0.42 (version line and the layout lines: `commit-provenance.spec.ts`,
  `harness/commit-provenance.ts`, the appended tests); the e2e closure table in these notes; no
  product doc (no behaviour change) unless D43-5 (a) absorbs a fix.

e2e closure (planned):

| Gap / scenario | spec file › test |
|----------------|------------------|
| G2 (drive-browser, commit provenance) | `test/e2e/commit-provenance.spec.ts` › "drive-browser — every commit of a UI session is the CLI's `wf(…)` commit of its element (G2)" |
| G3, G-04.1 + success criterion 1 | `test/e2e/gate-footer.spec.ts` › "G-04.1 — Approve a gate in two clicks from Today, with the commit shown and pushed (success criterion 1)" |
| G4, X-06.2 Reject | `gate-footer.spec.ts` › "X-06.2 — Reject a gate with the keyboard only (G4)" |
| G4, X-06.2 Cancel | `gate-footer.spec.ts` › "X-06.2 — Cancel the gate footer with the keyboard only (G4)" |
| G5, G-12.1 Submit | `test/e2e/update-push.spec.ts` › "G-12.1 — Block a submit while behind (G5)" |

Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `check_tasks.py v0.2`,
`test:e2e:chromium` (whole suite) and `npm run test:e2e -- commit-provenance.spec.ts
gate-footer.spec.ts update-push.spec.ts` (three engines); `test:smoke` not needed (no packaging,
launcher or bin change); every heavy gate through the machine-free slot.

#### Open decisions (STOP: nothing depending on them is built before the answer)

- **D43-1 — the subject check of AC-1.** (a) the AC's prefix regex
  `^wf\((task|bug|[a-z-]+)\): (submit|approve|reject) ` alone; (b) the CLI's two full forms —
  `^wf\(([a-z][a-z0-9-]*)\): submit (\S+)$` and
  `^wf\(([a-z][a-z0-9-]*)\): (approve|reject) (\S+) \[(\S+) → (\S+)\]$` — with the captured id equal
  to the one file the commit touches (`<id>.md`), and the ordered list of subjects equal to the
  session's three expected ones (an extra commit of the same form fails too); (c) the ordered list
  equality alone (no form check: a different session would need new literals only). **Recommended: (b).**
- **D43-2 — how the remote's commits are excluded.** (a) by ancestry: `R` = the remote's head
  right after the test's own push; the checked set is `rev-list <before>..HEAD ^R`, and separately
  `<before>..R` is exactly the test's one commit (its subject `outside: …`) and `R` is an ancestor of
  HEAD (the Update fast-forwarded; no merge commit anywhere); (b) by the test commit's subject or
  author (a forged commit with that subject would pass); (c) by what `refs/remotes/origin/main`
  reaches at the end (after the Push it reaches HEAD: everything excluded — unusable). **Recommended: (a).**
- **D43-3 — fixture, elements and order of the session.** (a) kanban as Morgan (approver; any
  member may submit, D38-7): remote commit → *Fetch* → *Update* → submit `task-004-session-timeout`
  → approve `task-001-login-form` → reject `bug-001-crash-on-save` (a `wf(bug)` subject, three
  files) → theme → role view → *Push*; the Update runs before the writes because a copy ahead and
  behind is diverged and the Update would be refused (Y-06.1); (b) the same writes, then *Push*,
  then remote commit → *Fetch* → *Update* (the "remote equals HEAD after the Push" check then sits
  before the Update); (c) the custom fixture (longer workflows, more types; slower, no extra
  provenance rule). **Recommended: (a).**
- **D43-4 — Fetch before the Update in AC-1.** (a) the sidebar's *Fetch* (a UI cause; a
  fetch moves only `refs/remotes/origin/main`, checked by the ref rule); (b) `fetchCopy` with git
  before the console starts (G-12.x's form; the session's fetch then is not the UI's). **Recommended: (a).**
- **D43-5 — where the focus goes after *Cancel* of the gate footer opened from Today (AC-3) — spec
  gap.** spec-003 §6 says nothing about Cancel; ux-reference §4.2 says "*Close* and Escape close it
  and return focus" without a target; X-06.3 (v0.1) says, for a panel opened from the Memory list,
  "the focus returns to the row that opened it" (implemented there, W3-23); the route's close
  (`web/src/routes/element.tsx`) moves the focus to `#main` unless the destination placed it; Today
  places nothing (probe above). (a) the focus returns to the Today action that opened the
  panel (*Approve task-001-login-form*), as X-06.3 for the Memory list and WCAG 2.4.3 — the current
  behaviour is then a **defect** (bug-ingest by the coordinator; red test first; to be absorbed into
  this task as a small `TodayView` change mirroring the Memory list's row focus, or fixed by a
  separate task, the approver's call), with a ux-reference §4.2 note; (b) `#main` (the route's
  documented rule, the current behaviour): ux-reference §4.2 states it for Today, the test is a
  characterization (guard removal: `focusMainWhenLost` removed → the focus on `<body>`); (c) assert
  only that the focus is not lost (not on `<body>`), no target. **Recommended: (a).**
- **D43-6 — AC-4: who, which element, how the copy is made behind.** (a) Jordan (developer,
  the element's creator — G-10.1, G-11.2) on `task-004-session-timeout`; behind by `remoteCommit` +
  `fetchCopy` before the console starts (G-12.x's form, deterministic); (b) the same, behind made
  while the panel is open with the sidebar's *Fetch* (also proves the footer follows the fetch);
  (c) Morgan on the same element (an approver submitting). **Recommended: (a).**
- **D43-7 — the checker of AC-1 and its proof.** (a) a harness module
  `test/harness/commit-provenance.ts` with its Vitest self-test (each rule seen failing on a scratch
  repository), plus the by-hand demonstration on the e2e that the AC asks for; (b) the checks
  inline in the spec, the by-hand demonstration only (AC literal); (c) extend `diffRepo` with an
  "expected changes" filter (changes a shared helper `no-commit.spec.ts` relies on). **Recommended: (a).**
- **D43-8 — `.git/index` in the "nothing else changed" rule.** (a) not compared (every
  commit rewrites it); its content is covered by `git status` equal to before (porcelain with
  untracked and ignored files) — the index's entries are compared through their effect; (b)
  compare `git ls-files -s` before/after minus the three element files (entries, modes, blobs);
  (c) compare nothing about the index. **Recommended: (a).**
- **D43-9 — where the AC-2, AC-3 and AC-4 tests live.** (a) appended to their siblings —
  `gate-footer.spec.ts` (G-04.1 variant, X-06.2 variants) and `update-push.spec.ts` (G-12.1
  variant) — reusing those files' local helpers (`openToday`, `todayAction`, `gate`, `outcome`,
  `recordWrites`, `copy`, `start`, `BEHIND`); the own-spec run covers those files on the three
  engines (as task-040 appended to `submit-footer.spec.ts` and `shell.spec.ts`); (b) all four in
  `commit-provenance.spec.ts` (one spec per task; helpers duplicated); (c) one new
  `gate-paths.spec.ts` for AC-2 … AC-4. **Recommended: (a).**

#### Decisions answered 2026-10-18 (approver)

"All as recommended": **D43-1 (b)**, **D43-2 (a)**, **D43-3 (a)**, **D43-4 (a)**, **D43-5 (a)**,
**D43-6 (a)**, **D43-7 (a)**, **D43-8 (a)**, **D43-9 (a)**. D43-5 (a): the focus returning to
`#main` after *Cancel* of a gate footer opened from Today is a defect — ingested by the coordinator
as bug-018 and absorbed into this task (its own AC and the fix arrive with the coordinator's merge
of the design branch); the AC-3 Cancel walk is written after that merge, red first.

### red / green / refactor (2026-10-18)

- **Checker, red first (`6677805`)** — `test/harness/commit-provenance.test.ts` (10 cases on a
  scratch repository with a bare remote) failed to load before the module existed. **Green
  (`2756be6`)** — `test/harness/commit-provenance.ts` (`SUBMIT_SUBJECT`, `DECISION_SUBJECT`,
  `governedId`, `sessionCommits`, `remoteRefs`, `provenanceProblems`): 10/10. Each rule has its own
  failing case (an extra `chore(ui)` commit, a reject without its transition, a governed commit with
  a second file, a merge commit, a new tag, a moved branch, a stash, a `.git/config` change, an
  untracked file, not pushed — remote branch and tracking ref not at HEAD —, a ref added on the
  remote, a remote commit that is not the test's, the remote's commit not in HEAD) and the clean
  session reports nothing.
- **e2e (`9cd0cd4`)** — `test/e2e/commit-provenance.spec.ts` (AC-1), `gate-footer.spec.ts` › G-04.1
  with auto-push (AC-2) and X-06.2's keyboard Reject (AC-3), `update-push.spec.ts` › G-12.1's Submit
  while behind (AC-4). First Chromium run: 3 passed, 1 failed — the Reject walk asserted "Rejected by
  Morgan: …", but the banner names the commit's **author**, and e2e identities set only `user.email`
  (the copy's commits are authored by the harness identity; ES2-3 "the commit author is never
  asserted"): the banner is now matched as "Rejected by <anyone>: <reason>" (`a test fix, not a
  product defect`). Second run: **4 passed** (Chromium, 18.5 s).
- **Guard removal (not committed; the four tests on Chromium on the faulted tree, then restored with
  `git checkout --` of the three files): 4 failed.**
  - AC-1 (the by-hand demonstration of the AC): one extra commit `chore: an extra commit`, committed
    and pushed by the test after the session's Push → `provenanceProblems` reported
    `not a governed subject: 7cff31c chore: an extra commit` and the subject list differing from the
    session's three.
  - AC-2: the console started without `autoPush` → `.toast-pushed` not found.
  - AC-3: `tabIndex={-1}` on the reject outcomes (`ElementFooter.tsx`) → "the focus never reached …
    'Reject → draft' in 60 presses".
  - AC-4: the Submit footer's `disabled` ignoring `view.enabled` (`ElementFooter.tsx`) → *Submit →
    pending* not `aria-disabled`.
- **Three engines** — `npx playwright test` of the three files with `--grep` on the four new tests
  (Chromium, Firefox, WebKit): **12 passed** (1.1 min; load 9.2 at the end). Every run through the
  machine-free slot; no console left, the tree clean after the fault run.

### red / green / refactor — AC-3 Cancel and AC-7, bug-018 (2026-10-19)

After the coordinator's merge of `design/e2e-smoke_v0.2` (`7962c89`: bug-018 triaged and absorbed,
the task's `bug:` list and AC-7).

- **Red (`dd46038`)** — e2e `gate-footer.spec.ts`: "X-06.2 — Cancel the gate footer with the
  keyboard only (G4)" (Today → Enter on the action → Tab to *Cancel* → Enter: the panel gone, URL
  `/today`, no governed `POST`, HEAD unchanged, the action focused with its ring), and the describe
  "bug-018 — …" with "AC-7 — Escape returns the focus …", "AC-7 — Close returns the focus …" and
  "AC-7 — the focus goes to the main region when the Today action is gone" (approve, then Close: the
  row left Requires you). Chromium: **3 failed** — the focus on `#main`, "inactive" for the action —
  and the `#main` case **passed** (a characterization of the route's `focusMainWhenLost`). Unit
  `test/web/today/today.test.tsx` › "bug-018 — the focus back on the Today action": Close and Escape
  **failed** (`<main id="main">` instead of the button), the "no longer listed" case passed.
- **Green (`c5397fe`)** — `web/src/today/TodayView.tsx`: a module-level `returnAction {pid, eid}`
  set by the Requires you action's press, taken when Today of that project mounts, and used once
  Today is read again (`data` and not `isFetching`: a cached answer would still list a gate just
  decided) — the action's button focused, or `#main` when it is no longer listed; only while the
  focus is on the page or `#main` (a focus the user moved is kept) — the Memory list's rule (W3-23,
  review N2). `TodayViewProps.today` gains `isFetching` (the route passes the whole query). Unit 39/39
  (`test/web/today`); e2e Cancel and AC-7 on the three engines **12 passed**.
- **Docs (`aef3520`)** — `CHANGELOG.md` *Unreleased* › *Fixed* (bug-018, appended);
  `docs/00_reference/ux-reference.md` 1.9 §4.2 (the focus returns to the opener — the Memory list's
  row or the Today action — also after *Cancel*; the main region only when the opener is no longer
  listed); `docs/user-guide.md` 0.17 (*The element panel*: it described the focus going back to the
  row).
- **Deviation, recorded:** the first three-engine run of the green had 1 failure (Chromium, Escape)
  in `openConsole`: the console answered `GET /p/<pid>` with the API's not-found JSON — I had run
  `npx vitest run test/docs` in this worktree meanwhile, whose global setup rebuilds `web/dist`
  (the hazard of `test/README.md` *Launch smoke*). Not a product or test defect; re-run alone:
  **12 passed** (1.1 min).
- **Scope note:** AC-7 names the Today action; a panel opened by a Requires you row's **title link**
  (or a Waiting on others link) still returns the focus to `#main`, as before.

e2e closure (scenario → spec file › test):

| Gap / scenario | spec file › test |
|----------------|------------------|
| G2 (drive-browser, commit provenance) | `test/e2e/commit-provenance.spec.ts` › "drive-browser — every commit of a UI session is the CLI's `wf(…)` commit of its element (G2)" |
| G3, G-04.1 + success criterion 1 | `test/e2e/gate-footer.spec.ts` › "G-04.1 — Approve a gate in two clicks from Today, with the commit shown and pushed (success criterion 1)" |
| G4, X-06.2 Reject | `gate-footer.spec.ts` › "X-06.2 — Reject a gate with the keyboard only (G4)" |
| G4, X-06.2 Cancel (+ AC-7 focus) | `gate-footer.spec.ts` › "X-06.2 — Cancel the gate footer with the keyboard only (G4)" |
| G5, G-12.1 Submit | `test/e2e/update-push.spec.ts` › "G-12.1 — Block a submit while behind (G5)" |
| AC-7 (bug-018) Escape, Close | `gate-footer.spec.ts` › "AC-7 — Escape returns the focus to the Today action that opened the panel", "AC-7 — Close returns the focus to the Today action that opened the panel" |
| AC-7 (bug-018) opener gone | `gate-footer.spec.ts` › "AC-7 — the focus goes to the main region when the Today action is gone" |

### checks (2026-10-19, HEAD `e144997`)

Every heavy gate through the machine-free slot, in series; the load at each grant.

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api` (0 warnings), `check_tasks.py v0.2` | OK | — |
| `npm run test:coverage` (public-text check included) | 173 files passed, 1 skipped; **3206 passed / 1 skipped**; statements 96.54 %, branches 91.34 %, functions 97.29 %, lines 98.35 % | 9.6 |
| `npm run test:e2e:chromium` (whole suite) | **318 passed** (11.5 min) | 10.9 |
| `npm run test:e2e -- gate-footer.spec.ts update-push.spec.ts commit-provenance.spec.ts today.spec.ts` (three engines) | **207 passed** (8.6 min) | 9.7 → 21.9 |
| `npm run test:smoke` | not run: no packaging, launcher or bin change | — |
| `npm run test:timing` | not run: no timed path changed (Today's open is unchanged until a panel closes) | — |

No console left, no `wfui-*` entry in the system temporary directory.
