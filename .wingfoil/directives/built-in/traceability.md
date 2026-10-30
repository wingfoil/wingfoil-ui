---
id: traceability
name: traceability
type: directive
kind: built-in
format: 1
title: "Traceability"
---

# Traceability

Every change of WingFoil UI can be followed back to the decision it comes from.

- Each element names, in its Context, the element it comes from: the decision, the plan, the
  request.
- Each decision-log names what it changes.
- The project, or a pack it adopts, names its own chain (for example decision → plan → task); this
  rule asks that the chain exist and be kept, not what its links are.
- A rule taken from another project's element cites that element's id.
