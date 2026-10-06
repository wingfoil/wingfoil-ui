---
id: spec-009-theme-tokens
type: tech-spec
title: "Theme tokens"
status: approved
scope: "UI theme tokens: CSS custom properties, light and dark values, theme selection, contrast pairs"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

REQ-ARC-11 and X3 require light and dark themes that follow `prefers-color-scheme` (v0.1) and can
be forced in the UI settings (v0.2), both meeting AA contrast; REQ-ARC-10 requires focus
indicators of at least 3:1. `adr-002` picks CSS custom properties. The prototype
(`ux-reference.md` §9) defines a light palette only, and spec-003 §7 names the state tones. One
token set is needed before the first screen is built, so that every component uses the same
names and the contrast of both themes is proved once, by a table, not per screen.
Identified by `release-planning` v0.1 (`identify-specs`).

## Specification

### 1. Files and selection

- `web/src/theme/tokens.css` defines every token on `:root[data-theme="light"]` and
  `:root[data-theme="dark"]`, and `color-scheme: light` / `dark` respectively.
- An inline script in `index.html`, run before the first paint, sets `data-theme` from
  `matchMedia("(prefers-color-scheme: dark)")` and listens to its `change` event, so the theme
  follows the system without a reload (X-08.1, X-08.2). From v0.2 the UI setting `Theme`
  (`System` | `Light` | `Dark`, spec-006 `settings`) overrides it (X-08.3).
- Components use **only** the semantic tokens below — no colour literal outside `tokens.css`
  (checked, §5).

### 2. Tokens

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-bg` | `#FFFFFF` | `#0B1424` | page background |
| `--color-surface` | `#F5F7FA` | `#111C30` | panels, drawer, sidebar |
| `--color-surface-2` | `#EEF1F5` | `#18253D` | hovered rows, inputs |
| `--color-divider` | `#E3E8EF` | `#24324A` | decorative separators (no contrast requirement) |
| `--color-control-border` | `#6B7890` | `#6A7C9C` | input and control outlines (≥ 3:1, WCAG 1.4.11) |
| `--color-text` | `#081532` | `#E6ECF5` | body text |
| `--color-text-2` | `#3B4A63` | `#B8C3D4` | secondary text |
| `--color-text-muted` | `#5C6880` | `#94A2B8` | metadata, captions |
| `--color-primary` | `#0C469F` | `#7DB2F7` | links, primary buttons |
| `--color-on-primary` | `#FFFFFF` | `#0B1424` | text on a primary button |
| `--color-focus` | `#1686C8` | `#4DB3EA` | focus ring |
| `--color-danger` | `#B42318` | `#FF8A80` | errors, destructive actions |
| `--color-on-danger` | `#FFFFFF` | `#0B1424` | text on a destructive button |
| `--tone-human-bg` / `-fg` | `#FFF3DC` / `#8A5A00` | `#3A2A0A` / `#F5C76B` | gate states (spec-003 §7) |
| `--tone-active-bg` / `-fg` | `#E3F0FB` / `#0C469F` | `#12305A` / `#A9CCFF` | work states |
| `--tone-done-bg` / `-fg` | `#E2F6F1` / `#0B6B5C` | `#0E3A33` / `#6FDCC8` | last / off-sequence states |
| `--tone-neutral-bg` / `-fg` | `#EEF1F5` / `#4A5568` | `#1E2A3F` / `#C3CDDC` | first / waiting states |
| `--tone-attention-bg` / `-fg` | `#FDECEC` / `#B42318` | `#3D1416` / `#FFA39C` | undeclared states |
| `--tone-muted-bg` / `-fg` | `#F5F7FA` / `#5C6880` | `#111C30` / `#94A2B8` | archived states |
| `--brand-gradient` | `#22CEC6 → #1686C8 → #0C469F` | same | decorative only, never behind text |

