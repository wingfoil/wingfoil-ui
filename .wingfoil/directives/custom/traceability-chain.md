---
id: traceability-chain
name: traceability-chain
type: directive
kind: custom
title: "The traceability chain of WingFoil UI"
tags: [custom, traceability, requirements]
---

# Directive — The traceability chain of WingFoil UI

**Version:** 1.0 · **Date:** 2026-11-02 (1.0: the chain the `base` pack's `traceability` asks the
project to name, written at the packs adoption — governance-alignment-rel-v0.3-plan step 3, review
round 1, m3)

The `base` pack's `traceability` directive (built-in, kept as it is) asks that the chain exist and be
kept, and leaves its links to the project. This repository's chain, kept across every change:

- **Product:** feature (`S1`, `T4`, …, `docs/01_vision/06_features.md`) → user story (`US-…`,
  `docs/02_requirements/01_user_story_map/`) → acceptance scenario (`S-28.1`, `T-04.2`, … in
  `docs/02_requirements/02_bdd/features/`) → requirement (`REQ-…`, `TT-…`,
  `docs/02_requirements/03_sard/`) → task (`docs/04_memory/<release>/`, its `ref` and Acceptance
  Criteria) → test (titled with the scenario or requirement id).
- **Decisions:** decision-log or ADR → the plan that applies it → task; a tech-spec names the
  requirements it serves and is cited by the tasks that implement it.

A reviewer reports a missing link as a finding; a task, spec or plan names the elements it comes
from in its Context.
