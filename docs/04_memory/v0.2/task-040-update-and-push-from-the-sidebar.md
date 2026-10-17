---
id: task-040-update-and-push-from-the-sidebar
type: task
title: "Update and push from the sidebar"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-Y-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-016-a-token-pasted-into-a-tab-that-already-shows-the-console-is-not-read-without-a-reload"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-038-submit-footer-action-toasts-and-blocked-actions", "task-039-repository-status-and-fetch-in-the-sidebar"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

*Update* and *Push* in the sidebar (Y3, Y4): the fast-forward update with the refusals that name
the terminal command (diverged, local changes in the way), the last update error, *Push* with
*Cancel* when auto-push is off, rejected pushes as a red toast with git's reason, and governed
actions blocked while the copy is behind, with an *Update* link in the footer's reason (G-12).

**Backlog items:** US-Y-05, US-Y-06, US-Y-07, US-Y-08, US-G-12

- US-Y-05 — As a member, I want Update to fast-forward my copy (`git pull --ff-only`), automatically when my settings say so, so that governed actions are unblocked
- US-Y-06 — As a member, I want an update that cannot fast-forward (diverged history, local changes in the way) to leave actions blocked and tell me what to run in the terminal, so that the UI never merges or rebases
- US-Y-07 — As a member, I want UI commits pushed automatically when my settings say so (off by default), or with Push, so that nothing committed from the UI stays unshared by accident
- US-Y-08 — As a member, I want a rejected push (remote moved, no permission) shown as a red toast with git's reason, the commit kept local and counted as ahead, so that I know it is not shared yet
- US-G-12 — As a member, I want governed actions blocked while my copy is behind the remote, with a link to Update, so that I never act on a stale copy

## Acceptance Criteria

- **US-Y-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/update.feature`: Y-05.1 Update a copy that is behind; Y-05.2 Update automatically after a fetch; Y-05.3 Update with local changes that do not touch the incoming files
- **US-Y-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/update.feature`: Y-06.1 Refuse to merge diverged histories; Y-06.2 Refuse an update that local changes are in the way of
- **US-Y-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/push.feature`: Y-07.1 Push with the button; Y-07.2 Keep auto-push off by default; Y-07.3 Push automatically after a UI action
- **US-Y-08** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/push.feature`: Y-08.1 Report a push rejected because the remote moved; Y-08.2 Report a push refused for permission
- **US-G-12** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/blocked-actions.feature`: G-12.1 Block governed actions while behind; G-12.2 Unblock after the update; G-12.3 Do not block when the copy is only ahead
- **bug-016 (a token pasted into a tab that already shows the console is not read without a
  reload)** A console URL with a new `#token=…` pasted into a tab that already shows that console
  (only the fragment changes, so the browser does not reload) starts the session as a fresh tab
  does: the page reads the new fragment, exchanges it (`POST /api/session`), removes it from the
  address bar and shows the console; a test reproduces the paste in an open tab first.

Also closes the sidebar step of G-13.2 ("1 commit to push", RP-52): the scenario is owned by
task-038-submit-footer-action-toasts-and-blocked-actions (US-G-13), which proves its toast; this
task adds the sidebar assertion to the same e2e test.

Also closes G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2 of TT-STATE-04 (task-033-git-copy-state-repository-status-and-transport-routes), Y-05.2 of
TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push) and Y-07.2 of TT-STATE-09 (task-030-ui-settings-store-and-settings-api).

Wording (spec review round 3): when this task touches the vision, story-map or
`update.feature` texts that describe *Update*, it rewords them so that the user's *Update* is
`git pull --ff-only` and the automatic update a fast-forward `merge --ff-only` of the fetched
upstream (`03_is-isnot.md`, `05_journeys.md`, `06_features.md` Y4, US-Y-05, `update.feature`
header), with doc versions bumped.

