---
id: cli-only-writes
name: "Every governed change goes through the WingFoil CLI"
type: directive
kind: custom
title: "Every governed change goes through the WingFoil CLI"
tags: [custom, architecture, wingfoil, security]
---

# Directive — Every governed change goes through the WingFoil CLI

**Version:** 1.1 · **Date:** 2026-10-01 (1.1: write classes, snapshot, CLI choice — vision session 7)

Applies to whoever designs, writes or reviews the WingFoil UI server and its use of a WingFoil
project (draft ADR: `docs/00_reference/adr-draft-local-server.md`).

## The rule

1. **Writes — four classes, nothing else** (`docs/01_vision/02_product-vision.md`, *Write classes*):
   - (a) **governed** changes: **only by invoking the project's own `wingfoil` CLI** (`--format
     json`, in the project's working directory) — `wf(…)` commits. The server never writes
     `.wingfoil/` files, Memory element files or plans directly — not even to fill a draft — and
     never re-implements a state machine, gate, role check or id allocation;
   - (b) **UI configuration**: `.wingfoil/ui.yaml` only, schema-validated before writing, behind the
     `cfg.ui` permission, one `chore(ui): …` commit touching only that file;
   - (c) **git transport**: fetch, `pull --ff-only`, push — never merge, rebase or a new commit;
   - (d) **repository files** (after v1.0): specified when the feature is.
   **Which CLI:** the observed project's own (its pinned `node_modules/wingfoil`, else the PATH),
   never a copy bundled with the UI.
2. **Reads:** through the CLI. Git is read directly only for what the CLI does not expose (HEAD,
   ahead/behind, log, working tree for the Files view) and is **never** used to change WingFoil
   state.
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
- e2e-smoke: after driving the UI, every commit in the fixture's `git log` is a `wf(…)` commit made
  by the CLI or a `chore(ui)` commit whose only file is `.wingfoil/ui.yaml`; actions on an element
  with local changes, and while behind, are refused.
