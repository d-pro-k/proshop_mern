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

Three admin list pages — `/admin/userlist`, `/admin/productlist`, `/admin/orderlist` — were rebuilt on top of the same hybrid-D foundation as the Feature Flags Dashboard: native HTML tables, CSS Modules, the shared `--ff-` design tokens, inline SVG icons from `components/icons.jsx`, and the same slate-dark sidebar plus topbar breadcrumb.

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

### Home

The storefront entry point `/` (plus `/page/:n`, `/search/:keyword`, `/search/:keyword/page/:n`) was rewritten as the first **storefront-comfortable** page using the same hybrid D stack. Files live under a new `frontend/src/screens/storefront/` directory that mirrors the `admin/` pattern; future storefront page redesigns (Cart, Product details, etc.) plug into the same foundation.

Before / after:

| Page | Before (Bootstrap) | After (hybrid D) |
|------|--------------------|-------------------|
| Home `/` | ![Home before](screenshots/before/home.png) | ![Home after](screenshots/redesign/home.png) |

What was rebuilt:

- `screens/storefront/HomeScreen.jsx` + `.module.css` — page wrapper, Redux dispatch, route-mode switch (default `/` vs search `/search/:kw`), four wired states (loading skeleton / error / empty / data) plus a `?state=…` URL override for demos.
- `screens/storefront/ProductCard.jsx` + `.module.css` — 1:1 aspect-ratio photo (`aspect-ratio: 1 / 1; object-fit: cover`) with inline SVG `StarIcon` (no FontAwesome dependency), 24 px body padding, subtle hover lift.
- `screens/storefront/ProductCarousel.jsx` + `.module.css` — native HTML slider on Slate-dark band, manual nav only (autorotate off — accessibility + `prefers-reduced-motion`), keyboard control (←/→/Home/End/Esc), three dot indicators, white 1:1 image card to keep the photo's own white background contained inside its boundary.

Design choices baked into the page:

- **Storefront-comfortable density** (per `DESIGN.md`): centered max-width 1200 px, 48 px section gap, h1 48 px Geist hero heading. Distinct from the admin-dense pages above.
- **Grid layout**: CSS Grid `repeat(auto-fill, minmax(240px, 1fr))` — a single rule that fluidly reflows from one column on mobile up to four columns on desktop, with the container max-width as the natural cap. No media queries needed for the grid itself.
- **Search-mode (`/search/:kw`)**: Carousel hidden, h1 reflects `Results for "{keyword}"`, an `aria-live="polite"` count line ("N products found") announces dynamic filter updates to screen readers, plus a plain "Go back" text link to return to the default view.
- **Rating display**: inline SVG `StarIcon` with `variant="full" | "half" | "empty"` per position, driven by the same threshold logic as the legacy `components/Rating.js`. The legacy component is untouched (still used by `ProductScreen` and reviews) — clean removal of FontAwesome is M5/M6 cleanup.
- **Chrome harmonization** (light reskin, no structural change): `components/Header.js`, `Footer.js`, `SearchBox.js` switched from the Bootstrap dark variant to the same Slate `--ff-sidebar-bg` background and Geist font that the admin sidebar uses; the Search button moved from `outline-success` (green) to `--ff-accent` (blue). Layout, dropdowns, and routes are unchanged — the Header redesign as a full surgery is deferred to M5 when the remaining storefront pages migrate.
- **Shared icons moved out of admin scope**: `screens/admin/icons.jsx` → `components/icons.jsx`. The file now houses SVGs used by both admin pages and the new storefront page (Search, Eye, Star, Chevron-Left/Right, Check). All 7 consumer screens import from the new path.

Why hybrid D, not the originally-planned full shadcn pipeline — same reasoning as the rest of M4: CRA 3.4.3 + webpack 4 cannot resolve Radix ESM `.mjs` modules without ejecting, and the markup we ship is native HTML, so the M5 / M6 migration to Tailwind + shadcn is a class-swap rather than a rewrite.
