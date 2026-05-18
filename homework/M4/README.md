# M4 — proshop_mern visual layer

> Overview to be filled in Task 5.1.

## Component decisions

The Feature Flags Dashboard at `/admin/feature-flags` is built without a component library. shadcn/ui plus Tailwind was tried first and abandoned — utility classes did not apply reliably inside the existing Bootstrap shell, and Radix primitives ship as ESM `.mjs` which CRA 3.4.3 + webpack 4 cannot resolve without ejecting. The Bootstrap component set (`Form.Check`, `Form.Range`, `Table`) was rejected too: its markup is tightly coupled to Bootstrap classes and would have to be rewritten anyway during the planned M5/M6 migration to Tailwind.

The page therefore uses **CSS Modules + design tokens + native HTML**:

- `frontend/src/styles/design-tokens.css` — ~20 CSS custom properties prefixed `--ff-` (a subset of `DESIGN.md`, direct hex values to avoid CRA 3.x `hsl(var())` resolve issues). The prefix lets us rename to Tailwind theme vars with one find-replace in M5/M6.
- `<table>` + `<button role="switch" aria-checked>` + `<input type="range">` — native primitives, accessible out of the box, no library lock-in. The same markup ports 1-to-1 to Tailwind utility classes later.
- Inline SVG icons in `icons.jsx` — no `lucide-react` dependency; tree-shakes to zero overhead, copy-paste-friendly from lucide.dev.
- Local `useState` for toggles, sliders, search, sort, density — Redux was not added because this state is page-local and Redux is reserved for the existing storefront auth/cart flows.
- Responsive uses a binary rule (4 columns ≥992px / 2 columns ≤991px, sidebar → mobile nav bar at ≤767px) instead of an intermediate 3-column state. Bootstrap’s `<Container>` snaps to fixed max-widths (540/720/960/1140px); the leftover space at 576–991px is too tight for three columns plus the sidebar, so the binary rule is the predictable choice.

## Redesign

### Admin (Users, Products, Orders)

Three admin list pages — `/admin/userlist`, `/admin/productlist`, `/admin/orderlist` — were rebuilt on top of the same hybrid-D foundation as the Feature Flags Dashboard: native HTML tables, CSS Modules, the shared `--ff-` design tokens, inline SVG icons from `screens/admin/icons.jsx`, and the same slate-dark sidebar plus topbar breadcrumb.

Before / after pairs:

| Page | Before (Bootstrap) | After (hybrid D) |
|------|--------------------|-------------------|
| Users | ![Users before](screenshots/before/user-list.png) | ![Users after](screenshots/redesign/user-list.png) |
| Products | ![Products before](screenshots/before/product-list.png) | ![Products after](screenshots/redesign/product-list.png) |
| Orders | ![Orders before](screenshots/before/order-list.png) | ![Orders after](screenshots/redesign/order-list.png) |

What changed across all three:

- Unified admin shell — same sidebar (Users / Products / Orders / Feature flags) and topbar breadcrumb on every page.
- Sortable column headers with focus-visible rings, ⌘K / Ctrl+K to focus search, view-tab filters with counts, chip-based active-filter summary.
- Status indicators — UserList shows an "Admin" role badge; ProductList shows a stock pill; OrderList shows paid / delivered as 10 px binary dots (blue for done, muted gray for pending).
- All four states are wired everywhere — loading skeleton, error alert, empty, data — plus a `?state=…` URL override for demos and screenshots.
- Per-row destructive actions on UserList and ProductList use a modal confirmation (`role="dialog"`, Escape close, focus trap, body scroll lock). OrderList has no destructive action.

Why hybrid D — same reasoning as the Feature Flags Dashboard above (no Tailwind / shadcn on CRA 3.4.3 + webpack 4). The markup is native HTML, so the migration to Tailwind utility classes in M5 / M6 is a class swap, not a rewrite.

Component decisions for the admin pages mirror the Dashboard: built from scratch on native HTML primitives with `--ff-` design tokens — no third-party UI library used.
