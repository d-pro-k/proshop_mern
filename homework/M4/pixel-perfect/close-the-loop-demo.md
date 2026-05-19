# Close-the-loop demo

This document records one round of the full pipeline:
**vision-diff FAIL → agent rewrites code → vision-diff PASS**.

The pipeline glues together the artefacts from extensions A, B, and C
into a single closed loop: the `ui-reviewer` subagent (extension A)
consumes a `verify-report.md` produced by the Playwright + vision-diff
pipeline (extension B) and applies tri-file token edits per the
`design-system/` source-of-truth layout (extension C).

## Step 1 — Simulated regression

Changed `--ff-accent` from `#0EA5E9` (sky-500) to `#10B981` (emerald-500)
via the tri-file selection-mode pattern:

- `design-system/tokens.json` — `color.accent.primary.value` swapped.
- `design-system/globals.css` — the `:root` `--ff-accent` line swapped.
- `frontend/src/styles/design-tokens.css` — same `:root` line swapped
  (this is the file the bundler actually loads at runtime).

CRA's dev-server HMR picked up the CSS change within a couple of seconds;
no rebuild required.

## Step 2 — Vision-diff detects the drift

Ran `npm run all` in `homework/M4/pixel-perfect/`. The Playwright spec
re-snapshotted `/admin/feature-flags` at 1440x900, and `verify.js`
shipped the new screenshot plus the unchanged reference to
`claude-sonnet-4-6` via the Anthropic SDK.

Result:

- **Match score:** 92 / 100
- **Verdict:** WARN (90-95 band)
- **Diffs:** 4 — all consistent with a single accent-token shift:
  1. SEARCH button background (severity major)
  2. Traffic sliders in all three visible rows (severity major)
  3. "All" tab underline indicator (severity minor)
  4. Toggle switch enabled state (severity minor)
- **Top recommendation:** "The primary accent/brand color has globally
  shifted from cyan-blue (approx. `#0ea5e9` / `#06b6d4`) to green
  (approx. `#10b981`). Revert the CSS custom property or Tailwind config
  color token for the primary accent back to the correct blue value."

The model correctly localised every affected element and pinned the new
hex (`#10b981`) exactly; the original-colour hint was approximate but
within the same hue family.

## Step 3 — Agent applies the fix

Dispatched the `.claude/agents/ui-reviewer.md` subagent in `MODE=enforce`,
pointing it at `homework/M4/pixel-perfect/verify-report.md` as the input.
Prompt instructed it to honour the tri-file sync rule and to touch only
the token called out by the report — no scope expansion.

The agent:

1. Read `verify-report.md` and identified the `--ff-accent` regression.
2. Edited `design-system/tokens.json` — `color.accent.primary.value`
   `#10B981` → `#0EA5E9`.
3. Edited `design-system/globals.css` — `:root` `--ff-accent: #10B981`
   → `#0EA5E9`.
4. Edited `frontend/src/styles/design-tokens.css` — same `:root` line,
   same value (runtime mirror, `:root` parity preserved).

For each file, the agent emitted a `Before / After / Why` block. No
unrelated tokens or files were touched.

## Step 4 — Vision-diff confirms PASS

Re-ran `npm run all`. The pipeline shot a fresh screenshot, the
vision-diff returned:

- **Match score:** 100 / 100
- **Verdict:** PASS
- **Diffs:** None.
- The model's narrative: *"The two images are pixel-for-pixel identical
  across all elements: navigation bar, sidebar, breadcrumb, page title,
  tab filters, search bar, table headers, feature flag rows (text,
  status badges, traffic sliders, toggle states), and all
  typography/spacing."*

`git diff design-system/ frontend/src/styles/design-tokens.css` returned
empty — the working tree is back at the post-Ext-A baseline that the
reference screenshot was captured against.

## What this proves

Manually orchestrated closed loop:

```
selection-mode token swap  ─►  Playwright snapshot
                                       │
                                       ▼
                                Anthropic vision-diff
                                       │
                                       ▼
                        verify-report.md  (WARN / 92)
                                       │
                                       ▼
                          ui-reviewer  MODE=enforce
                                       │
                                       ▼
                       tri-file token revert (atomic)
                                       │
                                       ▼
                                Playwright snapshot
                                       │
                                       ▼
                                Anthropic vision-diff
                                       │
                                       ▼
                        verify-report.md  (PASS / 100)
```

The orchestration is manual in this demo (a human ran each step). A
fully automated F5-style loop — retry-until-pass, CI hook, automated
scope inference from the vision-diff JSON — is out of scope here; that
sits one milestone further along.

## Reports captured

- `verify-report-baseline.md` — baseline PASS (Step 0 / pre-regression).
- `verify-report-regression.md` — first regression detection (the WARN
  report committed alongside the orchestrator). Identical to Step 2
  here, kept for traceability of the pipeline's detection capability.
- `verify-report-post-fix.md` — Step 4 PASS, captured after the agent's
  enforce pass.
