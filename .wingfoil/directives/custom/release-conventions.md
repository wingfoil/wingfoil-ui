---
id: release-conventions
name: release-conventions
type: directive
kind: custom
title: "Release conventions of WingFoil UI"
tags: [custom, release, git, npm]
---

# Directive — Release conventions of WingFoil UI

**Version:** 1.7 · **Date:** 2026-11-05 (1.0: dl-008's tailoring of `release-submit`,
`release-publishing` and `retrospective`, re-applied on the `software` and `base` packs' workflows
at their adoption — governance-alignment-rel-v0.3-plan step 3; 1.1: `mark-released` is the
approver's `approve`, the retrospective's inventory in its plan — GA3-11 R-1, R-5; 1.2: when the
approver approves a release and a release line, bound to the facilitator too — review round 1 of the
packs adoption, A-1, A-2, M1; 1.3: the steps of the former `user-docs` and `e2e-smoke` procedures in
`pre-release-checks`, `test:timing`, the seeding of a line from the former `initial-design` —
task-049; 1.4: review round 1 of task-049: the identity paragraph back above *Seeding a line*, the
line's plan `delivery-seed-rl-vN-plan`, `check_tasks.py` in `pre-release-checks`, the
`memory add --type … --title` form; 1.5: *Governance checks* — the plan version, the closed bug's
`release`, the release `sprint` rule of `check_releases.py`, task-051; 1.6: the agents' own git identity in the identity paragraph —
task-050; 1.7: that identity's reach, the paths that still act as the approver — its review
round 1)

The packs' release workflows (`release-submit`, `release-publishing`, `.wingfoil/workflows/built-in/`)
name what each phase does, not how this repository does it. This directive says how; the pipeline
and the approver's steps are in `docs/publishing.md`.

## `release-submit`

