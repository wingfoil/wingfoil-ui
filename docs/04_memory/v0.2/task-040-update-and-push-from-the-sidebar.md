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
bug: ["bug-016-a-token-pasted-into-a-tab-that-already-shows-the-console-is-not-read-without-a-reload", "bug-017-git-and-cli-messages-shown-in-the-ui-keep-terminal-control-and-bidi-characters-and-the-length-cap-can-drop-git-s-own-rejection-line"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
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
- **bug-017 (git and CLI messages keep terminal control and bidi characters; the length cap can drop
  git's own rejection line)** Every git or CLI text the API sends verbatim (`git-refused`,
  `cli-refused`, `sync.*.lastError`, the CLI's `warnings`, file names in `detail.files`, branch and
  upstream names) goes through one sanitiser: control and format characters other than newline and
  tab are shown as visible escapes, the input is bounded before it is transformed, and a long
  message keeps git's concluding lines; tests feed each producer a control/bidi marker first.

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
reaches the pusher as `remote: …` lines (it printed a file of the home folder and a URL with `u:tok@`
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

- **D40-1 — when *Push* shows, and its line.** ★ (a) *Push* with "N commits to push" whenever the
  copy is `ahead` (ahead > 0, behind = 0), whatever `autoPush` says; the copy line "N ahead" of
  task-039 stays above it, so Y-08.1 ("1 ahead") and Y-07.2 / Y-08.2 / G-13.2 ("1 commit to push")
  hold as written; no settings read; ux-reference §3 "(when auto-push is off)" replaced (a failed or
  timed-out auto-push is retried with *Push*, as `error.pushTimeout` says); not on `diverged` (git
  would reject it; the update refusal names the terminal commands); (b) only while `autoPush` is off
  (`settingsQuery`; ux-reference and description literal) — after a failed auto-push nothing in the
  UI can push, against `error.pushTimeout`'s text; (c) "N commits to push" replaces the "N ahead"
  copy line in `ahead` and Y-08.1 is amended to "1 commit to push".
- **D40-2 — the footer's *Update* (G-12.2).** ★ (a) a link-styled native button inside the reason
  that runs the same update as the sidebar (shared running state, D40-4); after a success the focus
  moves to the footer's next step (the gate's reason field, or *Submit*) once the new descriptor
  arrives, after a refusal it stays on the link (the sidebar shows the refusal); (b) the link moves
  the focus to the sidebar's *Update* without running it (G-12.2's "click Update in that message →
  at the remote's commit" not met); (c) no link, the text only (against G-12.1's literal).
- **D40-3 — a user not identified as one member** (update and push → 403, RP-14).
  ★ (a) *Update* and *Push* shown aria-disabled (focusable), described by a new
  `shell.git.readOnly` "Read-only: Update and Push need you identified in the team" (S-11.1 pattern;
  *Fetch* stays enabled, RP-14); (b) hidden; (c) enabled, the 403 shown in the block's alert.
- **D40-4 — one transport at a time per project, focus.** ★ (a) while a fetch, update or push of the
  project runs — from the sidebar or the footer link — every sync button stays in place,
  aria-disabled (a press ignored), the running one reads "Fetching…" / "Updating…" / "Pushing…",
  *Cancel* only for fetch and push; a polite status says it; a button that held the focus and goes
  with the new state (Update at behind 0, Push at ahead 0, Cancel at the end) hands it to *Fetch*
  (always there while `has-remote` holds); the running state comes from the mutation cache —
  `mutationKey: ['git']` on `useGitOperation` and a new shared `useRunningGitOperation(pid)` in
  `web/src/api/git.ts`; (b) independent buttons, the server's write lock serialises (two "…ing"
  at once); (c) the buttons hidden while one runs (the focus jumps).
