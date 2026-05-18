# DESIGN.md

> **Source of truth:** machine-readable tokens in [`design-system/tokens.json`](design-system/tokens.json);
> canonical CSS variables in [`design-system/globals.css`](design-system/globals.css);
> runtime mirror at [`frontend/src/styles/design-tokens.css`](frontend/src/styles/design-tokens.css).
> This document is the human-readable narrative — keep it in sync with the three files above
> when tokens change. See [`assignments/M4/plan/ext-c-selection-mode.md`](assignments/M4/plan/ext-c-selection-mode.md)
> for the selection-mode pattern (one section at a time, not the whole file).

> Design system: Stripe-inspired (Slate + Smoke), light theme, dual density.
> Aesthetic: minimal-tech — admin-dense for back-office, storefront-comfortable for shopper-facing pages. Both share tokens.
> Reference: Stripe Dashboard + Checkout (captured in `assignments/M4/reference/`).
> Format: shadcn/ui + Tailwind CSS 3 + CSS custom properties (HSL).
> Last updated: 2026-05-14

---

## Overview

This file is the single visual source of truth for proshop_mern. Every component, page and Tailwind utility refers to the tokens defined here through CSS custom properties — no hardcoded hex literals are allowed in JSX or `tailwind.config.js`.

The system carries Stripe's working palette (Slate text on Smoke background, conservative Slate-tinted shadows, restrained accent use) without Stripe's marketing surface — the brand-purple `#635BFF` is explicitly excluded because it overlaps with the violet hue that anti-AI-slop guards flag as the default-AI primary.

Two density modes ship on the same tokens:

- **admin-dense** — Dashboard, `/admin/*` screens. Sidebar layout, dense tables, 16px card padding, 24px section gap.
- **storefront-comfortable** — Cart, Product, Home, Checkout funnel, Profile. Centered container, no sidebar, 32px card padding, 48px section gap, larger CTAs.

Tokens, typography, radii, shadows are identical across both modes. Only spacing scale and a handful of component sizes shift between them.

M4 implements the Dashboard in admin-dense and one redesigned page in storefront-comfortable. Future modules will roll this system across every remaining proshop_mern screen.

---

## Color

CSS custom properties hold raw HSL components (`H S% L%` — no `hsl()` wrapper). Tailwind utilities call them as `hsl(var(--token) / <alpha-value>)`, which lets opacity modifiers work natively.

### Foundations (light theme)

| Token | HSL | Hex approx | Role |
|---|---|---|---|
| `--background` | `210 33% 97%` | `#F6F9FC` | Page background (Smoke) |
| `--foreground` | `213 73% 14%` | `#0A2540` | Primary text (Slate) |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card surface |
| `--card-foreground` | `213 73% 14%` | `#0A2540` | Text on card |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Popover / dropdown surface |
| `--popover-foreground` | `213 73% 14%` | `#0A2540` | Text on popover |
| `--muted` | `210 16% 96%` | `#F0F3F7` | Hover / disabled surface |
| `--muted-foreground` | `213 24% 40%` | `#4D5E70` | Secondary text |
| `--border` | `210 16% 90%` | `#E0E5EC` | 1px subtle dividers |
| `--input` | `210 16% 90%` | `#E0E5EC` | Input borders |
| `--ring` | `213 73% 30%` | `#143D6D` | Focus ring (Slate, darker) |

### Action and accent

| Token | HSL | Hex approx | Role |
|---|---|---|---|
| `--primary` | `213 73% 14%` | `#0A2540` | Stripe Slate — primary action |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary |
| `--secondary` | `210 16% 96%` | `#F0F3F7` | Quiet button background |
| `--secondary-foreground` | `213 73% 14%` | `#0A2540` | Text on secondary |
| `--accent` | `211 100% 48%` | `#0070F3` | Highlight (used sparingly) |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent |

### Status colors — three distinct hues

Status tokens drive feature-flag rows on the Dashboard, plus any future health indicators. They are three different hues (not three lightnesses of one hue) and all clear WCAG AA on the Smoke background.

