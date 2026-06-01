# Architecture Review — ProShop MERN Fork (Stage 1 Code Review)

**Reviewer role:** Senior Software Architect (read-only review)
**Scope:** Whole fork — `backend/` (controllers, routes, models, middleware, config, `server.js`, `features.json`), `frontend/src/` (Redux store, screens/components, feature-flags admin), `mcp/feature-flags/src`, `mcp/search-docs/src`, `rag/` (`ingest*.ts`, `query.ts`, `hybrid*.ts`, `bm25.ts`, `rerank.ts`), and root config (`docker-compose.yml`, `Procfile`, `package.json`).
**Out of scope:** `node_modules/`, build output, tests, `scripts/`, `frontend/public/`, `qdrant_storage/`, `uploads/`, `experiments/`, `assignments/`.
**Method:** Read the 3 ADRs and `AGENTS.md` first, then a manual source walk of in-scope files. Each finding has `file:line`, criticality (C1/C2/C3), and a concrete fix. Cross-referenced against the prior `security-review.md` (SEC-xx) and `performance-review.md` (PERF-xx).
**ADRs loaded:** 3 — 0001 (split MERN), 0002 (Redux/thunk/localStorage), 0003 (JWT bearer + admin middleware).

## Summary

| Criticality | Count |
|-------------|-------|
| C1 (critical) | 2 |
| C2 (important) | 3 |
| C3 (minor) | 3 |
| **Total** | **8** |

**Most important boundary / ADR-compliance issue:** The self-built RAG/MCP retrieval subsystem has no architectural ownership. `embed()` is copy-pasted across **6 files** (ARCH-01), and the **served** retrieval interface — the `search-docs` MCP server that `AGENTS.md` mandates agents use first — is hardwired to the dense-only `proshop_docs` collection, while the better hybrid + cross-encoder-rerank pipeline exists only as detached CLIs against a *different* collection (ARCH-02). The best-quality retrieval path is unreachable from the interface that is actually consumed. None of this is covered by an ADR.

## ADR compliance baseline (ARCH-08)

The three existing ADRs hold for the legacy MERN core:

- **ADR-0001 (split MERN, Express-served CRA):** COMPLIES. `backend/server.js:38-45` serves `/api/*`, `/uploads`, and `frontend/build` in production; the frontend uses relative `/api/...` paths. Caveat: the new Qdrant/Ollama/MCP/RAG services are absent from `docker-compose.yml` and from ADR-0001's "simple production topology" (see ARCH-06).
- **ADR-0002 (Redux + thunk + localStorage):** COMPLIES in the core (`store.js` intact), but VIOLATED locally by the duplicate feature-flags admin screen that bypasses Redux with a raw-fetch hook (ARCH-03).
- **ADR-0003 (JWT bearer + protect/admin):** COMPLIES for orders/users (middleware composed at the route boundary, no inline authz). The feature-flags read routes are public, which sits in tension with the ADR's boundary-enforcement principle (ARCH-07, cross-ref SEC-04).

## Findings

### ARCH-01 — `embed()` and Qdrant helpers duplicated across 6 files (C1, HIGH)
`mcp/search-docs/src/index.ts:23` + `rag/query.ts:76` + `rag/ingest.ts:96` + `rag/hybrid.ts:13` + `rag/hybrid-rerank.ts:15` + `rag/ingest-hybrid.ts:80`. The Ollama embedding call (same endpoint, same `bge-m3` model, same error handling) is copy-pasted six times. `buildFilter()`, `snippet()`, the `PointPayload` type, and the Qdrant client are duplicated between `rag/query.ts` and the search-docs MCP. There is no shared retrieval/embedding module, so a change to the embedding contract must be made in six places.
**Fix:** Extract `rag/lib/embeddings.ts` and `rag/lib/qdrant.ts`; have both the RAG CLIs and the MCP server import them, with one canonical set of URL/model/collection defaults.

### ARCH-02 — Served MCP retrieval is dense-only; the better pipeline is unreachable (C1, HIGH)
`mcp/search-docs/src/index.ts:8` vs `rag/hybrid.ts:6` / `rag/hybrid-rerank.ts:8`. The MCP server (the interface agents actually call, per `AGENTS.md` "Searching Product Documentation") does a plain `qdrant.search` against collection `proshop_docs`. The hybrid dense+sparse RRF and hybrid+cross-encoder-rerank pipelines exist only as standalone CLIs against a *different* collection, `proshop_docs_hybrid`. The higher-quality retrieval design is never exposed through the served interface.
**Fix:** Decide the canonical retrieval design and document it (Proposed ADR-0004). Route the MCP server through the chosen pipeline/collection, or explicitly record why it stays dense-only.

