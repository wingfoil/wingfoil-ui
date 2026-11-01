# Custom fixture governance for WingFoil 0.2.2

**Version:** 1.1 · **Date:** 2026-11-01 (1.0: frozen at the packs adoption —
governance-alignment-rel-v0.3-plan step 3, decision 16 of
`docs/wingfoil-adoption/rel-v0.3-packs-adoption-design.md`; 1.1: its `memory.yaml` is also the
variant *the custom fixture with the pre-packs states*)

`.wingfoil/` here is this repository's own `.wingfoil/` as of commit `93d2933`, before the adoption
of the wingfoil-templates packs. The `custom` fixture (`builder.ts`, `importGovernance`) imports it
for a WingFoil CLI older than 0.3.0, and the live `.wingfoil/` of the repository for 0.3.0 and later:
WingFoil 0.2.2 refuses the packs' workflows (`workflow list`: `E_VALIDATION phases.0.produces.0 …
expected string, received object`, the `{ type, path }` form of `produces`), and the packs' range
is `>=0.3.0`. Never edit it to follow the live configuration: it is the governance a 0.2.2 project
of this shape has.

Its `memory.yaml` alone is also the variant *the custom fixture with the pre-packs states*
(`usePrePacksStates`, `02_bdd/00_conventions.md`): on any CLI, the live fixture with this file's
`waiting:` states, for S-24.2, S-24.4, T-04.2 and T-11.2.
