---
id: claim-evidence
name: "A claim names the command that establishes it"
type: directive
kind: custom
title: "A claim names the command that establishes it"
tags: [custom, determinism, documentation, review]
---

# Directive — A claim names the command that establishes it

**Version:** 1.0 · **Date:** 2026-10-01

Global. Adapted from the WingFoil repository's `claim-evidence` directive.

## The rule

**A sentence that asserts a fact about the code, the UI or the WingFoil CLI names the command that
establishes it, and is true when written.** If you did not run something that settles it, say what
you expect instead and mark it unverified.

Claims that need a command, in practice:

- **Behaviour of the UI** — "the Today view shows pending gates", "the approve dialog keeps the
  reason on error": name the Playwright test (or the manual steps run, with the browser).
- **Behaviour of the WingFoil CLI** — "`memory submit` takes no `--reason`", "the JSON of
  `memory search` has field X": name the `npm run -s wingfoil -- …` command and the pinned version.
  Known surprises go in the `wingfoil-cli` directive.
- **Contracts** — "the server parses every field the UI shows": name the contract test.
- **Accessibility** — "the screen is accessible": name the axe scan and the keyboard path walked.
- **Absence, uniqueness, status** — "nothing else writes `.wingfoil/`", "the suite is green":
  `grep -rn`, the test command, and what it printed — including when it printed nothing.

## How a claim is recorded

In acceptance criteria, bug fields, review comments, commit bodies and docs: the claim, then the
command (and, where useful, its output or exit code). A claim that turns out wrong is corrected in
place and, if it misled a decision, noted in that element's Execution Notes.