### ARCH-03 — Feature-flags admin UI implemented twice with contradictory state patterns (C2, MEDIUM) — ADR-0002
`frontend/src/screens/admin/hooks/useFeatures.js:35` + `frontend/src/App.js:53-54`. `DashboardFeaturesScreen.js` uses the ADR-0002 Redux/thunk path (`featureFlagActions` + `featureFlagListReducer`, registered in `store.js:55`). `admin/FeatureFlagsScreen.jsx` uses a parallel `useFeatures` hook doing raw `fetch('/api/feature-flags')` into local `useState`, bypassing Redux. Both are live routes. This violates ADR-0002's "default to Redux/thunk for API-backed cross-screen state."
**Fix:** Choose one screen as canonical; delete the other implementation and its dead route. If the local-fetch hook is intentional, record the exception explicitly.

### ARCH-04 — `features.json` has two owners and no shared schema/access module (C2, MEDIUM)
`backend/controllers/featureFlagController.js:9` + `mcp/feature-flags/src/index.ts:31`. The Express controller (read-only) and the MCP server (read + atomic write, owner of the `Feature` interface, `Status` enum, traffic-canonicalisation, and dependency-warning rules) each re-implement `readFeatures()` against the same file. The data contract lives only in the MCP server; the backend duplicates the read path and the entry-shaping with no shared definition.
**Fix:** Introduce a single feature-flags access module owning schema, validation, read, and atomic write, consumed by both the controller and the MCP server. See Proposed ADR-0005 for the file-as-store decision.

### ARCH-05 — Business/persistence logic leaks into the wiring and controller layers (C2, MEDIUM)
`backend/server.js:33` + `backend/controllers/featureFlagController.js:9`. `server.js` (the composition root) carries an inline route handler with logic (`res.send(process.env.PAYPAL_CLIENT_ID)`), bypassing the routes->controller convention every other endpoint follows. Separately, `featureFlagController` performs direct filesystem I/O (`readFile` + `JSON.parse`) inside the controller — persistence logic the layering convention would place behind a service/model.
**Fix:** Move the PayPal-config endpoint into a controller behind a route. Extract `features.json` access into a service/shared module (resolves with ARCH-04) so controllers orchestrate and the file-access detail sits behind an abstraction.

### ARCH-06 — Service-endpoint config drift; RAG/MCP absent from orchestrated topology (C3, LOW)
`mcp/search-docs/src/index.ts:6` vs `rag/query.ts:28` / `rag/ingest.ts:38`. The MCP server defaults `QDRANT_URL`/`OLLAMA_URL` to `localhost`, every `rag/*.ts` file to `127.0.0.1`. On hosts where these resolve differently (IPv6 `::1`, containers), the served path and the ingest job can target different endpoints. `docker-compose.yml` defines only `mongo`/`backend`/`frontend` — qdrant/ollama/mcp/rag are outside the orchestrated topology described by ADR-0001.
**Fix:** Centralise the URL/collection defaults in one shared config (resolves with ARCH-01) and pick a single literal. Document where the RAG/MCP services run relative to ADR-0001, or add them to compose.

### ARCH-07 — Controller route annotations contradict mounted verbs/access (C3, LOW) — ADR-0003
`backend/controllers/orderController.js:111,135` + `backend/controllers/featureFlagController.js:17`. `updateOrderToPaid`/`updateOrderToDelivered` are annotated `@route GET ...` but mounted as `PUT`. The feature-flags reads are `@access Public`, accurate but in tension with ADR-0003's route-boundary enforcement (cross-ref SEC-04 — unauthenticated). The JSDoc annotations are the nearest thing to an API contract and have drifted.
**Fix:** Correct the JSDoc verbs. Decide whether feature-flags reads should be protected per ADR-0003 (cross-ref SEC-04) and add `protect`/`admin` or document the public exception.

### ARCH-08 — ADR compliance baseline (C3, INFO)
See "ADR compliance baseline" above. ADR-0001/0002/0003 hold for the MERN core; the deviations are ARCH-02..ARCH-07; the MCP/RAG subsystems are undocumented (Proposed ADR-0004/0005).

## Cross-references to prior reviews

| Architecture finding | Security (SEC) | Performance (PERF) | Relationship |
|---|---|---|---|
| ARCH-01 (duplicated embed/Qdrant helpers) | — | PERF-07 | The duplicated retrieval boundary is also where the per-query Python process spawn (PERF-07) lives; consolidating into a shared retrieval module is the natural home for a long-lived reranker worker. |
| ARCH-04 (features.json two owners, no abstraction) | — | PERF-03 | Same uncached read-per-call pattern PERF-03 flags in both the controller and the MCP server; a single access module is where the in-memory cache + write-path invalidation belongs. |
| ARCH-05 (file I/O in controller; logic in server.js) | SEC-18 | PERF-03 | The inline `/api/config/paypal` handler is SEC-18 (raw env echo); the controller file I/O is the PERF-03 hot path. |
| ARCH-07 (annotation/verb drift; public flags) | SEC-04 | PERF-03 | The "Public" feature-flags reads are SEC-04 (broken access control) and PERF-03 (public amplification). The architectural question — should these be behind ADR-0003 middleware — is the root both reviews touch. |
| ARCH-03 (duplicate flags UI bypassing Redux) | SEC-04 | — | The bypass screen (`FeatureFlagsScreen.jsx`) is the one SEC-04 cites for its client-side-only admin guard. |

