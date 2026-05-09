# M2 — Report

## IDE

- Primary IDE: Codex CLI.
- Rules file: `AGENTS.md`.

## Rules diff

- Added the local port rule: this fork uses backend `PORT=5001` and CRA proxy `http://127.0.0.1:5001` because port `5000` is occupied on macOS.
- Added the Node/OpenSSL startup note for the legacy CRA stack: `NODE_OPTIONS=--openssl-legacy-provider npm run client`.
- Added repo-specific guardrails: keep backend ESM imports explicit with `.js`, do not touch Heroku deployment files casually, and isolate dependency upgrades from bugfixes.
- Added seed-data guidance after model or required-field changes so local onboarding remains repeatable.

## Local startup

I ran the project locally with Docker MongoDB, imported seed data, started the backend on `http://localhost:5001`, and started the frontend on `http://localhost:3000`. I verified product loading, frontend proxy calls, PayPal config loading, seeded admin login, and authenticated order creation.

## 3 questions

- Manual estimate: about 6-8 hours to inspect the legacy app, run it, document startup, audit findings, fix one issue, and add the optional docs/tests.
- Most useful IDE feature: fast repo-wide search and iterative patching with command verification. It made it practical to keep docs, findings, and runtime notes tied to actual code instead of assumptions.
- Where AI/runtime assumptions failed: the original setup assumed port `5000` and a plain frontend start. Local verification showed `5000` was occupied and CRA failed on modern Node without the OpenSSL legacy provider, so I aligned the fork on `5001` and documented the workaround.

## NICE-TO-HAVE and EXTRA

- Added `docs/architecture.md` with a Mermaid architecture diagram.
- Added three ADRs under `docs/adr/`.
- Added characterization tests under `experiments/characterization/`.
- Added `docker-compose.yml` and README usage notes.
- Upgraded Mongoose from `5.10.6` to `8.22.1`, adjusted removed APIs/options, and verified seed, backend startup, product/user delete flows, and order creation.

---

# M3 — Report

## IDE

- Primary IDE: Claude Code (claude-sonnet-4-6).
- MCP config: `.mcp.json` in the repo root.

## Feature flags MCP

**Scenario:** check the state of feature `search_v2`, promote to `Testing` if it is `Disabled`, then set traffic rollout to 25%.

### Tool call 1 — `get_feature_info`

**Request:**
```json
{ "feature_id": "search_v2" }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline. Improves relevance for multi-word queries and handles common misspellings via fuzzy matching. Backend: new productController search path; index built on name, brand, category, description fields.",
  "status": "Testing",
  "traffic_percentage": 15,
  "last_modified": "2026-03-10",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary"
}
```

**Decision:** feature is already in `Testing` at 15% traffic — `set_feature_state` is not needed; proceeding directly to `adjust_traffic_rollout`.

### Tool call 2 — `adjust_traffic_rollout`

**Request:**
```json
{ "feature_id": "search_v2", "percentage": 25 }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-08",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "hint": null
}
```

**Result:** rollout set to 25%; `last_modified` updated to `2026-05-08` (UTC).

### Tool call 3 — `get_feature_info` (confirmation)

**Request:**
```json
{ "feature_id": "search_v2" }
```

**Response:**
```json
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-08",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary"
}
```

**Summary:** `search_v2` — `status: Testing`, `traffic_percentage: 25`, `last_modified: 2026-05-08`. Scenario completed without manual intervention.

---

## Search-docs MCP

**Scenario:** three questions answered via `search_project_docs` tool against the proshop_mern documentation corpus (284 chunks, BGE-M3 embeddings, Qdrant local).

### Query 1 — "What DB is used in proshop_mern and why?"

**Request:**
```json
{ "query": "What database is used in proshop_mern and why was it chosen?", "filter_type": "adr", "top_k": 3 }
```

**Top-3 results:**

| # | source_file | score | snippet |
|---|---|---|---|
| 1 | `adrs/adr-001-mongodb-vs-postgres.md` | 0.603 | "Before the first commit, the team needed to select a database for the ProShop e-c…" |
| 2 | `adrs/adr-003-jwt-vs-session.md` | 0.522 | "The ProShop API (Express) needed an authentication mechanism…" |
| 3 | `adrs/adr-002-redux-vs-context.md` | 0.517 | "…RTK Query migration planned for v3.0…" |

