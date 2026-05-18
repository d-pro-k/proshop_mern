# design-system/

Source of truth for the ProShop M4 design system.

## Files

- `tokens.json` — machine-readable tokens (~50 entries, `--ff-*` namespace).
  The schema groups tokens by category (color.foundations, color.sidebar, …,
  storefront, typography). Used by:
  - **Ext A** (UI reviewer agent) to audit code against canonical values.
  - **Ext B** (pixel-perfect verify) as the reference for diff reporting.
  - Future M5/M6 migration scripts.
- `globals.css` — canonical CSS variables. Identical to
  `frontend/src/styles/design-tokens.css` (manual mirror — see Sync rule).

## Sync rule

`design-system/globals.css` is **canonical** at the design-system level.
`frontend/src/styles/design-tokens.css` is a **runtime mirror** because CRA 3.4.3
webpack ModuleScopePlugin blocks `@import` from outside `frontend/src/`. To
change any token:

1. Edit `design-system/tokens.json` (the data).
2. Edit `design-system/globals.css` (the CSS form — same value, same line).
3. Edit `frontend/src/styles/design-tokens.css` (the runtime mirror).
4. Commit all three together — atomic update.

The selection-mode pattern (one section at a time) makes this trivial:
you touch three single-line edits, never the full file. See
`assignments/M4/plan/ext-c-selection-mode.md` for the full pattern.

## Why hybrid D, not shadcn

M4 uses hybrid D (CSS Modules + native HTML + `--ff-` tokens) instead of
shadcn/Tailwind. The pivot happened on 2026-05-16 after a Tailwind+Radix
reset. See `assignments/M4/plan/part2-hybrid-d-decision.md` for context.
Tokens here use direct hex / rgba values, NOT `hsl(var())` composition,
because CRA 3.4.3 has resolve issues with composition.

M5/M6 will migrate the whole stack to Tailwind + shadcn — at that point
the `hsl(var())` composition becomes safe and this directory becomes the
single CSS source (no more mirror file).
