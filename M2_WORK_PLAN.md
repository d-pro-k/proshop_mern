# M2 Work Plan — proshop_mern

## Goal

Complete the Module 2 homework for `proshop_mern` as a full AI-assisted onboarding and cleanup exercise: create IDE rules, run the project locally, document the setup, audit the codebase, fix real issues, add all nice-to-have deliverables, and complete the extra work.

Primary IDE for the report: Codex CLI.

Deadline from the homework spec: 2026-04-27 23:59.

## Working Principles

- Keep each logical change in a separate commit with a clear message.
- Prefer small, reviewable diffs over broad rewrites.
- Verify claims against the actual code and local runtime behavior.
- Never commit secrets. Commit `.env.example`; keep `.env` ignored.
- Preserve legacy behavior unless a finding explicitly documents the bug being fixed.
- Update docs only after validating commands locally.

## [x] Phase 0 — Repository Baseline

1. Confirm current branch and remote.
2. Confirm the working tree is clean.
3. Create the required empty baseline commit:

   ```bash
   git commit --allow-empty -m "chore: baseline before M2 AI work"
   ```

4. Keep the branch as `master` unless we deliberately decide to rename it.

Deliverable:

- Baseline commit before any homework changes.

End-of-phase commit:

```bash
git commit --allow-empty -m "chore: baseline before M2 AI work"
```

## [x] Phase 1 — Project Reconnaissance

1. Read root `package.json`, `frontend/package.json`, backend entry points, routes, controllers, models, reducers, actions, and current README.
2. Map the application:
   - backend entry: `backend/server.js`;
   - database config: `backend/config/db.js`;
   - API routes: `backend/routes/*.js`;
   - frontend entry: `frontend/src/index.js`;
   - app routing: `frontend/src/App.js`;
   - Redux store: `frontend/src/store.js`.
3. Identify runtime assumptions:
   - Node version constraints;
   - MongoDB connection requirements;
   - PayPal sandbox variable;
   - frontend proxy behavior;
   - seed data flow.

Deliverable:

- Internal notes used to create `AGENTS.md`, README, architecture docs, ADRs, and findings.

No repository commit for this phase:

- Keep reconnaissance notes local only.
- Use them as source material for later deliverables.
- Mark the phase complete in this local plan after notes are written.


## [x] Phase 2 — IDE Rules File

1. Create `AGENTS.md` in the repository root for Codex CLI.
2. Confirm `AGENTS.md` is not ignored by git.
3. Write it in English, using Markdown.
4. Keep it under 150-200 lines so the IDE can reliably consume it.
5. Include the required homework sections:
   - Overview: one concrete paragraph about what the project does;
   - Tech Stack: languages, frameworks, libraries, and actual versions from `package.json` and `frontend/package.json`;
   - Architecture: folder structure, entry points, and real paths;
   - Commands: install, dev, server-only, client-only, build, seed, destroy seed data, test commands, and the fact that no dedicated lint script exists;
   - Conventions: observed naming, imports, routing, Redux, async/error handling, auth, and persistence patterns;
   - What NOT to Do: local anti-patterns and risky changes for AI agents to avoid.
6. Integrate exactly these 3 manually selected practical unwritten rules into existing sections, not as a standalone "unwritten rules" section:
   - Use focused commits with Conventional Commit-style messages; PR titles should match the main workstream.
   - After changing models, seed data, or required fields, rerun `npm run data:destroy` and `npm run data:import` against a local/dev database.
   - Treat `Procfile`, `heroku-postbuild`, and Express serving `frontend/build` as deployment quirks; do not change them during local onboarding unless deployment is explicitly scoped.
7. Add project-specific AI working rules, for example:
   - verify env variables from code before documenting them;
   - do not modernize dependencies casually;
   - keep backend ES module import paths explicit with `.js`;
   - treat Heroku/Procfile as legacy unless intentionally updating deployment;
   - document any local startup workaround in README and `report.md`;
   - do not commit `.env`, secrets, or temporary local working notes.