| Token | HSL | Hex approx | Use |
|---|---|---|---|
| `--status-enabled` | `135 60% 38%` | `#258A47` (green) | Enabled / active / on — feature is live |
| `--status-testing` | `211 100% 48%` | `#0070F3` (blue) | Testing / pending / in-progress — feature in A/B trial |
| `--status-disabled` | `215 14% 65%` | `#98A0AC` (gray) | Disabled / inactive / off — feature is shut off |

Status badge presentation: background fills with the status hue at 12% alpha, text is the hue at full saturation. See Components → Badges.

### Semantic feedback

| Token | HSL | Hex approx | Use |
|---|---|---|---|
| `--success` | `135 60% 38%` | `#258A47` | Save success, confirmation toast |
| `--warning` | `38 100% 50%` | `#FF9F00` | Warning banner, soft caution |
| `--destructive` | `7 80% 56%` | `#E84A38` | Destructive action, error |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |
| `--info` | `211 100% 48%` | `#0070F3` | Neutral info banner |

### Why Slate, not Stripe brand purple

Stripe's signature `#635BFF` lives on marketing pages. The product surface — Dashboard, Connect, Atlas, Billing — runs on Slate `#0A2540` as the working primary, with purple reserved for hero illustrations. proshop_mern has no hero illustrations, so the marketing color is excluded. Slate keeps the sober, sophisticated identity Stripe is known for without crossing into the default-AI violet zone.

---

## Typography

