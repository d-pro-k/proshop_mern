# M4 — proshop_mern visual layer

> Homework submission for Module 4. Builds a feature-flags admin Dashboard, redesigns six pages of the existing proshop_mern frontend (three admin + three storefront), and codifies the visual language in `DESIGN.md`. Three optional extensions (A — UI-reviewer subagent, B — pixel-perfect verify pipeline, C — design-system as data) are included; the fourth (D — screencast comparison) was deliberately skipped — see "Skipped extension (D)" below.

## What's in this submission

- [`analysis.md`](analysis.md) — existing frontend stack, pages, and components inventoried before any redesign work.
- Dashboard `/admin/feature-flags` — feature flags table with toggle, slider, search, status filter, and the four wired states (loading / data / empty / error). Screenshot at [`screenshots/feature-flags-dashboard.png`](screenshots/feature-flags-dashboard.png).
- Redesigned admin and storefront pages — three admin (Users, Products, Orders) plus three storefront (Home, Cart, Product details). Before / after pairs in [`screenshots/before/`](screenshots/before/) and [`screenshots/redesign/`](screenshots/redesign/). Detail in "Redesign" below.
- [`../../DESIGN.md`](../../DESIGN.md) — visual language (12 H2 sections — color, typography, spacing, radius, elevation, components, states, …). Linked from `AGENTS.md` §«Design rules» — see "Design system links" below.
- [`../../design-system/`](../../design-system/) — extension C: `tokens.json` + `globals.css` + `README.md`. Machine-readable single source of truth.
- [`selection-mode-demo.md`](selection-mode-demo.md) — extension C: worked example of three-file atomic token edit.
- [`../../.claude/agents/ui-reviewer.md`](../../.claude/agents/ui-reviewer.md) — extension A: Opus-based subagent that audits UI against `DESIGN.md`.
- [`ui-review.md`](ui-review.md) — extension A: initial audit report (10 Critical / 15 Major / 6 Minor findings).
- [`pixel-perfect/`](pixel-perfect/) — extension B: Playwright + Anthropic vision-diff harness with three permanent reports (baseline / regression / post-fix) plus a close-the-loop demo.
- [`qa-reflection.md`](qa-reflection.md) — Q&A reflection on tools, iterations, pain points, design system links, and the rationale for the skipped extension D.

## Component decisions

The Feature Flags Dashboard at `/admin/feature-flags` is built without a component library. shadcn/ui plus Tailwind was tried first and abandoned — utility classes did not apply reliably inside the existing Bootstrap shell, and Radix primitives ship as ESM `.mjs` which CRA 3.4.3 + webpack 4 cannot resolve without ejecting. The Bootstrap component set (`Form.Check`, `Form.Range`, `Table`) was rejected too because its markup is tightly coupled to Bootstrap classes, which works against the goal of decoupling from Bootstrap in the redesigned screens.

The page therefore uses **CSS Modules + design tokens + native HTML**:

- `frontend/src/styles/design-tokens.css` — ~20 CSS custom properties prefixed `--ff-` (a subset of `DESIGN.md`, direct hex values to avoid CRA 3.x `hsl(var())` resolve issues). The prefix gives the design system tokens a clean namespace inside the existing Bootstrap stylesheet.
- `<table>` + `<button role="switch" aria-checked>` + `<input type="range">` — native primitives, accessible out of the box, no library lock-in.
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

Why hybrid D — same reasoning as the Feature Flags Dashboard above (no Tailwind / shadcn on CRA 3.4.3 + webpack 4). The markup is native HTML.

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
- **Rating display**: inline SVG `StarIcon` with `variant="full" | "half" | "empty"` per position, driven by the same threshold logic as the legacy `components/Rating.js`. The legacy component is untouched (still used by `ProductScreen` and reviews); the redesigned storefront uses the inline SVG instead of FontAwesome.
- **Chrome harmonization** (light reskin, no structural change): `components/Header.js`, `Footer.js`, `SearchBox.js` switched from the Bootstrap dark variant to the same Slate `--ff-sidebar-bg` background and Geist font that the admin sidebar uses; the Search button moved from `outline-success` (green) to `--ff-accent` (blue). Layout, dropdowns, and routes are unchanged — a full structural rewrite of the chrome is out of scope for this round.
- **Shared icons moved out of admin scope**: `screens/admin/icons.jsx` → `components/icons.jsx`. The file now houses SVGs used by both admin pages and the new storefront page (Search, Eye, Star, Chevron-Left/Right, Check). All 7 consumer screens import from the new path.

Why hybrid D, not the originally-planned full shadcn pipeline — same reasoning as the rest of this homework: CRA 3.4.3 + webpack 4 cannot resolve Radix ESM `.mjs` modules without ejecting, and the markup we ship is native HTML.