8. Use this compact target structure:
   - Overview: 5-8 lines;
   - Tech Stack: 10-18 lines;
   - Architecture: 20-35 lines;
   - Commands: 15-25 lines;
   - Conventions: 20-35 lines;
   - What NOT to do: 15-25 lines.
9. Use `M2_RECON_NOTES.md` as source material, but do not mention or commit that notes file.
10. Before committing, run a quick self-check:
   - `AGENTS.md` exists in the repository root;
   - file length is within the 150-200 line target;
   - commands match actual scripts;
   - env vars match actual `process.env` usage;
   - no secrets or local-only file names are included unnecessarily.
11. Save 3-5 bullets for the future `report.md` "Rules diff" section:
   - what was manually added beyond auto-generated/basic repo facts;
   - why each manual rule matters.

End-of-phase commit:

```bash
git add AGENTS.md
git commit -m "docs: add Codex project rules"
```

Deliverable:

- `AGENTS.md`.
- Notes for the later `report.md` Rules diff section.

## [x] Phase 3 — Local Runtime Setup

1. Create a local-only `M2_RUNTIME_NOTES.md` file while working through startup issues.
2. Check local tools before installing:
   - `node -v`;
   - `npm -v`;
   - `docker --version` and `docker compose version` if Docker will be used.
3. Decide on Node strategy before running frontend commands:
   - current machine may be on a modern Node version;
   - old `react-scripts@3.4.3` needs `NODE_OPTIONS=--openssl-legacy-provider` on the currently verified Node `v24.15.0`;
   - record the actual working choice in runtime notes.
4. Install root dependencies.
5. Install frontend dependencies.
6. Create local `.env` with development-safe values. Use `PORT=5001` because this fork uses `5001` as a local port-conflict fallback from the original `5000`:

   ```env
   NODE_ENV=development
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/proshop
   JWT_SECRET=dev_jwt_secret
   PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
   ```

7. Update `frontend/package.json` proxy to match the backend port when using the local `5001` workaround:
   - `http://127.0.0.1:5001`.
8. Start MongoDB using the most practical local option:
   - preferred: Docker `mongo:7`;
   - fallback: local MongoDB service;
   - fallback: Atlas free tier.
9. Use a real PayPal sandbox client ID if verifying the payment button flow; otherwise record that checkout can be tested up to PayPal button loading only.
10. Import seed data with `npm run data:import`.
11. Run the app:
   - backend on `http://localhost:5001`;
   - frontend with `NODE_OPTIONS=--openssl-legacy-provider npm run client` on Node `v24.15.0`.
12. Verify:
   - backend responds on `http://localhost:5001`;
   - backend API responds on `http://localhost:5001/api/products`;
   - frontend opens on `http://localhost:3000`;
   - frontend can call backend APIs;
   - seeded products render;
   - seeded users can log in;
   - cart and checkout flow work at least through place-order;
   - PayPal flow is tested if a sandbox ID is available.
13. Capture every actual issue encountered for README troubleshooting and `report.md`.

Risks to watch:

- Old `react-scripts@3.4.3` fails on plain Node `v24.15.0` without the OpenSSL legacy provider.
- Old dependencies may emit warnings that should be documented but not blindly fixed.
- MongoDB connection errors may come from Docker/service startup timing.
- Dependency installation may update lockfiles; review any lockfile changes before deciding whether they belong in a commit.
- Port `5000` may be occupied on macOS; this run uses `5001` and matching frontend proxy.

Deliverables:

- Project verified locally.
- Actual startup notes for README and report.
- Local-only `M2_RUNTIME_NOTES.md` with commands tried, issues, fixes, and final working path.
- Tracked Phase 3 changes to review before commit:
  - `package-lock.json`;
  - `frontend/package-lock.json`;
  - `frontend/package.json`.

