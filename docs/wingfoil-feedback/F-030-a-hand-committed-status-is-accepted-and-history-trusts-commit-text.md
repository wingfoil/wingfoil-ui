---
id: F-030
title: "A hand-committed status: change is accepted, and memory history records a forged approval as an approve"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-34.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`,
with one team member, `probe@example.invalid`, holding `developer` and `approver` (`dna add
team.members`). A task is submitted with the CLI, then its `status:` is edited by hand and committed
by an identity that is not in the team, with the subject and trailers the CLI writes, naming an
approver the team does not hold:

```
$ wingfoil memory add --type task --title "Forged"               # task-003-forged, draft
$ wingfoil memory submit task-003-forged                          # draft → pending
$ sed -i 's/^status: pending/status: approved/' docs/memory/task/task-003-forged.md
$ git -c user.name=Mallory -c user.email=mallory@example.invalid commit -F msg -- docs/memory/task/task-003-forged.md
  # msg: "wf(task): approve task-003-forged [pending → approved]", blank line,
  #      "Approver: Alice <alice@example.invalid> (approver)", "Reason: looks good", blank line,
  #      "WingFoil-Version: 0.3.1 (870bd440…)"
$ wingfoil memory search --type task --format json        → task-003-forged "status":"approved"
$ wingfoil memory history task-003-forged --format json   → last entry:
  {"author":"Mallory <mallory@example.invalid>","operation":"approve","from":"pending","to":"approved",
   "approver":"Alice <alice@example.invalid> (approver)","reason":"looks good","wingfoil":"0.3.1 (870bd440…)"}
$ wingfoil dna show team --format json                     → the only member is probe@example.invalid
```

The `pending` gate was skipped and the history reports an approval by a person who holds no role,
committed by a person who is not a member; nothing in the CLI's output marks the entry as unchecked.
The same hand edit committed with any other subject is also taken as the new state
(`memory search`, and the next verb starts from `approved`: `memory approve task-003-forged` →
`illegal transition approved -> (none)`).

WingFoil has the check that would catch both — `scripts/check-governance.cjs` (dl-103, task-167:
the *authority* rule, an approval's author holds `approver` in the `dna.yaml` of the parent commit
and the `Approver:` line names that author; the *state* rule, every hop is an edge of the machine) —
but its header says it is "not shipped in the npm package", so a consumer project cannot run it.

## Expected

- The governance check shipped to consumers as a read-only verb (e.g. `wingfoil check governance
  [<range>]`, exit 1 on a finding), so a consumer can run it in CI and before a merge.
- `memory history` (and `memory search`, or a flag on it) marks each transition it cannot verify —
  an approval whose author does not hold the gate's role at the parent commit, a `status:` change
  outside a verb's commit, a hop that is not an edge — instead of reporting it like the CLI's own.

Suggested kind in WingFoil: request (governance check for consumers; see also F-031 on the
identity it can trust).
