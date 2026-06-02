# Audit Plan — proshop_mern

> Living-documentation audit plan. Read-only Plan mode produced this; execution (Phase 3–5) begins only after approval.

## Project shape (from Phase 1)

- **Project type:** mixed monorepo — legacy MERN core (`backend/` + `frontend/`) plus three independent Node/TS subprojects (`mcp/feature-flags`, `mcp/search-docs`, `rag`).
- **Tech stack:** Express `^4.17.1` + Mongoose `^8.22.1` (JS ESM); React 16 + Redux + CRA `react-scripts@3.4.3`; MCP SDK + zod (TS); Qdrant client + BM25 + dense + rerank (TS, with a Python reranker helper).
- **Subprojects discovered (5):** backend API, frontend SPA, feature-flags MCP, search-docs MCP, RAG pipeline.
- **Existing docs surface:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `DESIGN.md`, `FINDINGS.md`, `docs/architecture.md`, `docs/adr/0001..0003`, `design-system/`.
- **Tests surface:** backend HTTP characterization (root Vitest + supertest); per-subproject Vitest + Stryker in the three TS subprojects.
- **Legacy markers:** React 16 / CRA 3 (OpenSSL legacy flag), `jsonwebtoken@8.5.1`, `multer@1.4.2`.

## Existing docs audit (from Phase 1.5)

- ✅ Keep / additive: 7 (`docs/adr/`, `docs/architecture.md`, `README.md`, `AGENTS.md`, `DESIGN.md`, `design-system/`, `CLAUDE.md`)
- 🔄 Update + keep: 0
- 📦 Archive (historical): 1 recommended (`FINDINGS.md`)
- ❌ Archive (stale): 0 (`frontend/README.md` flagged, left in place)
- Out of scope: `report.md`, `rag/docs-corpus/`
- Full table: `docs-audit.md`

## Audit scope (confirmed)

- **In scope:** whole repository — backend, frontend, all three subprojects, root config.
- **Out of scope for changes:** `rag/docs-corpus/**` (indexed data fixture), `report.md` (course write-up), `node_modules/`, build/dist output, `frontend/README.md` (CRA boilerplate).
- **Findings input:** `homework/M6/stage1-code-review/synthesis.md` (already comprehensive — specialists are **not** re-run).

## Phase 3 — REVERSE ENGINEERING

- [ ] 3.0 Prior consolidated review exists (`stage1-code-review/synthesis.md`) → use it as findings input; **do not** re-dispatch security/performance/architecture specialists.
- [ ] 3.1 Per-module 4-step reverse engineering (UNDERSTAND → DECISION TABLE → SEQUENCE DIAGRAM → EDGE CASES ≥10) → `docs/specs/<module>-spec.md`. Approved module set (6 — full backend + frontend coverage):
  - [ ] `orders-spec.md` — order creation, server-side pricing, ownership authorization, pay/deliver lifecycle
  - [ ] `auth-spec.md` — JWT issue/verify, `protect`/`admin` middleware, password hashing hook
  - [ ] `feature-flags-spec.md` — `features.json` model, backend routes + feature-flags MCP writer, traffic rollout
  - [ ] `retrieval-spec.md` — search-docs MCP + RAG ingest/query/hybrid/rerank pipeline
  - [ ] `catalog-spec.md` — product listing, keyword search, reviews, top-products
  - [ ] `client-state-spec.md` — Redux store + localStorage hydration, checkout/place-order flow, client auth/session handling

## Phase 4 — AGGREGATE

- [ ] 4.1 Write a fresh `stage3-synthesis.md` summarizing the specs + reused findings (the Stage-1 `synthesis.md` is read-only — not overwritten).
- [ ] 4.2 Build `project-index.json` at repo root: name/type/description, tech_stack, subprojects (≥3), system_folders, root_files, hard_rules (≥5, including "ALWAYS read project-index.json FIRST"), ai_routing (≥1), filesystem_tree, last_updated.
- [ ] 4.3 Assemble new `docs/` structure additively:
  - `docs/README.md` — index (NEW)
  - `docs/architecture/overview.md` — relocated from `docs/architecture.md`
  - `docs/specs/*` — the reverse-engineering specs (NEW)
  - `docs/adr/` — kept in place, numbering preserved
- [ ] 4.4 Add ADR-0004 (vector retrieval via MCP over Qdrant — current state, with known dense-served vs hybrid-detached divergence) + ADR-0005 (feature-flags as a JSON file with an MCP management interface — note incomplete write-path enforcement), continuing the existing numbering. Written to reflect reality, in the tone of ADR-0001..0003.
- [ ] 4.5 Archive `git mv FINDINGS.md docs-archived-2026-06-01/`; link the archived copy from `docs/README.md` and point readers to `stage1-code-review/synthesis.md` as the current findings source.

## Phase 5 — AUTOMATE

- [ ] 5.1 Install `update_project_index.py` into `.claude/scripts/` (`chmod +x`).
- [ ] 5.2 Adapt `WATCH_PATHS` to `backend/`, `frontend/src/`, `mcp/feature-flags/`, `mcp/search-docs/`, `rag/`.
- [ ] 5.3 Configure PostToolUse + SessionStart hooks in `.claude/settings.json`.
- [ ] 5.4 Append two sections to `AGENTS.md`: "START HERE — read project-index.json first" + "Keeping project-index.json current".
- [ ] 5.5 Test the script standalone; smoke-test the hook fires on a throwaway file.

## Deliverable copies

- [ ] Copy `project-index.json`, the new `docs/` (as `docs-new/`), the archive (as `docs-archived/`), `update_project_index.py`, the appended `AGENTS.md`, `00-plan.md`, and `docs-audit.md` into `homework/M6/stage3-living-docs/`.

## Approved decisions

1. **`FINDINGS.md`:** 📦 archive to `docs-archived-2026-06-01/`; link the snapshot from `docs/README.md` and point readers to `stage1-code-review/synthesis.md` as the current findings source. (Confirmed: the file is unreferenced by any live document — archiving breaks no links.)
2. **Spec module set:** all **6** modules — orders, auth, feature-flags, retrieval, catalog, and client-state/checkout (full backend + frontend coverage).
3. **New ADRs:** add **ADR-0004** (retrieval) + **ADR-0005** (feature-flags), written to reflect the current implementation and to name known divergences honestly — same tone as the existing ADRs.
4. **Architecture relocation:** move `docs/architecture.md` → `docs/architecture/overview.md` via `git mv` (no live links break); link from the new `docs/README.md`.

---

**Plan approved — executing Phase 3 onward.** Checkboxes above are ticked as work completes.