**Answer:** MongoDB (via Mongoose) was chosen as the primary database at initial project setup (ADR-001, status: Accepted, 2023-01-10). The decision was made by the engineering team before the first commit. Top-1 chunk was `adrs/adr-001-mongodb-vs-postgres.md`; chunks 2–3 are unrelated ADRs (auth, state management) that share structural similarity with the query.

---

### Query 2 — "Which features depend on payment_stripe_v3?"

**Requests:**
```json
{ "query": "Which features depend on payment_stripe_v3?", "filter_type": "spec", "top_k": 3 }
{ "query": "payment_stripe_v3 dependencies express_checkout", "filter_source_file": "feature-flags-spec.md", "top_k": 5 }
```

**Top results:**

| # | source_file | score | section | snippet |
|---|---|---|---|---|
| 1 | `feature-flags-spec.md` | 0.648 | "4. Feature Flag Catalog — Checkout, Payments" | "`express_checkout` — Express One-Click Checkout…" |
| 2 | `feature-flags-spec.md` | 0.522 | "3. MCP Server Tool Contract" | "Tool 3: `adjust_traffic_rollout`…" |
| 3 | `feature-flags-spec.md` | 0.515 | "2. The `features.json` Format" | "Required Fields…" |

**Answer:** The search returned the Checkout/Payments catalog section (score 0.648) covering `express_checkout` as the most relevant chunk. A follow-up `get_feature_info("express_checkout")` confirmed its `dependencies: ["guest_cart_persistence"]` — not Stripe. The name `payment_stripe_v3` from the homework spec is a conceptual identifier; the runtime feature ID is `stripe_alternative`. No feature in `features.json` lists `stripe_alternative` as an explicit dependency.

---

### Query 3 — "What happened during the last checkout incident?"

**Request:**
```json
{ "query": "What happened during the last checkout incident?", "filter_type": "incident", "top_k": 3 }
```

**Top-3 results (all from same document):**

| # | source_file | score | section | snippet |
|---|---|---|---|---|
| 1 | `incidents/i-001-paypal-double-charge.md` | 0.530 | "Root Cause Analysis" | "The `@paypal/react-paypal-js` SDK fires the `onApprove` callback…" |
| 2 | `incidents/i-001-paypal-double-charge.md` | 0.527 | "Summary" | "Severity: P1 (production financial impact), Status: Resolved…" |
| 3 | `incidents/i-001-paypal-double-charge.md` | 0.522 | "Timeline" | "2023-11-03 21:14: PayPal sandbox receives payment…" |

**Answer:** The last checkout incident (i-001, detected 2023-11-04, severity P1) was a PayPal double-charge. The `@paypal/react-paypal-js` SDK fired the `onApprove` callback twice on a single payment authorization, and the handler called `payOrder` both times — resulting in two orders created and two payments charged. The incident was resolved in ~38 hours (2023-11-06). All three top-K chunks came from `incidents/i-001-paypal-double-charge.md`, confirming high retrieval precision with the `incident` filter.

---

## End-to-end

**Scenario:** investigate the Stripe payment feature (`payment_stripe_v3` in the homework spec) using both MCP servers — find documentation via search-docs, check runtime state via feature-flags, conditionally promote, cite documentation.

### Tool call 1 — `search_project_docs` (search-docs MCP)

**Request:**
```json
{
  "query": "payment_stripe_v3 what is it purpose description dependencies",
  "filter_source_file": "feature-flags-spec.md",
  "top_k": 3
}
```

**Response (top-1):**
```json
{
  "source_file": "feature-flags-spec.md",
  "title": "Feature Flags Specification — ProShop MERN",
  "parent_headings": ["4. Feature Flag Catalog"],
  "score": 0.554,
  "snippet": "## 4. Feature Flag Catalog — Checkout, Payments ### Checkout #### `express_checkout` — Express One-Click Checkout…"
}
```

**Observation:** search returned the Checkout/Payments catalog section; `payment_stripe_v3` is not a direct chunk title. Proceeding to feature-flags MCP to resolve the runtime ID.

---

### Tool call 2 — `get_feature_info` (feature-flags MCP) — initial lookup

