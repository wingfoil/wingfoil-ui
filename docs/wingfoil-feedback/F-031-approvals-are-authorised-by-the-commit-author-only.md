---
id: F-031
title: "An approval is authorised by git's author identity only, which any process can set: no signed approval commits"
kind: request
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-39.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`,
with two team members: `probe@example.invalid` (`developer`, `approver`) and `dev@example.invalid`
(`developer` only). A task is submitted to `pending`; the repository's `user.email` is the
developer's:

```
$ wingfoil memory approve task-004-authored --reason ok --format json
{"error":"user not authorized to approve type 'task'"}
[exit 1]
$ GIT_AUTHOR_NAME=Probe GIT_AUTHOR_EMAIL=probe@example.invalid wingfoil memory approve task-004-authored --reason ok --format json
{"id":"task-004-authored","path":"docs/memory/task/task-004-authored.md","from":"pending","to":"approved"}
[exit 0]
$ git log -1 --format='author=%an <%ae> committer=%cn <%ce> sig=%G?'
author=Probe <probe@example.invalid> committer=Dev <dev@example.invalid> sig=N
```

The identity WingFoil authorises is git's author identity, resolved as `git commit` does
(`GIT_AUTHOR_*`, then `author.*`, then `user.*`; `dist/core/git-identity.js`); the committer and any
signature play no part, and `memory approve --help` names no signing option. WingFoil adr-006 states
this limit ("Attribution is only as strong as local git configuration", no cryptographic identity
proof) and leaves commit signing for later. In a project where AI agents run the CLI, an agent — or
a prompt injected into its context — that sets these variables approves as the approver; a separate
git identity for agents prevents approvals made by mistake, not a deliberate override.

## Expected

An opt-in that makes approval authority verifiable:

- a setting (e.g. in `dna.yaml`, per role or per gate) requiring approval commits (`approve`,
  `reject`, `amend`, and any commit carrying `Approver:`) to be signed (`git commit -S`: GPG, SSH or
  X.509), with each approver's public key or allowed-signers entry declared next to the member;
- `memory approve` / `reject` signing the commit and refusing when the signer is not an approver
  member;
- the verification exposed to consumers — `memory history` reporting the signature status of each
  approval, and the governance check F-030 asks for refusing an unsigned or
  wrongly-signed approval, so CI enforces it on every push.

Suggested kind in WingFoil: decision-log (an extension of adr-006).