Font family: **Geist** (variable). Loaded from `https://vercel.com/font` or `@vercel/font/geist`.
Fallback stack: `Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
Monospace: **Geist Mono** — prices, IDs, code blocks, table data values.

Type scale (base 16px, geometric ratio 1.25). Negative tracking on display sizes tightens letterforms; UPPERCASE labels use positive tracking.

| Step | Size | Line-height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| caption | 12px | 1.4 | 0.05em (UPPERCASE only) | 500 | Eyebrows, table headers, meta |
| small | 14px | 1.5 | 0 | 400 | Secondary text, badges, input text |
| body | 16px | 1.5 | 0 | 400 | Body content |
| label | 18px | 1.4 | 0 | 500 | Section labels, form group headers |
| h4 | 20px | 1.4 | −0.005em | 600 | Card titles, subhead |
| h3 | 24px | 1.3 | −0.01em | 600 | Page subtitles |
| h2 | 32px | 1.2 | −0.015em | 700 | Page titles in admin-dense |
| h1 | 48px | 1.1 | −0.02em | 700 | Hero on storefront pages |

Allowed weights: 400 / 500 / 600 / 700. Light (300) and ultra-bold (800/900) are not used.

Italic is reserved for inline emphasis inside body copy; no italic display headlines.

---

## Spacing

Strict 8-grid. The only legal half-step is 4px, reserved for icon-to-label gap inside compact components (badge, chip, status dot). Anything outside the allowed set is forbidden — anti-grid values are listed in Anti-AI-slop Guards.

Allowed scale (px):

```
4    half-step (icon + label gap inside badge / chip only)
8    xs (tight padding, table cells in admin-dense)
16   sm (component inner padding, form fields)
24   md (card padding admin-dense, sidebar list item)
32   lg (card padding storefront, section padding inside cards)
48   xl (gap between cards, section gap)
64   extra-large (page-level gap on storefront)
96   huge (hero section gap, splash screens)
```

Tailwind 3 default step mapping carries through unchanged: step 1 → 4px, step 2 → 8px, step 4 → 16px, step 6 → 24px, step 8 → 32px, step 12 → 48px, step 16 → 64px, step 24 → 96px. Arbitrary values via square-bracket syntax are not allowed.

---

## Radius

Conservative scale — pillowy or fully-rounded surfaces are an AI-slop signature and are not used on cards or buttons.

```
--radius-sm:    4px    badges, status pills, chips
--radius:       8px    buttons, inputs, dialogs (default)
--radius-lg:   12px    cards, panels
--radius-xl:   16px    large storefront cards, modals
--radius-full: 9999px  avatars, status dots, switch track / thumb only
```

`rounded-full` is legitimate only for round elements (avatars, status dots, switch thumbs). Buttons, cards, inputs and tabs never use it.

---

## Elevation

Light-theme depth comes from background contrast (Smoke vs white) first, with subtle Slate-tinted shadows as secondary support. Heavy multi-layer drop shadows, glows and inner shadows are forbidden.

Three-level elevation:

- **Level 0** — page surface on `--background` (Smoke).
- **Level 1** — card on `--card` with a 1px `--border` and `--shadow-sm`.
- **Level 2** — popover / dialog / dropdown on `--popover` with `--shadow`. Modal overlay uses Slate at 40% alpha (`hsl(213 73% 14% / 0.4)`), not pure black.

Shadow tokens (alpha-blended Slate, not pure black box-shadow):

```
--shadow-sm: 0 1px 2px hsl(213 73% 14% / 0.05);
--shadow:    0 2px 8px hsl(213 73% 14% / 0.08);
--shadow-lg: 0 8px 24px hsl(213 73% 14% / 0.12);
```

Cards default to `--shadow-sm`; popovers and dialogs use `--shadow`; only large modals use `--shadow-lg`. `--shadow-lg` is never the reflexive choice on every card — that is a slop signature.

---

## Components

### Buttons

Variants:

- **Primary** — bg `--primary`, text `--primary-foreground`, radius 8px, height 40px.
- **Secondary** — transparent bg, 1px `--border`, text `--foreground`.
- **Ghost** — transparent bg, no border, text `--muted-foreground`.
- **Destructive** — bg `--destructive`, text `--destructive-foreground`.

Sizing — height drives the size token, horizontal inset scales with it:

- Size `sm` — height 32px.
- Size `md` — height 40px (default).
- Size `lg` — height 48px.

Horizontal padding: 8px on `sm`, 16px on `md`, 24px on `lg`.

Hover lifts brightness by 8%, active drops it by 4%, focus draws a 2px `--ring` outline offset by 2px. Disabled state: opacity 0.4, `cursor: not-allowed`, no hover effect.

### Inputs

Background `--card`, 1px solid `--input` border, radius 8px. Height 40px in admin-dense and 48px on storefront forms.

Horizontal padding 16px on standard inputs.

States:

- Focus — border `--ring`, 2px ring outline at `hsl(var(--ring) / 0.2)`.
- Disabled — bg `--muted`, text `--muted-foreground`.
- Placeholder — `--muted-foreground`.
- Error — border `--destructive`, helper text `--destructive`.

### Cards

Background `--card`, 1px solid `--border`, radius 12px, `--shadow-sm`. Clickable cards on hover darken the border toward `--ring` without scaling.

Padding 24px in admin-dense, padding 32px in storefront-comfortable.

### Badges and status pills

- Shape: `--radius-full` (a legitimate exception — badges are compact).
- Padding 4px 8px.
- Font: caption size, weight 500, UPPERCASE with 0.05em tracking.
- Fill: status hue at 12% alpha for background, full-saturation hue for text.

### Tables (admin-dense pattern)

Row height 48px default, 40px on a compact toggle. 1px `--border` between rows; no outer cell borders. Header row: bg `--muted`, text `--muted-foreground`, caption size, UPPERCASE. Hovered row: bg `--muted`.

### Dialog and popover

- Background `--popover`, radius 12px, `--shadow`.
- Dialog padding 24px.
- Dialog max-width 480px (size `md`); 640px (size `lg`).
- Overlay: `hsl(213 73% 14% / 0.4)`.

### Sidebar (admin)

- Width 240px, background `--foreground` (Slate), text `hsl(0 0% 100% / 0.85)`.
- Item padding 8px vertical, 16px horizontal.
- Active item: bg `hsl(0 0% 100% / 0.08)`, text white, 3px left rail in `--accent`.

### Switch (feature toggle)

- Track width 40px, height 24px, radius full, bg `--muted` when off, bg `--status-enabled` when on.
- Thumb 20px circle in white, translates 16px.
- Focus: 2px `--ring` outline offset by 2px.

### Slider (rollout percentage)

- Track height 8px, radius full, bg `--muted`, filled portion `--accent`.
- Thumb 16px circle, white with 1px `--border` and `--shadow-sm`.
- Tick marks at 0 / 25 / 50 / 75 / 100 (% labels in caption size below the track).

---

## States

Every interactive element has all five states explicitly defined. A missing focus or hover state counts as a slop violation.

| Element | Default | Hover | Focus | Active | Disabled |
|---|---|---|---|---|---|
| Button | as variant | brightness +8% | 2px ring offset 2px | brightness −4% | opacity 0.4 |
| Input | border `--input` | border `--ring`/50% | border `--ring` + 2px ring | — | bg `--muted`, read-only |
| Row | bg transparent | bg `--muted` | 2px inset ring | bg `--muted` | opacity 0.5 |
| Link | text `--primary`, no underline | underline | 2px ring | text `--accent` | opacity 0.4 |
| Switch | track `--muted`, thumb white | track tone deepens | 2px ring | — | opacity 0.5 |
| Card | border `--border` | border `--ring` | 2px outline | — | opacity 0.5 |

Async states:

- **Loading** — skeleton shimmer (1.5s linear) on the element's bounding box. Spinner only for explicitly action-triggered work (form submit, mutation in flight).
- **Empty** — every list, table and feed defines a designed empty state: 1.5px-stroke icon, h4 heading, one-line description in `body`, single CTA. No bare empty `<div>`.
- **Error** — destructive icon + message + recoverable action when possible.

Transitions are 150ms ease by default. Anything longer than 300ms on an interactive element is forbidden. The system respects `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## Density Modes

