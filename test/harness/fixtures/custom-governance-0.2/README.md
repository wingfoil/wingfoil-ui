# Custom fixture governance for WingFoil 0.2.2

**Version:** 1.0 · **Date:** 2026-11-01 (1.0: frozen at the packs adoption —
governance-alignment-rel-v0.3-plan step 3, decision 16 of
`docs/wingfoil-adoption/rel-v0.3-packs-adoption-design.md`)

`.wingfoil/` here is this repository's own `.wingfoil/` as of commit `93d2933`, before the adoption
of the wingfoil-templates packs. The `custom` fixture (`builder.ts`, `importGovernance`) imports it
for a WingFoil CLI older than 0.3.0, and the live `.wingfoil/` of the repository for 0.3.0 and later:
WingFoil 0.2.2 refuses the packs' workflows (`workflow list`: `E_VALIDATION phases.0.produces.0 …
expected string, received object`, the `{ type, path }` form of `produces`), and the packs' range
is `>=0.3.0`. Never edit it to follow the live configuration: it is the governance a 0.2.2 project
of this shape has.