End-of-phase commit:

```bash
git add package-lock.json frontend/package-lock.json frontend/package.json
git commit -m "chore: align local dev setup"
```

## [x] Phase 4 — README and Env Example

1. Create `.env.example` with all environment variables read by the code.
   - Use placeholders for secrets.
   - Use `PORT=5001` to match the current fork and frontend proxy.
   - Do not copy the real local `JWT_SECRET` or real PayPal sandbox client ID.
2. Confirm `.env` remains ignored by `.gitignore`.
3. Rewrite/update root `README.md` with:
   - concrete project description;
   - tech stack and versions from root and frontend `package.json`;
   - folder structure;
   - prerequisites: Node/npm, Docker, MongoDB option, PayPal sandbox;
   - environment variables from actual code;
   - dependency installation using `npm install` in root and frontend;
   - note that npm 11 updates lockfiles to `lockfileVersion: 3`;
   - MongoDB options, with Docker `mongo:7` as the verified path;
   - seed commands and sample users;
   - dev startup for this fork:
     - backend on `http://localhost:5001`;
     - frontend on `http://localhost:3000`;
     - frontend command on Node `v24.15.0`: `NODE_OPTIONS=--openssl-legacy-provider npm run client`;
   - build command;
   - verification checklist based on what passed locally:
     - backend root;
     - `/api/products`;
     - frontend HTML;
     - frontend proxy;
     - admin login;
     - order creation;
   - troubleshooting based on our real setup:
     - port `5000` conflicts and the `5001` fallback used in this fork;
     - Node 24 OpenSSL issue with old `react-scripts`;
     - sandbox/local network access to MongoDB;
     - dependency deprecation/audit warnings;
     - PayPal sandbox client ID.
4. Keep deprecated-project context, but make onboarding practical.
5. Cross-check README against `AGENTS.md` so commands, ports, env vars, and proxy guidance match.
6. Before committing, run:
   - `git status --short`;
   - `git diff -- README.md .env.example AGENTS.md`;
   - a quick sanity check that `.env.example` has no real secrets.

End-of-phase commit:

```bash
git add README.md .env.example
git commit -m "docs: align README and env example with current project setup"
```

Deliverables:

- Updated `README.md`.
- `.env.example`.

## [x] Phase 5 — Structured Findings Audit

1. Audit the codebase for:
   - hotspots;
   - edge cases;
   - outdated dependencies;
   - hardcoded values;
   - dead code;
   - security and validation risks;
   - missing tests around critical flows.
2. Prioritize at least 5 findings by risk.
3. Create `FINDINGS.md` in the root with at least 3 findings.
4. Use the required table format:
   - risk;
   - location;
   - issue;
   - fix approach;
   - status.

Deliverable:

- `FINDINGS.md`.

## [x] Phase 6 — Fix One Finding

Selected finding:

- `FINDINGS.md` #1 — `backend/controllers/orderController.js::addOrderItems`

1. Recompute order pricing on the server from trusted product data instead of accepting client-supplied totals.
2. Reject invalid order payloads, including empty item arrays, invalid product IDs, unknown products, and non-positive quantities.
3. Preserve the existing checkout pricing rules while moving the final authority for totals to the backend.
4. Add or run focused verification where practical.
5. Update `FINDINGS.md` status to fixed and reference the commit hash after committing.

End-of-phase commit:

```bash
git commit -m "fix(order): recalculate order totals on the server"
```

Deliverables:

- One real finding fixed.
- `FINDINGS.md` updated with fixed status and commit reference.

## [x] Phase 7 — NICE-TO-HAVE 1: Mermaid Architecture

1. Create `docs/architecture.md`.
2. Add a GitHub-renderable Mermaid diagram.
3. Show:
   - browser/client;
   - React app;
   - Redux/actions;
   - Express API;
   - route/controller/model layers;
   - MongoDB;
   - external PayPal sandbox;
   - file uploads.