### Cart

The cart page `/cart` (and the `/cart/:id?qty=N` add-to-cart redirect from product pages) was rebuilt as a **Stripe Checkout-style order summary**: compact item rows on the left, a sticky Order summary card on the right.

Before / after:

| Page | Before (Bootstrap) | After (hybrid D) |
|------|--------------------|-------------------|
| Cart `/cart` | ![Cart before](screenshots/before/cart.png) | ![Cart after](screenshots/redesign/cart.png) |

What was rebuilt:

- `screens/storefront/CartScreen.jsx` + `.module.css` — page wrapper, two-column grid (items + summary aside), Redux dispatch for `addToCart` / `removeFromCart`, empty-cart state with a "Browse products" CTA, "Continue shopping" back link.
- `screens/storefront/CartItem.jsx` + `.module.css` — single cart row: 80 px thumbnail (1:1), product name with line-clamp, unit price, native `<select>` qty picker, line total, `Trash2Icon` remove button. On mobile (≤ 575 px) the row collapses to a 2-row layout (image + name top, qty + total + remove bottom).

Design choices:

- **Layout**: items column on the left (`minmax(0, 1fr)`), summary on the right at a fixed 340 px sticky aside on desktop. The summary card lives at the top of the right column, aligned with the page heading. Below 992 px the columns stack — items first, summary card after.
- **Order summary card**: white background with the same `--ff-product-card-radius` and shadow as the storefront product cards. Two rows (Subtotal · N items / Total) with a 1 px divider between, then the primary "Proceed to Checkout" button (`--ff-accent`) and a fine-print line about taxes / shipping. No price breakdown beyond subtotal — shipping and taxes are deferred to the checkout flow as in the original spec.
- **Qty selector**: native `<select>` styled to match `--ff-` tokens (1 px border, custom SVG chevron, accent ring on focus). Range is `1..countInStock`. Avoided custom +/- buttons to keep scope minimal.
- **Remove button**: small icon button (`Trash2Icon` from `components/icons.jsx`) with a danger-soft hover background (`--ff-danger-soft-bg`) — same pattern as the admin delete buttons described above.

The legacy `frontend/src/screens/CartScreen.js` remains in the tree (no longer imported) in case we need to roll back. No backend or Redux changes — `addToCart` / `removeFromCart` actions are reused as-is.

### Product details

The product details page `/product/:id` was rebuilt with a **2-column hero** (image left, meta right) and a reviews section below.

Before / after:

| Page | Before (Bootstrap) | After (hybrid D) |
|------|--------------------|-------------------|
| Product `/product/:id` | ![Product before](screenshots/before/product.png) | ![Product after](screenshots/redesign/product.png) |

What was rebuilt:

- `screens/storefront/ProductScreen.jsx` + `.module.css` — page wrapper, Redux dispatch (`listProductDetails`, `createProductReview`), three branches (loading skeleton / error / data), inline `StarRow` helper that reuses the inline SVG `StarIcon` from `components/icons.jsx`.
- Hero section — left column: 1:1 image card with `object-fit: contain` so the product photo's own white background sits cleanly inside the rounded card; right column: h1 name, star rating + review count, large 32 px price, description copy, a pill-shaped in-stock / out-of-stock indicator, qty `<select>`, and a primary `--ff-accent` "Add to cart" button.
- Reviews section — header with title + reviews count, list of review items (name + relative date, star row, comment), and an inline "Write a customer review" form in a subtle gray card. The form has a rating `<select>` (1–5 with labels Poor / Fair / Good / Very good / Excellent), a comment textarea, and a Submit button; submitting disables itself while the action is in flight. When the user is not logged in, the form is replaced by a "Please sign in to write a review" prompt.

Bug fix included with this redesign:

- After a successful review submission the page now refetches product details automatically (`dispatch(listProductDetails)` inside the `useEffect` success branch) so the new review appears in the list without a page reload. The legacy `ProductScreen.js` had the same code path but did not refetch — submitting a review required a manual refresh to see it.

Cross-page polish in the same commit:

- All three storefront back links (`Home` search mode, `Cart`, `Product`) now have a Unicode `←` arrow prefix with a subtle hover-translate-x animation, replacing the earlier plain-text variants. This gives clear "back affordance" without pulling in another SVG icon.

The legacy `frontend/src/screens/ProductScreen.js` remains in the tree (no longer imported). No backend / Redux action changes — `listProductDetails`, `createProductReview`, and the `PRODUCT_CREATE_REVIEW_RESET` constant are reused.

## Design system (optional extension C)

`DESIGN.md` is the human-readable narrative. Alongside it, three files form the machine-readable layer:

- `design-system/tokens.json` — the single source of truth. ~66 token entries grouped by category (`color.foundations`, `color.sidebar`, `color.accent`, `color.status`, …, `radius`, `typography`, `storefront`). Consumed by tooling (the `ui-reviewer` agent below; future migration scripts).
- `design-system/globals.css` — the canonical CSS form of the same tokens, in a `:root` block with section comments.
- `frontend/src/styles/design-tokens.css` — runtime mirror of `globals.css`. It exists because CRA 3.4.3 webpack `ModuleScopePlugin` blocks `@import` from paths outside `frontend/src/`. The two CSS files are kept byte-identical in their `:root` blocks; this is verified after every change with a one-line `diff`.

Editing a token is a three-file atomic edit (the "selection-mode" pattern): change the matching line in `tokens.json`, `globals.css`, and `design-tokens.css` together — nothing else. `design-system/README.md` documents the rule for cold-start contributors; the `homework/M4/selection-mode-demo.md` file walks through a worked example (changing `--ff-accent` from sky-500 to emerald-500 and reverting it in the next commit), with before/after screenshots at `screenshots/dashboard/`.

## UI reviewer agent (optional extension A)

`.claude/agents/ui-reviewer.md` is a project-level Claude Code subagent running on Opus. It audits all UI code against `DESIGN.md`, `design-system/tokens.json`, `design-system/globals.css`, and `frontend/src/styles/design-tokens.css`. Two modes:

- **`MODE=review`** — read-only. Walks `frontend/src/screens/admin/`, `frontend/src/screens/storefront/`, `components/icons.jsx`, and the `Header / Footer / SearchBox .module.css` chrome modules. Emits structured findings grouped by severity (Critical / Major / Minor), each with a file:line ref, a reason citing the violated rule, and a recommendation.
- **`MODE=enforce`** — write. Applies fixes by editing files. When adding a new token it honours the tri-file sync rule above. For each change it emits a `Before / After / Why` block so the diff is reviewable line by line.

The system prompt and the audit report it produces are self-contained — they reference only the design-system files (`DESIGN.md`, `design-system/tokens.json`, `design-system/globals.css`, and the runtime mirror) and code paths under `frontend/src/`. The audit is a stand-alone artefact that a new contributor can read without any other context.

`homework/M4/ui-review.md` is the initial audit run at the end of the homework, scoped to the redesigned admin + storefront screens plus the shared chrome modules. It found 10 Critical, 15 Major, and 6 Minor issues (mostly hardcoded hex/rgba literals, off-grid spacing, and inline `style={…}` attributes that should live in CSS Modules).

The findings were applied in three tiered enforce passes:

| Pass | What | Notable additions |
|------|------|-------------------|
| Critical | Hex / rgba literals → `var(--ff-*)` tokens across SearchBox, Header dropdown, modal panels, toggle knob, ProductList hover, FeatureFlags disabled-row | Five new semantic tokens: `--ff-row-disabled-bg`, `--ff-dropdown-item-hover-bg`, `--ff-modal-shadow`, `--ff-toggle-knob-shadow`, `--ff-search-input-focus-bg` |
| Major | Off-grid spacing normalised to the 8-px half-step grid (7→6, 14→12, 9→8, 5→4, 56→48, …) and four inline `style={…}` empty-state attributes extracted into shared `.emptyIconWrap` / `.emptyTitle` / `.emptyDesc` / `.errorAlertWithMargin` classes | — |
| Minor | Empty-state icon opacity moved to a shared `.emptyIcon` class; `border-radius` numeric scale tokenised; a stale header comment in `ProductListScreen.module.css` corrected; SearchBox placeholder colour raised from `rgba(255,255,255,0.45)` to `rgba(255,255,255,0.72)` for better contrast over the Slate header | Four radius tokens: `--ff-radius-sm` (4 px), `--ff-radius-md` (6 px), `--ff-radius-lg` (8 px), `--ff-radius-pill` (999 px). The existing `--ff-product-card-radius` (12 px, storefront-specific) is preserved |

Each pass landed as an atomic commit with build-clean verification and a visual smoke check on `/admin/feature-flags` and `/`. Two Minor findings were intentionally skipped per the audit's own no-action guidance (runtime-computed skeleton opacity; Bootstrap utility classes in the chrome `Header.js / Footer.js`, which fall outside the audit's strict scope).

The agent stays in the repo and is dispatched automatically by Claude Code (`subagent_type=ui-reviewer`). The optional B (Pixel-Perfect verify) extension below builds on the same artefacts.

## Pixel-perfect verify pipeline (optional extension B)

`homework/M4/pixel-perfect/` holds a self-contained Playwright + Anthropic vision-diff harness for the `/admin/feature-flags` Dashboard. Run order is `npm run all` (= `npm run screenshot && npm run verify`).

Files of note:

- `package.json` — ESM, isolated from the main `frontend/` so Playwright's headless chromium does not bloat the deploy tree.
- `playwright.config.js` — 1440×900 viewport, single chromium project, baseURL `http://localhost:3000`.
- `screenshot-dashboard.spec.js` — authenticates as admin through a real `POST /api/users/login` (mock tokens are rejected by the backend), writes the returned `userInfo` to `localStorage` via `addInitScript`, then navigates to `/admin/feature-flags`. The row check waits for the first `tbody tr` to be visible and asserts `count > 0` — robust to changes in `features.json`.
- `reference/dashboard-reference.png` — the canonical baseline (139 KB). Captured at the end of the ui-reviewer enforce passes; future verify runs check against this.
- `verify.js` — Node.js orchestrator that base64-encodes the current and reference screenshots, sends them to `claude-sonnet-4-6` via `@anthropic-ai/sdk`, and writes a Markdown report with match score (0–100), per-element differences with severity, verdict (PASS ≥ 95 / WARN 90–95 / FAIL < 90), and a top-line recommendation. Every report carries an explicit baseline-semantics note so a cold reader knows that "reference" here is the post-Ext-A snapshot, not an external Stripe Dashboard.

Three reports are committed (the unsuffixed `verify-report.md` is transient and gitignored):

- `verify-report-baseline.md` — `current == reference`. Match 100 / PASS.
- `verify-report-regression.md` — captured after a simulated `--ff-accent` swap from `#0EA5E9` (sky-500) to `#10B981` (emerald-500). Match 92 / WARN. The model correctly localised the drift to the SEARCH button, the traffic sliders, and the active-tab underline. The WARN verdict — rather than FAIL — is a fair calibration for a single-token colour shift that does not break layout or interaction.
- `verify-report-post-fix.md` — captured after the close-the-loop demo below. Match 100 / PASS again.

`close-the-loop-demo.md` ties extensions A, B, and C into one cycle:

1. Apply a tri-file token regression (extension C pattern).
2. `npm run all` produces a WARN `verify-report.md` (extension B).
3. Dispatch `.claude/agents/ui-reviewer.md` (extension A) in `MODE=enforce` with the verify report as input.
4. The agent reads the report, reverts the token across all three sync'd files, and the next `npm run all` returns PASS.

The orchestration is manual in this demo — a human runs each step. A fully automated F5-style loop (retry-until-pass, CI hook, automated scope inference from the vision-diff JSON) is out of scope for this round.

`ANTHROPIC_API_KEY` is required for `verify.js`; it is sourced from a chmod-600 file outside the repo at run time, so the key never enters git or the project tree. The three vision-diff calls in this round cost roughly two dollars in total on the Sonnet 4.6 vision endpoint.

## Design system links

> **Note for the reviewer.** The brief asks for a `## Design rules: see ./DESIGN.md` line directly in `CLAUDE.md`. In this project that line lives one hop away — in `AGENTS.md` — and `CLAUDE.md` is a thin entry point that links to `AGENTS.md`.

This is a deliberate hub-and-spoke arrangement:

- `CLAUDE.md` (repo root) — short pointer file; the Claude entry point. Kept stable and minimal so unrelated changes don't churn it.
- `AGENTS.md` (repo root) — the primary rules document for any agent (including Claude Code, Codex, and the project's own subagents). Carries `## Design rules` with a direct link to `DESIGN.md`.
- `DESIGN.md` (repo root) — the visual-language source of truth (12 H2 sections).

The transitive chain `CLAUDE.md → AGENTS.md → DESIGN.md` carries the same information as the brief's direct link. Both ends — `AGENTS.md → DESIGN.md` and `CLAUDE.md → AGENTS.md` — are checked by the final smoke check. The arrangement is also explained from the other side in [`qa-reflection.md`](qa-reflection.md) Question 7.

## Skipped extension (D)

Extension D (side-by-side comparison with a browser-builder + screencast) was deliberately not done in this round. Two short reasons; the full rationale is in [`qa-reflection.md`](qa-reflection.md) Question 5:

1. The brief's own precondition for extension D — *"if you tried multiple tools, then make a screencast"* — was not met in our case. We iterated within Claude Code (initial shadcn/Tailwind plan → reset → hybrid D pivot), not across separate browser-builders. There was no two-sketch artefact to compare in the first place.
2. The three extensions that were done (A — UI-reviewer subagent, B — pixel-perfect verify, C — design-system as data) already cover the production-grade learning goals; the close-the-loop demo in extension B threads A + B + C together into one working pipeline. Adding a browser-builder sketch on top would have been incremental tool exposure, not new engineering pattern.

Honest acknowledgement: a browser-builder comparison is valid as a concept and would be interesting on its own. The skip is "not now", not "not needed".