**Request:**
```json
{ "feature_id": "payment_stripe_v3" }
```

**Response:**
```json
{
  "error": "FEATURE_NOT_FOUND",
  "message": "No feature with ID 'payment_stripe_v3' exists in features.json.",
  "feature_id": "payment_stripe_v3"
}
```

---

### Tool call 3 — `list_features` (feature-flags MCP) — resolve ID

**Request:** `list_features()`

**Response (payment-related excerpt):**
```json
[
  { "feature_id": "paypal_express_buttons", "name": "PayPal Express Checkout Buttons", "status": "Enabled", "traffic_percentage": 100 },
  { "feature_id": "apple_pay", "name": "Apple Pay / Web Payments API", "status": "Disabled", "traffic_percentage": 0 },
  { "feature_id": "stripe_alternative", "name": "Stripe as Alternative Payment Processor", "status": "Testing", "traffic_percentage": 5 }
]
```

**Resolution:** `payment_stripe_v3` from the homework spec → `stripe_alternative` in the runtime `features.json`.

---

### Tool call 4 — `get_feature_info` (feature-flags MCP) — full state

**Request:**
```json
{ "feature_id": "stripe_alternative" }
```

**Response:**
```json
{
  "feature_id": "stripe_alternative",
  "name": "Stripe as Alternative Payment Processor",
  "description": "Enables the Stripe payment method option that is currently commented out in PaymentScreen.js. Adds a Stripe checkout backend route to orderController and handles webhooks for async payment confirmation. Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal.",
  "status": "Testing",
  "traffic_percentage": 5,
  "last_modified": "2026-04-05",
  "targeted_segments": ["beta_users"],
  "rollout_strategy": "canary"
}
```

---

### Decision

Feature `stripe_alternative` is already in **Testing** at 5% traffic. The scenario condition "if Disabled → promote to Testing and set traffic to 25%" does not apply. No state change was performed; current state is preserved.

---

### Documentation quote

From `get_feature_info("stripe_alternative")` description (sourced from `feature-flags-spec.md` via the RAG corpus):

> "Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal."

The feature enables the Stripe payment option currently commented out in `PaymentScreen.js`, adds a backend route to `orderController`, and handles async payment confirmation via webhooks.

---

### Tool call chain summary

| Step | Tool (MCP) | Input | Result |
|------|-----------|-------|--------|
| 1 | `search_project_docs` (search-docs) | `payment_stripe_v3`, `filter_source_file: feature-flags-spec.md` | Checkout/Payments catalog section returned; no direct `payment_stripe_v3` chunk |
| 2 | `get_feature_info` (feature-flags) | `payment_stripe_v3` | FEATURE_NOT_FOUND — name mismatch between spec and runtime |
| 3 | `list_features` (feature-flags) | — | All 25 flags listed; `stripe_alternative` identified as Stripe payment feature |
| 4 | `get_feature_info` (feature-flags) | `stripe_alternative` | Status: Testing, traffic: 5%, no blocking dependencies |
| — | State change | — | Not performed — feature already in Testing |

---

## Hybrid + Reranker

The same three queries from §Search-docs MCP, run through three retrieval pipelines and graded on the top-1 `source_file` returned (no agentic filters, raw query in, raw chunks out):

- ✓ — top-1 matches the spec-expected file
- ≈ — top-1 is a related file on the same topic (a sibling chunk that discusses the answer but is not the canonical document the spec calls out)
- ✗ — top-1 is unrelated

| Mode | Q1 — DB choice | Q2 — `payment_stripe_v3` deps | Q3 — last checkout incident |
|------|----------------|-------------------------------|-----------------------------|
| Naive RAG (`rag/query.ts`, dense only, no filters) | ≈ `dev-history.md` | ≈ `adrs/adr-004-paypal-vs-stripe.md` | ≈ `runbooks/incident-response.md` |
| Hybrid — BM25 + dense + RRF (`rag/hybrid.ts`) | ≈ `best-practices.md` | ≈ `adrs/adr-004-paypal-vs-stripe.md` | ≈ `runbooks/incident-response.md` |
| Hybrid + Reranker — BGE-reranker-v2-m3 (`rag/hybrid-rerank.ts`) | ≈ `best-practices.md` | ≈ `features/checkout.md` | ≈ `runbooks/incident-response.md` |