4. Add short notes explaining the runtime flow.

End-of-phase commit:

```bash
git add docs/architecture.md
git commit -m "docs: add architecture diagram"
```

Deliverable:

- `docs/architecture.md`.

## [x] Phase 8 — NICE-TO-HAVE 2: ADR x3

1. Create `docs/adr/`.
2. Add three MADR-style records based only on visible code.
3. Mark each with confidence: `HIGH`, `MEDIUM`, or `LOW`.

Likely ADR candidates:

- Use a split MERN app with Express API and Create React App frontend.
- Use Redux with thunk middleware for async frontend state.
- Use MongoDB/Mongoose models as the persistence layer.
- Use JWT bearer auth with role-based admin middleware.
- Keep PayPal integration on the client via sandbox client ID.

Each ADR should include:

- Status;
- Context;
- Decision;
- Alternatives;
- Consequences;
- Confidence.

End-of-phase commit:

```bash
git add docs/adr
git commit -m "docs: add architecture decision records"
```

Deliverables:

- `docs/adr/0001-*.md`.
- `docs/adr/0002-*.md`.
- `docs/adr/0003-*.md`.

## [ ] Phase 9 — NICE-TO-HAVE 3: Characterization Tests

1. Select one legacy function with meaningful branches.
2. Capture current behavior before refactoring.
3. Store the experiment under `experiments/` or `docs/m2-char-tests/`.

Good candidates:

- `frontend/src/reducers/cartReducers.js`;
- `frontend/src/reducers/orderReducers.js`;
- selected helper-style logic extracted from an order or cart flow.

Planned structure:

```text
experiments/characterization/
  original.js
  characterization.test.js
  refactored.js
  reflection.md
```

4. Write tests that assert current behavior, including weird or buggy behavior.
5. Refactor only the experiment copy unless we intentionally decide to apply the refactor to production code.
6. Run the tests if the legacy test setup allows it.
7. Document what was learned in `reflection.md`.

End-of-phase commit:

```bash
git add experiments/characterization
git commit -m "test: add characterization test experiment"
```

Deliverables:

- `original.js`.
- `characterization.test.js`.
- `refactored.js`.
- `reflection.md`.

## [ ] Phase 10 — NICE-TO-HAVE 4: IDE Autogen Comparison

1. Include a concise section in `report.md`.
2. Compare the generated/AI-assisted rules against manual corrections.
3. Answer:
   - what the autogen found correctly;
   - what it missed or hallucinated;
   - what we added manually.
4. If we create any secondary rules file, mark it clearly as draft or final.

Deliverable:

- `IDE autogen comparison` section in `report.md`.

End-of-phase commit:

```bash
git add report.md
git commit -m "docs: add IDE autogen comparison"
```

## [ ] Phase 11 — EXTRA 1: Docker Compose

1. Add `docker-compose.yml` to run the project more reproducibly.
2. Include services for:
   - MongoDB;
   - backend;
   - frontend.
3. Decide whether to mount source directories for local development.
4. Add env wiring without committing secrets.
5. Document compose usage in README.
6. Verify `docker compose up` as far as the local environment allows.

Risk:

- Old frontend dependency chain may need Node version pinning in Docker.
- Backend and frontend startup timing may need health checks or restart behavior.

End-of-phase commit:

```bash
git add docker-compose.yml README.md
git commit -m "chore: add docker compose development setup"
```

Deliverable:

- `docker-compose.yml`.

## [ ] Phase 12 — EXTRA 2: Dependency Upgrade

1. Choose one dependency migration with a bounded blast radius.
2. Recommended target: Mongoose 5 to a newer major version, because it is explicitly called out in the homework spec and mostly backend-contained.
3. Before changing:
   - record current behavior;
   - inspect all Mongoose usage sites;
   - check migration requirements;
   - identify callback usage, strict query behavior, and connection options.
