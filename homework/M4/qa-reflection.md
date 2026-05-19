# M4 — Q&A reflection

All nine reflection questions from the brief (the brief asks for a minimum of four to five). Question 4 is reframed because we did not try several separate tools — we iterated across two approaches within the same tool; see the answer for what we mean. Question 9 is answered in the context of what we already built in extension B.

## 1. What tools did you try on this homework?

Claude Code as the primary tool, with three project-level subagents living in `.claude/agents/` (the `ui-reviewer` built in extension A is the new one in this homework; the other two were created earlier). For the vision-diff in extension B we used the Anthropic SDK directly from a small Node orchestrator (`homework/M4/pixel-perfect/verify.js`), with `claude-sonnet-4-6` on the multimodal endpoint. The frontend itself runs on the existing CRA 3.4.3 + webpack 4 + react-bootstrap toolchain that came with the project; no browser-builder (Lovable / Bolt / v0) and no Figma MCP were used — see Question 5 for the rationale.

## 2. Which one did you settle on and why?

Claude Code, because the homework's centre of gravity is editing a living codebase (the existing `proshop_mern` tree), not generating greenfield artefacts. Project-level agents plus a `DESIGN.md` checked into the repo keep the agent's behaviour deterministic across sessions; the `ui-reviewer` agent in particular is reusable in future sessions without modification. A browser-builder would have produced a parallel artefact we'd then have to port back into the same tree by hand — net-negative on time.

## 3. What did you like / dislike about the chosen tooling?

**Liked.**

- Project-level subagents (`.claude/agents/*.md`) make a reusable, self-contained auditor a one-file commit — the `ui-reviewer` is the same file other tools can read as a system prompt (Codex can run the audit by reading the same file inline).
- Tri-file design-system layout (extension C) plays well with Claude Code's `Edit` tool because each token change is exactly three single-line edits, atomically reviewable.
- The Anthropic SDK's image input is a one-line `messages.create` call — the vision-diff pipeline in extension B is under 100 lines of Node total.

**Disliked.**

- Claude Code project agents are auto-discovered only at session start. The agent file created mid-session has to be dispatched via a fallback (`general-purpose` + inline system prompt) until the next restart — papered over here, but worth keeping in mind.
- The vision-diff model identifies hue correctly but the exact hex value can drift on the report (it called `#0EA5E9` "approximately `#06b6d4`" in our regression). Good for "what changed", not for "exact target colour".
- One mid-session prompt classifier blocked an attempt to restart the dev server in the background, which forced the user to restart it manually. Fine here, but a sharp edge.

## 4. If you tried several — whose result was better and why?

Reframed: we didn't try several separate tools, but we did iterate across two different *approaches* inside Claude Code on the same Dashboard.

- **Approach 1 (initial Dashboard plan, abandoned):** shadcn/ui primitives + Tailwind CSS 3 over the existing react-bootstrap shell. The plan was the same one the brief describes for the "CC + agents path". After a couple of hours of trying to make it work we hit two hard walls: (a) CRA 3.4.3 + webpack 4 cannot resolve Radix's `.mjs` ESM modules without ejecting; (b) Tailwind utility classes did not apply reliably inside the Bootstrap container because of overlapping reset rules.
- **Approach 2 (hybrid D, what shipped):** react-bootstrap shell stays where it is, every redesigned screen is built from native HTML primitives (`<table>`, `<button role="switch">`, `<input type="range">`) styled via CSS Modules, with a `--ff-`-prefixed CSS-variables token set extracted from `DESIGN.md`.

Hybrid D won on every axis that mattered to us — buildable on the existing webpack 4 toolchain, no third-party-component lock-in, markup written in native HTML. The trade-off is that we hand-wrote more CSS than the shadcn approach would have generated — but the CSS is tokenised, and tri-file-synced (extension C), so a single token change is three single-line edits with no regeneration.

## 5. What did you want to try but did not?

Extension D — a side-by-side comparison with a browser-builder plus a screencast — was deliberately skipped. Four reasons.

