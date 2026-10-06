# WingFoil UI

Local web UI for [WingFoil](https://github.com/wingfoil/wingfoil)-governed projects, served by a
local server that drives the `wingfoil` CLI.

> Status: inception. This repository is governed by WingFoil (`.wingfoil/`); the product brief
> is in [`docs/01_vision/01_product-brief.md`](docs/01_vision/01_product-brief.md) and the
> bootstrap steps in [`BOOTSTRAP.md`](BOOTSTRAP.md).

| Path | Content |
|------|---------|
| `docs/01_vision/` | Product brief (input of `lean-inception`) |
| `docs/00_reference/` | UX reference, prototype, ADR draft, open questions |
| `.wingfoil/` | WingFoil configuration; `directives/custom/wingfoil-cli.md` lists the known behaviours of the pinned CLI |

License: MIT.

## Supported WingFoil versions

Each project runs its own pinned `wingfoil` (or, when it pins none, the one on the `PATH`). This
release supports **0.2.2 to 0.2.x**: from the declared minimum (`min` of `contracts/matrix.json`)
to the release line of the highest contract-tested version (adr-001 D3); a pre-release only when
the matrix lists it. A project outside the range, or whose `wingfoil --version` is not a semantic
version, opens read-only with the range in the reason.

Support matrix (contract-tested versions): `0.2.2`.

Capabilities (`contracts/capabilities.json`): a capability is read-only below its minimum version
and hidden when a project condition it needs does not hold.

| Capability | Minimum WingFoil | Provided by |
|------------|------------------|-------------|
| Type definitions | 0.2.2 | direct read of `.wingfoil/memory.yaml` |
| Element content | 0.2.2 | direct read of the element file |
| Directive body | 0.2.2 | direct read of the directive file |
| Gate decision | 0.2.2 | `memory approve` / `memory reject` |
| Workflow position | 0.3.0 | `workflow status` (WingFoil 0.3) |
| Next workflow step | 0.3.0 | `workflow next` (WingFoil 0.3) |
| Workflow start | 0.3.0 | `workflow start` (WingFoil 0.3) |
| Agent launch | 0.3.0 | `agent execute` (WingFoil 0.3) |
| Field editing | not released | a field-editing verb of a later WingFoil |