- **D40-5 — what *Update* and *Push* show.** ★ (a) success: no toast — the copy line ("In sync with
  git") in the polite region is the result; an update refusal or failure the server records
  (409 §5, 422) shows only as the sidebar's last-update-error line (Y-06.x "the sidebar shows",
  task-039's render), one not recorded (403, 500, unreachable) in the block's alert (the D39-5
  pattern); every push failure (422 with git's text, 409 §5 codes, 403, 500, unreachable) is a red,
  sticky toast "Not pushed — {the commit stays / N commits stay} local" + `ErrorText`, key
  `push:<pid>` (a new push replaces it); a cancel shows nothing; (b) a toast for every outcome,
  success included; (c) update refusals also as a red toast (twice on screen).
- **D40-6 — Y-08.1 "a red toast" vs task-038 D38-4.** ★ (a) keep D38-4 (the write succeeded: the
  polite, sticky success toast with the red attention line "Not pushed — the commit stays local" and
  git's text); the e2e asserts that line, its tone colour token and git's text; Y-08.1 reworded to
  "a toast shows "Not pushed" in red with the rejection printed by git" (`00_conventions.md` Process
  Note and version); (b) a failed push turns the write's toast red and assertive (changes an approved
  decision and task-038's tests); (c) a second, red toast for the push (D38-4's rejected option).
- **D40-7 — bug-016.** ★ (a) a `hashchange` listener (`watchFragmentToken`) acting only on a fragment
  with a `token`: when the session is lost → `location.reload()`, so the fresh-tab bootstrap reads,
  strips (`replaceState`) and exchanges it and every state starts over (queries, event stream, the
  final `lost` of W3-7, toasts) by construction; when connecting/connected → one probe `GET
  /api/server` with the current cookie: 401 (session lost) → reload as above; answered → this
  console already knows the page, the fragment is removed (`replaceState`) and ignored — so a
  `#token=…` link in rendered project content cannot end a valid session (a failed exchange is
  final); (b) an in-page re-bootstrap without reload (exchange, strip, un-final `lost`, reset every
  query, restart the stream, clear toasts) — more state to get right, changes W3-7; (c) reload on any
  token fragment (a crafted in-page link logs a connected page out).
- **D40-8 — the task's wording note** (*Update* = `git pull --ff-only`, the automatic update a
  fast-forward `merge --ff-only` of the fetched upstream). ★ (a) done here: `03_is-isnot.md`,
  `05_journeys.md`, `06_features.md` Y4, story map US-Y-05, `update.feature` header, versions bumped
  (the user guide and ux-reference already change in this task); (b) left as is (the note applies
  only "when this task touches" them).
- **D40-9 — Y-08.2's refusal and the redaction proof.** ★ (a) the fixture's own bare remote with a
  `pre-receive` hook (`remoteHook`) that declines with a permission message also printing the
  remote's path, a file of the home folder and `https://u:<marker>@example.invalid/x`: the toast shows git's
  `! [remote rejected] … (pre-receive hook declined)`, `<remote>`, the home folder as `~` and no marker — git's real
  output end to end; declared residual: absolute paths outside the project, repository, remote and
  home folders that a hook or git prints (e.g. a system folder) are shown as printed (git's text verbatim,
  REQ-INT-06; the user's own tools); (b) the git-http remote with `credentials` (a 401: "terminal
  prompts disabled", an authentication refusal that blocks fetch too, no redaction proof); (c) a new
  smart-HTTP remote answering 403 to `git-receive-pack` (new test support).
- **D40-10 — SCREENS.** ★ (a) one appended entry on a fifth project of `startScreensConsole`, a
  kanban copy as Morgan 1 commit behind its fetched remote: the gate footer of `task-001-login-form`
  with "— Update" and the sidebar's *Update*; "N commits to push", the "…ing" states and the push
  toast scanned in the own spec (a write or a push would change the shared console); (b) as (a) plus
  a sixth, ahead project; (c) no entry (against the AC).
- **D40-11 — Wave 3 open point: a cancelled push answers 500 `internal` with nothing recorded.**
  ★ (a) unchanged (no server or contract change): the page treats its own abort as cancelled and
  re-reads the header, which shows where the refs stand (also when the push finished before the
  abort); stated in the user guide; (b) a distinct `cancelled` answer and record (contract change
  for an answer no client reads).
- **D40-12 — Wave 3 open point: push never to `pushRemote`.** ★ (a) kept (spec-010 §4: the
  upstream's remote, `HEAD:<merge ref>`, every push URL owner-checked) and stated in the user guide's
  *Push*; (b) honour `branch.<b>.pushRemote` / `remote.pushDefault` (a security-relevant change to
  task-033/034's routes and owner checks, out of this task's scope).

#### Decisions (approver, 2026-10-17)

"All as recommended": **D40-1 (a)** … **D40-12 (a)**, deviations included: D40-1 (a) amends the
ux-reference's "(when auto-push is off)" (a deviation recorded per `ux-consistency`); D40-6 (a)
rewords Y-08.1 with a dated Process Note in `00_conventions.md`; D40-8 (a) rewording with version
bumps; D40-9 (a) with the declared residual in the user guide and spec-010; D40-11, D40-12 stated in
the user guide. Coordinator's shared shapes (C1–C6): task-029 merges first, this task second (the
coordinator merges `main` before submit); version lines `test/README.md` 0.41, `docs/user-guide.md`
0.15, ux-reference 1.8, `00_conventions.md` 0.10, `03_is-isnot.md` 0.7, `05_journeys.md` 0.4,
`06_features.md` 0.9, story map: its next version; `CHANGELOG.md` *Unreleased*: own entries only;
this task alone edits `en.json`, `test/e2e/support/screens.ts`, `remote.ts`, `web/src/api/git.ts`
(`mutationKey ['git']`, `useRunningGitOperation(pid)` approved), `ElementFooter.tsx`, `session.ts`,
`main.tsx`; no change to `package.json`, `package-lock.json`, `README.md`, `CLAUDE.md`,
`test/smoke/*`, `test/package/*`.

### red / green / refactor (2026-10-17)

- **Red (web)** — `7ece116`: `test/web/repository/update-push.test.tsx` (new), `model.test.ts`
  (actions), `test/web/api/git.test.tsx` (`useRunningGitOperation`), `test/web/session/session.test.ts`
  (`watchFragmentToken`), `test/web/element/gate-footer.test.tsx` (G-12.1 text and link, G-12.2): 16
  tests failed and one file failed to load (no `UpdateLink`), before any product code.
- **Green** — `79d87e3`: `web/src/repository/model.ts` (`SyncActions`, D40-1, D40-3),
  `GitStatus.tsx` (Update, Push, Cancel for fetch and push, one transport at a time, focus handed to
  *Fetch*, the alert for unrecorded update refusals, the push toast — D40-4, D40-5),
  `push-toast.tsx`, `UpdateLink.tsx`, `git-status.css`; `web/src/api/git.ts` (`GIT_MUTATION_KEY`,
  `useRunningGitOperation`, approved shared shape); `ElementFooter.tsx` (the `<update>` rich-text
  value of the copy-behind reason through a context, the focus moved to the reason or the first
  enabled action once the link is gone — D40-2); `session.ts` `watchFragmentToken` and one line in
  `main.tsx` (D40-7); seven sorted catalogue inserts and the declared value edit of
  `element.reason.copyBehind`. The full web suite passed on the first run (960 tests).
- **Deviation (found by the REQ-ARC-05 audit test, `e37658b`):** the first `useRunningGitOperation`
  filtered on TanStack's `status: 'pending'` with a justified inline lint disable; the audit test
  (`test/lint/methodology-literals.test.ts`) admits no literal beyond its two `open`s. The running
  mutation is now found by its state (submitted, no data, no error), no literal.
- **e2e** — `994cd49` (then fixes in the commits after it): `test/e2e/update-push.spec.ts` (15 tests),
  `submit-footer.spec.ts` G-13.2's sidebar assertion (RP-52), `shell.spec.ts` bug-016 (two tests),
  `support/remote.ts` (`fetchCopy`, `remoteHook`), the fifth `SCREENS` project (`behindCopy`, also in
  `no-commit.spec.ts`) and its entry. First Chromium run: two test errors, not product defects —
  the kanban fixture has no `README.md` (Y-05.3 now commits and pushes one first), and the held
  hook runs as a relative `hooks/pre-receive` (the cancel test now reads the hook's pid file). The
  *behind* screen waited for the reason's link, which the key-rendering build does not render
  (rich-text tags are dropped): it now waits for the reason's paragraph (`a6202dd`).
- **Guard removal on the bin (not committed):** with `watchFragmentToken()` removed from
  `main.tsx`, the actions forced off in `model.ts` and the `<update>` value rendering nothing,
  the e2e on Chromium (`update-push`, `shell` bug-016, `submit-footer` G-13.2): **14 failed, 4
  passed** — the four passing are the characterization scenarios classified at design (Y-05.2,
  Y-07.3, Y-08.1, G-12.3); bug-016's test failed on the lost-session page still shown after
  `page.goto` of the token URL (the browser did not reload: the bug reproduced). Restored.
- Docs — `1637701`: `docs/user-guide.md` 0.15, ux-reference 1.8 (§3 *Git status* with the D40-1
  deviation), spec-010 §4 declared residual and Process Note (D40-9, D40-11, D40-12),
  `00_conventions.md` 0.10 and Y-08.1 / `update.feature` header (D40-6, D40-8), the D40-8 wording in
  `03_is-isnot.md` 0.7, `05_journeys.md` 0.4, `06_features.md` 0.9, story map 0.6, `CHANGELOG.md`
  *Unreleased* (Added, Fixed), `test/README.md` 0.41, `playwright.timing.config.ts` header.

#### e2e closure

| Scenario | spec file › test |
|----------|------------------|
| Y-05.1 (TT-STATE-04 of task-033), Y-05.3 | `test/e2e/update-push.spec.ts` › "Y-05.1 — Update a copy that is behind", "Y-05.3 — Update with local changes that do not touch the incoming files" |
| Y-05.2 (TT-PERF-07 of task-034) | `update-push.spec.ts` › "Y-05.2 — Update automatically after a fetch" (`@live-refresh`: 15 s in `test:e2e`, 60 s / ≤ 65 s under `test:timing`) |
| Y-06.1, Y-06.2 (TT-STATE-04) | `update-push.spec.ts` › "Y-06.1 — Refuse to merge diverged histories", "Y-06.2 — Refuse an update that local changes are in the way of" |
| Y-07.1, Y-07.2 (TT-STATE-09 of task-030), Y-07.3 | `update-push.spec.ts` › "Y-07.1 — Push with the button", "Y-07.2 — Keep auto-push off by default", "Y-07.3 — Push automatically after a UI action" |
| Y-08.1, Y-08.2 | `update-push.spec.ts` › "Y-08.1 — Report a push rejected because the remote moved", "Y-08.2 — Report a push refused for permission" (redaction of git's text end to end; `elementFromPoint` at 1280×720, 600×720, 400×600) |
| G-12.1, G-12.2, G-12.3 (TT-STATE-04) | `update-push.spec.ts` › "G-12.1 — Block governed actions while behind", "G-12.2 — Unblock after the update", "G-12.3 — Do not block when the copy is only ahead" |
| G-13.2 sidebar step (RP-52) | `test/e2e/submit-footer.spec.ts` › "G-13.2 — Show the commit without \"pushed\" when auto-push is off" |
| Cancel of a push (RP-37) | `update-push.spec.ts` › "Push can be cancelled while it runs (RP-37, D40-4)" |
| keyboard (accessibility bar) | `update-push.spec.ts` › "Update and Push with the keyboard only, the focus kept (D40-4)" |
| bug-016 | `test/e2e/shell.spec.ts` › "bug-016 — a token pasted into an open tab starts the session without a reload", "a valid session keeps working when a wrong token arrives in the fragment" |
| X-06.4 / X-09.1 | `test/e2e/accessibility.spec.ts` › *git status — behind, Update in the sidebar and the footer* |

### checks (2026-10-17, HEAD before this note `a6202dd`)

Every heavy gate through the machine-free slot (`waitslot.sh`), load at the grant.

| Gate | Result | Load |
|------|--------|------|
| `npm run typecheck`, `npm run lint`, `npm run format:check` | clean | — |
| `npm run docs:api`, `check_tasks.py v0.2`, public-text check | OK | — |
| `npm run test:coverage` (on `a6202dd`) | 167 files passed, 1 skipped; **3086 passed / 1 skipped**; statements 96.48 %, branches 91.29 %, functions 97.12 %, lines 98.27 % (`web/src/repository` 99.13 %, `session.ts` 93.75 %) | 11.0 |
| `npm run test:e2e:chromium` (whole suite, on `e37658b`) | **304 passed, 1 failed** (11.3 min): the X-09.1 key-build check of the new screen (fixed in `a6202dd`, see above) | 8.9 |
| `npm run test:e2e -- update-push shell submit-footer git-status gate-footer accessibility no-commit` (three engines, on `e37658b`) | **426 passed, 3 failed** (13.6 min): the same X-09.1 screen on each engine | 4.0 |
| `npm run test:e2e -- accessibility.spec.ts` (three engines, on `a6202dd`) | **186 passed** (3.8 min) | 5.6 |
| `npm run test:timing` (first attempt skipped at load 12.08; run on `9c42838`) | **passed**: Vitest 6/6, Playwright 23/23 — Y-05.2 60.2 s from the remote commit to the copy's HEAD at it (budget 65 s, default 60 s interval), Y-02.1 59.7 s | 5.2 |
| `npm run test:smoke` | not run: no packaging, launcher or bin change | — |

No console of this worktree left running; no `wfui-*` entry in the system temporary directory.

### review round 1 (2026-10-17 – 2026-10-18)

Independent review **CHANGES REQUESTED** (R1 major, R2–R4 minor, R5–R6 nit); adversarial security
review **CHANGES REQUESTED** (minor only, S1–S7). Decided by the approver: S2 — a push goes on when
its project is left; S3 + S4 = bug-017 (ingested, absorbed into this task). Red tests first:
`2a45cc3` (server, 9 failures), `f6e9a1c` (web: the new tests and those importing the new
`resetGitOperations` failed to load). Because most web reds failed on the missing export, each fix
was also proved by removing its guard (each removal fails at least one test, then restored): R1 the
dismiss at the push's start, R1 the dismiss when nothing is left to push, R2 the update alert, R3
the "focus elsewhere" check, R3 the heading fallback, R4 the general hand-off, S2 the fetch-only
cancel on leaving, S5 the `ok` rule, S6 the one-probe guard; the server's `safeCut` likewise (its
test failed on a split `<project>`).

| Id | Change | Test |
|----|--------|------|
| R1 | `dismissToastKey(key)` appended to `web/src/shell/toasts.ts`; the push toast is raised and removed by the mutation itself (`useGitOperation`: `onMutate` removes `push:<pid>`, `onError` raises it — also after the sidebar is gone), and `GitStatus` removes it when nothing is left to push | `toasts.test.tsx` › dismissToastKey; `update-push.test.tsx` › R1 ×3 (fail → succeed, the copy no longer ahead, a cancel) |
| R2 = S1 | `useLastGitError(pid)` (the last transport of the project in the mutation cache, any starter); the alert is derived from it with the `alerts()` rule and cleared by the staleness rules (state recorded on the render that first shows it) | `update-push.test.tsx` › R2 (the link + 500 → sidebar alert) |
| R3 | the footer moves the focus after the link's update only when it is in the footer or nowhere; disarmed once the link is gone; no enabled target → the panel heading | `gate-footer.test.tsx` › R3 ×3 (refusal keeps the focus on the link — D40-2 characterization —, focus moved out left alone, heading fallback) |
| R4 | `GitStatus` tracks the focused sync control (focus/blur on the actions row); in an effect, when it is gone and the focus is on the body, Fetch takes it (Cancel → its transport's control) — whoever moved the state | `update-push.test.tsx` › R4 ×2 (a header change it did not start; a focus elsewhere kept) |
| S2 | `startGitOperation`, `cancelGitOperation`, `runningGitOperation`, `resetGitOperations` in `web/src/api/git.ts`: one transport per project with its `AbortController` outside any component and a synchronous guard; leaving a project cancels only a fetch | `update-push.test.tsx` › S2 ×2; e2e `update-push.spec.ts` › "S2 — a push goes on when its project is left, and completes" (switcher, no page load; red with the cancel-everything rule, `alive(pid)` false) |
| S3, S4 (bug-017) | `server/src/git/redact.ts`: after the path and userinfo redaction, every C0/C1 control except newline and tab and every bidi control becomes a visible escape (`\x1b`, `‮`); the cap keeps the head and the tail around a `…` line, never splitting an escape or a redaction token; the whole-path rule also accepts a control character after a path. spec-010 §4 text and Process Note, CHANGELOG *Fixed*, user guide | `test/server/git/redact.test.ts` › bug-017 (7); e2e Y-08.2 (the hook prints ESC, CR, U+202E and about 20 KB: visible escapes, no raw character, head and tail kept; red on the old `redact.ts`) |
| S5 | strip the fragment only on an OK answer; 401 reloads; anything else leaves it | `session.test.ts` › S5 |
| S6 | one probe at a time | `session.test.ts` › S6 |
| S7 | user guide: a cancelled push to a local remote can leave `objects/tmp_objdir-incoming-*` until `git gc` | — |
| R5 | `support/remote.ts` comment (the hook's pid file, not `pgrep`) | — |
| R6 | e2e: the footer's *Update* by keyboard, a refusal keeping its focus; `elementFromPoint` on Push, Fetch, the footer link and the sidebar Update under a sticky toast at 1280×720, 600×720, 400×600 | `update-push.spec.ts` › R6 ×2 |

Found while making the e2e pass (recorded, not product defects): a `page.goto` between projects is a
page load, which ends the push's request (the page's unload, by design): S2 and R6 switch with the
project switcher; git's side band starts a new `remote:` line at a carriage return (Y-08.2 asserts
the parts); a narrow open panel covers the sidebar by design (R6 checks the sidebar Update with the
panel closed); Y-08.2's toast, 4 000 characters tall, may cover the page as task-038 accepted for
tall sticky toasts — its Close stays on top (checked at 400×600), the controls are checked under a
short sticky toast in R6. Also: the `docs:api` warning on a link to an unexported symbol (comment
reworded, `144c052`); a test descriptor kind corrected after the red commit (`last`, typecheck).

Checks after review round 1 (HEAD before this note `144c052`; every heavy gate through the slot):
typecheck, lint, format:check clean; `docs:api` 0 warnings (after `144c052`); `check_tasks.py v0.2`
OK; public-text check passed; `test:coverage` **3109 passed / 1 skipped** (statements 96.49 %,
branches 91.29 %; load 2.3); `test:e2e:chromium` **308 passed** (10.9 min; load 11.2);
`npm run -s test:e2e -- update-push submit-footer shell git-status gate-footer accessibility
no-commit` (three engines) **438 passed** (13.7 min; load 7.5); `test:timing` **passed** — Vitest
6/6, Playwright 23/23, Y-05.2 59.7 s (budget 65 s), Y-02.1 59.6 s (granted at load 12.56, 1-min load
1.5–2.0 during the measured tests). No console left, no `wfui-*` entry.

### review round 2 (2026-10-18)

Independent review **CHANGES REQUESTED** (R2-1 … R2-4 minor, R2-5 … R2-7 nit); adversarial security
review **CHANGES REQUESTED** (minor only; push survival, the one-transport guard, the toast after
leaving, the footer alert, S5/S6 and neutralise + cap on push held). S2-1 absorbed into bug-017 by
the coordinator (main `e9cabc8`); S2-4 recorded as a follow-up, not in this task. Red tests first:
`b22e134` (server: 17 failures), `f5020fe` (web: 5 failures), the verbatim-style tests (`1615b12`,
the unit test first failed on its own file URL, fixed in `b25df2b`, then proved by
removing the `unicode-bidi` line: it fails, restored). The add and clone producer tests were also
proved by removing the sanitiser call in `project-list.ts` (both fail, restored). R2-4's "own
project keeps its wording" passed first: a characterization.

| Id | Change | Test |
|----|--------|------|
| R2-1 = S2-3 | the "Not pushed" toast is removed only when no commit is local (`ahead` 0) or a new push starts | `update-push.test.tsx` › R2-1 (diverged → toast kept) |
| R2-2 | the read an operation started from (state key, `lastSuccessAt`) is `onMutate`'s context, kept with the mutation (the footer's link too); the alert shows only while the header still matches it — no component state | `update-push.test.tsx` › R2-2 (refusal → state moves → unmount, remount → no alert) |
| R2-3 | a blur with no next element keeps tracking the control only if it was removed (checked in a microtask) | `update-push.test.tsx` › R2-3 |
| R2-4 | a push that fails while the page shows another project names it: `shell.git.pushFailedIn` "Not pushed — {project}: {count, plural, one {the commit stays} other {# commits stay}} local" (sorted insert; the singular is the coordinator's wording) | `update-push.test.tsx` › R2-4 ×2 |
| S2-1 (bug-017) | the project list's add and clone refusals go through `redactLocalPaths` (the home folder as `~`); `test/server/tool-messages.test.ts` enumerates every producer from the source (transport, auto-sync, auto-push, governed writes, CLI adapter, project list) and feeds the transport's and the adapter's a control/bidi marker; the add and clone routes in `projects.test.ts` (git writes an ESC as `?` itself; a control character in a clone URL is refused before git, 400) | `tool-messages.test.ts`, `projects.test.ts` › bug-017 ×2 |
| S2-2 | escapes by Unicode category (Cc, Cf, Cs, Zl, Zp but newline and tab; `\u{…}` beyond U+FFFF); the web shows `.verbatim` left to right with `unicode-bidi: bidi-override` | `redact.test.ts` › round 2 (11 code points, a lone surrogate, an emoji and U+034F kept); `error-text.test.tsx` (the rule); e2e Y-08.2 (computed style) |
| R2-5 = S2-5 | the cap never splits a surrogate pair; units matched from the start | `redact.test.ts` › surrogate pair, long escapes |
| R2-6 | CR LF → newline before escaping; the scheme-less userinfo rule accepts a control/format character as its left context | `redact.test.ts` › CRLF, userinfo after ESC / U+200E |
| S2-6 | `.verbatim` `overflow: hidden` (no server collapse of combining marks) | `error-text.test.tsx`, e2e Y-08.2 |
| S2-7 | a backslash is written `\\` first (documented in the `redact.ts` table); the literal-token residual stated in spec-010 §4 | `redact.test.ts` › backslash |
| S2-8 | the probe has a 10 s timeout (`probeTimeoutMs`), a timed-out probe leaves the fragment and frees the guard | `session.test.ts` › S2-8 |
| R2-7 | user guide 0.15 note names bug-017 | — |

Docs: spec-010 §4 text and Process Note (2026-10-18), the `redact.ts` doc table, `CHANGELOG.md`
bug-017 entry (add and clone, categories, backslash, left to right), user guide (escapes, the named
toast, when it goes). Versions kept (the coordinator's rule for round fixes).

Checks after review round 2 (HEAD before this note `b74e809`; every heavy gate through the slot as a
tracked background command): typecheck, lint, format:check clean; `docs:api` 0 warnings;
`check_tasks.py v0.2` OK; public-text check passed; `test:coverage` **3138 passed / 1 skipped**
(statements 96.51 %, branches 91.27 %; load 1.8); `test:e2e:chromium` **308 passed** (10.7 min;
granted at load 12.45); `npm run test:e2e -- update-push submit-footer shell git-status gate-footer
accessibility no-commit add-project` (three engines) **489 passed** (14.6 min; load 7.7);
`test:timing` **skipped** (load 18.3 after the suites; the round-1 run passed and no timed path
changed). No console left, no `wfui-*` entry.

### review round 3 (2026-10-18)

Independent review **CHANGES REQUESTED** (R3-1 minor, nits); adversarial security review **CHANGES
REQUESTED** (minor; push and clone held on three engines). Decided by the approver: every item under
bug-017 (bug notes extended on main, `8c78b52`); a branded `SafeToolMessage` type is a recorded
follow-up, not done here. Red tests first: `472b4e0` (server: 8 failures — the bound tests on the
missing export, the others on behaviour), `8c8aa68` (web: 5 failures; R3-4's key build passed first:
a characterization). Guard removal (each restored): without the `boundRaw` call the "bounded input
only" test fails (a 20 MB break-less run reached the output); without the cut's move to a break, that
test and the "no split token" test fail; the project list's sanitiser (round 2) as before; the wrap
e2e fails on Chromium with `overflow-wrap` removed from `.verbatim`. The first wrap assertion, in the
toast, passed without the rule (`.toast .verbatim` already wraps, task-038): the proof is the
Directives notice's block.

| Id | Change | Test |
|----|--------|------|
| S3-3 (regression of round 1) | `boundRaw` in `redact.ts`: before any transform, a text over 2 × 8 192 units keeps its first and last 8 192 code points around a `…` line, each cut moved to a break (line break, quote, control character) so no path or URL is left in two pieces (a run with no break is dropped whole) | `redact.test.ts` › round 3 (20 MB of ESC, astral flood, a break-less 20 MB line, a path at the cut) |
| S3-1 | CLI `warnings` through the adapter's `redact` (project root `<project>`, escapes); the Directives notice renders each warning as a `pre.verbatim` like the Memory list | `adapter.test.ts` (real CLI, a field with U+202E); `directives.test.tsx`; e2e `update-push.spec.ts` › S3-1, R3-1 (on the page's answer: the fixture's pinned CLI warns about no directive field) |
| S3-2 | `relativeToProject` (the one builder of `detail.files`, route and sync status) escapes each name; the web shows `{files}`, `{upstream}` and the branch in a `git-name` span (left to right, `bidi-override`); base names split on `/` only, so an escape's backslash is kept | `tool-messages.test.ts`; `error-text.test.tsx`; `update-push.test.tsx` › S3-2; `git-status.test.tsx` rows read the line's text |
| R3-3 / item 4 | the tripwire also follows `warnings: lines(` and `{ files: `, each producer listed with every sanitising call it needs; its limits written in its header | `tool-messages.test.ts` |
| S3-4 | scheme-less userinfo after `(`, `[`, `{`, `<`; both rules end only at ASCII white space, `/`, `?`, `#` (task-033's F11 row `[u:tok@host]` updated: now removed) | `redact.test.ts` › round 3 |
| R3-1 | `.verbatim` `overflow-wrap: anywhere` | `error-text.test.tsx`; e2e S3-1, R3-1 and Y-08.2 (`scrollWidth <= clientWidth`) |
| R3-2 | user guide and spec-010 §4: right-to-left words read reversed in these messages, U+200C / U+200D show as escapes | — |
| R3-4 | key build of `shell.git.pushFailedIn` | `update-push.test.tsx` › R3-4 |
| R3-5 | `onError` updates the operation's reference with the header cached at the error | `update-push.test.tsx` › R3-5 |

Docs: spec-010 §4 text and Process Note, the `redact.ts` table (the bound first), `CHANGELOG.md`
bug-017 entry (bounded input, CLI warnings, file names), user guide. Versions kept.

Checks after review round 3 (HEAD before this note `665c45a`; every heavy gate through the slot as a
tracked background command): typecheck, lint, format:check clean; `docs:api` 0 warnings;
`check_tasks.py v0.2` OK; public-text check passed; `test:coverage` **3152 passed / 1 skipped**
(statements 96.53 %, branches 91.33 %; load 3.4); `test:e2e:chromium` **308 passed** (10.7 min;
granted at load 11.9); `npm run test:e2e -- update-push submit-footer shell git-status gate-footer
accessibility no-commit add-project directives memory-list` (three engines) **564 passed** (18.8 min;
load 8.9); after the S3-1 e2e was rewritten, `update-push` and `directives` on the three engines
**69 passed** (load 1.9); `test:timing` **skipped** (load 20.1 after the suites; the round-1 run
passed and no timed path changed). No console left, no `wfui-*` entry.

### review round 4 (2026-10-18)

Independent review **PASS** (R4-1 minor non-blocking, R4-2 / R4-3 nits); adversarial security review
**CHANGES REQUESTED** (S4-1 minor, S4-2 … S4-4 nits; S3-3 measured at 38 ms / 118 MB for 60 M ESC).
Coordinator decisions: the raw bound cuts only at line breaks, with a fixed omission line (S4-2,
R4-1); the scheme-less userinfo rule's left context is a declared residual, no new heuristic (S4-3).
Red tests first: `8b0e3f9` (server: 5 failures), `906c72d` (web S4-4 and the e2e S4-1). Tests that
passed first and their guard removal (each restored): the URL-with-a-quote case at every offset —
with a head cut not moved to a line break, the new property "the transforms see whole lines only"
fails (the leak test alone passed: the cap removed the cut fragment); "one omission line" — with a
second `…` line added by the cap, it fails. On the bin: with `repositoryStatus` sending the raw
branch, S4-1 fails; with the message's wrapper removed, Y-06.2's flow check fails (its first form,
a top-offset check, passed with the defect and was replaced by the name's position in the flow).

| Id | Change | Test |
|----|--------|------|
| S4-1 | `repositoryStatus` (the one builder of the API's `repository`) sends `branch` and `upstream` escaped (`neutralise`); the server's git work (push target, branch config) reads the raw names from the state; no contract change (the schema's `string` holds the escaped text) | `test/server/git/repository-names.test.ts`; e2e `update-push.spec.ts` › S4-1 (a `feat‮gpj.exe` branch shows the escape as text) |
| S4-2, R4-1 | `boundParts`: whole lines only — the head up to the last line break in its window, the tail from the first line break in its window — and one omission line: `…`, or `… <N> characters without a line break omitted` (N in code points) when what is left out lies inside one line | `redact.test.ts` › round 4 (a 40 KB line → the marker, git's last line kept, the quote URL at every offset leaks nothing and the transforms see whole lines only) |
| R4-3 | the cap of a bounded text cuts its head and tail around the same omission line (`joinCapped`): one omission line in all | `redact.test.ts` › one omission line |
| S4-3 | declared residual in spec-010 §4, the `redact.ts` table and the user guide: after `=`, `,`, `;`, `|`, a tab inside the userinfo, or `?`/`#` in a password, a scheme-less userinfo may be kept | — |
| S4-4 | the git status's refusal line wraps its message in one span: one flex item, the quoted name inline | `update-push.test.tsx` › S4-4; e2e Y-06.2 (at 1280×720 and 400×600 the name starts where the text before it ends, or at a line start) |
| R4-2 | `directiveInForce`: comment that warnings are the sanitised text; an entry's path also compared as written there (`neutralise`), so a path with a backslash still names its entry | `tool-messages.test.ts` › directiveInForce |

Docs: spec-010 §4 text and Process Note, the `redact.ts` table, user guide; CHANGELOG unchanged (its
bug-017 entry already covers the bound). Versions kept.

Checks after review round 4 (HEAD before this note `afd05f4`; every heavy gate through the slot as a
tracked background command): typecheck, lint, format:check clean; `docs:api` 0 warnings (after
`24be520`); `check_tasks.py v0.2` OK; public-text check passed; `test:coverage` **3160 passed / 1
skipped** (statements 96.55 %, branches 91.35 %; load 2.6); `test:e2e:chromium` **310 passed** (11.0
min; granted at load 12.56); `npm run test:e2e -- update-push submit-footer shell git-status
gate-footer accessibility no-commit add-project directives memory-list` (three engines) **570
passed** (18.6 min; load 9.0); after the S4-4 e2e check was rewritten, `update-push` on the three
engines **60 passed** (load 4.4); `test:timing` **skipped** (load 17.9 after the suites; the round-1
run passed and no timed path changed). No console left, no `wfui-*` entry.

### review round 5 (2026-10-18)

Independent review **PASS**, adversarial security review **PASS**; three nits closed in
`server/src/git/redact.ts`, red tests first (`bad8ad4`: 3 failures; R5-3's first form passed — its
cuts never landed on a line boundary — and was widened to line lengths 60–130 before the commit),
fix `e99a836`:

- **R5-1** — when the final cap cuts a bounded text too, the omission line is the bare `…` (the
  count form would understate the cut). Test: 70 lines, 30 000 `Z`, 70 lines, `END`.
- **R5-2** — the CR of a CRLF at a cut is neither kept in the head nor counted in the omitted run.
  Test: `a\r\n` + 40 000 `Z` + `\r\nb` → `a\n… 40000 characters without a line break omitted\nb`.
- **R5-3** — a cap cut on a line boundary leaves no blank line next to the omission line. Test over
  line lengths 60–130.

Checks (coordinator's instruction: no heavy gate; the pre-submit gates follow the merge of `main`):
typecheck, lint, format:check clean; `docs:api` 0 warnings; `check_tasks.py v0.2` OK;
`npx vitest run test/server/git test/server/tool-messages.test.ts test/server/cli/adapter.test.ts`
10 files, **264 passed**.