1. **The brief's own precondition for D was not met.** The brief frames extension D as "*if* you tried multiple tools, then make a screencast comparing them". We iterated across two approaches *inside the same tool* (Claude Code; see Question 4); we did not try Lovable, Bolt, or v0 as separate sketches. There was no two-sketch artefact to compare in the first place, so the extension's precondition didn't activate.
2. **The other three extensions already cover the production-grade learning goal.** Extension A (the `ui-reviewer` subagent) is the agent-as-linter pattern; extension B (Playwright + vision-diff) is the visual regression pattern; extension C (`design-system/` as data) is the design-system-as-data pattern. The close-the-loop demo inside extension B threads A + B + C together into one working pipeline. A browser-builder sketch on top would have been incremental tool exposure, not a new engineering pattern.
3. **Realistic time-cost was not commensurate with marginal learning gain at this stage.** A full extension D round — picking a browser-builder, iterating with prompts to a comparable Dashboard, recording and post-processing a screencast — is realistically 4–6 hours. At this point in the homework that time would have come at the cost of the final review and verification work.
4. **Design-iteration experience came organically anyway.** The reset-and-pivot in Question 4 is exactly the constraint-driven iteration the brief points at. We experienced "the plan didn't work on the real codebase, so we changed the plan" in production, not as a tool-evaluation exercise.

Honest acknowledgement: a browser-builder comparison is valid as a concept and would be interesting on its own — for example as a stand-alone exercise next to a greenfield Dashboard with no Bootstrap shell to fight. The skip is "not now", not "not needed".

## 6. How many iterations / prompts for the Dashboard?

Counted from the git log.

