# Documentation

Reference documentation for `proshop_mern` — a legacy MERN ecommerce app extended with two MCP servers, a RAG retrieval pipeline, and a JSON-backed feature-flags layer. Start with `project-index.json` at the repository root for the machine-readable map of the codebase.

## Contents

### Architecture
- [`architecture/overview.md`](architecture/overview.md) — current-state runtime architecture: the request and data flow between the browser, the React/Redux frontend, the Express API, MongoDB, PayPal, and file uploads (with a Mermaid diagram).

### Module specs
Reverse-engineered specifications for the key subsystems — each covers business logic, a decision table, a sequence diagram, edge cases, open questions, and suggested tests.

- [`specs/orders-spec.md`](specs/orders-spec.md) — order creation, server-side pricing, ownership authorization, pay/deliver lifecycle.
- [`specs/auth-spec.md`](specs/auth-spec.md) — JWT issue/verify, `protect`/`admin` middleware, registration/login/profile, password hashing.
- [`specs/catalog-spec.md`](specs/catalog-spec.md) — product listing, keyword search, reviews, top-rated products, admin CRUD.
- [`specs/feature-flags-spec.md`](specs/feature-flags-spec.md) — `features.json` model, backend read routes, the feature-flags MCP writer, and the (duplicated) admin UI.
- [`specs/retrieval-spec.md`](specs/retrieval-spec.md) — the `search-docs` MCP server and the RAG ingest/query/hybrid/rerank pipeline.
- [`specs/client-state-spec.md`](specs/client-state-spec.md) — Redux store, localStorage hydration, and the checkout flow.

### Architecture Decision Records
- [`adr/0001-use-split-mern-application.md`](adr/0001-use-split-mern-application.md)
- [`adr/0002-use-redux-thunk-and-localstorage-for-client-state.md`](adr/0002-use-redux-thunk-and-localstorage-for-client-state.md)
- [`adr/0003-use-jwt-bearer-auth-with-admin-middleware.md`](adr/0003-use-jwt-bearer-auth-with-admin-middleware.md)
- [`adr/0004-retrieval-via-mcp-over-qdrant.md`](adr/0004-retrieval-via-mcp-over-qdrant.md)
- [`adr/0005-feature-flags-as-json-with-mcp-writer.md`](adr/0005-feature-flags-as-json-with-mcp-writer.md)

## Findings & risk register

The current, comprehensive code review lives in [`../homework/M6/stage1-code-review/synthesis.md`](../homework/M6/stage1-code-review/synthesis.md) (security, performance, and architecture findings across the whole repo). Each module spec also lists module-specific open questions and suggested tests.

An earlier high-risk findings table is preserved for history at [`../docs-archived-2026-06-01/FINDINGS.md`](../docs-archived-2026-06-01/FINDINGS.md); it predates the current subsystems and several of its status cells are stale — treat the consolidated review above as authoritative.

## Related references

- [`../README.md`](../README.md) — setup, environment, and run instructions.
- [`../AGENTS.md`](../AGENTS.md) — conventions, guardrails, and repo navigation.
- [`../DESIGN.md`](../DESIGN.md) — visual design language (backed by `../design-system/`).
- `../rag/docs-corpus/` — the documentation corpus indexed by the search-docs MCP. This is retrieval **input data**, not documentation about this repository; do not reorganize it.