---

## Proposed ADRs

Two significant architectural decisions in this fork are currently undocumented. Drafts below (Nygard format).

### ADR-0004: Retrieval architecture for the documentation RAG / MCP subsystem

**Status:** Proposed (drafted during Stage 1 architecture review)
**Date:** 2026-05-31
**Deciders:** TBD (PR author + tech lead)

#### Context
The fork adds a documentation-search subsystem: an Ollama `bge-m3` embedder, a Qdrant vector store, and a `search-docs` MCP server that `AGENTS.md` mandates agents call before reading source. `rag/` also contains a richer hybrid (dense + BM25 sparse, RRF fusion) and a hybrid + cross-encoder-rerank pipeline. Today these are split across two collections (`proshop_docs` dense-only, `proshop_docs_hybrid`), the embedding/client code is duplicated in six files, and the **served** MCP path uses only the weakest (dense-only) variant. There is no document recording which retrieval design is canonical or how the pieces relate.

#### Decision
Adopt **one** canonical retrieval pipeline (recommended: hybrid + optional rerank against a single named collection) and make the `search-docs` MCP server the single served entry point that uses it. Embedding, Qdrant client, filtering, and snippet logic live in one shared `rag/lib` module imported by both the CLIs and the MCP server. Collection name, `QDRANT_URL`, `OLLAMA_URL`, and embedding model are defined once.

#### Consequences
**Positive:** Served retrieval quality matches the best experimental quality; one place to change the embedding/collection contract; reproducible ingest↔query parity.
**Negative / trade-offs:** Requires reconciling the two collections and a one-time ingest; the rerank worker (PERF-07) must become long-lived to keep latency acceptable.
**Risks:** Collection migration could regress recall if ingest config drifts; mitigated by versioning the collection name and pinning the embedding model.

#### Alternatives considered
- Keep dense-only in the MCP and hybrid as research CLIs — rejected: served quality permanently lags, two collections drift.
- Expose all three pipelines as separate MCP tools — rejected: pushes retrieval-strategy choice onto the calling agent and multiplies the surface to maintain.

### ADR-0005: Feature flags stored as a JSON file with MCP-owned writes

**Status:** Proposed (drafted during Stage 1 architecture review)
**Date:** 2026-05-31
**Deciders:** TBD (PR author + tech lead)

#### Context
Feature flags live in `backend/features.json` (~25 flags, ~14KB). The `feature-flags` MCP server owns the write path (atomic tmp+rename) and the schema/invariants (`Status` enum, traffic canonicalisation, dependency warnings). The Express `featureFlagController` independently reads and re-parses the same file per request and exposes read-only HTTP endpoints. The frontend consumes those endpoints two different ways (ARCH-03). No ADR records that a flat file — not the MongoDB the rest of the app uses — is the flag store, nor that the MCP is the authoritative writer.

#### Decision
Treat `backend/features.json` as the canonical flag store for this legacy fork, with the **MCP server as the sole writer** and the backend as a read-only consumer. The flag schema and all read/write access go through **one shared module** owning validation, in-memory caching with write-path invalidation, and the atomic write. HTTP read endpoints reuse that module rather than re-reading the file.

#### Consequences
**Positive:** Single source of truth for the flag contract; eliminates the duplicate read path (ARCH-04) and the uncached read-per-request (PERF-03); keeps the file simple/diffable.
**Negative / trade-offs:** A flat file gives no concurrent multi-writer safety beyond atomic rename and no horizontal scaling; flag writes are not transactional with MongoDB data.
**Risks:** Two processes writing (if the backend ever gains a write path) would race; mitigated by keeping the MCP the only writer. The public read endpoints remain a security/perf concern (SEC-04 / PERF-03) until access is decided (ARCH-07).

#### Alternatives considered
- Store flags in MongoDB like the rest of the domain — rejected for now: heavier for ~25 flags and breaks the MCP's simple file-edit model; revisit if flags grow or need per-environment values.
- Let the backend write flags too — rejected: reintroduces the dual-owner race ADR-0005 exists to prevent.

---

## Coverage notes

- **Layer boundaries:** controllers/routes/models/middleware split is clean for orders/products/users; the leaks are the inline `server.js` handler and file I/O in `featureFlagController` (ARCH-05).
- **Coupling / duplication:** the dominant issue is the RAG/MCP subsystem (ARCH-01, ARCH-02) and the dual feature-flags owners/UIs (ARCH-03, ARCH-04).
- **ADR compliance:** ARCH-08 confirms 0001/0002/0003 hold in the core; deviations and undocumented decisions are captured per-finding and in the two proposed ADRs.
- **No new abstractions invented gratuitously** — the recommended `rag/lib` and feature-flags modules consolidate behaviour that is *already* repeated 6× and 2× respectively (per `AGENTS.md` "Do not introduce new cross-cutting abstractions unless repeated behavior already exists").