- **DESIGN.md reverse-design.** One generation pass (the `reverse-design-from-screenshot` skill) plus one Opus-review tweak (`--shadow-lg` was capped at 24 px after the review flagged it against the "no blur over 16 px" anti-slop rule).
- **Dashboard implementation.** One initial implementation (commit `a2ed721`, 12 files, +1820 / −1) plus one spec-alignment fix (commit `f4e252d`, 3 files, +29 / −136 — tab labels, badge-colour-on-toggle wiring, removed an "InfoTooltip" and a "Recently changed" tab that weren't in the brief).
- **Three admin redesigns.** One commit per screen — `9c752bb` (Users), `d313b9e` (Products), `18fcbd6` (Orders) — each following the same wireframe → static mock → live implementation pattern.
- **Three storefront redesigns.** One commit each — `0f896ef` (Home), `fdf9017` (Cart), `b2d674b` (Product details). The Home commit also moved the shared SVG icon library from `screens/admin/` to `components/` so storefront pages could import it.
- **Extension A enforce passes.** Three tiered Opus dispatches — `f5fd035` (Critical: 10 colour findings), `57b00e2` (Major: 15 spacing / inline-style findings), `f493d01` (Minor: 4 actionable findings) — plus the close-the-loop dispatch reused in extension B (`19e9fea`). The agent emitted Before / After / Why blocks for each edit; we reviewed each tier before committing it.

Including the optional extensions, this homework came out at fourteen commits on top of the starting baseline; without the optionals it would have been seven.

## 7. Bugs and pain points

- **Initial shadcn/Tailwind plan for the Dashboard didn't build.** Tracked above in Question 4. Solved by a hard reset and pivot to hybrid D.
- **Brief vs project convention, `CLAUDE.md` vs `AGENTS.md`.** The brief asks for a `## Design rules: see ./DESIGN.md` line directly in `CLAUDE.md`. This project follows a hub-and-spoke arrangement: `CLAUDE.md` (repo root) is a thin entry point and routes through `AGENTS.md` (repo root), which carries `## Design rules` with the direct link to `DESIGN.md`. The transitive chain `CLAUDE.md → AGENTS.md → DESIGN.md` carries the same information; both ends are checked by the final smoke check. The arrangement is explained from the README side in [`README.md`](README.md) §"Design system links". We chose to keep the chain rather than duplicate the line into `CLAUDE.md` so that adding a future rule to `AGENTS.md` doesn't churn `CLAUDE.md` too.
- **Vision-diff hex precision (extension B).** The Sonnet-4.6 vision endpoint identifies hue and element correctly but the exact hex value in the report can drift (our regression had `#0EA5E9 → #10B981`, and the model called the *original* "approximately `#06b6d4` / cyan-500" instead of the actual `#0EA5E9` / sky-500). Hue family is right; exact byte value is off. Good for "what changed", not for "exact target colour".
- **Auto-mode classifier blocked one background dev-server restart.** Mid-extension-B the frontend dev server died (after a few `npm install` runs in adjacent directories) and Claude Code's prompt classifier refused to relaunch it in the background. Worked around by asking the user to restart it manually. Honestly fine, just a sharp edge.
- **Two Minor findings from the audit were skipped on the audit's own recommendation.** The skeleton-row `opacity` is a runtime-computed value with no clean CSS-Modules equivalent; the Bootstrap utility classes in `Header.js / Footer.js` fall outside the audit's strict scope (`screens/admin/` + `screens/storefront/` only).

## 8. What changed in DESIGN.md after the first agent iteration?

Two distinct expansions.

- **Initial reverse-design generation → Opus review.** The first generation produced an internal inconsistency: the file set `--shadow-lg` to 24 px while a separate anti-slop rule in the same file said "no blur over 16 px". An independent Opus review flagged the conflict; resolved with a one-line edit to `DESIGN.md` that raised the cap to 24 px (matching the visual intent of the reference). Net: one line changed; the conflict surfaced before the file ever left the working tree.
- **Extension A enforce passes meaningfully expanded the token set.** Critical pass added five new semantic colour / shadow tokens (`--ff-row-disabled-bg`, `--ff-dropdown-item-hover-bg`, `--ff-modal-shadow`, `--ff-toggle-knob-shadow`, `--ff-search-input-focus-bg`) because the audit found hex / rgba literals in code that had no token to point at. Minor pass added four radius tokens (`--ff-radius-sm / md / lg / pill` = `4 / 6 / 8 / 999 px`) because the existing scale was inferred but not named. Token count: 57 after extension C extracted them → 62 after the Critical pass → 66 after the Minor pass.

## 9. Playwright test for Dashboard in M5?

The pixel-perfect verify pipeline in extension B already covers `/admin/feature-flags`: real admin login through `POST /api/users/login`, 1440 × 900 screenshot, Anthropic vision-diff against a committed reference baseline, structured report with verdict (PASS ≥ 95 / WARN 90–95 / FAIL < 90), and a close-the-loop demo where the `ui-reviewer` agent reads the report and reverts the drift atomically. Three permanent reports are committed under [`pixel-perfect/`](pixel-perfect/): baseline (PASS), regression after a simulated token swap (WARN), and post-fix after the agent's enforce (PASS again).

The plan for M5 is to extend coverage rather than start from scratch.

- **More pages per run.** Add the three storefront pages (Home, Cart, Product details) to the snapshot rotation. The login fixture and the vision-diff orchestrator already work without page-specific code; only the spec file needs a parameterised loop.
- **Multiple states per page.** The Dashboard supports a `?state=` URL override (loading / empty / error / data); we should snapshot each state and check it independently. The current pipeline only checks the data state.
- **Automate the close-the-loop step.** Right now the loop is manually orchestrated: a human runs `npm run all`, reads the WARN report, dispatches the agent, then re-runs `npm run all`. M5 wires it into one script that loops until either PASS or a max-retry cap is hit — the F5-style pipeline the brief points at as a stretch goal.
- **Pre-commit / CI hook.** The pipeline runs in a couple of seconds plus one vision-diff API call (~$0.60). Cheap enough to gate a PR on. Hook it into the git pre-commit (locally) or a small GitHub Actions workflow (remote) so visual drift fails the build the same way a broken unit test would.
