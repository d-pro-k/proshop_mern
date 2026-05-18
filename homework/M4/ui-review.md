# UI Review Report — 2026-05-18

Run via `.claude/agents/ui-reviewer.md` (MODE=review), executed on Opus.

Scope:
- `frontend/src/screens/admin/` — all `.jsx` and `.module.css` files (FeatureFlagsScreen, UserListScreen, ProductListScreen, OrderListScreen).
- `frontend/src/screens/storefront/` — all `.jsx` and `.module.css` files (HomeScreen, ProductCard, ProductCarousel, CartScreen, CartItem, ProductScreen).
- `frontend/src/components/icons.jsx`.
- `frontend/src/components/{Header,Footer,SearchBox}.module.css` (and the matching `.js` files for context).

Reference documents read: `DESIGN.md`, `design-system/tokens.json`, `design-system/globals.css`, `frontend/src/styles/design-tokens.css`.

---

## Findings

### Critical

- `frontend/src/screens/admin/ProductListScreen.module.css:255` — Hardcoded hex `background: #0284C7` on `.btnPrimary:hover` — Reason: hex color outside `design-system/` and `design-tokens.css`; `--ff-accent-hover` already exists for exactly this value (the file's own header comment on line 7 flags this as a cleanup target). — Recommendation: replace with `background: var(--ff-accent-hover);`.
- `frontend/src/screens/admin/FeatureFlagsScreen.module.css:670` — Hardcoded hex `background: #FAFBFC` on `.rowDisabled` — Reason: hex color outside the design system; no matching token (sits between `--ff-bg #FFFFFF` and slate-50). — Recommendation: either reuse `--ff-row-head-bg` (#F8FAFC) or add a new token (e.g. `--ff-row-disabled-bg`) and reference it.
- `frontend/src/components/Header.module.css:88` — Hardcoded hex `background: #F1F5F9 !important` on `:global(.dropdown-item:hover), :global(.dropdown-item:focus-visible)` — Reason: hex color outside the design system; value is identical to existing tokens `--ff-row-border` / `--ff-status-disabled-bg` / `--ff-skeleton-bg` / `--ff-role-customer-bg`. — Recommendation: introduce a semantic alias such as `--ff-dropdown-item-hover-bg` (or reuse `--ff-row-border`) and reference it.
- `frontend/src/screens/admin/ProductListScreen.module.css:648` — Hardcoded `box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15)` on `.modalPanel` — Reason: raw rgba literal outside the design system; no `--ff-modal-shadow` (or equivalent) token; the same shadow is duplicated in two other modules. — Recommendation: add a shared `--ff-modal-shadow` token and reference it from all three modal panels.
- `frontend/src/screens/admin/UserListScreen.module.css:696` — Hardcoded `box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15)` on `.modalPanel` — same issue and fix as ProductListScreen above.
- `frontend/src/screens/admin/FeatureFlagsScreen.module.css:639` — Hardcoded `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2)` on `.toggleKnob` — Reason: raw rgba literal outside the design system; no matching elevation token. — Recommendation: introduce `--ff-toggle-knob-shadow` (or a general `--ff-shadow-xs`) token.
- `frontend/src/components/SearchBox.module.css:7` — Hardcoded `background: rgba(255, 255, 255, 0.10) !important` on `.input` — Reason: raw rgba literal outside the design system; value matches `--ff-sidebar-hover-bg`. — Recommendation: replace with `background: var(--ff-sidebar-hover-bg) !important;`.
- `frontend/src/components/SearchBox.module.css:24` — Hardcoded `background: rgba(255, 255, 255, 0.16) !important` on `.input:focus` — Reason: raw rgba literal outside the design system; no matching token (0.16 is novel). — Recommendation: add a `--ff-search-input-focus-bg` token (or reuse `--ff-sidebar-active-bg` which is `rgba(255,255,255,0.10)` if the existing visual contrast is acceptable).
- `frontend/src/components/SearchBox.module.css:34` — Hardcoded `color: #fff !important` on `.button` — Reason: hex literal outside the design system; value matches `--ff-sidebar-text-strong`. — Recommendation: replace with `color: var(--ff-sidebar-text-strong) !important;`.
- `frontend/src/components/SearchBox.module.css:48` — Hardcoded `color: #fff !important` on `.button:hover, .button:focus` — same issue and fix as line 34.

### Major

- `frontend/src/screens/admin/ProductListScreen.module.css:88,120,242,297` (and analogues at the same line numbers in `UserListScreen.module.css`, `OrderListScreen.module.css`, `FeatureFlagsScreen.module.css`) — Off-grid `padding: 7px 12px` (and 7px on the y-axis in toolbar inputs/selects, sort triggers, and primary button). — Reason: 7px is not on the 8-px half-step grid (allowed: 0/2/4/6/8/12/16/24…). — Recommendation: round to `padding: 6px 12px` or `padding: 8px 12px` consistently; mirror the change everywhere `7px` is used so density stays uniform.
- `frontend/src/screens/admin/OrderListScreen.module.css:313`, `ProductListScreen.module.css:297`, `UserListScreen.module.css:317`, `FeatureFlagsScreen.module.css:315` — Off-grid `padding: 7px 36px 7px 32px` on view-tab/select controls. — Reason: 7px and 36px are off-grid (36 is not in 0/4/8/12/16/24/32/48). — Recommendation: normalise to `padding: 8px 32px 8px 32px` (or 6px / 8px depending on chosen density step); 36px right-padding likely accommodates a caret — keep room but align (e.g. 32px).
- `frontend/src/screens/admin/FeatureFlagsScreen.module.css:545` — Off-grid `padding: 9px 16px` on `.flagCard` — Reason: 9px is not on the half-step grid. — Recommendation: use `8px 16px` or `12px 16px`.
- `frontend/src/screens/admin/FeatureFlagsScreen.module.css:531,551` — Off-grid `padding-top: 14px` / `padding-top: 9px`. — Reason: 14px and 9px off-grid. — Recommendation: use 12px or 16px (and 8px or 12px) respectively.
- `frontend/src/components/Header.module.css:12-13` — Off-grid `padding-top/bottom: 14px` on `.navbar`. — Reason: 14px not on grid; chrome surface should align with the surrounding admin rhythm (12 / 16). — Recommendation: switch to 12px or 16px.
- `frontend/src/components/Header.module.css:35` — `padding: 8px 14px !important` on `.navbar .nav-link`. — Reason: 14px off-grid. — Recommendation: 12px or 16px on the x-axis.
- `frontend/src/components/SearchBox.module.css:13,39` — `padding: 7px 12px !important` and `padding: 7px 16px !important`. — Reason: 7px off-grid. — Recommendation: 8px (or 6px) y-axis so SearchBox visually aligns with Header chrome.
- `frontend/src/screens/admin/OrderListScreen.module.css:460,476`, `ProductListScreen.module.css:448`, `UserListScreen.module.css:467`, `FeatureFlagsScreen.module.css:495` — `padding: 14px 8px` / `padding: 14px 16px` on table `th/td` cells. — Reason: 14px off-grid. — Recommendation: use 12px or 16px.
- `frontend/src/screens/admin/OrderListScreen.module.css:677`, `ProductListScreen.module.css:745`, `UserListScreen.module.css:795`, `FeatureFlagsScreen.module.css:793` — `gap: 5px` on small pill clusters. — Reason: 5px off-grid. — Recommendation: 4px or 6px.
- `frontend/src/screens/admin/OrderListScreen.module.css:710`, `UserListScreen.module.css:829`, `FeatureFlagsScreen.module.css:828` — `padding: 7px 28px 7px 10px` inside mobile breakpoint (28px and 10px also off-grid). — Reason: multiple off-grid values. — Recommendation: realign (e.g. `8px 32px 8px 12px`).
- `frontend/src/screens/storefront/CartScreen.module.css:262`, `HomeScreen.module.css:242` — `padding: 56px 16px` on mobile empty/error states. — Reason: 56px off-grid (allowed values jump 48 → 64). — Recommendation: use 48px or 64px.
- `frontend/src/screens/admin/UserListScreen.jsx:240`, `OrderListScreen.jsx:206`, `FeatureFlagsScreen.jsx:206`, `ProductListScreen.jsx:236` — Inline `style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}` on empty-state icon wrappers. — Reason: layout-affecting inline styles bypass the CSS Modules pattern (the design system places all styling in `.module.css`). The value `12` is not catastrophic, but the pattern is duplicated four times. — Recommendation: extract a shared `.emptyIconWrap` class (already half-implemented via `.empty` parent) and remove the inline style.
- `frontend/src/screens/admin/FeatureFlagsScreen.jsx:209` — Inline `style={{ fontWeight: 500, marginBottom: 4, color: 'var(--ff-fg)' }}` on the empty-state title. — Reason: inline style mixes typography + color + spacing; should live in CSS Modules for consistency with the other three admin screens (which use `s.emptyTitle`). — Recommendation: extract to `s.emptyTitle` (or reuse the existing class from the sibling screens).
- `frontend/src/screens/admin/FeatureFlagsScreen.jsx:212` — Inline `style={{ fontSize: 13 }}` on empty-state description. — Reason: same as above. — Recommendation: extract to `s.emptyDesc`.
- `frontend/src/screens/admin/ProductListScreen.jsx:450` — Inline `style={{ marginBottom: 16 }}` on the page-level error alert. — Reason: spacing should live in CSS Modules; the same alert pattern in the other admin screens uses a `.errorAlert` class with built-in margin. — Recommendation: move the 16-px margin into `.errorAlert` (or a variant class) in `ProductListScreen.module.css`.

### Minor

- `frontend/src/screens/admin/UserListScreen.jsx:213`, `OrderListScreen.jsx:179`, `FeatureFlagsScreen.jsx:180`, `ProductListScreen.jsx:209` — Inline `style={{ opacity: 1 - i * 0.08 }}` on skeleton rows. — Reason: dynamic computed value; not easily expressible in a static class. Acceptable but worth noting as the only inline-style pattern shared across all four admin screens. — Recommendation: no action (computed at runtime).
- `frontend/src/screens/admin/UserListScreen.jsx:241`, `OrderListScreen.jsx:207`, `FeatureFlagsScreen.jsx:207`, `ProductListScreen.jsx:237` — Inline `style={{ opacity: 0.3 }}` on empty-state icon. — Reason: trivial opacity, but inline; folding into a shared `.emptyIcon` class would be cleaner. — Recommendation: optional cleanup along with the layout inline-style consolidation above.
- Border-radius values across admin and storefront modules (`2px`, `4px`, `6px`, `8px`, `12px`, `50%`, `999px`) form a consistent ad-hoc scale but are not tokenised. — Reason: `tokens.json` only defines `--ff-product-card-radius` (12px); no `--ff-radius-sm/md/lg/full`. `DESIGN.md`'s `--radius` family is referenced by the audit rules but the active `--ff-` token set has not formalised it yet. — Recommendation: add `--ff-radius-sm: 4px; --ff-radius-md: 6px; --ff-radius-lg: 8px; --ff-radius-pill: 999px;` to `tokens.json` + `design-tokens.css` and substitute throughout.
- `frontend/src/components/Footer.js:10` and `frontend/src/components/Header.js:30,33,48` — Bootstrap utility classes (`text-center py-3`, `ml-auto`) and FontAwesome glyphs (`fas fa-shopping-cart`, `fas fa-user`) still present in chrome JS. — Reason: outside the strict critical-rule scope (which targets `.jsx` under `screens/admin/` and `screens/storefront/`); `Header.module.css` contains a header comment indicating chrome structure was intentionally not modified in the recent redesign. — Recommendation: a future chrome rewrite is the natural place to remove these references.
- `frontend/src/screens/admin/ProductListScreen.module.css:7` — Header comment still reads "hover uses inline #0284C7" even though `--ff-accent-hover` now exists in `design-tokens.css`. — Reason: stale comment that will mislead future readers. — Recommendation: update the comment when the Critical fix on line 255 lands.
- `frontend/src/components/SearchBox.module.css:19` — `color: var(--ff-sidebar-section-label)` on `.input::placeholder` followed by `opacity: 1` on the next line. — Reason: `--ff-sidebar-section-label` is `rgba(255,255,255,0.45)` — using it on a placeholder layered over a 10 %-white background may push contrast below 3:1 (likely fails APCA / WCAG SC 1.4.11). — Recommendation: spot-check contrast; if it fails, use `--ff-sidebar-text` (0.72 alpha) for the placeholder.

## Summary

- Critical: 10 | Major: 15 | Minor: 6
- Files audited:
  - `frontend/src/screens/admin/FeatureFlagsScreen.jsx`, `FeatureFlagsScreen.module.css`
  - `frontend/src/screens/admin/UserListScreen.jsx`, `UserListScreen.module.css`
  - `frontend/src/screens/admin/ProductListScreen.jsx`, `ProductListScreen.module.css`
  - `frontend/src/screens/admin/OrderListScreen.jsx`, `OrderListScreen.module.css`
  - `frontend/src/screens/storefront/HomeScreen.jsx`, `HomeScreen.module.css`
  - `frontend/src/screens/storefront/ProductCard.jsx`, `ProductCard.module.css`
  - `frontend/src/screens/storefront/ProductCarousel.jsx`, `ProductCarousel.module.css`
  - `frontend/src/screens/storefront/CartScreen.jsx`, `CartScreen.module.css`
  - `frontend/src/screens/storefront/CartItem.jsx`, `CartItem.module.css`
  - `frontend/src/screens/storefront/ProductScreen.jsx`, `ProductScreen.module.css`
  - `frontend/src/components/icons.jsx`
  - `frontend/src/components/Header.module.css` (+ `Header.js` for context)
  - `frontend/src/components/Footer.module.css` (+ `Footer.js` for context)
  - `frontend/src/components/SearchBox.module.css` (+ `SearchBox.js` for context)
- Storefront CSS modules (`HomeScreen`, `ProductCard`, `ProductCarousel`, `CartScreen`, `CartItem`, `ProductScreen`) contain zero hardcoded color literals — every color goes through a `--ff-*` token.
- All scoped `.jsx` files use ARIA labels on icon-only buttons, `role=switch` on the toggle, `htmlFor`/`id` on the qty select, and `aria-live` on result counts. No accessibility regressions found.
- No `Inter` font references anywhere in scope. `--ff-font-sans` (Geist) is used consistently.
- No `react-bootstrap` imports in any of the scoped `screens/admin/*.jsx` or `screens/storefront/*.jsx` files.
- Suggested follow-up: the 10 Critical hardcoded-color findings are mechanical token substitutions plus 2–4 new token additions (`--ff-modal-shadow`, `--ff-toggle-knob-shadow`, optionally `--ff-dropdown-item-hover-bg` and `--ff-search-input-focus-bg`). The Major off-grid spacing findings show a consistent pattern across all admin modules (`7px` y-padding on toolbar controls, `14px` on table cells, `5px` pill gaps) and may reflect a deliberate density choice; they can be addressed together as a single density sweep if alignment to the 8-px grid is desired. Minor items are non-blocking.
