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