Two density modes share tokens and differ only in spacing and a few component sizes. Both modes coexist in the same Tailwind config — the mode applies via the page layout, not a global toggle.

### admin-dense (Dashboard, /admin/*)

- Fixed sidebar 240px on Slate; sticky topbar 56px high with global search and account menu.
- Tables drive the surface — rows 40 to 48px tall, status badges, numbered pagination.
- Card padding 16px; section gap 24px between cards.
- Search and filter bar above tables: card-bg, padding 16px.
- Page padding 32px around the main content area.

### storefront-comfortable (Cart, Product, Home, Checkout, Login, Register, Profile)

- Centered container, max-width 1200px, no sidebar.
- Card padding 32px; section gap 48px between sections; large block gap 64px between feature areas.
- Single dominant CTA per page (sticky at bottom on mobile).
- Forms: vertical stack; large inputs (height 48px); label-to-input gap 8px; gap 24px between groups.
- Large product photos as a first-class element — treatment evolved further in M5/M6.

Modes never mix on one page. The Dashboard is fully admin-dense; the Cart page is fully storefront-comfortable.

---

## Accessibility

- Contrast: Slate `#0A2540` on Smoke `#F6F9FC` resolves to roughly 13:1, well above WCAG AA. Muted-foreground `#4D5E70` on Smoke clears 4.5:1 for body text.
- Focus ring (`--ring`, 2px solid, 2px offset) is visible on every interactive element. `outline: none` without a visible replacement is forbidden.
- Touch targets are at least 44 × 44 px on mobile — pad small icons; do not shrink them.
- Icons that carry meaning take `aria-label`; decorative icons take `aria-hidden="true"`.
- Form fields have an explicit `<label>` or `aria-label`; validation errors announce via `aria-live="polite"`.
- Modals use `role="dialog"`, `aria-modal="true"`, a focus trap on open, and restore focus on close.
- Skip-to-content link is the first focusable element in `<body>`.
- Color is never the only carrier of meaning — status badges combine hue, label text, and (where applicable) an icon.

---

## Anti-AI-slop Guards

These rules override any generated output. When a component or page violates one, fix the file — do not justify the violation.

Hard NO:

- Inter typeface and Inter clones (Geist is the only allowed sans-serif here).
- Solid violet or purple as primary — including Stripe's marketing color `#635BFF` and Tailwind `violet-600 / 700`.
- Cyan-to-violet, blue-to-pink, or any flashy gradients on solid UI surfaces.
- Borders thicker than 1px (the 2px focus ring is the only exception).
- Box-shadows with blur over 24px or alpha over 0.2 — no glow, no multi-layer drop shadows, no inner shadows. (The 24px cap matches the largest gated token `--shadow-lg`, used only on modal-sized surfaces; anything heavier is a slop signature.)
- "Free vs Pro" two-column comparison block as a marketing pattern.
- Hardcoded hex literals inside JSX or Tailwind utilities — always reference a token.
- Generic shadcn defaults left untouched (`zinc-900`, `border-input` without an override).
- `rounded-full` on anything that is not an avatar, status dot, or switch thumb.
- Missing hover, focus or active states on interactive elements.
- Anti-grid values like 10 / 14 / 18 / 22 / 28 — only multiples of 8 (with 4 as half-step) are allowed.
- Three lightnesses of one hue masquerading as three status colors.