Screen: `docs/00_reference/ux-reference.md` §3 (*Git status*: "N commits to push" + Push), §5 (*Feedback*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- RP-53: Y-05.2 (automatic update within 65 s) runs in `test:e2e` on the three engines with
  `fetchIntervalSeconds` = 15 (its minimum, RP-19); the real 65 s budget is measured only in
  `test:timing`, on Chromium (RP-44).
- `spec-010` §4 (manual update not cancellable, RP-37), §5 (catalogue texts, `{files}` with
  `formatList`), §6 (`push` outcome); `spec-003` §6 reasons `copy-behind {commits}`,
  `copy-diverged`, `copy-detached`; `spec-004` §5.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-17)

Read: this task (with the absorbed bug-016 and its AC); `CLAUDE.md`; the developer rules of the
dev-loop (hard rules, v0.2 additions, e2e engines W0-9, lessons of Waves 0–5, the machine-free slot
for heavy gates); `dev-loop-rel-v0.2-plan` Sessions 1–6 (W3-n … W5-n, the hand-overs to Wave 6, the
Wave 3 open points still standing); `release-planning-rel-v0.2-plan` RP-14, RP-19, RP-22, RP-23,
RP-37, RP-43, RP-44, RP-47, RP-52, RP-53, RP-55; spec-010 (all, with its Process Notes; §4 manual
update not cancellable, §5 catalogue texts and `{files}`, §6 `push` outcome and the declared residual
of `autoUpdate`), spec-003 §6, spec-004 §5; `update.feature`, `push.feature`,
`blocked-actions.feature`, `action-feedback.feature` G-13.2, `00_conventions.md`; ux-reference 1.7
§3 (*Git status*, *Sidebar*) and §5 (*Feedback*); the prototype's sidebar foot ("In sync with git" or
"N commits to push" + *Push*, `main @ <hash>`); directives (`directives list`: `ux-consistency`,
`security-secrets`, `claim-evidence`, `documentation`, `doc-versioning`); code:
`web/src/session/session.ts`, `web/src/main.tsx`, `web/src/app.tsx`, `web/src/api/{git,events,
client,error-message,queries}.ts`, `web/src/repository/{model.ts,GitStatus.tsx}`,
`web/src/element/{ElementFooter.tsx,write-toast.tsx}`, `web/src/shell/{toasts.ts,toasts.css,
pages.tsx,Shell.tsx}`, `web/src/i18n/en.json`, `server/src/writes/transport.ts`,
`server/src/git/redact.ts`, `contracts/src/api.ts` (`Identity`); tests `test/e2e/support/{console,
remote,git-http,screens}.ts`, `test/e2e/{shell,submit-footer,git-status}.spec.ts`.

**depends_on (dl-015 hard gate) — task-038, task-039 and the owners of the routes and settings
this task builds on, task-030, task-033, task-034, task-041: Execution Notes read (design,
decisions, red/green/refactor, every review round, before submit).**

- task-038: toasts are a module store (`showToast({key, tone, title, body, sticky})`, an error is
  sticky, at most 3, keyed replacement, placement bounded by `#main` so the sidebar foot stays
  clear, W5-5); the two live regions have no `status`/`alert` role (W5-2); a failed auto-push is the
  write's **polite success** toast, sticky, with the red attention line "Not pushed — the commit stays
  local" and the reason (`ErrorText`: a catalogue code or git's text verbatim in the
  `error.gitRefused` frame, D38-4); `ConsoleOptions.settings` throws with a `stateFile` or a seeded
  `stateDir`; `remoteHead(fixture)`; G-13.2 is proved up to the toast in
  `submit-footer.spec.ts`, its sidebar step is this task's (RP-52).
