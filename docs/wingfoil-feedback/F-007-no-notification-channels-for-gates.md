---
id: F-007
title: "No notification channels for pending gates"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-07.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. `wingfoil --help` and `wingfoil workflow --help` ("there is no
workflow engine yet") show no command that reports or notifies a pending gate. A member who must
approve something learns it only by reading the elements' states.

WingFoil already has an element on the subject: `spec-017` §5.3 (v0.3: pending gates in the CLI
output only; git-hook notifications moved to v0.4).

## Expected

External notification channels for pending gates, beyond the CLI output of `workflow status` and
`workflow next`. Wanted after v1.0; until then a client shows in-app notifications.

Suggested kind in WingFoil: an extension of spec-017 §5.3.
