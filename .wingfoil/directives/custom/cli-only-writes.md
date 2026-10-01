---
id: cli-only-writes
name: "Every governed change goes through the WingFoil CLI"
type: directive
kind: custom
title: "Every governed change goes through the WingFoil CLI"
tags: [custom, architecture, wingfoil, security]
---

# Directive — Every governed change goes through the WingFoil CLI

**Version:** 1.0 · **Date:** 2026-10-01

Applies to whoever designs, writes or reviews the WingFoil UI server and its use of a WingFoil
project (draft ADR: `docs/00_reference/adr-draft-local-server.md`).

## The rule

1. **Writes:** the server changes a WingFoil project's state **only by invoking its `wingfoil`
   CLI** (`--format json`, in the project's working directory). It never writes `.wingfoil/`
   files, Memory element files or plans directly, and never re-implements a state machine, gate,
   role check or id allocation.
2. **Reads:** through the CLI. Git is read directly only for what the CLI does not expose (HEAD,
   ahead/behind, log, working tree for the Files view) and is **never** used to change WingFoil
   state.
3. **One file of its own:** the UI owns `.wingfoil/ui.yaml` and nothing else in `.wingfoil/`.
4. **Missing verb ⇒ read-only:** when the CLI has no verb for an operation (e.g. editing element
   fields, closing a plan, editing workflows), the UI shows it read-only until the pinned WingFoil
   provides one — no workaround that writes files.
5. **Identity** is the project's git identity, as for the CLI; the UI adds no login.

## How it is checked

- Review: no `fs.write*` / `git commit` / `git add` on governed paths in `server/`.
- e2e-smoke: after driving the UI, `git log` of the fixture shows only `wf(…)` commits made by the
  CLI.
