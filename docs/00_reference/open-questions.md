# Open questions

To be resolved during `lean-inception` / `specification-downcast`.

1. **Packaging** — `npx wingfoil-ui`, a `wingfoil ui` subcommand, or a desktop wrapper later?
2. ~~**Which WingFoil version is the floor** — 0.3 (workflow engine) or 1.0?~~
   → 0.2.2 for the first waves, 1.0 for UI v1.0, per-feature floor with capability detection —
   `docs/01_vision/02_product-vision.md` (Key Decisions); per-wave confirmation in session 5.
3. **Multiple working copies** — can the same remote be added twice with different working
   directories (e.g. two branches)?
4. **Remote sync** — should the UI fetch/pull automatically, and how does it show a working
   copy that is behind or has local changes?
5. ~~**Unregistered users** — read-only access when the git email is not in `dna.team`, or a
   guided "add me to the team" flow (itself a governed change)?~~
   → Read-only with a "not in team" badge and a *How to join* panel; no guided flow in the MVP —
   `docs/01_vision/04_personas.md` (persona Riley, Key Decisions).
6. **Agent launch** — the UI starts `agent execute`; where is the agent's output shown
   (terminal, UI log, IDE)?
7. **`ui.yaml` defaults** — ship presets per methodology template (Scrum, Kanban, custom
   like WingFoil's `sw-life-cycle`)?
8. **Completion %** — is the average of per-reference completion the right definition, or
   should references be weighted (e.g. by story points)?
9. **Documentation index** — only `paths.docs`, or also Memory element files?
10. ~~**Accessibility and i18n** — UI language(s) for the MVP.~~
    → WCAG 2.1 AA; English-only MVP with externalised strings — `02_product-vision.md` (Key Decisions).
11. ~~**Permissions before WingFoil enforces them** — is a UI-only check acceptable for the MVP, given it is not
    a security boundary (the CLI can still be used directly)?~~
    → Yes, as advisory and labelled so; gates stay enforced by the CLI — `02_product-vision.md` (Key Decisions).
12. **File editing scope** — which files may be edited from the UI (all, or not `.wingfoil/`
    and Memory files, which have their own governed paths)?
