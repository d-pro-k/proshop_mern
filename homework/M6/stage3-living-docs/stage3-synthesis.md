# Living-Documentation Synthesis — proshop_mern

**Date:** 2026-06-01
**Method:** legacy-auditor-mate orchestration (discovery → existing-docs audit → plan → reverse-engineering → aggregation → automation), reusing the consolidated code review as the findings input rather than re-running specialist agents.

This document aggregates the reverse-engineering specs and the reused review findings into one picture and records what the living-documentation pack produced. It does not replace the consolidated code review (`../stage1-code-review/synthesis.md`), which remains the authoritative findings register.

## What was produced

| Artifact | Location | Purpose |
|---|---|---|
| Machine-readable repo map | `project-index.json` (repo root) | Subprojects, tech stack, system folders, hard rules, AI routing, filesystem tree. The "read first" entry point. |
| Docs index | `docs/README.md` | Navigable index of architecture, specs, ADRs, and the findings register. |
| Architecture overview | `docs/architecture/overview.md` | Relocated current-state runtime architecture (additive reorg). |
| Module specs (6) | `docs/specs/*.md` | Reverse-engineered behavior for orders, auth, catalog, feature-flags, retrieval, and client-state. |
| New ADRs (2) | `docs/adr/0004-*.md`, `docs/adr/0005-*.md` | Records the previously undocumented retrieval and feature-flags decisions. |
| Archived snapshot | `docs-archived-2026-06-01/FINDINGS.md` | Earlier findings table, preserved for history (superseded). |
| Index automation | `.claude/scripts/update_project_index.py` + hooks | Keeps the filesystem map current. |

## Findings reused (from the consolidated code review)

The earlier review consolidated 35 findings (12 HIGH / 15 MEDIUM / 8 LOW) across the whole repo. The security fixes that have since landed closed the most severe access-control issues (payment-path and order IDOR authorization, the JWT algorithm pin, feature-flag read protection). The specs below describe current behavior and carry the remaining items forward as per-module open questions and suggested tests rather than re-litigating them here.

## Cross-spec themes

Reading the six specs together, four themes recur — each is a place where a small, shared abstraction would retire several findings at once:

1. **Feature-flags surface.** A flat JSON store with two readers and two contradictory admin UIs, re-parsed per request. Captured in `docs/specs/feature-flags-spec.md` and formalized in ADR-0005; the open work is one shared access module with caching.
2. **Retrieval divergence.** The served MCP path is dense-only while the stronger hybrid+rerank pipeline is detached on a separate collection, with embedding code duplicated across files. Captured in `docs/specs/retrieval-spec.md` and ADR-0004; the open work is one canonical pipeline behind one shared module.
3. **Unbounded reads.** Several list endpoints (orders, users) are unpaginated and some hot paths are unindexed (`order.user`, keyword `$regex`, top products). Spread across the orders and catalog specs.
4. **Input trust at the edges.** Payment payloads, review submissions, and localStorage hydration each assume well-formed input; malformed input degrades from a validation problem to a crash. Spread across orders, catalog, and client-state specs.

## Existing-docs treatment (additive)

The repo's documentation was accurate and was kept, not rebuilt: ADRs 0001–0003, the architecture overview, `README.md`, `AGENTS.md`, `DESIGN.md`, and `design-system/` were preserved. The only archived item is the earlier `FINDINGS.md` table (superseded by the consolidated review and partly stale). The `rag/docs-corpus/` tree was explicitly left untouched — it is indexed retrieval data, not documentation about this repository.

## Module spec index

- `docs/specs/orders-spec.md` — 13 edge cases
- `docs/specs/auth-spec.md` — 13 edge cases
- `docs/specs/feature-flags-spec.md` — 15 edge cases
- `docs/specs/retrieval-spec.md` — 14 edge cases
- `docs/specs/catalog-spec.md` — 14 edge cases
- `docs/specs/client-state-spec.md` — 14 edge cases