Hard YES:

- Slate `#0A2540` as the primary action color.
- Smoke `#F6F9FC` as the page background; pure white for cards.
- Geist as the only sans-serif typeface, paired with Geist Mono for code and prices.
- 1px subtle borders in `--border`.
- Status colors that are three different hues (green / blue / gray), each WCAG-accessible.
- Spacing tokens in multiples of 8, with 4 only as a half-step inside badges and chips.
- HSL components in `:root` without an `hsl()` wrapper, so Tailwind can compose `hsl(var(--token) / <alpha-value>)`.
- All five interactive states defined per element.
- Skeleton shimmer for loading; designed empty and error states everywhere.

---

## Format Declaration

```
Component library: shadcn/ui (copy-paste, JSX — not TypeScript)
CSS framework:     Tailwind CSS 3 with corePlugins.preflight: false (Bootstrap coexistence)
Token system:      CSS custom properties on :root, HSL components without hsl() wrapper
Icon set:          Lucide React (1.5px stroke width)
Type:              Geist + Geist Mono via @vercel/font/geist or vercel.com/font
```

Drop this CSS variables block into `frontend/src/styles/tailwind.css` at the `:root` selector:

```css
:root {
  --background:             210 33% 97%;
  --foreground:             213 73% 14%;
  --card:                     0  0% 100%;
  --card-foreground:        213 73% 14%;
  --popover:                  0  0% 100%;
  --popover-foreground:     213 73% 14%;
  --primary:                213 73% 14%;
  --primary-foreground:       0  0% 100%;
  --secondary:              210 16% 96%;
  --secondary-foreground:   213 73% 14%;
  --muted:                  210 16% 96%;
  --muted-foreground:       213 24% 40%;
  --accent:                 211 100% 48%;
  --accent-foreground:        0  0% 100%;
  --destructive:              7 80% 56%;
  --destructive-foreground:   0  0% 100%;
  --border:                 210 16% 90%;
  --input:                  210 16% 90%;
  --ring:                   213 73% 30%;
  --success:                135 60% 38%;
  --warning:                 38 100% 50%;
  --info:                   211 100% 48%;
  --status-enabled:         135 60% 38%;
  --status-testing:         211 100% 48%;
  --status-disabled:        215 14% 65%;
  --radius:                 8px;
  --radius-sm:              4px;
  --radius-lg:              12px;
  --radius-xl:              16px;
  --shadow-sm: 0 1px 2px hsl(213 73% 14% / 0.05);
  --shadow:    0 2px 8px hsl(213 73% 14% / 0.08);
  --shadow-lg: 0 8px 24px hsl(213 73% 14% / 0.12);
}
```

Drop this Tailwind config snippet into `frontend/tailwind.config.js` under `theme.extend`. Tailwind references the `:root` HSL components with `<alpha-value>` so opacity modifiers work:

```js
module.exports = {
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT:    'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border:  'hsl(var(--border) / <alpha-value>)',
        input:   'hsl(var(--input) / <alpha-value>)',
        ring:    'hsl(var(--ring) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        info:    'hsl(var(--info) / <alpha-value>)',
        'status-enabled':  'hsl(var(--status-enabled) / <alpha-value>)',
        'status-testing':  'hsl(var(--status-testing) / <alpha-value>)',
        'status-disabled': 'hsl(var(--status-disabled) / <alpha-value>)',
      },
      borderRadius: {
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg:      'var(--radius-lg)',
        xl:      'var(--radius-xl)',
      },
      boxShadow: {
        sm:      'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg:      'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
};
```

Dark mode is intentionally not implemented in M4. `darkMode: 'class'` stays in the config so future modules can layer dark tokens on `.dark` without restructuring. The system targets Tailwind 3 with HSL CSS variables exclusively — no Tailwind 4 syntax, no alternate color spaces.

---

> Be a human designer so the result does not look like AI. With taste.
