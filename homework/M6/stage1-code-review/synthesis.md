# Code Review Synthesis — ProShop MERN Fork (Stage 1)

**Date:** 2026-05-31
**Reviewer:** 3-agent team — security-mate + performance-mate + architecture-mate (sequential, read-only)
**Scope:** Whole fork — `backend/` (Express/Mongoose API), `frontend/src/` (React/Redux SPA), `mcp/feature-flags` + `mcp/search-docs` (MCP servers), `rag/` (Qdrant ingest/query/hybrid/rerank), root config.
**Inputs:** `security-review.md` (18), `performance-review.md` (9), `architecture-review.md` (8) — 35 findings total.

This document is the control input for Stage 2 (fix Top-3) and is reused as architectural context for Stage 3.

## Totals

| Source | HIGH / C1 | MEDIUM / C2 | LOW / C3 | Total |
|---|---|---|---|---|
| security-mate | 6 | 9 | 3 | 18 |
| performance-mate | 4 | 3 | 2 | 9 |
| architecture-mate | 2 | 3 | 3 | 8 |
| **All** | **12** | **15** | **8** | **35** |

---

## HIGH severity (12)

**Access control & payment (most severe cluster)**
- **SEC-02** `backend/controllers/orderController.js:113` — Payment bypass: `updateOrderToPaid` sets `isPaid=true` + stores `paymentResult` from `req.body` with no ownership check and no server-side PayPal verification. Any authenticated user can mark any order paid with forged data.
- **SEC-01** `backend/controllers/orderController.js:96` — IDOR: `getOrderById` returns any order to any authenticated user (no ownership/admin check) → leaks shipping address + PayPal payer email by enumerating ObjectIds.
- **SEC-04** `backend/server.js:31` + `routes/featureFlagRoutes.js` — Feature-flags read API is unauthenticated; the only admin guard is a client-side `useEffect` redirect (trivially bypassed). *Cross-mate cluster: PERF-03, ARCH-07, ARCH-03.*

**Auth integrity & dependencies**
- **SEC-03** `backend/middleware/authMiddleware.js:15` — `jwt.verify` with no `algorithms` allow-list on vulnerable `jsonwebtoken@8.5.1` (signature-bypass / RSA→HMAC key-confusion CVEs).
- **SEC-11** `package.json` — 16 backend dependency advisories (1 critical, 10 high): `jsonwebtoken<=8.5.1`, `multer`/`dicer` DoS reachable from public `/api/upload`, `body-parser`/`qs` DoS.
- **SEC-12** `frontend/package.json` — `react-scripts@3.4.3` (2020) drags in years-stale transitive advisories; already needs `--openssl-legacy-provider`.

**Performance hot paths (missing indexes, unbounded I/O)**
- **PERF-01** `backend/models/orderModel.js:5` / `orderController.js:158` — no index on `order.user`; `getMyOrders` is a full collection scan (~50–300ms p95 at 10k orders).
- **PERF-02** `backend/controllers/productController.js:20-23` — keyword search uses unindexed case-insensitive `$regex` → two full scans/request. *Cross-ref SEC-05 (ReDoS).*
- **PERF-03** `backend/controllers/featureFlagController.js:9-12` + `mcp/feature-flags/src/index.ts:31` — `features.json` (~14KB) read + `JSON.parse` on every request, uncached, on a public route. *Cross-mate: SEC-04, ARCH-04.*
- **PERF-04** `backend/controllers/orderController.js:165-166`, `userController.js:110-111` — unpaginated list endpoints return whole collections (unbounded payload + heap; OOM risk under admin load).

**Architecture (undocumented retrieval subsystem)**
- **ARCH-01** (C1) — `embed()` + Qdrant helpers copy-pasted across 6 files (`mcp/search-docs/src/index.ts:23`, `rag/query.ts:76`, `rag/ingest.ts:96`, `rag/hybrid.ts:13`, `rag/hybrid-rerank.ts:15`, `rag/ingest-hybrid.ts:80`). *Cross-ref PERF-07.*
- **ARCH-02** (C1) — Served `search-docs` MCP is dense-only (`proshop_docs`); the better hybrid + rerank pipeline exists only as detached CLIs against a different collection (`proshop_docs_hybrid`). The best retrieval path is unreachable from the interface `AGENTS.md` mandates.

## MEDIUM severity (15)

- **SEC-05** `productController.js:11` — regex injection / ReDoS in product search. *Cross-ref PERF-02.*
- **SEC-06** `docker-compose.yml:21` — hardcoded weak fallback `JWT_SECRET`.
- **SEC-07** `userController.js:8` — no rate limiting on login/register.
- **SEC-08** `userController.js:30` — no server-side input validation / password policy.
- **SEC-09** `userController.js:82,147` — mass-assignment on profile / admin user update (silent `isAdmin` demotion).
- **SEC-10** `backend/models/userModel.js:34` — password pre-save hook re-hashes already-hashed passwords (missing `return next()`) → credential corruption / auth lockout.
- **SEC-13** `backend/routes/uploadRoutes.js:18` — unsafe upload: extension/MIME-only, no size limit, no auth.
- **SEC-14** `backend/server.js:25` — missing security headers (`helmet`) / CORS / body-size cap. *Cross-ref PERF-05.*
- **SEC-15** `frontend/src/actions/userActions.js:53` — long-lived (30-day), non-revocable JWT in `localStorage`.
- **PERF-05** `backend/server.js:25` — `express.json()` with no size limit (synchronous parse of large bodies). *Cross-ref SEC-14.*
- **PERF-06** `frontend/src/App.js:6-22` — one un-split bundle ships admin + PayPal + devtools to every shopper (~+150–300KB gzipped).
- **PERF-07** `rag/rerank.ts:19` — reranker spawns a fresh Python process (cold model load) per query. *Cross-ref ARCH-01.*
- **ARCH-03** (C2) — feature-flags admin UI implemented twice with contradictory state patterns (Redux vs raw-fetch hook); violates ADR-0002. *Cross-ref SEC-04.*
- **ARCH-04** (C2) — `features.json` has two owners, no shared schema/access module. *Cross-ref PERF-03.*
- **ARCH-05** (C2) — business/persistence logic leaks into `server.js` (inline `/api/config/paypal`) and controller-level file I/O. *Cross-ref SEC-18, PERF-03.*

