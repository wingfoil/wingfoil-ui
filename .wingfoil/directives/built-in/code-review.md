---
id: code-review
name: "Code Review"
type: directive
kind: built-in
title: "Code Review"
tags: [built-in, code-review]
ref: [P3.8]
---

# Directive — Code Review

Applies to reviewers and to whoever holds approval authority.

- Check every change for correctness, tests that are present and passing, adherence to the other directives, and the absence of secrets.
- Verify the change satisfies the acceptance criteria of the task it implements.
- Verify claims by running the command that settles them; do not accept a statement about a file or test without checking it.
- Every finding is either fixed in the change or recorded as a tracked element (a bug or a decision-log); never leave a finding only in review notes.
- Approve or reject with a recorded reason; a rejection states what must change before resubmitting.
- Approval authority belongs to a role, not to a person; AI agents never approve their own work.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/code-review.md` with `id: code-review`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