4. Upgrade in a small commit or series of commits.
5. Run backend startup and seed flow after the upgrade.
6. Document the upgrade and any caveats in `FINDINGS.md`, README, or `report.md`.

Alternative target:

- React upgrade is higher risk because it touches React Router, React Bootstrap, testing library, and `react-scripts`; only choose it if Mongoose is blocked.

End-of-phase commit:

```bash
git commit -m "chore: upgrade mongoose"
```

Deliverable:

- One dependency upgrade with verification notes.

## [ ] Phase 13 — EXTRA 3: Try Another IDE / Rules Format

1. Add a secondary rules file only if useful and clearly labelled.
2. Candidate: `.github/copilot-instructions.md` or `.cursor/rules/main.mdc`.
3. Do not let the secondary rules file drift from `AGENTS.md`.
4. In `report.md`, compare Codex primary workflow with the secondary format.

End-of-phase commit:

```bash
git add .github/copilot-instructions.md
git commit -m "docs: add secondary AI instructions"
```

Deliverable:

- Secondary IDE comparison in `report.md`.
- Optional secondary rules file.

## [ ] Phase 14 — Final Report

1. Create `report.md` in the root.
2. Keep it concise, around 200 words unless clarity requires a little more.
3. Include:
   - Primary IDE and rules file;
   - Secondary IDE/rules if used;
   - Rules diff;
   - local startup confirmation;
   - answers to the three required questions;
   - NICE-TO-HAVE and EXTRA summary.

End-of-phase commit:

```bash
git add report.md
git commit -m "docs: add M2 report"
```

Deliverable:

- `report.md`.

## [ ] Phase 15 — Final Verification and Push

1. Run `git status --short`.
2. Confirm required files exist:
   - `AGENTS.md`;
   - `README.md`;
   - `.env.example`;
   - `FINDINGS.md`;
   - `report.md`.
3. Confirm nice-to-have files exist:
   - `docs/architecture.md`;you
   - `docs/adr/*.md`;
   - characterization experiment files.
4. Confirm extra files/changes exist:
   - `docker-compose.yml`;
   - dependency upgrade commit;
   - secondary IDE comparison.
5. Run available verification:
   - install/build/test commands that are practical;
   - backend startup;
   - frontend startup;
   - seed command;
   - Docker Compose check.
6. Review final diff from baseline.
7. Push:

   ```bash
   git push origin master
   ```

End-of-phase commit:

```bash
git status --short
# If final verification required any tracked cleanup, commit it before pushing.
git add <changed-files>
git commit -m "chore: finalize M2 homework"
```

Final deliverable:

- Public fork ready to submit to the course chat.

## Expected Commit Sequence

1. `chore: baseline before M2 AI work`
2. `docs: add Codex project rules`
3. `docs: update local setup guide`
4. `docs: add project findings`
5. `fix(...): ...`
6. `docs: add architecture diagram`
7. `docs: add architecture decision records`
8. `test: add characterization test experiment`
9. `chore: add docker compose development setup`
10. `chore: upgrade mongoose`
11. `docs: add secondary AI instructions`
12. `docs: add M2 report`

## Completion Checklist

- [ ] Baseline commit created.
- [ ] `AGENTS.md` added and tuned manually.
- [ ] Project started locally.
- [ ] `.env.example` added.
- [ ] README updated from real setup.
- [ ] `FINDINGS.md` added with at least 3 findings.
- [ ] At least one finding fixed.
- [ ] `docs/architecture.md` added with Mermaid diagram.
- [ ] Three ADR files added.
- [ ] Characterization test experiment added.
- [ ] `docker-compose.yml` added and documented.
- [ ] One dependency upgrade completed and verified.
- [ ] Secondary IDE/rules comparison completed.
- [ ] `report.md` added.
- [ ] Final verification completed.
- [ ] Changes pushed to `origin/master`.
