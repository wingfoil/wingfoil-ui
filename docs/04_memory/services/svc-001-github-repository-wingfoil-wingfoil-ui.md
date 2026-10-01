---
id: svc-001-github-repository-wingfoil-wingfoil-ui
type: service
title: "GitHub repository wingfoil/wingfoil-ui"
status: pending
provider: "GitHub"         # REQUIRED — who hosts it, e.g. "GitHub", "npmjs.com"
kind: "setting"         # REQUIRED — account | credential | listing | setting | domain | handle
owner_role: "tech-lead"         # REQUIRED — the dna.yaml role that manages it: a role, never a person
verify: "gh api repos/wingfoil/wingfoil-ui --jq '{full_name,visibility,private,default_branch,description,license:.license.spdx_id,has_issues,has_wiki}'"         # REQUIRED — the read-only command or URL that establishes its current state, e.g. "gh repo view wingfoil/wingfoil-ui"
url: "https://github.com/wingfoil/wingfoil-ui"             # optional — its public URL, if any
account: "wingfoil"         # optional — the public identifier used (a login, an org name); never a secret
renews: ""             # optional — ISO date on which it expires or must be renewed; "" if never
repo_refs: []          # optional — repository paths that depend on it, e.g. ["package.json"]
decision: ""           # optional — the decision-log or ADR that motivated it
release: ""            # optional — the release in which it was set up, e.g. "v0.2"
tmpl_version: 260929   # Original template version
---

<!-- SECURITY RULE (directive security-secrets):
     a service element NEVER holds a secret value — no token, password, recovery code or key, and no
     fragment of one. Name where the secret is held (e.g. "GitHub Actions secret <NAME>, environment
     <env>"), its type, its expiry and how it is rotated. -->

## Purpose

The canonical remote of this repository: `origin` = `git@github.com:wingfoil/wingfoil-ui.git`,
default branch `main`. It holds the governed history (every `wf(…)` commit) shared between the
team and agents; without it the project exists only in one working copy. It is also where the
future release tags and (if decided at inception) the publishing pipeline live.

## Configuration

- Owner: the GitHub organisation `wingfoil` (the same that owns `wingfoil/wingfoil`).
- Visibility: **private** (created private on 2026-10-01; whether and when it goes public is an
  open decision, to settle no later than the first release).
- Default branch: `main`; first push 2026-10-01 from the bootstrap (`BOOTSTRAP.md` §1–4).
- Description: "Local web UI for WingFoil-governed projects, served by a local server that drives
  the wingfoil CLI."
- License detected by GitHub: MIT (from `LICENSE`).
- Features: issues on, wiki off. Merge methods: merge commit, squash and rebase all allowed;
  `delete_branch_on_merge` off. The git conventions (`--ff=false` merges of phase branches,
  `sw-life-cycle.yaml`) are not enforced by GitHub.
- Branch protection: **not available** — GitHub answers 403 ("Upgrade to GitHub Pro or make this
  repository public") for a private repository on the current plan, so `main` is unprotected.
- No secrets, environments or Actions are configured yet.

## Verification

Run `verify` (read-only). Expected result as of 2026-10-01:

```json
{"default_branch":"main","description":"Local web UI for WingFoil-governed projects, served by a local server that drives the wingfoil CLI.","full_name":"wingfoil/wingfoil-ui","has_issues":true,"has_wiki":false,"license":"MIT","private":true,"visibility":"private"}
```

And `git -C <repo> remote get-url origin` prints `git@github.com:wingfoil/wingfoil-ui.git`.

## Management

- Access is managed through the `wingfoil` organisation's members/teams; the tech-lead grants and
  revokes it. No deploy keys or tokens are held for this repository.
- Changing visibility, default branch or merge settings is a governed change: record the reason
  (decision-log) and update this element.
- Retirement: `memory deprecate` with the reason (e.g. repository moved or archived).