Non-colour tokens: `--font-sans: "Geist", system-ui, sans-serif`; `--font-mono: "Geist Mono",
ui-monospace, monospace` (fonts self-hosted as woff2 in the web build — the console works
offline, no font CDN); `--focus-ring: 2px solid var(--color-focus)` with `outline-offset: 2px`;
`--shadow-popover` (decorative, no text on it: light `0 12px 32px rgba(8,21,50,0.12)`, dark
`0 12px 32px rgba(0,0,0,0.45)`) for menus, popovers and dialogs;
`--color-backdrop` (decorative, no text on it: light `rgba(8, 21, 50, 0.45)`, dark
`rgba(0, 0, 0, 0.6)`) behind a modal;
spacing and radius scales are left to the shell task. Placeholders use `--color-text-muted`;
disabled controls keep their text colour at reduced emphasis only through `--color-text-muted`
(no opacity on text).

A tone is never the only carrier of meaning: the state name is always written (WCAG 1.4.1).

### 3. Contrast pairs (computed, WCAG 2.1 relative luminance)

| Pair (minimum over bg, surface, surface-2 unless stated) | Light | Dark | Bar |
|------|-------|------|-----|
| text | 15.92 | 12.89 | 4.5 |
| text-2 | 7.90 | 8.60 | 4.5 |
| text-muted | 4.94 | 5.92 | 4.5 |
| primary | 7.74 | 6.99 | 4.5 |
| danger | 5.80 | 6.71 | 4.5 |
| on-primary / primary | 8.77 | 8.40 | 4.5 |
| on-danger / danger | 6.57 | 8.07 | 4.5 |
| each tone fg / its own bg (minimum of the six tones) | 5.22 | 6.58 | 4.5 |
| focus | 3.51 | 6.53 | 3.0 |
| control-border | 3.93 | 3.62 | 3.0 |

Figures are truncated to 2 decimals (lower bounds). The unit test of §5 recomputes every pair
from `tokens.css` and fails below the **Bar** column; the figures are informational.

### 4. Deviations from the prototype

- Muted text `#6B7890` (prototype) is 4.45:1 on white and 4.15:1 on `#F5F7FA` — below AA. It
  becomes `--color-control-border` (non-text, ≥ 3:1) and muted text uses `#5C6880`.
- `#8A96A8` (prototype, secondary labels) is 2.99:1 on white (below 3:1): used for no text.
- The prototype has no dark palette: the dark values above are new.
Recorded as deviations under directive `ux-consistency`.

### 5. Verification

- Unit: parse `tokens.css`, compute every pair of §3 in both themes, fail below the bar.
- Lint/check: no hex, `rgb()` or `hsl()` literal in `web/src` outside `tokens.css`.
- e2e: X-08.1, X-08.2 (and X-08.3 from v0.2); axe-core in both themes on every screen of the
  release (REQ-ARC-10, REQ-ARC-11: 0 serious/critical).

## Consequences

- Components are themed by construction; a new colour is a new token with both values and its
  pairs added to the test.
- The v0.2 theme setting only changes how `data-theme` is chosen.
- `docs/00_reference/ux-reference.md` §9 is updated with these values, citing this spec
  (directive `ux-consistency`): muted text `#5C6880`, `#6B7890` as control border, the dark
  palette, the attention and muted tones.

## Process Notes

- 2026-10-03 — identified by `release-planning` v0.1 (`identify-specs`, plan session 2) at the
  user's request. Contrast ratios computed with the WCAG 2.1 formula during the session (the light
  muted text of the prototype fails AA, §4).
- 2026-10-03 — independent spec review (plan session 2): F11 table truncated, the test checks the
  bar; F12 2.99:1; F13 `ux-reference.md` §9 updated; F20 `--color-on-danger`, placeholders and
  disabled text.
- 2026-10-03 — re-verification (plan session 2): N1 on-primary row truncated.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan): §2 decorative token
  `--shadow-popover` for menus, popovers and dialogs; decided by the user.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan, independent review): §2 decorative token
  `--color-backdrop` behind a modal (W3-13); decided by the user.
