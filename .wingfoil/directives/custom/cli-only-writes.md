---
id: cli-only-writes
name: "Every governed change goes through the WingFoil CLI"
type: directive
kind: custom
title: "Every governed change goes through the WingFoil CLI"
tags: [custom, architecture, wingfoil, security]
---

# Directive — Every governed change goes through the WingFoil CLI

**Version:** 1.4 · **Date:** 2026-10-02 (1.1: write classes, snapshot, CLI choice — vision session 7; 1.2: no UI-side permission on `ui.yaml` — specification session 3; 1.3: clone in class (c), check scoped to UI commits — specification session 6; 1.4: read allow-list where the CLI has no read verb — initial-design session 5)

Applies to whoever designs, writes or reviews the WingFoil UI server and its use of a WingFoil
project (draft ADR: `docs/00_reference/adr-draft-local-server.md`).

## The rule

1. **Writes — four classes, nothing else** (`docs/01_vision/02_product-vision.md`, *Write classes*):
   - (a) **governed** changes: **only by invoking the project's own `wingfoil` CLI** (`--format
     json`, in the project's working directory) — `wf(…)` commits. The server never writes
     `.wingfoil/` files, Memory element files or plans directly — not even to fill a draft — and
     never re-implements a state machine, gate, role check or id allocation;
   - (b) **UI configuration**: `.wingfoil/ui.yaml` only, schema-validated before writing, by any team
     member, one `chore(ui): …` commit touching only that file;
   - (c) **git transport**: `clone` into a new, empty folder, fetch, `pull --ff-only`, push — never
     merge, rebase or a new commit;
   - (d) **repository files** (after v1.0): specified when the feature is.
   **Which CLI:** the observed project's own (its pinned `node_modules/wingfoil`, else the PATH),
   never a copy bundled with the UI.
2. **Reads:** through the CLI wherever it exposes the data. What the pinned CLI does not expose is
   read **directly, read-only, from a closed allow-list** until WingFoil provides a read verb
   (SARD REQ-ARC-04): `.wingfoil/memory.yaml` (type definitions), Memory element files and directive
   files at the `path` the CLI returns — each shape schema-checked in `contracts/`. Git is read
   directly only for what the CLI does not expose (HEAD, ahead/behind, log, working tree for the
   Files view) and is **never** used to change WingFoil state.
3. **One file of its own:** the UI owns `.wingfoil/ui.yaml` and nothing else in `.wingfoil/`.
4. **No action over someone's local work:** a governed action is refused while its target element
   has uncommitted changes (the CLI would commit them with the action) or while the copy is behind
   its remote.
5. **Missing verb ⇒ read-only:** when the CLI has no verb for an operation (e.g. editing element
   fields, closing a plan, editing workflows), the UI shows it read-only until the pinned WingFoil
   provides one — no workaround that writes files.
6. **Identity** is the project's git identity, as for the CLI; the UI adds no login.

## How it is checked

- Review: no `fs.write*` / `git commit` / `git add` on governed paths in `server/`.
- Unit (fs spy, REQ-ARC-04): direct reads of WingFoil files only from the allow-list, 0 writes.
- e2e-smoke: every commit **created while driving the UI** (the fixture's set-up commits excluded) is
  a `wf(…)` commit made by the CLI or a `chore(ui)` commit whose only file is `.wingfoil/ui.yaml`; actions on an element
  with local changes, and while behind, are refused.