- **`pre-release-checks`** (qa), on `main` once the release's tasks are merged:
  - every task of the release is `done` (`python3 docs/03_backlog/X_tools/check_tasks.py vX.Y`
    passes on them);
  - every bug of the release is `resolved` or `closed` — a bug belongs to the release when its
    `release` is the release's version, or when its `release` is empty and its `release-origin` is
    that version (this repository's bugs carry those fields, no release tag);
  - **user docs** (developer; dl-013, a hard release blocker): `README.md`, `docs/user-guide.md`,
    `docs/cli-reference.md` and `CHANGELOG.md` aligned with the release's shipped surface, and
    `docs/publishing.md` checked for consistency; nothing of a later release described as shipped;
  - **agent docs** (architect; dl-025, a check of its own): the `CLAUDE.md` project status matches
    the shipped surface (`CHANGELOG.md`); the tables of `.wingfoil/README.md` match `memory.yaml`
    (types, states, gates), `workflows.yaml` (the workflows) and `roles.yaml` (the bindings);
  - **the e2e smoke** — the black-box release gate (in place of WingFoil's CLI smoke, its
    dl-023), **hard-reject**: a failed step blocks the release (green since v0.1, ES-7). Its steps:
    - `fixture-project`: the fixtures are made with the pinned CLI by the builder of
      `test/harness/fixtures/` (`kanban`, `custom`, `unknown` — types and states with no
      `ui.yaml` —, `scrum`, `large`; checked by `test/harness/fixtures.test.ts`) and cover every
      element state the release's screens show;
    - `drive-browser`: `npm run test:e2e` (Chromium, Firefox, WebKit) — the read views render the
      fixture's state; every write from the UI is the CLI's `wf(…)` commit or a `chore(ui)` commit
      touching only `.wingfoil/ui.yaml` (`no-commit.spec.ts`, `commit-provenance.spec.ts`); actions
      are refused on an element with local changes and while behind; reviewer and product-owner
      with and without the approver;
    - `local-security`: loopback only, the session token, the Origin and Host checks, no path
      outside the repository (`test/launcher/local-security.test.ts` and the guard suites);
    - `accessibility`: zero serious or critical axe-core violations on every screen in scope, in
      both themes, and the keyboard path of each gate action (`test/e2e/accessibility.spec.ts`);
    - `contract`: `npm run test:contract` for every WingFoil version of `contracts/matrix.json`;
    - `launch`: `npm run test:smoke` — the packed app installed as a user would, started, serving
      the UI;
    - `gate`: the results, with their commands, in the `release-submit` plan; the approver decides
      at `approve-release`;
  - `npm run test:coverage` green (statements at least 80 %), `npm run test:e2e` on Chromium,
    Firefox and WebKit, `npm run test:smoke`; `npm audit --omit=dev` reports 0 vulnerabilities;
  - `npm run test:timing` run alone through the machine-free slot, whatever the diff since its
    last run, its load recorded (dl-009 action 6).
- **`enter-releasing`** (tech-lead): `memory submit <release>` (`in-development → releasing`).
- **`approve-release`** (approver): the approver's OK, recorded in the run's plan and, when the
  release runs on the workflow engine, by `workflow finalize --step <the step key workflow next
  prints, e.g. release-submit.approve-release@release:minor-v0.3> --reason "…"`. **Never `memory
  approve` on the release here:** `releasing` is a gate, and its approve moves the release to
  `released` at once — the publication steps would be skipped (probe of the packs adoption's review,
  round 1). The console and `workflow status` offer that Approve as soon as the release is
  `releasing`; ignore it until `mark-released`.

## `release-publishing`

- **`release-commit`** (tech-lead), on `main`: `chore(release): v{package.version}` — the version
  `X.Y.0` for a minor `vX.Y`, `X.Y.Z` for a patch `vX.Y.Z`, in the root and workspace
  `package.json` files and the lockfile; the CHANGELOG section with the tag date; the project status
  in `CLAUDE.md`. (dl-008 placed it before the checks, in `release-submit`; the `software` pack
  places it here, after the approval: the commit changes only versions and docs, and the rehearsal
  below runs on it.)
- **`staging-rehearsal`** (qa), on the release commit: `npm run test:publish-smoke` (the pipeline's
  `stage`, run locally: `docs/publishing.md` *Local staging smoke*); optionally the pipeline's dry
  run (`workflow_dispatch`, `gate` and `stage`, which never promotes). Nothing is made public.
- **`tag`** (tech-lead): the annotated tag `v{package.version}` on `main`, on the release commit or
  on a later `main` commit that changes only governance or docs files — never on a phase branch.
  Pushing it starts `.github/workflows/publish.yml`, and needs the approver's OK.
- **`publish`** (tech-lead; approval by the approver): the tag run's `gate` and `stage` pass, the
  approver approves the `promote` deployment and runs `npm stage approve` (`docs/publishing.md`
  *Every release*); then `npm view wingfoil-ui@X.Y.Z version` answers the version. An agent never
  publishes or configures the registry.
- **`mark-released`** (tech-lead prepares, the approver decides): `releasing` is a gate in this
  repository (`memory.yaml`, GA3-11 R-1, a deviation from `software`, whose phase moves the release
  with `element.set_state(released)`): `memory submit` from `releasing` is refused, and the approver
  runs `memory approve <release> --reason "…"` once `publish`'s post-check answered — the only
  moment a release is approved. The tech-lead hands the approver that exact command, with the `npm
  view` output.

## The release line

`release-line` `active` is a gate in this repository (GA3-11 R-2): the approver closes a line with
`memory approve rl-vN --reason "…"` only at the end of the line — when every release of the line is
`released` and the next line, if any, is planned (the line's closing step, formerly
`release-line-cycle` › `plan-next-release-line`), and after the agent docs of `pre-release-checks`
were checked again against the line's last configuration (dl-025). The console offers that Approve
for the whole life of the line; ignore it until then.

The CLI authorises `memory approve` by git's author identity (`wingfoil-cli` W-39). Claude Code
sessions whose working directory is in this repository, on the approver's machine, commit under an
identity of their own once the approver has written it (the Claude Code `env` of the main
checkout's git-ignored `.claude/settings.local.json`; task-050), so an approval of a release or a
line run by mistake in such a session is refused (`user not authorized to approve type '…'`).
Another agent tool, a cloud session, another machine or a missing file gets no agent identity, and
the desktop app's terminal panel and a browser on the approver's console act as the approver:
there only the process rule holds. The release's and the line's approvals are the approver's
commands, run from the approver's terminal or from a console the approver started. A process that
sets the identity variables deliberately still approves as any member: "an agent never approves"
stays a process rule.

### Seeding a line

Once a line is approved (`memory approve rl-vN`, `planning → active`) and before its first
`sprint-planning`, the line is seeded, once per line, in the line's phase plan
`delivery-seed-rl-vN-plan` (`workflow: delivery`, `phase: seed-rl-vN`, `scope: rl-vN`): a sub
workflow, so the plan opens no run and `workflow next` keeps answering the current one; a plan
naming the main `sw-life-cycle` would open a second run, even in `draft` (probe of task-049,
W0-6; `release-planning` › *Where it runs*). Each action is a `memory add`, the draft filled by
hand, then the verbs (`wingfoil-cli` W-01):

- **seed-releases** (product-owner): one `release` per planned minor — `memory add --type release
  --title "…" --set kind=minor --set version=vX.Y --set release-line=vN` — with the fields
  `memory.yaml` requires (`sprint` before its submit); the releases stay `draft` until their
  planning (`release-planning`).
  Stop-check: `python3 docs/03_backlog/X_tools/check_releases.py`.
- **seed-adrs** (architect, optional): the ADRs the roadmap implies — the *Spec review* of
  `release-planning`, `memory submit`, the approver's approve.
- **seed-dls** (architect, optional): the product and process decision-logs — `memory submit`
  (`→ in-discussion`), the approver's approve (`→ ready`).
- **seed-specs** (architect, optional): the shared file formats, schemas, constant sets and module
  APIs the whole line implies (the roadmap and the configuration), each one not yet covered by an
  approved spec — the *Spec review*, `memory submit`, the approver's approve. A release's
  `identify-specs` then covers only what is left.

## `retrospective`

- **`explore`**: the friction inventory — every point grouped by theme and citing its source
  (an element's Execution Notes, a plan's Session log, a review round) — is written in the
  retrospective's own plan under `docs/05_plans/` (`retrospective_path` is `docs/05_plans/`, GA3-11
  R-5). That directory always holds files, so the step's evidence is always met: the inventory in
  the plan is what shows the step done; a retrospective with none is not.
- **`capture`**: a decision-log with the type's `dl-{n}-{slug}` id, added with
  `--tags retrospective` (`retrospective` › `approve` selects it by that tag), titled
  `Retrospective <release or Sprint>`.

## Governance checks

Three rules of the governance files are checked by tests of the default suite (task-051), so a
break fails `npm test` instead of waiting for a review. Each is written for a project on the
current WingFoil from its start; what failed only because of this repository's history was fixed
on its elements, not by loosening the rule (the approver, task-051 Q1).

- **Plan version** (dl-011, dl-006 action 6; `test/governance/plan-versions.test.ts`): every file
  under `docs/05_plans/` is a plan whose frontmatter `version` equals the first token of the
  Context `**Version:**` line — bump both together. A plan with neither (a plan made by
  `workflow start` left as its template made it) is versioned by git alone and passes; one without
  the other fails. The test's commented `EXEMPT` list holds the four closed plans of v0.1 with no
  Context version line; nothing is added to it for a new plan.
- **Closed bug's `release`** (dl-009 action 7; `test/governance/bug-releases.test.ts`): a `closed`
  bug carries the release that fixed it — set at triage for a fix in a later release, stamped at
  the absorption into a task, by a hand commit of that field alone (`memory amend` refuses
  `release`, `wingfoil-cli` W-01). A bug closed by a reject (a non-empty `rejection_reason`) was not
  fixed and is outside the rule.
- **Release `sprint`** (`docs/03_backlog/X_tools/check_releases.py`, the stop-check of *Seeding a
  line*; `test/governance/check-releases.test.ts`): every required field of the `release` type is
  set, except where the type's `template.frontmatter.exempt` in `.wingfoil/memory.yaml` names the
  release (read from there, never copied), and a `draft` may have no `sprint` (no Sprint selects
  it yet; WingFoil checks it at `memory submit`).