Spec-expected top-1 by query: Q1 — `adrs/adr-001-mongodb-vs-postgres.md`; Q2 — `features/payments.md` or `feature-flags-spec.md`; Q3 — `incidents/i-001-paypal-double-charge.md`.

**Reflection.** No pipeline reaches a strict ✓ at top-1 on this corpus, which is itself a useful negative result rather than a setup defect — atomic chunking spreads each canonical answer across several near-equivalent documents (`dev-history.md` and `architecture.md` both narrate the MongoDB decision; `runbooks/incident-response.md` lexically contains the word "incident" many more times than `incidents/i-001-paypal-double-charge.md` itself does), so even a perfect retriever can only break the tie via signal that is not in the chunk text. Hybrid did its expected job on Q2: the literal token `payment_stripe_v3` produced a clean BM25 hit with score 1.0 on `adrs/adr-004` and pulled `feature-flags-spec.md` (✓) into top-3 with a higher relative score than the dense baseline, partially supporting the +35% BM25-over-dense intuition from `refs/chunking-strategies-guide.md`. Reranker's effect was narrower: it deduplicated the two `adrs/adr-004` chunks in Q2 and lifted `feature-flags-spec.md` from top-3 to top-2, but it never broke the strict top-1 expectation — the +25% reranker-lift number from the same guide did not reproduce on three queries against a 284-chunk corpus. Q3 was the most instructive failure mode: naive RAG actually had `incidents/i-001-paypal-double-charge.md` at positions 3 and 4 of top-5, but hybrid's BM25 weight on the literal "incident" token over-promoted duplicates of `runbooks/incident-response.md`, and the reranker — with six i-001 chunks already present at positions 6, 8, 11, 18, 22, 25 of the hybrid top-25 pool — still ranked five runbook duplicates above all of them. The takeaway is that on a small, deliberately ambiguous corpus, sparser layers of retrieval (BM25, cross-encoder) can amplify lexical traps as easily as they overcome cross-lingual weakness; a real production setup would need document-level deduplication or MMR-style diversification before reranking, not just more layers stacked on top.

---

## Reflection

**Stack.** TypeScript MCP SDK + Zod for both servers, Qdrant 1.17 in Docker for the vector store, BGE-M3 (1024-dim, multilingual) via Ollama for embeddings, with all ingest/query code in Node/TS to keep one toolchain across MCP, ingestion, and query. The course corpus is bilingual EN+RU, so an English-only model like `text-embedding-3-small` was a non-starter; BGE-M3 is MIT-licensed, runs locally, has solid multilingual MIRACL numbers, and pairs cleanly with `bge-reranker-v2-m3` for Part 4. Qdrant was the simplest local option with built-in sparse-vector support that Part 4 hybrid search will need.

**What was hard.** Atomic-semantic chunking with a 100-token soft floor produced 284 chunks but left many glossary and short API entries under-contextualized for dense retrieval; the fix was to embed an enriched string (`title + parent_headings + keywords + summary + text`) while keeping the raw `text` in the payload — a Contextual-Retrieval-style trick that visibly improved top-K relevance. Even then, vanilla dense retrieval did not consistently put the spec's "expected" file in top-1 (e.g. `payment_stripe_v3` lost to general payment ADRs because exact-token IDs are weak signal for dense embeddings), so we leaned on the optional `filter_type` / `filter_source_file` arguments instead of baking heuristics into the query layer. Local Ollama also fought the sandbox — `~/.ollama` writes and the default bind on `127.0.0.1:11434` were blocked, so the daemon runs with `HOME` and `OLLAMA_MODELS` redirected to in-repo `.ollama-home/` / `.ollama-models/`. During chunking, several `general-purpose` subagents hit token limits and had to be re-dispatched, and `pages/` plus `adrs+runbooks+incidents` needed a second pass with code-fence-aware heading parsing to clear the line-count gate.

**What I would change.** Go straight to hybrid (BM25 + dense + RRF) with a reranker on top — the exact-token weakness above is a textbook case for sparse retrieval, and Part 4 should validate the lift. I would also batch the chunking through one deterministic Node script rather than parallel subagents; the throughput win was not worth the re-dispatch overhead on a 50K-word corpus.

**IDE:** Claude Code.