## LOW severity (8)

- **SEC-16** `authMiddleware.js:21` — no security audit logging; raw stack-trace dumps.
- **SEC-17** `mcp/search-docs/src/index.ts:24` — SSRF surface via unvalidated `OLLAMA_URL`/`QDRANT_URL`.
- **SEC-18** `backend/server.js:33` — `/api/config/paypal` echoes a raw env value unauthenticated. *Cross-ref ARCH-05.*
- **PERF-08** `productController.js:154-156` — `getTopProducts` recomputes an unindexed sort on every homepage load.
- **PERF-09** `productController.js:137-143` — `createProductReview` re-reduces and rewrites the whole embedded reviews array.
- **ARCH-06** (C3) — service-endpoint config drift; RAG/MCP absent from `docker-compose.yml` topology.
- **ARCH-07** (C3) — controller JSDoc verbs/access contradict mounted routes; public flags in tension with ADR-0003. *Cross-ref SEC-04.*
- **ARCH-08** (C3) — ADR compliance baseline: 0001/0002/0003 hold for the MERN core; MCP/RAG undocumented (→ proposed ADR-0004, ADR-0005).

---

## Cross-mate observations (flagged by ≥2 reviewers)

| Theme | Findings | Root |
|---|---|---|
| Feature-flags public + uncached + duplicated | **SEC-04 + PERF-03 + ARCH-07 + ARCH-03 + ARCH-04** | Public, unauthenticated read of a per-request-parsed file with two owners and two UIs. Single highest-overlap cluster. |
| Keyword product search | **SEC-05 + PERF-02** | Unindexed case-insensitive `$regex`: ReDoS (security) + full scans (performance) compound. |
| Request body size | **SEC-14 + PERF-05** | No `express.json({ limit })` → DoS + synchronous large-body parse. |
| PayPal config endpoint | **SEC-18 + ARCH-05** | Inline `server.js` handler echoing a raw env value. |
| Retrieval / rerank boundary | **PERF-07 + ARCH-01** | Duplicated embed code is where the per-query process spawn lives; one shared `rag/lib` module is the home for a long-lived reranker. |

**Proposed ADRs (from architecture-mate):** ADR-0004 (canonical retrieval architecture for the RAG/MCP subsystem); ADR-0005 (feature-flags-as-JSON file with MCP as sole writer). Full drafts in `architecture-review.md`.

---

## Recommended fix order (top 5)

1. **SEC-02** — payment bypass (`updateOrderToPaid`): highest blast radius (financial + access control). Add ownership/admin check; stop trusting client-supplied paid status.
2. **SEC-01** — IDOR (`getOrderById`): same root (missing ownership authorization); small, high-impact fix.
3. **SEC-03** — pin JWT `algorithms` allow-list (and plan the `jsonwebtoken>=9` upgrade): app-wide auth integrity.
4. **PERF-01** — add `orderSchema.index({ user: 1, createdAt: -1 })`: one-line, removes a hot-path collection scan and covers sort + admin list.
5. **SEC-04 / PERF-03 / ARCH-04** (cluster) — protect the feature-flags read routes and add an in-memory cache behind a single access module: closes one security + one performance + one architecture finding together.

---

## Top-3 для Stage 2

Selected by severity/impact across the whole repository. All three are HIGH, dependency-free at the minimal-fix level, and have clear current-behavior contracts suitable for characterization tests before the fix.

| # | File:line | Issue | Recommended fix | Effort |
|---|---|---|---|---|
| 1 | `backend/controllers/orderController.js:113` | **SEC-02** — payment bypass: `updateOrderToPaid` trusts `req.body` with no ownership check | Require requester owns the order or is admin before marking paid; do not accept client-controlled paid state blindly | ~1h |
| 2 | `backend/controllers/orderController.js:96` | **SEC-01** — IDOR: `getOrderById` returns any order to any authenticated user | Return 403 unless `order.user === req.user._id` or `req.user.isAdmin` | ~30m |
| 3 | `backend/middleware/authMiddleware.js:15` | **SEC-03** — `jwt.verify` with no algorithm allow-list (token forgery) | Pass `{ algorithms: ['HS256'] }` to `jwt.verify`; characterize current verify behavior first | ~30m |

> **Note for Stage 2 (non-binding):** #1 and #2 share one root (missing ownership authorization in `orderController.js`) and may be fixed as two distinct endpoints. If a more diverse fix set is preferred over strict severity ranking, the next-highest distinct candidates are **PERF-01** (one-line index), **SEC-10** (one-line `return next()` credential-corruption bug — an ideal safe-refactor characterization demo), or the **SEC-04/PERF-03/ARCH-04** cluster. Final selection is confirmed at the start of Stage 2.

---

## Token usage estimate

Sequential sub-agent reviews (Agent tool, `claude-opus-4-8`), separate from main-session context:

| Reviewer | Sub-agent tokens | Tool uses |
|---|---|---|
| security-mate | ~75K | 38 |
| performance-mate | ~78K | 31 |
| architecture-mate | ~66K | 30 |
| **Total (3 sub-agents)** | **~219K** | **99** |

Synthesis (this document) was assembled by the main agent reading the three `*-review.md` files — no additional sub-agent spawned.