- task-039: `useGitOperation()` (`web/src/api/git.ts`; 200 → `setQueryData` of the header's
  `repository`; other outcomes re-read the header; the page's own abort → `cancelled`, never an
  error); `GitStatus` (keyed by pid, *Fetch* aria-disabled "Fetching…" + *Cancel*, focus back to
  *Fetch*, the refusal alert inserted with its content outside the parts that follow the data,
  `sync.update.lastError` already rendered — catalogue text with the `{files}` list, or "Update
  failed" + git's message); the copy line "N ahead" / "N behind" / "A ahead · B behind"
  (D39-7: "N commits to push" + *Push* left to this task); `.project-sidebar` / `.sidebar-foot`
  (max half the column, scrolls); `remoteCommit`, `setRemoteUrl`; the fourth `SCREENS` project.
- task-030: settings defaults (`autoPush: false` — Y-07.2 API side), `settings` event.
- task-033: the three routes (no body or `{}`; row 5 → 403 `not-in-team` for update and push,
  fetch allowed, RP-14; §5 refusals 409 under the lock on the fresh state; a refused update — not
  `no-fetch-target` — is recorded in `sync.update.lastError`; 422 `git-refused` with git's text
  redacted — project `<project>`, repository `<repository>`, a local remote's paths `<remote>`, the
  server's home `~`, URL userinfo removed, ≤ 4 000 characters; push failures are **not** recorded);
  push = `HEAD:<merge ref>` of the upstream's remote, never forced, never `pushRemote`; row 8
  (`stale-copy`) on the fresh state; open point: a cancelled fetch/push answers 500 `internal` to a
  client that left and records nothing.
- task-034: the manual update is the hardened `pull --no-prune --ff-only --no-squash --strategy=ort
  --no-rebase --no-autostash` with the branch's `mergeOptions` emptied (bug-014: no merge commit, no
  staged squash, no pruned tag); `refspec-outside-remotes` also for the update; the auto-push pushes
  HEAD, `push.code` `push-timeout` / `internal` / §5 codes; every real-bin console fetches every
  60 s (`autoFetch` on); the automatic update needs an identified user; Y-05.2, Y-07.3, Y-08.1 close
  here in e2e.
- task-041: `settingsQuery` / `useSettingsView()` (a ledger over server answers) in
  `web/src/api/settings.ts`; `settings` event rule — reused only if D40-1 (b) or (c) is chosen.

**What git does here (probe on git 2.43.0, scratch repositories, removed):** a rejected push
(`--quiet`, local bare remote) prints `To <absolute remote path>`, `! [rejected] HEAD -> main
(fetch first)`, `error: failed to push some refs to '<absolute remote path>'` and four `hint:` lines
naming `git pull`; a local remote's `pre-receive` hook runs in `git-receive-pack` and its output
reaches the pusher as `remote: …` lines (it printed `$HOME/secret` and a URL with `u:tok@`
verbatim); `pull --ff-only` on diverged history exits 128 with `hint:` lines and `fatal: Not
possible to fast-forward, aborting.` The server's redaction (task-033 R1, D33-5) covers the remote
path, the home folder and the userinfo of these texts; this task proves it end to end (Y-08.2).

#### AC classification

| AC part | kind | first test |
|---------|------|------------|
| Y-05.1 (Update a copy that is behind → HEAD = remote's commit, "In sync with git") | **red-first** (no *Update* control today); the route **characterization** (task-033/034) | `test/web/repository/git-status.test.tsx`; e2e |
| Y-05.2 (automatic update within 65 s) | **characterization** (task-034 scheduler) | e2e at 15 s (RP-53); `@live-refresh` timing at 60 s ≤ 65 s (Chromium) |
| Y-05.3 (unrelated local edit kept) | **red-first** for the control; server **characterization** | e2e |
| Y-06.1, Y-06.2 (refusal text in the sidebar, HEAD and edit unchanged, actions stay blocked) | **red-first** for the control; the line is **characterization** of task-039's `UpdateFailure` and the footer of task-037/033 | e2e |
| Y-07.1 (Push with the button) | **red-first** | component; e2e |
| Y-07.2 ("1 commit to push" with *Push*, auto-push off by default) — TT-STATE-09 of task-030 | **red-first** | model + component; e2e with no settings seeded |
| Y-07.3 (auto-push) | **characterization** (task-034, task-038's toast) | e2e |
| Y-08.1 (failed auto-push: toast "Not pushed" + git's text, commit kept, "1 ahead") | **characterization** of task-038's toast and task-039's line — **red-first** only if D40-6 (b) | e2e |
| Y-08.2 (Push refused: red toast "Not pushed" + git's text, "1 commit to push") | **red-first** | component (push toast); e2e with redaction markers (D40-9) |
| G-12.1 ("Blocked: your copy is 1 commit behind the remote — Update") | **red-first** (catalogue value + link) | `test/web/element/gate-footer.test.tsx` (appended); e2e |
| G-12.2 (Update in that message → at the remote's commit, Approve enabled) | **red-first** | component; e2e |
| G-12.3 (only ahead → not blocked) | **characterization** (task-033 descriptor) | e2e |
| G-13.2 sidebar step ("1 commit to push", RP-52) | **red-first** | appended assertion in `test/e2e/submit-footer.spec.ts` › G-13.2 |
| *Push* *Cancel* (RP-37) | **red-first** | component (abort → no toast, focus back); e2e with a held push |
| one transport at a time, focus kept (D40-4) | **red-first** | component |
| bug-016 (a pasted `#token=…` read without a reload) | **red-first**: the e2e reproduces the paste in an open tab first (fails today: still the lost-session page, no `POST /api/session`) | `test/web/session/session.test.ts` (appended), e2e |
| SCREENS / X-06.4 / X-09.1 | **red-first** | appended screen (D40-10); own-spec `scanThemes` |
| REQ-INT-08 | check | own spec on the three engines (W0-9) |

#### What the sidebar adds (pending D40-1 … D40-5)

`gitStatusView` (pure, `web/src/repository/model.ts`) gains `actions: { update: boolean; push:
{ commits: number } | null; readOnly: boolean }`: *Update* while `behind > 0` (copy `behind` or
`diverged` — Y-06.1 clicks it on a diverged copy and reads the refusal), *Push* with "N commits to
push" while the copy is `ahead` (D40-1); none for `detached`, `no-upstream`, `in-sync`; none without
`has-remote` (spec-010 §7). `readOnly` for an identity other than `member` (D40-3). The copy line of
task-039 is unchanged.

`GitStatus` renders, in `.git-actions`: *Fetch* (unchanged), *Update*, *Push* — each a native
button, aria-disabled while any transport of the project runs (D40-4), reading "Updating…" /
"Pushing…" while its own runs; *Cancel* only after a running fetch or push (RP-37). Outcomes per
D40-5; the push toast in `web/src/repository/push-toast.tsx` (key `push:<pid>`).

The footer's copy-behind reason (`element.reason.copyBehind`, one declared value edit) ends with
" — <update>Update</update>": the tag renders `UpdateLink` (`web/src/repository/UpdateLink.tsx`, a
native button styled as a link, the same mutation and running state as the sidebar's *Update*,
D40-2). The paragraph stays the outcomes' accessible description ("… behind the remote — Update").

#### bug-016 (pending D40-7)

`web/src/session/session.ts` gains `watchFragmentToken()`: one `hashchange` listener, installed once
by `main.tsx` after the bootstrap (one appended line). It acts only when the new fragment carries a
`token` (`fragmentToken`, the existing parser: a skip link `#main` or any other fragment is
ignored). The token is never stored, logged, rendered or read from anywhere but `location.hash`; the
exchange, the `history.replaceState` and the shell stay the bootstrap's own code path.

#### File layout (planned, pending the decisions)

- `web/src/repository/model.ts`, `GitStatus.tsx`, `git-status.css` (task-039's files, extended);
  `web/src/repository/UpdateLink.tsx`, `push-toast.tsx` (new).
- `web/src/api/git.ts` (task-039's, **shared**): `mutationKey: ['git']` on `useGitOperation` and a new
  `useRunningGitOperation(pid): GitOperation | undefined` (`useMutationState` over that key, filtered
  by `variables.pid`) — D40-4.
- `web/src/element/ElementFooter.tsx`: the `update` rich-text value of the copy-behind reason (`pid`
  passed down to `FooterContent`).
- `web/src/session/session.ts` (`watchFragmentToken`), `web/src/main.tsx` (one appended line).
- `web/src/i18n/en.json` (sorted inserts: `shell.git.update`, `shell.git.updating`, `shell.git.push`,
  `shell.git.pushing`, `shell.git.toPush` "{count, plural, one {# commit to push} other {# commits to
  push}}", `shell.git.pushFailed` (the push toast's title), `shell.git.readOnly` (D40-3); one declared
  value edit: `element.reason.copyBehind` + " — <update>Update</update>").
- No change to `contracts/`, `server/`, `web/src/api/error-message.ts` `MESSAGES` (every code
  rendered here has its key), `base.css` or the shell layout.
- Tests: `test/web/repository/{model.test.ts,git-status.test.tsx}` (appended),
  `test/web/repository/update-link.test.tsx` (new), `test/web/api/git.test.tsx` (appended),
  `test/web/element/gate-footer.test.tsx` and `submit-footer.test.tsx` (copy-behind rows),
  `test/web/session/session.test.ts` (appended); e2e `test/e2e/update-push.spec.ts` (new),
  `test/e2e/submit-footer.spec.ts` (G-13.2: one appended sidebar assertion, RP-52),
  `test/e2e/shell.spec.ts` (bug-016: one appended test next to the session test),
  `test/e2e/support/remote.ts` (appended: `fetchCopy(fixture)`, `localCommit(fixture, file)`,
  `remoteHook(fixture, script)` for a `pre-receive` hook — D40-9), `test/e2e/support/screens.ts`
  (D40-10, append-only), `playwright.timing.config.ts` header (Y-05.2 under `@live-refresh`).
- Docs: `docs/user-guide.md` (*Git status in the sidebar*: Update, Push, Cancel, the refusals that
  name the terminal command, the blocked footer's *Update*; *The session and the browser*: a pasted
  URL works in an open tab), ux-reference §3 *Git status* bullet (`ux-consistency`, deviations of
  D40-1/D40-5), `CHANGELOG.md` *Unreleased* › Added (Update, Push) and › Fixed (bug-016),
  `test/README.md` version line + layout lines; the wording note of this task (D40-8); BDD text
  only if D40-6 (a) — version numbers from the coordinator.

#### Test plan

- Vitest (jsdom): `model.test.ts` (actions per copy state × has-remote × identity; "N commits to
  push" only in `ahead`); `git-status.test.tsx` (Update → `POST …/git/update` with no body, pending
  "Updating…", no Cancel; Push → `POST …/git/push`, "Pushing…" + Cancel, Cancel aborts → no toast,
  focus back to *Fetch* / *Push*; one transport at a time across the three buttons and the footer
  link; a button that held the focus and goes with the new state hands the focus to *Fetch*; 200 →
  header data from the answer; update 409/422 → header re-read, no toast, the recorded line shown;
  403/500/unreachable on update → the block's alert; every push failure → one red sticky toast keyed
  `push:<pid>` with `ErrorText` (git's text verbatim inside `error.gitRefused`), replaced by the next
  push; read-only identities → aria-disabled with the description; keyed by pid);
  `update-link.test.tsx` (renders inside the reason, runs the update, disabled while a transport
  runs, accessible description of the outcomes ends "— Update"); `git.test.tsx`
  (`useRunningGitOperation` across two hooks, per pid); `session.test.ts` (a `hashchange` to a token
  fragment reloads when lost; probes and strips when connected — D40-7; `#main` ignored; the token in
  no console call).
- Playwright `test/e2e/update-push.spec.ts` (`prebuild: ['kanban']`), one test per scenario, each on
  its own fixture copy as Morgan (`copyAs`), settings seeded `autoFetch: false` except Y-05.2
  (`autoFetch`, `autoUpdate`, interval 15 s) and Y-07.2 (never changed: no seed); "behind"
  via `remoteCommit` + `fetchCopy`, "ahead" via `localCommit` or an approval; assertions on what the
  user sees (sidebar texts, toasts, footer) plus the fixture's git state (`head`, `remoteHead`,
  `git status`); `scanThemes` on: *Update* visible (Y-05.1), "Updating…" (Y-05.1, before the answer),
  "1 commit to push" + *Push* (Y-07.2), "Pushing…" + *Cancel* (cancel test), the red push toast
  (Y-08.2), the footer with *Update* (G-12.1); `document.elementFromPoint` on *Update*, *Push* and
  the red toast at 1280×720, 600×720 and 400×600 (Wave 5 lesson); a keyboard-only test (Tab to
  *Update* and *Push*, Enter, visible focus, focus after the state moved). The cancel test holds the
  push in a `pre-receive` hook that waits for a file the test never writes (bounded by its own
  deadline), then Cancel: no toast, *Push* focused, the remote's branch unchanged, no git process of
  the console left (`pgrep` on the hook's marker command).
- bug-016 (`shell.spec.ts`): open `<origin>/` without a fragment (lost-session page), then
  `page.goto(<printed URL>)` in the same page (a same-document fragment navigation: Playwright
  answers `null`): the shell shows, one `POST /api/session` answered 204 was sent, `page.url()` has no
  fragment, no console message holds the token; plus: a valid session and a `#token=<junk>` fragment
  keep the session (D40-7 (a)).
- Gates: typecheck, lint, format:check, `test:coverage`, `docs:api`, `check_tasks.py v0.2`,
  `test:e2e:chromium` + own and touched specs (`update-push`, `submit-footer`, `shell`,
  `git-status`, `gate-footer`, `accessibility`, `no-commit` if the screens console changes) on the
  three engines, `test:timing` at load < 12 (Y-05.2's 65 s budget is this task's); every heavy gate
  through the machine-free slot.

e2e closure (planned):

| Scenario | spec file › test |
|----------|------------------|
| Y-05.1 (TT-STATE-04 of task-033), Y-05.3 | `test/e2e/update-push.spec.ts` › "Y-05.1 — Update a copy that is behind", "Y-05.3 — Update with local changes that do not touch the incoming files" |
| Y-05.2 (TT-PERF-07 of task-034) | `update-push.spec.ts` › "Y-05.2 — Update automatically after a fetch" (`@live-refresh`: 15 s in `test:e2e`, 60 s / ≤ 65 s under `test:timing`) |
| Y-06.1, Y-06.2 (TT-STATE-04) | `update-push.spec.ts` › "Y-06.1 — Refuse to merge diverged histories", "Y-06.2 — Refuse an update that local changes are in the way of" |
| Y-07.1, Y-07.2 (TT-STATE-09 of task-030), Y-07.3 | `update-push.spec.ts` › "Y-07.1 — Push with the button", "Y-07.2 — Keep auto-push off by default", "Y-07.3 — Push automatically after a UI action" |
| Y-08.1, Y-08.2 | `update-push.spec.ts` › "Y-08.1 — Report a push rejected because the remote moved", "Y-08.2 — Report a push refused for permission" |
| G-12.1, G-12.2, G-12.3 (TT-STATE-04) | `update-push.spec.ts` › "G-12.1 — Block governed actions while behind", "G-12.2 — Unblock after the update", "G-12.3 — Do not block when the copy is only ahead" |
| G-13.2 sidebar step (RP-52) | `test/e2e/submit-footer.spec.ts` › "G-13.2 — Show the commit without \"pushed\" when auto-push is off" (appended sidebar assertion) |
| Cancel of a push (RP-37) | `update-push.spec.ts` › "Push can be cancelled while it runs (RP-37)" |
| bug-016 | `test/e2e/shell.spec.ts` › "bug-016 — a token pasted into an open tab starts the session without a reload" |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` › the appended screen (D40-10) |

#### Spec and document gaps (each a decision below)

- ux-reference §3 says "N commits to push + Push (when auto-push is off)" and the task's description
  "*Push* with *Cancel* when auto-push is off", while spec-010 §6's `push-timeout` text — shown for a
  failed **auto**-push — says "use Push to try again", and Y-08.1 (auto-push on) leaves a commit to
  push with no retry by itself (D40-1).
- Y-08.1 asks for "a red toast" while task-038's approved D38-4 makes a failed auto-push the write's
  polite success toast with a red attention line (D40-6).
- Y-07.2 / Y-08.2 / G-13.2 read "1 commit to push" and Y-08.1 "1 ahead" in the same copy state
  (D40-1).
- No spec says what a manual *Update* or *Push* shows on success, on a refusal the server records,
  or on one it does not (D40-5); nor what a non-member sees (D40-3).
- A `hashchange` listener also hears in-page links (D40-7).

#### Open decisions (STOP: reported to the coordinator as D40-1 … D40-12; nothing depending on them is built before the answer)

Listed in the report; the answer is recorded under *Decisions* below.
