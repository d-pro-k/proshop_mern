# Existing docs audit — proshop_mern

> Phase 1.5 verdicts on every existing documentation file/folder. Goal: never discard valid documentation. Each item is read, compared to code reality, and classified.

**Auditor:** legacy-auditor-mate (claude-opus-4-8)
**Audit date:** 2026-06-01
**Repo:** `proshop_mern` — legacy MERN ecommerce app extended with two MCP servers, a RAG pipeline, and a feature-flags layer.
**Existing docs scanned:** 9 documentation files + 2 doc folders (ADRs, design-system); plus 2 items explicitly held out of scope.

---

## Verdict legend

| Symbol | Verdict | Action |
|---|---|---|
| ✅ | **ACCURATE** — matches code, well-maintained | Keep as-is in the new docs structure |
| 🔄 | **PARTIALLY ACCURATE** — mostly right, has stale sections | Keep + add `TODO(audit-2026-06-01): <what>` markers |
| 📦 | **HISTORICAL** — old but worth preserving | Move to `docs-archived-2026-06-01/`, never `rm`; link from new index |
| ❌ | **STALE / REDUNDANT** — outdated and superseded | Archive first (never delete), then ignore |

---

## Inventory

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/adr/` (0001–0003) | folder (3 files) | ✅ ACCURATE | Split-MERN, Redux/Thunk/localStorage, and JWT-bearer decisions all match current code. Numbering coherent. | Keep in place; do **not** restart numbering. Add new ADRs as 0004+. |
| `docs/architecture.md` | file (~3.7 KB) | ✅ ACCURATE | Current-state diagram + runtime flow match `backend/server.js`, routes, controllers, models, PayPal, uploads. | Relocate to `docs/architecture/overview.md` (additive reorg). |
| `README.md` | file (~8.8 KB) | ✅ ACCURATE | Setup, env vars, ports, Docker Compose, troubleshooting all verified against manifests and code. | Keep as-is. |
| `AGENTS.md` | file (~8.8 KB) | ✅ ACCURATE | Overview, stack, architecture, conventions, MCP-tool guidance all reflect the repo. | Keep; **append** two navigation sections (additive, do not rewrite). |
| `DESIGN.md` | file (~22 KB) | ✅ ACCURATE | Visual language spec; referenced by `AGENTS.md`; backs `design-system/`. | Keep as-is (root file, out of `docs/` reorg). |
| `design-system/` | folder (3 files) | ✅ ACCURATE | `tokens.json` + `globals.css` + README; machine-readable source of truth for the design language. | Keep as-is. |
| `CLAUDE.md` | file (71 B) | ✅ ACCURATE | One-line pointer to `AGENTS.md`. | Keep as-is. |
| `FINDINGS.md` | file (~4.5 KB) | 📦 HISTORICAL | Earlier high-risk findings table. Now superseded by the comprehensive 35-finding `stage1-code-review/synthesis.md`; several status cells are stale after the security fixes that landed since. Worth preserving as a snapshot. | **Decision for approval** — recommend archive + link from new docs index (see open questions). |
| `frontend/README.md` | file | ❌ STALE / REDUNDANT | Default Create React App boilerplate; no project-specific value. | Leave in place (CRA convention file inside `frontend/`); out of `docs/` reorg scope — not archived to avoid noise. |
| `report.md` | file (~30 KB) | — out of scope | Graded per-module course write-up, not repository documentation. | Leave untouched. |
| `rag/docs-corpus/**` | folder (~40 files) | — out of scope | Fixture **data corpus** the search-docs MCP indexes (synthetic API/runbooks/features/ADRs). Input data, not docs about this repo. | Do **not** reorganize or archive. |
| `experiments/characterization/` | folder (4 files) | 📦 HISTORICAL | Standalone characterization/refactoring exercise; a learning artifact, not live docs. | Leave in place; reference from the new docs index as historical (do not move). |

---

## Summary

- ✅ Keep as-is / additive: **7** items (`docs/adr/`, `docs/architecture.md`, `README.md`, `AGENTS.md`, `DESIGN.md`, `design-system/`, `CLAUDE.md`)
- 🔄 Update + keep: **0** items
- 📦 Archive (historical): **1** item recommended (`FINDINGS.md`) + `experiments/characterization/` referenced in place
- ❌ Archive (stale): **0** moved (`frontend/README.md` flagged but left as CRA convention)
- Out of scope (not docs): **2** (`report.md`, `rag/docs-corpus/`)

**Total:** 12 items reviewed.

---

## Cross-references to preserve

- **ADR numbering** — keep `docs/adr/0001..0003`; new ADRs continue from 0004. Do not restart.
- `docs/architecture.md` → becomes `docs/architecture/overview.md`; link it from the new `docs/README.md` index.
- `AGENTS.md` → `DESIGN.md` link must survive (Design rules section).
- `AGENTS.md` MCP-tool guidance (search-docs / feature-flags) → mirror as routing entries in `project-index.json`.
- If `FINDINGS.md` is archived → link the archived copy from `docs/README.md` and point readers to `stage1-code-review/synthesis.md` as the current findings source.
- `rag/docs-corpus/` is a data fixture — note in the index so it is never mistaken for documentation.

---

## Notes for Phase 2 planning

- The repo is documentation-rich and accurate; this is an **additive** reorg, not a rebuild. Most existing docs are kept verbatim.
- The only genuine archive candidate is `FINDINGS.md` (superseded). This is the central approval decision.
- `docs/adr/` and `rag/docs-corpus/` must not be touched blindly — one is canonical decisions, the other is indexed fixture data.
- New value comes from: a repo-root `project-index.json` map, per-module reverse-engineering specs under `docs/specs/`, two navigation sections appended to `AGENTS.md`, and an index-refresh script + hook.
