---
id: definition-of-done
name: definition-of-done
type: directive
kind: custom
title: "Definition of Done of WingFoil UI"
tags: [custom, scrum, testing, review]
---

# Directive — Definition of Done of WingFoil UI

**Version:** 1.0 · **Date:** 2026-10-30 (1.0: replaces `methodology/scrum`'s generic
`definition-of-done` with this repository's, at the packs' adoption —
governance-alignment-rel-v0.3-plan step 3)

A Sprint Backlog item (a task, run through `backlog-item`) is done only when every rule below
holds; until then it is not part of the Increment. The rules are the gates of this repository's
`dev-loop` procedure (`.wingfoil/workflows/custom/dev-loop.yaml`), which a developer follows inside
`backlog-item` › `build`:

- **Test-first.** Each acceptance criterion is classified red-first or characterization in the
  task's Execution Notes; a red-first criterion has a test that failed before the code and passes
  after it.
- **Specs before code.** Every file format, schema or module API the task implements has an
  `approved` tech-spec; the Execution Notes of every `depends_on` task were read first.
- **Checks green** on the task's branch, as `CLAUDE.md` *Checks before handing work back* lists
  them: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (or
  `test:coverage`, statements at least 80 %), `npm run docs:api`; when the UI changes,
  `npm run test:e2e:chromium` and the task's own specs on the three engines; the launch and
  publish smokes when packaging, the launcher, the bin or the publish workflow change.
- **Reviewed** by an independent reviewer, not the author, until PASS; the approver then approves
  the task (`backlog-item` › `approve`).
- **Integrated:** merged into its phase branch with `git merge --no-ff`, its worktree and branch
  removed, the bugs it names in `bug:` moved with it (their transitions are the approver's, directive
  `wingfoil-cli`).
- **Documented:** the user-facing and agent-facing docs it changes are updated in the same change
  (directive `documentation`); its Execution Notes record the gates' results with their commands.
